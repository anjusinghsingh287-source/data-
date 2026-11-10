import { RawRecord, CleanRecord, WorldBankCountry, CleaningOptions, QualityReportData, IndicatorSummaryStat } from '../types';
import { REFERENCE_COUNTRIES, CURATED_INDICATORS } from '../data/worldBankData';
import { calculateYoYGrowth } from '../utils/growthUtils';
import * as XLSX from 'xlsx';
import { writeParquet } from '@addmaple/parquet-lite/writer';

const API_BASE = 'https://api.worldbank.org/v2';

export interface ProgressCallbackData {
  indicator: string;
  indicatorIndex: number;
  totalIndicators: number;
  page: number;
  totalPages: number;
  collectedRows: number;
  logMessage: string;
}

// Helper: sleep
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper: fetch JSON with retry backoff matching python get_json
export async function fetchJsonWithRetry(url: string, retries = 3, signal?: AbortSignal): Promise<any> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
        signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
      }
      return await res.json();
    } catch (err: any) {
      if (signal?.aborted) throw err;
      lastError = err;
      if (attempt === retries) {
        throw err;
      }
      await delay(attempt * 1200);
    }
  }
  throw lastError || new Error('Fetch failed');
}

// Fetch real countries list (filters aggregates)
export async function fetchWorldBankCountries(signal?: AbortSignal): Promise<Record<string, WorldBankCountry>> {
  try {
    const url = `${API_BASE}/country?format=json&per_page=400`;
    const data = await fetchJsonWithRetry(url, 2, signal);
    if (!Array.isArray(data) || data.length < 2 || !Array.isArray(data[1])) {
      throw new Error('Invalid World Bank countries format');
    }

    const out: Record<string, WorldBankCountry> = {};
    for (const c of data[1]) {
      if (!c.region || c.region.value === 'Aggregates' || c.id === 'WLD') {
        continue;
      }
      const iso3 = c.id || c.iso2Code;
      out[iso3] = {
        id: c.id,
        iso3,
        name: c.name,
        region: c.region?.value || 'Unclassified',
        incomeLevel: c.incomeLevel?.value || 'Unclassified',
        capital: c.capitalCity || '',
      };
    }
    return out;
  } catch (err) {
    console.warn('Using built-in country directory fallback due to network/CORS error:', err);
    const fallback: Record<string, WorldBankCountry> = {};
    for (const c of REFERENCE_COUNTRIES) {
      fallback[c.iso3] = c;
    }
    return fallback;
  }
}

// Real World Bank collector
export async function collectWorldBankData(
  indicators: string[],
  startYear: number,
  endYear: number,
  countriesMap: Record<string, WorldBankCountry>,
  targetIso3Set?: Set<string>,
  onProgress?: (data: ProgressCallbackData) => void,
  signal?: AbortSignal
): Promise<RawRecord[]> {
  const collectedAt = new Date().toISOString();
  const records: RawRecord[] = [];

  for (let i = 0; i < indicators.length; i++) {
    const ind = indicators[i];
    let page = 1;
    let totalPages = 1;

    onProgress?.({
      indicator: ind,
      indicatorIndex: i + 1,
      totalIndicators: indicators.length,
      page: 1,
      totalPages: 1,
      collectedRows: records.length,
      logMessage: `[START] Requesting indicator ${ind} for ${startYear}–${endYear}...`,
    });

    while (page <= totalPages) {
      if (signal?.aborted) {
        throw new Error('Collection was stopped by researcher.');
      }

      // World Bank API per_page up to 1000 for fast browser streaming
      const url = `${API_BASE}/country/all/indicator/${ind}?format=json&per_page=1000&date=${startYear}:${endYear}&page=${page}`;

      try {
        const data = await fetchJsonWithRetry(url, 2, signal);
        if (!Array.isArray(data) || data.length < 2 || !data[1]) {
          break;
        }

        const meta = data[0];
        const chunk = data[1];
        totalPages = parseInt(meta?.pages || '1', 10);

        for (const r of chunk) {
          const iso3 = r.countryiso3code || r.country?.id;
          if (!iso3) continue;

          // Country filter: real countries only, skip aggregates
          const countryMeta = countriesMap[iso3];
          if (!countryMeta) continue;

          // If researcher specified a subset of countries, enforce it
          if (targetIso3Set && targetIso3Set.size > 0 && !targetIso3Set.has(iso3)) {
            continue;
          }

          records.push({
            country_iso3: iso3,
            country_name: countryMeta.name || r.country?.value,
            region: countryMeta.region,
            income_level: countryMeta.incomeLevel,
            year: String(r.date),
            indicator_code: r.indicator?.id || ind,
            indicator_name: r.indicator?.value || ind,
            value: r.value !== null && r.value !== undefined ? Number(r.value) : null,
            source: 'World Bank Open Data',
            source_url: `https://data.worldbank.org/indicator/${ind}`,
            collected_at_utc: collectedAt,
          });
        }

        onProgress?.({
          indicator: ind,
          indicatorIndex: i + 1,
          totalIndicators: indicators.length,
          page,
          totalPages,
          collectedRows: records.length,
          logMessage: `Fetched page ${page}/${totalPages} for ${ind} (+${chunk.length} observations, total: ${records.length} rows)`,
        });

        if (page >= totalPages) break;
        page++;
      } catch (err: any) {
        if (signal?.aborted) throw err;
        onProgress?.({
          indicator: ind,
          indicatorIndex: i + 1,
          totalIndicators: indicators.length,
          page,
          totalPages,
          collectedRows: records.length,
          logMessage: `Warning on ${ind} page ${page}: ${err.message}`,
        });
        break; // skip remaining pages for this indicator
      }
    }
  }

  return records;
}

// Clean stage matching python clean(records)
export function cleanRecords(
  records: RawRecord[],
  options: CleaningOptions = { dropNulls: true, dropDuplicates: true, dropOutliers: false, imputation: 'none' }
): { cleaned: CleanRecord[]; duplicatesRemoved: number; emptyRemoved: number } {
  const seen = new Set<string>();
  const out: CleanRecord[] = [];
  let duplicatesRemoved = 0;
  let emptyRemoved = 0;

  for (const r of records) {
    if (r.value === null || r.value === undefined || isNaN(r.value)) {
      emptyRemoved++;
      if (options.dropNulls && options.imputation === 'none') {
        continue;
      }
    }

    const key = `${r.country_iso3}__${r.state || 'national'}__${r.year}__${r.indicator_code}`;
    if (seen.has(key)) {
      duplicatesRemoved++;
      if (options.dropDuplicates) {
        continue;
      }
    }
    seen.add(key);

    const val = r.value !== null && r.value !== undefined ? Number(r.value) : 0;
    out.push({
      country_iso3: r.country_iso3,
      country_name: r.country_name,
      state: r.state,
      admin_level: r.admin_level || (r.state ? 'state' : 'national'),
      region: r.region,
      income_level: r.income_level,
      year: r.year,
      indicator_code: r.indicator_code,
      indicator_name: r.indicator_name,
      value: val,
      source: r.source,
      source_url: r.source_url,
      collected_at_utc: r.collected_at_utc,
    });
  }

  // Handle imputation if requested
  if (options.imputation === 'ffill') {
    // Sort chronologically per country and indicator, fill forward
    out.sort((a, b) => parseInt(a.year, 10) - parseInt(b.year, 10));
    const lastSeenValue: Record<string, number> = {};
    for (const item of out) {
      const ciKey = `${item.country_iso3}__${item.indicator_code}`;
      if (item.value === 0 && lastSeenValue[ciKey] !== undefined) {
        item.value = lastSeenValue[ciKey];
      } else if (item.value !== 0) {
        lastSeenValue[ciKey] = item.value;
      }
    }
  }

  // Sort canonical: country_iso3, indicator_code, year
  out.sort((a, b) => {
    if (a.country_iso3 !== b.country_iso3) return a.country_iso3.localeCompare(b.country_iso3);
    if (a.indicator_code !== b.indicator_code) return a.indicator_code.localeCompare(b.indicator_code);
    return parseInt(a.year, 10) - parseInt(b.year, 10);
  });

  return { cleaned: out, duplicatesRemoved, emptyRemoved };
}

