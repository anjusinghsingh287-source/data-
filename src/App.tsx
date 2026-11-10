import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Header } from './components/Header';
import { DefineStep } from './components/DefineStep';
import { CollectStep } from './components/CollectStep';
import { CleanStep } from './components/CleanStep';
import { QualityStep } from './components/QualityStep';
import { VisualizeStep } from './components/VisualizeStep';
import { ExportStep } from './components/ExportStep';
import { AiResearchHarvester } from './components/AiResearchHarvester';

import {
  RawRecord,
  CleanRecord,
  CleaningOptions,
  WorldBankCountry,
  ResearchTopic,
  KaggleResearchDataset,
} from './types';
import {
  REFERENCE_COUNTRIES,
  RAW_COLLECTION_MOCK_FALLBACK,
} from './data/worldBankData';
import { generateCuratedSubnationalRecords } from './data/subnationalData';
import {
  fetchWorldBankCountries,
  collectWorldBankData,
  cleanRecords,
  generateQualityReport,
  computeIndicatorStats,
  exportToCSV,
  ProgressCallbackData,
} from './services/worldBankService';
import {
  ScheduleConfig,
  loadScheduleConfig,
  saveScheduleConfig,
  recordCompletedSync,
  checkIsQuarterlySyncDue,
} from './services/scheduleService';

