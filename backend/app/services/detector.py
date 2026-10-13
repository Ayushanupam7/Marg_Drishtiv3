import os
import logging
from pathlib import Path
from ultralytics import YOLO
from app.config import DEFAULT_MODEL_PATH, YOLOV8N_FALLBACK

from typing import Optional, Dict, Any

logger = logging.getLogger("margdrishti.detector")

class TrafficDetector:
    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path or DEFAULT_MODEL_PATH
        self.model = None
        self.classes = {}
        self._load_model()

    def _load_model(self):
        try:
            if Path(self.model_path).exists():
                logger.info(f"Loading custom traffic model from {self.model_path}")
                self.model = YOLO(str(self.model_path))
            else:
                logger.info(f"Custom model not found at {self.model_path}, downloading/loading yolov8n.pt fallback")
                self.model = YOLO("yolov8n.pt")
            self.classes = self.model.names
            # Model warmup with small dummy array
            try:
                import numpy as np
                dummy = np.zeros((320, 320, 3), dtype=np.uint8)
                self.model(dummy, verbose=False)
            except Exception:
                pass
            logger.info(f"Model loaded and warmed up successfully with classes: {self.classes}")
        except Exception as e:
            logger.error(f"Error loading model: {e}. Falling back to yolov8n.pt")
            self.model = YOLO("yolov8n.pt")
            self.classes = self.model.names

    def get_classes(self):
        return self.classes

    def detect(self, frame, conf=0.30, iou=0.45, imgsz=480):
        if self.model is None:
            self._load_model()
        results = self.model(frame, conf=conf, iou=iou, imgsz=imgsz, verbose=False)
        return results[0]

    def detect_vehicles(self, frame, conf=0.30, iou=0.45, imgsz=480) -> list:
        """
        Run inference and return a clean list of all detected vehicle bounding boxes.
        """
        res = self.detect(frame, conf=conf, iou=iou, imgsz=imgsz)
        detections = []
        if res and res.boxes is not None and len(res.boxes) > 0:
            boxes = res.boxes.xyxy.cpu().numpy()
            confs = res.boxes.conf.cpu().numpy()
            clss = res.boxes.cls.int().cpu().numpy()
            names = res.names or self.classes
            for box, c_conf, c_idx in zip(boxes, confs, clss):
                cname = names.get(c_idx, "vehicle")
                detections.append({
                    "bbox": [float(b) for b in box],
                    "class_name": str(cname),
                    "class_id": int(c_idx),
                    "confidence": float(c_conf)
                })
        return detections

    def track(self, frame, conf=0.30, iou=0.45, tracker="bytetrack.yaml", persist=True, imgsz=640):
        if self.model is None:
            self._load_model()
        results = self.model.track(
            frame,
            conf=conf,
            iou=iou,
            tracker=tracker,
            persist=persist,
            imgsz=imgsz,
            verbose=False
        )
        return results[0]

# Singleton instance
traffic_detector = TrafficDetector()
