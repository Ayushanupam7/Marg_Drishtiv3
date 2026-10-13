import os
import shutil
import uuid
import json
import csv
import io
import time
import threading
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Response
from fastapi.responses import StreamingResponse

from app.config import UPLOADS_DIR, SAMPLES_DIR, OUTPUTS_DIR
from app.database import get_connection
from app.models.schemas import AnalysisStartRequest
from app.services.video_processor import VideoProcessingJob, active_jobs

router = APIRouter(prefix="/api/analysis", tags=["analysis"])

@router.get("/current/active")
def get_current_active_analysis():
    """Retrieve currently executing analysis job or latest analysis status."""
    for aid, job in active_jobs.items():
        if job.status == "PROCESSING":
            return {
                "active_analysis_id": aid,
                "status": "PROCESSING",
                "filename": Path(job.input_filepath).name,
                "progress": job.progress,
                "highlight_vehicle_id": getattr(job, "highlight_vehicle_id", None)
            }
    # Fallback to most recent record from DB
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, filename, status, progress FROM analyses ORDER BY created_at DESC LIMIT 1")
    row = cursor.fetchone()
    conn.close()
    if row:
        return {
            "active_analysis_id": row["id"],
            "status": row["status"],
            "filename": row["filename"],
            "progress": row["progress"],
            "highlight_vehicle_id": None
        }
    return {"active_analysis_id": None, "status": None}

@router.post("/upload")
async def upload_traffic_video(file: UploadFile = File(...)):
    # Validate extension
    allowed_exts = {".mp4", ".avi", ".mov", ".mkv"}
    ext = Path(file.filename).suffix.lower()
    if ext not in allowed_exts:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported video format '{ext}'. Supported formats: MP4, AVI, MOV, MKV."
        )

    # Generate unique analysis ID
    analysis_id = f"anl-{uuid.uuid4().hex[:10]}"
    safe_filename = f"{analysis_id}_{file.filename}"
    save_path = UPLOADS_DIR / safe_filename

    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    now_str = datetime.now().isoformat()

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO analyses (
        id, filename, filepath, status, progress, current_frame, total_frames,
        fps, duration_seconds, total_vehicles, counts_by_class, counts_by_lane,
        lane_densities, flow_over_time, recent_detections, emergency_count, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        analysis_id, file.filename, str(save_path), "PENDING", 0.0, 0, 0,
        0.0, 0.0, 0, "{}", "{}", "{}", "[]", "[]", 0, now_str
    ))
    conn.commit()
    conn.close()

    return {
        "analysis_id": analysis_id,
        "filename": file.filename,
        "filepath": str(save_path),
        "video_url": f"/api/uploads/{safe_filename}",
        "message": "Traffic video uploaded successfully. Ready for AI processing."
    }

@router.post("/sample/load")
def load_sample_video():
    """Load bundled sample traffic video for immediate testing without requiring manual file upload."""
    sample_files = list(SAMPLES_DIR.glob("*.mp4"))
    if not sample_files:
        raise HTTPException(status_code=404, detail="No sample videos found in server library.")

    sample_src = sample_files[0]
    analysis_id = f"anl-sample-{uuid.uuid4().hex[:6]}"
    dest_filename = f"{analysis_id}_Junction_Corridor.mp4"
    dest_path = UPLOADS_DIR / dest_filename

    shutil.copy(sample_src, dest_path)
    now_str = datetime.now().isoformat()

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO analyses (
        id, filename, filepath, status, progress, current_frame, total_frames,
        fps, duration_seconds, total_vehicles, counts_by_class, counts_by_lane,
        lane_densities, flow_over_time, recent_detections, emergency_count, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        analysis_id, "Official_NH48_Junction_Benchmark.mp4", str(dest_path), "PENDING", 0.0, 0, 0,
        0.0, 0.0, 0, "{}", "{}", "{}", "[]", "[]", 0, now_str
    ))
    conn.commit()
    conn.close()

    return {
        "analysis_id": analysis_id,
        "filename": "Official_NH48_Junction_Benchmark.mp4",
        "filepath": str(dest_path),
        "video_url": f"/api/uploads/{dest_filename}",
        "message": "Sample traffic video loaded successfully."
    }

