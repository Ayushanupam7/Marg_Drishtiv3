import os
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
WEIGHTS_DIR = BASE_DIR / "weights"
UPLOADS_DIR = BASE_DIR / "uploads"
OUTPUTS_DIR = BASE_DIR / "outputs"
DATA_DIR = BASE_DIR / "data"
SAMPLES_DIR = BASE_DIR / "samples"
SNAPSHOTS_DIR = OUTPUTS_DIR / "snapshots"

# Ensure all directories exist
for p in [WEIGHTS_DIR, UPLOADS_DIR, OUTPUTS_DIR, DATA_DIR, SAMPLES_DIR, SNAPSHOTS_DIR]:
    p.mkdir(parents=True, exist_ok=True)

DB_PATH = DATA_DIR / "margdrishti.db"
DEFAULT_MODEL_PATH = WEIGHTS_DIR / "best.pt"
YOLOV8N_FALLBACK = WEIGHTS_DIR / "yolov8n.pt"

# Default classes recognized by best.pt:
# {0: 'car', 1: 'ambulance', 2: 'bus', 3: 'truck', 4: 'police_car', 5: 'fire_truck', 6: 'bike'}
EMERGENCY_CLASSES = {"ambulance", "police_car", "fire_truck"}
STANDARD_VEHICLE_CLASSES = {"car", "bus", "truck", "bike", "motorcycle"}

# Department Metadata
PROJECT_NAME = "MARG DRISHTI"
SUBTITLE = "AI-Based Smart Traffic Management System"
DEPARTMENT_LABEL = "Traffic Monitoring & Management Directorate"
SYSTEM_NODE_ID = "NODE-DL-HQ-01"
