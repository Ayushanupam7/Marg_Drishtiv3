import React from 'react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const norm = status.toUpperCase();

  let bg = 'bg-slate-100';
  let text = 'text-slate-700';
  let border = 'border-slate-300';

  if (norm === 'LOW' || norm === 'COMPLETED' || norm === 'ONLINE' || norm === 'VERIFIED') {
    bg = 'bg-green-50';
    text = 'text-green-800 font-semibold';
    border = 'border-green-300';
  } else if (norm === 'MODERATE' || norm === 'PROCESSING' || norm === 'CONNECTING') {
    bg = 'bg-amber-50';
    text = 'text-amber-800 font-semibold';
    border = 'border-amber-300';
  } else if (norm === 'HIGH' || norm === 'UNCONFIRMED') {
    bg = 'bg-orange-50';
    text = 'text-orange-800 font-semibold';
    border = 'border-orange-300';
  } else if (norm === 'SEVERE' || norm === 'FAILED' || norm === 'OFFLINE' || norm === 'ERROR' || norm === 'FALSE_POSITIVE') {
    bg = 'bg-red-50';
    text = 'text-red-800 font-semibold';
    border = 'border-red-300';
  }

  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span className={`inline-flex items-center rounded border ${bg} ${text} ${border} ${padding}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-80" />
      {status}
    </span>
  );
};