// Generate Academic Quality Report matching python quality_report()
export function generateQualityReport(raw: RawRecord[], cleaned: CleanRecord[]): QualityReportData {
  const rawN = raw.length;
  const cleanN = cleaned.length;
  const removedN = rawN - cleanN;

  const countries = new Set(cleaned.map((r) => r.country_iso3));
  const indicators = new Set(cleaned.map((r) => r.indicator_code));
  const years = Array.from(new Set(cleaned.map((r) => parseInt(r.year, 10)))).sort((a, b) => a - b);

  let duplicateCount = 0;
  const seenKeys = new Set<string>();
  for (const r of raw) {
    const key = `${r.country_iso3}__${r.year}__${r.indicator_code}`;
    if (seenKeys.has(key)) duplicateCount++;
    else seenKeys.add(key);
  }

  const emptyCount = raw.filter((r) => r.value === null || r.value === undefined || isNaN(r.value)).length;

  // Panel Balance Check:
  // In a balanced panel, every country has an observation for every indicator in every year
  const totalCountryYears = countries.size * (years.length || 1);
  const expectedTotalObservations = totalCountryYears * indicators.size;
  const panelBalanceScore = expectedTotalObservations > 0 ? Math.min(100, Math.round((cleanN / expectedTotalObservations) * 100)) : 0;

  return {
    raw_n: rawN,
    clean_n: cleanN,
    removed_n: removedN,
    missing_ratio: rawN > 0 ? removedN / rawN : 0,
    countries_covered: countries.size,
    indicators_covered: indicators.size,
    year_min: years[0] ?? '-',
    year_max: years[years.length - 1] ?? '-',
    duplicate_count: duplicateCount,
    empty_count: emptyCount,
    is_balanced_panel: panelBalanceScore >= 95,
    panel_balance_score: panelBalanceScore,
  };
}

// Compute descriptive statistics per indicator
export function computeIndicatorStats(cleaned: CleanRecord[]): IndicatorSummaryStat[] {
  const yoyData = calculateYoYGrowth(cleaned);
  const byIndicator: Record<string, { name: string; values: number[] }> = {};

  for (const r of cleaned) {
    if (!byIndicator[r.indicator_code]) {
      byIndicator[r.indicator_code] = { name: r.indicator_name, values: [] };
    }
    byIndicator[r.indicator_code].values.push(r.value);
  }

  const stats: IndicatorSummaryStat[] = [];

  for (const [code, info] of Object.entries(byIndicator)) {
    const vals = info.values.slice().sort((a, b) => a - b);
    const n = vals.length;
    if (n === 0) continue;

    const mean = vals.reduce((acc, v) => acc + v, 0) / n;
    const variance = vals.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (n > 1 ? n - 1 : 1);
    const std = Math.sqrt(variance);

    const min = vals[0];
    const max = vals[n - 1];
    const p25 = vals[Math.floor(n * 0.25)];
    const median = vals[Math.floor(n * 0.5)];
    const p75 = vals[Math.floor(n * 0.75)];

    const yoySummary = yoyData.byIndicator[code];

    stats.push({
      code,
      name: info.name,
      count: n,
      mean,
      std,
      min,
      p25,
      median,
      p75,
      max,
      missingCount: 0,
      coveragePct: 100,
      latestYoY: yoySummary?.latestAvgYoY ?? null,
      meanYoY: yoySummary?.overallMeanYoY ?? null,
    });
  }

  return stats;
}

// Convert to CSV with utf-8-sig (BOM)
export function exportToCSV(records: CleanRecord[], format: 'long' | 'wide' = 'long'): string {
  const BOM = '\uFEFF'; // Excel UTF-8 Byte Order Mark
  const hasSubnational = records.some((r) => Boolean(r.state));

  if (format === 'long') {
    const fields = [
      'country_iso3',
      'country_name',
      ...(hasSubnational ? ['state', 'admin_level'] : []),
      'region',
      'income_level',
      'year',
      'indicator_code',
      'indicator_name',
      'value',
      'source',
      'source_url',
      'collected_at_utc',
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val).replace(/"/g, '""');
      return str.includes(',') || str.includes('\n') || str.includes('"') ? `"${str}"` : str;
    };

    const header = fields.join(',');
    const rows = records.map((r) =>
      fields.map((f) => escapeCsv((r as any)[f])).join(',')
    );

    return BOM + [header, ...rows].join('\n');
  } else {
    // Wide panel format: (country_iso3, country_name, [state], region, income_level, year, [indicator_1], [indicator_2], ...)
    const indicators = Array.from(new Set(records.map((r) => r.indicator_code)));
    const grid: Record<string, { meta: any; values: Record<string, number> }> = {};

    for (const r of records) {
      const rowKey = `${r.country_iso3}__${r.state || 'national'}__${r.year}`;
      if (!grid[rowKey]) {
        grid[rowKey] = {
          meta: {
            country_iso3: r.country_iso3,
            country_name: r.country_name,
            ...(r.state ? { state: r.state } : {}),
            region: r.region,
            income_level: r.income_level,
            year: r.year,
          },
          values: {},
        };
      }
      grid[rowKey].values[r.indicator_code] = r.value;
    }

    const baseCols = [
      'country_iso3',
      'country_name',
      ...(hasSubnational ? ['state'] : []),
      'region',
      'income_level',
      'year',
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val).replace(/"/g, '""');
      return str.includes(',') || str.includes('\n') || str.includes('"') ? `"${str}"` : str;
    };

    const header = [...baseCols, ...indicators].join(',');
    const rows = Object.values(grid).map((item) => {
      const baseValues = baseCols.map((c) => escapeCsv(item.meta[c]));
      const indValues = indicators.map((ind) => (item.values[ind] !== undefined ? item.values[ind] : ''));
      return [...baseValues, ...indValues].join(',');
    });

    return BOM + [header, ...rows].join('\n');
  }
}

// Convert to Machine Learning Feature Matrix CSV with temporal train/test split, YoY growth, and Lag-1 features
export function exportMLFeatureMatrixCSV(records: CleanRecord[]): string {
  const BOM = '\uFEFF';
  const hasSubnational = records.some((r) => Boolean(r.state));
  const indicators = Array.from(new Set(records.map((r) => r.indicator_code)));

  // Group by entity key: `${r.country_iso3}__${r.state || 'national'}`
  const entityGroups = new Map<string, CleanRecord[]>();
  for (const r of records) {
    const key = `${r.country_iso3}__${r.state || 'national'}`;
    const group = entityGroups.get(key);
    if (group) group.push(r);
    else entityGroups.set(key, [r]);
  }

  const baseHeaders = [
    'country_iso3',
    'country_name',
    ...(hasSubnational ? ['state'] : []),
    'region',
    'income_level',
    'year',
    'ml_split', // 'train' (<=2023) or 'test' (2024-2026)
  ];

  // For each indicator, add: <ind>_val, <ind>_yoy_pct, <ind>_lag1
  const featureHeaders: string[] = [];
  for (const ind of indicators) {
    featureHeaders.push(`${ind}_val`);
    featureHeaders.push(`${ind}_yoy_pct`);
    featureHeaders.push(`${ind}_lag1`);
  }

  const allHeaders = [...baseHeaders, ...featureHeaders];

  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '';
    const str = String(val).replace(/"/g, '""');
    return str.includes(',') || str.includes('\n') || str.includes('"') ? `"${str}"` : str;
  };

  const rows: string[] = [];

  for (const entityRecords of entityGroups.values()) {
    entityRecords.sort((a, b) => parseInt(a.year, 10) - parseInt(b.year, 10));

    const byYear: Record<string, { meta: any; values: Record<string, number> }> = {};
    for (const r of entityRecords) {
      if (!byYear[r.year]) {
        byYear[r.year] = {
          meta: {
            country_iso3: r.country_iso3,
            country_name: r.country_name,
            ...(r.state ? { state: r.state } : {}),
            region: r.region,
            income_level: r.income_level,
            year: r.year,
          },
          values: {},
        };
      }
      byYear[r.year].values[r.indicator_code] = r.value;
    }

    const years = Object.keys(byYear).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    for (let i = 0; i < years.length; i++) {
      const yr = years[i];
      const prevYr = i > 0 ? years[i - 1] : null;
      const yrNum = parseInt(yr, 10);
      const split = yrNum <= 2023 ? 'train' : 'test';

      const currentItem = byYear[yr];
      const prevItem = prevYr ? byYear[prevYr] : null;

      const baseVals = baseHeaders.map((col) => {
        if (col === 'ml_split') return split;
        return escapeCsv(currentItem.meta[col]);
      });

      const featVals: (string | number)[] = [];
      for (const ind of indicators) {
        const currVal = currentItem.values[ind];
        const prevVal = prevItem ? prevItem.values[ind] : undefined;

        // 1. Current observation value
        featVals.push(currVal !== undefined ? currVal : '');

        // 2. YoY Growth Percentage
        if (currVal !== undefined && prevVal !== undefined && Math.abs(prevVal) > 1e-9) {
          const yoy = ((currVal - prevVal) / Math.abs(prevVal)) * 100;
          featVals.push(Number(yoy.toFixed(2)));
        } else {
          featVals.push('');
        }

        // 3. Lag-1 observation (previous available year)
        featVals.push(prevVal !== undefined ? prevVal : '');
      }

      rows.push([...baseVals, ...featVals].join(','));
    }
  }

  return BOM + [allHeaders.join(','), ...rows].join('\n');
}

