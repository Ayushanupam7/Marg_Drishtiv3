import uuid
import json
import cv2
import time
from datetime import datetime
from fastapi import APIRouter, HTTPException
from app.database import get_connection
from app.models.schemas import CameraCreate, CameraUpdate

router = APIRouter(prefix="/api/cctv", tags=["cctv"])

@router.get("")
def list_cameras():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM cctv_cameras ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()

    cameras = []
    for r in rows:
        cameras.append({
            "id": r["id"],
            "name": r["name"],
            "location": r["location"],
            "stream_url": r["stream_url"],
            "status": r["status"],
            "fps": r["fps"],
            "resolution": r["resolution"],
            "lane_config": json.loads(r["lane_config"] or "[]"),
            "last_heartbeat": r["last_heartbeat"],
            "error_message": r["error_message"],
            "created_at": r["created_at"]
        })

    return cameras

@router.post("")
def create_camera(data: CameraCreate):
    cid = f"cam-{uuid.uuid4().hex[:8]}"
    now_str = datetime.now().isoformat()

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO cctv_cameras (
        id, name, location, stream_url, status, fps, resolution,
        lane_config, error_message, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        cid, data.name, data.location, data.stream_url, "OFFLINE",
        data.fps, data.resolution, json.dumps(data.lane_config or []), None, now_str
    ))
    conn.commit()
    conn.close()

    return {"message": "CCTV camera registered successfully", "id": cid}

@router.post("/{camera_id}/test")
def test_camera_connection(camera_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM cctv_cameras WHERE id = ?", (camera_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Camera not found.")

    stream_url = row["stream_url"]

    # Attempt short real connection test via OpenCV
    # If it's a device index like "0" or RTSP URL:
    target = int(stream_url) if stream_url.isdigit() else stream_url
    cap = cv2.VideoCapture(target)
    
    start_t = time.time()
    opened = cap.isOpened()
    err = None
    status = "ONLINE" if opened else "ERROR"

    if not opened:
        err = f"Failed to handshake with RTSP/IP endpoint '{stream_url}'. Connection timed out or camera offline."
    else:
        # Check if frame can be grabbed
        ret, frame = cap.read()
        if not ret:
            status = "ERROR"
            err = "Handshake succeeded but unable to decode video frame."
        cap.release()

    now_str = datetime.now().isoformat()
    cursor.execute("""
    UPDATE cctv_cameras SET
        status = ?,
        last_heartbeat = ?,
        error_message = ?
    WHERE id = ?
    """, (status, now_str, err, camera_id))
    conn.commit()
    conn.close()

    return {
        "camera_id": camera_id,
        "status": status,
        "error_message": err,
        "checked_at": now_str
    }

@router.delete("/{camera_id}")
def delete_camera(camera_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM cctv_cameras WHERE id = ?", (camera_id,))
    conn.commit()
    conn.close()
    return {"message": "Camera unregistered successfully."}
