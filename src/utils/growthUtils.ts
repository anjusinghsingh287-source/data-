import { CleanRecord, DatasetYoYAnalysis, IndicatorYoYSummary, YoYGrowthRecord } from '../types';

/**
 * Calculates Year-over-Year (YoY) growth percentages for a cleaned panel dataset.
 *
 * Formula:
 *   YoY Growth (%) = ((Value_t - Value_{t-1}) / |Value_{t-1}|) * 100
 *
 * Robustly groups observations by entity (country + optional state) and indicator,
 * sorts chronologically, and calculates consecutive transition growth rates alongside
 * distribution moments (median, mean, positive vs negative shares, latest period changes).
 */
export function calculateYoYGrowth(records: CleanRecord[]): DatasetYoYAnalysis {
  if (!records || records.length === 0) {
    return {
      recordsWithYoY: [],
      byIndicator: {},
      overallLatestYoY: null,
      overallMeanYoY: null,
      totalTransitions: 0,
    };
  }

  // 1. Group records by entity (country_iso3 + state) and indicator_code
  // key: `${country_iso3}__${state || 'national'}__${indicator_code}`
  const entityGroups = new Map<string, CleanRecord[]>();

  for (const r of records) {
    if (r.value === null || r.value === undefined || isNaN(r.value)) continue;
    const groupKey = `${r.country_iso3}__${r.state || 'national'}__${r.indicator_code}`;
    const group = entityGroups.get(groupKey);
    if (group) {
      group.push(r);
    } else {
      entityGroups.set(groupKey, [r]);
    }
  }

  const allYoYRecords: YoYGrowthRecord[] = [];
  const indicatorTransitions = new Map<string, YoYGrowthRecord[]>();

  // 2. For each group, sort by year ascending and calculate consecutive transitions
  for (const group of entityGroups.values()) {
    if (group.length < 2) continue;

    // Sort chronologically
    group.sort((a, b) => parseInt(a.year, 10) - parseInt(b.year, 10));

    for (let i = 1; i < group.length; i++) {
      const prev = group[i - 1];
      const curr = group[i];

      const prevYearNum = parseInt(prev.year, 10);
      const currYearNum = parseInt(curr.year, 10);
      const yearDiff = currYearNum - prevYearNum;

      // Ensure valid temporal progression (allow consecutive 1-year or multi-year survey gaps)
      if (yearDiff <= 0) continue;

      const prevVal = prev.value;
      const currVal = curr.value;
      const absoluteChange = currVal - prevVal;

      let yoyPct = 0;
      if (Math.abs(prevVal) > 1e-9) {
        yoyPct = (absoluteChange / Math.abs(prevVal)) * 100;
      } else if (Math.abs(currVal) > 1e-9) {
        // From 0 to positive or negative
        yoyPct = currVal > 0 ? 100 : -100;
      }

      const yoyRecord: YoYGrowthRecord = {
        country_iso3: curr.country_iso3,
        country_name: curr.country_name,
        state: curr.state,
        admin_level: curr.admin_level,
        indicator_code: curr.indicator_code,
        indicator_name: curr.indicator_name,
        year: curr.year,
        prevYear: prev.year,
        value: currVal,
        prevValue: prevVal,
        yoyPct,
        absoluteChange,
      };

      allYoYRecords.push(yoyRecord);

      const indList = indicatorTransitions.get(curr.indicator_code);
      if (indList) {
        indList.push(yoyRecord);
      } else {
        indicatorTransitions.set(curr.indicator_code, [yoyRecord]);
      }
    }
  }

  // 3. Compute indicator-level summary statistics
  const byIndicator: Record<string, IndicatorYoYSummary> = {};
  const latestYoYValuesForAll: number[] = [];
  const allMeanYoYValues: number[] = [];

  for (const [code, transitions] of indicatorTransitions.entries()) {
    if (transitions.length === 0) continue;

    const indName = transitions[0].indicator_name;
    const values = transitions.map((t) => t.yoyPct).sort((a, b) => a - b);
    const n = values.length;

    const mean = values.reduce((sum, v) => sum + v, 0) / n;
    const median = values[Math.floor(n / 2)];

    // Find the latest consecutive transition year pair in this indicator
    const years = transitions.map((t) => parseInt(t.year, 10));
    const maxYear = Math.max(...years);
    const latestPairTransitions = transitions.filter((t) => parseInt(t.year, 10) === maxYear);

    let latestAvgYoY: number | null = null;
    let latestMedianYoY: number | null = null;
    let latestYearPair = `${maxYear - 1} → ${maxYear}`;

    if (latestPairTransitions.length > 0) {
      const latestValues = latestPairTransitions.map((t) => t.yoyPct).sort((a, b) => a - b);
      latestAvgYoY = latestValues.reduce((sum, v) => sum + v, 0) / latestValues.length;
      latestMedianYoY = latestValues[Math.floor(latestValues.length / 2)];
      latestYearPair = `${latestPairTransitions[0].prevYear} → ${latestPairTransitions[0].year}`;
      latestYoYValuesForAll.push(latestAvgYoY);
    }

    allMeanYoYValues.push(mean);

    // Calculate growth distribution shares
    const positiveCount = transitions.filter((t) => t.yoyPct > 0.01).length;
    const negativeCount = transitions.filter((t) => t.yoyPct < -0.01).length;
    const flatCount = n - positiveCount - negativeCount;

    // Identify maximum single-year growth surge and contraction
    let maxSurge = transitions[0];
    let maxDecline = transitions[0];

    for (const t of transitions) {
      if (t.yoyPct > maxSurge.yoyPct) maxSurge = t;
      if (t.yoyPct < maxDecline.yoyPct) maxDecline = t;
    }

    byIndicator[code] = {
      indicator_code: code,
      indicator_name: indName,
      latestYearPair,
      latestAvgYoY,
      latestMedianYoY,
      overallMeanYoY: mean,
      overallMedianYoY: median,
      positiveShare: (positiveCount / n) * 100,
      negativeShare: (negativeCount / n) * 100,
      flatShare: (flatCount / n) * 100,
      totalTransitions: n,
      maxSurgeCountry: {
        country_name: maxSurge.country_name,
        state: maxSurge.state,
        yoyPct: maxSurge.yoyPct,
        year: maxSurge.year,
      },
      maxDeclineCountry: {
        country_name: maxDecline.country_name,
        state: maxDecline.state,
        yoyPct: maxDecline.yoyPct,
        year: maxDecline.year,
      },
    };
  }

  // 4. Overall dataset momentum
  const overallLatestYoY =
    latestYoYValuesForAll.length > 0
      ? latestYoYValuesForAll.reduce((acc, v) => acc + v, 0) / latestYoYValuesForAll.length
      : null;

  const overallMeanYoY =
    allMeanYoYValues.length > 0
      ? allMeanYoYValues.reduce((acc, v) => acc + v, 0) / allMeanYoYValues.length
      : null;

  return {
    recordsWithYoY: allYoYRecords,
    byIndicator,
    overallLatestYoY,
    overallMeanYoY,
    totalTransitions: allYoYRecords.length,
  };
}

/**
 * Formats a YoY growth percentage value for UI rendering.
 * e.g., 3.42 -> "+3.4%", -1.2 -> "-1.2%", 0 -> "0.0%"
 */
export function formatYoYPercent(
  value: number | null | undefined,
  includeSign: boolean = true,
  decimals: number = 1
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A';
  }

  const sign = includeSign && value > 0 ? '+' : '';
  // Avoid "-0.0%" for small negative numbers
  if (Math.abs(value) < Math.pow(10, -decimals) / 2) {
    return (0).toFixed(decimals) + '%';
  }

  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Returns directional trend classification: 'up' | 'down' | 'flat' | 'na'
 */
export function getYoYTrendDirection(
  value: number | null | undefined,
  threshold: number = 0.05
): 'up' | 'down' | 'flat' | 'na' {
  if (value === null || value === undefined || isNaN(value)) {
    return 'na';
  }
  if (value > threshold) return 'up';
  if (value < -threshold) return 'down';
  return 'flat';
}
