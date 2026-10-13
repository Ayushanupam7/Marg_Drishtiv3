import os
import cv2
import numpy as np
import time
import json
import base64
import logging
import sqlite3
import threading
from pathlib import Path
from typing import Dict, Any, Optional, Callable, List
from datetime import datetime

from app.config import (
    UPLOADS_DIR,
    OUTPUTS_DIR,
    SNAPSHOTS_DIR,
    DB_PATH,
    EMERGENCY_CLASSES
)
from app.services.detector import traffic_detector
from app.services.tracker import LaneTracker, SmoothVehicleTracker
from app.database import get_connection

logger = logging.getLogger("margdrishti.video_processor")

# Vibrant high-contrast colors for bounding boxes (BGR format for OpenCV)
CLASS_COLORS = {
    "car": (240, 205, 35),        # Bright Aqua / Cyan
    "ambulance": (40, 40, 250),    # Vivid Emergency Red
    "police_car": (245, 95, 30),   # Siren Electric Blue
    "fire_truck": (30, 115, 255),  # Fire Red-Orange
    "bus": (220, 65, 185),        # Neon Purple/Magenta
    "truck": (30, 175, 255),       # Vibrant Amber / Orange
    "bike": (40, 230, 240),        # High-Vis Neon Yellow
    "motorcycle": (40, 230, 240)
}
DEFAULT_BOX_COLOR = (220, 220, 220)

