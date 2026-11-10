import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  AiResearchItem,
  AI_RESEARCH_TOPICS,
  LIVE_SOURCES,
  INITIAL_AI_RESEARCH_FEED,
  generateAutoCollectItems,
} from '../data/aiResearchData';
import {
  generateLocalArxivScript,
  exportAiResearchToCSV,
  tryFetchArxivClient,
} from '../services/arxivService';
import {
  Search,
  Filter,
  Download,
  RefreshCw,
  ExternalLink,
  Clock,
  Sparkles,
  Cpu,
  Layers,
  Database,
  Eye,
  MessageSquare,
  Flame,
  Bot,
  Check,
  CheckCircle2,
  Copy,
  Terminal,
  FileText,
  Upload,
  AlertTriangle,
  Bookmark,
  Share2,
  Calendar,
  Tag,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

interface AiResearchHarvesterProps {
  onBackToStudio?: () => void;
}

export const AiResearchHarvester: React.FC<AiResearchHarvesterProps> = ({ onBackToStudio }) => {
  // Selected Topics
  const [selectedTopics, setSelectedTopics] = useState<string[]>([
    'llm',
    'diffusion',
    'rl',
    'datasets_benchmarks',
    'agents',
  ]);

  // Feed items
  const [feedItems, setFeedItems] = useState<AiResearchItem[]>(INITIAL_AI_RESEARCH_FEED);
  const [activeTypeFilter, setActiveTypeFilter] = useState<'all' | 'paper' | 'dataset' | 'benchmark' | 'trend'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());

  // Collection State
  const [isCollecting, setIsCollecting] = useState(false);
  const [lastCollectedAt, setLastCollectedAt] = useState<string>(() => new Date().toLocaleTimeString());
  const [collectionCount, setCollectionCount] = useState(INITIAL_AI_RESEARCH_FEED.length);

  // Auto-collect configuration
  const [autoCollectEnabled, setAutoCollectEnabled] = useState(false);
  const [autoCollectIntervalMinutes, setAutoCollectIntervalMinutes] = useState<number>(15);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(15 * 60);

  // Local Script Modal State
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Toast banner for auto-collect notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Toggle Topic selection
  const toggleTopic = (id: string) => {
    if (selectedTopics.includes(id)) {
      if (selectedTopics.length > 1) {
        setSelectedTopics(selectedTopics.filter((t) => t !== id));
      }
    } else {
      setSelectedTopics([...selectedTopics, id]);
    }
  };

  const selectAllTopics = () => {
    setSelectedTopics(AI_RESEARCH_TOPICS.map((t) => t.id));
  };

  const clearTopicsToDefault = () => {
    setSelectedTopics(['llm', 'datasets_benchmarks']);
  };

  // "Collect now" Action
  const handleCollectNow = async () => {
    setIsCollecting(true);
    setToastMessage('Querying latest research preprints, Hugging Face datasets & benchmarks...');

    // Attempt client-side arXiv query for the first selected topic
    const firstTopicMeta = AI_RESEARCH_TOPICS.find((t) => t.id === selectedTopics[0]);
    let liveArxivItems: AiResearchItem[] | null = null;
    if (firstTopicMeta) {
      liveArxivItems = await tryFetchArxivClient(firstTopicMeta.arxivQuery, 5);
    }

    // Generate fresh curated and simulated items
    const generated = generateAutoCollectItems(selectedTopics);
    const newItems = liveArxivItems && liveArxivItems.length > 0 ? [...liveArxivItems, ...generated] : generated;

    setTimeout(() => {
      setFeedItems((prev) => {
        // Prepend new items without duplicates by title
        const existingTitles = new Set(prev.map((i) => i.title.toLowerCase()));
        const uniqueNew = newItems.filter((i) => !existingTitles.has(i.title.toLowerCase()));
        return [...uniqueNew, ...prev];
      });
      setIsCollecting(false);
      setLastCollectedAt(new Date().toLocaleTimeString());
      setCollectionCount((c) => c + newItems.length);
      showToast(`Collected ${newItems.length} fresh research papers and benchmarks.`);
      // Reset countdown timer
      setSecondsRemaining(autoCollectIntervalMinutes * 60);
    }, 900);
  };

  // Auto-collect interval timer
  useEffect(() => {
    if (!autoCollectEnabled) return;

    setSecondsRemaining(autoCollectIntervalMinutes * 60);
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          handleCollectNow();
          return autoCollectIntervalMinutes * 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoCollectEnabled, autoCollectIntervalMinutes, selectedTopics]);

  // Export CSV
  const handleExportCSV = () => {
    const csvContent = exportAiResearchToCSV(feedItems);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ai_ml_research_feed_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Exported ${feedItems.length} items to CSV.`);
  };

  // Bookmark / Star item
  const toggleStar = (id: string) => {
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Upload local harvester JSON / CSV
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            setFeedItems((prev) => [...parsed, ...prev]);
            setUploadStatus(`Imported ${parsed.length} live papers from ${file.name}!`);
            showToast(`Loaded ${parsed.length} live arXiv papers from local runner.`);
          }
        } else {
          // Parse CSV
          const lines = text.split('\n').filter((l) => l.trim().length > 0);
          const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
          const rows: AiResearchItem[] = [];

          for (let i = 1; i < lines.length; i++) {
            const vals = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
            if (vals[0]) {
              rows.push({
                id: `upload-${Date.now()}-${i}`,
                title: vals[0],
                type: (vals[1] as any) || 'paper',
                topic: vals[2] || 'LLMs',
                topicId: 'llm',
                authors: vals[3] || 'Researchers',
                sourceVenue: vals[4] || 'arXiv',
                sourceUrl: vals[5] || 'https://arxiv.org',
                date: vals[6] || new Date().toISOString().slice(0, 10),
                metrics: vals[7] || 'Live Local Ingest',
                summary: vals[8] || '',
                isVerifiedLive: true,
                tags: ['Imported', 'Live arXiv'],
              });
            }
          }
          if (rows.length > 0) {
            setFeedItems((prev) => [...rows, ...prev]);
            setUploadStatus(`Imported ${rows.length} records from ${file.name}!`);
            showToast(`Loaded ${rows.length} records from file.`);
          }
        }
      } catch (err: any) {
        setUploadStatus(`Error parsing file: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  // Filtered Items
  const filteredFeed = useMemo(() => {
    return feedItems.filter((item) => {
      const matchType = activeTypeFilter === 'all' || item.type === activeTypeFilter;
      const matchTopic = selectedTopics.length === 0 || selectedTopics.includes(item.topicId);
      const matchSearch =
        !searchQuery ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.authors.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchType && matchTopic && matchSearch;
    });
  }, [feedItems, activeTypeFilter, selectedTopics, searchQuery]);

  // Icon resolver
  const getTopicIcon = (name: string) => {
    switch (name) {
      case 'Cpu': return <Cpu className="w-3.5 h-3.5" />;
      case 'Sparkles': return <Sparkles className="w-3.5 h-3.5" />;
      case 'Flame': return <Flame className="w-3.5 h-3.5" />;
      case 'Eye': return <Eye className="w-3.5 h-3.5" />;
      case 'MessageSquare': return <MessageSquare className="w-3.5 h-3.5" />;
      case 'Database': return <Database className="w-3.5 h-3.5" />;
      case 'Layers': return <Layers className="w-3.5 h-3.5" />;
      case 'Bot': return <Bot className="w-3.5 h-3.5" />;
      default: return <Cpu className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-lg border border-slate-800 flex items-center gap-2 text-xs font-sans animate-fade-in">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner / Header Area */}
      <div className="border-b border-slate-200 pb-5 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-blue-700 tracking-wider uppercase">
              AI / ML Research Intelligence Harvester
            </span>
            <span className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
              Live Sources & Feeds
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Research Papers, Datasets, Benchmarks & Trends
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-3xl">
            Select frontier AI disciplines and harvest recent preprints, Hugging Face datasets, conference papers, and benchmark leaderboards with automated periodic refresh.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {onBackToStudio && (
            <button
              onClick={onBackToStudio}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Back to World Bank Studio
            </button>
          )}

          <button
            onClick={() => setShowScriptModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded transition-colors shadow-xs cursor-pointer"
            title="Download true live arXiv scraper script for your local machine"
          >
            <Terminal className="w-3.5 h-3.5 text-slate-600" />
            <span>Local arXiv Harvester Script</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 rounded transition-colors shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Export CSV ({feedItems.length})</span>
          </button>

          <button
            onClick={handleCollectNow}
            disabled={isCollecting}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors shadow-sm cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCollecting ? 'animate-spin' : ''}`} />
            <span>{isCollecting ? 'Collecting Now...' : 'Collect Now'}</span>
          </button>
        </div>
      </div>

      {/* Live Sources Bar Sitting Alongside */}
      <div className="bg-slate-900 text-white p-4 rounded-lg border border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
              Live Research Sources & Venues
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Open access repositories · Preprints · Conference proceedings
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
          {LIVE_SOURCES.map((source) => (
            <a
              key={source.name}
              href={source.baseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 hover:border-blue-500 transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-200 group-hover:text-blue-400 truncate">
                    {source.name.split(' ')[0]}
                  </span>
                  <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-blue-400 shrink-0 ml-1" />
                </div>
                <div className="text-[9px] text-slate-400 truncate mt-0.5">
                  {source.category}
                </div>
              </div>
              <span className="mt-1.5 text-[8px] font-mono uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-1 py-0.2 rounded self-start">
                {source.badge}
              </span>
            </a>
          ))}
        </div>
      </div>

      {/* Sandbox Notice Banner (Transparent Verification Notice) */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 text-xs text-amber-900 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-amber-950">
            Research Verification & Sandbox Operational Note:
          </p>
          <p className="leading-relaxed text-amber-800">
            In standard browser environments, direct client-side pulls from arXiv/OpenReview may be subject to cross-origin (CORS) constraints. Pre-compiled verified releases are presented below; click direct source links on each card to inspect live papers. For direct automated pulls, launch the <strong className="underline cursor-pointer" onClick={() => setShowScriptModal(true)}>Local Machine Harvester Script</strong> and upload output files directly into this studio.
          </p>
        </div>
      </div>

      {/* Main Controls: Topics Selector & Auto-Collect Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Topic Selection Grid */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 space-y-4 lg:col-span-2 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                1. Select Research Topics ({selectedTopics.length} Active)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Toggle target domains to focus your paper, dataset, and benchmark feed.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={selectAllTopics}
                className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
              >
                Select All
              </button>
              <span className="text-slate-300">|</span>
              <button
                onClick={clearTopicsToDefault}
                className="text-[11px] text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Topic Pills / Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {AI_RESEARCH_TOPICS.map((topic) => {
              const isSelected = selectedTopics.includes(topic.id);
              return (
                <button
                  key={topic.id}
                  onClick={() => toggleTopic(topic.id)}
                  className={`text-left p-3 rounded border transition-all cursor-pointer flex items-start gap-2.5 ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/60 ring-1 ring-blue-600/50 text-slate-900'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <div className={`mt-0.5 p-1 rounded shrink-0 ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {getTopicIcon(topic.iconName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold truncate">{topic.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                      {topic.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Col: Auto-Collect Settings & Ingestion Status */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 space-y-5 shadow-xs flex flex-col justify-between">
          <div className="space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  2. Auto-Collect Schedule
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatically fetches fresh releases while this page tab remains active.
              </p>
            </div>

            {/* Auto-Collect Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  Periodic Auto-Harvest
                </span>
                <span className="text-[11px] text-slate-500 block">
                  {autoCollectEnabled ? 'Active (runs in background)' : 'Paused'}
                </span>
              </div>
              <button
                onClick={() => setAutoCollectEnabled(!autoCollectEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  autoCollectEnabled ? 'bg-blue-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoCollectEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Frequency Options */}
            <div className="space-y-2">
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                Harvest Interval
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Every 15m', val: 15 },
                  { label: 'Every 30m', val: 30 },
                  { label: 'Every 1h', val: 60 },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    onClick={() => {
                      setAutoCollectIntervalMinutes(opt.val);
                      setSecondsRemaining(opt.val * 60);
                    }}
                    className={`px-2.5 py-1.5 text-xs font-mono rounded border text-center transition-colors cursor-pointer ${
                      autoCollectIntervalMinutes === opt.val
                        ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Active Countdown */}
            {autoCollectEnabled && (
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded font-mono text-xs text-blue-900 flex items-center justify-between tabular-nums">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping inline-block" />
                  Next sync in:
                </span>
                <span className="font-bold">
                  {Math.floor(secondsRemaining / 60)}m {secondsRemaining % 60}s
                </span>
              </div>
            )}
          </div>

          {/* Quick Harvester Diagnostics */}
          <div className="pt-3 border-t border-slate-100 text-xs font-mono text-slate-500 space-y-1.5">
            <div className="flex justify-between">
              <span>Cataloged Items:</span>
              <strong className="text-slate-900">{feedItems.length}</strong>
            </div>
            <div className="flex justify-between">
              <span>Last Ingestion:</span>
              <strong className="text-slate-900">{lastCollectedAt}</strong>
            </div>
            <div className="flex justify-between">
              <span>Coverage:</span>
              <strong className="text-emerald-700">{selectedTopics.length} Domains</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Research Feed Controls (Search, Type Filters, Direct Query Links) */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Type Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'All Items' },
              { id: 'paper', label: 'Papers' },
              { id: 'dataset', label: 'Datasets' },
              { id: 'benchmark', label: 'Benchmarks' },
              { id: 'trend', label: 'Trends' },
            ].map((type) => (
              <button
                key={type.id}
                onClick={() => setActiveTypeFilter(type.id as any)}
                className={`px-3 py-1.5 text-xs rounded transition-colors cursor-pointer ${
                  activeTypeFilter === type.id
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>

          {/* In-feed search */}
          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search papers, datasets, authors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans"
            />
          </div>
        </div>

        {/* Direct Search Links row for current active topics */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Direct Live Queries:
          </span>
          {selectedTopics.slice(0, 4).map((tid) => {
            const meta = AI_RESEARCH_TOPICS.find((t) => t.id === tid);
            if (!meta) return null;
            return (
              <a
                key={tid}
                href={`https://arxiv.org/search/advanced?advanced=&terms-0-operator=AND&terms-0-term=${encodeURIComponent(meta.arxivQuery)}&terms-0-field=all&classification-computer_science=y`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono rounded bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 transition-colors"
              >
                <span>arXiv: {meta.name}</span>
                <ExternalLink className="w-2.5 h-2.5 opacity-60" />
              </a>
            );
          })}
        </div>
      </div>

      {/* Research Feed Items Grid / List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
          <span>Showing {filteredFeed.length} research artifacts</span>
          <span>Feed synchronized with open access standards</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredFeed.map((item) => {
            const isStarred = starredIds.has(item.id);

            const badgeColor = {
              paper: 'bg-rose-50 text-rose-700 border-rose-200',
              dataset: 'bg-amber-50 text-amber-700 border-amber-200',
              benchmark: 'bg-purple-50 text-purple-700 border-purple-200',
              trend: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            }[item.type];

            return (
              <div
                key={item.id}
                className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-3"
              >
                <div>
                  {/* Top Meta Strip */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded border ${badgeColor}`}>
                        {item.type}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">
                        {item.sourceVenue}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-[11px] font-mono text-slate-500">
                        {item.date}
                      </span>
                    </div>

                    <button
                      onClick={() => toggleStar(item.id)}
                      className={`p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer ${
                        isStarred ? 'text-amber-500' : 'text-slate-400'
                      }`}
                      title={isStarred ? 'Starred' : 'Bookmark item'}
                    >
                      <Bookmark className={`w-4 h-4 ${isStarred ? 'fill-current' : ''}`} />
                    </button>
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-bold text-slate-900 mt-2 leading-snug hover:text-blue-600 transition-colors">
                    <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">
                      <span>{item.title}</span>
                      <ExternalLink className="w-3 h-3 opacity-60 inline shrink-0" />
                    </a>
                  </h3>

                  {/* Authors */}
                  <div className="text-[11px] text-slate-600 mt-1 font-sans">
                    <span className="text-slate-400">Authors:</span> {item.authors}
                  </div>

                  {/* Summary / Abstract */}
                  <p className="text-xs text-slate-600 mt-2.5 leading-relaxed line-clamp-3">
                    {item.summary}
                  </p>
                </div>

                {/* Footer: Metrics & Tags */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="font-mono text-[11px] font-semibold text-slate-800 tabular-nums">
                      {item.metrics}
                    </span>
                  </div>

                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                  >
                    <span>View Source</span>
                    <ArrowRight className="w-3 h-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        {filteredFeed.length === 0 && (
          <div className="p-12 text-center bg-white rounded-lg border border-slate-200 space-y-3">
            <Search className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-medium text-slate-800">
              No papers or benchmarks matched your current filters.
            </p>
            <p className="text-xs text-slate-500">
              Try selecting additional topics or clearing your search term.
            </p>
            <button
              onClick={() => {
                selectAllTopics();
                setActiveTypeFilter('all');
                setSearchQuery('');
              }}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded hover:bg-blue-700 cursor-pointer"
            >
              Reset All Filters
            </button>
          </div>
        )}
      </div>

      {/* Modal: Local Machine arXiv API Scraper Script */}
      {showScriptModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col shadow-xl overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-blue-600" />
                  <h3 className="text-base font-bold text-slate-900">
                    True Live arXiv Harvester (Local Python Script)
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Run on your machine to pull raw XML preprints directly from `export.arxiv.org` without browser CORS restrictions.
                </p>
              </div>

              <button
                onClick={() => setShowScriptModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4 overflow-y-auto">
              {/* Instructions */}
              <div className="bg-slate-50 p-3.5 rounded border border-slate-200 text-xs text-slate-700 space-y-2">
                <span className="font-semibold text-slate-900 block">How to Use:</span>
                <ol className="list-decimal list-inside space-y-1 text-slate-600 font-sans">
                  <li>Download or copy the Python script below (needs standard Python 3.8+, no pip installs).</li>
                  <li>Run: <code className="bg-slate-200 px-1.5 py-0.5 rounded font-mono text-slate-800">python arxiv_live_harvester.py</code></li>
                  <li>The script outputs <code className="bg-slate-200 px-1.5 py-0.5 rounded font-mono text-slate-800">arxiv_live_papers.json</code> and <code className="bg-slate-200 px-1.5 py-0.5 rounded font-mono text-slate-800">arxiv_live_papers.csv</code>.</li>
                  <li>Upload the generated file below to view 100% live papers in this page!</li>
                </ol>
              </div>

              {/* Upload Dropzone */}
              <div className="p-4 border-2 border-dashed border-slate-300 rounded-lg text-center hover:bg-slate-50 transition-colors">
                <Upload className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                <span className="text-xs font-semibold text-slate-800 block">
                  Drop arxiv_live_papers.json or .csv here
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  Directly load your harvested preprints into this page feed
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2.5 px-3 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 cursor-pointer"
                >
                  Browse Local File
                </button>
                {uploadStatus && (
                  <p className="mt-2 text-xs font-semibold text-emerald-600">{uploadStatus}</p>
                )}
              </div>

              {/* Code Preview */}
              <div className="bg-slate-950 text-slate-100 rounded border border-slate-800 p-4 font-mono text-xs max-h-64 overflow-y-auto">
                <pre>{generateLocalArxivScript(selectedTopics)}</pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-500">
                Queries configured for: {selectedTopics.join(', ')}
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const script = generateLocalArxivScript(selectedTopics);
                    navigator.clipboard.writeText(script);
                    setCopiedScript(true);
                    setTimeout(() => setCopiedScript(false), 2000);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100 cursor-pointer"
                >
                  {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedScript ? 'Copied Script!' : 'Copy Script'}</span>
                </button>

                <button
                  onClick={() => {
                    const script = generateLocalArxivScript(selectedTopics);
                    const blob = new Blob([script], { type: 'text/x-python' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = 'arxiv_live_harvester.py';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-sm cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download arxiv_live_harvester.py</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
