import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Save, 
  Check, 
  RotateCcw, 
  AlertCircle, 
  Bell, 
  Sliders, 
  Shield 
} from 'lucide-react';
import { fetchSettings, saveSettings } from '../../services/api';

export const SettingsTab: React.FC = () => {
  const [settings, setSettings] = useState<Record<string, any>>({
    node_id: 'NODE-DL-HQ-01',
    department: 'Traffic Monitoring & Management Directorate',
    emergency_sound: true,
    congestion_high_threshold: 15,
    congestion_severe_threshold: 25,
    auto_refresh_sec: 15,
    webhook_url: ''
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchSettings();
      if (res && Object.keys(res).length > 0) {
        setSettings((prev) => ({ ...prev, ...res }));
      }
    } catch (err: any) {
      console.warn('Could not load custom settings, using system defaults', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      await saveSettings(settings);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-200 gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            System Station & Telemetry Settings
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
              Control Room Node
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure junction node identification, threshold indices, and priority alert dispatch rules
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded transition shadow-sm disabled:opacity-50 self-start sm:self-auto"
        >
          {savedSuccess ? (
            <>
              <Check className="w-3.5 h-3.5" />
              Saved
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Save Settings'}
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        {/* Node Identity */}
        <div className="bg-white p-5 rounded border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
            <Shield className="w-4 h-4 text-blue-700" />
            Station Identity & Department Metadata
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">System Node Identifier</label>
              <input
                type="text"
                value={settings.node_id || ''}
                onChange={(e) => handleChange('node_id', e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono text-slate-800 focus:outline-blue-600"
              />
              <span className="text-[10px] text-slate-400">Unique control room station broadcast ID</span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Department / Directorate</label>
              <input
                type="text"
                value={settings.department || ''}
                onChange={(e) => handleChange('department', e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded text-slate-800 focus:outline-blue-600"
              />
              <span className="text-[10px] text-slate-400">Jurisdictional authority branding</span>
            </div>
          </div>
        </div>

        {/* Congestion Thresholds */}
        <div className="bg-white p-5 rounded border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
            <Sliders className="w-4 h-4 text-blue-700" />
            Congestion Classification Thresholds
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                High Congestion Vehicle Count (per lane)
              </label>
              <input
                type="number"
                min="5"
                max="50"
                value={settings.congestion_high_threshold || 15}
                onChange={(e) => handleChange('congestion_high_threshold', parseInt(e.target.value) || 15)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono text-slate-800 focus:outline-blue-600"
              />
              <span className="text-[10px] text-slate-400">Threshold to trigger amber caution status</span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Severe Bottleneck Threshold (per lane)
              </label>
              <input
                type="number"
                min="10"
                max="100"
                value={settings.congestion_severe_threshold || 25}
                onChange={(e) => handleChange('congestion_severe_threshold', parseInt(e.target.value) || 25)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono text-slate-800 focus:outline-blue-600"
              />
              <span className="text-[10px] text-slate-400">Threshold to escalate to emergency corridor routing</span>
            </div>
          </div>
        </div>

        {/* Notifications & Dispatch Integrations */}
        <div className="bg-white p-5 rounded border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
            <Bell className="w-4 h-4 text-blue-700" />
            Dispatch & Automated Notifications
          </h3>

          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="emergency_sound"
                checked={settings.emergency_sound ?? true}
                onChange={(e) => handleChange('emergency_sound', e.target.checked)}
                className="w-4 h-4 rounded text-blue-700 accent-blue-700 cursor-pointer"
              />
              <label htmlFor="emergency_sound" className="font-semibold text-slate-700 cursor-pointer">
                Enable Audio Siren on Priority Emergency Vehicle Detection
              </label>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Dispatch Notification Webhook URL (Optional)
              </label>
              <input
                type="url"
                placeholder="https://control-room.gov.in/api/v1/alerts/webhook"
                value={settings.webhook_url || ''}
                onChange={(e) => handleChange('webhook_url', e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono text-slate-800 focus:outline-blue-600"
              />
              <span className="text-[10px] text-slate-400">
                Outbound POST event payload when verified emergency vehicle detected
              </span>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