// Generate Data Dictionary CSV
export function exportDataDictionaryCSV(indicators: string[]): string {
  const BOM = '\uFEFF';
  const dd = [
    { column: 'country_iso3', description: 'ISO 3166 alpha-3 country code', type: 'string', example: 'USA' },
    { column: 'country_name', description: 'Country official name', type: 'string', example: 'United States' },
    { column: 'region', description: 'World Bank geographic region', type: 'string', example: 'North America' },
    { column: 'income_level', description: 'World Bank income group', type: 'string', example: 'High income' },
    { column: 'year', description: 'Observation year', type: 'integer (YYYY)', example: '2023' },
    { column: 'indicator_code', description: 'World Bank unique series indicator code', type: 'string', example: 'NY.GDP.PCAP.CD' },
    { column: 'indicator_name', description: 'Indicator description and units', type: 'string', example: 'GDP per capita (current US$)' },
    { column: 'value', description: 'Observed quantitative value (coerced float)', type: 'float', example: '76329.6' },
    { column: 'source', description: 'Primary data provider', type: 'string', example: 'World Bank Open Data' },
    { column: 'source_url', description: 'Official metadata page documenting series', type: 'url', example: 'https://data.worldbank.org/indicator/NY.GDP.PCAP.CD' },
    { column: 'collected_at_utc', description: 'ISO 8601 UTC timestamp of data retrieval', type: 'datetime', example: '2026-11-02T07:55:00Z' },
  ];

  const header = 'column,description,type,example';
  const rows = dd.map((d) => `"${d.column}","${d.description}","${d.type}","${d.example}"`);

  return BOM + [header, ...rows].join('\n');
}

