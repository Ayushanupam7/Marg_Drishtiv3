import os
import logging
from datetime import datetime
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import (
    UPLOADS_DIR,
    OUTPUTS_DIR,
    SNAPSHOTS_DIR,
    PROJECT_NAME,
    SUBTITLE,
    DEPARTMENT_LABEL,
    SYSTEM_NODE_ID,
    DEFAULT_MODEL_PATH
)
from app.database import init_db
from app.routers import (
    overview,
    analysis,
    cctv,
    lanes,
    emergency,
    model_perf,
    history,
    settings
)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("margdrishti")

app = FastAPI(
    title=PROJECT_NAME,
    description=SUBTITLE,
    version="3.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static file directories for video previews and snapshots
app.mount("/api/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")
app.mount("/api/outputs", StaticFiles(directory=str(OUTPUTS_DIR)), name="outputs")

# Include API Routers
app.include_router(overview.router)
app.include_router(analysis.router)
app.include_router(cctv.router)
app.include_router(lanes.router)
app.include_router(emergency.router)
app.include_router(model_perf.router)
app.include_router(history.router)
app.include_router(settings.router)

@app.on_event("startup")
def on_startup():
    logger.info("Initializing Marg Drishti database...")
    init_db()
    logger.info(f"Model path: {DEFAULT_MODEL_PATH} exists: {DEFAULT_MODEL_PATH.exists()}")
    logger.info("Marg Drishti Control Room API Node ready.")

@app.get("/api/health")
def health_check():
    return {
        "status": "OPERATIONAL",
        "system": PROJECT_NAME,
        "subtitle": SUBTITLE,
        "department": DEPARTMENT_LABEL,
        "node_id": SYSTEM_NODE_ID,
        "model_loaded": DEFAULT_MODEL_PATH.exists(),
        "timestamp": datetime.now().isoformat()
    }

# WebSocket for real-time analysis progress broadcast and vehicle target control
@app.websocket("/ws/analysis/{analysis_id}")
async def websocket_analysis_endpoint(websocket: WebSocket, analysis_id: str):
    await websocket.accept()
    try:
        import json
        import asyncio
        from app.services.video_processor import active_jobs

        async def send_updates():
            while True:
                if analysis_id in active_jobs:
                    job = active_jobs[analysis_id]
                    total_v = len(job.tracker.total_unique_vehicles) if hasattr(job, "tracker") else 0
                    counts_cls = getattr(job.tracker, "unique_counts_by_class", {}) if hasattr(job, "tracker") else {}
                    payload = {
                        "analysis_id": analysis_id,
                        "status": job.status,
                        "progress": job.progress,
                        "current_frame": job.current_frame,
                        "total_frames": job.total_frames,
                        "fps": job.fps,
                        "target_fps": getattr(job, "target_fps", None),
                        "total_vehicles": total_v,
                        "counts_by_class": counts_cls,
                        "tracked_items": getattr(job, "latest_tracked_items", []),
                        "highlight_vehicle_id": getattr(job, "highlight_vehicle_id", None),
                        "error_message": job.error_message
                    }
                    await websocket.send_json(payload)
                    if job.status in ["COMPLETED", "FAILED", "STOPPED"]:
                        break
                await asyncio.sleep(0.35)

        async def receive_commands():
            while True:
                try:
                    data = await websocket.receive_text()
                    msg = json.loads(data)
                    if analysis_id in active_jobs:
                        job = active_jobs[analysis_id]
                        action = msg.get("action")
                        if action == "highlight":
                            vid = msg.get("vehicle_id")
                            job.highlight_vehicle_id = int(vid) if vid is not None and int(vid) > 0 else None
                        elif action == "clear_highlight":
                            job.highlight_vehicle_id = None
                        elif action == "set_fps":
                            new_fps = msg.get("target_fps")
                            if new_fps is not None:
                                fps_val = float(new_fps) if float(new_fps) > 0 else None
                                job.set_target_fps(fps_val)
                except Exception:
                    break

        sender_task = asyncio.create_task(send_updates())
        receiver_task = asyncio.create_task(receive_commands())

        done, pending = await asyncio.wait(
            [sender_task, receiver_task],
            return_when=asyncio.FIRST_COMPLETED
        )
        for task in pending:
            task.cancel()
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.warning(f"WebSocket error for {analysis_id}: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
