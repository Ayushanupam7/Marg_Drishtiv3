import json
from fastapi import APIRouter, HTTPException
from app.database import get_connection

router = APIRouter(prefix="/api/history", tags=["history"])

@router.get("")
def list_analysis_history():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT id, filename, status, progress, total_vehicles, duration_seconds, 
           emergency_count, output_video_path, created_at, completed_at
    FROM analyses
    ORDER BY created_at DESC
    """)
    rows = cursor.fetchall()
    conn.close()

    history = []
    for r in rows:
        history.append({
            "id": r["id"],
            "filename": r["filename"],
            "status": r["status"],
            "progress": r["progress"],
            "total_vehicles": r["total_vehicles"],
            "duration_seconds": r["duration_seconds"],
            "emergency_count": r["emergency_count"],
            "output_video_path": r["output_video_path"],
            "created_at": r["created_at"],
            "completed_at": r["completed_at"]
        })

    return history

@router.delete("/{analysis_id}")
def delete_analysis(analysis_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM analyses WHERE id = ?", (analysis_id,))
    cursor.execute("DELETE FROM emergency_alerts WHERE analysis_id = ?", (analysis_id,))
    conn.commit()
    conn.close()
    return {"message": "Analysis record deleted successfully.", "id": analysis_id}
