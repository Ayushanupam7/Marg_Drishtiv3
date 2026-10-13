import axios from 'axios';
import type {
  OverviewData,
  AnalysisDetails,
  CctvCamera,
  EmergencyAlert,
  ModelMetricsData,
  AnalysisHistoryItem
} from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

export const fetchHealth = async () => {
  const res = await api.get('/health');
  return res.data;
};

export const fetchOverview = async (): Promise<OverviewData> => {
  const res = await api.get('/overview');
  return res.data;
};

export const uploadVideo = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post('/analysis/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const loadSampleVideo = async () => {
  const res = await api.post('/analysis/sample/load');
  return res.data;
};

export const startAnalysis = async (params: {
  filename: string;
  conf_threshold?: number;
  iou_threshold?: number;
  target_fps?: number | null;
  lanes_config?: any[];
}) => {
  const res = await api.post('/analysis/start', params);
  return res.data;
};

export const updateAnalysisFps = async (analysisId: string, targetFps: number | null) => {
  const res = await api.post(`/analysis/${analysisId}/fps`, { target_fps: targetFps });
  return res.data;
};

export const stopAnalysis = async (analysisId: string) => {
  const res = await api.post(`/analysis/${analysisId}/stop`);
  return res.data;
};

export const fetchAnalysisStatus = async (analysisId: string): Promise<AnalysisDetails> => {
  const res = await api.get(`/analysis/${analysisId}`);
  return res.data;
};

export const fetchActiveAnalysis = async (): Promise<{
  active_analysis_id: string | null;
  status: string | null;
  filename?: string;
  progress?: number;
  highlight_vehicle_id?: number | null;
}> => {
  const res = await api.get('/analysis/current/active');
  return res.data;
};

export const highlightVehicle = async (analysisId: string, vehicleId: number) => {
  const res = await api.post(`/analysis/${analysisId}/highlight/${vehicleId}`);
  return res.data;
};

export const clearHighlightVehicle = async (analysisId: string) => {
  const res = await api.post(`/analysis/${analysisId}/highlight/0`);
  return res.data;
};

// CCTV Endpoints
export const fetchCctvCameras = async (): Promise<CctvCamera[]> => {
  const res = await api.get('/cctv');
  return res.data;
};

export const createCctvCamera = async (data: {
  name: string;
  location: string;
  stream_url: string;
  fps?: number;
  resolution?: string;
}) => {
  const res = await api.post('/cctv', data);
  return res.data;
};

export const testCameraConnection = async (cameraId: string) => {
  const res = await api.post(`/cctv/${cameraId}/test`);
  return res.data;
};

export const deleteCctvCamera = async (cameraId: string) => {
  const res = await api.delete(`/cctv/${cameraId}`);
  return res.data;
};

// Emergency Endpoints
export const fetchEmergencyAlerts = async (statusFilter?: string): Promise<EmergencyAlert[]> => {
  const params = statusFilter ? { status_filter: statusFilter } : {};
  const res = await api.get('/emergency/alerts', { params });
  return res.data;
};

export const updateEmergencyAlert = async (
  alertId: string,
  data: { verification_status: string; operator_notes?: string; actual_vehicle_type?: string | null }
) => {
  const res = await api.patch(`/emergency/alerts/${alertId}`, data);
  return res.data;
};

export const ensureEmergencyAlertMarked = async (alertId: string) => {
  const res = await api.post(`/emergency/alerts/${alertId}/ensure-marked`);
  return res.data;
};

// Lanes Endpoints
export const fetchLanePresets = async () => {
  const res = await api.get('/lanes/presets');
  return res.data;
};

export const fetchLaneConfig = async (targetId: string) => {
  const res = await api.get(`/lanes/${targetId}`);
  return res.data;
};

export const saveLaneConfig = async (targetId: string, lanes: any[], targetType = 'video') => {
  const res = await api.post(`/lanes/${targetId}`, lanes, {
    params: { target_type: targetType },
  });
  return res.data;
};

// Model Metrics Endpoints
export const fetchModelMetrics = async (): Promise<ModelMetricsData> => {
  const res = await api.get('/model/metrics');
  return res.data;
};

export const initiateTraining = async (data: {
  model_name: string;
  epochs: number;
  batch_size: number;
  imgsz: number;
}) => {
  const res = await api.post('/model/train', data);
  return res.data;
};

// History Endpoints
export const fetchHistory = async (): Promise<AnalysisHistoryItem[]> => {
  const res = await api.get('/history');
  return res.data;
};

export const deleteHistoryItem = async (analysisId: string) => {
  const res = await api.delete(`/history/${analysisId}`);
  return res.data;
};

// Settings Endpoints
export const fetchSettings = async () => {
  const res = await api.get('/settings');
  return res.data;
};

export const saveSettings = async (settings: Record<string, any>) => {
  const res = await api.post('/settings', settings);
  return res.data;
};
