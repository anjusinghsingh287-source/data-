import React, { useState } from 'react';
import { WorldBankIndicator, WorldBankCountry, ResearchPreset, ResearchTopic, KaggleResearchDataset, RawRecord } from '../types';
import { CURATED_INDICATORS, RESEARCH_PRESETS, WORLD_BANK_REGIONS, WORLD_BANK_INCOME_LEVELS } from '../data/worldBankData';
import { Plus, Trash2, Check, ExternalLink, Globe, Layers, Calendar, HelpCircle, ArrowRight, Sparkles } from 'lucide-react';
import { KaggleTopicsHub } from './KaggleTopicsHub';

interface DefineStepProps {
  researchTitle: string;
  setResearchTitle: (t: string) => void;
  selectedIndicators: string[];
  setSelectedIndicators: React.Dispatch<React.SetStateAction<string[]>>;
  startYear: number;
  setStartYear: (y: number) => void;
  endYear: number;
  setEndYear: (y: number) => void;
  selectedRegions: string[];
  setSelectedRegions: React.Dispatch<React.SetStateAction<string[]>>;
  selectedIncomes: string[];
  setSelectedIncomes: React.Dispatch<React.SetStateAction<string[]>>;
  selectedIso3Set: Set<string>;
  setSelectedIso3Set: React.Dispatch<React.SetStateAction<Set<string>>>;
  countriesList: WorldBankCountry[];
  countriesMap: Record<string, WorldBankCountry>;
  onProceed: () => void;
  onApplyTopic: (topic: ResearchTopic, autoCollect?: boolean) => void;
  onApplyKaggleDataset: (dataset: KaggleResearchDataset, autoCollect?: boolean) => void;
  onIngestFileRecords: (records: RawRecord[], sourceName: string) => void;
  onAutoCollectAll: () => void;
  isCollecting: boolean;
  onOpenAiFeed?: () => void;
}

