# 🚦 MARG DRISHTI (मार्ग दृष्टि) — V3.0
### AI-Powered Intelligent Traffic Monitoring, Optical Vehicle Tracking & Emergency Green Wave Corridor Dispatch Platform

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![YOLOv8](https://img.shields.io/badge/Ultralytics-YOLOv8-FF6F00?style=for-the-badge&logo=yolo&logoColor=white)](https://ultralytics.com)
[![OpenCV](https://img.shields.io/badge/OpenCV-4.8+-5C3EE8?style=for-the-badge&logo=opencv&logoColor=white)](https://opencv.org)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)

---

## 📌 Overview

**MARG DRISHTI (मार्ग दृष्टि)** is a high-performance, intelligent optical traffic surveillance and incident management system designed for urban traffic command directorates, smart city operations, and highway monitoring authorities. 

By combining cutting-edge deep learning (**Ultralytics YOLOv8**), smooth vector tracking algorithms, dynamic lane Region of Interest (ROI) geometry, and automated pre-emption protocols, Marg Drishti transforms standard optical CCTV and surveillance streams into real-time decision telemetry.

The platform provides automated detection and visual targeting of **Emergency Priority Vehicles** (Ambulances, Police Patrols, and Fire Tenders), enabling automated signal pre-emption and operator-verified **Green Corridor Dispatches** to minimize emergency transit latency.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph INGESTION["1. Video & Stream Ingestion"]
        V[Video Upload MP4 / RTSP CCTV Feed]
        CAP[OpenCV VideoCapture & Frame Buffer]
        V --> CAP
    end

    subgraph DETECTION_TRACKING["2. AI Perception & Tracking Engine"]
        YOLO["YOLOv8 Deep Neural Network (best.pt)"]
        TRK["SmoothVehicleTracker & Trajectory Interpolator"]
        LANE["LaneTracker (Polygon In-Out & Crossing Logic)"]
        
        CAP --> YOLO
        YOLO -->|BBoxes, Classes, Confidences| TRK
        TRK -->|Active Tracks, Vectors, Coasting| LANE
    end

    subgraph EMERGENCY_MODULE["3. Emergency Optical Recognition & Snapshot Dossier"]
        EM_DEC["Emergency Vehicle Classifier (Ambulance, Police, Fire Tender)"]
        SNAP["Tactical Snapshot Annotator (HUD Brackets, BBox, Centroid Pip)"]
        PREEMPT["Signal Pre-emption & Green Wave Recommendation Engine"]
        
        LANE --> EM_DEC
        EM_DEC -->|On Detection| SNAP
        SNAP -->|JPEG Dossier| SNAP_DIR[(outputs/snapshots/)]
        EM_DEC --> PREEMPT
    end

    subgraph BACKEND_STORAGE["4. FastAPI Engine & Persistence Layer"]
        DB[(SQLite - margdrishti.db)]
        WS[WebSocket Telemetry Hub - /ws/analysis/{id}]
        REST[FastAPI REST Services - Router API Layer]
        
        PREEMPT --> DB
        LANE --> DB
        LANE -->|Sub-100ms Metrics| WS
        REST <--> DB
    end

    subgraph FRONTEND_UI["5. Command Center Dashboard (React + TypeScript + Tailwind)"]
        OVERVIEW["Central Overview (Densities, Flow, Peak Telemetry)"]
        ANALYSIS["Live Video Analysis Node (Adaptive FPS 0.1-MAX, Canvas Overlay)"]
        EMERGENCY_TAB["Emergency Priority & Verification Dossier Modal"]
        CCTV_TAB["Surveillance CCTV Feed Manager"]
        ROI_TAB["Corridor ROI Lane Configuration (Multi-polygon)"]
        MODEL_TAB["AI Model Telemetry & Custom Retraining"]
        
        WS --> ANALYSIS
        REST --> OVERVIEW
        REST --> EMERGENCY_TAB
        REST --> CCTV_TAB
        REST --> ROI_TAB
        REST --> MODEL_TAB
    end
```

---

## 🌟 Core Features & Modules

### 1. 🚨 Emergency Priority Vehicle & Green Wave Corridor Dispatch
- **Automated Optical Detection**: Real-time recognition of approaching emergency vehicles (`ambulance`, `police_car`, `fire_truck`).
- **Tactical Visual Annotator**: Generates optical snapshots with high-contrast crimson bounding boxes, tactical corner HUD brackets, vehicle class banners, and centroid target pips.
- **Operator Verification Dossier Modal**:
  - Wide 2-column inspection interface (`max-w-5xl`).
  - Left panel: High-resolution optical evidence viewer with target vehicle highlight badges and 4 telemetry cards (Detected Class, Optical Confidence, Corridor Lane, Detection Timestamp).
  - Right panel: Verification workflow allowing human operators to confirm (`Correct Identification`) or reclassify false positives (`Wrong Identification`) with 9 vehicle category presets (`Car/Sedan`, `SUV/Jeep`, `Pickup`, `Commercial Truck`, `Bus`, `Auto Rickshaw`, `Motorcycle`, `Civilian Van`, `Other`).
  - Immutable audit notes saved to database for administrative accountability.

### 2. 📹 High-Speed Video Analysis Node
- **Multi-Class Vehicle Identification**: Accurately classifies Cars, SUVs, Trucks, Buses, Auto Rickshaws, Two-Wheelers, Ambulances, and Police Cars.
- **Adaptive FPS Control**: Real-time pacing presets (`0.1`, `0.2`, `0.5`, `0.6`, `20`, `30`, `40`, `50`, `MAX`) allowing ultra-slow forensic frame-by-frame review or maximum-speed real-time processing.
- **Live Stream Relay**: Sub-100ms MJPEG visual preview stream and concurrent WebSocket telemetry broadcasting.
- **Vehicle Coasting & Occlusion Recovery**: Smooth tracking engine preserves vehicle track IDs during temporary occlusion behind signs, bridges, or other large vehicles.

### 3. 🛣️ Interactive Corridor ROI & Multi-Lane Counting
- **Multi-Lane Geometry**: Custom polygon ROI definition and virtual counting lines per lane.
- **Directional Sensitivity**: Track vehicle movement vectors (`inbound`, `outbound`, `both`).
- **Dynamic Density Indexing**: Automatic categorization of lanes into `Low`, `Moderate`, and `Congested` traffic regimes.

### 4. 📹 Surveillance CCTV Management
- Multi-camera network management supporting IP camera RTSP/HTTP video feeds.
- Live connectivity testing and per-camera junction mapping.

### 5. 🧠 AI Model Performance & Custom Fine-Tuning
- Real-time precision, recall, mAP@0.5, and inference speed telemetry.
- Custom dataset retraining interface with configurable epochs, batch size, and input resolution.

---

## 🗂️ Project Structure

```
MargDristhi_V3/
├── backend/
│   ├── app/
│   │   ├── models/
│   │   │   └── schemas.py          # Pydantic schemas & request/response contracts
│   │   ├── routers/
│   │   │   ├── analysis.py         # Video upload, processing lifecycle & stream endpoints
│   │   │   ├── cctv.py             # CCTV camera configuration & connection tests
│   │   │   ├── emergency.py        # Emergency alerts, status updates & snapshot annotations
│   │   │   ├── history.py          # Incident history & analytics replay
│   │   │   ├── lanes.py            # Lane presets & polygon geometry configuration
│   │   │   ├── model_perf.py       # Model benchmarks & training pipelines
│   │   │   ├── overview.py         # Central dashboard summary statistics
│   │   │   └── settings.py         # System configuration & threshold adjustments
│   │   ├── services/
│   │   │   ├── detector.py         # YOLOv8 inference wrapper with GPU/CPU warmup
│   │   │   ├── tracker.py          # Kalman/Smooth tracking, lane assignment & counting
│   │   │   └── video_processor.py  # Video decode loop, HUD annotation & FPS pacing
│   │   ├── config.py               # Global directory paths, classes & constants
│   │   ├── database.py             # SQLite schema definitions & automatic migrations
│   │   └── main.py                 # FastAPI application root, CORS & WebSocket routing
│   ├── data/                       # Local SQLite database (margdrishti.db)
│   ├── outputs/                    # Annotated export videos & snapshot dossier images
│   ├── samples/                    # Sample traffic video footage
│   ├── uploads/                    # User-uploaded surveillance videos
│   ├── weights/                    # YOLOv8 neural network weights (best.pt)
│   └── requirements.txt            # Python dependencies
│
├── frontend/
│   ├── public/                     # Static assets, icons, and SVG logos
│   ├── src/
│   │   ├── assets/                 # App banners and branding media
│   │   ├── components/
│   │   │   ├── tabs/
│   │   │   │   ├── AnalysisTab.tsx # Video processing workspace & live video player
│   │   │   │   ├── CctvTab.tsx     # CCTV surveillance feed grid
│   │   │   │   ├── EmergencyTab.tsx# Emergency corridor verification dossier & alerts table
│   │   │   │   ├── HistoryTab.tsx  # Historical audit log & export reports
│   │   │   │   ├── LanesTab.tsx    # Interactive polygon lane ROI designer
│   │   │   │   ├── ModelTab.tsx    # AI accuracy metrics & custom retraining studio
│   │   │   │   ├── OverviewTab.tsx # Central executive traffic KPI dashboard
│   │   │   │   └── SettingsTab.tsx # Station preferences & audio alert toggles
│   │   │   ├── Header.tsx          # Unified command center header with IST clock & status
│   │   │   └── StatusBadge.tsx     # Reusable traffic status indicators
│   │   ├── services/
│   │   │   └── api.ts              # Axios HTTP client & API method bindings
│   │   ├── types/
│   │   │   └── index.ts            # TypeScript interfaces & domain types
│   │   ├── App.tsx                 # Root layout & tab routing with scroll-free navigation
│   │   ├── index.css               # Design system tokens, Gov-table styles & no-scrollbar
│   │   └── main.tsx                # React DOM entrypoint
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── .gitignore                      # Git exclusion rules for venvs, weights & large videos
├── start.txt                       # Quick launcher reference commands
└── README.md                       # Comprehensive project documentation
```

---

## ⚡ Quickstart Guide

### Prerequisites
- **Python**: 3.10 or higher
- **Node.js**: v18.0 or higher
- **NPM**: v9.0 or higher
- **Git**

---

### Step 1: Clone Repository
```bash
git clone https://github.com/Ayushanupam7/Marg_Drishtiv3.git
cd Marg_Drishtiv3
```

---

### Step 2: Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# On Windows (PowerShell):
.\.venv\Scripts\Activate.ps1
# On Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start backend server with hot-reload
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
*The FastAPI backend will initialize the database schema and serve at `http://127.0.0.1:8000` (API documentation available at `http://127.0.0.1:8000/docs`).*

---

### Step 3: Frontend Setup
In a new terminal window:
```bash
cd frontend

# Install npm dependencies
npm install

# Start Vite development server
npm run dev
```
*The dashboard will be accessible at `http://localhost:5173`.*

---

## 📡 REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/overview` | Retrieves central overview KPIs (total vehicles, lane densities, emergency counts). |
| `POST` | `/api/analysis/upload` | Uploads surveillance footage for AI analysis. |
| `POST` | `/api/analysis/start` | Starts AI detection & tracking job with custom thresholds and FPS. |
| `POST` | `/api/analysis/{id}/stop` | Stops an active analysis process. |
| `POST` | `/api/analysis/{id}/fps` | Dynamically updates the runtime video processing FPS. |
| `GET` | `/api/analysis/{id}/stream` | Streams live MJPEG video feed with real-time HUD annotations. |
| `GET` | `/api/emergency/alerts` | Fetches all detected emergency vehicle events. |
| `POST` | `/api/emergency/alerts/{id}/ensure-marked` | Generates tactical target markings on emergency snapshots. |
| `PATCH` | `/api/emergency/alerts/{id}` | Updates operator verification status (`VERIFIED` / `FALSE_POSITIVE`). |
| `GET` | `/api/lanes/presets` | Retrieves registered lane geometries and counting lines. |
| `POST` | `/api/lanes/{id}` | Updates polygon ROI coordinates and counting lines. |
| `GET` | `/api/cctv` | Lists all monitored CCTV cameras and locations. |
| `POST` | `/api/model/train` | Triggers a background retraining job with custom hyperparameters. |
| `WS` | `/ws/analysis/{id}` | Real-time WebSocket connection for sub-second telemetry packets. |

---

## 🛡️ License & Acknowledgements

Developed under the **Marg Drishti Smart Traffic AI Initiative**. Built with open-source tools: Ultralytics YOLOv8, OpenCV, FastAPI, React, and TailwindCSS.
