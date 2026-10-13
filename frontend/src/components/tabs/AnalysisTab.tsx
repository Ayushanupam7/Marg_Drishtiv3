import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  Play, 
  Square, 
  FileVideo, 
  Download, 
  Cpu, 
  AlertCircle,
  Activity,
  CheckCircle2,
  Sliders,
  Sparkles,
  Target,
  Radio,
  RotateCw,
  Eye,
  Crosshair,
  X,
  Gauge,
  Zap
} from 'lucide-react';
import type { AnalysisDetails, TrackedVehicleItem } from '../../types';
import { 
  uploadVideo, 
  loadSampleVideo, 
  startAnalysis, 
  stopAnalysis, 
  fetchAnalysisStatus,
  fetchActiveAnalysis,
  highlightVehicle,
  clearHighlightVehicle,
  updateAnalysisFps
} from '../../services/api';
import { StatusBadge } from '../StatusBadge';

interface AnalysisTabProps {
  onProcessingStateChange?: (isRunning: boolean) => void;
}

export const AnalysisTab: React.FC<AnalysisTabProps> = ({ onProcessingStateChange }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null);
  const [analysisDetails, setAnalysisDetails] = useState<AnalysisDetails | null>(null);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);

  // Target vehicle tracking
  const [highlightedVehicleId, setHighlightedVehicleId] = useState<number | null>(null);
  const [targetInputNumber, setTargetInputNumber] = useState<string>('');
  const [streamKey, setStreamKey] = useState<number>(Date.now());

  // Parameter controls & Target FPS (presets: 0.1, 0.2, 0.5, 0.6, 20, 30, 40, 50, MAX)
  const [confThreshold, setConfThreshold] = useState<number>(0.35);
  const [iouThreshold, setIouThreshold] = useState<number>(0.45);
  const [targetFps, setTargetFps] = useState<number | null>(20);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);
  const pollIntervalRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Notify parent of processing state changes so navigation tab shows live indicator
  useEffect(() => {
    const isRunning = analysisDetails?.status === 'PROCESSING';
    onProcessingStateChange?.(isRunning);
  }, [analysisDetails?.status, onProcessingStateChange]);

  // Auto-reconnect on mount to any active or saved analysis
  useEffect(() => {
    const initActive = async () => {
      try {
        const activeRes = await fetchActiveAnalysis();
        if (activeRes.active_analysis_id) {
          setActiveAnalysisId(activeRes.active_analysis_id);
          if (activeRes.highlight_vehicle_id) {
            setHighlightedVehicleId(activeRes.highlight_vehicle_id);
          }
          return;
        }
      } catch (e) {
        console.warn('Could not query active analysis endpoint:', e);
      }

      const saved = localStorage.getItem('margdrishti_active_analysis_id');
      if (saved) {
        setActiveAnalysisId(saved);
      }
    };

    initActive();
  }, []);

  // Persist activeAnalysisId to localStorage
  useEffect(() => {
    if (activeAnalysisId) {
      localStorage.setItem('margdrishti_active_analysis_id', activeAnalysisId);
    }
  }, [activeAnalysisId]);

  // Connect WebSocket or polling when activeAnalysisId changes
  useEffect(() => {
    if (!activeAnalysisId) return;

    // Fetch initial status
    fetchStatus();

    // Setup WebSocket
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/analysis/${activeAnalysisId}`;
    
    try {
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          setAnalysisDetails((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              status: payload.status,
              progress: payload.progress,
              current_frame: payload.current_frame,
              total_frames: payload.total_frames,
              fps: payload.fps,
              target_fps: payload.target_fps !== undefined ? payload.target_fps : prev.target_fps,
              total_vehicles: payload.total_vehicles !== undefined ? payload.total_vehicles : prev.total_vehicles,
              counts_by_class: payload.counts_by_class || prev.counts_by_class,
              tracked_items: payload.tracked_items || prev.tracked_items,
              highlight_vehicle_id: payload.highlight_vehicle_id,
              error_message: payload.error_message
            };
          });

          if (payload.target_fps !== undefined) {
            setTargetFps(payload.target_fps);
          }

          if (payload.highlight_vehicle_id !== undefined) {
            setHighlightedVehicleId(payload.highlight_vehicle_id);
          }

          if (['COMPLETED', 'FAILED', 'STOPPED'].includes(payload.status)) {
            fetchStatus(); // fetch full results from DB
          }
        } catch (e) {
          console.error('Error parsing WS message:', e);
        }
      };

      socket.onerror = () => {
        startPolling();
      };

      socket.onclose = () => {
        if (analysisDetails?.status === 'PROCESSING') {
          startPolling();
        }
      };
    } catch {
      startPolling();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [activeAnalysisId]);

  const startPolling = () => {
    if (pollIntervalRef.current) return;
    pollIntervalRef.current = setInterval(fetchStatus, 1200);
  };

  const fetchStatus = async () => {
    if (!activeAnalysisId) return;
    try {
      const details = await fetchAnalysisStatus(activeAnalysisId);
      setAnalysisDetails(details);
      if (details.target_fps !== undefined) {
        setTargetFps(details.target_fps);
      }
      if (details.highlight_vehicle_id !== undefined) {
        setHighlightedVehicleId(details.highlight_vehicle_id);
      }
      if (['COMPLETED', 'FAILED', 'STOPPED'].includes(details.status)) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }
    } catch (err: any) {
      console.warn('Failed to fetch status:', err);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const formatErrorMessage = (err: any, fallback: string): string => {
    const detail = err?.response?.data?.detail;
    if (!detail) return err?.message || fallback;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return detail.map((d: any) => d?.msg || (d?.loc ? `${d.loc.slice(1).join('.')}: ${d.msg}` : JSON.stringify(d))).join('; ');
    }
    if (typeof detail === 'object') {
      return detail.msg || JSON.stringify(detail);
    }
    return String(detail);
  };

  const handleUploadAndPrepare = async () => {
    if (!selectedFile) return;
    try {
      setLoading(true);
      setError(null);
      const res = await uploadVideo(selectedFile);
      setActiveAnalysisId(res.analysis_id);
      setCurrentVideoUrl(res.video_url);
      setSelectedFile(null);
    } catch (err: any) {
      setError(formatErrorMessage(err, 'Failed to upload traffic video'));
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSample = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await loadSampleVideo();
      setActiveAnalysisId(res.analysis_id);
      setCurrentVideoUrl(res.video_url);
    } catch (err: any) {
      setError(formatErrorMessage(err, 'Failed to load sample traffic benchmark video'));
    } finally {
      setLoading(false);
    }
  };

  const handleStartAnalysis = async () => {
    if (!analysisDetails && !activeAnalysisId) return;
    try {
      setLoading(true);
      setError(null);
      const targetFilename = analysisDetails?.filename || 'video.mp4';
      await startAnalysis({
        filename: targetFilename,
        conf_threshold: confThreshold,
        iou_threshold: iouThreshold,
        target_fps: targetFps
      });
      setStreamKey(Date.now());
      fetchStatus();
    } catch (err: any) {
      setError(formatErrorMessage(err, 'Failed to start AI detection pipeline'));
    } finally {
      setLoading(false);
    }
  };

  // Target FPS speed controller handler (0.1, 0.2, 0.5, 0.6, 20, 30, 40, 50, and MAX)
  const handleSetTargetFps = async (newFps: number | null) => {
    setTargetFps(newFps);

    // If local HTML video element is loaded, dynamically set its playback rate
    if (videoRef.current) {
      if (newFps !== null) {
        const rate = newFps <= 2 ? newFps : Math.min(newFps / 25, 4.0);
        try {
          videoRef.current.playbackRate = Math.max(0.1, rate);
        } catch (e) {
          console.warn('Could not set video playbackRate', e);
        }
      } else {
        videoRef.current.playbackRate = 1.0;
      }
    }

    // Zero-latency dispatch via active WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'set_fps', target_fps: newFps }));
    }

    // Complementary REST API dispatch
    if (activeAnalysisId) {
      try {
        await updateAnalysisFps(activeAnalysisId, newFps);
        setAnalysisDetails((prev) => (prev ? { ...prev, target_fps: newFps } : null));
      } catch (err) {
        console.warn('Failed to dispatch target FPS update:', err);
      }
    }
  };

  const handleStopAnalysis = async () => {
    if (!activeAnalysisId) return;
    try {
      await stopAnalysis(activeAnalysisId);
      fetchStatus();
    } catch (err: any) {
      setError(formatErrorMessage(err, 'Failed to stop analysis'));
    }
  };

  // Target Vehicle Focus Handlers
  const handleTargetVehicle = async (vehicleId: number) => {
    if (!activeAnalysisId) return;
    setHighlightedVehicleId(vehicleId);
    setTargetInputNumber(String(vehicleId));

    // Send via WebSocket immediately for zero-latency response
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'highlight', vehicle_id: vehicleId }));
    }

    // Complementary REST API dispatch
    try {
      await highlightVehicle(activeAnalysisId, vehicleId);
    } catch (err) {
      console.warn('Failed to dispatch highlight vehicle HTTP:', err);
    }
  };

  const handleClearTarget = async () => {
    if (!activeAnalysisId) return;
    setHighlightedVehicleId(null);
    setTargetInputNumber('');

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'clear_highlight' }));
    }

    try {
      await clearHighlightVehicle(activeAnalysisId);
    } catch (err) {
      console.warn('Failed to clear highlight HTTP:', err);
    }
  };

  const isProcessing = analysisDetails?.status === 'PROCESSING';

  return (
    <div className="space-y-6">
      {/* Tab Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-200 gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Traffic Optical Video Analysis Node
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
              YOLOv8 + ByteTrack
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Process junction feeds, count vehicle classes, detect priority emergency sirens & inspect real-time detections
          </p>
        </div>

        {activeAnalysisId && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200">
              ID: {activeAnalysisId}
            </span>
            <a
              href={`/api/analysis/${activeAnalysisId}/export`}
              download
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </a>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{typeof error === 'string' ? error : JSON.stringify(error)}</span>
        </div>
      )}

      {/* Upload & Setup Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dropzone & Sample Loader */}
        <div className="lg:col-span-2 bg-white rounded border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileVideo className="w-4 h-4 text-blue-700" />
              1. Video Feed Ingestion
            </h3>
            <button
              onClick={handleLoadSample}
              disabled={loading || isProcessing}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition shadow-sm disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              Load Bundled Sample (NH-48 Benchmark)
            </button>
          </div>

          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-6 text-center transition ${
              dragActive ? 'border-blue-500 bg-blue-50/50' : 'border-slate-300 bg-slate-50/50'
            }`}
          >
            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-700">
              Drag and drop traffic surveillance video, or{' '}
              <label className="text-blue-700 hover:underline cursor-pointer font-semibold">
                browse files
                <input
                  type="file"
                  accept="video/mp4,video/avi,video/mov,video/mkv"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={loading || isProcessing}
                />
              </label>
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Supported Formats: MP4, AVI, MOV, MKV (Highway Surveillance Feeds)
            </p>

            {selectedFile && (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-800 shadow-sm">
                <FileVideo className="w-4 h-4 text-blue-600" />
                <span>{selectedFile.name}</span>
                <span className="text-slate-400 text-[10px]">
                  ({(selectedFile.size / (1024 * 1024)).toFixed(1)} MB)
                </span>
                <button
                  onClick={handleUploadAndPrepare}
                  disabled={loading}
                  className="ml-2 px-2 py-0.5 bg-blue-700 hover:bg-blue-800 text-white rounded text-[11px] font-semibold"
                >
                  Upload
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Model Thresholds & Triggers */}
        <div className="bg-white rounded border border-slate-200 p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
              <Sliders className="w-4 h-4 text-blue-700" />
              2. Inference Parameters
            </h3>

            {/* Confidence Slider */}
            <div className="mt-4 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-600 font-medium">Detection Confidence:</span>
                <span className="font-mono font-bold text-slate-800">{confThreshold.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.10"
                max="0.90"
                step="0.05"
                value={confThreshold}
                onChange={(e) => setConfThreshold(parseFloat(e.target.value))}
                disabled={isProcessing}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-700"
              />
              <p className="text-[10px] text-slate-400">
                Recommended: 0.35 for congested mixed Indian traffic
              </p>
            </div>

            {/* IoU Slider */}
            <div className="mt-4 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-600 font-medium">NMS IoU Threshold:</span>
                <span className="font-mono font-bold text-slate-800">{iouThreshold.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.10"
                max="0.90"
                step="0.05"
                value={iouThreshold}
                onChange={(e) => setIouThreshold(parseFloat(e.target.value))}
                disabled={isProcessing}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-700"
              />
              <p className="text-[10px] text-slate-400">
                Overlap suppression for clustered multi-lane vehicles
              </p>
            </div>

            {/* Target FPS Speed Buttons (0.1, 0.2, 0.5, 0.6, 20, 30, 40, 50, MAX) */}
            <div className="mt-4 space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-600 font-medium flex items-center gap-1">
                  <Gauge className="w-3.5 h-3.5 text-blue-700" />
                  Target FPS Rate:
                </span>
                <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {targetFps !== null ? `${targetFps} FPS` : 'MAX (Uncapped)'}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {[0.1, 0.2, 0.5, 0.6, 20, 30, 40, 50].map((fpsVal) => {
                  const isSelected = targetFps === fpsVal;
                  return (
                    <button
                      key={fpsVal}
                      type="button"
                      onClick={() => handleSetTargetFps(fpsVal)}
                      className={`px-1.5 py-1 text-xs font-mono font-bold rounded transition-all text-center border ${
                        isSelected
                          ? 'bg-blue-700 text-white border-blue-800 shadow-sm ring-2 ring-blue-400/40'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {fpsVal}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-slate-400">
                  0.1–0.6: Slow Inspection | 20–50: High-Speed
                </span>
                <button
                  type="button"
                  onClick={() => handleSetTargetFps(null)}
                  className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border transition ${
                    targetFps === null
                      ? 'bg-blue-700 text-white border-blue-800'
                      : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  MAX
                </button>
              </div>
            </div>
          </div>

          {/* Action Trigger */}
          <div className="pt-4 border-t border-slate-100 flex items-center gap-2">
            {!isProcessing ? (
              <button
                onClick={handleStartAnalysis}
                disabled={!activeAnalysisId || loading}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded transition shadow-sm disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-current" />
                Start AI Analysis
              </button>
            ) : (
              <button
                onClick={handleStopAnalysis}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded transition shadow-sm"
              >
                <Square className="w-4 h-4 fill-current" />
                Halt Processing
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Progress & Live Processing Dashboard */}
      {analysisDetails && (
        <div className="bg-white rounded border border-slate-200 p-5 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
            <div className="flex items-center gap-2.5">
              <Activity className="w-5 h-5 text-blue-700" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">{analysisDetails.filename}</h3>
                <p className="text-[11px] text-slate-500 font-mono">
                  Analysis Task ID: {analysisDetails.id}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={analysisDetails.status} />
              {analysisDetails.status === 'COMPLETED' && (
                <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium bg-green-50 px-2 py-0.5 rounded border border-green-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Finished
                </span>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-600 font-medium">
              <span>
                Frame {analysisDetails.current_frame} / {analysisDetails.total_frames || 'Calculating...'}
              </span>
              <span className="font-mono font-bold text-blue-700">
                {analysisDetails.progress.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  analysisDetails.status === 'COMPLETED'
                    ? 'bg-emerald-600'
                    : analysisDetails.status === 'FAILED'
                    ? 'bg-red-600'
                    : 'bg-blue-600'
                }`}
                style={{ width: `${Math.min(100, analysisDetails.progress)}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
              <span>Processing Speed: {analysisDetails.fps.toFixed(1)} FPS</span>
              <span>Total Unique Vehicles Counted: {analysisDetails.total_vehicles}</span>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="p-2.5 bg-slate-50 rounded border border-slate-100">
              <div className="text-[10px] uppercase font-semibold text-slate-500">Total Counted</div>
              <div className="text-lg font-bold text-slate-900">{analysisDetails.total_vehicles}</div>
            </div>
            <div className="p-2.5 bg-slate-50 rounded border border-slate-100">
              <div className="text-[10px] uppercase font-semibold text-slate-500">Active in Frame</div>
              <div className="text-lg font-bold text-blue-700">
                {analysisDetails.tracked_items?.length || 0}
              </div>
            </div>
            <div className="p-2.5 bg-slate-50 rounded border border-slate-100">
              <div className="text-[10px] uppercase font-semibold text-slate-500">Inference Rate</div>
              <div className="text-lg font-bold text-slate-900">{analysisDetails.fps.toFixed(1)} FPS</div>
            </div>
            <div className="p-2.5 bg-red-50 rounded border border-red-100">
              <div className="text-[10px] uppercase font-semibold text-red-600">Emergencies</div>
              <div className="text-lg font-bold text-red-700">{analysisDetails.emergency_count}</div>
            </div>
          </div>

          {/* Vehicle Class Breakdown Chips */}
          <div>
            <h4 className="text-xs font-semibold text-slate-700 mb-2">Class Categorization:</h4>
            <div className="flex flex-wrap gap-2">
              {analysisDetails.counts_by_class && Object.keys(analysisDetails.counts_by_class).length > 0 ? (
                Object.entries(analysisDetails.counts_by_class).map(([cls, count]) => (
                  <div
                    key={cls}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 border border-slate-200 text-xs font-medium text-slate-800"
                  >
                    <span className="capitalize">{cls}:</span>
                    <span className="font-bold text-blue-700">{count}</span>
                  </div>
                ))
              ) : (
                <span className="text-xs text-slate-400">Awaiting detection results...</span>
              )}
            </div>
          </div>

          {/* Visual Feed Preview & Real-Time Stream */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-1 gap-2">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-blue-600" />
                  Visual Feed Preview & Detection Stream
                </h4>
                {isProcessing && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                    LIVE PROCESSING
                  </span>
                )}
                {analysisDetails.status === 'COMPLETED' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    ANNOTATED VIDEO READY
                  </span>
                )}
              </div>

              {isProcessing && (
                <button
                  onClick={() => setStreamKey(Date.now())}
                  title="Reload Visual Feed Stream"
                  className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition self-start sm:self-auto"
                >
                  <RotateCw className="w-3 h-3" />
                  Refresh Stream
                </button>
              )}
            </div>

            {/* Live Interactive FPS Speed Control Bar (0.1, 0.2, 0.5, 0.6, 20, 30, 40, 50, MAX) */}
            <div className="flex flex-wrap items-center justify-between bg-slate-900 text-white px-3.5 py-2 rounded-lg border border-slate-800 shadow-sm gap-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                  <Gauge className="w-4 h-4 text-cyan-400" />
                  <span>FPS Control:</span>
                </div>
                <div className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 flex items-center gap-1">
                  <span className="text-slate-400">Target:</span>
                  <strong className="text-cyan-200">
                    {targetFps !== null ? `${targetFps} FPS` : 'MAX Speed'}
                  </strong>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {[0.1, 0.2, 0.5, 0.6, 20, 30, 40, 50].map((fpsVal) => {
                  const isSelected = targetFps === fpsVal;
                  return (
                    <button
                      key={fpsVal}
                      type="button"
                      onClick={() => handleSetTargetFps(fpsVal)}
                      title={`Set processing & playback rate to ${fpsVal} FPS`}
                      className={`px-2.5 py-1 text-xs font-mono font-bold rounded transition-all duration-150 ${
                        isSelected
                          ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30 scale-105 ring-2 ring-cyan-300 font-extrabold'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      {fpsVal}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => handleSetTargetFps(null)}
                  title="Uncap target FPS to maximum processing speed"
                  className={`px-2.5 py-1 text-xs font-mono font-bold rounded transition-all ${
                    targetFps === null
                      ? 'bg-cyan-500 text-slate-950 shadow-md scale-105 ring-2 ring-cyan-300 font-extrabold'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                >
                  MAX
                </button>
              </div>
            </div>

            <div className="bg-slate-950 rounded-lg overflow-hidden aspect-video max-h-[460px] flex items-center justify-center relative shadow-inner border border-slate-800">
              {isProcessing ? (
                <div className="relative w-full h-full flex items-center justify-center bg-black">
                  {/* Real-time Multipart MJPEG Stream */}
                  <img
                    key={streamKey}
                    src={`/api/analysis/${activeAnalysisId}/stream?t=${streamKey}`}
                    alt="Live Traffic AI Detection Stream"
                    className="w-full h-full object-contain select-none"
                    onError={() => {
                      console.warn('Stream loading, reconnecting...');
                    }}
                  />

                  {/* Live HUD Floating Badges */}
                  <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
                    <div className="px-2.5 py-1 bg-slate-950/85 backdrop-blur-md rounded border border-red-500/40 flex items-center gap-2 shadow-lg">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                      <span className="text-[11px] font-mono font-bold text-white tracking-wide">
                        LIVE INFERENCE FEED • {analysisDetails.fps.toFixed(1)} FPS {targetFps !== null ? `(TARGET: ${targetFps})` : '(MAX)'}
                      </span>
                    </div>
                    <div className="hidden sm:flex px-2 py-1 bg-slate-950/80 backdrop-blur-md rounded border border-slate-700 text-[10px] font-mono text-slate-300">
                      FRAME: {analysisDetails.current_frame} / {analysisDetails.total_frames || '...'}
                    </div>
                  </div>

                  {highlightedVehicleId && (
                    <div className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1 bg-amber-500 text-slate-950 rounded shadow-lg border border-amber-300 text-xs font-bold animate-pulse">
                      <Target className="w-3.5 h-3.5" />
                      <span>FOCUSED: VEHICLE #{highlightedVehicleId}</span>
                      <button
                        onClick={handleClearTarget}
                        title="Clear Target Focus"
                        className="ml-1 text-slate-950 hover:text-black font-extrabold text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  <div className="absolute bottom-2 left-3 text-[10px] font-mono text-slate-300 bg-black/70 px-2 py-0.5 rounded backdrop-blur-sm pointer-events-none border border-slate-800">
                    Active Vehicles in Frame: {analysisDetails.tracked_items?.length || 0} | Emergencies: {analysisDetails.emergency_count}
                  </div>
                </div>
              ) : analysisDetails.output_video_path ? (
                <video
                  ref={videoRef}
                  key={analysisDetails.output_video_path}
                  controls
                  className="w-full h-full object-contain"
                  src={`/api/outputs/${analysisDetails.output_video_path.split(/[\\/]/).pop()}`}
                />
              ) : currentVideoUrl ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  <video
                    ref={videoRef}
                    controls
                    className="w-full h-full object-contain"
                    src={currentVideoUrl}
                  />
                  <div className="absolute top-3 left-3 bg-slate-900/80 px-2 py-1 rounded text-[11px] text-blue-300 font-medium">
                    Source Video Loaded • Click "Start AI Analysis" to Begin
                  </div>
                </div>
              ) : (
                <div className="text-center text-slate-400 text-xs p-6">
                  <Cpu className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  Traffic video stream will display here during or after analysis
                </div>
              )}
            </div>
          </div>

          {/* Target Vehicle Focus / Marking Control Bar */}
          <div className="p-4 bg-gradient-to-r from-blue-900/10 via-slate-50 to-amber-500/10 rounded-lg border border-blue-200 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-amber-600" />
                  Target Vehicle Identification & Persistent Focus Marking
                </h4>
                <p className="text-[11px] text-slate-500">
                  Highlight and track a specific vehicle mark number across all frames with tactical HUD crosshairs and visual reticle.
                </p>
              </div>

              {highlightedVehicleId ? (
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 border border-amber-300 rounded text-xs font-bold text-amber-900">
                  <Target className="w-3.5 h-3.5 text-amber-600" />
                  <span>Currently Marked: #{highlightedVehicleId}</span>
                  <button
                    onClick={handleClearTarget}
                    className="ml-2 text-xs text-red-600 hover:text-red-800 underline font-semibold"
                  >
                    Clear Target
                  </button>
                </div>
              ) : (
                <span className="text-xs text-slate-400 italic">No specific vehicle locked</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-700">Vehicle Mark Number:</span>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 1, 2, 5"
                  value={targetInputNumber}
                  onChange={(e) => setTargetInputNumber(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && targetInputNumber) {
                      handleTargetVehicle(parseInt(targetInputNumber, 10));
                    }
                  }}
                  className="w-28 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => {
                    if (targetInputNumber) {
                      handleTargetVehicle(parseInt(targetInputNumber, 10));
                    }
                  }}
                  disabled={!targetInputNumber}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded text-xs font-bold transition disabled:opacity-40 shadow-sm"
                >
                  <Target className="w-3.5 h-3.5" />
                  Mark Vehicle
                </button>
              </div>

              {/* Quick Select from Currently Detected Vehicles */}
              {analysisDetails?.tracked_items && analysisDetails.tracked_items.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap ml-auto">
                  <span className="text-[11px] text-slate-500 font-medium">Quick Pick in Frame:</span>
                  {analysisDetails.tracked_items.slice(0, 8).map((it) => {
                    const isSelected = it.track_id === highlightedVehicleId;
                    return (
                      <button
                        key={it.track_id}
                        onClick={() => handleTargetVehicle(it.track_id)}
                        className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition border ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 border-amber-600 ring-2 ring-amber-400 shadow'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                        }`}
                      >
                        #{it.track_id} ({it.class_name})
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Live Detections in Current Scene Inspector */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-blue-600" />
                All Active Detections in Scene ({analysisDetails.tracked_items?.length || 0} Currently Visible)
              </h4>
              <span className="text-[11px] text-slate-400">
                Click "Mark / Focus" on any vehicle to target it with crosshairs on the live preview
              </span>
            </div>

            {analysisDetails.tracked_items && analysisDetails.tracked_items.length > 0 ? (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-100/80 text-[11px] font-semibold text-slate-600 uppercase border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Mark #</th>
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2">Confidence</th>
                      <th className="px-3 py-2">Coordinates (BBox)</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right">Target Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {analysisDetails.tracked_items.map((it) => {
                      const isTargeted = it.track_id === highlightedVehicleId;
                      return (
                        <tr
                          key={it.track_id}
                          className={`transition-colors ${
                            isTargeted ? 'bg-amber-50/70 font-semibold' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded font-mono font-bold text-xs ${
                              isTargeted
                                ? 'bg-amber-500 text-slate-950 shadow-sm'
                                : it.is_emergency
                                ? 'bg-red-600 text-white'
                                : 'bg-slate-800 text-white'
                            }`}>
                              #{it.track_id}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold capitalize ${
                              it.is_emergency
                                ? 'bg-red-100 text-red-800 border border-red-200'
                                : 'bg-blue-50 text-blue-800 border border-blue-200'
                            }`}>
                              {it.is_emergency && '🚨 '}
                              {it.class_name}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono">
                            {(it.confidence * 100).toFixed(0)}%
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] text-slate-500">
                            [{it.bbox.join(', ')}]
                          </td>
                          <td className="px-3 py-2">
                            {it.is_emergency ? (
                              <span className="text-red-600 font-bold text-[11px]">PRIORITY EMERGENCY</span>
                            ) : it.is_coasting ? (
                              <span className="text-amber-600 text-[11px]">Coasting</span>
                            ) : (
                              <span className="text-emerald-600 text-[11px]">Active Tracking</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {isTargeted ? (
                              <button
                                onClick={handleClearTarget}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded font-bold text-[11px] transition shadow-sm"
                              >
                                <Target className="w-3 h-3" />
                                Targeted (Clear)
                              </button>
                            ) : (
                              <button
                                onClick={() => handleTargetVehicle(it.track_id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-blue-700 hover:text-white text-slate-700 rounded font-semibold text-[11px] transition border border-slate-300 hover:border-transparent"
                              >
                                <Target className="w-3 h-3" />
                                Mark #{it.track_id}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded border border-slate-200 text-center text-xs text-slate-400">
                {isProcessing
                  ? 'Scanning video frames... vehicles will appear here immediately as detected.'
                  : 'Start AI detection to inspect real-time vehicles and targets in each frame.'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
