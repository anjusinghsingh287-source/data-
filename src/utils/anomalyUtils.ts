import { CleanRecord, IndicatorSummaryStat } from '../types';

export interface AnomalyRecord {
  id: string;
  country_iso3: string;
  country_name: string;
  state?: string;
  admin_level?: 'national' | 'state';
  region: string;
  income_level: string;
  year: string;
  indicator_code: string;
  indicator_name: string;
  value: number;
  mean: number;
  std: number;
  zScore: number; // (value - mean) / std
  absoluteDelta: number; // value - mean
  pctDeltaFromMean: number; // ((value - mean) / mean) * 100
  deviationDirection: 'positive' | 'negative';
  severity: 'moderate' | 'extreme' | 'critical'; // 3-4σ = moderate, 4-5σ = extreme, >5σ = critical
}

export interface IndicatorAnomalySummary {
  indicator_code: string;
  indicator_name: string;
  totalAnomalies: number;
  anomalyRatePct: number;
  positiveAnomalies: number;
  negativeAnomalies: number;
  maxZScore: number;
  minZScore: number;
  mean: number;
  std: number;
}

export interface DatasetAnomalyAnalysis {
  anomalies: AnomalyRecord[];
  totalAnomalies: number;
  anomalyRatePct: number;
  byIndicator: Record<string, IndicatorAnomalySummary>;
  affectedCountriesCount: number;
  affectedIndicatorsCount: number;
  maxZScoreRecord: AnomalyRecord | null;
  minZScoreRecord: AnomalyRecord | null;
}

/**
 * Detects observations that deviate beyond a specified standard deviation threshold (default 3.0σ)
 * from the cross-sectional indicator mean.
 */
export function detectAnomalies(
  records: CleanRecord[],
  thresholdSigma: number = 3.0,
  precomputedStats?: IndicatorSummaryStat[]
): DatasetAnomalyAnalysis {
  const statsMap = new Map<string, { mean: number; std: number; name: string; count: number }>();

  if (precomputedStats && precomputedStats.length > 0) {
    for (const s of precomputedStats) {
      statsMap.set(s.code, {
        mean: s.mean,
        std: s.std,
        name: s.name,
        count: s.count,
      });
    }
  } else {
    const byInd: Record<string, { name: string; vals: number[] }> = {};
    for (const r of records) {
      if (!byInd[r.indicator_code]) {
        byInd[r.indicator_code] = { name: r.indicator_name, vals: [] };
      }
      byInd[r.indicator_code].vals.push(r.value);
    }
    for (const [code, info] of Object.entries(byInd)) {
      const n = info.vals.length;
      if (n === 0) continue;
      const mean = info.vals.reduce((a, b) => a + b, 0) / n;
      const variance = info.vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n > 1 ? n - 1 : 1);
      const std = Math.sqrt(variance);
      statsMap.set(code, { mean, std, name: info.name, count: n });
    }
  }

  const anomalies: AnomalyRecord[] = [];
  const byIndicator: Record<string, IndicatorAnomalySummary> = {};
  const affectedCountries = new Set<string>();
  const affectedIndicators = new Set<string>();

  for (const r of records) {
    const stat = statsMap.get(r.indicator_code);
    if (!stat || stat.std <= 1e-9) continue;

    const diff = r.value - stat.mean;
    const zScore = diff / stat.std;

    if (Math.abs(zScore) >= thresholdSigma) {
      const direction: 'positive' | 'negative' = zScore > 0 ? 'positive' : 'negative';
      const absZ = Math.abs(zScore);
      const severity: 'moderate' | 'extreme' | 'critical' =
        absZ >= 5.0 ? 'critical' : absZ >= 4.0 ? 'extreme' : 'moderate';

      const pctDelta = Math.abs(stat.mean) > 1e-9 ? (diff / Math.abs(stat.mean)) * 100 : 0;

      const anomalyItem: AnomalyRecord = {
        id: `${r.country_iso3}__${r.state || 'nat'}__${r.year}__${r.indicator_code}`,
        country_iso3: r.country_iso3,
        country_name: r.country_name,
        state: r.state,
        admin_level: r.admin_level,
        region: r.region,
        income_level: r.income_level,
        year: r.year,
        indicator_code: r.indicator_code,
        indicator_name: r.indicator_name || stat.name,
        value: r.value,
        mean: stat.mean,
        std: stat.std,
        zScore,
        absoluteDelta: diff,
        pctDeltaFromMean: pctDelta,
        deviationDirection: direction,
        severity,
      };

      anomalies.push(anomalyItem);
      affectedCountries.add(r.country_iso3);
      affectedIndicators.add(r.indicator_code);

      if (!byIndicator[r.indicator_code]) {
        byIndicator[r.indicator_code] = {
          indicator_code: r.indicator_code,
          indicator_name: r.indicator_name || stat.name,
          totalAnomalies: 0,
          anomalyRatePct: 0,
          positiveAnomalies: 0,
          negativeAnomalies: 0,
          maxZScore: zScore,
          minZScore: zScore,
          mean: stat.mean,
          std: stat.std,
        };
      }

      const indSummary = byIndicator[r.indicator_code];
      indSummary.totalAnomalies++;
      if (direction === 'positive') indSummary.positiveAnomalies++;
      else indSummary.negativeAnomalies++;
      indSummary.maxZScore = Math.max(indSummary.maxZScore, zScore);
      indSummary.minZScore = Math.min(indSummary.minZScore, zScore);
      indSummary.anomalyRatePct = (indSummary.totalAnomalies / Math.max(stat.count, 1)) * 100;
    }
  }

  // Sort anomalies by absolute z-score descending (most extreme first)
  anomalies.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));

  let maxZRecord: AnomalyRecord | null = null;
  let minZRecord: AnomalyRecord | null = null;

  for (const anom of anomalies) {
    if (!maxZRecord || anom.zScore > maxZRecord.zScore) maxZRecord = anom;
    if (!minZRecord || anom.zScore < minZRecord.zScore) minZRecord = anom;
  }

  return {
    anomalies,
    totalAnomalies: anomalies.length,
    anomalyRatePct: records.length > 0 ? (anomalies.length / records.length) * 100 : 0,
    byIndicator,
    affectedCountriesCount: affectedCountries.size,
    affectedIndicatorsCount: affectedIndicators.size,
    maxZScoreRecord: maxZRecord,
    minZScoreRecord: minZRecord,
  };
}