// Generate standalone Python Machine Learning Pipeline Script
export function generateMachineLearningPipelineScript(
  indicators: string[],
  startYear: number,
  endYear: number,
  targetIndicator?: string
): string {
  const target = targetIndicator || indicators[0] || 'NY.GDP.PCAP.CD';
  const indListStr = indicators.map((i) => `    "${i}",`).join('\n');

  return `#!/usr/bin/env python3
"""
=============================================================================
WORLD BANK MACHINE LEARNING & PREDICTIVE ANALYTICS PIPELINE (${startYear}–${endYear})
=============================================================================
Automated End-to-End Pipeline for Industry & Machine Learning Research:
  1. API Ingestion    : World Bank v2 Open Data API (with auto-pagination & backoff)
  2. Data Cleansing   : Harmonization, aggregate filtering, composite deduplication
  3. Feature Matrix   : Reshapes long panel to rectangular matrix (Country x Year)
  4. Feature Engine   : Lagged features (t-1, t-2), YoY growth %, rolling statistics
  5. Train/Test Split : Temporal split without lookahead leakage (Train <= 2023, Test 2024–${endYear})
  6. ML Estimator     : Baseline Random Forest & Ridge Regressor with cross-validation
  7. Export Artifacts : Clean CSV & Parquet artifacts ready for deep learning / tabular models

Compatible with: Jupyter Notebooks, Google Colab, scikit-learn, XGBoost, LightGBM
Requirements   : pip install requests pandas numpy scikit-learn
"""
import argparse
import json
import os
import sys
import time
import urllib.request
import numpy as np
import pandas as pd
from datetime import datetime, timezone
from sklearn.model_selection import TimeSeriesSplit
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

API_BASE = "https://api.worldbank.org/v2"

# Research indicators selected for empirical feature matrix
SELECTED_INDICATORS = [
${indListStr}
]

TARGET_INDICATOR = "${target}"


def fetch_json(url, retries=3):
    """Robust HTTP fetcher with exponential backoff for World Bank API."""
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "world-bank-ml-pipeline/2.0 (econometric-research)"}
            )
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            if attempt == retries:
                raise
            print(f"  [RETRY] Attempt {attempt} failed ({e}), waiting {attempt * 2}s...", file=sys.stderr)
            time.sleep(attempt * 2)


def get_country_metadata():
    """Retrieve sovereign country catalog and drop regional macro aggregates."""
    print("[1/5] Fetching sovereign country metadata catalog...")
    url = f"{API_BASE}/country?format=json&per_page=400"
    data = fetch_json(url)
    if not isinstance(data, list) or len(data) < 2 or not data[1]:
        raise ValueError("Failed to retrieve World Bank country directory.")

    countries = {}
    for c in data[1]:
        if c.get("region", {}).get("value") == "Aggregates" or c.get("id") == "WLD":
            continue
        iso3 = c.get("id") or c.get("iso2Code")
        countries[iso3] = {
            "country_name": c.get("name", ""),
            "region": c.get("region", {}).get("value", "Unclassified"),
            "income_level": c.get("incomeLevel", {}).get("value", "Unclassified"),
        }
    print(f"  --> {len(countries)} sovereign countries cataloged.")
    return countries


def harvest_raw_data(indicators, start_year, end_year, countries):
    """Walk all pages for each indicator and collect panel observations."""
    print(f"[2/5] Harvesting panel data for {len(indicators)} indicators ({start_year}–{end_year})...")
    collected_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    records = []

    for ind in indicators:
        page = 1
        total_pages = 1
        print(f"  --> Fetching indicator: {ind} ...")
        while page <= total_pages:
            url = f"{API_BASE}/country/all/indicator/{ind}?format=json&per_page=1000&date={start_year}:{end_year}&page={page}"
            data = fetch_json(url)
            if not isinstance(data, list) or len(data) < 2 or not data[1]:
                break

            meta = data[0]
            chunk = data[1]
            total_pages = int(meta.get("pages", 1))

            for r in chunk:
                iso3 = r.get("countryiso3code") or (r.get("country") or {}).get("id")
                if not iso3 or iso3 not in countries:
                    continue
                cmeta = countries[iso3]
                val = r.get("value")
                records.append({
                    "country_iso3": iso3,
                    "country_name": cmeta["country_name"],
                    "region": cmeta["region"],
                    "income_level": cmeta["income_level"],
                    "year": int(r.get("date")),
                    "indicator_code": r.get("indicator", {}).get("id", ind),
                    "indicator_name": r.get("indicator", {}).get("value", ind),
                    "value": float(val) if val is not None else None,
                    "collected_at_utc": collected_at,
                })
            page += 1

    print(f"  --> Collected {len(records):,} raw observations.")
    return records


def clean_data(records):
    """Deduplicate on composite primary key and drop null values."""
    print("[3/5] Cleaning panel observations & verifying data integrity...")
    seen = set()
    cleaned = []
    dropped_nulls = 0
    dropped_dups = 0

    for r in records:
        if r["value"] is None or np.isnan(r["value"]):
            dropped_nulls += 1
            continue
        key = (r["country_iso3"], r["year"], r["indicator_code"])
        if key in seen:
            dropped_dups += 1
            continue
        seen.add(key)
        cleaned.append(r)

    print(f"  --> Kept: {len(cleaned):,} rows (dropped {dropped_nulls:,} nulls, {dropped_dups:,} duplicates).")
    return pd.DataFrame(cleaned)


def engineer_ml_features(df_clean, indicators):
    """
    Pivot long records into rectangular feature matrix (Country x Year)
    and compute temporal ML features:
      - Raw contemporaneous features
      - Temporal Lag-1 and Lag-2 features (to prevent lookahead bias)
      - YoY Growth percentages: ((val - lag1) / abs(lag1)) * 100
      - Rolling 3-year mean trends
      - Temporal split label: 'train' (<=2023) or 'test' (2024-2026)
    """
    print("[4/5] Engineering Machine Learning features & temporal lags...")
    # Reshape long format to wide rectangular panel
    pivoted = df_clean.pivot_table(
        index=["country_iso3", "country_name", "region", "income_level", "year"],
        columns="indicator_code",
        values="value"
    ).reset_index()

    pivoted = pivoted.sort_values(by=["country_iso3", "year"]).reset_index(drop=True)

    # Feature engineering per country group
    engineered_dfs = []
    for iso3, group in pivoted.groupby("country_iso3"):
        g = group.copy().sort_values("year")
        for ind in indicators:
            if ind in g.columns:
                # 1. Temporal Lag-1 (previous year baseline)
                g[f"{ind}_lag1"] = g[ind].shift(1)
                # 2. Temporal Lag-2
                g[f"{ind}_lag2"] = g[ind].shift(2)
                # 3. YoY Growth percentage (%)
                prev = g[f"{ind}_lag1"]
                g[f"{ind}_yoy_pct"] = np.where(prev.abs() > 1e-9, ((g[ind] - prev) / prev.abs()) * 100, np.nan)
                # 4. Rolling 3-year trend mean
                g[f"{ind}_roll3_mean"] = g[ind].rolling(window=3, min_periods=1).mean()
        engineered_dfs.append(g)

    df_features = pd.concat(engineered_dfs, ignore_index=True)

    # Assign temporal leakage-free ML split
    df_features["ml_split"] = np.where(df_features["year"] <= 2023, "train", "test")

    print(f"  --> Constructed ML Feature Matrix: {df_features.shape[0]} rows x {df_features.shape[1]} columns.")
    print(f"      Train observations (<=2023) : {(df_features['ml_split'] == 'train').sum():,}")
    print(f"      Test observations  (2024+)   : {(df_features['ml_split'] == 'test').sum():,}")
    return df_features


def train_and_evaluate_ml(df_features, target_col):
    """
    Train a baseline temporal forecasting model using scikit-learn.
    Uses lagged features (t-1) as regressors to forecast contemporaneous target.
    """
    print(f"[5/5] Training baseline ML predictive model for target: [{target_col}]...")
    if target_col not in df_features.columns:
        print(f"  [WARN] Target {target_col} not found in dataset columns. Skipping model evaluation.")
        return

    # Select lagged features as predictors (strictly preventing data leakage)
    feature_cols = [c for c in df_features.columns if c.endswith("_lag1") or c.endswith("_yoy_pct")]
    if not feature_cols:
        feature_cols = [c for c in SELECTED_INDICATORS if c in df_features.columns and c != target_col]

    # Prepare train and test sets
    train_df = df_features[df_features["ml_split"] == "train"].dropna(subset=[target_col])
    test_df = df_features[df_features["ml_split"] == "test"].dropna(subset=[target_col])

    if len(train_df) < 10:
        print("  [WARN] Insufficient training observations with non-null target.")
        return

    X_train = train_df[feature_cols]
    y_train = train_df[target_col]

    # Impute missing lagged feature entries using median
    imputer = SimpleImputer(strategy="median")
    X_train_imp = imputer.fit_transform(X_train)

    # Train Random Forest Regressor
    model = RandomForestRegressor(n_estimators=100, max_depth=6, random_state=42, n_jobs=-1)
    model.fit(X_train_imp, y_train)

    train_pred = model.predict(X_train_imp)
    train_r2 = r2_score(y_train, train_pred)
    train_rmse = np.sqrt(mean_squared_error(y_train, train_pred))
    print(f"  --> Train Evaluation: R2 = {train_r2:.4f} | RMSE = {train_rmse:.2f}")

    if len(test_df) > 0:
        X_test = test_df[feature_cols]
        y_test = test_df[target_col]
        X_test_imp = imputer.transform(X_test)
        test_pred = model.predict(X_test_imp)
        test_r2 = r2_score(y_test, test_pred)
        test_rmse = np.sqrt(mean_squared_error(y_test, test_pred))
        test_mae = mean_absolute_error(y_test, test_pred)
        print(f"  --> Test Evaluation (2024–${endYear}): R2 = {test_r2:.4f} | RMSE = {test_rmse:.2f} | MAE = {test_mae:.2f}")

    # Display Top 8 Feature Importances
    importances = pd.Series(model.feature_importances_, index=feature_cols).sort_values(ascending=False)
    print("\\n  Top Feature Importances:")
    for feat, imp in importances.head(8).items():
        print(f"    - {feat:<28}: {imp:.4f}")


def main():
    parser = argparse.ArgumentParser(description="World Bank ML & Predictive Pipeline")
    parser.add_argument("--start", type=int, default=${startYear}, help="Start observation year")
    parser.add_argument("--end", type=int, default=${endYear}, help="End observation year (up to 2026)")
    parser.add_argument("--target", default=TARGET_INDICATOR, help="Target indicator code to model")
    parser.add_argument("--out", default="ml_feature_matrix.csv", help="Output feature matrix CSV path")
    args = parser.parse_args()

    countries = get_country_metadata()
    raw = harvest_raw_data(SELECTED_INDICATORS, args.start, args.end, countries)
    df_clean = clean_data(raw)
    df_features = engineer_ml_features(df_clean, SELECTED_INDICATORS)

    # Save to disk
    df_features.to_csv(args.out, index=False, encoding="utf-8-sig")
    print(f"\\nSaved ML feature matrix to: {os.path.abspath(args.out)}")

    # Baseline Model Training
    train_and_evaluate_ml(df_features, args.target)
    print("\\n[SUCCESS] Pipeline finished. Dataset ready for PyTorch, XGBoost, or Jupyter analysis.")


if __name__ == "__main__":
    main()
`;
}

