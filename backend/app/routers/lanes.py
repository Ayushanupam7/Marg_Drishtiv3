import json
from datetime import datetime
from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from app.database import get_connection

router = APIRouter(prefix="/api/lanes", tags=["lanes"])

DEFAULT_PRESET_LANES = [
    {
        "id": "lane-1",
        "name": "Lane 1 (Left / Inbound)",
        "line_y": 0.60,
        "polygon": [[0.02, 0.35], [0.33, 0.35], [0.33, 0.95], [0.02, 0.95]],
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
        "polygon": [[0.66, 0.35], [0.98, 0.35], [0.98, 0.95], [0.66, 0.95]],
        "direction": "out"
    }
]

@router.get("/presets")
def get_presets():
    return {
        "standard_3_lane": DEFAULT_PRESET_LANES,
        "expressway_4_lane": [
            {
                "id": "lane-1",
                "name": "Lane 1 (Slow / Heavy)",
                "line_y": 0.60,
                "polygon": [[0.02, 0.35], [0.25, 0.35], [0.25, 0.95], [0.02, 0.95]],
                "direction": "in"
            },
            {
                "id": "lane-2",
                "name": "Lane 2 (Cruising)",
                "line_y": 0.60,
                "polygon": [[0.25, 0.35], [0.50, 0.35], [0.50, 0.95], [0.25, 0.95]],
                "direction": "in"
            },
            {
                "id": "lane-3",
                "name": "Lane 3 (Fast / Overtaking)",
                "line_y": 0.60,
                "polygon": [[0.50, 0.35], [0.75, 0.35], [0.75, 0.95], [0.50, 0.95]],
                "direction": "in"
            },
            {
                "id": "lane-4",
                "name": "Lane 4 (Emergency / Service)",
                "line_y": 0.60,
                "polygon": [[0.75, 0.35], [0.98, 0.35], [0.98, 0.95], [0.75, 0.95]],
                "direction": "both"
            }
        ]
    }

@router.get("/{target_id}")
def get_lane_config(target_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM lane_configurations WHERE target_id = ?", (target_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return {"target_id": target_id, "lanes": DEFAULT_PRESET_LANES, "is_default": True}

    return {
        "target_id": target_id,
        "lanes": json.loads(row["lanes_json"]),
        "updated_at": row["updated_at"],
        "is_default": False
    }

@router.post("/{target_id}")
def save_lane_config(target_id: str, lanes: List[Dict[str, Any]], target_type: str = "video"):
    conn = get_connection()
    cursor = conn.cursor()
    now_str = datetime.now().isoformat()
    cid = f"cfg-{target_id}"

    cursor.execute("""
    INSERT INTO lane_configurations (id, target_type, target_id, lanes_json, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
        lanes_json = excluded.lanes_json,
        updated_at = excluded.updated_at
    """, (cid, target_type, target_id, json.dumps(lanes), now_str))

    conn.commit()
    conn.close()

    return {"message": "Lane configuration saved successfully.", "target_id": target_id}
