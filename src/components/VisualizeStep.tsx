import React, { useState, useMemo, useEffect } from 'react';
import { CleanRecord, WorldBankIndicator } from '../types';
import { CURATED_INDICATORS, WORLD_BANK_REGIONS } from '../data/worldBankData';
import { VisualizeSidebar } from './VisualizeSidebar';
import { SubnationalSegregationView } from './SubnationalSegregationView';
import {
  TrendingUp,
  ScatterChart,
  BarChart3,
  Table as TableIcon,
  Search,
  ArrowRight,
  Download,
  Activity,
  Globe,
  Calendar,
  SlidersHorizontal,
  Filter,
  RotateCcw,
  Layers,
  MapPin,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';

interface VisualizeStepProps {
  cleanRecords: CleanRecord[];
  onProceed: () => void;
  onExportCsv: (format: 'long' | 'wide') => void;
  onLoadSubnationalData?: () => void;
}

export const VisualizeStep: React.FC<VisualizeStepProps> = ({
  cleanRecords,
  onProceed,
  onExportCsv,
  onLoadSubnationalData,
}) => {
  const [viewMode, setViewMode] = useState<
    'trends' | 'regional' | 'subnational' | 'scatter' | 'timeseries' | 'datagrid'
  >('trends');

  // Indicators available in dataset
  const availableIndicatorCodes = useMemo(() => {
    return Array.from(new Set(cleanRecords.map((r) => r.indicator_code)));
  }, [cleanRecords]);

  // Available income levels
  const availableIncomeLevels = useMemo(() => {
    const levels = new Set<string>();
    for (const r of cleanRecords) {
      if (r.income_level) levels.add(r.income_level);
    }
    const order = ['High income', 'Upper middle income', 'Lower middle income', 'Low income'];
    return Array.from(levels).sort((a, b) => {
      const idxA = order.indexOf(a);
      const idxB = order.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [cleanRecords]);

  // Available countries with metadata
  const availableCountries = useMemo(() => {
    const map = new Map<string, { iso3: string; name: string; incomeLevel: string; region: string }>();
    for (const r of cleanRecords) {
      if (!map.has(r.country_iso3)) {
        map.set(r.country_iso3, {
          iso3: r.country_iso3,
          name: r.country_name,
          incomeLevel: r.income_level || 'Unclassified',
          region: r.region || 'Unclassified',
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [cleanRecords]);

  // Available years
  const availableYears = useMemo(() => {
    return Array.from(new Set(cleanRecords.map((r) => r.year)))
      .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  }, [cleanRecords]);

  // ==========================================
  // GLOBAL FILTER SIDEBAR STATE & HANDLERS
  // ==========================================
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedIncomeLevels, setSelectedIncomeLevels] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const r of cleanRecords) {
      if (r.income_level) s.add(r.income_level);
    }
    return s;
  });

  const [selectedCountryIso3s, setSelectedCountryIso3s] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const r of cleanRecords) {
      s.add(r.country_iso3);
    }
    return s;
  });

  // Re-sync filter selections if cleanRecords change significantly
  useEffect(() => {
    setSelectedIncomeLevels((prev) => {
      if (prev.size === 0 && availableIncomeLevels.length > 0) {
        return new Set(availableIncomeLevels);
      }
      return prev;
    });
    setSelectedCountryIso3s((prev) => {
      if (prev.size === 0 && availableCountries.length > 0) {
        return new Set(availableCountries.map((c) => c.iso3));
      }
      return prev;
    });
  }, [availableIncomeLevels, availableCountries]);

  const handleToggleIncomeLevel = (level: string) => {
    setSelectedIncomeLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  };

  const handleSelectAllIncomeLevels = () => {
    setSelectedIncomeLevels(new Set(availableIncomeLevels));
  };

  const handleClearAllIncomeLevels = () => {
    setSelectedIncomeLevels(new Set());
  };

  const handleSelectOnlyIncomeLevel = (level: string) => {
    setSelectedIncomeLevels(new Set([level]));
  };

  const handleToggleCountry = (iso3: string) => {
    setSelectedCountryIso3s((prev) => {
      const next = new Set(prev);
      if (next.has(iso3)) next.delete(iso3);
      else next.add(iso3);
      return next;
    });
  };

  const handleSelectAllCountries = () => {
    setSelectedCountryIso3s(new Set(availableCountries.map((c) => c.iso3)));
  };

  const handleClearAllCountries = () => {
    setSelectedCountryIso3s(new Set());
  };

  const handleSelectCountriesPreset = (presetIso3s: string[]) => {
    setSelectedCountryIso3s(new Set(presetIso3s));
  };

  const handleResetAllFilters = () => {
    setSelectedIncomeLevels(new Set(availableIncomeLevels));
    setSelectedCountryIso3s(new Set(availableCountries.map((c) => c.iso3)));
  };

  const isFiltered = useMemo(() => {
    const isAllIncome = selectedIncomeLevels.size >= availableIncomeLevels.length;
    const isAllCountries = selectedCountryIso3s.size >= availableCountries.length;
    return !isAllIncome || !isAllCountries;
  }, [selectedIncomeLevels, availableIncomeLevels, selectedCountryIso3s, availableCountries]);

  // ==========================================
  // GLOBALLY FILTERED RECORDS
  // ==========================================
  const globallyFilteredRecords = useMemo(() => {
    if (!isFiltered) return cleanRecords;
    return cleanRecords.filter((r) => {
      const matchIncome = selectedIncomeLevels.has(r.income_level);
      const matchCountry = selectedCountryIso3s.has(r.country_iso3);
      return matchIncome && matchCountry;
    });
  }, [cleanRecords, isFiltered, selectedIncomeLevels, selectedCountryIso3s]);

  // Regional Comparison state
  const [regionalIndicator, setRegionalIndicator] = useState<string>(
    availableIndicatorCodes[1] || availableIndicatorCodes[0] || 'NY.GDP.PCAP.CD'
  );
  const [regionalYear, setRegionalYear] = useState<string>(
    availableYears[availableYears.length - 1] || '2022'
  );
  const [regionalAggType, setRegionalAggType] = useState<'mean' | 'median'>('mean');

  // Temporal Trends state
  const [temporalCountryFilter, setTemporalCountryFilter] = useState<string>('ALL'); // 'ALL' = sample average, or specific ISO3
  const [trendLayoutMode, setTrendLayoutMode] = useState<'grid' | 'single'>('grid');
  const [selectedSingleTrend, setSelectedSingleTrend] = useState<string>(
    availableIndicatorCodes[0] || 'SP.POP.TOTL'
  );

  // Scatter plot state
  const [scatterX, setScatterX] = useState<string>(
    availableIndicatorCodes[1] || availableIndicatorCodes[0] || 'NY.GDP.PCAP.CD'
  );
  const [scatterY, setScatterY] = useState<string>(
    availableIndicatorCodes[2] || availableIndicatorCodes[0] || 'SP.DYN.LE00.IN'
  );
  const [scatterYear, setScatterYear] = useState<string>(
    availableYears[availableYears.length - 1] || '2022'
  );

  // Time series state
  const [timeSeriesInd, setTimeSeriesInd] = useState<string>(
    availableIndicatorCodes[0] || 'NY.GDP.PCAP.CD'
  );
  const [selectedCountries, setSelectedCountries] = useState<string[]>([
    'USA', 'DEU', 'BRA', 'IND', 'KEN'
  ]);

  // Data grid state
  const [gridFormat, setGridFormat] = useState<'long' | 'wide'>('long');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const rowsPerPage = 20;

  // Palette for chart categories
  const regionColors: Record<string, string> = {
    'East Asia & Pacific': '#2563eb',
    'Europe & Central Asia': '#0284c7',
    'Latin America & Caribbean': '#059669',
    'Middle East & North Africa': '#d97706',
    'North America': '#4f46e5',
    'South Asia': '#dc2626',
    'Sub-Saharan Africa': '#9333ea',
    'Unclassified': '#64748b',
  };

  const seriesColors = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#9333ea', '#0891b2', '#ea580c'];

  // ==========================================
  // REGIONAL COMPARISON AGGREGATION
  // ==========================================
  const regionalData = useMemo(() => {
    // Filter records for selected indicator and year
    const matching = globallyFilteredRecords.filter(
      (r) => r.indicator_code === regionalIndicator && r.year === regionalYear
    );

    // Group values by region
    const byRegion: Record<string, number[]> = {};
    const countByRegion: Record<string, number> = {};

    for (const r of matching) {
      const reg = r.region || 'Unclassified';
      if (!byRegion[reg]) {
        byRegion[reg] = [];
        countByRegion[reg] = 0;
      }
      byRegion[reg].push(r.value);
      countByRegion[reg]++;
    }

    const result = Object.entries(byRegion).map(([region, values]) => {
      values.sort((a, b) => a - b);
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const median =
        values.length % 2 === 0
          ? (values[values.length / 2 - 1] + values[values.length / 2]) / 2
          : values[Math.floor(values.length / 2)];

      return {
        region,
        value: Number((regionalAggType === 'mean' ? mean : median).toFixed(2)),
        mean: Number(mean.toFixed(2)),
        median: Number(median.toFixed(2)),
        countriesCount: countByRegion[region],
        min: values[0],
        max: values[values.length - 1],
      };
    });

    // Sort descending by value
    result.sort((a, b) => b.value - a.value);
    return result;
  }, [globallyFilteredRecords, regionalIndicator, regionalYear, regionalAggType]);

  const regionalMeta = CURATED_INDICATORS.find((i) => i.code === regionalIndicator);

  // ==========================================
  // TEMPORAL TRENDS COMPUTATION
  // ==========================================
  // Pre-calculate annual time-series data for each indicator
  const temporalTrendsPerIndicator = useMemo(() => {
    const map: Record<
      string,
      {
        code: string;
        name: string;
        unit: string;
        category: string;
        data: { year: string; value: number; count: number }[];
      }
    > = {};

    for (const code of availableIndicatorCodes) {
      const meta = CURATED_INDICATORS.find((i) => i.code === code);
      // Filter by indicator and optional country filter
      const records = globallyFilteredRecords.filter((r) => {
        const matchesInd = r.indicator_code === code;
        const matchesCountry = temporalCountryFilter === 'ALL' || r.country_iso3 === temporalCountryFilter;
        return matchesInd && matchesCountry;
      });

      // Group by year
      const byYear: Record<string, number[]> = {};
      for (const r of records) {
        if (!byYear[r.year]) byYear[r.year] = [];
        byYear[r.year].push(r.value);
      }

      const yearsSorted = Object.keys(byYear).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
      const chartPoints = yearsSorted.map((yr) => {
        const vals = byYear[yr];
        const avg = vals.reduce((sum, v) => sum + v, 0) / vals.length;
        return {
          year: yr,
          value: Number(avg.toFixed(2)),
          count: vals.length,
        };
      });

      map[code] = {
        code,
        name: meta?.name || code,
        unit: meta?.unit || 'Units',
        category: meta?.category || 'General',
        data: chartPoints,
      };
    }

    return map;
  }, [globallyFilteredRecords, availableIndicatorCodes, temporalCountryFilter]);

  // Calculate scatter points and OLS Regression
  const { scatterPoints, regression } = useMemo(() => {
    const points: { iso3: string; name: string; region: string; income: string; x: number; y: number }[] = [];

    const byCountry: Record<string, { name: string; region: string; income: string; x?: number; y?: number }> = {};
    for (const r of globallyFilteredRecords) {
      if (r.year === scatterYear) {
        if (!byCountry[r.country_iso3]) {
          byCountry[r.country_iso3] = {
            name: r.country_name,
            region: r.region,
            income: r.income_level,
          };
        }
        if (r.indicator_code === scatterX) byCountry[r.country_iso3].x = r.value;
        if (r.indicator_code === scatterY) byCountry[r.country_iso3].y = r.value;
      }
    }

    for (const [iso3, item] of Object.entries(byCountry)) {
      if (item.x !== undefined && item.y !== undefined) {
        points.push({
          iso3,
          name: item.name,
          region: item.region,
          income: item.income,
          x: item.x,
          y: item.y,
        });
      }
    }

    if (points.length < 2) {
      return { scatterPoints: points, regression: null };
    }

    const n = points.length;
    const sumX = points.reduce((acc, p) => acc + p.x, 0);
    const sumY = points.reduce((acc, p) => acc + p.y, 0);
    const meanX = sumX / n;
    const meanY = sumY / n;

    let num = 0;
    let denX = 0;
    let denY = 0;

    for (const p of points) {
      const dx = p.x - meanX;
      const dy = p.y - meanY;
      num += dx * dy;
      denX += dx * dx;
      denY += dy * dy;
    }

    const slope = denX !== 0 ? num / denX : 0;
    const intercept = meanY - slope * meanX;
    const r = Math.sqrt(denX * denY) !== 0 ? num / Math.sqrt(denX * denY) : 0;
    const rSquared = r * r;

    return {
      scatterPoints: points,
      regression: { slope, intercept, r, rSquared, n },
    };
  }, [globallyFilteredRecords, scatterX, scatterY, scatterYear]);

  // Wide table data preparation
  const wideTableData = useMemo(() => {
    if (gridFormat !== 'wide') return [];
    const grid: Record<string, any> = {};
    for (const r of globallyFilteredRecords) {
      const key = `${r.country_iso3}__${r.state || 'national'}__${r.year}`;
      if (!grid[key]) {
        grid[key] = {
          country_iso3: r.country_iso3,
          country_name: r.country_name,
          state: r.state || undefined,
          region: r.region,
          year: r.year,
        };
      }
      grid[key][r.indicator_code] = r.value;
    }
    return Object.values(grid);
  }, [globallyFilteredRecords, gridFormat]);

  // Filtered rows for grid
  const filteredGridRows = useMemo(() => {
    if (gridFormat === 'long') {
      return globallyFilteredRecords.filter(
        (r) =>
          !searchQuery ||
          r.country_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.country_iso3.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (r.state && r.state.toLowerCase().includes(searchQuery.toLowerCase())) ||
          r.indicator_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.year.includes(searchQuery)
      );
    } else {
      return wideTableData.filter(
        (r) =>
          !searchQuery ||
          r.country_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.country_iso3?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (r.state && r.state.toLowerCase().includes(searchQuery.toLowerCase())) ||
          r.year?.includes(searchQuery)
      );
    }
  }, [globallyFilteredRecords, wideTableData, gridFormat, searchQuery]);

  const totalPages = Math.ceil(filteredGridRows.length / rowsPerPage) || 1;
  const paginatedRows = filteredGridRows.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  // Time series points calculation
  const timeSeriesData = useMemo(() => {
    const seriesByCountry: Record<string, { year: number; value: number }[]> = {};
    for (const r of globallyFilteredRecords) {
      if (r.indicator_code === timeSeriesInd && selectedCountries.includes(r.country_iso3)) {
        if (!seriesByCountry[r.country_iso3]) seriesByCountry[r.country_iso3] = [];
        seriesByCountry[r.country_iso3].push({
          year: parseInt(r.year, 10),
          value: r.value,
        });
      }
    }
    for (const iso3 in seriesByCountry) {
      seriesByCountry[iso3].sort((a, b) => a.year - b.year);
    }
    return seriesByCountry;
  }, [globallyFilteredRecords, timeSeriesInd, selectedCountries]);

  return (
    <div className="space-y-8 pb-12">
      {/* Editorial Title Section */}
      <div className="border-b border-slate-200 pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-blue-700 tracking-wider uppercase">
            Step 5 · Empirical Analysis & Visualizations
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Visualizations & High-Density Panel
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Explore indicator-by-indicator temporal trends, cross-regional disparities, bivariate econometric regressions, and tabular panel data.
          </p>
        </div>

        <button
          onClick={onProceed}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm self-start md:self-auto shrink-0"
        >
          <span>Proceed to Export Options</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Sub-view switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-3 gap-3">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
          <button
            onClick={() => setViewMode('trends')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${
              viewMode === 'trends'
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Temporal Trends</span>
          </button>

          <button
            onClick={() => setViewMode('regional')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${
              viewMode === 'regional'
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Regional Comparison</span>
          </button>

          <button
            onClick={() => setViewMode('subnational')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${
              viewMode === 'subnational'
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Country & State Segregation</span>
          </button>

          <button
            onClick={() => setViewMode('scatter')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${
              viewMode === 'scatter'
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ScatterChart className="w-3.5 h-3.5" />
            <span>Bivariate Regression (OLS)</span>
          </button>

          <button
            onClick={() => setViewMode('timeseries')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${
              viewMode === 'timeseries'
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Country Trajectories</span>
          </button>

          <button
            onClick={() => setViewMode('datagrid')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${
              viewMode === 'datagrid'
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Panel Data Grid</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded border transition-colors ${
              isSidebarOpen
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{isSidebarOpen ? 'Hide Filters' : 'Filter Panel'}</span>
            {isFiltered && (
              <span className="font-mono text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded font-bold">
                Filtered
              </span>
            )}
          </button>

          <div className="text-xs font-mono tabular-nums text-slate-500">
            {globallyFilteredRecords.length.toLocaleString()} of {cleanRecords.length.toLocaleString()} rows
          </div>
        </div>
      </div>

      {/* Global Filter Active Notification Bar */}
      {isFiltered && (
        <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Dynamic Filter Active:</strong> {selectedIncomeLevels.size} of {availableIncomeLevels.length} income tiers · {selectedCountryIso3s.size} of {availableCountries.length} sovereign economies · {globallyFilteredRecords.length.toLocaleString()} active observations. All charts update in real-time.
            </span>
          </div>
          <button
            onClick={handleResetAllFilters}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:text-amber-950 bg-white border border-amber-300 rounded shadow-sm shrink-0 self-start sm:self-auto"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset to Full Sample</span>
          </button>
        </div>
      )}

      {/* Main 2-Column Responsive Viewport with Global Filter Sidebar */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Sidebar Container */}
        {isSidebarOpen && (
          <aside className="w-full lg:w-72 shrink-0 lg:sticky lg:top-4 z-10">
            <VisualizeSidebar
              availableIncomeLevels={availableIncomeLevels}
              selectedIncomeLevels={selectedIncomeLevels}
              onToggleIncomeLevel={handleToggleIncomeLevel}
              onSelectAllIncomeLevels={handleSelectAllIncomeLevels}
              onClearAllIncomeLevels={handleClearAllIncomeLevels}
              onSelectOnlyIncomeLevel={handleSelectOnlyIncomeLevel}
              availableCountries={availableCountries}
              selectedCountryIso3s={selectedCountryIso3s}
              onToggleCountry={handleToggleCountry}
              onSelectAllCountries={handleSelectAllCountries}
              onClearAllCountries={handleClearAllCountries}
              onSelectCountriesPreset={handleSelectCountriesPreset}
              totalRecordsCount={cleanRecords.length}
              filteredRecordsCount={globallyFilteredRecords.length}
              onResetAllFilters={handleResetAllFilters}
              isFiltered={isFiltered}
              onCloseMobile={() => setIsSidebarOpen(false)}
            />
          </aside>
        )}

        {/* Charts & Grid Viewport */}
        <main className="flex-1 min-w-0 w-full space-y-6">
          {globallyFilteredRecords.length === 0 ? (
            <div className="bg-white p-12 rounded-lg border border-slate-200 text-center space-y-4">
              <div className="w-12 h-12 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center mx-auto">
                <Filter className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="text-base font-bold text-slate-900">
                  No Observations Match Filter Criteria
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  The current combination of income tiers and selected countries excluded all records. Adjust your selections in the filter sidebar or reset to the full sample.
                </p>
              </div>
              <button
                onClick={handleResetAllFilters}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset All Filters</span>
              </button>
            </div>
          ) : (
            <>

      {/* ======================================================== */}
      {/* VIEW 1: TEMPORAL TRENDS (Recharts Line Chart for each indicator) */}
      {/* ======================================================== */}
      {viewMode === 'trends' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-lg border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                  Sample Scope
                </label>
                <select
                  value={temporalCountryFilter}
                  onChange={(e) => setTemporalCountryFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs text-slate-900 bg-slate-50 border border-slate-300 rounded font-medium focus:bg-white"
                >
                  <option value="ALL">
                    Active Sample Average ({new Set(globallyFilteredRecords.map((r) => r.country_iso3)).size} Economies)
                  </option>
                  {availableCountries
                    .filter((c) => selectedCountryIso3s.has(c.iso3) && selectedIncomeLevels.has(c.incomeLevel))
                    .map((c) => (
                      <option key={c.iso3} value={c.iso3}>
                        {c.name} ({c.iso3})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                  Display Mode
                </label>
                <div className="flex items-center p-1 bg-slate-100 rounded border border-slate-200 text-xs">
                  <button
                    onClick={() => setTrendLayoutMode('grid')}
                    className={`px-3 py-1 font-medium rounded transition-colors ${
                      trendLayoutMode === 'grid'
                        ? 'bg-white text-slate-900 shadow-sm font-semibold'
                        : 'text-slate-600'
                    }`}
                  >
                    Multi-Indicator Grid
                  </button>
                  <button
                    onClick={() => setTrendLayoutMode('single')}
                    className={`px-3 py-1 font-medium rounded transition-colors ${
                      trendLayoutMode === 'single'
                        ? 'bg-white text-slate-900 shadow-sm font-semibold'
                        : 'text-slate-600'
                    }`}
                  >
                    Focused View
                  </button>
                </div>
              </div>
            </div>

            {trendLayoutMode === 'single' && (
              <div className="w-full sm:w-72">
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                  Select Indicator
                </label>
                <select
                  value={selectedSingleTrend}
                  onChange={(e) => setSelectedSingleTrend(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs text-slate-900 bg-slate-50 border border-slate-300 rounded font-medium focus:bg-white truncate"
                >
                  {availableIndicatorCodes.map((code) => {
                    const meta = CURATED_INDICATORS.find((i) => i.code === code);
                    return (
                      <option key={code} value={code}>
                        {code} - {meta?.name || code}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>

          {/* GRID LAYOUT: Line Chart for EACH indicator using Recharts */}
          {trendLayoutMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {availableIndicatorCodes.map((code, idx) => {
                const trend = temporalTrendsPerIndicator[code];
                if (!trend) return null;
                const lineColor = seriesColors[idx % seriesColors.length];

                // Calculate delta from first to last year
                const firstVal = trend.data[0]?.value;
                const lastVal = trend.data[trend.data.length - 1]?.value;
                const delta =
                  firstVal !== undefined && lastVal !== undefined
                    ? ((lastVal - firstVal) / (Math.abs(firstVal) || 1)) * 100
                    : null;

                return (
                  <div
                    key={code}
                    className="bg-white p-5 rounded-lg border border-slate-200 flex flex-col justify-between space-y-4 hover:border-slate-300 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-blue-700">
                          {code}
                        </span>
                        {delta !== null && (
                          <span
                            className={`text-xs font-mono font-semibold tabular-nums ${
                              delta > 0
                                ? 'text-emerald-700'
                                : delta < 0
                                ? 'text-amber-700'
                                : 'text-slate-500'
                            }`}
                          >
                            {delta > 0 ? '+' : ''}
                            {delta.toFixed(1)}% over period
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900 mt-0.5 line-clamp-1" title={trend.name}>
                        {trend.name}
                      </h3>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                        <span>Unit: {trend.unit}</span>
                        <span aria-hidden="true">·</span>
                        <span>{trend.category}</span>
                      </div>
                    </div>

                    {/* Recharts Line Chart for this indicator */}
                    <div className="h-56 w-full pt-2">
                      {trend.data.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={trend.data}
                            margin={{ top: 8, right: 12, left: -10, bottom: 0 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis
                              dataKey="year"
                              stroke="#94a3b8"
                              fontSize={11}
                              tickLine={false}
                              axisLine={{ stroke: '#cbd5e1' }}
                            />
                            <YAxis
                              stroke="#94a3b8"
                              fontSize={11}
                              tickLine={false}
                              axisLine={{ stroke: '#cbd5e1' }}
                              tickFormatter={(val) =>
                                val >= 1000000
                                  ? `${(val / 1000000).toFixed(1)}M`
                                  : val >= 1000
                                  ? `${(val / 1000).toFixed(0)}k`
                                  : val.toFixed(1)
                              }
                            />
                            <Tooltip
                              content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                  const item = payload[0];
                                  const num = Number(item.value);
                                  return (
                                    <div className="bg-slate-900 text-white rounded p-2.5 shadow-lg border border-slate-800 text-xs font-mono">
                                      <div className="font-semibold text-slate-200 mb-1">
                                        Year {label}
                                      </div>
                                      <div className="flex items-center justify-between gap-4 text-emerald-400 font-bold">
                                        <span>Value:</span>
                                        <span>
                                          {num >= 10000
                                            ? num.toLocaleString(undefined, { maximumFractionDigits: 1 })
                                            : num.toFixed(2)}{' '}
                                          <span className="text-[10px] text-slate-400 font-sans font-normal">
                                            {trend.unit}
                                          </span>
                                        </span>
                                      </div>
                                      {item.payload.count && (
                                        <div className="text-[10px] text-slate-400 mt-1">
                                          Aggregated from {item.payload.count} observations
                                        </div>
                                      )}
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="value"
                              name={trend.name}
                              stroke={lineColor}
                              strokeWidth={2.5}
                              dot={{ r: 3, fill: lineColor, strokeWidth: 1.5, stroke: '#ffffff' }}
                              activeDot={{ r: 5, fill: '#0f172a' }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                          No temporal observations found for {code}
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                      <span>Latest: {lastVal !== undefined ? (lastVal >= 10000 ? lastVal.toLocaleString(undefined, { maximumFractionDigits: 1 }) : lastVal.toFixed(2)) : '-'}</span>
                      <span>{trend.data.length} observation years</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // SINGLE FOCUSED VIEW: Large Line Chart using Recharts
            (() => {
              const trend = temporalTrendsPerIndicator[selectedSingleTrend];
              if (!trend) return null;

              return (
                <div className="bg-white p-6 rounded-lg border border-slate-200 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-blue-700">
                          {trend.code}
                        </span>
                        <span className="text-xs text-slate-500">· {trend.category}</span>
                      </div>
                      <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                        {trend.name}
                      </h2>
                    </div>
                    <div className="text-xs text-slate-500 font-mono">
                      Unit: <strong className="text-slate-800">{trend.unit}</strong>
                    </div>
                  </div>

                  <div className="h-80 w-full pt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={trend.data}
                        margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis
                          dataKey="year"
                          stroke="#64748b"
                          fontSize={12}
                          tickLine={false}
                          axisLine={{ stroke: '#cbd5e1' }}
                        />
                        <YAxis
                          stroke="#64748b"
                          fontSize={12}
                          tickLine={false}
                          axisLine={{ stroke: '#cbd5e1' }}
                          tickFormatter={(val) =>
                            val >= 1000000
                              ? `${(val / 1000000).toFixed(1)}M`
                              : val >= 1000
                              ? `${(val / 1000).toFixed(0)}k`
                              : val.toFixed(1)
                          }
                        />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const num = Number(payload[0].value);
                              return (
                                <div className="bg-slate-900 text-white rounded p-3 shadow-lg border border-slate-800 text-xs font-mono">
                                  <div className="font-semibold text-slate-200 mb-1">
                                    Observation Year {label}
                                  </div>
                                  <div className="text-emerald-400 font-bold text-sm">
                                    {num >= 10000
                                      ? num.toLocaleString(undefined, { maximumFractionDigits: 1 })
                                      : num.toFixed(2)}{' '}
                                    <span className="text-xs text-slate-400 font-sans font-normal">
                                      {trend.unit}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 mt-1">
                                    Sample: {temporalCountryFilter === 'ALL' ? 'Global Average' : temporalCountryFilter}
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="#2563eb"
                          strokeWidth={3}
                          dot={{ r: 4, fill: '#2563eb', strokeWidth: 2, stroke: '#ffffff' }}
                          activeDot={{ r: 7, fill: '#0f172a' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 2: REGIONAL COMPARISON (Recharts Bar Chart) */}
      {/* ======================================================== */}
      {viewMode === 'regional' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                Indicator to Compare Across Regions
              </label>
              <select
                value={regionalIndicator}
                onChange={(e) => setRegionalIndicator(e.target.value)}
                className="w-full px-3 py-1.5 text-xs text-slate-900 bg-slate-50 border border-slate-300 rounded font-medium focus:bg-white truncate"
              >
                {availableIndicatorCodes.map((code) => {
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
                Benchmark Year
              </label>
              <select
                value={regionalYear}
                onChange={(e) => setRegionalYear(e.target.value)}
                className="w-full px-3 py-1.5 text-xs text-slate-900 bg-slate-50 border border-slate-300 rounded font-mono tabular-nums focus:bg-white"
              >
                {availableYears
                  .slice()
                  .reverse()
                  .map((yr) => (
                    <option key={yr} value={yr}>
                      Year {yr}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                Aggregation Metric
              </label>
              <select
                value={regionalAggType}
                onChange={(e) => setRegionalAggType(e.target.value as any)}
                className="w-full px-3 py-1.5 text-xs text-slate-900 bg-slate-50 border border-slate-300 rounded font-medium focus:bg-white"
              >
                <option value="mean">Mean (Regional Arithmetic Average)</option>
                <option value="median">Median (Regional Central Tendency)</option>
              </select>
            </div>
          </div>

          {/* Regional Bar Chart & Disparity Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Recharts Bar Chart */}
            <div className="bg-white p-6 rounded-lg border border-slate-200 lg:col-span-3 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-600" />
                    <span className="font-mono text-xs font-bold text-blue-700">
                      {regionalIndicator}
                    </span>
                    <span className="text-xs text-slate-500">· {regionalMeta?.category}</span>
                  </div>
                  <h2 className="text-base font-bold text-slate-900 mt-0.5">
                    Regional Distribution: {regionalMeta?.name || regionalIndicator}
                  </h2>
                </div>
                <div className="text-xs font-mono text-slate-500 tabular-nums">
                  Year {regionalYear} · Metric: {regionalAggType.toUpperCase()} ({regionalMeta?.unit})
                </div>
              </div>

              {regionalData.length > 0 ? (
                <div className="h-80 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={regionalData}
                      layout="vertical"
                      margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis
                        type="number"
                        stroke="#94a3b8"
                        fontSize={11}
                        tickLine={false}
                        axisLine={{ stroke: '#cbd5e1' }}
                        tickFormatter={(val) =>
                          val >= 1000000
                            ? `${(val / 1000000).toFixed(1)}M`
                            : val >= 1000
                            ? `${(val / 1000).toFixed(0)}k`
                            : val.toFixed(1)
                        }
                      />
                      <YAxis
                        type="category"
                        dataKey="region"
                        stroke="#475569"
                        fontSize={11}
                        width={160}
                        tickLine={false}
                        axisLine={{ stroke: '#cbd5e1' }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-slate-900 text-white rounded p-3 shadow-lg border border-slate-800 text-xs font-mono">
                                <div className="font-bold text-slate-200 text-sm mb-1">
                                  {data.region}
                                </div>
                                <div className="space-y-1 text-slate-300">
                                  <div className="flex justify-between gap-4 font-bold text-emerald-400">
                                    <span>{regionalAggType === 'mean' ? 'Regional Mean:' : 'Regional Median:'}</span>
                                    <span>
                                      {data.value >= 10000
                                        ? data.value.toLocaleString(undefined, { maximumFractionDigits: 1 })
                                        : data.value.toFixed(2)}{' '}
                                      <span className="text-[10px] text-slate-400 font-sans font-normal">
                                        {regionalMeta?.unit}
                                      </span>
                                    </span>
                                  </div>
                                  <div className="flex justify-between gap-4 text-slate-400 text-[11px]">
                                    <span>Min / Max Range:</span>
                                    <span>
                                      {data.min.toLocaleString()} – {data.max.toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="flex justify-between gap-4 text-slate-400 text-[11px]">
                                    <span>Sovereign Entities:</span>
                                    <span>{data.countriesCount} countries</span>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {regionalData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={regionColors[entry.region] || '#3b82f6'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-80 flex items-center justify-center text-xs text-slate-400 italic">
                  No regional data available for {regionalIndicator} in {regionalYear}. Try choosing a different year.
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-slate-500 font-mono pt-2 border-t border-slate-100">
                <span>World Bank Regional Aggregates</span>
                <span>Sorted descending by regional {regionalAggType}</span>
                <span>Unit: {regionalMeta?.unit}</span>
              </div>
            </div>

            {/* Regional Disparity Metrics Box */}
            <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 space-y-4">
              <h3 className="text-sm font-semibold text-slate-900">
                Regional Disparity Index
              </h3>

              {regionalData.length > 1 ? (
                (() => {
                  const highest = regionalData[0];
                  const lowest = regionalData[regionalData.length - 1];
                  const gap = highest.value - lowest.value;
                  const ratio = lowest.value !== 0 ? (highest.value / lowest.value).toFixed(1) : 'N/A';

                  return (
                    <div className="space-y-3 font-mono text-xs tabular-nums">
                      <div className="bg-white p-3 rounded border border-slate-200">
                        <span className="text-[10px] text-slate-500 block uppercase">Highest Region</span>
                        <span className="text-sm font-bold text-slate-900 block mt-0.5 truncate">
                          {highest.region}
                        </span>
                        <span className="text-sm font-bold text-blue-700 block mt-0.5">
                          {highest.value >= 10000 ? highest.value.toLocaleString() : highest.value.toFixed(2)}{' '}
                          <span className="text-[10px] text-slate-400 font-sans">{regionalMeta?.unit}</span>
                        </span>
                      </div>

                      <div className="bg-white p-3 rounded border border-slate-200">
                        <span className="text-[10px] text-slate-500 block uppercase">Lowest Region</span>
                        <span className="text-sm font-bold text-slate-900 block mt-0.5 truncate">
                          {lowest.region}
                        </span>
                        <span className="text-sm font-bold text-amber-700 block mt-0.5">
                          {lowest.value >= 10000 ? lowest.value.toLocaleString() : lowest.value.toFixed(2)}{' '}
                          <span className="text-[10px] text-slate-400 font-sans">{regionalMeta?.unit}</span>
                        </span>
                      </div>

                      <div className="bg-white p-3 rounded border border-slate-200">
                        <span className="text-[10px] text-slate-500 block uppercase">Inter-Regional Disparity</span>
                        <span className="text-base font-bold text-slate-900 block mt-0.5">
                          {ratio !== 'N/A' ? `${ratio}x ratio` : `${gap.toLocaleString()} delta`}
                        </span>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          Cross-regional divergence in {regionalYear}
                        </span>
                      </div>

                      <div className="text-[11px] font-sans text-slate-600 leading-normal pt-1">
                        Regional stratification highlights geographic inequality across sovereign development trajectories.
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="text-xs text-slate-400 italic">
                  At least two reporting regions required to calculate inter-regional disparity.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW: COUNTRY & STATE SUBNATIONAL SEGREGATION */}
      {/* ======================================================== */}
      {viewMode === 'subnational' && (
        <SubnationalSegregationView
          cleanRecords={cleanRecords}
          onLoadSubnationalData={onLoadSubnationalData || (() => {})}
          onExportCsv={onExportCsv}
        />
      )}

      {/* ======================================================== */}
      {/* VIEW 3: SCATTER & OLS REGRESSION */}
      {/* ======================================================== */}
      {viewMode === 'scatter' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                Independent Variable (X-Axis)
              </label>
              <select
                value={scatterX}
                onChange={(e) => setScatterX(e.target.value)}
                className="w-full px-3 py-1.5 text-xs text-slate-900 bg-slate-50 border border-slate-300 rounded font-medium focus:bg-white truncate"
              >
                {availableIndicatorCodes.map((code) => {
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
                Dependent Variable (Y-Axis)
              </label>
              <select
                value={scatterY}
                onChange={(e) => setScatterY(e.target.value)}
                className="w-full px-3 py-1.5 text-xs text-slate-900 bg-slate-50 border border-slate-300 rounded font-medium focus:bg-white truncate"
              >
                {availableIndicatorCodes.map((code) => {
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
                Cross-Sectional Year
              </label>
              <select
                value={scatterYear}
                onChange={(e) => setScatterYear(e.target.value)}
                className="w-full px-3 py-1.5 text-xs text-slate-900 bg-slate-50 border border-slate-300 rounded font-mono tabular-nums focus:bg-white"
              >
                {availableYears
                  .slice()
                  .reverse()
                  .map((yr) => (
                    <option key={yr} value={yr}>
                      Year {yr}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Scatter Canvas + Econometric Diagnostics */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Scatter SVG Plot */}
            <div className="bg-white p-6 rounded-lg border border-slate-200 lg:col-span-3">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Cross-Sectional Scatter & Fitted OLS Trendline
                </span>
                <span className="text-xs font-mono text-slate-500 tabular-nums">
                  {scatterPoints.length} Sovereign Economies ({scatterYear})
                </span>
              </div>

              {scatterPoints.length > 0 ? (
                <div className="relative w-full h-80 border-l border-b border-slate-300">
                  {(() => {
                    const minX = Math.min(...scatterPoints.map((p) => p.x));
                    const maxX = Math.max(...scatterPoints.map((p) => p.x)) || 1;
                    const minY = Math.min(...scatterPoints.map((p) => p.y));
                    const maxY = Math.max(...scatterPoints.map((p) => p.y)) || 1;
                    const spanX = maxX - minX || 1;
                    const spanY = maxY - minY || 1;

                    return (
                      <>
                        {scatterPoints.map((p) => {
                          const posX = ((p.x - minX) / spanX) * 90 + 5;
                          const posY = 95 - ((p.y - minY) / spanY) * 90;
                          return (
                            <div
                              key={p.iso3}
                              className="absolute w-3 h-3 rounded-full bg-blue-600 border border-white shadow-sm -ml-1.5 -mt-1.5 cursor-pointer hover:scale-150 hover:bg-slate-900 transition-transform group z-10"
                              style={{ left: `${posX}%`, top: `${posY}%` }}
                            >
                              <div className="opacity-0 group-hover:opacity-100 pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 text-white text-[11px] font-mono py-1 px-2 rounded whitespace-nowrap shadow-lg z-20">
                                <strong>{p.name} ({p.iso3})</strong><br />
                                X: {p.x.toLocaleString()}<br />
                                Y: {p.y.toLocaleString()}
                              </div>
                            </div>
                          );
                        })}

                        {regression && (
                          <svg className="absolute inset-0 w-full h-full pointer-events-none">
                            <line
                              x1="5%"
                              y1={`${95 - ((regression.intercept + regression.slope * minX - minY) / spanY) * 90}%`}
                              x2="95%"
                              y2={`${95 - ((regression.intercept + regression.slope * maxX - minY) / spanY) * 90}%`}
                              stroke="#dc2626"
                              strokeWidth="2"
                              strokeDasharray="4 4"
                            />
                          </svg>
                        )}
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div className="h-80 flex items-center justify-center text-xs text-slate-400 italic">
                  No overlapping observations found for {scatterX} and {scatterY} in {scatterYear}. Try changing the year or variables.
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-slate-500 font-mono mt-3">
                <span>← Low {scatterX}</span>
                <span>{scatterX} (Horizontal) vs {scatterY} (Vertical)</span>
                <span>High {scatterX} →</span>
              </div>
            </div>

            {/* Regression Summary Box */}
            <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 space-y-4">
              <h3 className="text-sm font-semibold text-slate-900">
                Econometric Model (OLS)
              </h3>

              {regression ? (
                <div className="space-y-3 font-mono text-xs tabular-nums">
                  <div className="bg-white p-3 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 block uppercase">Pearson Correlation (r)</span>
                    <span className="text-lg font-bold text-slate-900 block mt-0.5">
                      {regression.r.toFixed(4)}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      {Math.abs(regression.r) > 0.7
                        ? 'Strong linear correlation'
                        : Math.abs(regression.r) > 0.3
                        ? 'Moderate correlation'
                        : 'Weak or non-linear'}
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 block uppercase">Coefficient of Determination (R²)</span>
                    <span className="text-lg font-bold text-blue-700 block mt-0.5">
                      {(regression.rSquared * 100).toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      Variance of Y explained by X
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded border border-slate-200 text-[11px] leading-relaxed">
                    <span className="text-[10px] text-slate-500 block uppercase mb-1">Fitted Equation</span>
                    <code>y = {regression.slope >= 0 ? '+' : ''}{regression.slope.toFixed(4)}x {regression.intercept >= 0 ? '+' : ''}{regression.intercept.toFixed(2)}</code>
                  </div>

                  <div className="text-[11px] font-sans text-slate-600 leading-normal pt-1">
                    Standard bivariate cross-section estimating elasticity between specified World Bank series.
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic">
                  Select variables with intersecting observations to calculate regression.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 4: COUNTRY TRAJECTORIES (Time Series Line Chart) */}
      {/* ======================================================== */}
      {viewMode === 'timeseries' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-lg border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="w-full sm:w-1/2">
              <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                Select Indicator to Track
              </label>
              <select
                value={timeSeriesInd}
                onChange={(e) => setTimeSeriesInd(e.target.value)}
                className="w-full px-3 py-1.5 text-xs text-slate-900 bg-slate-50 border border-slate-300 rounded font-medium focus:bg-white truncate"
              >
                {availableIndicatorCodes.map((code) => {
                  const meta = CURATED_INDICATORS.find((i) => i.code === code);
                  return (
                    <option key={code} value={code}>
                      {code} - {meta?.name || code}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Country Toggles */}
            <div className="w-full sm:w-1/2 flex flex-wrap gap-1.5 justify-end">
              {availableCountries.slice(0, 10).map((c) => {
                const isSelected = selectedCountries.includes(c.iso3);
                return (
                  <button
                    key={c.iso3}
                    onClick={() => {
                      if (isSelected) {
                        if (selectedCountries.length > 1) {
                          setSelectedCountries(selectedCountries.filter((id) => id !== c.iso3));
                        }
                      } else {
                        setSelectedCountries([...selectedCountries, c.iso3]);
                      }
                    }}
                    className={`px-2.5 py-1 text-xs font-mono rounded border transition-colors ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {c.iso3}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Series Canvas with Recharts */}
          <div className="bg-white p-6 rounded-lg border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                Multi-Country Trajectory ({timeSeriesInd})
              </h3>
              <div className="flex items-center gap-3 text-xs">
                {selectedCountries.map((iso3, i) => (
                  <div key={iso3} className="flex items-center gap-1.5 font-mono">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: seriesColors[i % seriesColors.length] }}
                    />
                    <span>{iso3}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recharts Multi-line chart */}
            {(() => {
              // Format time series data for Recharts: array of { year, USA: val, DEU: val, ... }
              const yearsSet = new Set<string>();
              for (const iso3 in timeSeriesData) {
                for (const pt of timeSeriesData[iso3]) {
                  yearsSet.add(String(pt.year));
                }
              }
              const sortedYears = Array.from(yearsSet).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

              const rechartsData = sortedYears.map((yr) => {
                const row: Record<string, any> = { year: yr };
                for (const iso3 of selectedCountries) {
                  const match = timeSeriesData[iso3]?.find((p) => String(p.year) === yr);
                  if (match) row[iso3] = match.value;
                }
                return row;
              });

              return rechartsData.length > 0 ? (
                <div className="h-80 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={rechartsData}
                      margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis
                        dataKey="year"
                        stroke="#64748b"
                        fontSize={12}
                        tickLine={false}
                        axisLine={{ stroke: '#cbd5e1' }}
                      />
                      <YAxis
                        stroke="#64748b"
                        fontSize={12}
                        tickLine={false}
                        axisLine={{ stroke: '#cbd5e1' }}
                        tickFormatter={(val) =>
                          val >= 1000000
                            ? `${(val / 1000000).toFixed(1)}M`
                            : val >= 1000
                            ? `${(val / 1000).toFixed(0)}k`
                            : val.toFixed(1)
                        }
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-slate-900 text-white rounded p-3 shadow-lg border border-slate-800 text-xs font-mono space-y-1">
                                <div className="font-semibold text-slate-200 mb-1 border-b border-slate-800 pb-1">
                                  Year {label}
                                </div>
                                {payload.map((item: any) => (
                                  <div key={item.name} className="flex justify-between gap-4">
                                    <span style={{ color: item.color }} className="font-bold">
                                      {item.name}:
                                    </span>
                                    <span>
                                      {item.value !== undefined
                                        ? Number(item.value).toLocaleString(undefined, { maximumFractionDigits: 1 })
                                        : '-'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend />
                      {selectedCountries.map((iso3, idx) => (
                        <Line
                          key={iso3}
                          type="monotone"
                          dataKey={iso3}
                          name={iso3}
                          stroke={seriesColors[idx % seriesColors.length]}
                          strokeWidth={2.5}
                          dot={{ r: 3 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-80 flex items-center justify-center text-xs text-slate-400 italic">
                  Select at least one country with data for {timeSeriesInd}.
                </div>
              );
            })()}

            <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
              <span>Start of observation period</span>
              <span>Annual trajectory across sovereign panels</span>
              <span>End of observation period</span>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 5: HIGH-DENSITY DATA GRID (LONG / WIDE) */}
      {/* ======================================================== */}
      {viewMode === 'datagrid' && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden space-y-4 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Interactive Panel Dataset Browser
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <span>
                  Format: {gridFormat === 'long' ? 'Tidy Long Format (Recommended for R & Python)' : 'Wide Panel Format (Recommended for Stata xtreg)'}
                </span>
                <span aria-hidden="true">·</span>
                <span>{filteredGridRows.length.toLocaleString()} matching rows</span>
              </div>
            </div>

            {/* Format toggle & export */}
            <div className="flex items-center gap-2">
              <div className="flex items-center p-1 bg-slate-100 rounded border border-slate-200 text-xs">
                <button
                  onClick={() => { setGridFormat('long'); setPage(1); }}
                  className={`px-3 py-1 font-medium rounded ${
                    gridFormat === 'long' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600'
                  }`}
                >
                  Long (Tidy)
                </button>
                <button
                  onClick={() => { setGridFormat('wide'); setPage(1); }}
                  className={`px-3 py-1 font-medium rounded ${
                    gridFormat === 'wide' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600'
                  }`}
                >
                  Wide (Panel)
                </button>
              </div>

              <button
                onClick={() => onExportCsv(gridFormat)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export {gridFormat.toUpperCase()}</span>
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                placeholder="Search by country, state, code, year..."
                className="w-full pl-9 pr-3 py-1.5 text-xs text-slate-900 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto border border-slate-200 rounded">
            {gridFormat === 'long' ? (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 font-mono">ISO3</th>
                    <th className="py-2.5 px-3">Country Name</th>
                    <th className="py-2.5 px-3">State / Province</th>
                    <th className="py-2.5 px-3">Region</th>
                    <th className="py-2.5 px-3 font-mono">Year</th>
                    <th className="py-2.5 px-3 font-mono">Indicator Code</th>
                    <th className="py-2.5 px-3">Series Name</th>
                    <th className="py-2.5 px-3 text-right font-mono">Observed Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono tabular-nums text-slate-700">
                  {paginatedRows.map((r: any, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2 px-3 font-bold text-blue-700">{r.country_iso3}</td>
                      <td className="py-2 px-3 font-sans font-medium text-slate-900">{r.country_name}</td>
                      <td className="py-2 px-3 font-sans text-slate-700">
                        {r.state ? (
                          <span className="font-semibold text-blue-900 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-blue-600 shrink-0" />
                            <span>{r.state}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">National</span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-sans text-slate-600">{r.region}</td>
                      <td className="py-2 px-3 text-slate-900">{r.year}</td>
                      <td className="py-2 px-3 text-slate-600">{r.indicator_code}</td>
                      <td className="py-2 px-3 font-sans text-slate-700 max-w-[200px] truncate" title={r.indicator_name}>
                        {r.indicator_name}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">
                        {r.value >= 10000 ? r.value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : r.value.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 font-mono">ISO3</th>
                    <th className="py-2.5 px-3">Country Name</th>
                    <th className="py-2.5 px-3">State / Province</th>
                    <th className="py-2.5 px-3 font-mono">Year</th>
                    {availableIndicatorCodes.map((code) => (
                      <th key={code} className="py-2.5 px-3 text-right font-mono text-[11px]">
                        {code}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono tabular-nums text-slate-700">
                  {paginatedRows.map((row: any, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2 px-3 font-bold text-blue-700">{row.country_iso3}</td>
                      <td className="py-2 px-3 font-sans font-medium text-slate-900">{row.country_name}</td>
                      <td className="py-2 px-3 font-sans text-slate-700">
                        {row.state ? (
                          <span className="font-semibold text-blue-900 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-blue-600 shrink-0" />
                            <span>{row.state}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">National</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-900">{row.year}</td>
                      {availableIndicatorCodes.map((code) => {
                        const val = row[code];
                        return (
                          <td key={code} className="py-2 px-3 text-right text-slate-900">
                            {val !== undefined ? (val >= 10000 ? val.toLocaleString(undefined, { maximumFractionDigits: 1 }) : val.toFixed(2)) : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between text-xs text-slate-500 font-mono tabular-nums pt-2">
            <div>
              Showing {(page - 1) * rowsPerPage + 1}–{Math.min(page * rowsPerPage, filteredGridRows.length)} of {filteredGridRows.length.toLocaleString()} rows
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-2.5 py-1 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-30"
              >
                Previous
              </button>
              <span>Page {page} of {totalPages}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-2.5 py-1 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-30"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};