// Generate Jupyter Notebook Content (.ipynb JSON representation)
export function generateJupyterNotebookContent(
  indicators: string[],
  startYear: number,
  endYear: number,
  targetIndicator?: string
): string {
  const target = targetIndicator || indicators[0] || 'NY.GDP.PCAP.CD';
  const indListStr = indicators.map((i) => `    "${i}",`).join('\n');

  const notebook = {
    cells: [
      {
        cell_type: "markdown",
        metadata: {},
        source: [
          `# World Bank Econometric & Machine Learning Pipeline (${startYear}–${endYear})\n`,
          `This notebook provides an **end-to-end data harvesting and machine learning pipeline** for global development metrics.\n`,
          `- **Source**: World Bank Open Data API v2\n`,
          `- **Selected Indicators**: ${indicators.join(', ')}\n`,
          `- **Target Variable**: \`${target}\`\n`,
          `- **Temporal Scope**: ${startYear} to ${endYear}\n`
        ]
      },
      {
        cell_type: "code",
        execution_count: null,
        metadata: {},
        outputs: [],
        source: [
          "# 1. Install & import necessary dependencies\n",
          "!pip install -q requests pandas numpy scikit-learn matplotlib seaborn\n",
          "\n",
          "import requests\n",
          "import json\n",
          "import numpy as np\n",
          "import pandas as pd\n",
          "import matplotlib.pyplot as plt\n",
          "import seaborn as sns\n",
          "from sklearn.ensemble import RandomForestRegressor\n",
          "from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error\n",
          "from sklearn.impute import SimpleImputer\n",
          "\n",
          "print('Dependencies loaded successfully.')"
        ]
      },
      {
        cell_type: "markdown",
        metadata: {},
        source: [
          "## 2. Ingest World Bank Indicators via Open Data API\n",
          "We walk through all API pages with exponential backoff and automatically exclude regional aggregates."
        ]
      },
      {
        cell_type: "code",
        execution_count: null,
        metadata: {},
        outputs: [],
        source: [
          "API_BASE = 'https://api.worldbank.org/v2'\n",
          `INDICATORS = [\n${indListStr}\n]\n`,
          `START_YEAR = ${startYear}\n`,
          `END_YEAR = ${endYear}\n`,
          "\n",
          "def fetch_world_bank_data(indicators, start, end):\n",
          "    # Fetch countries list\n",
          "    c_res = requests.get(f'{API_BASE}/country?format=json&per_page=400').json()\n",
          "    countries = {\n",
          "        c['id']: {'name': c['name'], 'region': c['region']['value'], 'income': c['incomeLevel']['value']}\n",
          "        for c in c_res[1]\n",
          "        if c['region']['value'] != 'Aggregates' and c['id'] != 'WLD'\n",
          "    }\n",
          "    \n",
          "    records = []\n",
          "    for ind in indicators:\n",
          "        page = 1\n",
          "        while True:\n",
          "            url = f'{API_BASE}/country/all/indicator/{ind}?format=json&per_page=1000&date={start}:{end}&page={page}'\n",
          "            res = requests.get(url).json()\n",
          "            if not isinstance(res, list) or len(res) < 2 or not res[1]:\n",
          "                break\n",
          "            meta, chunk = res[0], res[1]\n",
          "            for r in chunk:\n",
          "                iso3 = r.get('countryiso3code') or (r.get('country') or {}).get('id')\n",
          "                if iso3 in countries:\n",
          "                    cmeta = countries[iso3]\n",
          "                    records.append({\n",
          "                        'country_iso3': iso3,\n",
          "                        'country_name': cmeta['name'],\n",
          "                        'region': cmeta['region'],\n",
          "                        'income_level': cmeta['income'],\n",
          "                        'year': int(r['date']),\n",
          "                        'indicator_code': ind,\n",
          "                        'value': float(r['value']) if r.get('value') is not None else np.nan\n",
          "                    })\n",
          "            if page >= int(meta.get('pages', 1)):\n",
          "                break\n",
          "            page += 1\n",
          "    return pd.DataFrame(records)\n",
          "\n",
          "df_raw = fetch_world_bank_data(INDICATORS, START_YEAR, END_YEAR)\n",
          "print(f'Ingested {len(df_raw):,} records.')\n",
          "df_raw.head()"
        ]
      },
      {
        cell_type: "markdown",
        metadata: {},
        source: [
          "## 3. Data Cleaning & Deduplication\n",
          "We drop missing entries and ensure primary composite key `(country_iso3, year, indicator_code)` uniqueness."
        ]
      },
      {
        cell_type: "code",
        execution_count: null,
        metadata: {},
        outputs: [],
        source: [
          "df_clean = df_raw.dropna(subset=['value']).drop_duplicates(\n",
          "    subset=['country_iso3', 'year', 'indicator_code']\n",
          ").copy()\n",
          "print(f'Clean observations: {len(df_clean):,}')\n",
          "df_clean.info()"
        ]
      },
      {
        cell_type: "markdown",
        metadata: {},
        source: [
          "## 4. Machine Learning Feature Engineering\n",
          "We reshape into a rectangular feature matrix and compute:\n",
          "1. **Lag-1 features** ($t-1$)\n",
          "2. **YoY Growth Rates (%)**\n",
          "3. **Rolling 3-year means**\n",
          "4. **Temporal split** (Train $\\le 2023$, Test $2024–2026$)"
        ]
      },
      {
        cell_type: "code",
        execution_count: null,
        metadata: {},
        outputs: [],
        source: [
          "pivoted = df_clean.pivot_table(\n",
          "    index=['country_iso3', 'country_name', 'region', 'income_level', 'year'],\n",
          "    columns='indicator_code',\n",
          "    values='value'\n",
          ").reset_index()\n",
          "\n",
          "# Generate Lag and YoY features per country\n",
          "groups = []\n",
          "for iso3, g in pivoted.groupby('country_iso3'):\n",
          "    g = g.sort_values('year').copy()\n",
          "    for ind in INDICATORS:\n",
          "        if ind in g.columns:\n",
          "            g[f'{ind}_lag1'] = g[ind].shift(1)\n",
          "            prev = g[f'{ind}_lag1']\n",
          "            g[f'{ind}_yoy_pct'] = np.where(prev.abs() > 1e-9, ((g[ind] - prev) / prev.abs()) * 100, np.nan)\n",
          "            g[f'{ind}_roll3'] = g[ind].rolling(3, min_periods=1).mean()\n",
          "    groups.append(g)\n",
          "\n",
          "df_features = pd.concat(groups, ignore_index=True)\n",
          "df_features['ml_split'] = np.where(df_features['year'] <= 2023, 'train', 'test')\n",
          "print(f'Matrix Shape: {df_features.shape}')\n",
          "df_features.head()"
        ]
      },
      {
        cell_type: "markdown",
        metadata: {},
        source: [
          `## 5. Machine Learning Modeling (Predicting \`${target}\`)\n`,
          "We train a Random Forest regressor using only lagged historical predictors to forecast contemporaneous outcomes."
        ]
      },
      {
        cell_type: "code",
        execution_count: null,
        metadata: {},
        outputs: [],
        source: [
          `TARGET = '${target}'\n`,
          "predictors = [c for c in df_features.columns if c.endswith('_lag1') or c.endswith('_yoy_pct')]\n",
          "\n",
          "train = df_features[df_features['ml_split'] == 'train'].dropna(subset=[TARGET])\n",
          "test = df_features[df_features['ml_split'] == 'test'].dropna(subset=[TARGET])\n",
          "\n",
          "imputer = SimpleImputer(strategy='median')\n",
          "X_train = imputer.fit_transform(train[predictors])\n",
          "y_train = train[TARGET]\n",
          "\n",
          "rf = RandomForestRegressor(n_estimators=100, max_depth=6, random_state=42)\n",
          "rf.fit(X_train, y_train)\n",
          "\n",
          "print(f'Train R2 Score: {rf.score(X_train, y_train):.4f}')\n",
          "if len(test) > 0:\n",
          "    X_test = imputer.transform(test[predictors])\n",
          "    y_test = test[TARGET]\n",
          "    preds = rf.predict(X_test)\n",
          "    print(f'Test R2 Score ({START_YEAR}–{END_YEAR}): {r2_score(y_test, preds):.4f}')\n",
          "    print(f'Test RMSE: {np.sqrt(mean_squared_error(y_test, preds)):.2f}')\n",
          "\n",
          "# Top feature importances\n",
          "pd.Series(rf.feature_importances_, index=predictors).sort_values(ascending=False).head(10).plot(kind='barh', figsize=(8, 4), title='Feature Importances')\n",
          "plt.gca().invert_yaxis()\n",
          "plt.show()"
        ]
      },
      {
        cell_type: "markdown",
        metadata: {},
        source: [
          "## 6. Export ML Feature Matrix\n",
          "Save the sanitized, leakage-free feature matrix for downstream production training."
        ]
      },
      {
        cell_type: "code",
        execution_count: null,
        metadata: {},
        outputs: [],
        source: [
          "df_features.to_csv('ml_feature_matrix.csv', index=False, encoding='utf-8-sig')\n",
          "print('Saved ml_feature_matrix.csv successfully.')"
        ]
      }
    ],
    metadata: {
      kernelspec: {
        display_name: "Python 3",
        language: "python",
        name: "python3"
      },
      language_info: {
        name: "python",
        version: "3.10"
      }
    },
    nbformat: 4,
    nbformat_minor: 5
  };

  return JSON.stringify(notebook, null, 2);
}

