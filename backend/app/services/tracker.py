import cv2
import numpy as np
from typing import List, Dict, Tuple, Set, Any, Optional

def point_in_polygon(point: Tuple[float, float], polygon: List[List[float]], width: int, height: int) -> bool:
    """Check if normalized point is inside normalized polygon."""
    if not polygon or len(polygon) < 3:
        return False
    abs_pt = (point[0] * width, point[1] * height)
    abs_poly = np.array([[p[0] * width, p[1] * height] for p in polygon], dtype=np.int32)
    return cv2.pointPolygonTest(abs_poly, abs_pt, False) >= 0

def line_crossed(prev_pt: Tuple[float, float], curr_pt: Tuple[float, float], line_y_norm: float) -> bool:
    """Check if normalized movement crossed horizontal line."""
    p_y = prev_pt[1]
    c_y = curr_pt[1]
    return (p_y < line_y_norm and c_y >= line_y_norm) or (p_y > line_y_norm and c_y <= line_y_norm)

def line_segment_intersect(p1, p2, p3, p4):
    """Check if line segment p1-p2 intersects p3-p4."""
    def ccw(A, B, C):
        return (C[1]-A[1]) * (B[0]-A[0]) > (B[1]-A[1]) * (C[0]-A[0])
    return ccw(p1,p3,p4) != ccw(p2,p3,p4) and ccw(p1,p2,p3) != ccw(p1,p2,p4)

class SmoothVehicleTrack:
    """Represents a single smoothed vehicle track with continuous mark number."""
    def __init__(self, track_id: int, bbox: List[float], class_name: str, confidence: float):
        self.track_id = track_id
        self.mark_number = track_id
        self.bbox = [float(x) for x in bbox]
        self.class_name = class_name
        self.confidence = confidence
        self.vx = 0.0
        self.vy = 0.0
        self.history = []  # [(cx, cy), ...]
        self.missed_frames = 0
        self.total_hits = 1
        self.class_votes = {class_name: 1}

    @property
    def center(self) -> Tuple[float, float]:
        return ((self.bbox[0] + self.bbox[2]) / 2.0, (self.bbox[1] + self.bbox[3]) / 2.0)

    def update(self, new_bbox: List[float], new_class: str, new_conf: float, alpha: float = 0.72):
        """Update track with new detection, applying exponential smoothing to eliminate jitter."""
        prev_cx, prev_cy = self.center
        # Exponential moving average smoothing on bounding box corners
        self.bbox = [
            alpha * float(n) + (1.0 - alpha) * float(o)
            for n, o in zip(new_bbox, self.bbox)
        ]
        curr_cx, curr_cy = self.center
        # Update smoothed velocity
        self.vx = 0.6 * (curr_cx - prev_cx) + 0.4 * self.vx
        self.vy = 0.6 * (curr_cy - prev_cy) + 0.4 * self.vy

        self.history.append((curr_cx, curr_cy))
        if len(self.history) > 30:
            self.history.pop(0)

        self.confidence = 0.7 * new_conf + 0.3 * self.confidence
        self.missed_frames = 0
        self.total_hits += 1

        self.class_votes[new_class] = self.class_votes.get(new_class, 0) + 1
        self.class_name = max(self.class_votes, key=self.class_votes.get)

    def predict_coast(self):
        """Coast forward when detection drops for 1-6 frames to prevent bounding box flicker."""
        self.missed_frames += 1
        decay = 0.85
        self.vx *= decay
        self.vy *= decay
        self.bbox = [
            self.bbox[0] + self.vx,
            self.bbox[1] + self.vy,
            self.bbox[2] + self.vx,
            self.bbox[3] + self.vy
        ]
        curr_cx, curr_cy = self.center
        self.history.append((curr_cx, curr_cy))
        if len(self.history) > 30:
            self.history.pop(0)

