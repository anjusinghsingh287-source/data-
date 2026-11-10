import React, { useState, useMemo } from 'react';
import { CleanRecord } from '../types';
import {
  SUBNATIONAL_ENTITIES,
  StateEntity,
  generateCuratedSubnationalRecords,
} from '../data/subnationalData';
import { CURATED_INDICATORS } from '../data/worldBankData';
import {
  MapPin,
  TrendingUp,
  BarChart3,
  Layers,
  ArrowUpDown,
  Search,
  Sparkles,
  Download,
  Building,
  Check,
  ChevronRight,
  ChevronDown,
  Globe2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
} from 'recharts';

interface SubnationalSegregationViewProps {
  cleanRecords: CleanRecord[];
  onLoadSubnationalData: () => void;
  onExportCsv: (format: 'long' | 'wide') => void;
}

export const SubnationalSegregationView: React.FC<SubnationalSegregationViewProps> = ({
  cleanRecords,
  onLoadSubnationalData,
  onExportCsv,
}) => {
  // Check how many records have state data
  const stateRecords = useMemo(() => {
    return cleanRecords.filter((r) => Boolean(r.state));
  }, [cleanRecords]);

  const hasSubnationalData = stateRecords.length > 0;

  // Countries present in the state records
  const availableCountries = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of stateRecords) {
      if (!map.has(r.country_iso3)) {
        map.set(r.country_iso3, r.country_name);
      }
    }
    return Array.from(map.entries()).map(([iso3, name]) => ({ iso3, name }));
  }, [stateRecords]);

  // Available indicators
  const availableIndicators = useMemo(() => {
    return Array.from(new Set(stateRecords.map((r) => r.indicator_code)));
  }, [stateRecords]);

  // Available years
  const availableYears = useMemo(() => {
    return Array.from(new Set(stateRecords.map((r) => r.year))).sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
  }, [stateRecords]);

  // Filters state
  const [selectedCountry, setSelectedCountry] = useState<string>('USA');
  const [selectedIndicator, setSelectedIndicator] = useState<string>('NY.GDP.PCAP.CD');
  const [selectedYear, setSelectedYear] = useState<string>('2024');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [searchState, setSearchState] = useState<string>('');
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set(['USA', 'IND']));

  // Update defaults if loaded country is different
  React.useEffect(() => {
    if (availableCountries.length > 0 && !availableCountries.some((c) => c.iso3 === selectedCountry)) {
      setSelectedCountry(availableCountries[0].iso3);
    }
    if (availableIndicators.length > 0 && !availableIndicators.includes(selectedIndicator)) {
      setSelectedIndicator(availableIndicators[0]);
    }
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableCountries, availableIndicators, availableYears]);

  // Metadata for selected indicator
  const indicatorMeta = CURATED_INDICATORS.find((i) => i.code === selectedIndicator);

  // Compute National benchmark average for the selected country and indicator in this year
  const nationalBenchmark = useMemo(() => {
    // 1. Check if an explicit national record exists (without state)
    const natRecord = cleanRecords.find(
      (r) => r.country_iso3 === selectedCountry && !r.state && r.indicator_code === selectedIndicator && r.year === selectedYear
    );
    if (natRecord) return natRecord.value;

    // 2. Otherwise compute weighted or arithmetic average of states
    const statesInCountry = stateRecords.filter(
      (r) => r.country_iso3 === selectedCountry && r.indicator_code === selectedIndicator && r.year === selectedYear
    );
    if (statesInCountry.length === 0) return 0;
    const avg = statesInCountry.reduce((acc, r) => acc + r.value, 0) / statesInCountry.length;
    return Number(avg.toFixed(2));
  }, [cleanRecords, stateRecords, selectedCountry, selectedIndicator, selectedYear]);

  // Filter and sort state data for chart
  const stateChartData = useMemo(() => {
    const matching = stateRecords.filter((r) => {
      const matchCountry = selectedCountry === 'ALL' || r.country_iso3 === selectedCountry;
      const matchInd = r.indicator_code === selectedIndicator;
      const matchYr = r.year === selectedYear;
      const matchSearch = !searchState || (r.state && r.state.toLowerCase().includes(searchState.toLowerCase()));
      return matchCountry && matchInd && matchYr && matchSearch;
    });

    const items = matching.map((r) => {
      const stateMeta = SUBNATIONAL_ENTITIES.find((s) => s.country_iso3 === r.country_iso3 && s.state === r.state);
      const deltaVsNational = nationalBenchmark > 0 ? ((r.value - nationalBenchmark) / nationalBenchmark) * 100 : 0;

      return {
        state: r.state || 'Unknown State',
        stateCode: stateMeta?.state_code || '',
        country: r.country_name,
        countryIso3: r.country_iso3,
        value: r.value,
        nationalBenchmark,
        deltaVsNational: Number(deltaVsNational.toFixed(1)),
        capital: stateMeta?.capital || '',
        population: stateMeta?.population || undefined,
      };
    });

    items.sort((a, b) => (sortOrder === 'desc' ? b.value - a.value : a.value - b.value));
    return items;
  }, [stateRecords, selectedCountry, selectedIndicator, selectedYear, searchState, sortOrder, nationalBenchmark]);

  // Summary statistics across states
  const summary = useMemo(() => {
    if (stateChartData.length === 0) return null;
    const values = stateChartData.map((d) => d.value);
    const highest = stateChartData[sortOrder === 'desc' ? 0 : stateChartData.length - 1];
    const lowest = stateChartData[sortOrder === 'desc' ? stateChartData.length - 1 : 0];
    const ratio = lowest.value > 0 ? (highest.value / lowest.value).toFixed(2) : 'N/A';

    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance);
    const cv = mean > 0 ? ((std / mean) * 100).toFixed(1) : '0';

    return {
      highest,
      lowest,
      ratio,
      cv,
      count: stateChartData.length,
    };
  }, [stateChartData, sortOrder]);

  // Group all state records hierarchically by Country -> State
  const hierarchicalData = useMemo(() => {
    const countriesMap: Record<
      string,
      {
        countryIso3: string;
        countryName: string;
        states: Record<
          string,
          {
            stateName: string;
            capital?: string;
            population?: number;
            indicators: Record<string, number>;
          }
        >;
      }
    > = {};

    for (const r of stateRecords) {
      if (r.year !== selectedYear) continue;
      if (!r.state) continue;

      if (!countriesMap[r.country_iso3]) {
        countriesMap[r.country_iso3] = {
          countryIso3: r.country_iso3,
          countryName: r.country_name,
          states: {},
        };
      }

      if (!countriesMap[r.country_iso3].states[r.state]) {
        const meta = SUBNATIONAL_ENTITIES.find((s) => s.country_iso3 === r.country_iso3 && s.state === r.state);
        countriesMap[r.country_iso3].states[r.state] = {
          stateName: r.state,
          capital: meta?.capital,
          population: meta?.population,
          indicators: {},
        };
      }

      countriesMap[r.country_iso3].states[r.state].indicators[r.indicator_code] = r.value;
    }

    return Object.values(countriesMap);
  }, [stateRecords, selectedYear]);

  const toggleCountryExpand = (iso3: string) => {
    setExpandedCountries((prev) => {
      const next = new Set(prev);
      if (next.has(iso3)) next.delete(iso3);
      else next.add(iso3);
      return next;
    });
  };

  if (!hasSubnationalData) {
    return (
      <div className="bg-white p-8 md:p-12 rounded-lg border border-slate-200 text-center space-y-6">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto border border-blue-100 shadow-sm">
          <Layers className="w-8 h-8" />
        </div>

        <div className="max-w-xl mx-auto space-y-2">
          <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
            Sub-National Architecture
          </span>
          <h2 className="text-xl font-bold text-slate-900">
            Segregate & Disaggregate Data by Country & State
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Examine regional disparities, state-level GDP per capita, employment, population distributions, and inter-state inequality within sovereign federations.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onLoadSubnationalData}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
          >
            <Sparkles className="w-4 h-4" />
            <span>Load Curated Sub-National State Panel (USA, India, Germany, Brazil)</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto pt-6 border-t border-slate-100 text-left">
          <div className="p-4 bg-slate-50 rounded border border-slate-200">
            <span className="text-xs font-bold text-slate-900 block">USA States (BEA & BLS)</span>
            <p className="text-[11px] text-slate-500 mt-1">
              California, Texas, New York, Florida, Washington, Ohio with state GDP and unemployment.
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded border border-slate-200">
            <span className="text-xs font-bold text-slate-900 block">India States (RBI & MoSPI)</span>
            <p className="text-[11px] text-slate-500 mt-1">
              Maharashtra, Tamil Nadu, Karnataka, Gujarat, UP, Kerala with NSDP per capita and literacy.
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded border border-slate-200">
            <span className="text-xs font-bold text-slate-900 block">Germany & Brazil</span>
            <p className="text-[11px] text-slate-500 mt-1">
              Bavaria, Baden-Württemberg, Berlin, São Paulo, Rio de Janeiro state indicators.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Scope Controls Bar */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
                Sub-National Segregation Engine
              </span>
              <span className="text-xs text-slate-400">·</span>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {stateRecords.length.toLocaleString()} state-level observations
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-0.5">
              Country & State Disaggregation Analysis
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onExportCsv('long')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export State Dataset</span>
            </button>
          </div>
        </div>

        {/* Filter dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
              Sovereign Federation
            </label>
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="w-full px-3 py-1.5 text-xs text-slate-900 bg-slate-50 border border-slate-300 rounded font-medium focus:bg-white"
            >
              <option value="ALL">All Available Countries</option>
              {availableCountries.map((c) => (
                <option key={c.iso3} value={c.iso3}>
                  {c.name} ({c.iso3})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
              Empirical Indicator
            </label>
            <select
              value={selectedIndicator}
              onChange={(e) => setSelectedIndicator(e.target.value)}
              className="w-full px-3 py-1.5 text-xs text-slate-900 bg-slate-50 border border-slate-300 rounded font-medium focus:bg-white truncate"
            >
              {availableIndicators.map((code) => {
                const meta = CURATED_INDICATORS.find((i) => i.code === code);
                return (
                  <option key={code} value={code}>
                    {code} - {meta?.name || code}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
              Observation Year
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full px-3 py-1.5 text-xs text-slate-900 bg-slate-50 border border-slate-300 rounded font-medium focus:bg-white"
            >
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  Year {yr}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
              State Search & Rank Sort
            </label>
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchState}
                  onChange={(e) => setSearchState(e.target.value)}
                  placeholder="Filter state..."
                  className="w-full pl-7 pr-2 py-1.5 text-xs text-slate-900 bg-slate-50 border border-slate-300 rounded focus:bg-white"
                />
              </div>
              <button
                type="button"
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                className="p-1.5 rounded border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700"
                title={`Sort ${sortOrder === 'desc' ? 'High to Low' : 'Low to High'}`}
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Disparity KPI Strip */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Highest State ({summary.highest.state})
            </span>
            <div className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {summary.highest.value >= 1000 ? summary.highest.value.toLocaleString() : summary.highest.value.toFixed(1)}
              <span className="text-xs font-normal text-slate-500 ml-1 font-sans">
                {indicatorMeta?.unit || ''}
              </span>
            </div>
            <span className="text-[11px] text-emerald-600 font-mono tabular-nums block mt-0.5">
              +{summary.highest.deltaVsNational}% vs National Avg
            </span>
          </div>

          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Lowest State ({summary.lowest.state})
            </span>
            <div className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {summary.lowest.value >= 1000 ? summary.lowest.value.toLocaleString() : summary.lowest.value.toFixed(1)}
              <span className="text-xs font-normal text-slate-500 ml-1 font-sans">
                {indicatorMeta?.unit || ''}
              </span>
            </div>
            <span className="text-[11px] text-amber-600 font-mono tabular-nums block mt-0.5">
              {summary.lowest.deltaVsNational}% vs National Avg
            </span>
          </div>

          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              State Disparity Ratio (Max/Min)
            </span>
            <div className="text-xl font-bold text-blue-700 font-mono tabular-nums mt-1">
              {summary.ratio}x
            </div>
            <span className="text-[11px] text-slate-500 font-sans block mt-0.5">
              Inter-state spread across {summary.count} states
            </span>
          </div>

          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              National Reference Benchmark
            </span>
            <div className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {nationalBenchmark >= 1000 ? nationalBenchmark.toLocaleString() : nationalBenchmark.toFixed(1)}
              <span className="text-xs font-normal text-slate-500 ml-1 font-sans">
                {indicatorMeta?.unit || ''}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-mono block mt-0.5">
              CV: {summary.cv}% inequality
            </span>
          </div>
        </div>
      )}

      {/* Main Bar Chart: State Ranking against National Benchmark */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              State-by-State Disparity vs National Average Benchmark
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Dotted red line indicates sovereign national baseline ({nationalBenchmark.toLocaleString()} {indicatorMeta?.unit}).
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-blue-600 rounded" />
              <span>Above National Avg</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-amber-500 rounded" />
              <span>Below National Avg</span>
            </div>
          </div>
        </div>

        {stateChartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-xs text-slate-400">
            No state records found for the selected combination.
          </div>
        ) : (
          <div className="h-96 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stateChartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="state"
                  tick={{ fontSize: 11, fill: '#475569' }}
                  interval={0}
                  angle={-35}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const isAbove = data.value >= nationalBenchmark;
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl text-xs space-y-1.5 border border-slate-800">
                          <div className="font-bold flex items-center justify-between gap-4">
                            <span>{data.state}</span>
                            <span className="text-slate-400 font-mono">{data.countryIso3}</span>
                          </div>
                          {data.capital && (
                            <div className="text-[11px] text-slate-300">
                              Capital: {data.capital}
                            </div>
                          )}
                          <div className="text-sm font-bold font-mono text-blue-300">
                            {data.value.toLocaleString()} {indicatorMeta?.unit}
                          </div>
                          <div className="pt-1 border-t border-slate-800 text-[11px] flex items-center justify-between gap-3 font-mono">
                            <span className="text-slate-400">vs National Avg:</span>
                            <span className={isAbove ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                              {data.deltaVsNational > 0 ? `+${data.deltaVsNational}%` : `${data.deltaVsNational}%`}
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {nationalBenchmark > 0 && (
                  <ReferenceLine
                    y={nationalBenchmark}
                    stroke="#dc2626"
                    strokeDasharray="4 4"
                    label={{
                      value: `National Avg: ${nationalBenchmark.toLocaleString()}`,
                      fill: '#dc2626',
                      fontSize: 10,
                      position: 'top',
                    }}
                  />
                )}
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {stateChartData.map((entry, index) => {
                    const isAbove = entry.value >= nationalBenchmark;
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={isAbove ? '#2563eb' : '#f59e0b'}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Hierarchical Country > State Accordion Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden space-y-4 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Country & State Hierarchical Panel (Year {selectedYear})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Click any country to expand and examine its constituent states and provinces.
            </p>
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-500">
            {hierarchicalData.reduce((acc, c) => acc + Object.keys(c.states).length, 0)} states loaded
          </div>
        </div>

        <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
          {hierarchicalData.map((country) => {
            const isExpanded = expandedCountries.has(country.countryIso3);
            const statesList = Object.values(country.states);

            return (
              <div key={country.countryIso3} className="bg-white">
                {/* Country Header Row */}
                <button
                  type="button"
                  onClick={() => toggleCountryExpand(country.countryIso3)}
                  className="w-full px-4 py-3 bg-slate-50/90 hover:bg-slate-100 flex items-center justify-between transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    )}
                    <span className="font-mono text-xs font-bold text-blue-700 px-1.5 py-0.5 bg-blue-50 border border-blue-200 rounded">
                      {country.countryIso3}
                    </span>
                    <span className="text-sm font-bold text-slate-900">
                      {country.countryName}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      ({statesList.length} states / provinces)
                    </span>
                  </div>

                  <span className="text-xs text-blue-600 font-medium">
                    {isExpanded ? 'Collapse' : 'Expand States'}
                  </span>
                </button>

                {/* State Sub-Rows Table */}
                {isExpanded && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/70 border-y border-slate-200 font-semibold text-slate-600">
                        <tr>
                          <th className="py-2.5 px-4">State / Province</th>
                          <th className="py-2.5 px-4">Administrative Capital</th>
                          <th className="py-2.5 px-4 text-right">Population</th>
                          {availableIndicators.map((indCode) => {
                            const meta = CURATED_INDICATORS.find((i) => i.code === indCode);
                            return (
                              <th key={indCode} className="py-2.5 px-4 text-right">
                                {meta?.name ? meta.name.split(',')[0] : indCode}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono tabular-nums text-slate-700">
                        {statesList.map((state) => (
                          <tr key={state.stateName} className="hover:bg-blue-50/40 transition-colors">
                            <td className="py-2 px-4 font-sans font-semibold text-slate-900 flex items-center gap-2">
                              <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span>{state.stateName}</span>
                            </td>
                            <td className="py-2 px-4 font-sans text-slate-500">
                              {state.capital || '-'}
                            </td>
                            <td className="py-2 px-4 text-right text-slate-600">
                              {state.population ? `${(state.population / 1000000).toFixed(1)}M` : '-'}
                            </td>
                            {availableIndicators.map((indCode) => {
                              const val = state.indicators[indCode];
                              return (
                                <td key={indCode} className="py-2 px-4 text-right font-bold text-slate-900">
                                  {val !== undefined ? (val >= 1000 ? val.toLocaleString() : val.toFixed(1)) : '-'}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
