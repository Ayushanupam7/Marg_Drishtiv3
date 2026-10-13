export type TabKey = 
  | 'overview'
  | 'analysis'
  | 'cctv'
  | 'lanes'
  | 'emergency'
  | 'model'
  | 'history'
  | 'settings';

export interface OverviewSummary {
  total_vehicles: number;
  active_lanes: number;
  congested_lanes: number;
  emergency_alerts: number;
}

export interface LaneDensityItem {
  lane_name: string;
  active_vehicles: number;
  cumulative_count: number;
  congestion_level: 'Low' | 'Moderate' | 'High' | 'Severe';
  flow_rate_per_min: number;
  status_color: string;
}

export interface CategoryDistributionItem {
  category: string;
  count: number;
}

export interface FlowOverTimeItem {
  timestamp_sec: number;
  vehicle_count: number;
  unique_vehicles: number;
  fps: number;
}

export interface DetectionEventItem {
  frame: number;
  time: string;
  event: string;
  lane: string;
  type: string;
  id: number | string;
}

export interface OverviewData {
  has_data: boolean;
  message?: string;
  analysis_id?: string;
  filename?: string;
  status?: string;
  summary: OverviewSummary;
  lane_density: LaneDensityItem[];
  category_distribution: CategoryDistributionItem[];
  flow_over_time: FlowOverTimeItem[];
  recent_events: DetectionEventItem[];
  congestion_summary: string;
  completed_at?: string;
}

export interface TrackedVehicleItem {
  track_id: number;
  class_name: string;
  confidence: number;
  bbox: [number, number, number, number];
  is_coasting?: boolean;
  is_emergency?: boolean;
  is_highlighted?: boolean;
}

export interface AnalysisDetails {
  id: string;
  filename: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'STOPPED';
  progress: number;
  current_frame: number;
  total_frames: number;
  fps: number;
  target_fps?: number | null;
  duration_seconds: number;
  total_vehicles: number;
  counts_by_class: Record<string, number>;
  counts_by_lane: Record<string, number>;
  lane_densities: Record<string, any>;
  flow_over_time: FlowOverTimeItem[];
  recent_detections: DetectionEventItem[];
  tracked_items?: TrackedVehicleItem[];
  highlight_vehicle_id?: number | null;
  emergency_count: number;
  error_message?: string;
  output_video_path?: string;
  created_at: string;
  completed_at?: string;
}

export interface CctvCamera {
  id: string;
  name: string;
  location: string;
  stream_url: string;
  status: 'OFFLINE' | 'ONLINE' | 'CONNECTING' | 'ERROR';
  fps: number;
  resolution: string;
  lane_config: any[];
  last_heartbeat?: string;
  error_message?: string;
  created_at: string;
}

export interface EmergencyAlert {
  id: string;
  analysis_id?: string;
  camera_id?: string;
  timestamp: string;
  vehicle_type: string;
  lane_name: string;
  confidence: number;
  snapshot_url?: string;
  verification_status: 'UNCONFIRMED' | 'VERIFIED' | 'FALSE_POSITIVE';
  recommended_action: string;
  operator_notes?: string;
  actual_vehicle_type?: string | null;
  bbox?: [number, number, number, number] | null;
  created_at: string;
}

export interface LaneItem {
  id: string;
  name: string;
  line_y: number;
  polygon: [number, number][];
  direction: string;
}

export interface ModelMetricsData {
  id: string;
  model_name: string;
  model_version: string;
  weights_path: string;
  checkpoint_available: boolean;
  classes: string[];
  precision: number;
  recall: number;
  map50: number;
  map50_95: number;
  counting_mae: number;
  status: string;
  dataset_info: {
    name: string;
    images_count: number;
    annotations_count: number;
    classes: string[];
    ground_truth_available: boolean;
    splits: { train: number; val: number; test: number };
  };
  training_config: Record<string, any>;
  disclaimer: string;
  updated_at: string;
}

export interface AnalysisHistoryItem {
  id: string;
  filename: string;
  status: string;
  progress: number;
  total_vehicles: number;
  duration_seconds: number;
  emergency_count: number;
  output_video_path?: string;
  created_at: string;
  completed_at?: string;
}