class SmoothVehicleTracker:
    """
    Multi-object vehicle tracker with coordinate smoothing, coasting across dropped frames,
    and guaranteed continuous mark numbers for all detected vehicles.
    """
    def __init__(self, max_missed: int = 6, iou_thresh: float = 0.22):
        self.tracks: Dict[int, SmoothVehicleTrack] = {}
        self.next_id: int = 1
        self.max_missed = max_missed
        self.iou_thresh = iou_thresh

    def reset(self):
        self.tracks.clear()
        self.next_id = 1

    def _iou(self, boxA: List[float], boxB: List[float]) -> float:
        xA = max(boxA[0], boxB[0])
        yA = max(boxA[1], boxB[1])
        xB = min(boxA[2], boxB[2])
        yB = min(boxA[3], boxB[3])
        interW = max(0.0, xB - xA)
        interH = max(0.0, yB - yA)
        interArea = interW * interH
        areaA = max(1.0, (boxA[2] - boxA[0]) * (boxA[3] - boxA[1]))
        areaB = max(1.0, (boxB[2] - boxB[0]) * (boxB[3] - boxB[1]))
        return interArea / float(areaA + areaB - interArea)

    def update(self, detections: List[Dict[str, Any]], frame_width: int, frame_height: int) -> List[Dict[str, Any]]:
        matched_tracks = set()
        matched_detections = set()
        track_ids = list(self.tracks.keys())

        # Stage 1: IoU Association
        if track_ids and detections:
            for tid in track_ids:
                track = self.tracks[tid]
                best_iou = self.iou_thresh
                best_d_idx = -1
                for d_idx, det in enumerate(detections):
                    if d_idx in matched_detections:
                        continue
                    iou = self._iou(track.bbox, det["bbox"])
                    if iou > best_iou:
                        best_iou = iou
                        best_d_idx = d_idx

                if best_d_idx != -1:
                    matched_tracks.add(tid)
                    matched_detections.add(best_d_idx)
                    det = detections[best_d_idx]
                    track.update(det["bbox"], det["class_name"], det["confidence"])

            # Stage 2: Normalized Centroid Distance Fallback
            for tid in track_ids:
                if tid in matched_tracks:
                    continue
                track = self.tracks[tid]
                tcx, tcy = track.center
                best_dist = 0.12  # Within 12% of screen distance
                best_d_idx = -1
                for d_idx, det in enumerate(detections):
                    if d_idx in matched_detections:
                        continue
                    b = det["bbox"]
                    dcx, dcy = (b[0] + b[2]) / 2.0, (b[1] + b[3]) / 2.0
                    norm_dist = (((tcx - dcx) / frame_width) ** 2 + ((tcy - dcy) / frame_height) ** 2) ** 0.5
                    if norm_dist < best_dist:
                        best_dist = norm_dist
                        best_d_idx = d_idx

                if best_d_idx != -1:
                    matched_tracks.add(tid)
                    matched_detections.add(best_d_idx)
                    det = detections[best_d_idx]
                    track.update(det["bbox"], det["class_name"], det["confidence"])

        # Stage 3: Coasting for unmatched existing tracks
        to_delete = []
        for tid, track in self.tracks.items():
            if tid not in matched_tracks:
                track.predict_coast()
                b = track.bbox
                if (track.missed_frames > self.max_missed or
                    b[2] < -50 or b[0] > frame_width + 50 or
                    b[3] < -50 or b[1] > frame_height + 50):
                    to_delete.append(tid)

        for tid in to_delete:
            del self.tracks[tid]

        # Stage 4: Create new tracks with sequential mark numbers for unmatched detections
        for d_idx, det in enumerate(detections):
            if d_idx not in matched_detections:
                new_track = SmoothVehicleTrack(
                    track_id=self.next_id,
                    bbox=det["bbox"],
                    class_name=det["class_name"],
                    confidence=det["confidence"]
                )
                self.tracks[self.next_id] = new_track
                self.next_id += 1

        # Format output items
        active_items = []
        for tid, track in self.tracks.items():
            active_items.append({
                "track_id": track.track_id,
                "mark_number": track.track_id,
                "bbox": [round(x, 1) for x in track.bbox],
                "class_name": track.class_name,
                "confidence": round(track.confidence, 3),
                "is_coasting": track.missed_frames > 0,
                "history": list(track.history)
            })

        return active_items

