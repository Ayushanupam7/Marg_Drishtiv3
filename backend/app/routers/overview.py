import json
from fastapi import APIRouter
from app.database import get_connection

router = APIRouter(prefix="/api/overview", tags=["overview"])

@router.get("")
def get_overview_data():
    conn = get_connection()
    cursor = conn.cursor()

    # Check most recent completed or active analysis
    cursor.execute("""
    SELECT * FROM analyses 
    WHERE status IN ('COMPLETED', 'PROCESSING') 
    ORDER BY created_at DESC LIMIT 1
    """)
    latest = cursor.fetchone()

    # Emergency count total
    cursor.execute("SELECT COUNT(*) FROM emergency_alerts WHERE verification_status != 'FALSE_POSITIVE'")
    emergency_count = cursor.fetchone()[0]

    if not latest:
        conn.close()
        return {
            "has_data": False,
            "message": "No traffic video analyzed yet. Upload or select a video to display live statistics.",
            "summary": {
                "total_vehicles": 0,
                "active_lanes": 0,
                "congested_lanes": 0,
                "emergency_alerts": emergency_count
            },
            "lane_density": [],
            "category_distribution": [],
            "flow_over_time": [],
            "recent_events": [],
            "congestion_summary": "No Active Monitoring"
        }

    # Extract data from latest analysis
    counts_by_class = json.loads(latest["counts_by_class"] or "{}")
    lane_densities_raw = json.loads(latest["lane_densities"] or "{}")
    flow_over_time = json.loads(latest["flow_over_time"] or "[]")
    recent_events = json.loads(latest["recent_detections"] or "[]")

    # Format lane density list
    lane_density_list = []
    congested_lanes_count = 0
    for lname, data in lane_densities_raw.items():
        cong = data.get("congestion_level", "Low")
        if cong in ["High", "Severe"]:
            congested_lanes_count += 1
        lane_density_list.append({
            "lane_name": lname,
            "active_vehicles": data.get("active_vehicles", 0),
            "cumulative_count": data.get("cumulative_count", 0),
            "congestion_level": cong,
            "flow_rate_per_min": data.get("flow_rate_per_min", 0.0),
            "status_color": data.get("status_color", "green")
        })

    # Format category distribution
    category_list = []
    for k, v in counts_by_class.items():
        category_list.append({
            "category": k.replace("_", " ").title(),
            "count": v
        })

    # Overall congestion status
    if congested_lanes_count >= 2:
        congestion_summary = "Severe Congestion"
    elif congested_lanes_count == 1:
        congestion_summary = "High Congestion"
    elif any(d.get("congestion_level") == "Moderate" for d in lane_density_list):
        congestion_summary = "Moderate Traffic"
    else:
        congestion_summary = "Smooth Flow (Low Density)"

    conn.close()

    return {
        "has_data": True,
        "analysis_id": latest["id"],
        "filename": latest["filename"],
        "status": latest["status"],
        "summary": {
            "total_vehicles": latest["total_vehicles"],
            "active_lanes": len(lane_density_list),
            "congested_lanes": congested_lanes_count,
            "emergency_alerts": emergency_count
        },
        "lane_density": lane_density_list,
        "category_distribution": category_list,
        "flow_over_time": flow_over_time[-25:], # recent time series
        "recent_events": recent_events[:15],
        "congestion_summary": congestion_summary,
        "completed_at": latest["completed_at"] or latest["created_at"]
    }
