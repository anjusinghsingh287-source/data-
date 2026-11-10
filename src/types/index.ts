export interface WorldBankCountry {
  id: string; // ISO3 or ISO2
  iso3: string;
  name: string;
  region: string;
  incomeLevel: string;
  capital: string;
}

export interface WorldBankIndicator {
  code: string;
  name: string;
  category: string;
  unit: string;
  description: string;
  sourceUrl: string;
}

export interface RawRecord {
  country_iso3: string;
  country_name: string;
  state?: string; // Sub-national state/province/territory (e.g. California, Maharashtra, Bavaria)
  admin_level?: 'national' | 'state'; // Hierarchy tier
  region: string;
  income_level: string;
  year: string;
  indicator_code: string;
  indicator_name: string;
  value: number | null;
  source: string;
  source_url: string;
  collected_at_utc: string;
}

export interface CleanRecord {
  country_iso3: string;
  country_name: string;
  state?: string; // Sub-national state/province/territory
  admin_level?: 'national' | 'state'; // Hierarchy tier
  region: string;
  income_level: string;
  year: string;
  indicator_code: string;
  indicator_name: string;
  value: number;
  source: string;
  source_url: string;
  collected_at_utc: string;
}

export interface CleaningOptions {
  dropNulls: boolean;
  dropDuplicates: boolean;
  dropOutliers: boolean; // 3x IQR
  imputation: 'none' | 'ffill' | 'mean';
}

export interface QualityReportData {
  raw_n: number;
  clean_n: number;
  removed_n: number;
  missing_ratio: number;
  countries_covered: number;
  year_min: string | number;
  year_max: string | number;
  duplicate_count: number;
  empty_count: number;
  is_balanced_panel: boolean;
  panel_balance_score: number; // 0 to 100%
  indicators_covered: number;
}

export interface IndicatorSummaryStat {
  code: string;
  name: string;
  count: number;
  mean: number;
  std: number;
  min: number;
  p25: number;
  median: number;
  p75: number;
  max: number;
  missingCount: number;
  coveragePct: number;
  latestYoY?: number | null;
  meanYoY?: number | null;
}

export interface YoYGrowthRecord {
  country_iso3: string;
  country_name: string;
  state?: string;
  admin_level?: 'national' | 'state';
  indicator_code: string;
  indicator_name: string;
  year: string;
  prevYear: string;
  value: number;
  prevValue: number;
  yoyPct: number;
  absoluteChange: number;
}

export interface IndicatorYoYSummary {
  indicator_code: string;
  indicator_name: string;
  latestYearPair: string;
  latestAvgYoY: number | null;
  latestMedianYoY: number | null;
  overallMeanYoY: number | null;
  overallMedianYoY: number | null;
  positiveShare: number;
  negativeShare: number;
  flatShare: number;
  totalTransitions: number;
  maxSurgeCountry?: { country_name: string; state?: string; yoyPct: number; year: string };
  maxDeclineCountry?: { country_name: string; state?: string; yoyPct: number; year: string };
}

export interface DatasetYoYAnalysis {
  recordsWithYoY: YoYGrowthRecord[];
  byIndicator: Record<string, IndicatorYoYSummary>;
  overallLatestYoY: number | null;
  overallMeanYoY: number | null;
  totalTransitions: number;
}

export interface ResearchPreset {
  id: string;
  title: string;
  description: string;
  indicators: string[];
  suggestedStartYear: number;
  suggestedEndYear: number;
}

export interface ResearchTopic {
  id: string;
  name: string;
  iconName: string;
  description: string;
  indicators: string[];
  suggestedStartYear: number;
  suggestedEndYear: number;
  tags: string[];
  kaggleSlug?: string;
}

export interface KaggleResearchDataset {
  id: string;
  title: string;
  author: string;
  topic: string;
  indicators: string[];
  startYear: number;
  endYear: number;
  description: string;
  tags: string[];
  sourceUrl: string;
  downloadCount: number;
  lastUpdated: string;
  usabilityScore: number;
}

export type { AnomalyRecord, IndicatorAnomalySummary, DatasetAnomalyAnalysis } from '../utils/anomalyUtils';

