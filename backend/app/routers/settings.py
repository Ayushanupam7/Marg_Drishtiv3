import json
from fastapi import APIRouter
from app.database import get_connection
from app.models.schemas import SettingsUpdate

router = APIRouter(prefix="/api/settings", tags=["settings"])

@router.get("")
def get_settings():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM settings")
    rows = cursor.fetchall()
    conn.close()

    result = {}
    for r in rows:
        val = r["value"]
        if val.lower() == "true":
            result[r["key"]] = True
        elif val.lower() == "false":
            result[r["key"]] = False
        else:
            try:
                result[r["key"]] = float(val) if "." in val else int(val)
            except ValueError:
                result[r["key"]] = val
    return result

@router.post("")
def update_settings(data: dict):
    conn = get_connection()
    cursor = conn.cursor()
    for k, v in data.items():
        cursor.execute("""
        INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        """, (k, str(v)))
    conn.commit()
    conn.close()
    return {"message": "Settings updated successfully."}
