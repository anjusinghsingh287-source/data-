import React, { useState, useMemo } from 'react';
import {
  Filter,
  RotateCcw,
  Search,
  CheckSquare,
  Square,
  X,
  Building2,
  Globe2,
  Layers,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';

interface CountryItem {
  iso3: string;
  name: string;
  incomeLevel: string;
  region: string;
}

interface VisualizeSidebarProps {
  availableIncomeLevels: string[];
  selectedIncomeLevels: Set<string>;
  onToggleIncomeLevel: (level: string) => void;
  onSelectAllIncomeLevels: () => void;
  onClearAllIncomeLevels: () => void;
  onSelectOnlyIncomeLevel: (level: string) => void;

  availableCountries: CountryItem[];
  selectedCountryIso3s: Set<string>;
  onToggleCountry: (iso3: string) => void;
  onSelectAllCountries: () => void;
  onClearAllCountries: () => void;
  onSelectCountriesPreset: (presetIso3s: string[]) => void;

  totalRecordsCount: number;
  filteredRecordsCount: number;
  onResetAllFilters: () => void;
  isFiltered: boolean;
  onCloseMobile?: () => void;
}

// Preset definitions for quick exploration
const PRESET_GROUPS: { name: string; description: string; iso3s: string[] }[] = [
  {
    name: 'G7 / Advanced',
    description: 'Major advanced economies',
    iso3s: ['USA', 'JPN', 'DEU', 'GBR', 'FRA', 'ITA', 'CAN'],
  },
  {
    name: 'BRICS Economies',
    description: 'Emerging global powers',
    iso3s: ['BRA', 'RUS', 'IND', 'CHN', 'ZAF'],
  },
  {
    name: 'Top 10 by GDP',
    description: 'Largest sovereign economies',
    iso3s: ['USA', 'CHN', 'JPN', 'DEU', 'IND', 'GBR', 'FRA', 'BRA', 'ITA', 'CAN'],
  },
  {
    name: 'State Data Cohort',
    description: 'Federal economies with state panels',
    iso3s: ['USA', 'IND', 'DEU', 'BRA', 'CHN', 'CAN'],
  },
  {
    name: 'Sub-Saharan Core',
    description: 'Regional African sample',
    iso3s: ['NGA', 'ZAF', 'KEN', 'ETH', 'GHA', 'RWA', 'SEN', 'TZA'],
  },
];

export const VisualizeSidebar: React.FC<VisualizeSidebarProps> = ({
  availableIncomeLevels,
  selectedIncomeLevels,
  onToggleIncomeLevel,
  onSelectAllIncomeLevels,
  onClearAllIncomeLevels,
  onSelectOnlyIncomeLevel,
  availableCountries,
  selectedCountryIso3s,
  onToggleCountry,
  onSelectAllCountries,
  onClearAllCountries,
  onSelectCountriesPreset,
  totalRecordsCount,
  filteredRecordsCount,
  onResetAllFilters,
  isFiltered,
  onCloseMobile,
}) => {
  const [countrySearch, setCountrySearch] = useState('');
  const [incomeSectionOpen, setIncomeSectionOpen] = useState(true);
  const [countrySectionOpen, setCountrySectionOpen] = useState(true);
  const [countryFilterByIncome, setCountryFilterByIncome] = useState<string>('ALL');

  // Count countries per income level
  const countryCountByIncome = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of availableCountries) {
      counts[c.incomeLevel] = (counts[c.incomeLevel] || 0) + 1;
    }
    return counts;
  }, [availableCountries]);

  // Filtered countries for the sidebar search list
  const filteredCountryList = useMemo(() => {
    return availableCountries.filter((c) => {
      const matchesSearch =
        !countrySearch ||
        c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
        c.iso3.toLowerCase().includes(countrySearch.toLowerCase());
      const matchesIncome =
        countryFilterByIncome === 'ALL' || c.incomeLevel === countryFilterByIncome;
      return matchesSearch && matchesIncome;
    });
  }, [availableCountries, countrySearch, countryFilterByIncome]);

  const activeCountriesCount = selectedCountryIso3s.size;
  const totalCountriesCount = availableCountries.length;
  const pctCountriesActive = totalCountriesCount > 0
    ? Math.round((activeCountriesCount / totalCountriesCount) * 100)
    : 0;

  const pctRecordsActive = totalRecordsCount > 0
    ? Math.round((filteredRecordsCount / totalRecordsCount) * 100)
    : 0;

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col divide-y divide-slate-100 text-slate-800">
      {/* Header & Filter Scope Overview */}
      <div className="p-4 bg-slate-50/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-600" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Global Filter Controls
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {isFiltered && (
              <button
                onClick={onResetAllFilters}
                title="Reset all filters to full sample"
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset All</span>
              </button>
            )}
            {onCloseMobile && (
              <button
                onClick={onCloseMobile}
                className="lg:hidden p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Observation Filter Metrics */}
        <div className="bg-white p-2.5 rounded border border-slate-200 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Active Observations</span>
            <span className="font-mono font-bold text-slate-900 tabular-nums">
              {filteredRecordsCount.toLocaleString()} / {totalRecordsCount.toLocaleString()}
            </span>
          </div>

          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                isFiltered ? 'bg-amber-500' : 'bg-blue-600'
              }`}
              style={{ width: `${pctRecordsActive}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500">
            <span>{pctRecordsActive}% rows included</span>
            <span>{activeCountriesCount} of {totalCountriesCount} economies</span>
          </div>
        </div>
      </div>

      {/* SECTION 1: Income Groups Filter */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setIncomeSectionOpen(!incomeSectionOpen)}
            className="flex items-center gap-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 hover:text-slate-900"
          >
            <Building2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Income Groups ({selectedIncomeLevels.size}/{availableIncomeLevels.length})</span>
            {incomeSectionOpen ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>

          {incomeSectionOpen && (
            <div className="flex items-center gap-1.5 text-[11px]">
              <button
                onClick={onSelectAllIncomeLevels}
                className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                All
              </button>
              <span className="text-slate-300">·</span>
              <button
                onClick={onClearAllIncomeLevels}
                className="text-slate-500 hover:text-slate-700 font-medium transition-colors"
              >
                None
              </button>
            </div>
          )}
        </div>

        {incomeSectionOpen && (
          <div className="space-y-1.5 pt-1">
            {availableIncomeLevels.map((level) => {
              const isSelected = selectedIncomeLevels.has(level);
              const count = countryCountByIncome[level] || 0;

              return (
                <div
                  key={level}
                  className={`group flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors ${
                    isSelected
                      ? 'bg-blue-50/70 text-slate-900 font-medium'
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0 select-none">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleIncomeLevel(level)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 h-3.5 w-3.5"
                    />
                    <span className="truncate" title={level}>
                      {level}
                    </span>
                  </label>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                      {count} {count === 1 ? 'ctry' : 'ctries'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectOnlyIncomeLevel(level);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-[10px] text-blue-600 hover:underline font-semibold transition-opacity"
                      title={`Filter only to ${level}`}
                    >
                      Only
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: Sovereign Countries Filter */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCountrySectionOpen(!countrySectionOpen)}
            className="flex items-center gap-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 hover:text-slate-900"
          >
            <Globe2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Sovereign Economies ({activeCountriesCount}/{totalCountriesCount})</span>
            {countrySectionOpen ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>

          {countrySectionOpen && (
            <div className="flex items-center gap-1.5 text-[11px]">
              <button
                onClick={onSelectAllCountries}
                className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                All
              </button>
              <span className="text-slate-300">·</span>
              <button
                onClick={onClearAllCountries}
                className="text-slate-500 hover:text-slate-700 font-medium transition-colors"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {countrySectionOpen && (
          <div className="space-y-2.5 pt-1">
            {/* Quick Presets Carousel */}
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Econometric Presets
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {PRESET_GROUPS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => onSelectCountriesPreset(preset.iso3s)}
                    className="text-left px-2 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded truncate transition-colors"
                    title={`${preset.description} (${preset.iso3s.join(', ')})`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Country Search Bar */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={countrySearch}
                onChange={(e) => setCountrySearch(e.target.value)}
                placeholder="Search country or code (e.g. USA)..."
                className="w-full pl-8 pr-7 py-1.5 text-xs text-slate-900 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {countrySearch && (
                <button
                  onClick={() => setCountrySearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter by Income Tier within Country Search */}
            {availableIncomeLevels.length > 1 && (
              <select
                value={countryFilterByIncome}
                onChange={(e) => setCountryFilterByIncome(e.target.value)}
                className="w-full px-2 py-1 text-[11px] text-slate-700 bg-slate-50 border border-slate-200 rounded focus:bg-white"
              >
                <option value="ALL">All Income Tiers ({availableCountries.length})</option>
                {availableIncomeLevels.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl} ({countryCountByIncome[lvl] || 0})
                  </option>
                ))}
              </select>
            )}

            {/* Country Checkbox List */}
            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded bg-slate-50/50 p-1 space-y-0.5">
              {filteredCountryList.length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-400 italic">
                  No matching countries found
                </div>
              ) : (
                filteredCountryList.map((country) => {
                  const isChecked = selectedCountryIso3s.has(country.iso3);

                  return (
                    <label
                      key={country.iso3}
                      className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer text-xs select-none hover:bg-white transition-colors ${
                        isChecked ? 'text-slate-900 font-medium' : 'text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => onToggleCountry(country.iso3)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 h-3.5 w-3.5 shrink-0"
                        />
                        <span className="font-mono text-[11px] font-bold text-blue-700 shrink-0">
                          {country.iso3}
                        </span>
                        <span className="truncate" title={country.name}>
                          {country.name}
                        </span>
                      </div>

                      <span
                        className="text-[10px] text-slate-400 font-mono truncate max-w-[80px] shrink-0 text-right ml-1"
                        title={country.incomeLevel}
                      >
                        {country.incomeLevel.replace(' income', '')}
                      </span>
                    </label>
                  );
                })
              )}
            </div>

            {/* Summary footer inside country block */}
            <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500 pt-1">
              <span>{filteredCountryList.length} matching search</span>
              <button
                type="button"
                onClick={() => {
                  // Toggle all currently visible search results
                  const visibleIso3s = filteredCountryList.map((c) => c.iso3);
                  const allVisibleSelected = visibleIso3s.every((code) => selectedCountryIso3s.has(code));
                  if (allVisibleSelected) {
                    // Deselect visible
                    const next = new Set(selectedCountryIso3s);
                    visibleIso3s.forEach((code) => next.delete(code));
                    onSelectCountriesPreset(Array.from(next));
                  } else {
                    // Select visible
                    const next = new Set(selectedCountryIso3s);
                    visibleIso3s.forEach((code) => next.add(code));
                    onSelectCountriesPreset(Array.from(next));
                  }
                }}
                className="text-blue-600 hover:text-blue-800 font-semibold"
              >
                Toggle Visible ({filteredCountryList.length})
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
