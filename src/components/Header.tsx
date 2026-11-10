import React from 'react';
import { Database, Download, RefreshCw, FileText } from 'lucide-react';

interface HeaderProps {
  activeStep: number;
  setActiveStep: (step: number) => void;
  cleanCount: number;
  isCollecting: boolean;
  onQuickExport: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeStep,
  setActiveStep,
  cleanCount,
  isCollecting,
  onQuickExport,
}) => {
  const steps = [
    { id: 1, label: 'Define' },
    { id: 2, label: 'Collect' },
    { id: 3, label: 'Clean' },
    { id: 4, label: 'Quality Check' },
    { id: 5, label: 'Visualize' },
    { id: 6, label: 'Export' },
    { id: 7, label: 'AI/ML Papers & Feeds', isSpecial: true },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
        {/* Zone 1: Brand wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded bg-slate-900 text-white flex items-center justify-center font-bold text-sm tracking-tight">
            WB
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
            Global Data Studio
          </span>
        </div>

        {/* Zone 2: Navigation Links for Pipeline Steps */}
        <nav className="hidden md:flex items-center gap-1 overflow-x-auto py-1">
          {steps.map((s) => {
            const isActive = activeStep === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActiveStep(s.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white font-semibold'
                    : s.isSpecial
                    ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold border border-blue-200/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {!s.isSpecial && <span className="tabular-nums opacity-60 text-[10px]">{s.id}.</span>}
                {s.isSpecial && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />}
                <span>{s.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          {isCollecting && (
            <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 px-2.5 py-1 rounded">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span className="whitespace-nowrap font-medium">Collecting API Data...</span>
            </div>
          )}

          <button
            onClick={onQuickExport}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded hover:bg-slate-800 transition-colors whitespace-nowrap shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV ({cleanCount.toLocaleString()})</span>
          </button>
        </div>
      </div>
    </header>
  );
};
