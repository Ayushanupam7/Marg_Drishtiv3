import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export const Header: React.FC = () => {
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'Asia/Kolkata'
      };
      // Format Indian Standard Time
      setTimeStr(now.toLocaleString('en-IN', options) + ' IST');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="bg-[#09182d] text-white border-b border-blue-900/40 px-4 sm:px-6 py-2.5 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Brand & Department */}
        <div className="flex items-center space-x-3.5">
          {/* Subtle national chakra geometric motif */}
          <div className="w-10 h-10 rounded bg-[#132c52] border border-blue-400/30 flex items-center justify-center text-blue-200">
            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-none stroke-current stroke-2">
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="3" />
              <path d="M12 3v6M12 15v6M3 12h6M15 12h6M5.6 5.6l4.2 4.2M14.2 14.2l4.2 4.2M5.6 18.4l4.2-4.2M14.2 9.8l4.2-4.2" />
            </svg>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight text-white">
                MARG DRISHTI
              </h1>
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-900/80 text-blue-200 border border-blue-700/50">
                मार्ग दृष्टि
              </span>
            </div>
            <p className="text-xs text-slate-300 font-medium">
              Traffic Monitoring & Management Directorate • AI-Based Smart Traffic Management System
            </p>
          </div>
        </div>

        {/* Right Info: Clock & System Status */}
        <div className="flex items-center space-x-4 self-end md:self-auto">
          {/* Real-time Clock */}
          <div className="hidden sm:flex items-center space-x-1.5 text-xs text-slate-200 bg-[#122845] px-3 py-1.5 rounded border border-blue-800/40">
            <Clock className="w-3.5 h-3.5 text-blue-300" />
            <span className="font-mono tracking-tight">{timeStr || 'Loading clock...'}</span>
          </div>

          {/* Node Status */}
          <div className="flex items-center space-x-2 bg-[#081a30] px-3 py-1.5 rounded border border-blue-900/80">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <div className="text-left">
              <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 leading-none">
                SYSTEM ONLINE
              </div>
              <div className="text-[9px] text-slate-400 font-mono leading-tight">
                NODE #01 • YOLOv8 ACTIVE
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
