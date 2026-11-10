import React, { useRef, useEffect } from 'react';
import { Play, Square, RotateCcw, ArrowRight, CheckCircle2, AlertCircle, Database, Terminal } from 'lucide-react';
import { ProgressCallbackData } from '../services/worldBankService';
import { ScheduleConfig } from '../services/scheduleService';
import { QuarterlySyncCard } from './QuarterlySyncCard';

interface CollectStepProps {
  isCollecting: boolean;
  onStartCollection: () => void;
  onStopCollection: () => void;
  onLoadPrecached: () => void;
  progress: ProgressCallbackData | null;
  logs: string[];
  rawCount: number;
  selectedIndicatorsCount: number;
  yearsSpan: number;
  countriesCount: number;
  onProceed: () => void;
  hasData: boolean;
  scheduleConfig: ScheduleConfig;
  onUpdateScheduleConfig: (config: ScheduleConfig) => void;
  onTriggerQuarterlySync: () => void;
  selectedIndicators: string[];
  startYear: number;
  endYear: number;
}

export const CollectStep: React.FC<CollectStepProps> = ({
  isCollecting,
  onStartCollection,
  onStopCollection,
  onLoadPrecached,
  progress,
  logs,
  rawCount,
  selectedIndicatorsCount,
  yearsSpan,
  countriesCount,
  onProceed,
  hasData,
  scheduleConfig,
  onUpdateScheduleConfig,
  onTriggerQuarterlySync,
  selectedIndicators,
  startYear,
  endYear,
}) => {
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const pct =
    progress && progress.totalIndicators > 0
      ? Math.round(
          ((progress.indicatorIndex - 1 + (progress.totalPages > 0 ? progress.page / progress.totalPages : 0)) /
            progress.totalIndicators) *
            100
        )
      : hasData
      ? 100
      : 0;

  return (
    <div className="space-y-8 pb-12">
      {/* Editorial Title Section */}
      <div className="border-b border-slate-200 pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-blue-700 tracking-wider uppercase">
            Step 2 · Data Ingestion
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Collect Raw Indicator Panels
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Query the live World Bank Open Data API (`api.worldbank.org/v2`), stream multi-page JSON payloads, and extract observations into an uncleaned raw panel buffer.
          </p>
        </div>

        {hasData && (
          <button
            onClick={onProceed}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm self-start md:self-auto shrink-0"
          >
            <span>Proceed to Clean ({rawCount.toLocaleString()} rows)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Automated Quarterly Sync Harvester (Every 3 Months) */}
      <QuarterlySyncCard
        scheduleConfig={scheduleConfig}
        onUpdateScheduleConfig={onUpdateScheduleConfig}
        onTriggerSyncNow={onTriggerQuarterlySync}
        isCollecting={isCollecting}
        selectedIndicators={selectedIndicators}
        startYear={startYear}
        endYear={endYear}
      />

      {/* Control Panel */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              World Bank Harvest Engine
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
              <span>{selectedIndicatorsCount} indicators</span>
              <span aria-hidden="true">·</span>
              <span>{countriesCount} countries</span>
              <span aria-hidden="true">·</span>
              <span>{yearsSpan} years span</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!isCollecting ? (
              <>
                <button
                  onClick={onStartCollection}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Execute Live API Harvest</span>
                </button>
                <button
                  onClick={onLoadPrecached}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Load Benchmark Reference Cache</span>
                </button>
              </>
            ) : (
              <button
                onClick={onStopCollection}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-red-600 rounded hover:bg-red-700 transition-colors shadow-sm"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Cancel Harvest</span>
              </button>
            )}
          </div>
        </div>

        {/* Real-time Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-600">
            <span>
              {isCollecting && progress ? (
                <>
                  Harvesting indicator <strong className="text-blue-700">{progress.indicator}</strong> ({progress.indicatorIndex}/{progress.totalIndicators}) · Page {progress.page}/{progress.totalPages}
                </>
              ) : hasData ? (
                <>Collection complete · {rawCount.toLocaleString()} observations stored</>
              ) : (
                <>Awaiting collection trigger</>
              )}
            </span>
            <span className="font-semibold text-slate-900">{pct}%</span>
          </div>

          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            <div
              className={`h-full transition-all duration-300 ${
                isCollecting ? 'bg-blue-600' : hasData ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
            />
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          <div className="bg-slate-50 p-3.5 rounded border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Raw Observations
            </span>
            <span className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-1 block">
              {rawCount.toLocaleString()}
            </span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Active Indicators
            </span>
            <span className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-1 block">
              {progress ? `${progress.indicatorIndex} / ${progress.totalIndicators}` : selectedIndicatorsCount}
            </span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              API Pagination Status
            </span>
            <span className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-1 block">
              {progress ? `Page ${progress.page} / ${progress.totalPages}` : 'Idle'}
            </span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Source Protocol
            </span>
            <span className="text-sm font-semibold text-blue-700 font-mono mt-1 block truncate">
              api.worldbank.org/v2
            </span>
          </div>
        </div>
      </div>

      {/* Researcher Console Terminal */}
      <div className="bg-slate-950 text-slate-100 rounded-lg border border-slate-800 overflow-hidden shadow-lg">
        <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-mono font-medium text-slate-300">
              Collector Execution Terminal (Urllib / REST Stream)
            </span>
          </div>
          <div className="text-[11px] font-mono text-slate-400 tabular-nums">
            {logs.length} lines logged
          </div>
        </div>

        <div className="p-4 font-mono text-xs leading-relaxed max-h-72 overflow-y-auto space-y-1 text-slate-300 selection:bg-blue-600 selection:text-white">
          {logs.length === 0 ? (
            <div className="text-slate-500 italic">
              Terminal ready. Click "Execute Live API Harvest" or "Load Benchmark Reference Cache" to begin data stream.
            </div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="flex gap-2 font-mono">
                <span className="text-slate-600 select-none text-[10px] pt-0.5">{index + 1}</span>
                <span className={log.includes('Warning') || log.includes('error') ? 'text-amber-400' : log.includes('[START]') ? 'text-blue-400 font-bold' : log.includes('Complete') ? 'text-emerald-400 font-bold' : 'text-slate-300'}>
                  {log}
                </span>
              </div>
            ))
          )}
          <div ref={terminalEndRef} />
        </div>
      </div>
    </div>
  );
};