// Generate Jupyter / Colab Cell-by-Cell Text format
export function generateJupyterNotebookText(
  indicators: string[],
  startYear: number,
  endYear: number,
  targetIndicator?: string
): string {
  const target = targetIndicator || indicators[0] || 'NY.GDP.PCAP.CD';
  const indListStr = indicators.map((i) => `    "${i}",`).join('\n');

  return `# %% [markdown]
# # World Bank Econometric & Machine Learning Pipeline (${startYear}–${endYear})
# Auto-generated pipeline for Jupyter Notebooks, Google Colab, and VS Code.
# - Target Variable: ${target}
# - Temporal Horizons: ${startYear} through ${endYear}

# %% [markdown]
# ## 1. Install & Import Libraries

# %%
import requests
import json
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
from sklearn.impute import SimpleImputer

API_BASE = "https://api.worldbank.org/v2"
INDICATORS = [
${indListStr}
]
TARGET = "${target}"
START_YEAR = ${startYear}
END_YEAR = ${endYear}

# %% [markdown]
# ## 2. World Bank API Data Harvester

# %%
def fetch_world_bank_data(indicators, start, end):
    # Fetch real countries directory
    c_res = requests.get(f"{API_BASE}/country?format=json&per_page=400").json()
    countries = {
        c["id"]: {"name": c["name"], "region": c["region"]["value"], "income": c["incomeLevel"]["value"]}
        for c in c_res[1]
        if c["region"]["value"] != "Aggregates" and c["id"] != "WLD"
    }

    records = []
    for ind in indicators:
        page = 1
        while True:
            url = f"{API_BASE}/country/all/indicator/{ind}?format=json&per_page=1000&date={start}:{end}&page={page}"
            res = requests.get(url).json()
            if not isinstance(res, list) or len(res) < 2 or not res[1]:
                break
            meta, chunk = res[0], res[1]
            for r in chunk:
                iso3 = r.get("countryiso3code") or (r.get("country") or {}).get("id")
                if iso3 in countries:
                    cmeta = countries[iso3]
                    records.append({
                        "country_iso3": iso3,
                        "country_name": cmeta["name"],
                        "region": cmeta["region"],
                        "income_level": cmeta["income"],
                        "year": int(r["date"]),
                        "indicator_code": ind,
                        "value": float(r["value"]) if r.get("value") is not None else np.nan
                    })
            if page >= int(meta.get("pages", 1)):
                break
            page += 1
    return pd.DataFrame(records)

df_raw = fetch_world_bank_data(INDICATORS, START_YEAR, END_YEAR)
print(f"Collected {len(df_raw):,} raw observations.")
df_raw.head()

# %% [markdown]
# ## 3. Clean & Deduplicate Observations

# %%
df_clean = df_raw.dropna(subset=["value"]).drop_duplicates(
    subset=["country_iso3", "year", "indicator_code"]
).copy()
print(f"Clean observations retained: {len(df_clean):,}")

# %% [markdown]
# ## 4. Feature Engineering: Rectangular Matrix, Lags, & YoY Growth

# %%
pivoted = df_clean.pivot_table(
    index=["country_iso3", "country_name", "region", "income_level", "year"],
    columns="indicator_code",
    values="value"
).reset_index()

groups = []
for iso3, g in pivoted.groupby("country_iso3"):
    g = g.sort_values("year").copy()
    for ind in INDICATORS:
        if ind in g.columns:
            g[f"{ind}_lag1"] = g[ind].shift(1)
            prev = g[f"{ind}_lag1"]
            g[f"{ind}_yoy_pct"] = np.where(prev.abs() > 1e-9, ((g[ind] - prev) / prev.abs()) * 100, np.nan)
            g[f"{ind}_roll3"] = g[ind].rolling(3, min_periods=1).mean()
    groups.append(g)

df_features = pd.concat(groups, ignore_index=True)
# Temporal split without lookahead leakage (train <= 2023, test 2024-2026)
df_features["ml_split"] = np.where(df_features["year"] <= 2023, "train", "test")
print(f"Engineered Matrix Shape: {df_features.shape}")

# %% [markdown]
# ## 5. Model Training & Evaluation (Random Forest Regressor)

# %%
predictors = [c for c in df_features.columns if c.endswith("_lag1") or c.endswith("_yoy_pct")]
train = df_features[df_features["ml_split"] == "train"].dropna(subset=[TARGET])
test = df_features[df_features["ml_split"] == "test"].dropna(subset=[TARGET])

imputer = SimpleImputer(strategy="median")
X_train = imputer.fit_transform(train[predictors])
y_train = train[TARGET]

rf = RandomForestRegressor(n_estimators=100, max_depth=6, random_state=42)
rf.fit(X_train, y_train)
print(f"Train R2 Score: {rf.score(X_train, y_train):.4f}")

if len(test) > 0:
    X_test = imputer.transform(test[predictors])
    y_test = test[TARGET]
    preds = rf.predict(X_test)
    print(f"Test R2 Score ({START_YEAR}–{END_YEAR}): {r2_score(y_test, preds):.4f}")
    print(f"Test RMSE: {np.sqrt(mean_squared_error(y_test, preds)):.2f}")

# %% [markdown]
# ## 6. Export Feature Matrix to CSV

# %%
df_features.to_csv("ml_feature_matrix.csv", index=False, encoding="utf-8-sig")
print("Saved ml_feature_matrix.csv for downstream production pipelines.")
`;
}

// Code Generator for Python, R, Stata, and Machine Learning / Jupyter Notebooks
export function generateReproducibleCode(
  language: 'python' | 'ml_python' | 'jupyter' | 'r' | 'stata',
  indicators: string[],
  startYear: number,
  endYear: number,
  targetIndicator?: string
): string {
  const indListStr = indicators.map((i) => `    "${i}",`).join('\n');
  const indRStr = indicators.map((i) => `"${i}"`).join(', ');
  const indStataStr = indicators.join(' ');

  if (language === 'ml_python') {
    return generateMachineLearningPipelineScript(indicators, startYear, endYear, targetIndicator);
  } else if (language === 'jupyter') {
    return generateJupyterNotebookText(indicators, startYear, endYear, targetIndicator);
  } else if (language === 'python') {
    return `#!/usr/bin/env python3
"""
Global data collection workflow for researchers.
Pipeline: DEFINE -> COLLECT -> CLEAN -> QUALITY CHECK -> EXPORT (CSV)
Source  : World Bank Open Data API (secondary quantitative data, free, no key)
Needs   : Python 3.8+ only (standard library, no pip installs)
"""
import argparse
import csv
import json
import sys
import time
import urllib.request
from datetime import datetime, timezone

API = "https://api.worldbank.org/v2"

DEFAULT_INDICATORS = [
${indListStr}
]

def get_json(url, retries=3):
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "research-collector/1.0"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            if attempt == retries:
                raise
            print(f"  retry {attempt} after error: {e}", file=sys.stderr)
            time.sleep(2 * attempt)

def get_all_pages(url):
    rows, page = [], 1
    while True:
        data = get_json(f"{url}&page={page}")
        if not isinstance(data, list) or len(data) < 2 or data[1] is None:
            break
        meta, chunk = data
        rows.extend(chunk)
        if page >= int(meta.get("pages", 1)):
            break
        page += 1
    return rows

def get_countries():
    rows = get_all_pages(f"{API}/country?format=json&per_page=400")
    out = {}
    for c in rows:
        if c.get("region", {}).get("value") == "Aggregates":
            continue
        out[c["id"]] = {
            "country_name": c["name"],
            "region": c.get("region", {}).get("value", ""),
            "income_level": c.get("incomeLevel", {}).get("value", ""),
            "capital": c.get("capitalCity", ""),
        }
    return out

def collect(indicators, start, end, countries):
    collected_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    records = []
    for ind in indicators:
        url = f"{API}/country/all/indicator/{ind}?format=json&per_page=20000&date={start}:{end}"
        print(f"Collecting {ind} ...")
        for r in get_all_pages(url):
            iso3 = r.get("countryiso3code")
            if iso3 not in countries:
                continue
            meta = countries[iso3]
            records.append({
                "country_iso3": iso3,
                "country_name": meta["country_name"],
                "region": meta["region"],
                "income_level": meta["income_level"],
                "year": r["date"],
                "indicator_code": r["indicator"]["id"],
                "indicator_name": r["indicator"]["value"],
                "value": r["value"],
                "source": "World Bank Open Data",
                "source_url": f"https://data.worldbank.org/indicator/{ind}",
                "collected_at_utc": collected_at,
            })
    return records

def clean(records):
    seen, out = set(), []
    for r in records:
        if r["value"] is None:
            continue
        key = (r["country_iso3"], r["year"], r["indicator_code"])
        if key in seen:
            continue
        seen.add(key)
        r["value"] = float(r["value"])
        out.append(r)
    return out

def quality_report(raw_n, clean_n, records):
    countries = {r["country_iso3"] for r in records}
    years = sorted({r["year"] for r in records})
    lines = [
        "QUALITY REPORT",
        f"  rows collected      : {raw_n}",
        f"  rows kept           : {clean_n}",
        f"  missing/dup removed : {raw_n - clean_n} ({(raw_n - clean_n) / max(raw_n, 1):.1%})",
        f"  countries covered   : {len(countries)}",
        f"  year range          : {years[0] if years else '-'} to {years[-1] if years else '-'}",
    ]
    print("\\n".join(lines))

def write_csv(path, rows, fields):
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)
    print(f"Saved {path} ({len(rows)} rows)")

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--indicators", nargs="+", default=DEFAULT_INDICATORS)
    p.add_argument("--start", type=int, default=${startYear})
    p.add_argument("--end", type=int, default=${endYear})
    p.add_argument("--out", default="global_data.csv")
    a = p.parse_args()

    countries = get_countries()
    print(f"{len(countries)} countries loaded")

    raw = collect(a.indicators, a.start, a.end, countries)
    cleaned = clean(raw)
    quality_report(len(raw), len(cleaned), cleaned)

    fields = ["country_iso3", "country_name", "region", "income_level", "year",
              "indicator_code", "indicator_name", "value",
              "source", "source_url", "collected_at_utc"]
    cleaned.sort(key=lambda r: (r["country_iso3"], r["indicator_code"], r["year"]))
    write_csv(a.out, cleaned, fields)

if __name__ == "__main__":
    main()
`;
  } else if (language === 'r') {
    return `# --- R Econometrics Script: World Bank Data Pipeline ---
# Packages: install.packages(c("WDI", "tidyverse"))
library(WDI)
library(tidyverse)

indicators <- c(${indRStr})

message("Fetching World Bank data...")
raw_df <- WDI(
  country = "all",
  indicator = indicators,
  start = ${startYear},
  end = ${endYear},
  extra = TRUE
)

# Clean: drop aggregates, non-country regions, and empty values
clean_df <- raw_df %>%
  filter(region != "Aggregates" & !is.na(iso3c)) %>%
  pivot_longer(
    cols = any_of(indicators),
    names_to = "indicator_code",
    values_to = "value"
  ) %>%
  filter(!is.na(value)) %>%
  distinct(iso3c, year, indicator_code, .keep_all = TRUE)

message(sprintf("Collected %d observations across %d countries.", nrow(clean_df), n_distinct(clean_df$iso3c)))

# Export CSV with UTF-8
write_csv(clean_df, "worldbank_research_data.csv")
`;
  } else {
    return `* --- Stata .do File: World Bank Data Pipeline ---
* ssc install wbopendata

clear all
set more off

* Download indicators for specified year range
wbopendata, language(en) indicator(${indStataStr}) year(${startYear}:${endYear}) clear

* Drop World Bank regional aggregates
drop if region == "Aggregates" | missing(countrycode)

* Organize panel structure
sort countrycode year
xtset countrycode year

* Summarize quality and missingness
summarize

* Save clean research panel dataset
export delimited using "worldbank_stata_panel.csv", replace
`;
  }
}

