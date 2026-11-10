import React, { useState, useRef } from 'react';
import {
  ResearchTopic,
  KaggleResearchDataset,
  RawRecord,
  WorldBankCountry,
} from '../types';
import {
  RESEARCH_TOPICS,
  KAGGLE_DATASETS,
  CURATED_INDICATORS,
} from '../data/worldBankData';
import { ingestExternalResearchCSV, ParseResult } from '../services/fileIngestionService';
import {
  Sparkles,
  Flame,
  DollarSign,
  HeartPulse,
  GraduationCap,
  Cpu,
  Users,
  ShieldAlert,
  Download,
  Upload,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  Search,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';

interface KaggleTopicsHubProps {
  onApplyTopic: (topic: ResearchTopic, autoCollect?: boolean) => void;
  onApplyKaggleDataset: (dataset: KaggleResearchDataset, autoCollect?: boolean) => void;
  onIngestFileRecords: (records: RawRecord[], sourceName: string) => void;
  countriesMap: Record<string, WorldBankCountry>;
  onAutoCollectAll: () => void;
  isCollecting: boolean;
}

export const KaggleTopicsHub: React.FC<KaggleTopicsHubProps> = ({
  onApplyTopic,
  onApplyKaggleDataset,
  onIngestFileRecords,
  countriesMap,
  onAutoCollectAll,
  isCollecting,
}) => {
  const [hubTab, setHubTab] = useState<'topics' | 'kaggle' | 'upload'>('topics');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('ALL');

  // File upload state
  const [dragActive, setDragActive] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Icon resolver
  const getTopicIcon = (iconName: string) => {
    switch (iconName) {
      case 'DollarSign':
        return <DollarSign className="w-5 h-5 text-emerald-600" />;
      case 'Flame':
        return <Flame className="w-5 h-5 text-amber-600" />;
      case 'HeartPulse':
        return <HeartPulse className="w-5 h-5 text-rose-600" />;
      case 'GraduationCap':
        return <GraduationCap className="w-5 h-5 text-blue-600" />;
      case 'Cpu':
        return <Cpu className="w-5 h-5 text-purple-600" />;
      case 'Users':
        return <Users className="w-5 h-5 text-indigo-600" />;
      case 'ShieldAlert':
        return <ShieldAlert className="w-5 h-5 text-orange-600" />;
      default:
        return <Sparkles className="w-5 h-5 text-blue-600" />;
    }
  };

  // Filter topics
  const filteredTopics = RESEARCH_TOPICS.filter((t) => {
    const matchesSearch =
      !searchQuery ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesTag = selectedTag === 'ALL' || t.tags.includes(selectedTag);
    return matchesSearch && matchesTag;
  });

  // Filter Kaggle datasets
  const filteredKaggleDatasets = KAGGLE_DATASETS.filter((d) => {
    const matchesSearch =
      !searchQuery ||
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesTag = selectedTag === 'ALL' || d.tags.includes(selectedTag);
    return matchesSearch && matchesTag;
  });

  // All unique tags
  const allTags = Array.from(
    new Set([
      ...RESEARCH_TOPICS.flatMap((t) => t.tags),
      ...KAGGLE_DATASETS.flatMap((d) => d.tags),
    ])
  );

  // Handle file drop/change
  const handleFile = (file: File) => {
    if (!file) return;
    setIsParsing(true);
    setUploadedFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const result = ingestExternalResearchCSV(text, countriesMap, file.name);
        setParseResult(result);
      } catch (err: any) {
        setParseResult({
          records: [],
          detectedFormat: 'long',
          rowCount: 0,
          countryCount: 0,
          indicatorCount: 0,
          yearMin: '-',
          yearMax: '-',
          errors: [`File parsing error: ${err.message}`],
        });
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const confirmImportFile = () => {
    if (parseResult && parseResult.records.length > 0) {
      onIngestFileRecords(parseResult.records, uploadedFileName);
      setParseResult(null);
      setUploadedFileName('');
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm space-y-6 p-6">
      {/* Top Banner with Global Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-blue-700 tracking-wider uppercase">
              Global Research Topics & Kaggle Hub
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-emerald-700 font-medium">UPTO 2024 Current Data</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 mt-0.5">
            Auto-Collect Research Topics & External Datasets
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Harvest multi-domain global research topics (Macro, Climate, Health, AI, Education, Inequality) up to current 2024 data, explore Kaggle-curated research packs, or ingest external CSV files.
          </p>
        </div>

        {/* Global Auto-Collect All Action */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={onAutoCollectAll}
            disabled={isCollecting}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded transition-colors shadow-sm"
          >
            {isCollecting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Harvesting Across Topics...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Auto-Collect All Topics (UPTO 2024)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Hub Sub-Tabs & Search Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center p-1 bg-slate-100 rounded-lg text-xs">
          <button
            onClick={() => setHubTab('topics')}
            className={`px-3.5 py-1.5 font-medium rounded transition-colors flex items-center gap-1.5 ${
              hubTab === 'topics'
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Research Topics ({RESEARCH_TOPICS.length})</span>
          </button>

          <button
            onClick={() => setHubTab('kaggle')}
            className={`px-3.5 py-1.5 font-medium rounded transition-colors flex items-center gap-1.5 ${
              hubTab === 'kaggle'
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Kaggle Collections ({KAGGLE_DATASETS.length})</span>
          </button>

          <button
            onClick={() => setHubTab('upload')}
            className={`px-3.5 py-1.5 font-medium rounded transition-colors flex items-center gap-1.5 ${
              hubTab === 'upload'
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Ingest Research CSV / Kaggle File</span>
          </button>
        </div>

        {/* Search */}
        {hubTab !== 'upload' && (
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter topics or tags..."
              className="w-full pl-9 pr-3 py-1.5 text-xs text-slate-900 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}
      </div>

      {/* Tag Filter Pills */}
      {hubTab !== 'upload' && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">
            Domain Tags:
          </span>
          <button
            onClick={() => setSelectedTag('ALL')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              selectedTag === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Domains
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag === selectedTag ? 'ALL' : tag)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                selectedTag === tag
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 1: RESEARCH TOPICS */}
      {/* ======================================================== */}
      {hubTab === 'topics' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTopics.map((topic) => (
            <div
              key={topic.id}
              className="bg-slate-50/70 p-5 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-white transition-all flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="w-8 h-8 rounded bg-white border border-slate-200 flex items-center justify-center shadow-xs">
                    {getTopicIcon(topic.iconName)}
                  </div>
                  <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold tabular-nums">
                    UPTO {topic.suggestedEndYear}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900 mt-2.5">
                  {topic.name}
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {topic.description}
                </p>

                {/* Series list */}
                <div className="mt-3 space-y-1">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Key Indicators ({topic.indicators.length}):
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {topic.indicators.map((code) => {
                      const indMeta = CURATED_INDICATORS.find((i) => i.code === code);
                      return (
                        <span
                          key={code}
                          title={indMeta?.name || code}
                          className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white text-slate-700 border border-slate-200"
                        >
                          {code}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between gap-2">
                <button
                  onClick={() => onApplyTopic(topic, false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded transition-colors"
                >
                  Configure Scope
                </button>

                <button
                  onClick={() => onApplyTopic(topic, true)}
                  disabled={isCollecting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded transition-colors shadow-xs"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Auto-Collect UPTO 2024</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: KAGGLE RESEARCH DATASETS */}
      {/* ======================================================== */}
      {hubTab === 'kaggle' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              Pre-indexed academic packages formatted according to Kaggle Open Data specifications
            </span>
            <a
              href="https://www.kaggle.com/datasets"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 hover:underline"
            >
              <span>Explore Kaggle Datasets</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredKaggleDatasets.map((ds) => (
              <div
                key={ds.id}
                className="bg-white p-5 rounded-lg border border-slate-200 hover:border-slate-300 transition-all flex flex-col justify-between space-y-4 shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                      {ds.topic}
                    </span>
                    <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-slate-500">
                      <span>★ {ds.usabilityScore}/10 Usability</span>
                      <span aria-hidden="true">·</span>
                      <span>{ds.downloadCount.toLocaleString()} dl</span>
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 mt-2">
                    {ds.title}
                  </h3>
                  <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                    <span>By {ds.author}</span>
                    <span aria-hidden="true">·</span>
                    <span>Updated {ds.lastUpdated}</span>
                  </div>

                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    {ds.description}
                  </p>

                  <div className="flex flex-wrap gap-1 mt-3">
                    {ds.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono text-slate-500">
                    Years: {ds.startYear}–{ds.endYear} ({ds.indicators.length} indicators)
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onApplyKaggleDataset(ds, false)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                    >
                      Load Benchmark
                    </button>

                    <button
                      onClick={() => onApplyKaggleDataset(ds, true)}
                      disabled={isCollecting}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded transition-colors shadow-xs"
                    >
                      <Download className="w-3 h-3" />
                      <span>Auto-Collect UPTO 2024</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: INGEST EXTERNAL RESEARCH FILE / KAGGLE CSV */}
      {/* ======================================================== */}
      {hubTab === 'upload' && (
        <div className="space-y-6">
          <div className="max-w-2xl">
            <h3 className="text-sm font-bold text-slate-900">
              Ingest External Research CSV or Kaggle Dataset File
            </h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Upload any tabular CSV file from Kaggle, UN Data, OECD, or your local research lab. The engine auto-detects country identifiers (ISO3 or name), observation years, and series values, mapping them directly into the research pipeline.
            </p>
          </div>

          {/* Drag & Drop Box */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragActive
                ? 'border-blue-500 bg-blue-50/50'
                : 'border-slate-300 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-400'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFile(e.target.files[0]);
                }
              }}
            />

            <FileSpreadsheet className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <div className="text-sm font-semibold text-slate-800">
              Drag & Drop your research file here, or{' '}
              <span className="text-blue-600 underline">browse files</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Supports CSV files with sovereign entity codes, observation years, and quantitative metrics.
            </p>
          </div>

          {/* Parsing Results Card */}
          {isParsing && (
            <div className="p-4 bg-slate-50 rounded border border-slate-200 flex items-center gap-3 text-xs text-slate-600 font-mono">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
              <span>Analyzing columns, schema, and sovereign code mappings...</span>
            </div>
          )}

          {parseResult && parseResult.rowCount > 0 && (
            <div className="bg-emerald-50/60 p-5 rounded-lg border border-emerald-200 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span className="text-sm font-bold text-slate-900">
                    File Analyzed: {uploadedFileName}
                  </span>
                </div>
                <span className="text-xs font-mono text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded font-semibold">
                  Detected: {parseResult.detectedFormat.toUpperCase()} Format
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono tabular-nums">
                <div className="bg-white p-3 rounded border border-emerald-100">
                  <span className="text-[10px] text-slate-500 block uppercase">Rows Ingested</span>
                  <span className="text-base font-bold text-slate-900 block mt-0.5">
                    {parseResult.rowCount.toLocaleString()}
                  </span>
                </div>

                <div className="bg-white p-3 rounded border border-emerald-100">
                  <span className="text-[10px] text-slate-500 block uppercase">Countries Detected</span>
                  <span className="text-base font-bold text-slate-900 block mt-0.5">
                    {parseResult.countryCount} sovereign entities
                  </span>
                </div>

                <div className="bg-white p-3 rounded border border-emerald-100">
                  <span className="text-[10px] text-slate-500 block uppercase">Indicators Detected</span>
                  <span className="text-base font-bold text-slate-900 block mt-0.5">
                    {parseResult.indicatorCount} series
                  </span>
                </div>

                <div className="bg-white p-3 rounded border border-emerald-100">
                  <span className="text-[10px] text-slate-500 block uppercase">Observation Years</span>
                  <span className="text-base font-bold text-slate-900 block mt-0.5">
                    {parseResult.yearMin}–{parseResult.yearMax}
                  </span>
                </div>
              </div>

              {parseResult.errors.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 space-y-1">
                  {parseResult.errors.map((err, i) => (
                    <div key={i}>• {err}</div>
                  ))}
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  onClick={() => setParseResult(null)}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Discard
                </button>
                <button
                  onClick={confirmImportFile}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded shadow-xs transition-colors"
                >
                  <span>Load Into Research Pipeline ({parseResult.rowCount.toLocaleString()} rows)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