export default function App() {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>(loadScheduleConfig);
  const [researchTitle, setResearchTitle] = useState<string>(
    'Global Development & Sustainability Indicators (World Bank Open Data)'
  );

  // Indicators: defaults matching Python script
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([
    'SP.POP.TOTL',
    'NY.GDP.PCAP.CD',
    'SP.DYN.LE00.IN',
    'SE.ADT.LITR.ZS',
    'EN.ATM.CO2E.PC',
    'SL.UEM.TOTL.ZS',
    'IT.NET.USER.ZS',
  ]);

  // Temporal range up to current 2026 data
  const [startYear, setStartYear] = useState<number>(2010);
  const [endYear, setEndYear] = useState<number>(2026);

  // Geographic boundaries
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedIncomes, setSelectedIncomes] = useState<string[]>([]);
  const [selectedIso3Set, setSelectedIso3Set] = useState<Set<string>>(new Set());

  // Countries lookup map
  const [countriesMap, setCountriesMap] = useState<Record<string, WorldBankCountry>>(() => {
    const map: Record<string, WorldBankCountry> = {};
    for (const c of REFERENCE_COUNTRIES) {
      map[c.iso3] = c;
    }
    return map;
  });

  // Raw collected records buffer
  const [rawRecords, setRawRecords] = useState<RawRecord[]>(RAW_COLLECTION_MOCK_FALLBACK);

  // Cleaning options
  const [cleaningOptions, setCleaningOptions] = useState<CleaningOptions>({
    dropNulls: true,
    dropDuplicates: true,
    dropOutliers: false,
    imputation: 'none',
  });

  // Live collection state
  const [isCollecting, setIsCollecting] = useState<boolean>(false);
  const [progress, setProgress] = useState<ProgressCallbackData | null>(null);
  const [logs, setLogs] = useState<string[]>([
    '[INIT] Global Data Collection Studio initialized.',
    '[INFO] Loaded standard baseline panel: 7 indicators, sovereign countries, 2018–2023.',
    '[READY] Ready to harvest live World Bank API or modify research variables.',
  ]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load countries on mount
  useEffect(() => {
    let isMounted = true;
    fetchWorldBankCountries().then((loaded) => {
      if (isMounted && Object.keys(loaded).length > 0) {
        setCountriesMap(loaded);
        setLogs((prev) => [
          ...prev,
          `[INFO] World Bank Country Directory synced: ${Object.keys(loaded).length} sovereign entities ready.`,
        ]);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Compute Clean Records dynamically whenever raw records or cleaning options change
  const { cleaned: cleanData, duplicatesRemoved, emptyRemoved } = useMemo(() => {
    return cleanRecords(rawRecords, cleaningOptions);
  }, [rawRecords, cleaningOptions]);

  // Quality Report
  const qualityReport = useMemo(() => {
    return generateQualityReport(rawRecords, cleanData);
  }, [rawRecords, cleanData]);

  // Indicator Statistics
  const indicatorStats = useMemo(() => {
    return computeIndicatorStats(cleanData);
  }, [cleanData]);

  // Start live API harvest (with optional overrides for auto-collection)
  const handleStartCollection = async (
    indicatorsOverride?: string[],
    startOverride?: number,
    endOverride?: number
  ) => {
    if (isCollecting) return;

    const targetIndicators = indicatorsOverride || selectedIndicators;
    const targetStart = startOverride !== undefined ? startOverride : startYear;
    const targetEnd = endOverride !== undefined ? endOverride : endYear;

    setIsCollecting(true);
    setProgress(null);
    setLogs((prev) => [
      ...prev,
      `--- INITIATING LIVE WORLD BANK HARVEST [${new Date().toLocaleTimeString()}] ---`,
      `Target: ${targetIndicators.length} indicators, Years: ${targetStart}–${targetEnd} (UPTO CURRENT DATA)`,
    ]);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const records = await collectWorldBankData(
        targetIndicators,
        targetStart,
        targetEnd,
        countriesMap,
        selectedIso3Set.size > 0 ? selectedIso3Set : undefined,
        (data) => {
          setProgress(data);
          setLogs((prev) => [...prev.slice(-300), data.logMessage]);
        },
        abortController.signal
      );

      if (records.length > 0) {
        setRawRecords(records);
        const updatedConfig = recordCompletedSync(
          scheduleConfig,
          records.length,
          'success',
          `Quarterly data sync completed (${records.length} observations)`
        );
        setScheduleConfig(updatedConfig);
        setLogs((prev) => [
          ...prev,
          `[SUCCESS] Harvest Complete! Collected ${records.length} raw observations across topics.`,
          `[SCHEDULED] Next quarterly harvest scheduled for ${new Date(updatedConfig.nextSyncUtc).toLocaleDateString()} (in 3 months).`,
        ]);
      } else {
        setLogs((prev) => [
          ...prev,
          `[NOTICE] Zero records returned for selected parameters. Retaining previous dataset buffer.`,
        ]);
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message.includes('stopped')) {
        setLogs((prev) => [...prev, '[CANCELLED] Harvest stopped by researcher.']);
      } else {
        setLogs((prev) => [
          ...prev,
          `[ERROR] Harvest failed: ${err.message}. Retaining benchmark buffer.`,
        ]);
      }
    } finally {
      setIsCollecting(false);
      abortControllerRef.current = null;
    }
  };

  // Stop collection
  const handleStopCollection = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // Reload benchmark reference cache
  const handleLoadPrecached = () => {
    setRawRecords(RAW_COLLECTION_MOCK_FALLBACK);
    setLogs((prev) => [
      ...prev,
      `[RESTORE] Re-loaded curated benchmark reference sample (${RAW_COLLECTION_MOCK_FALLBACK.length} observations).`,
    ]);
  };

  // Multi-Topic & Kaggle Ingestion Handlers
  const handleApplyTopic = (topic: ResearchTopic, autoCollect: boolean = false) => {
    setSelectedIndicators(topic.indicators);
    setStartYear(topic.suggestedStartYear);
    setEndYear(topic.suggestedEndYear);
    setResearchTitle(`${topic.name} Empirical Analysis (UPTO ${topic.suggestedEndYear})`);
    setLogs((prev) => [
      ...prev,
      `[TOPIC LOADED] "${topic.name}": configured ${topic.indicators.length} indicators (UPTO ${topic.suggestedEndYear}).`,
    ]);

    if (autoCollect) {
      setActiveStep(2);
      setTimeout(() => {
        handleStartCollection(topic.indicators, topic.suggestedStartYear, topic.suggestedEndYear);
      }, 100);
    }
  };

  const handleApplyKaggleDataset = (dataset: KaggleResearchDataset, autoCollect: boolean = false) => {
    setSelectedIndicators(dataset.indicators);
    setStartYear(dataset.startYear);
    setEndYear(dataset.endYear);
    setResearchTitle(dataset.title);
    setLogs((prev) => [
      ...prev,
      `[KAGGLE PACKAGE] "${dataset.title}": configured ${dataset.indicators.length} series (UPTO ${dataset.endYear}).`,
    ]);

    if (autoCollect) {
      setActiveStep(2);
      setTimeout(() => {
        handleStartCollection(dataset.indicators, dataset.startYear, dataset.endYear);
      }, 100);
    }
  };

  const handleIngestFileRecords = (records: RawRecord[], sourceName: string) => {
    setRawRecords(records);
    const indCodes = Array.from(new Set(records.map((r) => r.indicator_code)));
    setSelectedIndicators(indCodes);
    setResearchTitle(`Ingested Dataset: ${sourceName}`);
    setLogs((prev) => [
      ...prev,
      `[FILE INGEST] Ingested ${records.length} observations across ${indCodes.length} series from ${sourceName}.`,
      `[PIPELINE] Automatically routed to Clean & Quality Diagnostics.`,
    ]);
    setActiveStep(3); // proceed to clean
  };

  const handleAutoCollectAll = () => {
    const allCoreIndicators = [
      'NY.GDP.PCAP.CD',
      'FP.CPI.TOTL.ZG',
      'EN.ATM.CO2E.PC',
      'EG.FEC.RNEW.ZS',
      'SP.DYN.LE00.IN',
      'IT.NET.USER.ZS',
      'SE.ADT.LITR.ZS',
      'SL.UEM.TOTL.ZS',
      'SP.POP.TOTL',
    ];
    setSelectedIndicators(allCoreIndicators);
    setStartYear(2005);
    setEndYear(2024);
    setResearchTitle('Global Multi-Domain Research Panel (UPTO 2024)');
    setActiveStep(2);
    setTimeout(() => {
      handleStartCollection(allCoreIndicators, 2005, 2024);
    }, 100);
  };

  // Sub-national State / Province Data Loader
  const handleLoadSubnationalData = () => {
    const subnational = generateCuratedSubnationalRecords();
    setRawRecords((prev) => {
      const existingKeys = new Set(
        prev.map((r) => `${r.country_iso3}__${r.state || 'national'}__${r.year}__${r.indicator_code}`)
      );
      const filteredNew = subnational.filter(
        (r) => !existingKeys.has(`${r.country_iso3}__${r.state || 'national'}__${r.year}__${r.indicator_code}`)
      );
      return [...prev, ...filteredNew];
    });
    setLogs((prev) => [
      ...prev,
      `[SUBNATIONAL SEGREGATION] Ingested ${subnational.length} sub-national observations across States & Provinces of USA, India, Germany, Brazil (2020–2024).`,
    ]);
  };

  // Export CSV
  const handleExportCsv = (format: 'long' | 'wide' = 'long') => {
    const csvContent = exportToCSV(cleanData, format);
    const filename = format === 'long' ? 'global_data.csv' : 'global_data_wide_panel.csv';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const countriesList = Object.values(countriesMap);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Header with Top Bar Contract */}
      <Header
        activeStep={activeStep}
        setActiveStep={setActiveStep}
        cleanCount={cleanData.length}
        isCollecting={isCollecting}
        onQuickExport={() => handleExportCsv('long')}
      />

      {/* Main Workspace Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {activeStep === 1 && (
          <DefineStep
            researchTitle={researchTitle}
            setResearchTitle={setResearchTitle}
            selectedIndicators={selectedIndicators}
            setSelectedIndicators={setSelectedIndicators}
            startYear={startYear}
            setStartYear={setStartYear}
            endYear={endYear}
            setEndYear={setEndYear}
            selectedRegions={selectedRegions}
            setSelectedRegions={setSelectedRegions}
            selectedIncomes={selectedIncomes}
            setSelectedIncomes={setSelectedIncomes}
            selectedIso3Set={selectedIso3Set}
            setSelectedIso3Set={setSelectedIso3Set}
            countriesList={countriesList}
            countriesMap={countriesMap}
            onProceed={() => setActiveStep(2)}
            onApplyTopic={handleApplyTopic}
            onApplyKaggleDataset={handleApplyKaggleDataset}
            onIngestFileRecords={handleIngestFileRecords}
            onAutoCollectAll={handleAutoCollectAll}
            isCollecting={isCollecting}
            onOpenAiFeed={() => setActiveStep(7)}
          />
        )}

        {activeStep === 2 && (
          <CollectStep
            isCollecting={isCollecting}
            onStartCollection={handleStartCollection}
            onStopCollection={handleStopCollection}
            onLoadPrecached={handleLoadPrecached}
            progress={progress}
            logs={logs}
            rawCount={rawRecords.length}
            selectedIndicatorsCount={selectedIndicators.length}
            yearsSpan={endYear - startYear + 1}
            countriesCount={countriesList.length}
            onProceed={() => setActiveStep(3)}
            hasData={rawRecords.length > 0}
            scheduleConfig={scheduleConfig}
            onUpdateScheduleConfig={setScheduleConfig}
            onTriggerQuarterlySync={() => handleStartCollection()}
            selectedIndicators={selectedIndicators}
            startYear={startYear}
            endYear={endYear}
          />
        )}

        {activeStep === 3 && (
          <CleanStep
            cleaningOptions={cleaningOptions}
            setCleaningOptions={setCleaningOptions}
            rawRecords={rawRecords}
            cleanRecords={cleanData}
            duplicatesRemoved={duplicatesRemoved}
            emptyRemoved={emptyRemoved}
            onProceed={() => setActiveStep(4)}
          />
        )}

        {activeStep === 4 && (
          <QualityStep
            qualityReport={qualityReport}
            indicatorStats={indicatorStats}
            cleanRecords={cleanData}
            onProceed={() => setActiveStep(5)}
          />
        )}

        {activeStep === 5 && (
          <VisualizeStep
            cleanRecords={cleanData}
            onProceed={() => setActiveStep(6)}
            onExportCsv={handleExportCsv}
            onLoadSubnationalData={handleLoadSubnationalData}
          />
        )}

        {activeStep === 6 && (
          <ExportStep
            cleanRecords={cleanData}
            selectedIndicators={selectedIndicators}
            startYear={startYear}
            endYear={endYear}
            researchTitle={researchTitle}
          />
        )}

        {activeStep === 7 && (
          <AiResearchHarvester onBackToStudio={() => setActiveStep(1)} />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">World Bank Quantitative Data Workflow</span>
            <span aria-hidden="true">·</span>
            <span>Secondary Quantitative Research Suite</span>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="https://data.worldbank.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900 transition-colors"
            >
              World Bank Open Data
            </a>
            <span aria-hidden="true">·</span>
            <span>UTF-8 BOM (utf-8-sig) Validated</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