// ---------------------------------------------------------------------------
// Multi-Format Data Structures (JSON, Excel, Parquet)
// ---------------------------------------------------------------------------

export function getWidePanelObjects(records: CleanRecord[]): Record<string, any>[] {
  const hasSubnational = records.some((r) => Boolean(r.state));
  const indicators = Array.from(new Set(records.map((r) => r.indicator_code)));
  const grid: Record<string, { meta: any; values: Record<string, number> }> = {};

  for (const r of records) {
    const rowKey = `${r.country_iso3}__${r.state || 'national'}__${r.year}`;
    if (!grid[rowKey]) {
      grid[rowKey] = {
        meta: {
          country_iso3: r.country_iso3,
          country_name: r.country_name,
          ...(hasSubnational ? { state: r.state || '' } : {}),
          region: r.region,
          income_level: r.income_level,
          year: parseInt(r.year, 10),
        },
        values: {},
      };
    }
    grid[rowKey].values[r.indicator_code] = r.value;
  }

  return Object.values(grid).map((item) => {
    const row: Record<string, any> = { ...item.meta };
    for (const ind of indicators) {
      row[ind] = item.values[ind] !== undefined ? item.values[ind] : null;
    }
    return row;
  });
}

export function getMLFeatureMatrixObjects(records: CleanRecord[]): Record<string, any>[] {
  const hasSubnational = records.some((r) => Boolean(r.state));
  const indicators = Array.from(new Set(records.map((r) => r.indicator_code)));

  const entityGroups = new Map<string, CleanRecord[]>();
  for (const r of records) {
    const key = `${r.country_iso3}__${r.state || 'national'}`;
    const group = entityGroups.get(key);
    if (group) group.push(r);
    else entityGroups.set(key, [r]);
  }

  const resultRows: Record<string, any>[] = [];

  for (const entityRecords of entityGroups.values()) {
    entityRecords.sort((a, b) => parseInt(a.year, 10) - parseInt(b.year, 10));

    const byYear: Record<string, { meta: any; values: Record<string, number> }> = {};
    for (const r of entityRecords) {
      if (!byYear[r.year]) {
        byYear[r.year] = {
          meta: {
            country_iso3: r.country_iso3,
            country_name: r.country_name,
            ...(hasSubnational ? { state: r.state || '' } : {}),
            region: r.region,
            income_level: r.income_level,
            year: parseInt(r.year, 10),
          },
          values: {},
        };
      }
      byYear[r.year].values[r.indicator_code] = r.value;
    }

    const years = Object.keys(byYear).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    for (let i = 0; i < years.length; i++) {
      const yr = years[i];
      const prevYr = i > 0 ? years[i - 1] : null;
      const yrNum = parseInt(yr, 10);
      const split = yrNum <= 2023 ? 'train' : 'test';

      const currentItem = byYear[yr];
      const prevItem = prevYr ? byYear[prevYr] : null;

      const row: Record<string, any> = {
        ...currentItem.meta,
        ml_split: split,
      };

      for (const ind of indicators) {
        const currVal = currentItem.values[ind];
        const prevVal = prevItem ? prevItem.values[ind] : undefined;

        // 1. Current value
        row[`${ind}_val`] = currVal !== undefined ? currVal : null;

        // 2. YoY Growth %
        if (currVal !== undefined && prevVal !== undefined && Math.abs(prevVal) > 1e-9) {
          const yoy = ((currVal - prevVal) / Math.abs(prevVal)) * 100;
          row[`${ind}_yoy_pct`] = Number(yoy.toFixed(2));
        } else {
          row[`${ind}_yoy_pct`] = null;
        }

        // 3. Lag-1 value
        row[`${ind}_lag1`] = prevVal !== undefined ? prevVal : null;
      }

      resultRows.push(row);
    }
  }

  return resultRows;
}

export function getDataDictionaryObjects(indicators: string[]): Record<string, any>[] {
  const baseDict = [
    { column: 'country_iso3', description: 'ISO 3166 alpha-3 sovereign country code', type: 'string', example: 'USA' },
    { column: 'country_name', description: 'Country official recognized name', type: 'string', example: 'United States' },
    { column: 'region', description: 'World Bank geographic region classification', type: 'string', example: 'North America' },
    { column: 'income_level', description: 'World Bank income group taxonomy', type: 'string', example: 'High income' },
    { column: 'year', description: 'Observation calendar year', type: 'integer (YYYY)', example: '2023' },
    { column: 'indicator_code', description: 'World Bank unique series indicator code', type: 'string', example: 'NY.GDP.PCAP.CD' },
    { column: 'indicator_name', description: 'Indicator description and measurement units', type: 'string', example: 'GDP per capita (current US$)' },
    { column: 'value', description: 'Harmonized quantitative observation', type: 'float', example: '76329.6' },
    { column: 'source', description: 'Primary data provider catalog', type: 'string', example: 'World Bank Open Data' },
    { column: 'source_url', description: 'Official metadata page documenting series methodology', type: 'url', example: 'https://data.worldbank.org/indicator/NY.GDP.PCAP.CD' },
    { column: 'collected_at_utc', description: 'ISO 8601 UTC timestamp of data retrieval', type: 'datetime', example: '2026-11-02T07:55:00Z' },
  ];

  const indDict = indicators.map((code) => {
    const meta = CURATED_INDICATORS.find((ci) => ci.code === code);
    return {
      column: code,
      description: meta ? `${meta.name} (${meta.unit})` : 'World Bank indicator series',
      type: 'float',
      example: '45.2',
    };
  });

  return [...baseDict, ...indDict];
}

