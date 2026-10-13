import React, { useState, useEffect } from 'react';
import { 
  Siren, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  FileText,
  Clock,
  Eye,
  ShieldCheck,
  Zap,
  ExternalLink
} from 'lucide-react';
import type { EmergencyAlert } from '../../types';
import { fetchEmergencyAlerts, updateEmergencyAlert, ensureEmergencyAlertMarked } from '../../services/api';
const VEHICLE_TYPE_PRESETS = [
  { label: 'Car / Sedan', icon: '🚗' },
  { label: 'SUV / Jeep', icon: '🚙' },
  { label: 'Pickup Truck', icon: '🛻' },
  { label: 'Commercial Truck', icon: '🚚' },
  { label: 'Bus / Coach', icon: '🚌' },
  { label: 'Auto Rickshaw', icon: '🛺' },
  { label: 'Motorcycle / Bike', icon: '🏍️' },
  { label: 'Civilian Van', icon: '🚐' },
  { label: 'Other', icon: '❓' }
];

export const EmergencyTab: React.FC = () => {
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Selected snapshot for inspection modal
  const [inspectAlert, setInspectAlert] = useState<EmergencyAlert | null>(null);
  const [verificationDecision, setVerificationDecision] = useState<'VERIFIED' | 'FALSE_POSITIVE'>('VERIFIED');
  const [actualVehicleType, setActualVehicleType] = useState<string>('Car / Sedan');
  const [customVehicleType, setCustomVehicleType] = useState<string>('');
  const [operatorNotes, setOperatorNotes] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchEmergencyAlerts(statusFilter === 'ALL' ? undefined : statusFilter);
      setAlerts(res);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to fetch emergency vehicle alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
    const timer = setInterval(loadAlerts, 10000);
    return () => clearInterval(timer);
  }, [statusFilter]);

  const openInspectModal = (alert: EmergencyAlert, initialDecision?: 'VERIFIED' | 'FALSE_POSITIVE') => {
    setInspectAlert(alert);
    const chosenDecision = initialDecision || (alert.verification_status === 'FALSE_POSITIVE' ? 'FALSE_POSITIVE' : 'VERIFIED');
    setVerificationDecision(chosenDecision);
    setOperatorNotes(alert.operator_notes || '');
    setActualVehicleType(alert.actual_vehicle_type || (chosenDecision === 'FALSE_POSITIVE' ? 'Car / Sedan' : ''));
    setCustomVehicleType('');
    setFormError(null);

    // If alert has snapshot without bbox, ensure it is marked on backend
    if (alert.snapshot_url && !alert.bbox) {
      ensureEmergencyAlertMarked(alert.id).then((res) => {
        if (res?.bbox) {
          setInspectAlert(prev => prev && prev.id === alert.id ? { ...prev, bbox: res.bbox } : prev);
        }
      }).catch(() => {});
    }
  };

  const handleSubmitVerification = async () => {
    if (!inspectAlert) return;

    const finalActualType = actualVehicleType === 'Other'
      ? (customVehicleType.trim() || 'Other Civilian Vehicle')
      : actualVehicleType;

    if (verificationDecision === 'FALSE_POSITIVE') {
      if (!finalActualType && !operatorNotes.trim()) {
        setFormError('Please select or specify what this vehicle is, and add a comment.');
        return;
      }
    }

    try {
      setSubmitting(true);
      setFormError(null);
      await updateEmergencyAlert(inspectAlert.id, {
        verification_status: verificationDecision,
        operator_notes: operatorNotes.trim() || (verificationDecision === 'VERIFIED' ? 'Verified emergency priority vehicle' : `Misidentified. Actual vehicle: ${finalActualType || 'Civilian vehicle'}`),
        actual_vehicle_type: verificationDecision === 'FALSE_POSITIVE' ? finalActualType : null
      });
      setInspectAlert(null);
      loadAlerts();
    } catch (err: any) {
      setFormError(err?.response?.data?.detail || 'Failed to update alert verification');
    } finally {
      setSubmitting(false);
    }
  };

  const unconfirmedCount = alerts.filter(a => a.verification_status === 'UNCONFIRMED').length;

  return (
    <div className="space-y-6">
      {/* Priority Banner */}
      <div className="bg-red-700 text-white p-4 rounded-lg shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 animate-bounce">
            <Siren className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight">
                Emergency Priority Vehicle & Green Corridor Dispatch
              </h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white text-red-700">
                CRITICAL DISPATCH
              </span>
            </div>
            <p className="text-xs text-red-100 mt-0.5">
              Automated optical recognition of Ambulances, Police Patrols & Fire Tenders with signal pre-emption
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="bg-red-800/80 px-3 py-1.5 rounded border border-red-600/50 text-right">
            <div className="text-[10px] uppercase tracking-wider text-red-200">Pending Actions</div>
            <div className="text-lg font-bold text-white font-mono">{unconfirmedCount} Unconfirmed</div>
          </div>
          <button
            onClick={loadAlerts}
            className="p-2 bg-red-800 hover:bg-red-900 rounded text-white transition"
            title="Refresh alerts"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadAlerts} className="underline font-semibold ml-2">Retry</button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        {['ALL', 'UNCONFIRMED', 'VERIFIED', 'FALSE_POSITIVE'].map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
              statusFilter === tab
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Alerts Table */}
      <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="gov-table">
            <thead>
              <tr>
                <th>Alert ID / Time</th>
                <th>Vehicle Class</th>
                <th>Optical Confidence</th>
                <th>Lane / Corridor</th>
                <th>Verification State</th>
                <th>Recommended Action</th>
                <th>Operator Controls</th>
              </tr>
            </thead>
            <tbody>
              {alerts.length > 0 ? (
                alerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-slate-50">
                    <td>
                      <div className="font-mono font-bold text-slate-800 text-xs">{alert.id}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {new Date(alert.created_at).toLocaleTimeString('en-IN')}
                      </div>
                    </td>
                    <td>
                      <div className="font-bold text-slate-900 capitalize flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                        {alert.vehicle_type.replace('_', ' ')}
                      </div>
                    </td>
                    <td>
                      <span className="font-mono font-bold text-slate-700">
                        {(alert.confidence * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="text-slate-700 font-medium">{alert.lane_name}</td>
                    <td>
                      {alert.verification_status === 'VERIFIED' ? (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
                            <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                            Correct (Verified)
                          </span>
                          {alert.operator_notes && (
                            <div className="text-[10px] text-slate-500 truncate max-w-[170px]" title={alert.operator_notes}>
                              {alert.operator_notes}
                            </div>
                          )}
                        </div>
                      ) : alert.verification_status === 'FALSE_POSITIVE' ? (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            <XCircle className="w-3.5 h-3.5 text-amber-700" />
                            Wrong (Misidentified)
                          </span>
                          {alert.actual_vehicle_type && (
                            <div className="text-[11px] font-semibold text-slate-800 flex items-center gap-1">
                              <span className="text-slate-500 font-normal">What is it:</span>
                              <span className="px-1.5 py-0.2 rounded bg-slate-100 border border-slate-200 text-blue-800 font-bold">
                                {alert.actual_vehicle_type}
                              </span>
                            </div>
                          )}
                          {alert.operator_notes && (
                            <div className="text-[10px] text-slate-500 italic truncate max-w-[170px]" title={alert.operator_notes}>
                              "{alert.operator_notes}"
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                          Unconfirmed
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="text-xs text-blue-800 font-semibold flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                        {alert.recommended_action}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openInspectModal(alert)}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100 transition inline-flex items-center gap-1 shadow-sm"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-600" />
                          Review
                        </button>

                        {alert.verification_status === 'UNCONFIRMED' && (
                          <>
                            <button
                              onClick={() => openInspectModal(alert, 'VERIFIED')}
                              className="px-2.5 py-1 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded transition inline-flex items-center gap-1 shadow-sm"
                              title="Mark Correct & Trigger Green Corridor"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Correct
                            </button>
                            <button
                              onClick={() => openInspectModal(alert, 'FALSE_POSITIVE')}
                              className="px-2.5 py-1 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded transition inline-flex items-center gap-1 shadow-sm"
                              title="Mark Wrong & specify what this vehicle is"
                            >
                              <XCircle className="w-3.5 h-3.5 text-amber-700" />
                              Wrong
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400 text-xs">
                    No priority emergency alerts recorded in this category.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspection & Operator Verification Modal */}
      {inspectAlert && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 flex-shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">
                      Emergency Vehicle Optical Dossier & Verification
                    </h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                      inspectAlert.verification_status === 'VERIFIED'
                        ? 'bg-green-100 text-green-800'
                        : inspectAlert.verification_status === 'FALSE_POSITIVE'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-red-100 text-red-800 animate-pulse'
                    }`}>
                      {inspectAlert.verification_status}
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-slate-500">Alert Ref: {inspectAlert.id} • Optical Node #01</p>
                </div>
              </div>
              <button
                onClick={() => setInspectAlert(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
                title="Close modal"
              >
                <span className="text-lg font-bold px-1.5 leading-none">✕</span>
              </button>
            </div>

            {/* Modal Body: Two Columns */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Optical Snapshot & AI Telemetry */}
              <div className="lg:col-span-7 space-y-3.5 flex flex-col">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-blue-600" />
                    Optical Evidence & Flagged Target
                  </span>
                  <span className="text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-600 animate-ping"></span>
                    Target Vehicle Marked on Snapshot
                  </span>
                </div>

                {/* Snapshot Image Box */}
                <div className="bg-slate-950 rounded-xl overflow-hidden relative border border-slate-800 flex items-center justify-center min-h-[280px] max-h-[400px] group shadow-inner">
                  {inspectAlert.snapshot_url ? (
                    <>
                      <img
                        src={inspectAlert.snapshot_url}
                        alt="Vehicle Snapshot"
                        className="w-full h-full object-contain max-h-[400px]"
                      />
                      {/* Top-left target badge */}
                      <div className="absolute top-2.5 left-2.5 bg-red-600/90 backdrop-blur-xs text-white px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 shadow-md border border-red-400/40">
                        <Siren className="w-3.5 h-3.5 animate-bounce" />
                        <span>FLAGGED: {inspectAlert.vehicle_type.replace('_', ' ').toUpperCase()} ({(inspectAlert.confidence * 100).toFixed(1)}%)</span>
                      </div>
                      {/* Top-right external view */}
                      <a
                        href={inspectAlert.snapshot_url}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute top-2.5 right-2.5 bg-slate-900/80 hover:bg-slate-900 text-white px-2 py-1 rounded-md text-xs transition opacity-80 group-hover:opacity-100 flex items-center gap-1"
                        title="Open full resolution snapshot in new tab"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span className="text-[10px] hidden sm:inline">Full Res</span>
                      </a>
                      {/* Bottom target indicator note */}
                      <div className="absolute bottom-2 left-2 right-2 bg-black/65 backdrop-blur-xs text-white/90 px-3 py-1.5 rounded-md text-[11px] flex items-center justify-between border border-white/10">
                        <span className="flex items-center gap-1.5">
                          <span>🎯</span>
                          <span>Target vehicle highlighted with tactical red box & neon brackets</span>
                        </span>
                        <span className="font-mono text-slate-400 text-[10px]">1080p Stream Frame</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-slate-400 text-center p-6">
                      <Siren className="w-10 h-10 text-red-500 mx-auto mb-2 opacity-60" />
                      Optical snapshot unavailable for this detection event
                    </div>
                  )}
                </div>

                {/* Incident Telemetry Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="text-slate-500 text-[10px] block font-sans">DETECTED CLASS:</span>
                    <span className="font-bold text-red-700 capitalize text-sm">{inspectAlert.vehicle_type.replace('_', ' ')}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="text-slate-500 text-[10px] block font-sans">OPTICAL CONFIDENCE:</span>
                    <span className="font-bold text-slate-800 text-sm">{(inspectAlert.confidence * 100).toFixed(1)}%</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="text-slate-500 text-[10px] block font-sans">CORRIDOR LANE:</span>
                    <span className="font-bold text-slate-800 truncate block text-sm" title={inspectAlert.lane_name}>{inspectAlert.lane_name}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="text-slate-500 text-[10px] block font-sans">DETECTION TIME:</span>
                    <span className="font-bold text-slate-800 text-sm">{new Date(inspectAlert.created_at).toLocaleTimeString('en-IN')}</span>
                  </div>
                </div>

                {/* Recommended Pre-emption Action */}
                <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-lg text-xs flex items-start gap-2.5 text-blue-950">
                  <Zap className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-blue-900 mb-0.5">Automated Traffic Pre-emption Recommendation:</div>
                    <div className="text-blue-800 leading-relaxed">{inspectAlert.recommended_action}</div>
                  </div>
                </div>
              </div>

              {/* Right Column: Operator Verification Assessment */}
              <div className="lg:col-span-5 space-y-4 flex flex-col justify-between">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-2 uppercase tracking-wide">
                      1. Operator Verification Assessment:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
                      {/* Option A: Correct */}
                      <button
                        type="button"
                        onClick={() => {
                          setVerificationDecision('VERIFIED');
                          setFormError(null);
                        }}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          verificationDecision === 'VERIFIED'
                            ? 'border-green-600 bg-green-50/90 ring-2 ring-green-500/30'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle className={`w-4 h-4 ${verificationDecision === 'VERIFIED' ? 'text-green-700' : 'text-slate-400'}`} />
                          <span className={`text-xs font-bold ${verificationDecision === 'VERIFIED' ? 'text-green-900' : 'text-slate-800'}`}>
                            Correct Identification
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 leading-tight">
                          Confirmed emergency priority vehicle. Authorize green wave corridor.
                        </p>
                      </button>

                      {/* Option B: Wrong */}
                      <button
                        type="button"
                        onClick={() => {
                          setVerificationDecision('FALSE_POSITIVE');
                          if (!actualVehicleType) setActualVehicleType('Car / Sedan');
                          setFormError(null);
                        }}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          verificationDecision === 'FALSE_POSITIVE'
                            ? 'border-amber-600 bg-amber-50/90 ring-2 ring-amber-500/30'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <XCircle className={`w-4 h-4 ${verificationDecision === 'FALSE_POSITIVE' ? 'text-amber-700' : 'text-slate-400'}`} />
                          <span className={`text-xs font-bold ${verificationDecision === 'FALSE_POSITIVE' ? 'text-amber-900' : 'text-slate-800'}`}>
                            Wrong Identification
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 leading-tight">
                          Misidentified civilian or regular vehicle. Mark false positive.
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* If Wrong: Category Presets & Operator Note */}
                  {verificationDecision === 'FALSE_POSITIVE' ? (
                    <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-lg space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-amber-950 mb-1.5 flex items-center justify-between">
                          <span>What is this vehicle actually?</span>
                          <span className="text-[10px] font-normal text-amber-800">(Select actual category)</span>
                        </label>
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {VEHICLE_TYPE_PRESETS.map((vt) => {
                            const isSelected = actualVehicleType === vt.label;
                            return (
                              <button
                                key={vt.label}
                                type="button"
                                onClick={() => {
                                  setActualVehicleType(vt.label);
                                  if (!operatorNotes || operatorNotes.startsWith('Civilian')) {
                                    setOperatorNotes(`Civilian ${vt.label.split('/')[0].trim()} falsely flagged as ${inspectAlert.vehicle_type.replace('_', ' ')}`);
                                  }
                                }}
                                className={`px-2.5 py-1 rounded text-xs font-medium transition flex items-center gap-1 border ${
                                  isSelected
                                    ? 'bg-amber-600 text-white border-amber-700 font-bold shadow-xs'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-100/50'
                                }`}
                              >
                                <span>{vt.icon}</span>
                                <span>{vt.label}</span>
                              </button>
                            );
                          })}
                        </div>

                        {actualVehicleType === 'Other' && (
                          <input
                            type="text"
                            value={customVehicleType}
                            onChange={(e) => setCustomVehicleType(e.target.value)}
                            placeholder="Specify custom vehicle type (e.g. Electric Cart, Construction Crane)..."
                            className="mt-2 w-full p-2 bg-white border border-amber-300 rounded text-xs text-slate-800 focus:outline-blue-600"
                          />
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-amber-950 mb-1">
                          Correction Note / Operator Comment:
                        </label>
                        <textarea
                          rows={3}
                          value={operatorNotes}
                          onChange={(e) => setOperatorNotes(e.target.value)}
                          placeholder="Describe what this vehicle is (e.g., White civilian SUV with roof carrier, regular pickup truck headlights, standard commercial van without siren)..."
                          className="w-full p-2 bg-white border border-amber-300 rounded text-xs text-slate-800 focus:outline-blue-600"
                        />
                        <p className="text-[10px] text-amber-800 mt-0.5">
                          Permanently recorded in the incident verification audit log.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Green Corridor Dispatch Notes (Optional):
                      </label>
                      <textarea
                        rows={3}
                        value={operatorNotes}
                        onChange={(e) => setOperatorNotes(e.target.value)}
                        placeholder="Log dispatcher notes, junction clearance status, or green corridor verification details..."
                        className="w-full p-2 border border-slate-300 rounded text-xs text-slate-800 focus:outline-blue-600"
                      />
                    </div>
                  )}

                  {formError && (
                    <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 sm:px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-shrink-0 text-xs">
              <button
                type="button"
                onClick={() => setInspectAlert(null)}
                className="px-4 py-2 rounded-lg font-semibold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 transition"
              >
                Close Dossier
              </button>

              <div className="flex items-center gap-2">
                {verificationDecision === 'VERIFIED' ? (
                  <button
                    type="button"
                    onClick={handleSubmitVerification}
                    disabled={submitting}
                    className="px-4 py-2 rounded-lg font-bold text-white bg-green-700 hover:bg-green-800 transition shadow-sm inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Confirm Correct & Dispatch Corridor</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmitVerification}
                    disabled={submitting}
                    className="px-4 py-2 rounded-lg font-bold text-white bg-amber-700 hover:bg-amber-800 transition shadow-sm inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Confirm Wrong & Save Correction</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
