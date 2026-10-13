import React, { useState, useEffect } from 'react';
import { 
  History, 
  Trash2, 
  RefreshCw, 
  Download, 
  FileVideo, 
  Clock, 
  Car,
  Siren,
  AlertCircle
} from 'lucide-react';
import type { AnalysisHistoryItem, TabKey } from '../../types';
import { fetchHistory, deleteHistoryItem } from '../../services/api';
import { StatusBadge } from '../StatusBadge';

interface HistoryTabProps {
  onNavigateTab: (tab: TabKey) => void;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({ onNavigateTab }) => {
  const [historyItems, setHistoryItems] = useState<AnalysisHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchHistory();
      setHistoryItems(res);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to fetch analysis history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this historical analysis record and output file?')) return;
    try {
      await deleteHistoryItem(id);
      loadHistory();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to delete record');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-200 gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Historical Traffic Analysis Records
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
              {historyItems.length} Sessions Logged
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Archival records of surveillance video analyses, vehicle statistics, and emergency alerts
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadHistory}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => onNavigateTab('analysis')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded transition shadow-sm"
          >
            <FileVideo className="w-3.5 h-3.5" />
            Analyze New Video
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadHistory} className="underline font-semibold ml-2">Retry</button>
        </div>
      )}

      {/* History Table */}
      <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="gov-table">
            <thead>
              <tr>
                <th>Record ID / Timestamp</th>
                <th>Video Source File</th>
                <th>Processing State</th>
                <th>Vehicles Counted</th>
                <th>Duration</th>
                <th>Emergencies</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {historyItems.length > 0 ? (
                historyItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td>
                      <div className="font-mono font-bold text-slate-800 text-xs">{item.id}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {new Date(item.created_at).toLocaleString('en-IN')}
                      </div>
                    </td>
                    <td>
                      <div className="font-semibold text-slate-800 text-xs max-w-xs truncate" title={item.filename}>
                        {item.filename}
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={item.status} size="sm" />
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5 font-bold text-slate-800 font-mono">
                        <Car className="w-3.5 h-3.5 text-blue-600" />
                        {item.total_vehicles}
                      </div>
                    </td>
                    <td className="font-mono text-slate-600 text-xs">
                      {item.duration_seconds.toFixed(1)}s
                    </td>
                    <td>
                      {item.emergency_count > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                          <Siren className="w-3 h-3 text-red-600" />
                          {item.emergency_count}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono text-xs">0</span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        {item.output_video_path && (
                          <a
                            href={`/api/outputs/${item.output_video_path.split(/[\\/]/).pop()}`}
                            download
                            className="p-1.5 text-blue-700 hover:bg-blue-50 rounded transition"
                            title="Download Processed Video"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                          title="Delete Record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400 text-xs">
                    No historical analysis sessions logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
