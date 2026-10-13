import React, { useState, useEffect } from 'react';
import { 
  Split, 
  Save, 
  RotateCcw, 
  Check, 
  AlertCircle,
  HelpCircle,
  Layers
} from 'lucide-react';
import type { LaneItem } from '../../types';
import { fetchLanePresets, saveLaneConfig } from '../../services/api';

export const LanesTab: React.FC = () => {
  const [presets, setPresets] = useState<Record<string, LaneItem[]>>({});
  const [activePresetKey, setActivePresetKey] = useState<string>('standard_3_lane');
  const [currentLanes, setCurrentLanes] = useState<LaneItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchLanePresets();
      setPresets(res);
      if (res['standard_3_lane']) {
        setCurrentLanes(res['standard_3_lane']);
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to fetch lane presets');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPreset = (key: string) => {
    setActivePresetKey(key);
    if (presets[key]) {
      setCurrentLanes(JSON.parse(JSON.stringify(presets[key])));
    }
  };

  const handleLaneChange = (idx: number, field: keyof LaneItem, value: any) => {
    setCurrentLanes((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      await saveLaneConfig('default_corridor', currentLanes, 'video');
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to save lane configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-200 gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Highway Corridor Lane Architecture & ROI Geometry
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
              Virtual Counting Gates
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure optical detection gates, polygon bounding boxes, and traffic flow directions
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSelectPreset(activePresetKey)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded transition shadow-sm disabled:opacity-50"
          >
            {savedSuccess ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Saved Successfully
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving...' : 'Save Configuration'}
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Preset Selector */}
      <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-700" />
          <span className="text-xs font-bold text-slate-800">Highway Layout Preset:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.keys(presets).map((key) => (
            <button
              key={key}
              onClick={() => handleSelectPreset(key)}
              className={`px-3 py-1.5 rounded text-xs font-semibold border transition ${
                activePresetKey === key
                  ? 'bg-blue-700 text-white border-blue-700 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {key === 'standard_3_lane' ? 'Standard 3-Lane Corridor' : '4-Lane Expressway Layout'}
            </button>
          ))}
        </div>
      </div>

      {/* Visual Lane Geometry Preview & Config List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Visual Schematic Diagram */}
        <div className="lg:col-span-7 bg-white rounded border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Corridor Schematic Projection</h3>
            <span className="text-[11px] font-mono text-slate-500">Perspective Gate View</span>
          </div>

          <div className="relative bg-slate-900 rounded-lg aspect-video w-full overflow-hidden flex flex-col justify-between p-4 border border-slate-800">
            {/* Road lines simulation */}
            <div className="absolute inset-0 flex items-center justify-around opacity-30 pointer-events-none">
              {currentLanes.map((_, i) => (
                <div key={i} className="h-full border-r-2 border-dashed border-amber-400" />
              ))}
            </div>

            {/* Inbound / Outbound tags */}
            <div className="relative z-10 flex justify-between text-[11px] font-mono text-blue-300 bg-slate-950/80 px-2 py-1 rounded">
              <span>NORTHBOUND APPROACH (ENTRY)</span>
              <span>JUNCTION PASS-THROUGH</span>
            </div>

            {/* Visual Lane Gates */}
            <div className="relative z-10 grid grid-flow-col gap-2 h-36">
              {currentLanes.map((lane, idx) => (
                <div
                  key={lane.id || idx}
                  className="rounded border-2 border-blue-400 bg-blue-500/20 backdrop-blur-[1px] p-2 flex flex-col justify-between text-white"
                >
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold bg-blue-900/80 px-1.5 py-0.5 rounded border border-blue-400/40">
                      #{idx + 1}
                    </span>
                    <span className="text-[10px] font-mono uppercase bg-slate-900/70 px-1 rounded text-emerald-300">
                      DIR: {lane.direction}
                    </span>
                  </div>

                  <div className="text-center">
                    <p className="text-xs font-bold drop-shadow">{lane.name}</p>
                    <p className="text-[10px] text-blue-200 font-mono mt-0.5">
                      Gate Y: {(lane.line_y * 100).toFixed(0)}%
                    </p>
                  </div>

                  <div className="w-full bg-blue-400/30 h-1 rounded" />
                </div>
              ))}
            </div>

            <div className="relative z-10 text-[10px] text-slate-400 font-mono text-center bg-slate-950/80 py-0.5 rounded">
              YOLO Optical Tracker Intersects When Vehicle Bounding Box Centroid Crosses Gate Y
            </div>
          </div>
        </div>

        {/* Lane Parameters Editor */}
        <div className="lg:col-span-5 bg-white rounded border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Configured Optical Gates</h3>
            <span className="text-[11px] font-mono text-slate-500">{currentLanes.length} Active Gates</span>
          </div>

          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
            {currentLanes.map((lane, idx) => (
              <div key={lane.id || idx} className="p-3 bg-slate-50 rounded border border-slate-200 text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-800">Gate #{idx + 1}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-slate-500">Direction:</span>
                    <select
                      value={lane.direction}
                      onChange={(e) => handleLaneChange(idx, 'direction', e.target.value)}
                      className="px-1.5 py-0.5 rounded border border-slate-300 bg-white font-mono text-slate-800 font-semibold"
                    >
                      <option value="in">IN (Inbound)</option>
                      <option value="out">OUT (Outbound)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Gate Label</label>
                  <input
                    type="text"
                    value={lane.name}
                    onChange={(e) => handleLaneChange(idx, 'name', e.target.value)}
                    className="w-full px-2 py-1 rounded border border-slate-300 bg-white text-slate-800"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-slate-600 mb-1">
                    <span>Virtual Tripwire Y:</span>
                    <span className="font-mono font-bold text-blue-700">{(lane.line_y * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.20"
                    max="0.95"
                    step="0.05"
                    value={lane.line_y}
                    onChange={(e) => handleLaneChange(idx, 'line_y', parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-700"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