export const DefineStep: React.FC<DefineStepProps> = ({
  researchTitle,
  setResearchTitle,
  selectedIndicators,
  setSelectedIndicators,
  startYear,
  setStartYear,
  endYear,
  setEndYear,
  selectedRegions,
  setSelectedRegions,
  selectedIncomes,
  setSelectedIncomes,
  selectedIso3Set,
  setSelectedIso3Set,
  countriesList,
  countriesMap,
  onProceed,
  onApplyTopic,
  onApplyKaggleDataset,
  onIngestFileRecords,
  onAutoCollectAll,
  isCollecting,
  onOpenAiFeed,
}) => {
  const [customCode, setCustomCode] = useState('');
  const [customName, setCustomName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activePreset, setActivePreset] = useState<string>('default_seven');
  const [countryFilterText, setCountryFilterText] = useState('');
  const [showKaggleHub, setShowKaggleHub] = useState<boolean>(true);

  // Handle Preset application
  const applyPreset = (preset: ResearchPreset) => {
    setActivePreset(preset.id);
    setSelectedIndicators(preset.indicators);
    setStartYear(preset.suggestedStartYear);
    setEndYear(preset.suggestedEndYear);
  };

  // Toggle single indicator
  const toggleIndicator = (code: string) => {
    if (selectedIndicators.includes(code)) {
      if (selectedIndicators.length > 1) {
        setSelectedIndicators(selectedIndicators.filter((c) => c !== code));
      }
    } else {
      setSelectedIndicators([...selectedIndicators, code]);
    }
  };

  // Add custom indicator
  const addCustomIndicator = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = customCode.trim().toUpperCase();
    if (!cleanCode) return;
    if (!selectedIndicators.includes(cleanCode)) {
      setSelectedIndicators([...selectedIndicators, cleanCode]);
    }
    setCustomCode('');
    setCustomName('');
  };

  // Region filter toggle
  const toggleRegion = (region: string) => {
    if (selectedRegions.includes(region)) {
      setSelectedRegions(selectedRegions.filter((r) => r !== region));
    } else {
      setSelectedRegions([...selectedRegions, region]);
    }
  };

  // Income filter toggle
  const toggleIncome = (income: string) => {
    if (selectedIncomes.includes(income)) {
      setSelectedIncomes(selectedIncomes.filter((i) => i !== income));
    } else {
      setSelectedIncomes([...selectedIncomes, income]);
    }
  };

  // Filtered countries based on region & income
  const matchingCountries = countriesList.filter((c) => {
    const matchesRegion = selectedRegions.length === 0 || selectedRegions.includes(c.region);
    const matchesIncome = selectedIncomes.length === 0 || selectedIncomes.includes(c.incomeLevel);
    const matchesText =
      !countryFilterText ||
      c.name.toLowerCase().includes(countryFilterText.toLowerCase()) ||
      c.iso3.toLowerCase().includes(countryFilterText.toLowerCase());
    return matchesRegion && matchesIncome && matchesText;
  });

  const allAvailableMatchingSelected =
    matchingCountries.length > 0 &&
    matchingCountries.every((c) => selectedIso3Set.size === 0 || selectedIso3Set.has(c.iso3));

  const toggleSelectAllMatching = () => {
    if (selectedIso3Set.size === 0) {
      // If none explicitly restricted, selecting "all matching" when regions/incomes are filtered
      const newSet = new Set(matchingCountries.map((c) => c.iso3));
      setSelectedIso3Set(newSet);
    } else {
      // Clear specific override
      setSelectedIso3Set(new Set());
    }
  };

  const yearsSpan = endYear - startYear + 1;
  const effectiveCountryCount =
    selectedIso3Set.size > 0 ? selectedIso3Set.size : matchingCountries.length;

  return (
    <div className="space-y-8 pb-12">
      {/* Editorial Title Section */}
      <div className="border-b border-slate-200 pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-blue-700 tracking-wider uppercase">
            Step 1 · Hypothesis & Specification
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Define Research Variables & Scope
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Select empirical series from the World Bank Open Data catalog, specify sovereign sample boundaries, and configure panel observation years.
          </p>
        </div>

        <button
          onClick={onProceed}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm self-start md:self-auto shrink-0"
        >
          <span>Confirm & Proceed to Collect</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* AI / ML Research Feed Discovery Strip */}
      <div className="bg-gradient-to-r from-blue-50/90 via-slate-50 to-purple-50/70 p-4 rounded-lg border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-600 text-white shrink-0 shadow-xs">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">
                Frontier AI/ML Research Feed (Papers, Datasets & Benchmarks)
              </span>
              <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold bg-blue-600 text-white rounded">
                NEW
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Pick AI topics (LLMs, diffusion models, RL, CV, NLP, benchmarks), auto-collect periodic updates, and track live sources (arXiv, Hugging Face, OpenReview, Kaggle).
            </p>
          </div>
        </div>

        {onOpenAiFeed && (
          <button
            onClick={onOpenAiFeed}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors shadow-xs shrink-0 cursor-pointer"
          >
            <span>Open AI/ML Feed</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Research Project Title & Hypothesis */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Research Project / Paper Title
          </label>
          <input
            type="text"
            value={researchTitle}
            onChange={(e) => setResearchTitle(e.target.value)}
            placeholder="e.g., Cross-Country Empirical Analysis of Macroeconomic Resilience and Health Outcomes"
            className="w-full px-3.5 py-2 text-sm text-slate-900 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
          />
        </div>
      </div>

      {/* Global Research Topics & Kaggle Hub Component */}
      <KaggleTopicsHub
        onApplyTopic={onApplyTopic}
        onApplyKaggleDataset={onApplyKaggleDataset}
        onIngestFileRecords={onIngestFileRecords}
        countriesMap={countriesMap}
        onAutoCollectAll={onAutoCollectAll}
        isCollecting={isCollecting}
      />

      {/* Quick Presets */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 space-y-3">
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
          Curated Research Presets
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {RESEARCH_PRESETS.map((preset) => {
              const isActive = activePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  className={`text-left p-3.5 rounded border transition-all ${
                    isActive
                      ? 'border-blue-600 bg-blue-50/60 ring-1 ring-blue-600 text-slate-900'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold">{preset.title}</span>
                    {isActive && <Check className="w-3.5 h-3.5 text-blue-600" />}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">
                    {preset.description}
                  </p>
                  <div className="mt-2 text-[10px] text-slate-400 font-mono tabular-nums">
                    {preset.indicators.length} indicators · {preset.suggestedStartYear}–{preset.suggestedEndYear}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

      {/* Indicator Selection Grid */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              World Bank Indicator Catalog
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Currently selected: <span className="font-semibold text-slate-900">{selectedIndicators.length} indicators</span>
            </p>
          </div>

          {/* Search catalog */}
          <div className="w-full sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search catalog or code..."
              className="w-full px-3 py-1.5 text-xs text-slate-900 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Selected Indicators Chips (Zero-pill clean buttons) */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Active Research Variables ({selectedIndicators.length})
          </span>
          <div className="flex flex-wrap gap-2">
            {selectedIndicators.map((code) => {
              const meta = CURATED_INDICATORS.find((i) => i.code === code);
              return (
                <div
                  key={code}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded text-xs font-medium text-slate-800 border border-slate-200"
                >
                  <span className="font-mono text-[11px] text-blue-700 font-semibold">{code}</span>
                  <span className="text-slate-600 max-w-[200px] truncate">
                    {meta?.name || code}
                  </span>
                  <button
                    onClick={() => toggleIndicator(code)}
                    disabled={selectedIndicators.length <= 1}
                    className="text-slate-400 hover:text-red-600 disabled:opacity-30 transition-colors p-0.5"
                    title={selectedIndicators.length <= 1 ? "At least one indicator required" : "Remove"}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Indicator Cards List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
          {CURATED_INDICATORS.filter(
            (ind) =>
              !searchQuery ||
              ind.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              ind.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
              ind.category.toLowerCase().includes(searchQuery.toLowerCase())
          ).map((ind) => {
            const isSelected = selectedIndicators.includes(ind.code);
            return (
              <div
                key={ind.code}
                onClick={() => toggleIndicator(ind.code)}
                className={`p-3.5 rounded border cursor-pointer transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500/50'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-blue-800">{ind.code}</span>
                    <span className="text-[11px] text-slate-500">{ind.category}</span>
                  </div>
                  <div className="text-xs font-semibold text-slate-900 mt-1">
                    {ind.name}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug line-clamp-2">
                    {ind.description}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Unit: {ind.unit}</span>
                  <span className={`font-medium ${isSelected ? 'text-blue-600' : 'text-slate-400'}`}>
                    {isSelected ? 'Selected' : 'Click to add'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Custom Indicator Input */}
        <form onSubmit={addCustomIndicator} className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 flex gap-2 w-full">
            <input
              type="text"
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value)}
              placeholder="Add by World Bank Series Code (e.g. FP.CPI.TOTL.ZG)"
              className="flex-1 px-3 py-1.5 text-xs text-slate-900 bg-slate-50 border border-slate-300 rounded font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={!customCode.trim()}
            className="w-full sm:w-auto px-4 py-1.5 text-xs font-semibold text-white bg-slate-800 rounded hover:bg-slate-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Series</span>
          </button>
        </form>
      </div>

      {/* Geographic & Temporal Scope */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Temporal Bounds */}
        <div className="bg-white p-6 rounded-lg border border-slate-200 space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-900">Temporal Window</h3>
          </div>
          <p className="text-xs text-slate-500">
            Define panel observation years. Standard World Bank series update annually.
          </p>

          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Start Year</label>
                <input
                  type="number"
                  min="1960"
                  max={endYear}
                  value={startYear}
                  onChange={(e) => setStartYear(Math.min(parseInt(e.target.value, 10) || 1990, endYear))}
                  className="w-full px-3 py-1.5 text-xs font-mono tabular-nums text-slate-900 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">End Year (up to 2026)</label>
                <input
                  type="number"
                  min={startYear}
                  max="2026"
                  value={endYear}
                  onChange={(e) => setEndYear(Math.min(2026, Math.max(parseInt(e.target.value, 10) || 2026, startYear)))}
                  className="w-full px-3 py-1.5 text-xs font-mono tabular-nums text-slate-900 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Quick Modern Epoch Selection Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase font-semibold text-slate-400">Presets:</span>
              <button
                type="button"
                onClick={() => { setStartYear(2010); setEndYear(2026); }}
                className={`px-2 py-0.5 text-[10px] font-mono rounded border transition-colors cursor-pointer ${
                  startYear === 2010 && endYear === 2026
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                2010–2026 (Full Panel)
              </button>
              <button
                type="button"
                onClick={() => { setStartYear(2015); setEndYear(2026); }}
                className={`px-2 py-0.5 text-[10px] font-mono rounded border transition-colors cursor-pointer ${
                  startYear === 2015 && endYear === 2026
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                2015–2026 (Decade)
              </button>
              <button
                type="button"
                onClick={() => { setStartYear(2020); setEndYear(2026); }}
                className={`px-2 py-0.5 text-[10px] font-mono rounded border transition-colors cursor-pointer ${
                  startYear === 2020 && endYear === 2026
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                2020–2026 (Recent ML)
              </button>
            </div>

            <div className="bg-slate-50 p-2.5 rounded text-[11px] text-slate-600 font-mono tabular-nums flex items-center justify-between">
              <span>Span: <strong className="text-slate-900">{yearsSpan} years</strong> ({startYear} to {endYear})</span>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                Data through 2026 Active
              </span>
            </div>
          </div>
        </div>

        {/* Geographic Region Filters */}
        <div className="bg-white p-6 rounded-lg border border-slate-200 space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-slate-900">Geographic & Income Boundaries</h3>
            </div>
            <div className="text-[11px] text-slate-500">
              Aggregates automatically dropped per script
            </div>
          </div>

          <div className="space-y-4 pt-1">
            {/* World Bank Regions */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                  Filter by World Bank Region {selectedRegions.length > 0 && `(${selectedRegions.length} active)`}
                </span>
                {selectedRegions.length > 0 && (
                  <button
                    onClick={() => setSelectedRegions([])}
                    className="text-[11px] text-blue-600 hover:underline"
                  >
                    Reset all regions
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {WORLD_BANK_REGIONS.map((region) => {
                  const isActive = selectedRegions.includes(region);
                  return (
                    <button
                      key={region}
                      onClick={() => toggleRegion(region)}
                      className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                        isActive
                          ? 'bg-blue-600 text-white border-blue-600 font-medium'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {region}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Income Levels */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                  Filter by Income Classification {selectedIncomes.length > 0 && `(${selectedIncomes.length} active)`}
                </span>
                {selectedIncomes.length > 0 && (
                  <button
                    onClick={() => setSelectedIncomes([])}
                    className="text-[11px] text-blue-600 hover:underline"
                  >
                    Reset income levels
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {WORLD_BANK_INCOME_LEVELS.map((income) => {
                  const isActive = selectedIncomes.includes(income);
                  return (
                    <button
                      key={income}
                      onClick={() => toggleIncome(income)}
                      className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                        isActive
                          ? 'bg-slate-900 text-white border-slate-900 font-medium'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {income}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Scope Summary */}
            <div className="bg-slate-50 p-3 rounded flex items-center justify-between text-xs text-slate-700 font-mono tabular-nums">
              <span>Matching sovereign entities: <strong className="text-slate-900">{matchingCountries.length}</strong></span>
              <span>Theoretical max observations: <strong className="text-blue-700">{(effectiveCountryCount * selectedIndicators.length * yearsSpan).toLocaleString()}</strong></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
