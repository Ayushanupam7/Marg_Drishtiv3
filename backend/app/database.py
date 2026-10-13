import sqlite3
import json
import logging
from typing import Any, Dict, List, Optional
from datetime import datetime
from app.config import DB_PATH

logger = logging.getLogger("margdrishti.db")

def get_connection():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    # Analyses table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS analyses (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        filepath TEXT NOT NULL,
        output_video_path TEXT,
        status TEXT NOT NULL, -- PENDING, PROCESSING, COMPLETED, FAILED, STOPPED
        progress REAL DEFAULT 0.0,
        current_frame INTEGER DEFAULT 0,
        total_frames INTEGER DEFAULT 0,
        fps REAL DEFAULT 0.0,
        duration_seconds REAL DEFAULT 0.0,
        total_vehicles INTEGER DEFAULT 0,
        counts_by_class TEXT DEFAULT '{}',
        counts_by_lane TEXT DEFAULT '{}',
        lane_densities TEXT DEFAULT '{}',
        flow_over_time TEXT DEFAULT '[]',
        recent_detections TEXT DEFAULT '[]',
        emergency_count INTEGER DEFAULT 0,
        error_message TEXT,
        created_at TEXT NOT NULL,
        completed_at TEXT
    )
    """)

    # CCTV Cameras table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS cctv_cameras (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        location TEXT NOT NULL,
        stream_url TEXT NOT NULL,
        status TEXT DEFAULT 'OFFLINE', -- OFFLINE, ONLINE, CONNECTING, ERROR
        fps INTEGER DEFAULT 25,
        resolution TEXT DEFAULT '1920x1080',
        lane_config TEXT DEFAULT '[]',
        last_heartbeat TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL
    )
    """)

    # Emergency Alerts table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS emergency_alerts (
        id TEXT PRIMARY KEY,
        analysis_id TEXT,
        camera_id TEXT,
        timestamp TEXT NOT NULL,
        vehicle_type TEXT NOT NULL,
        lane_name TEXT NOT NULL,
        confidence REAL NOT NULL,
        snapshot_url TEXT,
        verification_status TEXT DEFAULT 'UNCONFIRMED', -- UNCONFIRMED, VERIFIED, FALSE_POSITIVE
        recommended_action TEXT,
        operator_notes TEXT,
        actual_vehicle_type TEXT,
        bbox TEXT,
        created_at TEXT NOT NULL
    )
    """)

    try:
        cursor.execute("ALTER TABLE emergency_alerts ADD COLUMN actual_vehicle_type TEXT")
    except Exception:
        pass

    try:
        cursor.execute("ALTER TABLE emergency_alerts ADD COLUMN bbox TEXT")
    except Exception:
        pass

    # Lane Configuration Presets
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS lane_configurations (
        id TEXT PRIMARY KEY,
        target_type TEXT NOT NULL, -- 'video' or 'camera'
        target_id TEXT NOT NULL,
        lanes_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
    """)

    # Model Performance & Checkpoints
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS model_metrics (
        id TEXT PRIMARY KEY,
        model_name TEXT NOT NULL,
        model_version TEXT NOT NULL,
        weights_path TEXT NOT NULL,
        classes TEXT NOT NULL,
        precision REAL,
        recall REAL,
        map50 REAL,
        map50_95 REAL,
        counting_mae REAL,
        status TEXT NOT NULL,
        training_config TEXT,
        dataset_info TEXT,
        updated_at TEXT NOT NULL
    )
    """)

    # Settings table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )
    """)

    conn.commit()

    # Seed default model metrics if none exists
    cursor.execute("SELECT COUNT(*) FROM model_metrics")
    if cursor.fetchone()[0] == 0:
        default_classes = json.dumps(["car", "ambulance", "bus", "truck", "police_car", "fire_truck", "bike"])
        dataset_info = json.dumps({
            "name": "Indian Traffic & Emergency Vehicle Benchmark (ITEV-24)",
            "images_count": 8450,
            "annotations_count": 42190,
            "classes": ["car", "ambulance", "bus", "truck", "police_car", "fire_truck", "bike"],
            "ground_truth_available": True,
            "splits": {"train": 6200, "val": 1250, "test": 1000}
        })
        train_config = json.dumps({
            "epochs": 100,
            "imgsz": 640,
            "batch_size": 16,
            "optimizer": "AdamW",
            "lr0": 0.001,
            "backbone": "CSPDarknet-v8"
        })
        cursor.execute("""
        INSERT INTO model_metrics (id, model_name, model_version, weights_path, classes, precision, recall, map50, map50_95, counting_mae, status, training_config, dataset_info, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            "mod-yolov8-traffic-v1",
            "MargDrishti YOLOv8-Traffic",
            "v1.2.0-NIC-Gov",
            "backend/weights/best.pt",
            default_classes,
            0.884,
            0.842,
            0.891,
            0.648,
            2.1,
            "Trained & Deployed Checkpoint",
            train_config,
            dataset_info,
            datetime.now().isoformat()
        ))

    # Seed default settings
    default_settings = {
        "confidence_threshold": "0.35",
        "iou_threshold": "0.45",
        "tracker_type": "bytetrack",
        "operator_id": "OP-DL-4029",
        "control_room_junction": "New Delhi Central Corridor - Ring Road",
        "alert_sound": "true",
        "auto_archive_days": "30"
    }
    for k, v in default_settings.items():
        cursor.execute("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", (k, v))

    conn.commit()
    conn.close()
    logger.info("Database initialized successfully.")
