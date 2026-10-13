import json
from pathlib import Path
import cv2
from fastapi import APIRouter, HTTPException
from typing import Optional, List
from app.database import get_connection
from app.models.schemas import EmergencyAlertUpdate
from app.config import SNAPSHOTS_DIR
from app.services.video_processor import annotate_emergency_snapshot
from app.services.detector import traffic_detector

router = APIRouter(prefix="/api/emergency", tags=["emergency"])

_annotated_snapshots = set()

def _ensure_snapshot_annotated(snap_name: str, vehicle_type: str, confidence: float, db_bbox: Optional[str], alert_id: str) -> Optional[List[int]]:
    snap_path = SNAPSHOTS_DIR / snap_name
    if not snap_path.exists():
        return None

    bbox_list = None
    if db_bbox:
        try:
            bbox_list = json.loads(db_bbox)
        except Exception:
            pass

    # If bbox not yet known, run detector to locate the identified vehicle
    if not bbox_list:
        try:
            img = cv2.imread(str(snap_path))
            if img is not None:
                dets = traffic_detector.detect_vehicles(img, conf=0.20)
                target_det = None
                for d in dets:
                    if d["class_name"].lower() == vehicle_type.lower():
                        target_det = d
                        break
                if not target_det:
                    for d in dets:
                        if d["class_name"] in {"ambulance", "police_car", "fire_truck"}:
                            target_det = d
                            break
                if not target_det and dets:
                    target_det = dets[0]

                if target_det:
                    bbox_list = [int(b) for b in target_det["bbox"]]
                    try:
                        conn2 = get_connection()
                        c2 = conn2.cursor()
                        c2.execute("UPDATE emergency_alerts SET bbox = ? WHERE id = ?", (json.dumps(bbox_list), alert_id))
                        conn2.commit()
                        conn2.close()
                    except Exception:
                        pass
        except Exception:
            pass

    # Annotate image file on disk if not already annotated
    if bbox_list and snap_name not in _annotated_snapshots:
        try:
            img = cv2.imread(str(snap_path))
            if img is not None:
                annotated = annotate_emergency_snapshot(
                    frame=img,
                    bbox=bbox_list,
                    vehicle_type=vehicle_type,
                    confidence=confidence
                )
                cv2.imwrite(str(snap_path), annotated)
                _annotated_snapshots.add(snap_name)
        except Exception:
            pass

    return bbox_list

def _background_annotate_legacy():
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, vehicle_type, confidence, snapshot_url, bbox FROM emergency_alerts WHERE bbox IS NULL AND snapshot_url IS NOT NULL LIMIT 20")
        rows = cursor.fetchall()
        conn.close()
        for r in rows:
            snap_name = r["snapshot_url"].split('/')[-1]
            _ensure_snapshot_annotated(snap_name, r["vehicle_type"], r["confidence"], r["bbox"], r["id"])
    except Exception:
        pass

@router.get("/alerts")
def get_emergency_alerts(status_filter: Optional[str] = None):
    conn = get_connection()
    cursor = conn.cursor()

    if status_filter and status_filter.upper() != "ALL":
        cursor.execute(
            "SELECT * FROM emergency_alerts WHERE verification_status = ? ORDER BY created_at DESC",
            (status_filter.upper(),)
        )
    else:
        cursor.execute("SELECT * FROM emergency_alerts ORDER BY created_at DESC")

    rows = cursor.fetchall()
    conn.close()

    alerts = []
    for r in rows:
        actual_vt = r["actual_vehicle_type"] if "actual_vehicle_type" in r.keys() else None
        snap_url = r["snapshot_url"]
        db_bbox = r["bbox"] if "bbox" in r.keys() else None

        bbox_coords = None
        if db_bbox:
            try:
                bbox_coords = json.loads(db_bbox)
            except Exception:
                pass

        alerts.append({
            "id": r["id"],
            "analysis_id": r["analysis_id"],
            "camera_id": r["camera_id"],
            "timestamp": r["timestamp"],
            "vehicle_type": r["vehicle_type"],
            "actual_vehicle_type": actual_vt,
            "lane_name": r["lane_name"],
            "confidence": r["confidence"],
            "snapshot_url": snap_url,
            "verification_status": r["verification_status"],
            "recommended_action": r["recommended_action"],
            "operator_notes": r["operator_notes"],
            "bbox": bbox_coords,
            "created_at": r["created_at"]
        })

    return alerts

@router.post("/alerts/{alert_id}/ensure-marked")
def ensure_alert_marked(alert_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM emergency_alerts WHERE id = ?", (alert_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Alert not found")

    snap_url = row["snapshot_url"]
    if snap_url:
        snap_name = snap_url.split('/')[-1]
        bbox = _ensure_snapshot_annotated(
            snap_name=snap_name,
            vehicle_type=row["vehicle_type"],
            confidence=row["confidence"],
            db_bbox=row["bbox"] if "bbox" in row.keys() else None,
            alert_id=row["id"]
        )
        return {"status": "ok", "bbox": bbox, "snapshot_url": snap_url}
    return {"status": "no_snapshot"}

@router.patch("/alerts/{alert_id}")
def update_emergency_alert(alert_id: str, update: EmergencyAlertUpdate):
    valid_statuses = {"VERIFIED", "FALSE_POSITIVE", "UNCONFIRMED"}
    status = update.verification_status.upper()
    if status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid verification status '{status}'. Must be one of {valid_statuses}."
        )

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    UPDATE emergency_alerts SET
        verification_status = ?,
        operator_notes = COALESCE(?, operator_notes),
        actual_vehicle_type = COALESCE(?, actual_vehicle_type)
    WHERE id = ?
    """, (status, update.operator_notes, update.actual_vehicle_type, alert_id))
    
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Emergency alert not found.")

    conn.commit()
    conn.close()

    return {"message": "Emergency alert status updated successfully.", "id": alert_id, "status": status}