def annotate_emergency_snapshot(
    frame: np.ndarray,
    bbox: Optional[List[int]],
    vehicle_type: str,
    confidence: float
) -> np.ndarray:
    """
    Draws a tactical HUD targeting box, neon corner brackets, centroid crosshair,
    and a prominent high-contrast ID banner around the identified emergency vehicle.
    """
    annotated = frame.copy()
    if not bbox or len(bbox) < 4:
        return annotated

    h, w = annotated.shape[:2]
    x1, y1, x2, y2 = [int(v) for v in bbox]
    x1, y1 = max(0, min(w - 1, x1)), max(0, min(h - 1, y1))
    x2, y2 = max(0, min(w - 1, x2)), max(0, min(h - 1, y2))
    if x2 <= x1 or y2 <= y1:
        return annotated

    box_color = (25, 30, 235)      # Vibrant Crimson Red (BGR)
    corner_color = (0, 235, 255)   # Neon Yellow / Electric Gold (BGR)
    dark_bg = (10, 10, 15)

    # 1. High contrast bounding box with dark border
    cv2.rectangle(annotated, (x1, y1), (x2, y2), dark_bg, 5)
    cv2.rectangle(annotated, (x1, y1), (x2, y2), box_color, 3)

    # 2. Tactical Corner HUD Brackets
    bw = x2 - x1
    bh = y2 - y1
    c_len = max(16, min(40, bw // 4, bh // 4))
    thick = 4

    # Top-Left corner
    cv2.line(annotated, (x1, y1), (x1 + c_len, y1), corner_color, thick)
    cv2.line(annotated, (x1, y1), (x1, y1 + c_len), corner_color, thick)
    # Top-Right corner
    cv2.line(annotated, (x2, y1), (x2 - c_len, y1), corner_color, thick)
    cv2.line(annotated, (x2, y1), (x2, y1 + c_len), corner_color, thick)
    # Bottom-Left corner
    cv2.line(annotated, (x1, y2), (x1 + c_len, y2), corner_color, thick)
    cv2.line(annotated, (x1, y2), (x1, y2 - c_len), corner_color, thick)
    # Bottom-Right corner
    cv2.line(annotated, (x2, y2), (x2 - c_len, y2), corner_color, thick)
    cv2.line(annotated, (x2, y2), (x2, y2 - c_len), corner_color, thick)

    # 3. Target reticle / crosshair centroid pip
    cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
    cv2.circle(annotated, (cx, cy), 8, dark_bg, -1)
    cv2.circle(annotated, (cx, cy), 6, corner_color, -1)
    cv2.circle(annotated, (cx, cy), 2, (255, 255, 255), -1)

    # 4. Identification Callout Header
    clean_type = vehicle_type.upper().replace('_', ' ')
    conf_pct = float(confidence) * 100 if float(confidence) <= 1.0 else float(confidence)
    label_text = f"IDENTIFIED: {clean_type} ({conf_pct:.1f}%)"

    font = cv2.FONT_HERSHEY_DUPLEX
    scale = 0.75
    fthick = 2
    (tw, th), _ = cv2.getTextSize(label_text, font, scale, fthick)

    # Place banner above the box if possible, or inside
    if y1 - th - 18 >= 10:
        bx1 = max(5, x1)
        by1 = y1 - th - 18
        bx2 = min(w - 5, bx1 + tw + 24)
        by2 = y1 - 4
    else:
        bx1 = max(5, x1)
        by1 = y1 + 4
        bx2 = min(w - 5, bx1 + tw + 24)
        by2 = y1 + th + 18

    # Draw dark backing + badge
    cv2.rectangle(annotated, (bx1 - 2, by1 - 2), (bx2 + 2, by2 + 2), dark_bg, -1)
    cv2.rectangle(annotated, (bx1, by1), (bx2, by2), box_color, -1)
    cv2.putText(annotated, label_text, (bx1 + 12, by2 - 6), font, scale, (255, 255, 255), fthick, cv2.LINE_AA)

    return annotated

class VideoProcessingJob:
    def __init__(
        self,
        analysis_id: str,
        input_filepath: str,
        conf_threshold: float = 0.35,
        iou_threshold: float = 0.45,
        lanes_config: Optional[List[Dict[str, Any]]] = None,
        target_fps: Optional[float] = 20.0
    ):
        self.analysis_id = analysis_id
        self.input_filepath = input_filepath
        self.conf_threshold = conf_threshold
        self.iou_threshold = iou_threshold
        self.target_fps = target_fps
        self.tracker = LaneTracker(lanes_config)
        self.smooth_tracker = SmoothVehicleTracker(max_missed=6, iou_thresh=0.22)
        self.stop_requested = False
        self.progress = 0.0
        self.current_frame = 0
        self.total_frames = 0
        self.fps = 0.0
        self.status = "PENDING"
        self.error_message = None
        self.highlight_vehicle_id: Optional[int] = None
        self.latest_frame_jpeg: Optional[bytes] = None
        self.latest_tracked_items: List[Dict[str, Any]] = []

    def request_stop(self):
        self.stop_requested = True

    def set_target_fps(self, target_fps: Optional[float]):
        self.target_fps = target_fps

    def set_highlight_vehicle(self, vehicle_id: Optional[int]):
        self.highlight_vehicle_id = vehicle_id

    def run(self, progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None):
        self.status = "PROCESSING"
        self.smooth_tracker.reset()
        self.tracker.reset()
        self.latest_tracked_items = []
        self.latest_frame_jpeg = None
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE analyses SET status = 'PROCESSING', progress = 0.0 WHERE id = ?",
            (self.analysis_id,)
        )
        conn.commit()
        conn.close()

        cap = cv2.VideoCapture(self.input_filepath)
        if not cap.isOpened():
            self.status = "FAILED"
            self.error_message = f"Could not open video file at {self.input_filepath}"
            self._update_db_failed(self.error_message)
            return

        self.total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        video_fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        duration_sec = self.total_frames / video_fps if self.total_frames > 0 else 0.0

        output_filename = f"annotated_{self.analysis_id}.mp4"
        output_filepath = str(OUTPUTS_DIR / output_filename)

        # Video writer - mp4v
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out_writer = cv2.VideoWriter(output_filepath, fourcc, video_fps, (width, height))

        start_time = time.time()
        frame_idx = 0
        flow_over_time = []
        recent_detections = []
        emergency_alerts_created = set()
        recent_frame_times: List[float] = []

        try:
            while cap.isOpened():
                if self.stop_requested:
                    self.status = "STOPPED"
                    break

                frame_start_time = time.time()

                ret, frame = cap.read()
                if not ret:
                    break

                frame_idx += 1
                self.current_frame = frame_idx
                timestamp_sec = frame_idx / video_fps

                # Run YOLO detection + Smooth Multi-Object Tracking
                tracked_items = []
                try:
                    # Detect all vehicles with configured confidence threshold
                    raw_detections = traffic_detector.detect_vehicles(
                        frame,
                        conf=self.conf_threshold,
                        iou=self.iou_threshold,
                        imgsz=640
                    )
                    
                    # Update smooth tracker for anti-jitter smoothing, coasting & sequential mark numbers
                    tracked_items = self.smooth_tracker.update(
                        detections=raw_detections,
                        frame_width=width,
                        frame_height=height
                    )
                except Exception as track_err:
                    logger.warning(f"Detection/tracking error at frame {frame_idx}: {track_err}")

                # Update lane tracker logic
                metrics = self.tracker.update_frame(
                    tracked_items,
                    frame_width=width,
                    frame_height=height,
                    frame_idx=frame_idx,
                    timestamp_sec=timestamp_sec
                )

                # Process emergency vehicles
                for em in metrics.get("emergency_vehicles", []):
                    em_id = f"{em['track_id']}_{em['vehicle_type']}"
                    if em_id not in emergency_alerts_created:
                        emergency_alerts_created.add(em_id)
                        # Save snapshot of cropped emergency vehicle or frame with target vehicle marked
                        snap_name = f"em_{self.analysis_id}_{em['track_id']}.jpg"
                        snap_path = SNAPSHOTS_DIR / snap_name
                        snap_frame = annotate_emergency_snapshot(
                            frame=frame,
                            bbox=em.get("bbox"),
                            vehicle_type=em["vehicle_type"],
                            confidence=em["confidence"]
                        )
                        cv2.imwrite(str(snap_path), snap_frame)
                        self._save_emergency_alert(
                            analysis_id=self.analysis_id,
                            vehicle_type=em["vehicle_type"],
                            lane_name=em["lane_name"],
                            confidence=em["confidence"],
                            snapshot_url=f"/api/outputs/snapshots/{snap_name}",
                            timestamp_sec=timestamp_sec,
                            bbox=em.get("bbox")
                        )

                # Draw annotations on frame
                annotated_frame = self._render_annotations(
                    frame=frame,
                    tracked_items=tracked_items,
                    width=width,
                    height=height,
                    frame_idx=frame_idx,
                    total_frames=self.total_frames,
                    metrics=metrics
                )

                out_writer.write(annotated_frame)

                # Store latest annotated frame as JPEG for live streaming visual feed
                try:
                    _, enc_jpg = cv2.imencode('.jpg', annotated_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 75])
                    self.latest_frame_jpeg = enc_jpg.tobytes()
                except Exception as enc_err:
                    logger.warning(f"Failed to encode preview frame: {enc_err}")

                # Update live tracked items telemetry
                self.latest_tracked_items = [
                    {
                        "track_id": it["track_id"],
                        "class_name": it["class_name"],
                        "confidence": round(float(it["confidence"]), 2),
                        "bbox": [int(b) for b in it["bbox"]],
                        "is_coasting": it.get("is_coasting", False),
                        "is_emergency": it["class_name"] in EMERGENCY_CLASSES,
                        "is_highlighted": (self.highlight_vehicle_id is not None and it["track_id"] == self.highlight_vehicle_id)
                    }
                    for it in tracked_items
                ]

                # Aggregate flow over time (every 1 second or 25 frames)
                if frame_idx % int(video_fps) == 0 or frame_idx == self.total_frames:
                    elapsed = time.time() - start_time
                    calc_fps = frame_idx / elapsed if elapsed > 0 else video_fps
                    flow_over_time.append({
                        "timestamp_sec": round(timestamp_sec, 1),
                        "vehicle_count": len(tracked_items),
                        "unique_vehicles": metrics["total_unique_vehicles"],
                        "fps": round(calc_fps, 1)
                    })

                # Maintain recent detection events
                for ev in metrics.get("current_events", []):
                    recent_detections.insert(0, {
                        "frame": frame_idx,
                        "time": f"{int(timestamp_sec//60):02d}:{int(timestamp_sec%60):02d}",
                        "event": ev.get("event_type", "detected"),
                        "lane": ev.get("lane_name", "All Lanes"),
                        "type": ev.get("class_name", ev.get("vehicle_type", "vehicle")),
                        "id": ev.get("track_id", "-")
                    })
                if len(recent_detections) > 20:
                    recent_detections = recent_detections[:20]

                # Update progress & instantaneous rolling FPS
                self.progress = round((frame_idx / max(self.total_frames, 1)) * 100.0, 1)
                now_t = time.time()
                recent_frame_times.append(now_t)
                if len(recent_frame_times) > 8:
                    recent_frame_times.pop(0)
                if len(recent_frame_times) >= 2:
                    window_dt = recent_frame_times[-1] - recent_frame_times[0]
                    self.fps = round((len(recent_frame_times) - 1) / window_dt, 1) if window_dt > 0 else 0.0
                elif self.target_fps:
                    self.fps = round(float(self.target_fps), 1)
                else:
                    elapsed_now = now_t - start_time
                    self.fps = round(frame_idx / elapsed_now, 1) if elapsed_now > 0 else 0.0

                # Notify via callback every 5 frames or at final frame
                if frame_idx % 5 == 0 or frame_idx == self.total_frames:
                    payload = {
                        "analysis_id": self.analysis_id,
                        "status": self.status,
                        "progress": self.progress,
                        "current_frame": frame_idx,
                        "total_frames": self.total_frames,
                        "fps": self.fps,
                        "target_fps": self.target_fps,
                        "total_vehicles": metrics["total_unique_vehicles"],
                        "counts_by_class": metrics["unique_counts_by_class"],
                        "lane_densities": metrics["lane_metrics"],
                        "emergency_count": len(metrics["emergency_vehicles"])
                    }
                    if progress_callback:
                        progress_callback(payload)

                    # Update periodic status in DB
                    self._update_db_progress(
                        progress=self.progress,
                        current_frame=frame_idx,
                        total_frames=self.total_frames,
                        fps=self.fps,
                        metrics=metrics,
                        flow_over_time=flow_over_time,
                        recent_detections=recent_detections
                    )

                # Rate pacing according to target_fps (supports 0.1, 0.2, 0.5, 0.6, 20, 30, 40, 50, etc.)
                if self.target_fps and self.target_fps > 0:
                    desired_interval = 1.0 / self.target_fps
                    elapsed_frame = time.time() - frame_start_time
                    sleep_needed = desired_interval - elapsed_frame
                    if sleep_needed > 0:
                        sleep_deadline = time.time() + sleep_needed
                        while time.time() < sleep_deadline and not self.stop_requested:
                            # Responsive adjustment if target_fps is dynamically updated mid-sleep
                            if self.target_fps and self.target_fps > 0:
                                current_desired = 1.0 / self.target_fps
                                cur_spent = time.time() - frame_start_time
                                if cur_spent >= current_desired:
                                    break
                                sleep_deadline = min(sleep_deadline, frame_start_time + current_desired)
                            elif not self.target_fps:
                                break
                            time.sleep(min(0.02, max(0.001, sleep_deadline - time.time())))

            if not self.stop_requested:
                self.status = "COMPLETED"
                self.progress = 100.0

        except Exception as e:
            logger.error(f"Error processing video: {e}", exc_info=True)
            self.status = "FAILED"
            self.error_message = str(e)
        finally:
            cap.release()
            out_writer.release()

            # Final DB commit
            final_metrics = {
                "total_unique_vehicles": len(self.tracker.total_unique_vehicles),
                "unique_counts_by_class": self.tracker.unique_counts_by_class,
                "lane_metrics": {l["name"]: {
                    "lane_id": l["id"],
                    "lane_name": l["name"],
                    "active_vehicles": len(self.tracker.active_in_lane[l["id"]]),
                    "cumulative_count": len(self.tracker.counted_ids_per_lane[l["id"]]),
                    "congestion_level": "Low" if len(self.tracker.counted_ids_per_lane[l["id"]]) < 5 else "Moderate",
                    "status_color": "green",
                    "flow_rate_per_min": round(len(self.tracker.counted_ids_per_lane[l["id"]]) / max(duration_sec / 60.0, 0.05), 1),
                    "class_counts": self.tracker.lane_class_counts[l["id"]]
                } for l in self.tracker.lanes},
                "emergency_vehicles": self.tracker.emergency_vehicles_detected
            }

            self._finalize_db(
                output_video_path=f"/api/outputs/{output_filename}",
                duration_sec=duration_sec,
                final_metrics=final_metrics,
                flow_over_time=flow_over_time,
                recent_detections=recent_detections
            )

    def _render_annotations(self, frame, tracked_items, width, height, frame_idx, total_frames, metrics):
        annotated = frame.copy()

        # 1. Draw Lane Lines & Boundaries
        for lane in self.tracker.lanes:
            poly = lane.get("polygon")
            if poly:
                pts = np.array([[int(p[0] * width), int(p[1] * height)] for p in poly], np.int32)
                cv2.polylines(annotated, [pts], isClosed=True, color=(140, 140, 140), thickness=1, lineType=cv2.LINE_AA)
            
            line_y = int(lane.get("line_y", 0.6) * height)
            # Draw horizontal counting line for lane with vivid yellow-cyan
            cv2.line(annotated, (0, line_y), (width, line_y), (0, 215, 255), 2, lineType=cv2.LINE_AA)
            cv2.putText(
                annotated,
                f"COUNT LINE: {lane['name'].upper()}",
                (20, max(22, line_y - 8)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.45,
                (0, 215, 255),
                1,
                cv2.LINE_AA
            )

        # 2. Draw Smooth Bounding Boxes & Prominent Mark Numbers on ALL detected vehicles
        for item in tracked_items:
            tid = item["track_id"]
            bbox = item["bbox"]
            cname = item["class_name"]
            conf = item["confidence"]
            is_coasting = item.get("is_coasting", False)
            history = item.get("history", [])

            # Clamp coordinates to frame dimensions
            x1 = max(0, min(width - 2, int(bbox[0])))
            y1 = max(0, min(height - 2, int(bbox[1])))
            x2 = max(x1 + 10, min(width - 1, int(bbox[2])))
            y2 = max(y1 + 10, min(height - 1, int(bbox[3])))

            is_emergency = cname in EMERGENCY_CLASSES
            is_highlighted = (self.highlight_vehicle_id is not None and tid == self.highlight_vehicle_id)

            if is_highlighted:
                color = (0, 215, 255)  # Vivid Golden Amber / Target Lock
                box_thick = 4
            elif is_emergency:
                color = (30, 30, 245)
                box_thick = 3
            else:
                color = CLASS_COLORS.get(cname, DEFAULT_BOX_COLOR)
                box_thick = 1 if is_coasting else 2

            # Draw smooth motion trajectory trail behind vehicle
            if len(history) > 1:
                trail_color = (0, 240, 255) if is_highlighted else color
                trail_thick = 3 if is_highlighted else 2
                trail_pts = np.array(history[-16:], np.int32)
                cv2.polylines(annotated, [trail_pts], isClosed=False, color=trail_color, thickness=trail_thick, lineType=cv2.LINE_AA)
                for h_idx, (hx, hy) in enumerate(history[-8:]):
                    r = max(1, int(1 + (h_idx / 8.0) * (4 if is_highlighted else 3)))
                    cv2.circle(annotated, (int(hx), int(hy)), r, trail_color, -1, cv2.LINE_AA)

            # Draw Main Bounding Box Rectangle
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, box_thick, cv2.LINE_AA)
            if is_highlighted:
                # Glowing outer border
                gx1, gy1 = max(0, x1 - 3), max(0, y1 - 3)
                gx2, gy2 = min(width - 1, x2 + 3), min(height - 1, y2 + 3)
                cv2.rectangle(annotated, (gx1, gy1), (gx2, gy2), (50, 255, 255), 1, cv2.LINE_AA)

            # Tactical Corner Accent Brackets (Sharp HUD styling)
            c_len = min(24 if is_highlighted else 16, max(8, (x2 - x1) // 3 if is_highlighted else (x2 - x1) // 4, (y2 - y1) // 3 if is_highlighted else (y2 - y1) // 4))
            b_thick = box_thick + 1
            # Top-Left
            cv2.line(annotated, (x1, y1), (x1 + c_len, y1), color, b_thick, cv2.LINE_AA)
            cv2.line(annotated, (x1, y1), (x1, y1 + c_len), color, b_thick, cv2.LINE_AA)
            # Top-Right
            cv2.line(annotated, (x2, y1), (x2 - c_len, y1), color, b_thick, cv2.LINE_AA)
            cv2.line(annotated, (x2, y1), (x2, y1 + c_len), color, b_thick, cv2.LINE_AA)
            # Bottom-Left
            cv2.line(annotated, (x1, y2), (x1 + c_len, y2), color, b_thick, cv2.LINE_AA)
            cv2.line(annotated, (x1, y2), (x1, y2 - c_len), color, b_thick, cv2.LINE_AA)
            # Bottom-Right
            cv2.line(annotated, (x2, y2), (x2 - c_len, y2), color, b_thick, cv2.LINE_AA)
            cv2.line(annotated, (x2, y2), (x2, y2 - c_len), color, b_thick, cv2.LINE_AA)

            # Vehicle center tracking pip & Target Crosshairs
            cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
            if is_highlighted:
                # Crosshairs reticle around center
                cv2.circle(annotated, (cx, cy), 16, (0, 215, 255), 2, cv2.LINE_AA)
                cv2.circle(annotated, (cx, cy), 5, (0, 215, 255), -1, cv2.LINE_AA)
                cv2.line(annotated, (cx - 24, cy), (cx - 8, cy), (0, 215, 255), 2, cv2.LINE_AA)
                cv2.line(annotated, (cx + 8, cy), (cx + 24, cy), (0, 215, 255), 2, cv2.LINE_AA)
                cv2.line(annotated, (cx, cy - 24), (cx, cy - 8), (0, 215, 255), 2, cv2.LINE_AA)
                cv2.line(annotated, (cx, cy + 8), (cx, cy + 24), (0, 215, 255), 2, cv2.LINE_AA)
            else:
                cv2.circle(annotated, (cx, cy), 3, color, -1, cv2.LINE_AA)

            # PROMINENT MARK NUMBER & LABEL BANNER
            if is_highlighted:
                mark_text = f"🎯 TARGET #{tid}"
                info_text = f"{cname.upper()} {int(conf * 100)}% (LOCKED)"
            elif is_emergency:
                mark_text = f"#{tid}"
                info_text = f"🚨 {cname.upper()} {int(conf * 100)}%"
            else:
                mark_text = f"#{tid}"
                info_text = f"{cname.upper()} {int(conf * 100)}%"

            font_scale = 0.50
            (mark_w, mark_h), _ = cv2.getTextSize(mark_text, cv2.FONT_HERSHEY_SIMPLEX, font_scale, 2)
            (info_w, info_h), _ = cv2.getTextSize(info_text, cv2.FONT_HERSHEY_SIMPLEX, font_scale, 1)

            pill_w = mark_w + 14
            banner_w = pill_w + info_w + 14
            banner_h = max(info_h, mark_h) + 12

            # Smart placement: above box if space, otherwise inside top of box
            if y1 - banner_h - 4 > 46:
                b_y1 = y1 - banner_h - 2
                b_y2 = y1 - 2
            else:
                b_y1 = y1 + 2
                b_y2 = y1 + banner_h + 2

            b_x1 = max(0, min(width - banner_w - 4, x1))
            b_x2 = b_x1 + banner_w

            # Dark solid background with 1px border matching class color
            cv2.rectangle(annotated, (b_x1, b_y1), (b_x2, b_y2), (15, 23, 42), -1)
            cv2.rectangle(annotated, (b_x1, b_y1), (b_x2, b_y2), color, 2 if is_highlighted else 1, cv2.LINE_AA)

            # Distinct Mark Number Pill on left side of banner
            pill_color = (0, 215, 255) if is_highlighted else ((30, 30, 245) if is_emergency else color)
            cv2.rectangle(annotated, (b_x1, b_y1), (b_x1 + pill_w, b_y2), pill_color, -1)

            # Mark text color: dark slate if gold highlight, else white
            text_color = (15, 23, 42) if is_highlighted else (255, 255, 255)
            cv2.putText(
                annotated,
                mark_text,
                (b_x1 + 6, b_y2 - 7),
                cv2.FONT_HERSHEY_SIMPLEX,
                font_scale,
                text_color,
                2,
                cv2.LINE_AA
            )

            # High-contrast text for vehicle class and confidence percentage
            text_x = b_x1 + pill_w + 6
            cv2.putText(
                annotated,
                info_text,
                (text_x, b_y2 - 7),
                cv2.FONT_HERSHEY_SIMPLEX,
                font_scale,
                (0, 235, 255) if is_highlighted else (255, 255, 255),
                1,
                cv2.LINE_AA
            )

        # 3. Header HUD Banner (NIC / Government Control Room style)
        hud_h = 44
        overlay = annotated.copy()
        cv2.rectangle(overlay, (0, 0), (width, hud_h), (12, 35, 64), -1)  # Deep Navy Blue
        cv2.addWeighted(overlay, 0.90, annotated, 0.10, 0, annotated)

        # HUD Left Title
        cv2.putText(
            annotated,
            "MARG DRISHTI | TRAFFIC SURVEILLANCE & AI ANALYTICS NODE",
            (15, 28),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.56,
            (255, 255, 255),
            2,
            cv2.LINE_AA
        )

        # HUD Right Live Telemetry
        target_str = f" | TARGET: #{self.highlight_vehicle_id}" if self.highlight_vehicle_id else ""
        fps_target_str = f"/{self.target_fps}" if self.target_fps else "/MAX"
        hud_info = (
            f"FRAME: {frame_idx}/{total_frames} | "
            f"MARKED: {metrics['total_unique_vehicles']} | "
            f"ACTIVE: {len(tracked_items)} | "
            f"EMERGENCY: {len(metrics['emergency_vehicles'])} | "
            f"FPS: {self.fps}{fps_target_str}{target_str}"
        )
        (iw, _), _ = cv2.getTextSize(hud_info, cv2.FONT_HERSHEY_SIMPLEX, 0.46, 1)
        cv2.putText(
            annotated,
            hud_info,
            (max(15, width - iw - 20), 28),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.46,
            (100, 245, 170),
            1,
            cv2.LINE_AA
        )

        return annotated

    def _save_emergency_alert(self, analysis_id, vehicle_type, lane_name, confidence, snapshot_url, timestamp_sec, bbox=None):
        conn = get_connection()
        cursor = conn.cursor()
        aid = f"alert-{int(time.time()*1000)}"
        now_str = datetime.now().isoformat()
        rec_action = (
            f"Grant priority green corridor on {lane_name} for approaching {vehicle_type.upper()}. "
            f"Dispatch junction clearance signal."
        )
        cursor.execute("""
        INSERT INTO emergency_alerts (
            id, analysis_id, camera_id, timestamp, vehicle_type, lane_name,
            confidence, snapshot_url, verification_status, recommended_action,
            operator_notes, bbox, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            aid, analysis_id, None,
            f"{int(timestamp_sec//60):02d}:{int(timestamp_sec%60):02d}",
            vehicle_type, lane_name, confidence, snapshot_url,
            "UNCONFIRMED", rec_action, None,
            json.dumps(bbox) if bbox else None,
            now_str
        ))
        conn.commit()
        conn.close()

    def _update_db_progress(self, progress, current_frame, total_frames, fps, metrics, flow_over_time, recent_detections):
        conn = get_connection()
        cursor = conn.cursor()
        counts_by_lane = {k: v.get("cumulative_count", 0) for k, v in metrics["lane_metrics"].items()}
        cursor.execute("""
        UPDATE analyses SET
            progress = ?,
            current_frame = ?,
            total_frames = ?,
            fps = ?,
            total_vehicles = ?,
            counts_by_class = ?,
            counts_by_lane = ?,
            lane_densities = ?,
            flow_over_time = ?,
            recent_detections = ?,
            emergency_count = ?
        WHERE id = ?
        """, (
            progress,
            current_frame,
            total_frames,
            fps,
            metrics["total_unique_vehicles"],
            json.dumps(metrics["unique_counts_by_class"]),
            json.dumps(counts_by_lane),
            json.dumps(metrics["lane_metrics"]),
            json.dumps(flow_over_time),
            json.dumps(recent_detections),
            len(metrics["emergency_vehicles"]),
            self.analysis_id
        ))
        conn.commit()
        conn.close()

    def _finalize_db(self, output_video_path, duration_sec, final_metrics, flow_over_time, recent_detections):
        conn = get_connection()
        cursor = conn.cursor()
        counts_by_lane = {k: v.get("cumulative_count", 0) for k, v in final_metrics["lane_metrics"].items()}
        now_str = datetime.now().isoformat()
        cursor.execute("""
        UPDATE analyses SET
            status = ?,
            progress = ?,
            duration_seconds = ?,
            output_video_path = ?,
            total_vehicles = ?,
            counts_by_class = ?,
            counts_by_lane = ?,
            lane_densities = ?,
            flow_over_time = ?,
            recent_detections = ?,
            emergency_count = ?,
            error_message = ?,
            completed_at = ?
        WHERE id = ?
        """, (
            self.status,
            self.progress,
            duration_sec,
            output_video_path if self.status == "COMPLETED" else None,
            final_metrics["total_unique_vehicles"],
            json.dumps(final_metrics["unique_counts_by_class"]),
            json.dumps(counts_by_lane),
            json.dumps(final_metrics["lane_metrics"]),
            json.dumps(flow_over_time),
            json.dumps(recent_detections),
            len(final_metrics["emergency_vehicles"]),
            self.error_message,
            now_str,
            self.analysis_id
        ))
        conn.commit()
        conn.close()

    def _update_db_failed(self, err_msg):
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE analyses SET status = 'FAILED', error_message = ? WHERE id = ?",
            (err_msg, self.analysis_id)
        )
        conn.commit()
        conn.close()

# In-memory active jobs registry
active_jobs: Dict[str, VideoProcessingJob] = {}
