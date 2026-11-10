import React, { useState } from 'react';
import {
  ScheduleConfig,
  saveScheduleConfig,
  generateGitHubActionsWorkflow,
  generateCrontabSyntax,
  generatePythonDaemonScript,
} from '../services/scheduleService';
import {
  Clock,
  Calendar,
  CheckCircle2,
  RefreshCw,
  Play,
  Download,
  Copy,
  Check,
  Code2,
  Terminal,
  FileCode,
  History,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface QuarterlySyncCardProps {
  scheduleConfig: ScheduleConfig;
  onUpdateScheduleConfig: (config: ScheduleConfig) => void;
  onTriggerSyncNow: () => void;
  isCollecting: boolean;
  selectedIndicators: string[];
  startYear: number;
  endYear: number;
}

export const QuarterlySyncCard: React.FC<QuarterlySyncCardProps> = ({
  scheduleConfig,
  onUpdateScheduleConfig,
  onTriggerSyncNow,
  isCollecting,
  selectedIndicators,
  startYear,
  endYear,
}) => {
  const [activeTab, setActiveTab] = useState<'status' | 'github' | 'cron' | 'python' | 'history'>('status');
  const [copiedCode, setCopiedCode] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  // Format dates
  const nextDate = new Date(scheduleConfig.nextSyncUtc);
  const lastDate = new Date(scheduleConfig.lastSyncUtc);

  // Days until next sync
  const daysUntilNext = Math.max(
    0,
    Math.round((nextDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );

  const handleToggleSchedule = () => {
    const updated = {
      ...scheduleConfig,
      enabled: !scheduleConfig.enabled,
    };
    saveScheduleConfig(updated);
    onUpdateScheduleConfig(updated);
  };

  const handleIntervalChange = (months: number) => {
    const nextDateObj = new Date();
    nextDateObj.setMonth(nextDateObj.getMonth() + months);

    const updated: ScheduleConfig = {
      ...scheduleConfig,
      intervalMonths: months,
      cadenceName: months === 3 ? 'Quarterly (Every 3 Months)' : `Every ${months} Months`,
      nextSyncUtc: nextDateObj.toISOString(),
    };
    saveScheduleConfig(updated);
    onUpdateScheduleConfig(updated);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const downloadFile = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const githubWorkflowCode = generateGitHubActionsWorkflow(selectedIndicators, startYear, endYear);
  const crontabSyntax = generateCrontabSyntax(selectedIndicators);
  const pythonDaemonCode = generatePythonDaemonScript(selectedIndicators, startYear);

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
      {/* Top Banner Header */}
      <div className="p-5 bg-gradient-to-r from-blue-900 to-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600/40 border border-blue-400/30 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-blue-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-tight text-white">
                Automated Quarterly Data Harvester (Every 3 Months)
              </h2>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded font-mono uppercase tracking-wider ${
                scheduleConfig.enabled
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-slate-700 text-slate-300 border border-slate-600'
              }`}>
                {scheduleConfig.enabled ? 'Schedule Active' : 'Schedule Paused'}
              </span>
            </div>
            <p className="text-xs text-blue-200/80 mt-0.5">
              Automatically queries World Bank Open Data API on a 90-day cadence to harvest the latest economic, demographic, and climate series.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={onTriggerSyncNow}
            disabled={isCollecting}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-slate-900 bg-white hover:bg-slate-100 rounded transition-colors shadow-sm disabled:opacity-50"
          >
            {isCollecting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                <span>Harvesting...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current text-blue-600" />
                <span>Sync Now</span>
              </>
            )}
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-slate-400 hover:text-white rounded transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-6 space-y-6">
          {/* Schedule Metrics Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 p-3.5 rounded border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Update Frequency
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-bold text-slate-900 font-mono">
                  {scheduleConfig.cadenceName}
                </span>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Next Scheduled Harvest
              </span>
              <div className="text-sm font-bold text-blue-700 font-mono tabular-nums mt-1 truncate">
                {nextDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                in ~{daysUntilNext} days ({Math.ceil(daysUntilNext / 30)} months)
              </span>
            </div>

            <div className="bg-slate-50 p-3.5 rounded border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Last Successful Sync
              </span>
              <div className="text-sm font-bold text-slate-900 font-mono tabular-nums mt-1 truncate">
                {lastDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
              </div>
              <span className="text-[10px] text-emerald-600 font-mono flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="w-3 h-3" />
                <span>Verified Clean</span>
              </span>
            </div>

            <div className="bg-slate-50 p-3.5 rounded border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Scheduled Automation
              </span>
              <div className="flex items-center gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={handleToggleSchedule}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    scheduleConfig.enabled ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      scheduleConfig.enabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className="text-xs font-semibold text-slate-700">
                  {scheduleConfig.enabled ? 'Enabled' : 'Paused'}
                </span>
              </div>
            </div>
          </div>

          {/* Sub-Tabs for Details & Deployment Options */}
          <div className="border-b border-slate-200">
            <div className="flex items-center gap-2 -mb-px overflow-x-auto text-xs font-medium">
              <button
                onClick={() => setActiveTab('status')}
                className={`py-2 px-3 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'status'
                    ? 'border-blue-600 text-blue-700 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Cadence & Triggers</span>
              </button>

              <button
                onClick={() => setActiveTab('github')}
                className={`py-2 px-3 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'github'
                    ? 'border-blue-600 text-blue-700 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>GitHub Actions (cron: 0 0 1 */3 *)</span>
              </button>

              <button
                onClick={() => setActiveTab('cron')}
                className={`py-2 px-3 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'cron'
                    ? 'border-blue-600 text-blue-700 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Linux Crontab</span>
              </button>

              <button
                onClick={() => setActiveTab('python')}
                className={`py-2 px-3 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'python'
                    ? 'border-blue-600 text-blue-700 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Python Background Daemon</span>
              </button>

              <button
                onClick={() => setActiveTab('history')}
                className={`py-2 px-3 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'history'
                    ? 'border-blue-600 text-blue-700 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Sync History ({scheduleConfig.history?.length || 0})</span>
              </button>
            </div>
          </div>

          {/* TAB 1: Cadence & Triggers */}
          {activeTab === 'status' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 rounded border border-slate-200">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Update Interval Configuration
                  </h3>
                  <p className="text-xs text-slate-600 mt-1">
                    Select how often the collector checks the World Bank API for updated sovereign observations:
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleIntervalChange(3)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded border transition-colors ${
                      scheduleConfig.intervalMonths === 3
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Every 3 Months (Quarterly)
                  </button>

                  <button
                    onClick={() => handleIntervalChange(1)}
                    className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                      scheduleConfig.intervalMonths === 1
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Monthly (1 Mo)
                  </button>

                  <button
                    onClick={() => handleIntervalChange(6)}
                    className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                      scheduleConfig.intervalMonths === 6
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Semi-Annual (6 Mo)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600">
                <div className="p-4 rounded border border-slate-200 bg-white space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>World Bank Release Alignment</span>
                  </div>
                  <p className="leading-relaxed text-slate-500">
                    The World Bank updates its World Development Indicators (WDI) four times per year (April, July, September/October, and December). A 3-month cadence captures every primary database release without redundant bandwidth usage.
                  </p>
                </div>

                <div className="p-4 rounded border border-slate-200 bg-white space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    <span>In-Browser Automatic Re-Sync</span>
                  </div>
                  <p className="leading-relaxed text-slate-500">
                    Whenever you reopen this application and 3 months (90 days) have elapsed since the last sync, the studio automatically initiates a background check against the API and updates your data panel.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GitHub Actions Workflow */}
          {activeTab === 'github' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    GitHub Actions Cron Schedule (`.github/workflows/quarterly_sync.yml`)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Commit this file to your GitHub repository to automate the 3-month collector in the cloud with zero server maintenance.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(githubWorkflowCode)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 transition-colors"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'Copied' : 'Copy YAML'}</span>
                  </button>

                  <button
                    onClick={() => downloadFile('quarterly_data_update.yml', githubWorkflowCode, 'text/yaml')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Workflow</span>
                  </button>
                </div>
              </div>

              <pre className="p-4 bg-slate-950 text-slate-100 rounded border border-slate-800 font-mono text-xs overflow-x-auto leading-relaxed max-h-80 selection:bg-blue-600 selection:text-white">
                {githubWorkflowCode}
              </pre>
            </div>
          )}

          {/* TAB 3: Linux Crontab */}
          {activeTab === 'cron' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Crontab Automation (`0 0 1 */3 *`)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Add this line to your server or workstation crontab (`crontab -e`) to execute the Python script automatically every 3 months.
                  </p>
                </div>

                <button
                  onClick={() => copyToClipboard(crontabSyntax)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 transition-colors"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Copied' : 'Copy Crontab'}</span>
                </button>
              </div>

              <pre className="p-4 bg-slate-950 text-slate-100 rounded border border-slate-800 font-mono text-xs overflow-x-auto leading-relaxed selection:bg-blue-600 selection:text-white">
                {crontabSyntax}
              </pre>
            </div>
          )}

          {/* TAB 4: Python Daemon */}
          {activeTab === 'python' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Continuous Python Daemon (`quarterly_collector_daemon.py`)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Self-contained background script using Python standard library to run continuous 90-day sleep and harvest cycles.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(pythonDaemonCode)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 transition-colors"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'Copied' : 'Copy Python'}</span>
                  </button>

                  <button
                    onClick={() => downloadFile('quarterly_collector_daemon.py', pythonDaemonCode, 'text/x-python')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Daemon</span>
                  </button>
                </div>
              </div>

              <pre className="p-4 bg-slate-950 text-slate-100 rounded border border-slate-800 font-mono text-xs overflow-x-auto leading-relaxed max-h-80 selection:bg-blue-600 selection:text-white">
                {pythonDaemonCode}
              </pre>
            </div>
          )}

          {/* TAB 5: History */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Quarterly Sync Audit Log
              </h3>
              <div className="border border-slate-200 rounded overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                    <tr>
                      <th className="py-2 px-3">Date (UTC)</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3 text-right">Rows</th>
                      <th className="py-2 px-3">Message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                    {(scheduleConfig.history || []).map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 tabular-nums">
                          {new Date(item.timestamp).toLocaleString()}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                            item.status === 'success' ? 'text-emerald-600' : 'text-red-600'
                          }`}>
                            <CheckCircle2 className="w-3 h-3" />
                            <span className="uppercase">{item.status}</span>
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums font-bold">
                          {item.recordsCount.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 font-sans text-slate-600">
                          {item.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
