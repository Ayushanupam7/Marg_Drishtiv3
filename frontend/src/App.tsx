import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  FileVideo, 
  Video, 
  Split, 
  Siren, 
  Cpu, 
  History, 
  Settings as SettingsIcon,
  Shield
} from 'lucide-react';
import type { TabKey } from './types';
import { Header } from './components/Header';
import { OverviewTab } from './components/tabs/OverviewTab';
import { AnalysisTab } from './components/tabs/AnalysisTab';
import { CctvTab } from './components/tabs/CctvTab';
import { LanesTab } from './components/tabs/LanesTab';
import { EmergencyTab } from './components/tabs/EmergencyTab';
import { ModelTab } from './components/tabs/ModelTab';
import { HistoryTab } from './components/tabs/HistoryTab';
import { SettingsTab } from './components/tabs/SettingsTab';
import { fetchEmergencyAlerts } from './services/api';

const TABS: { key: TabKey; label: string; icon: React.FC<{ className?: string }> }[] = [
  { key: 'overview', label: 'Central Overview', icon: LayoutDashboard },
  { key: 'analysis', label: 'Video Analysis', icon: FileVideo },
  { key: 'cctv', label: 'CCTV Feeds', icon: Video },
  { key: 'lanes', label: 'Corridor ROI', icon: Split },
  { key: 'emergency', label: 'Emergencies', icon: Siren },
  { key: 'model', label: 'AI Model', icon: Cpu },
  { key: 'history', label: 'Audit & History', icon: History },
  { key: 'settings', label: 'Settings', icon: SettingsIcon },
];

export function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [unconfirmedEmergencies, setUnconfirmedEmergencies] = useState<number>(0);
  const [isAnalysisRunning, setIsAnalysisRunning] = useState<boolean>(false);

  // Poll emergency alert count for badge indicator
  useEffect(() => {
    const updateCount = async () => {
      try {
        const alerts = await fetchEmergencyAlerts('UNCONFIRMED');
        setUnconfirmedEmergencies(alerts.length);
      } catch {
        // Silently ignore background polling issues
      }
    };
    updateCount();
    const interval = setInterval(updateCount, 12000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#f4f6f9] text-[#1e293b] flex flex-col font-sans selection:bg-blue-200">
      {/* 1. Official National Gov Header */}
      <Header />

      {/* 2. Primary Navigation Bar */}
      <nav className="bg-[#09182d] border-b border-blue-900/60 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-1 overflow-x-auto py-1.5 no-scrollbar">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              const isEmergency = tab.key === 'emergency';
              const isAnalysis = tab.key === 'analysis';

              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all duration-150 relative ${
                    isActive
                      ? 'bg-[#183a64] text-white shadow-inner border border-blue-400/40'
                      : 'text-slate-300 hover:bg-[#122b4d] hover:text-white'
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      isEmergency && unconfirmedEmergencies > 0
                        ? 'text-red-400 animate-pulse'
                        : isAnalysis && isAnalysisRunning
                        ? 'text-emerald-400 animate-pulse'
                        : isActive
                        ? 'text-blue-300'
                        : 'text-slate-400'
                    }`}
                  />
                  <span>{tab.label}</span>

                  {/* Active Analysis Indicator Badge */}
                  {isAnalysis && isAnalysisRunning && (
                    <span className="ml-1 flex items-center gap-1 px-1.5 py-0.2 bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-mono font-bold rounded">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                      ACTIVE
                    </span>
                  )}

                  {/* Red Badge for Emergency Alerts */}
                  {isEmergency && unconfirmedEmergencies > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 bg-red-600 text-white text-[10px] font-bold rounded-full animate-bounce">
                      {unconfirmedEmergencies}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* 3. Main Dashboard Workspace Content - Preserved Across Tab Switching */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        <div className={activeTab === 'overview' ? 'block' : 'hidden'}>
          <OverviewTab onNavigateTab={setActiveTab} />
        </div>
        <div className={activeTab === 'analysis' ? 'block' : 'hidden'}>
          <AnalysisTab onProcessingStateChange={setIsAnalysisRunning} />
        </div>
        <div className={activeTab === 'cctv' ? 'block' : 'hidden'}>
          <CctvTab />
        </div>
        <div className={activeTab === 'lanes' ? 'block' : 'hidden'}>
          <LanesTab />
        </div>
        <div className={activeTab === 'emergency' ? 'block' : 'hidden'}>
          <EmergencyTab />
        </div>
        <div className={activeTab === 'model' ? 'block' : 'hidden'}>
          <ModelTab />
        </div>
        <div className={activeTab === 'history' ? 'block' : 'hidden'}>
          <HistoryTab onNavigateTab={setActiveTab} />
        </div>
        <div className={activeTab === 'settings' ? 'block' : 'hidden'}>
          <SettingsTab />
        </div>
      </main>

      {/* 4. Official Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-blue-700" />
            <span className="font-semibold text-slate-700">MARG DRISHTI (मार्ग दृष्टि)</span>
            <span>• National Intelligent Traffic Surveillance & Green Corridor Management Platform</span>
          </div>

          <div className="flex items-center space-x-4 text-[11px] font-mono text-slate-400">
            <span>NODE: NODE-DL-HQ-01</span>
            <span>API: 8000 (OPERATIONAL)</span>
            <span>© Ministry of Road Transport & Highways</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
