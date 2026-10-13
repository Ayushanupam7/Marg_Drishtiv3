from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from datetime import datetime

class AnalysisSummary(BaseModel):
    id: str
    filename: str
    status: str
    progress: float
    current_frame: int
    total_frames: int
    fps: float
    duration_seconds: float
    total_vehicles: int
    counts_by_class: Dict[str, int]
    counts_by_lane: Dict[str, int]
    lane_densities: Dict[str, Any]
    flow_over_time: List[Dict[str, Any]]
    recent_detections: List[Dict[str, Any]]
    emergency_count: int
    error_message: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None
    output_video_path: Optional[str] = None

class AnalysisStartRequest(BaseModel):
    filename: str
    conf_threshold: float = 0.35
    iou_threshold: float = 0.45
    frame_skip: int = 1
    target_fps: Optional[float] = 20.0
    imgsz: int = 480
    lanes_config: Optional[List[Dict[str, Any]]] = None

class LaneConfig(BaseModel):
    id: str
    name: str
    line_y: Optional[float] = None # normalized 0-1 for horizontal counting line
    line_p1: Optional[List[float]] = None # [x1, y1] normalized
    line_p2: Optional[List[float]] = None # [x2, y2] normalized
    polygon: Optional[List[List[float]]] = None # [[x,y],...] normalized
    direction: Optional[str] = "both" # "in", "out", "both"

class CameraCreate(BaseModel):
    name: str
    location: str
    stream_url: str
    fps: int = 25
    resolution: str = "1920x1080"
    lane_config: Optional[List[Dict[str, Any]]] = None

class CameraUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    stream_url: Optional[str] = None
    status: Optional[str] = None
    lane_config: Optional[List[Dict[str, Any]]] = None

class EmergencyAlertUpdate(BaseModel):
    verification_status: str # 'VERIFIED', 'FALSE_POSITIVE', 'UNCONFIRMED'
    operator_notes: Optional[str] = None
    actual_vehicle_type: Optional[str] = None

class SettingsUpdate(BaseModel):
    confidence_threshold: Optional[float] = None
    iou_threshold: Optional[float] = None
    tracker_type: Optional[str] = None
    operator_id: Optional[str] = None
    control_room_junction: Optional[str] = None
    alert_sound: Optional[bool] = None

class CustomTrainRequest(BaseModel):
    model_name: str
    epochs: int = 50
    batch_size: int = 16
    imgsz: int = 640
    data_yaml_url: Optional[str] = None