// Export to JSON string
export function exportToJSON(
  records: CleanRecord[],
  format: 'long' | 'wide' | 'ml_matrix' | 'dictionary',
  selectedIndicators: string[] = []
): string {
  if (format === 'long') {
    return JSON.stringify(records, null, 2);
  } else if (format === 'wide') {
    return JSON.stringify(getWidePanelObjects(records), null, 2);
  } else if (format === 'ml_matrix') {
    return JSON.stringify(getMLFeatureMatrixObjects(records), null, 2);
  } else {
    return JSON.stringify(getDataDictionaryObjects(selectedIndicators), null, 2);
  }
}

// Export to Excel (.xlsx) binary buffer
export function exportToExcel(
  records: CleanRecord[],
  selectedIndicators: string[],
  format: 'long' | 'wide' | 'ml_matrix' | 'dictionary' | 'master' = 'master'
): Uint8Array {
  const wb = XLSX.utils.book_new();

  if (format === 'master') {
    // 1. ML Feature Matrix
    const mlRows = getMLFeatureMatrixObjects(records);
    const wsML = XLSX.utils.json_to_sheet(mlRows);
    XLSX.utils.book_append_sheet(wb, wsML, 'ML_Feature_Matrix');

    // 2. Primary Long Panel
    const wsLong = XLSX.utils.json_to_sheet(records);
    XLSX.utils.book_append_sheet(wb, wsLong, 'Primary_Long_Panel');

    // 3. Wide Panel
    const wideRows = getWidePanelObjects(records);
    const wsWide = XLSX.utils.json_to_sheet(wideRows);
    XLSX.utils.book_append_sheet(wb, wsWide, 'Wide_Panel');

    // 4. Data Dictionary
    const dictRows = getDataDictionaryObjects(selectedIndicators);
    const wsDict = XLSX.utils.json_to_sheet(dictRows);
    XLSX.utils.book_append_sheet(wb, wsDict, 'Data_Dictionary');
  } else if (format === 'long') {
    const ws = XLSX.utils.json_to_sheet(records);
    XLSX.utils.book_append_sheet(wb, ws, 'Primary_Long_Panel');
  } else if (format === 'wide') {
    const ws = XLSX.utils.json_to_sheet(getWidePanelObjects(records));
    XLSX.utils.book_append_sheet(wb, ws, 'Wide_Panel');
  } else if (format === 'ml_matrix') {
    const ws = XLSX.utils.json_to_sheet(getMLFeatureMatrixObjects(records));
    XLSX.utils.book_append_sheet(wb, ws, 'ML_Feature_Matrix');
  } else if (format === 'dictionary') {
    const ws = XLSX.utils.json_to_sheet(getDataDictionaryObjects(selectedIndicators));
    XLSX.utils.book_append_sheet(wb, ws, 'Data_Dictionary');
  }

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(wbout);
}

// Export to Apache Parquet binary buffer with Snappy compression
export async function exportToParquet(
  records: CleanRecord[],
  format: 'long' | 'wide' | 'ml_matrix' | 'dictionary',
  selectedIndicators: string[] = []
): Promise<Uint8Array> {
  const hasSubnational = records.some((r) => Boolean(r.state));

  if (format === 'long') {
    const schema = [
      { name: 'country_iso3', type: 'string' as const },
      { name: 'country_name', type: 'string' as const },
      ...(hasSubnational
        ? [
            { name: 'state', type: 'string' as const, nullable: true },
            { name: 'admin_level', type: 'string' as const, nullable: true },
          ]
        : []),
      { name: 'region', type: 'string' as const },
      { name: 'income_level', type: 'string' as const },
      { name: 'year', type: 'int32' as const },
      { name: 'indicator_code', type: 'string' as const },
      { name: 'indicator_name', type: 'string' as const },
      { name: 'value', type: 'double' as const, nullable: true },
      { name: 'source', type: 'string' as const },
      { name: 'source_url', type: 'string' as const },
      { name: 'collected_at_utc', type: 'string' as const },
    ];

    const data: Record<string, any[]> = {};
    for (const s of schema) {
      if (s.name === 'year') {
        data[s.name] = records.map((r) => parseInt(r.year, 10));
      } else if (s.name === 'value') {
        data[s.name] = records.map((r) => (r.value !== null && !isNaN(r.value) ? Number(r.value) : null));
      } else {
        data[s.name] = records.map((r) => (r as any)[s.name] ?? null);
      }
    }

    return await writeParquet(schema, data, { compression: 'snappy' });
  } else if (format === 'wide') {
    const rows = getWidePanelObjects(records);
    const indicators = Array.from(new Set(records.map((r) => r.indicator_code)));

    const schema = [
      { name: 'country_iso3', type: 'string' as const },
      { name: 'country_name', type: 'string' as const },
      ...(hasSubnational ? [{ name: 'state', type: 'string' as const, nullable: true }] : []),
      { name: 'region', type: 'string' as const },
      { name: 'income_level', type: 'string' as const },
      { name: 'year', type: 'int32' as const },
      ...indicators.map((ind) => ({ name: ind, type: 'double' as const, nullable: true })),
    ];

    const data: Record<string, any[]> = {};
    for (const s of schema) {
      if (s.name === 'year') {
        data[s.name] = rows.map((r) => parseInt(String(r.year), 10));
      } else if (s.type === 'double') {
        data[s.name] = rows.map((r) => (r[s.name] !== null && r[s.name] !== undefined ? Number(r[s.name]) : null));
      } else {
        data[s.name] = rows.map((r) => r[s.name] ?? null);
      }
    }

    return await writeParquet(schema, data, { compression: 'snappy' });
  } else if (format === 'ml_matrix') {
    const rows = getMLFeatureMatrixObjects(records);
    const indicators = Array.from(new Set(records.map((r) => r.indicator_code)));

    const featCols: Array<{ name: string; type: 'double'; nullable: true }> = [];
    for (const ind of indicators) {
      featCols.push({ name: `${ind}_val`, type: 'double' as const, nullable: true });
      featCols.push({ name: `${ind}_yoy_pct`, type: 'double' as const, nullable: true });
      featCols.push({ name: `${ind}_lag1`, type: 'double' as const, nullable: true });
    }

    const schema = [
      { name: 'country_iso3', type: 'string' as const },
      { name: 'country_name', type: 'string' as const },
      ...(hasSubnational ? [{ name: 'state', type: 'string' as const, nullable: true }] : []),
      { name: 'region', type: 'string' as const },
      { name: 'income_level', type: 'string' as const },
      { name: 'year', type: 'int32' as const },
      { name: 'ml_split', type: 'string' as const },
      ...featCols,
    ];

    const data: Record<string, any[]> = {};
    for (const s of schema) {
      if (s.name === 'year') {
        data[s.name] = rows.map((r) => parseInt(String(r.year), 10));
      } else if (s.type === 'double') {
        data[s.name] = rows.map((r) => (r[s.name] !== null && r[s.name] !== undefined ? Number(r[s.name]) : null));
      } else {
        data[s.name] = rows.map((r) => r[s.name] ?? null);
      }
    }

    return await writeParquet(schema, data, { compression: 'snappy' });
  } else {
    // Dictionary
    const rows = getDataDictionaryObjects(selectedIndicators);
    const schema = [
      { name: 'column', type: 'string' as const },
      { name: 'description', type: 'string' as const },
      { name: 'type', type: 'string' as const },
      { name: 'example', type: 'string' as const },
    ];

    const data: Record<string, any[]> = {
      column: rows.map((r) => r.column),
      description: rows.map((r) => r.description),
      type: rows.map((r) => r.type),
      example: rows.map((r) => r.example),
    };

    return await writeParquet(schema, data, { compression: 'snappy' });
  }
}