@router.post("/start")
def start_analysis(req: AnalysisStartRequest):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT * FROM analyses 
    WHERE id = ? OR filename = ? 
    ORDER BY created_at DESC LIMIT 1
    """, (req.filename, req.filename))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Analysis '{req.filename}' not found.")

    analysis_id = row["id"]
    filepath = row["filepath"]
    if not Path(filepath).exists():
        conn.close()
        raise HTTPException(status_code=400, detail=f"Target video file not found at {filepath}")

    conn.close()

    # Check if already processing
    if analysis_id in active_jobs and active_jobs[analysis_id].status == "PROCESSING":
        return {"message": "Job is already actively running.", "analysis_id": analysis_id}

    # Create and run job in background thread
    job = VideoProcessingJob(
        analysis_id=analysis_id,
        input_filepath=filepath,
        conf_threshold=req.conf_threshold,
        iou_threshold=req.iou_threshold,
        lanes_config=req.lanes_config,
        target_fps=req.target_fps
    )
    active_jobs[analysis_id] = job

    thread = threading.Thread(target=job.run, daemon=True)
    thread.start()

    return {
        "message": "AI traffic detection job initiated successfully.",
        "analysis_id": analysis_id,
        "status": "PROCESSING"
    }

@router.post("/{analysis_id}/stop")
def stop_analysis(analysis_id: str):
    if analysis_id in active_jobs:
        active_jobs[analysis_id].request_stop()
        return {"message": f"Stop signal dispatched for analysis {analysis_id}"}

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE analyses SET status = 'STOPPED' WHERE id = ?", (analysis_id,))
    conn.commit()
    conn.close()
    return {"message": f"Analysis {analysis_id} marked as stopped."}

@router.get("/{analysis_id}")
def get_analysis_status(analysis_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM analyses WHERE id = ?", (analysis_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Analysis not found.")

    counts_by_class = json.loads(row["counts_by_class"] or "{}")
    counts_by_lane = json.loads(row["counts_by_lane"] or "{}")
    lane_densities = json.loads(row["lane_densities"] or "{}")
    flow_over_time = json.loads(row["flow_over_time"] or "[]")
    recent_detections = json.loads(row["recent_detections"] or "[]")

    # If in-memory job is actively updating
    current_fps = row["fps"]
    target_fps = None
    tracked_items = []
    highlight_vehicle_id = None
    if analysis_id in active_jobs:
        job = active_jobs[analysis_id]
        current_fps = job.fps
        target_fps = getattr(job, "target_fps", None)
        tracked_items = getattr(job, "latest_tracked_items", [])
        highlight_vehicle_id = getattr(job, "highlight_vehicle_id", None)

    return {
        "id": row["id"],
        "filename": row["filename"],
        "status": row["status"],
        "progress": row["progress"],
        "current_frame": row["current_frame"],
        "total_frames": row["total_frames"],
        "fps": current_fps,
        "target_fps": target_fps,
        "duration_seconds": row["duration_seconds"],
        "total_vehicles": row["total_vehicles"],
        "counts_by_class": counts_by_class,
        "counts_by_lane": counts_by_lane,
        "lane_densities": lane_densities,
        "flow_over_time": flow_over_time,
        "recent_detections": recent_detections,
        "tracked_items": tracked_items,
        "highlight_vehicle_id": highlight_vehicle_id,
        "emergency_count": row["emergency_count"],
        "error_message": row["error_message"],
        "output_video_path": row["output_video_path"],
        "created_at": row["created_at"],
        "completed_at": row["completed_at"]
    }

@router.get("/{analysis_id}/stream")
def stream_analysis_feed(analysis_id: str):
    """Real-time multipart MJPEG visual feed preview for active detection."""
    if analysis_id not in active_jobs:
        raise HTTPException(status_code=404, detail="Analysis job not currently active in memory.")

    job = active_jobs[analysis_id]

    def frame_generator():
        last_frame_sent = -1
        idle_count = 0
        while job.status in ["PROCESSING", "PENDING"]:
            if hasattr(job, "latest_frame_jpeg") and job.latest_frame_jpeg is not None:
                if job.current_frame != last_frame_sent:
                    last_frame_sent = job.current_frame
                    idle_count = 0
                    yield (
                        b"--frame\r\n"
                        b"Content-Type: image/jpeg\r\n\r\n" + job.latest_frame_jpeg + b"\r\n"
                    )
            time.sleep(0.04)  # ~25 FPS polling check
            idle_count += 1
            if idle_count > 3000:  # Timeout safety (120s of inactivity to support ultra-slow 0.1 FPS)
                break

        # Yield last frame on completion
        if hasattr(job, "latest_frame_jpeg") and job.latest_frame_jpeg is not None:
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + job.latest_frame_jpeg + b"\r\n"
            )

    return StreamingResponse(
        frame_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

@router.get("/{analysis_id}/frame")
def get_analysis_frame(analysis_id: str):
    """Retrieve single latest annotated detection frame."""
    if analysis_id in active_jobs and getattr(active_jobs[analysis_id], "latest_frame_jpeg", None):
        return Response(content=active_jobs[analysis_id].latest_frame_jpeg, media_type="image/jpeg")
    raise HTTPException(status_code=404, detail="Frame not currently available.")

@router.post("/{analysis_id}/highlight/{vehicle_id}")
def set_highlight_vehicle_route(analysis_id: str, vehicle_id: int):
    """Mark a specific vehicle number for persistent target lock highlighting."""
    if analysis_id in active_jobs:
        job = active_jobs[analysis_id]
        job.highlight_vehicle_id = vehicle_id if vehicle_id > 0 else None
        return {
            "status": "ok",
            "analysis_id": analysis_id,
            "highlight_vehicle_id": job.highlight_vehicle_id
        }
    return {"status": "not_active", "message": f"Job {analysis_id} is not actively running in memory"}

@router.post("/{analysis_id}/fps")
def set_analysis_fps_route(analysis_id: str, data: dict):
    """Dynamically set the target FPS rate for real-time video processing pacing."""
    new_fps = data.get("target_fps")
    if analysis_id in active_jobs:
        job = active_jobs[analysis_id]
        fps_val = float(new_fps) if new_fps is not None and float(new_fps) > 0 else None
        job.set_target_fps(fps_val)
        return {
            "status": "ok",
            "analysis_id": analysis_id,
            "target_fps": job.target_fps
        }
    return {"status": "not_active", "message": f"Job {analysis_id} is not actively running in memory"}

@router.get("/{analysis_id}/export")
def export_analysis_report(analysis_id: str, format: str = "csv"):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM analyses WHERE id = ?", (analysis_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Analysis not found.")

    counts_by_class = json.loads(row["counts_by_class"] or "{}")
    lane_densities = json.loads(row["lane_densities"] or "{}")

    if format.lower() == "json":
        export_data = {
            "project": "MARG DRISHTI",
            "department": "Traffic Monitoring & Management Directorate",
            "analysis_id": row["id"],
            "filename": row["filename"],
            "total_vehicles_detected": row["total_vehicles"],
            "emergency_vehicles_detected": row["emergency_count"],
            "category_distribution": counts_by_class,
            "lane_analytics": lane_densities,
            "duration_seconds": row["duration_seconds"],
            "generated_at": datetime.now().isoformat()
        }
        return Response(
            content=json.dumps(export_data, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=MargDrishti_Report_{analysis_id}.json"}
        )

    # CSV Export
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["MARG DRISHTI - TRAFFIC MONITORING & MANAGEMENT DIRECTORATE"])
    writer.writerow(["ANALYSIS REPORT", f"ID: {row['id']}", f"GENERATED: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"])
    writer.writerow([])
    writer.writerow(["METRIC", "VALUE"])
    writer.writerow(["Video File", row["filename"]])
    writer.writerow(["Status", row["status"]])
    writer.writerow(["Duration (seconds)", row["duration_seconds"]])
    writer.writerow(["Total Unique Vehicles Detected", row["total_vehicles"]])
    writer.writerow(["Emergency Vehicles Detected", row["emergency_count"]])
    writer.writerow([])
    writer.writerow(["VEHICLE CATEGORY", "COUNT"])
    for cat, cnt in counts_by_class.items():
        writer.writerow([cat.capitalize(), cnt])
    writer.writerow([])
    writer.writerow(["LANE", "CUMULATIVE VEHICLES", "CONGESTION LEVEL", "FLOW RATE (VEH/MIN)"])
    for lname, ldata in lane_densities.items():
        writer.writerow([
            lname,
            ldata.get("cumulative_count", 0),
            ldata.get("congestion_level", "N/A"),
            ldata.get("flow_rate_per_min", 0.0)
        ])

    csv_content = output.getvalue()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=MargDrishti_Report_{analysis_id}.csv"}
    )