class LaneTracker:
    def __init__(self, lanes_config: Optional[List[Dict[str, Any]]] = None):
        """
        lanes_config format:
        [
            {
                "id": "lane-1",
                "name": "Lane 1 (Inbound)",
                "line_y": 0.55, # normalized y coordinate
                "polygon": [[0.05, 0.4], [0.45, 0.4], [0.45, 0.95], [0.05, 0.95]],
                "direction": "in"
            },
            ...
        ]
        """
        self.lanes = lanes_config or self._get_default_lanes()
        self.vehicle_positions: Dict[int, List[Tuple[float, float]]] = {} # track_id -> [(cx, cy), ...]
        self.counted_ids_per_lane: Dict[str, Set[int]] = {lane["id"]: set() for lane in self.lanes}
        self.lane_class_counts: Dict[str, Dict[str, int]] = {lane["id"]: {} for lane in self.lanes}
        self.active_in_lane: Dict[str, Set[int]] = {lane["id"]: set() for lane in self.lanes}
        self.total_unique_vehicles: Set[int] = set()
        self.unique_counts_by_class: Dict[str, int] = {}
        self.emergency_vehicles_detected: List[Dict[str, Any]] = []

    def _get_default_lanes(self) -> List[Dict[str, Any]]:
        return [
            {
                "id": "lane-1",
                "name": "Lane 1 (Left / Inbound)",
                "line_y": 0.60,
                "polygon": [[0.0, 0.35], [0.33, 0.35], [0.33, 0.95], [0.0, 0.95]],
                "direction": "in"
            },
            {
                "id": "lane-2",
                "name": "Lane 2 (Center / Express)",
                "line_y": 0.60,
                "polygon": [[0.33, 0.35], [0.66, 0.35], [0.66, 0.95], [0.33, 0.95]],
                "direction": "in"
            },
            {
                "id": "lane-3",
                "name": "Lane 3 (Right / Outbound)",
                "line_y": 0.60,
                "polygon": [[0.66, 0.35], [1.0, 0.35], [1.0, 0.95], [0.66, 0.95]],
                "direction": "out"
            }
        ]

    def reset(self):
        self.vehicle_positions.clear()
        self.counted_ids_per_lane = {lane["id"]: set() for lane in self.lanes}
        self.lane_class_counts = {lane["id"]: {} for lane in self.lanes}
        self.active_in_lane = {lane["id"]: set() for lane in self.lanes}
        self.total_unique_vehicles.clear()
        self.unique_counts_by_class.clear()
        self.emergency_vehicles_detected.clear()

    def update_frame(
        self,
        tracked_boxes: List[Dict[str, Any]], # [{track_id, bbox: [x1, y1, x2, y2], class_name, confidence}]
        frame_width: int,
        frame_height: int,
        frame_idx: int,
        timestamp_sec: float
    ) -> Dict[str, Any]:
        """
        Process frame detections with tracking IDs and update lane metrics.
        """
        # Reset current frame active set
        for lane_id in self.active_in_lane:
            self.active_in_lane[lane_id].clear()

        current_frame_events = []

        for item in tracked_boxes:
            track_id = item["track_id"]
            x1, y1, x2, y2 = item["bbox"]
            cls_name = item["class_name"]
            conf = item["confidence"]

            cx = ((x1 + x2) / 2.0) / frame_width
            cy = ((y1 + y2) / 2.0) / frame_height
            bottom_y = y2 / frame_height

            # Store track center
            if track_id not in self.vehicle_positions:
                self.vehicle_positions[track_id] = []
                self.total_unique_vehicles.add(track_id)
                self.unique_counts_by_class[cls_name] = self.unique_counts_by_class.get(cls_name, 0) + 1

            prev_pt = self.vehicle_positions[track_id][-1] if self.vehicle_positions[track_id] else (cx, cy)
            self.vehicle_positions[track_id].append((cx, cy))
            if len(self.vehicle_positions[track_id]) > 30:
                self.vehicle_positions[track_id].pop(0)

            # Determine lane occupancy by polygon or center x
            assigned_lane = None
            for lane in self.lanes:
                poly = lane.get("polygon")
                if poly and point_in_polygon((cx, cy), poly, frame_width, frame_height):
                    assigned_lane = lane
                    break

            if not assigned_lane:
                # Fallback to horizontal split if not inside polygon
                num_lanes = len(self.lanes)
                lane_idx = min(int(cx * num_lanes), num_lanes - 1)
                assigned_lane = self.lanes[lane_idx]

            lane_id = assigned_lane["id"]
            self.active_in_lane[lane_id].add(track_id)

            # Check line crossing
            line_y = assigned_lane.get("line_y", 0.6)
            if track_id not in self.counted_ids_per_lane[lane_id]:
                if line_crossed(prev_pt, (cx, cy), line_y) or (prev_pt[1] <= line_y and bottom_y >= line_y):
                    self.counted_ids_per_lane[lane_id].add(track_id)
                    self.lane_class_counts[lane_id][cls_name] = self.lane_class_counts[lane_id].get(cls_name, 0) + 1
                    current_frame_events.append({
                        "event_type": "line_crossed",
                        "track_id": track_id,
                        "lane_id": lane_id,
                        "lane_name": assigned_lane["name"],
                        "class_name": cls_name,
                        "timestamp_sec": round(timestamp_sec, 2)
                    })

            # Check emergency vehicle
            if cls_name in {"ambulance", "police_car", "fire_truck"}:
                # Avoid duplicate event if already recorded for this track_id
                if not any(e["track_id"] == track_id for e in self.emergency_vehicles_detected):
                    rec = {
                        "track_id": track_id,
                        "vehicle_type": cls_name,
                        "confidence": round(conf, 3),
                        "lane_id": lane_id,
                        "lane_name": assigned_lane["name"],
                        "frame_idx": frame_idx,
                        "timestamp_sec": round(timestamp_sec, 2),
                        "bbox": [int(x1), int(y1), int(x2), int(y2)]
                    }
                    self.emergency_vehicles_detected.append(rec)
                    current_frame_events.append({
                        "event_type": "emergency_detected",
                        **rec
                    })

        # Calculate lane metrics
        lane_metrics = {}
        for lane in self.lanes:
            lid = lane["id"]
            active_count = len(self.active_in_lane[lid])
            counted_count = len(self.counted_ids_per_lane[lid])
            
            # Density & Congestion status
            if active_count <= 2:
                congestion = "Low"
                status_color = "green"
            elif active_count <= 5:
                congestion = "Moderate"
                status_color = "yellow"
            elif active_count <= 9:
                congestion = "High"
                status_color = "orange"
            else:
                congestion = "Severe"
                status_color = "red"

            # Flow rate (vehicles per minute based on elapsed time)
            time_min = max(timestamp_sec / 60.0, 0.05)
            flow_rate = round(counted_count / time_min, 1)

            lane_metrics[lane["name"]] = {
                "lane_id": lid,
                "lane_name": lane["name"],
                "active_vehicles": active_count,
                "cumulative_count": counted_count,
                "congestion_level": congestion,
                "status_color": status_color,
                "flow_rate_per_min": flow_rate,
                "class_counts": self.lane_class_counts[lid]
            }

        return {
            "total_unique_vehicles": len(self.total_unique_vehicles),
            "unique_counts_by_class": self.unique_counts_by_class,
            "lane_metrics": lane_metrics,
            "current_events": current_frame_events,
            "emergency_vehicles": self.emergency_vehicles_detected
        }
