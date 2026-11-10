import React, { useState, useMemo } from 'react';
import { QualityReportData, IndicatorSummaryStat, CleanRecord } from '../types';
import {
  FileCheck,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Calendar,
  Search,
  ArrowUpDown,
  AlertTriangle,
  ShieldAlert,
  SlidersHorizontal,
  Info,
  Filter,
} from 'lucide-react';
import { calculateYoYGrowth } from '../utils/growthUtils';
import { detectAnomalies, AnomalyRecord } from '../utils/anomalyUtils';
import { TrendBadge } from './TrendBadge';

interface QualityStepProps {
  qualityReport: QualityReportData;
  indicatorStats: IndicatorSummaryStat[];
  cleanRecords: CleanRecord[];
  onProceed: () => void;
}

export const QualityStep: React.FC<QualityStepProps> = ({
  qualityReport,
  indicatorStats,
  cleanRecords,
  onProceed,
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'yoy' | 'anomalies' | 'missingness'>('summary');

  // Compute Year-over-Year growth dataset analysis
  const yoyAnalysis = useMemo(() => calculateYoYGrowth(cleanRecords), [cleanRecords]);

  // Anomaly Detection State
  const [anomalySigma, setAnomalySigma] = useState<number>(3.0);
  const [selectedAnomalyIndicator, setSelectedAnomalyIndicator] = useState<string>('');
  const [selectedAnomalyDirection, setSelectedAnomalyDirection] = useState<'all' | 'positive' | 'negative'>('all');
  const [selectedAnomalySeverity, setSelectedAnomalySeverity] = useState<'all' | 'moderate' | 'extreme' | 'critical'>('all');
  const [anomalySearchQuery, setAnomalySearchQuery] = useState<string>('');
  const [anomalySortBy, setAnomalySortBy] = useState<'zScoreAbs' | 'zScoreDesc' | 'zScoreAsc' | 'yearDesc' | 'country'>('zScoreAbs');

  // Active anomaly detection analysis based on chosen threshold
  const anomalyAnalysis = useMemo(() => {
    return detectAnomalies(cleanRecords, anomalySigma, indicatorStats);
  }, [cleanRecords, anomalySigma, indicatorStats]);

  // Standard 3.0σ analysis for baseline header KPIs and badge counts
  const standardAnomalyAnalysis = useMemo(() => {
    if (anomalySigma === 3.0) return anomalyAnalysis;
    return detectAnomalies(cleanRecords, 3.0, indicatorStats);
  }, [cleanRecords, anomalySigma, anomalyAnalysis, indicatorStats]);

  // Inspector state for YoY tab
  const [selectedYoYIndicator, setSelectedYoYIndicator] = useState<string>(() => {
    return indicatorStats[0]?.code || '';
  });
  const [selectedYoYYear, setSelectedYoYYear] = useState<string>('all');
  const [yoySearchQuery, setYoySearchQuery] = useState<string>('');
  const [yoySortAsc, setYoySortAsc] = useState<boolean>(false);

  // Available transition years for the selected indicator
  const transitionYearsForIndicator = useMemo(() => {
    const list = yoyAnalysis.recordsWithYoY
      .filter((r) => !selectedYoYIndicator || r.indicator_code === selectedYoYIndicator)
      .map((r) => r.year);
    return Array.from(new Set(list)).sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
  }, [yoyAnalysis, selectedYoYIndicator]);

  // Filtered country/state YoY transition records for microdata inspection
  const filteredYoYRecords = useMemo(() => {
    let list = yoyAnalysis.recordsWithYoY.filter((r) => {
      const matchInd = !selectedYoYIndicator || r.indicator_code === selectedYoYIndicator;
      const matchYr = selectedYoYYear === 'all' || r.year === selectedYoYYear;
      const matchSearch =
        !yoySearchQuery ||
        r.country_name.toLowerCase().includes(yoySearchQuery.toLowerCase()) ||
        r.country_iso3.toLowerCase().includes(yoySearchQuery.toLowerCase()) ||
        (r.state && r.state.toLowerCase().includes(yoySearchQuery.toLowerCase()));
      return matchInd && matchYr && matchSearch;
    });

    list.sort((a, b) => (yoySortAsc ? a.yoyPct - b.yoyPct : b.yoyPct - a.yoyPct));
    return list;
  }, [yoyAnalysis, selectedYoYIndicator, selectedYoYYear, yoySearchQuery, yoySortAsc]);

  // Filtered anomalies for microdata inspection
  const filteredAnomalies = useMemo(() => {
    let list = anomalyAnalysis.anomalies.filter((a) => {
      const matchInd = !selectedAnomalyIndicator || a.indicator_code === selectedAnomalyIndicator;
      const matchDir =
        selectedAnomalyDirection === 'all' || a.deviationDirection === selectedAnomalyDirection;
      const matchSev =
        selectedAnomalySeverity === 'all' || a.severity === selectedAnomalySeverity;
      const matchSearch =
        !anomalySearchQuery ||
        a.country_name.toLowerCase().includes(anomalySearchQuery.toLowerCase()) ||
        a.country_iso3.toLowerCase().includes(anomalySearchQuery.toLowerCase()) ||
        (a.state && a.state.toLowerCase().includes(anomalySearchQuery.toLowerCase())) ||
        a.year.includes(anomalySearchQuery) ||
        a.indicator_code.toLowerCase().includes(anomalySearchQuery.toLowerCase());

      return matchInd && matchDir && matchSev && matchSearch;
    });

    list.sort((a, b) => {
      if (anomalySortBy === 'zScoreAbs') {
        return Math.abs(b.zScore) - Math.abs(a.zScore);
      } else if (anomalySortBy === 'zScoreDesc') {
        return b.zScore - a.zScore;
      } else if (anomalySortBy === 'zScoreAsc') {
        return a.zScore - b.zScore;
      } else if (anomalySortBy === 'yearDesc') {
        return parseInt(b.year, 10) - parseInt(a.year, 10);
      } else {
        return a.country_name.localeCompare(b.country_name);
      }
    });

    return list;
  }, [
    anomalyAnalysis,
    selectedAnomalyIndicator,
    selectedAnomalyDirection,
    selectedAnomalySeverity,
    anomalySearchQuery,
    anomalySortBy,
  ]);

  // Identify fastest expanding indicator
  const fastestIndicator = useMemo(() => {
    const summaries = Object.values(yoyAnalysis.byIndicator);
    if (summaries.length === 0) return null;
    return summaries.reduce((best, curr) => {
      const bestVal = best.latestAvgYoY ?? -Infinity;
      const currVal = curr.latestAvgYoY ?? -Infinity;
      return currVal > bestVal ? curr : best;
    }, summaries[0]);
  }, [yoyAnalysis]);

  // Compute country coverage matrix for missingness
  const allCountries = Array.from(new Set(cleanRecords.map((r) => r.country_iso3))).slice(0, 15);
  const allIndicators = Array.from(new Set(cleanRecords.map((r) => r.indicator_code)));

  return (
    <div className="space-y-8 pb-12">
      {/* Editorial Title Section */}
      <div className="border-b border-slate-200 pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-blue-700 tracking-wider uppercase">
            Step 4 · Econometric Quality Audit
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Data Quality Report & Panel Diagnostics
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Evaluate panel balance, distributional moments, statistical anomaly alerts (&gt;3σ), and YoY growth momentum before empirical estimation.
          </p>
        </div>

        <button
          onClick={onProceed}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm self-start md:self-auto shrink-0 cursor-pointer"
        >
          <span>Explore Visualizations & Charts</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Primary Academic Quality Report Card */}
      <div className="bg-slate-900 text-white rounded-lg p-6 border border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 font-mono text-sm font-bold tracking-wider text-slate-200">
            <FileCheck className="w-4 h-4 text-emerald-400" />
            <span>OFFICIAL QUALITY REPORT</span>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Source: World Bank Open Data & Panel Engine
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 font-mono tabular-nums">
          <div>
            <span className="text-[11px] text-slate-400 block uppercase">Rows Collected</span>
            <span className="text-xl font-bold text-slate-100 block mt-0.5">
              {qualityReport.raw_n.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block uppercase">Rows Kept</span>
            <span className="text-xl font-bold text-emerald-400 block mt-0.5">
              {qualityReport.clean_n.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block uppercase">Missing / Dup</span>
            <span className="text-xl font-bold text-amber-400 block mt-0.5">
              {qualityReport.removed_n.toLocaleString()} ({(qualityReport.missing_ratio * 100).toFixed(1)}%)
            </span>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block uppercase">Countries</span>
            <span className="text-xl font-bold text-slate-100 block mt-0.5">
              {qualityReport.countries_covered}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block uppercase">Year Range</span>
            <span className="text-xl font-bold text-slate-100 block mt-0.5">
              {qualityReport.year_min} to {qualityReport.year_max}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block uppercase">Panel Balance</span>
            <span className={`text-xl font-bold block mt-0.5 ${qualityReport.panel_balance_score >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {qualityReport.panel_balance_score}%
            </span>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block uppercase">YoY Momentum</span>
            <div className="mt-1 flex items-center">
              <TrendBadge
                value={yoyAnalysis.overallLatestYoY}
                size="md"
                title={`Average YoY Growth across indicators in the latest consecutive period: ${yoyAnalysis.overallLatestYoY !== null ? (yoyAnalysis.overallLatestYoY > 0 ? '+' : '') + yoyAnalysis.overallLatestYoY.toFixed(1) + '%' : 'N/A'}`}
              />
            </div>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block uppercase">3σ Anomaly Alerts</span>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className={`text-xl font-bold ${standardAnomalyAnalysis.totalAnomalies > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {standardAnomalyAnalysis.totalAnomalies}
              </span>
              {standardAnomalyAnalysis.totalAnomalies > 0 ? (
                <span className="text-[10px] text-amber-300 font-sans">
                  ({standardAnomalyAnalysis.anomalyRatePct.toFixed(1)}%)
                </span>
              ) : (
                <span className="text-[10px] text-emerald-300 font-sans">0 clean</span>
              )}
            </div>
          </div>
        </div>

        {/* Diagnostic Panel Balance & Outlier Notice */}
        <div className="pt-3 border-t border-slate-800 text-xs font-sans text-slate-300 space-y-2">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              {qualityReport.panel_balance_score >= 80 ? (
                <>
                  <strong className="text-white">Robust Panel Structure:</strong> This dataset exhibits strong cross-sectional and temporal continuity with <strong className="text-emerald-300">{yoyAnalysis.totalTransitions.toLocaleString()} YoY annual transitions</strong> available for first-differenced and fixed-effects estimation.
                </>
              ) : (
                <>
                  <strong className="text-white">Unbalanced Longitudinal Panel:</strong> Certain indicators have periodic reporting intervals. Fixed-effects regressions will automatically restrict to balanced subsamples ({yoyAnalysis.totalTransitions.toLocaleString()} YoY transitions tracked).
                </>
              )}
            </p>
          </div>

          {standardAnomalyAnalysis.totalAnomalies > 0 && (
            <div className="flex items-start gap-2.5 text-amber-200/90 bg-amber-950/40 p-2.5 rounded border border-amber-900/60">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed text-xs">
                <strong className="text-amber-300">Statistical Outlier Alert:</strong> Flagged{' '}
                <strong className="text-white font-mono">{standardAnomalyAnalysis.totalAnomalies} observations</strong> exceeding 3 standard deviations from their series mean across {standardAnomalyAnalysis.affectedCountriesCount} countries.{' '}
                <button
                  onClick={() => setActiveTab('anomalies')}
                  className="text-amber-300 underline font-semibold hover:text-white transition-colors cursor-pointer ml-1 inline-flex items-center gap-0.5"
                >
                  Review in Anomaly Console &rarr;
                </button>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Quality Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors cursor-pointer ${
            activeTab === 'summary'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Descriptive Statistics (Moments)
        </button>

        <button
          onClick={() => setActiveTab('anomalies')}
          className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
            activeTab === 'anomalies'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <AlertTriangle className={`w-3.5 h-3.5 ${standardAnomalyAnalysis.totalAnomalies > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
          <span>Anomaly Alerts (&gt;3σ)</span>
          <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono tabular-nums ${
            standardAnomalyAnalysis.totalAnomalies > 0
              ? activeTab === 'anomalies' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-amber-100 text-amber-800 font-semibold'
              : activeTab === 'anomalies' ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-600'
          }`}>
            {standardAnomalyAnalysis.totalAnomalies}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('yoy')}
          className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
            activeTab === 'yoy'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>YoY Growth Dynamics & Trends</span>
          <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono tabular-nums ${
            activeTab === 'yoy' ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-700'
          }`}>
            {yoyAnalysis.totalTransitions}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('missingness')}
          className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors cursor-pointer ${
            activeTab === 'missingness'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Country Reporting Matrix
        </button>
      </div>

      {/* Tab 1: Descriptive Statistics Table with YoY Trend Badges and Outlier Flag Column */}
      {activeTab === 'summary' && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden space-y-4 p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Summary Distributional Statistics & Outlier Flags
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Computed across all clean observations in the sample with latest Year-over-Year momentum and &gt;3σ anomaly indicators.
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-400">
              N = {indicatorStats.length} Series
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 font-mono">Series Code</th>
                  <th className="py-2.5 px-3">Indicator Description</th>
                  <th className="py-2.5 px-3 font-mono text-center">YoY Trend</th>
                  <th className="py-2.5 px-3 font-mono text-center">Outliers (&gt;3σ)</th>
                  <th className="py-2.5 px-3 text-right font-mono">Obs (N)</th>
                  <th className="py-2.5 px-3 text-right font-mono">Mean (x̄)</th>
                  <th className="py-2.5 px-3 text-right font-mono">Std Dev (s)</th>
                  <th className="py-2.5 px-3 text-right font-mono">Min</th>
                  <th className="py-2.5 px-3 text-right font-mono">P25</th>
                  <th className="py-2.5 px-3 text-right font-mono">Median</th>
                  <th className="py-2.5 px-3 text-right font-mono">P75</th>
                  <th className="py-2.5 px-3 text-right font-mono">Max</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums text-slate-700">
                {indicatorStats.map((stat) => {
                  const yoyInfo = yoyAnalysis.byIndicator[stat.code];
                  const yoyVal = stat.latestYoY ?? yoyInfo?.latestAvgYoY;
                  const anomCount = standardAnomalyAnalysis.byIndicator[stat.code]?.totalAnomalies || 0;

                  return (
                    <tr key={stat.code} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 font-bold text-blue-700 whitespace-nowrap">{stat.code}</td>
                      <td className="py-3 px-3 font-sans font-medium text-slate-900 max-w-[200px] truncate" title={stat.name}>
                        {stat.name}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <TrendBadge
                          value={yoyVal}
                          size="sm"
                          periodLabel={yoyInfo?.latestYearPair}
                          title={`${stat.name}: Latest YoY growth is ${yoyVal !== null && yoyVal !== undefined ? (yoyVal > 0 ? '+' : '') + yoyVal.toFixed(1) + '%' : 'N/A'}${yoyInfo?.latestYearPair ? ` (${yoyInfo.latestYearPair})` : ''}`}
                        />
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {anomCount > 0 ? (
                          <button
                            onClick={() => {
                              setSelectedAnomalyIndicator(stat.code);
                              setActiveTab('anomalies');
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono font-bold rounded bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                            title={`Inspect ${anomCount} statistical anomalies (>3σ) for ${stat.name}`}
                          >
                            <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>{anomCount} flagged</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-mono">0 clean</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-900">{stat.count.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right text-slate-900">
                        {stat.mean >= 10000 ? stat.mean.toLocaleString(undefined, { maximumFractionDigits: 1 }) : stat.mean.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600">
                        {stat.std >= 10000 ? stat.std.toLocaleString(undefined, { maximumFractionDigits: 1 }) : stat.std.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600">
                        {stat.min >= 10000 ? stat.min.toLocaleString(undefined, { maximumFractionDigits: 1 }) : stat.min.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600">
                        {stat.p25 >= 10000 ? stat.p25.toLocaleString(undefined, { maximumFractionDigits: 1 }) : stat.p25.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">
                        {stat.median >= 10000 ? stat.median.toLocaleString(undefined, { maximumFractionDigits: 1 }) : stat.median.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600">
                        {stat.p75 >= 10000 ? stat.p75.toLocaleString(undefined, { maximumFractionDigits: 1 }) : stat.p75.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-900">
                        {stat.max >= 10000 ? stat.max.toLocaleString(undefined, { maximumFractionDigits: 1 }) : stat.max.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Anomaly Alert & Outlier Diagnostic Workbench */}
      {activeTab === 'anomalies' && (
        <div className="space-y-6">
          {/* Top Control: Sensitivity Threshold Selector */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  Statistical Anomaly Threshold (Sigma Sensitivity)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Anomalies are detected by calculating standardized z-scores <code className="text-slate-700 font-mono">z = (x - μ) / σ</code> per indicator series.
                </p>
              </div>

              {/* Threshold Buttons */}
              <div className="flex items-center gap-1.5 bg-white p-1 rounded border border-slate-200 text-xs">
                <button
                  onClick={() => setAnomalySigma(2.5)}
                  className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                    anomalySigma === 2.5
                      ? 'bg-slate-900 text-white font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  title="2.5 Sigma: Flags top 1.2% deviations"
                >
                  2.5σ (Sensitive)
                </button>
                <button
                  onClick={() => setAnomalySigma(3.0)}
                  className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                    anomalySigma === 3.0
                      ? 'bg-amber-600 text-white font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  title="3.0 Sigma: Canonical 99.7% Gaussian confidence rule"
                >
                  3.0σ (Standard)
                </button>
                <button
                  onClick={() => setAnomalySigma(3.5)}
                  className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                    anomalySigma === 3.5
                      ? 'bg-slate-900 text-white font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  title="3.5 Sigma: High confidence outliers"
                >
                  3.5σ (Stringent)
                </button>
                <button
                  onClick={() => setAnomalySigma(4.0)}
                  className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                    anomalySigma === 4.0
                      ? 'bg-slate-900 text-white font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  title="4.0 Sigma: Extreme structural shocks"
                >
                  4.0σ (Extreme)
                </button>
              </div>
            </div>
          </div>

          {/* Top 4 Macro Outlier KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Anomaly Count */}
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Total Anomalies (&gt;{anomalySigma}σ)
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className={`text-2xl font-bold font-mono tabular-nums ${anomalyAnalysis.totalAnomalies > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {anomalyAnalysis.totalAnomalies.toLocaleString()}
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  ({anomalyAnalysis.anomalyRatePct.toFixed(2)}% of sample)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Total observations deviating beyond {anomalySigma} standard deviations from mean.
              </p>
            </div>

            {/* Card 2: Peak Positive Surge */}
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Peak Positive Surge (Max +z)
              </span>
              {anomalyAnalysis.maxZScoreRecord && anomalyAnalysis.maxZScoreRecord.zScore > 0 ? (
                <div className="mt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xl font-bold font-mono text-amber-700">
                      +{anomalyAnalysis.maxZScoreRecord.zScore.toFixed(2)}σ
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      Year {anomalyAnalysis.maxZScoreRecord.year}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-900 truncate mt-0.5" title={anomalyAnalysis.maxZScoreRecord.country_name}>
                    {anomalyAnalysis.maxZScoreRecord.country_name}
                    {anomalyAnalysis.maxZScoreRecord.state && ` (${anomalyAnalysis.maxZScoreRecord.state})`}
                  </div>
                  <div className="text-[11px] font-mono text-blue-700 truncate" title={anomalyAnalysis.maxZScoreRecord.indicator_name}>
                    {anomalyAnalysis.maxZScoreRecord.indicator_code}
                  </div>
                </div>
              ) : (
                <div className="text-sm font-mono text-slate-400 mt-2">No positive outliers</div>
              )}
            </div>

            {/* Card 3: Deepest Negative Contraction */}
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Deepest Plunge (Min -z)
              </span>
              {anomalyAnalysis.minZScoreRecord && anomalyAnalysis.minZScoreRecord.zScore < 0 ? (
                <div className="mt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xl font-bold font-mono text-rose-700">
                      {anomalyAnalysis.minZScoreRecord.zScore.toFixed(2)}σ
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      Year {anomalyAnalysis.minZScoreRecord.year}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-900 truncate mt-0.5" title={anomalyAnalysis.minZScoreRecord.country_name}>
                    {anomalyAnalysis.minZScoreRecord.country_name}
                    {anomalyAnalysis.minZScoreRecord.state && ` (${anomalyAnalysis.minZScoreRecord.state})`}
                  </div>
                  <div className="text-[11px] font-mono text-blue-700 truncate" title={anomalyAnalysis.minZScoreRecord.indicator_name}>
                    {anomalyAnalysis.minZScoreRecord.indicator_code}
                  </div>
                </div>
              ) : (
                <div className="text-sm font-mono text-slate-400 mt-2">No negative outliers</div>
              )}
            </div>

            {/* Card 4: Affected Breadth */}
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Dispersal Across Sample
              </span>
              <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {anomalyAnalysis.affectedCountriesCount} countries
              </div>
              <div className="text-xs font-mono text-slate-500 mt-0.5">
                across {anomalyAnalysis.affectedIndicatorsCount} indicator series
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Cross-sectional spread of extreme statistical observations.
              </p>
            </div>
          </div>

          {/* Indicator Anomaly Breakdown Summary Cards */}
          {Object.keys(anomalyAnalysis.byIndicator).length > 0 && (
            <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Series-Level Anomaly Breakdown
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Number of outliers flagged per indicator with standard moments and directional breakdown.
                  </p>
                </div>
                {selectedAnomalyIndicator && (
                  <button
                    onClick={() => setSelectedAnomalyIndicator('')}
                    className="text-xs text-blue-600 hover:underline font-medium"
                  >
                    Reset Filter (Show All Series)
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {Object.values(anomalyAnalysis.byIndicator).map((indSummary) => {
                  const isSelected = selectedAnomalyIndicator === indSummary.indicator_code;
                  return (
                    <div
                      key={indSummary.indicator_code}
                      onClick={() => {
                        setSelectedAnomalyIndicator(
                          isSelected ? '' : indSummary.indicator_code
                        );
                      }}
                      className={`p-3 rounded border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-blue-700">
                          {indSummary.indicator_code}
                        </span>
                        <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-amber-100 text-amber-800">
                          {indSummary.totalAnomalies} flagged
                        </span>
                      </div>
                      <div className="font-medium text-slate-900 truncate mt-1 text-[11px]" title={indSummary.indicator_name}>
                        {indSummary.indicator_name}
                      </div>
                      <div className="mt-2 text-[10px] font-mono text-slate-500 flex items-center justify-between border-t border-slate-100 pt-1.5">
                        <span>μ: {indSummary.mean >= 1000 ? indSummary.mean.toLocaleString(undefined, { maximumFractionDigits: 0 }) : indSummary.mean.toFixed(1)}</span>
                        <span>σ: {indSummary.std >= 1000 ? indSummary.std.toLocaleString(undefined, { maximumFractionDigits: 0 }) : indSummary.std.toFixed(1)}</span>
                        <span className="text-amber-700 font-semibold">
                          +{indSummary.positiveAnomalies} / -{indSummary.negativeAnomalies}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Anomaly Microdata Inspector Grid */}
          <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Individual Anomaly Observations Microdata Table
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Detailed inspection of observations that exceed the {anomalySigma}σ statistical bound.
                </p>
              </div>

              {/* Filter Controls Toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Indicator Filter */}
                <select
                  value={selectedAnomalyIndicator}
                  onChange={(e) => setSelectedAnomalyIndicator(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded font-sans text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">All Series ({anomalyAnalysis.anomalies.length})</option>
                  {indicatorStats.map((ind) => {
                    const count = anomalyAnalysis.byIndicator[ind.code]?.totalAnomalies || 0;
                    return (
                      <option key={ind.code} value={ind.code}>
                        {ind.code} ({count} outliers)
                      </option>
                    );
                  })}
                </select>

                {/* Direction Filter */}
                <select
                  value={selectedAnomalyDirection}
                  onChange={(e) => setSelectedAnomalyDirection(e.target.value as any)}
                  className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded font-sans text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="all">All Directions</option>
                  <option value="positive">Positive Surges (+z &gt; {anomalySigma}σ)</option>
                  <option value="negative">Negative Plunges (-z &lt; -{anomalySigma}σ)</option>
                </select>

                {/* Severity Filter */}
                <select
                  value={selectedAnomalySeverity}
                  onChange={(e) => setSelectedAnomalySeverity(e.target.value as any)}
                  className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded font-sans text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="all">All Severities</option>
                  <option value="moderate">Moderate (3–4σ)</option>
                  <option value="extreme">Extreme (4–5σ)</option>
                  <option value="critical">Critical (&gt;5σ)</option>
                </select>

                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search country, state, year..."
                    value={anomalySearchQuery}
                    onChange={(e) => setAnomalySearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded font-sans text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
                  />
                </div>

                {/* Sort By */}
                <select
                  value={anomalySortBy}
                  onChange={(e) => setAnomalySortBy(e.target.value as any)}
                  className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded font-sans text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="zScoreAbs">Z-Score Magnitude (|z| High to Low)</option>
                  <option value="zScoreDesc">Most Positive (+z First)</option>
                  <option value="zScoreAsc">Most Negative (-z First)</option>
                  <option value="yearDesc">Most Recent Year</option>
                  <option value="country">Country Name (A-Z)</option>
                </select>
              </div>
            </div>

            {/* Results Table */}
            <div className="overflow-x-auto max-h-[440px] overflow-y-auto border border-slate-200 rounded">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0 border-b border-slate-200 z-10">
                  <tr>
                    <th className="py-2.5 px-3 font-mono">ISO3</th>
                    <th className="py-2.5 px-3">Geographic Entity</th>
                    <th className="py-2.5 px-3 font-mono text-center">Year</th>
                    <th className="py-2.5 px-3 font-mono">Series Code</th>
                    <th className="py-2.5 px-3 font-mono text-right">Observed Value</th>
                    <th className="py-2.5 px-3 font-mono text-right">Series Mean (x̄)</th>
                    <th className="py-2.5 px-3 font-mono text-right">Std Dev (s)</th>
                    <th className="py-2.5 px-3 font-mono text-center">Z-Score Deviation</th>
                    <th className="py-2.5 px-3 font-mono text-right">Delta from Mean (Δ)</th>
                    <th className="py-2.5 px-3 text-center">Severity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono tabular-nums text-slate-700">
                  {filteredAnomalies.slice(0, 100).map((a) => {
                    const isPos = a.deviationDirection === 'positive';
                    return (
                      <tr key={a.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-slate-900">{a.country_iso3}</td>
                        <td className="py-2.5 px-3 font-sans">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-slate-900">{a.country_name}</span>
                            {a.state && (
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-sans border border-slate-200">
                                {a.state}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-600 font-bold">{a.year}</td>
                        <td className="py-2.5 px-3 text-blue-700 font-medium whitespace-nowrap" title={a.indicator_name}>
                          {a.indicator_code}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                          {a.value >= 10000 ? a.value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : a.value.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-500">
                          {a.mean >= 10000 ? a.mean.toLocaleString(undefined, { maximumFractionDigits: 1 }) : a.mean.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-500">
                          {a.std >= 10000 ? a.std.toLocaleString(undefined, { maximumFractionDigits: 1 }) : a.std.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 font-mono text-[11px] font-bold px-2 py-0.5 rounded ${
                              isPos
                                ? a.severity === 'critical'
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : 'bg-amber-50 text-amber-800 border border-amber-200'
                                : a.severity === 'critical'
                                ? 'bg-rose-100 text-rose-900 border border-rose-300'
                                : 'bg-rose-50 text-rose-800 border border-rose-200'
                            }`}
                          >
                            {isPos ? (
                              <TrendingUp className="w-3 h-3 shrink-0 text-amber-700" />
                            ) : (
                              <TrendingDown className="w-3 h-3 shrink-0 text-rose-700" />
                            )}
                            <span>{isPos ? `+${a.zScore.toFixed(2)}σ` : `${a.zScore.toFixed(2)}σ`}</span>
                          </span>
                        </td>
                        <td className={`py-2.5 px-3 text-right font-medium ${isPos ? 'text-amber-800' : 'text-rose-800'}`}>
                          <span>{isPos ? '+' : ''}{a.absoluteDelta >= 10000 ? a.absoluteDelta.toLocaleString(undefined, { maximumFractionDigits: 0 }) : a.absoluteDelta.toFixed(1)}</span>
                          <span className="text-[10px] text-slate-400 block font-normal">
                            ({isPos ? '+' : ''}{a.pctDeltaFromMean.toFixed(1)}%)
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-mono uppercase font-bold rounded ${
                              a.severity === 'critical'
                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                : a.severity === 'extreme'
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {a.severity}
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredAnomalies.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-500 font-sans text-xs">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                        <span className="block font-medium text-slate-800">
                          No statistical outliers match the selected criteria (&gt;{anomalySigma}σ).
                        </span>
                        <span className="text-slate-400 text-[11px] block mt-0.5">
                          Try lowering the threshold to 2.5σ or resetting the series and direction filters.
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {filteredAnomalies.length > 100 && (
              <p className="text-[11px] text-slate-500 text-right font-mono">
                Showing top 100 of {filteredAnomalies.length} outliers. Refine by series or search term for micro-inspection.
              </p>
            )}
          </div>

          {/* Econometric Methodology & Outlier Treatment Guide */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 space-y-3 text-xs text-slate-600">
            <div className="flex items-center gap-2 text-slate-900 font-semibold">
              <Info className="w-4 h-4 text-blue-600" />
              <span>Econometric Treatment of 3σ Outliers in Empirical Research</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[11px] leading-relaxed">
              <div className="bg-white p-3 rounded border border-slate-200 space-y-1">
                <span className="font-bold text-slate-900 block">1. Natural Economic Shocks</span>
                <p className="text-slate-600">
                  Extreme values often reflect genuine real-world events: sovereign debt defaults, hyperinflation, pandemic lockdowns, or commodity price shocks (e.g., oil spikes).
                </p>
              </div>
              <div className="bg-white p-3 rounded border border-slate-200 space-y-1">
                <span className="font-bold text-slate-900 block">2. Robust Estimators</span>
                <p className="text-slate-600">
                  Instead of arbitrary row deletion, econometricians recommend using <strong>Huber-White heteroskedasticity-consistent standard errors</strong>, quantile regression, or winsorization at 1%/99%.
                </p>
              </div>
              <div className="bg-white p-3 rounded border border-slate-200 space-y-1">
                <span className="font-bold text-slate-900 block">3. Data Integrity & Re-basing</span>
                <p className="text-slate-600">
                  Cross-verify currency units (e.g. current vs constant US$) and verify whether sudden shifts correspond to national currency re-denominations or census baseline revisions.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: YoY Growth Dynamics & Trends Dedicated Section */}
      {activeTab === 'yoy' && (
        <div className="space-y-6">
          {/* Top 4 Macro Growth KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Global Panel Momentum
              </span>
              <div className="flex items-center gap-2 mt-2">
                <TrendBadge value={yoyAnalysis.overallLatestYoY} size="md" />
                <span className="text-xs text-slate-500">Cross-series avg</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Average Year-over-Year movement across all sampled series.
              </p>
            </div>

            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Total Annual Transitions
              </span>
              <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {yoyAnalysis.totalTransitions.toLocaleString()}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Consecutive <code className="text-slate-700">t → t+1</code> pairs evaluated for growth differentials.
              </p>
            </div>

            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Fastest Expanding Series
              </span>
              <div className="mt-1">
                <div className="text-sm font-bold text-slate-900 truncate" title={fastestIndicator?.indicator_name}>
                  {fastestIndicator?.indicator_name || 'N/A'}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <TrendBadge value={fastestIndicator?.latestAvgYoY} size="sm" periodLabel={fastestIndicator?.latestYearPair} />
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Positive Growth Share
              </span>
              <div className="text-xl font-bold font-mono tabular-nums text-emerald-600 mt-1">
                {yoyAnalysis.totalTransitions > 0
                  ? (
                      (yoyAnalysis.recordsWithYoY.filter((r) => r.yoyPct > 0.01).length /
                        yoyAnalysis.totalTransitions) *
                      100
                    ).toFixed(1) + '%'
                  : 'N/A'}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Proportion of country-year transitions showing positive expansion.
              </p>
            </div>
          </div>

          {/* Indicator-Level YoY Summary Table */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Indicator YoY Growth Dynamics Summary
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Aggregate Year-over-Year performance, growth shares, and country divergence extremes.
                </p>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Formula: ((V_t - V_t-1) / |V_t-1|) * 100
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 font-mono">Code</th>
                    <th className="py-2.5 px-3">Indicator Description</th>
                    <th className="py-2.5 px-3 font-mono text-center">Period</th>
                    <th className="py-2.5 px-3 font-mono text-center">Latest YoY</th>
                    <th className="py-2.5 px-3 font-mono text-center">Mean YoY</th>
                    <th className="py-2.5 px-3 text-center">Growth Distribution</th>
                    <th className="py-2.5 px-3">Peak Surge (Max)</th>
                    <th className="py-2.5 px-3">Deepest Contraction (Min)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono tabular-nums text-slate-700">
                  {Object.values(yoyAnalysis.byIndicator).map((indSummary) => (
                    <tr key={indSummary.indicator_code} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 font-bold text-blue-700">{indSummary.indicator_code}</td>
                      <td className="py-3 px-3 font-sans font-medium text-slate-900 max-w-[200px] truncate" title={indSummary.indicator_name}>
                        {indSummary.indicator_name}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-500 text-[11px] whitespace-nowrap">
                        {indSummary.latestYearPair}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <TrendBadge value={indSummary.latestAvgYoY} size="sm" />
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <TrendBadge value={indSummary.overallMeanYoY} size="sm" />
                      </td>
                      <td className="py-3 px-3 text-center min-w-[130px]">
                        <div className="flex items-center gap-1.5 justify-center">
                          <span className="text-[10px] text-emerald-600 font-semibold">{indSummary.positiveShare.toFixed(0)}%</span>
                          <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden flex">
                            <div
                              className="bg-emerald-500 h-full"
                              style={{ width: `${indSummary.positiveShare}%` }}
                              title={`Positive Growth: ${indSummary.positiveShare.toFixed(1)}%`}
                            />
                            <div
                              className="bg-rose-500 h-full"
                              style={{ width: `${indSummary.negativeShare}%` }}
                              title={`Contraction: ${indSummary.negativeShare.toFixed(1)}%`}
                            />
                          </div>
                          <span className="text-[10px] text-rose-600 font-semibold">{indSummary.negativeShare.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-sans text-xs">
                        {indSummary.maxSurgeCountry ? (
                          <div className="flex items-center gap-1.5">
                            <TrendBadge value={indSummary.maxSurgeCountry.yoyPct} size="xs" />
                            <span className="truncate max-w-[110px] text-slate-700 font-medium">
                              {indSummary.maxSurgeCountry.country_name}
                              {indSummary.maxSurgeCountry.state && ` (${indSummary.maxSurgeCountry.state})`}
                            </span>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 px-3 font-sans text-xs">
                        {indSummary.maxDeclineCountry ? (
                          <div className="flex items-center gap-1.5">
                            <TrendBadge value={indSummary.maxDeclineCountry.yoyPct} size="xs" />
                            <span className="truncate max-w-[110px] text-slate-700 font-medium">
                              {indSummary.maxDeclineCountry.country_name}
                              {indSummary.maxDeclineCountry.state && ` (${indSummary.maxDeclineCountry.state})`}
                            </span>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sub-national and Country Microdata YoY Inspection Grid */}
          <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Country & State-Level YoY Microdata Explorer
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Inspect annual transition deltas and growth rates for specific geographical units.
                </p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Indicator selector */}
                <select
                  value={selectedYoYIndicator}
                  onChange={(e) => setSelectedYoYIndicator(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded font-sans text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">All Indicators</option>
                  {indicatorStats.map((ind) => (
                    <option key={ind.code} value={ind.code}>
                      {ind.code} - {ind.name.slice(0, 30)}...
                    </option>
                  ))}
                </select>

                {/* Transition Year filter */}
                <select
                  value={selectedYoYYear}
                  onChange={(e) => setSelectedYoYYear(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded font-sans text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="all">All Available Years</option>
                  {transitionYearsForIndicator.map((yr) => (
                    <option key={yr} value={yr}>
                      Year {yr}
                    </option>
                  ))}
                </select>

                {/* Country/State Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search country or state..."
                    value={yoySearchQuery}
                    onChange={(e) => setYoySearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded font-sans text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 w-44"
                  />
                </div>

                {/* Sort Toggle */}
                <button
                  onClick={() => setYoySortAsc(!yoySortAsc)}
                  className="px-2.5 py-1.5 text-xs border border-slate-300 rounded text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1 font-sans cursor-pointer"
                  title="Toggle sort direction"
                >
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  <span>{yoySortAsc ? 'Ascending (Min First)' : 'Descending (Max First)'}</span>
                </button>
              </div>
            </div>

            {/* Results table */}
            <div className="overflow-x-auto max-h-[420px] overflow-y-auto border border-slate-200 rounded">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0 border-b border-slate-200 z-10">
                  <tr>
                    <th className="py-2 px-3 font-mono">ISO3</th>
                    <th className="py-2 px-3">Geographic Entity</th>
                    <th className="py-2 px-3 font-mono">Series</th>
                    <th className="py-2 px-3 font-mono text-center">Transition</th>
                    <th className="py-2 px-3 font-mono text-right">Prior (V_t-1)</th>
                    <th className="py-2 px-3 font-mono text-right">Current (V_t)</th>
                    <th className="py-2 px-3 font-mono text-right">Abs Change (Δ)</th>
                    <th className="py-2 px-3 font-mono text-center">YoY Trend Badge</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono tabular-nums text-slate-700">
                  {filteredYoYRecords.slice(0, 100).map((r, idx) => (
                    <tr key={`${r.country_iso3}_${r.state || 'nat'}_${r.year}_${r.indicator_code}_${idx}`} className="hover:bg-slate-50/70">
                      <td className="py-2 px-3 font-bold text-slate-900">{r.country_iso3}</td>
                      <td className="py-2 px-3 font-sans">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-slate-900">{r.country_name}</span>
                          {r.state && (
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-sans border border-slate-200">
                              {r.state}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-blue-700 font-medium">{r.indicator_code}</td>
                      <td className="py-2 px-3 text-center text-slate-500 text-[11px]">
                        {r.prevYear} → {r.year}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-600">
                        {r.prevValue >= 10000 ? r.prevValue.toLocaleString(undefined, { maximumFractionDigits: 1 }) : r.prevValue.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right font-medium text-slate-900">
                        {r.value >= 10000 ? r.value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : r.value.toFixed(2)}
                      </td>
                      <td className={`py-2 px-3 text-right font-semibold ${r.absoluteChange > 0 ? 'text-emerald-700' : r.absoluteChange < 0 ? 'text-rose-700' : 'text-slate-500'}`}>
                        {r.absoluteChange > 0 ? '+' : ''}
                        {r.absoluteChange >= 10000 ? r.absoluteChange.toLocaleString(undefined, { maximumFractionDigits: 1 }) : r.absoluteChange.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <TrendBadge value={r.yoyPct} size="sm" />
                      </td>
                    </tr>
                  ))}
                  {filteredYoYRecords.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 font-sans text-xs">
                        No YoY transition records matched the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {filteredYoYRecords.length > 100 && (
              <p className="text-[11px] text-slate-500 text-right font-mono">
                Showing first 100 of {filteredYoYRecords.length} transition records. Refine search or indicator to isolate specific series.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Country Reporting Matrix */}
      {activeTab === 'missingness' && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4 shadow-xs">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Cross-Country Reporting Density Grid
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Green cells denote complete series reporting; amber indicates partial or intermittent survey years.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-200">
              <thead className="bg-slate-100 text-slate-700 font-semibold">
                <tr>
                  <th className="py-2 px-3 border border-slate-200 font-mono">ISO3</th>
                  {allIndicators.map((ind) => (
                    <th key={ind} className="py-2 px-3 border border-slate-200 font-mono text-[11px]">
                      {ind}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {allCountries.map((iso3) => {
                  const countryRecs = cleanRecords.filter((r) => r.country_iso3 === iso3);
                  return (
                    <tr key={iso3} className="hover:bg-slate-50">
                      <td className="py-2 px-3 border border-slate-200 font-bold text-slate-900">{iso3}</td>
                      {allIndicators.map((ind) => {
                        const count = countryRecs.filter((r) => r.indicator_code === ind).length;
                        return (
                          <td
                            key={ind}
                            className={`py-2 px-3 border border-slate-200 text-center font-bold tabular-nums ${
                              count >= 4
                                ? 'bg-emerald-50 text-emerald-800'
                                : count > 0
                                ? 'bg-amber-50 text-amber-800'
                                : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            {count > 0 ? `${count} yrs` : 'None'}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
