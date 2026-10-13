import React, { useEffect, useState } from 'react';
import { 
  Car, 
  Split, 
  AlertTriangle, 
  Siren, 
  RefreshCw, 
  Play, 
  Clock, 
  ArrowUpRight,
  ShieldAlert
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  CartesianGrid 
} from 'recharts';
import type { OverviewData, TabKey } from '../../types';
import { fetchOverview } from '../../services/api';
import { StatusBadge } from '../StatusBadge';

interface OverviewTabProps {
  onNavigateTab: (tab: TabKey) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ onNavigateTab }) => {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchOverview();
      setData(res);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to load traffic overview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 15000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-200 gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Traffic Control Central Overview
            <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              Auto-refresh: 15s
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time state analysis, junction corridor density metrics, and priority vehicle alerts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => onNavigateTab('analysis')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded transition shadow-sm"
          >
            <Play className="w-3.5 h-3.5" />
            Launch AI Analysis
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadData} className="underline font-semibold ml-2">Retry</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Vehicles */}
        <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Total Monitored Vehicles
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {data?.summary?.total_vehicles ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Accumulated in active session
            </div>
          </div>
          <div className="w-12 h-12 rounded bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100">
            <Car className="w-6 h-6" />
          </div>
        </div>

        {/* Active Lanes */}
        <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Active Monitored Lanes
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {data?.summary?.active_lanes ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Configured optical corridors
            </div>
          </div>
          <div className="w-12 h-12 rounded bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100">
            <Split className="w-6 h-6" />
          </div>
        </div>

        {/* Congested Lanes */}
        <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Congested Corridors
            </div>
            <div className="text-2xl font-bold text-amber-600 mt-1">
              {data?.summary?.congested_lanes ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              High / Severe bottleneck index
            </div>
          </div>
          <div className="w-12 h-12 rounded bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-100">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Emergency Alerts */}
        <div 
          onClick={() => onNavigateTab('emergency')} 
          className="bg-white p-4 rounded border border-red-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-red-400 transition"
        >
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-red-600 flex items-center gap-1">
              <span>Priority Vehicle Alerts</span>
              <ArrowUpRight className="w-3 h-3 text-red-500" />
            </div>
            <div className="text-2xl font-bold text-red-700 mt-1">
              {data?.summary?.emergency_alerts ?? 0}
            </div>
            <div className="text-[11px] text-red-500 mt-0.5">
              Ambulance / Police / Fire
            </div>
          </div>
          <div className="w-12 h-12 rounded bg-red-50 text-red-600 flex items-center justify-center border border-red-100 animate-pulse">
            <Siren className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Without Data Banner */}
      {data && !data.has_data && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded text-center">
          <ShieldAlert className="w-8 h-8 text-blue-600 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-blue-900">No Traffic Video Analyzed Yet</h3>
          <p className="text-xs text-blue-700 max-w-lg mx-auto mt-1">
            {data.message || 'Run an AI analysis on a recorded video or load the bundled sample highway traffic video to view real-time corridor stats.'}
          </p>
          <button
            onClick={() => onNavigateTab('analysis')}
            className="mt-3 inline-flex items-center gap-1 px-4 py-1.5 text-xs font-semibold bg-blue-700 hover:bg-blue-800 text-white rounded transition shadow-sm"
          >
            Go to Video Analysis
          </button>
        </div>
      )}

      {/* Main Grid: Lane Density Table + Flow Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lane Density Status */}
        <div className="lg:col-span-2 bg-white rounded border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Lane Density & Flow Status</h3>
              <p className="text-[11px] text-slate-500">Live optical corridor vehicle count & congestion level</p>
            </div>
            <span className="text-xs font-mono font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
              Status: {data?.congestion_summary || 'Monitoring'}
            </span>
          </div>

          <div className="overflow-x-auto mt-3">
            <table className="gov-table">
              <thead>
                <tr>
                  <th>Lane Identifier</th>
                  <th>Active Density</th>
                  <th>Cumulative Vol</th>
                  <th>Est. Flow Rate</th>
                  <th>Congestion Level</th>
                </tr>
              </thead>
              <tbody>
                {data?.lane_density && data.lane_density.length > 0 ? (
                  data.lane_density.map((lane, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80">
                      <td className="font-semibold text-slate-800 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: lane.status_color || '#3b82f6' }} />
                        {lane.lane_name}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{lane.active_vehicles}</span>
                          <div className="w-20 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className="h-full rounded-full" 
                              style={{ 
                                width: `${Math.min(100, lane.active_vehicles * 10)}%`,
                                backgroundColor: lane.status_color || '#3b82f6' 
                              }} 
                            />
                          </div>
                        </div>
                      </td>
                      <td className="font-mono text-slate-600">{lane.cumulative_count}</td>
                      <td className="font-mono text-slate-600">{lane.flow_rate_per_min} /min</td>
                      <td>
                        <StatusBadge status={lane.congestion_level} size="sm" />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-400">
                      No lane telemetry recorded. Run analysis to display lane data.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Category Distribution Chart */}
        <div className="bg-white rounded border border-slate-200 shadow-sm p-4 flex flex-col">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Vehicle Classification</h3>
            <p className="text-[11px] text-slate-500">Distribution across detected vehicle types</p>
          </div>
          <div className="flex-1 min-h-[220px] pt-3">
            {data?.category_distribution && data.category_distribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.category_distribution} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="category" 
                    tick={{ fontSize: 10, fill: '#64748b' }} 
                    angle={-25} 
                    textAnchor="end" 
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0c2340', borderColor: '#1e3a8a', borderRadius: '4px', color: '#fff', fontSize: '11px' }} 
                    itemStyle={{ color: '#93c5fd' }}
                  />
                  <Bar dataKey="count" fill="#1e40af" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No classification metrics available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Traffic Flow Over Time & Recent Events */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Flow Dynamics Line Chart */}
        <div className="lg:col-span-2 bg-white rounded border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Traffic Density Trend Over Time</h3>
              <p className="text-[11px] text-slate-500">Vehicle count timeline across video duration</p>
            </div>
          </div>
          <div className="min-h-[220px] pt-3">
            {data?.flow_over_time && data.flow_over_time.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.flow_over_time} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="timestamp_sec" 
                    tick={{ fontSize: 10, fill: '#64748b' }} 
                    unit="s" 
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0c2340', borderColor: '#1e3a8a', borderRadius: '4px', color: '#fff', fontSize: '11px' }} 
                    itemStyle={{ color: '#93c5fd' }}
                    labelFormatter={(val) => `Time: ${val}s`}
                  />
                  <Line type="monotone" dataKey="vehicle_count" stroke="#1d4ed8" strokeWidth={2} dot={false} name="Active Vehicles" />
                  <Line type="monotone" dataKey="unique_vehicles" stroke="#059669" strokeWidth={2} dot={false} name="Cumulative Unique" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-xs text-slate-400">
                No temporal telemetry recorded
              </div>
            )}
          </div>
        </div>

        {/* Recent Detection Events */}
        <div className="bg-white rounded border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Recent Detections</h3>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {data?.recent_events && data.recent_events.length > 0 ? (
              data.recent_events.slice(0, 8).map((evt, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100 text-xs">
                  <div>
                    <div className="font-semibold text-slate-800 capitalize flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                      {evt.type} <span className="text-[10px] text-slate-400 font-mono">#{evt.id}</span>
                    </div>
                    <div className="text-[10px] text-slate-500">{evt.lane}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      {evt.time}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                No recent events logged
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
