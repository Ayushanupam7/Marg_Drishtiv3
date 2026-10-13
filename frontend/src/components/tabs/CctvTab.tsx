import React, { useState, useEffect } from 'react';
import { 
  Video, 
  Plus, 
  Trash2, 
  Radio, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  AlertCircle
} from 'lucide-react';
import type { CctvCamera } from '../../types';
import { 
  fetchCctvCameras, 
  createCctvCamera, 
  testCameraConnection, 
  deleteCctvCamera 
} from '../../services/api';
import { StatusBadge } from '../StatusBadge';

export const CctvTab: React.FC = () => {
  const [cameras, setCameras] = useState<CctvCamera[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newLocation, setNewLocation] = useState<string>('');
  const [newStreamUrl, setNewStreamUrl] = useState<string>('');
  const [newFps, setNewFps] = useState<number>(25);
  const [newResolution, setNewResolution] = useState<string>('1920x1080');

  const loadCameras = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchCctvCameras();
      setCameras(res);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to fetch CCTV feeds');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCameras();
  }, []);

  const handleTestConnection = async (cameraId: string) => {
    try {
      setTestingId(cameraId);
      await testCameraConnection(cameraId);
      await loadCameras();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Connection test failed');
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (cameraId: string) => {
    if (!window.confirm('Are you sure you want to deregister this CCTV camera node?')) return;
    try {
      await deleteCctvCamera(cameraId);
      loadCameras();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to delete camera');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newLocation || !newStreamUrl) {
      alert('Please fill out Name, Location, and Stream URL');
      return;
    }
    try {
      await createCctvCamera({
        name: newName,
        location: newLocation,
        stream_url: newStreamUrl,
        fps: newFps,
        resolution: newResolution
      });
      setShowModal(false);
      setNewName('');
      setNewLocation('');
      setNewStreamUrl('');
      loadCameras();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to register camera node');
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-200 gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Surveillance CCTV Grid & RTSP Streams
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
              {cameras.length} Nodes Registered
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time highway junction monitoring cameras and RTSP/HTTP feed ingestion telemetry
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadCameras}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded transition shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Camera Feed
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* CCTV Camera Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {cameras.map((cam) => (
          <div
            key={cam.id}
            className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between"
          >
            <div>
              {/* Simulated Camera Feed Overlay */}
              <div className="bg-slate-950 aspect-video relative flex items-center justify-center text-slate-400">
                <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/70 px-2 py-0.5 rounded text-[10px] text-white font-mono z-10">
                  <span className={`w-2 h-2 rounded-full ${cam.status === 'ONLINE' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                  REC • {cam.name}
                </div>
                <div className="absolute top-2 right-2 bg-black/70 px-1.5 py-0.5 rounded text-[10px] text-slate-300 font-mono z-10">
                  {cam.resolution} • {cam.fps} FPS
                </div>

                {/* Stream visualizer */}
                <div className="text-center p-4">
                  <Video className="w-10 h-10 mx-auto opacity-30 text-slate-300 mb-1" />
                  <p className="text-[11px] font-mono text-slate-400 truncate max-w-[240px]">
                    {cam.stream_url}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {cam.status === 'ONLINE' ? 'Optical stream active' : 'Offline / Standby'}
                  </p>
                </div>

                <div className="absolute bottom-2 left-2 text-[10px] text-slate-400 bg-black/60 px-1.5 py-0.5 rounded font-mono">
                  LOC: {cam.location}
                </div>
              </div>

              {/* Camera Details */}
              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{cam.name}</h3>
                    <p className="text-xs text-slate-500">{cam.location}</p>
                  </div>
                  <StatusBadge status={cam.status} size="sm" />
                </div>

                <div className="text-[11px] text-slate-500 space-y-1 pt-1 font-mono">
                  <div className="flex justify-between">
                    <span>Node ID:</span>
                    <span className="text-slate-800 font-semibold">{cam.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Heartbeat:</span>
                    <span className="text-slate-800">
                      {cam.last_heartbeat ? new Date(cam.last_heartbeat).toLocaleTimeString('en-IN') : 'None'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => handleTestConnection(cam.id)}
                disabled={testingId === cam.id}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition disabled:opacity-50"
              >
                <Radio className={`w-3 h-3 ${testingId === cam.id ? 'animate-pulse' : ''}`} />
                {testingId === cam.id ? 'Pinging...' : 'Test Feed'}
              </button>

              <button
                onClick={() => handleDelete(cam.id)}
                className="p-1 text-slate-400 hover:text-red-600 rounded transition"
                title="Deregister node"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {cameras.length === 0 && !loading && (
        <div className="p-8 text-center bg-white rounded border border-slate-200 text-slate-400 text-xs">
          No CCTV camera feeds registered. Click "Add Camera Feed" to configure an optical junction node.
        </div>
      )}

      {/* Add Camera Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Video className="w-4 h-4 text-blue-700" />
                Register New CCTV Camera Node
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Camera Name / Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. NH48-KM32-Southbound"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-slate-800 focus:outline-blue-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Geographic Location</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ring Road Junction, New Delhi"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-slate-800 focus:outline-blue-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">RTSP / HTTP Stream URL</label>
                <input
                  type="text"
                  required
                  placeholder="rtsp://192.168.1.100:554/live or http://..."
                  value={newStreamUrl}
                  onChange={(e) => setNewStreamUrl(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-slate-800 font-mono focus:outline-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Resolution</label>
                  <select
                    value={newResolution}
                    onChange={(e) => setNewResolution(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-slate-800"
                  >
                    <option value="1920x1080">1080p (1920x1080)</option>
                    <option value="1280x720">720p (1280x720)</option>
                    <option value="3840x2160">4K (3840x2160)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target FPS</label>
                  <input
                    type="number"
                    min="5"
                    max="60"
                    value={newFps}
                    onChange={(e) => setNewFps(parseInt(e.target.value) || 25)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-slate-800"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 rounded text-slate-700 bg-slate-100 hover:bg-slate-200 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded text-white bg-blue-700 hover:bg-blue-800 font-semibold"
                >
                  Register Node
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
