import React from 'react';
import { CleaningOptions, CleanRecord, RawRecord } from '../types';
import { Filter, Check, AlertTriangle, ArrowRight, Layers, FileCheck } from 'lucide-react';

interface CleanStepProps {
  cleaningOptions: CleaningOptions;
  setCleaningOptions: React.Dispatch<React.SetStateAction<CleaningOptions>>;
  rawRecords: RawRecord[];
  cleanRecords: CleanRecord[];
  duplicatesRemoved: number;
  emptyRemoved: number;
  onProceed: () => void;
}

export const CleanStep: React.FC<CleanStepProps> = ({
  cleaningOptions,
  setCleaningOptions,
  rawRecords,
  cleanRecords,
  duplicatesRemoved,
  emptyRemoved,
  onProceed,
}) => {
  const rawN = rawRecords.length;
  const cleanN = cleanRecords.length;
  const totalRemoved = duplicatesRemoved + emptyRemoved;
  const retentionPct = rawN > 0 ? ((cleanN / rawN) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-8 pb-12">
      {/* Editorial Title Section */}
      <div className="border-b border-slate-200 pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-blue-700 tracking-wider uppercase">
            Step 3 · Data Purification & Integrity
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Clean & Normalize Observations
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Coerce observations to 64-bit IEEE floating-point numbers, eliminate incomplete entity-year observations, and deduplicate on primary composite key `(country_iso3, year, indicator_code)`.
          </p>
        </div>

        <button
          onClick={onProceed}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm self-start md:self-auto shrink-0"
        >
          <span>Run Quality Diagnostics</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Cleaning Rule Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg border border-slate-200 space-y-4 md:col-span-1">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-600" />
            <h2 className="text-base font-semibold text-slate-900">
              Pipeline Cleaning Rules
            </h2>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Replicates `clean(records)` from the Python research script with optional econometric imputation.
          </p>

          <div className="space-y-4 pt-2">
            {/* Rule 1: Drop Nulls */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={cleaningOptions.dropNulls}
                onChange={(e) =>
                  setCleaningOptions({ ...cleaningOptions, dropNulls: e.target.checked })
                }
                className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="text-xs font-semibold text-slate-800 block">
                  Drop Null / Missing (`value is None`)
                </span>
                <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">
                  Filters sparse World Bank reporting gaps.
                </span>
              </div>
            </label>

            {/* Rule 2: Deduplication */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={cleaningOptions.dropDuplicates}
                onChange={(e) =>
                  setCleaningOptions({ ...cleaningOptions, dropDuplicates: e.target.checked })
                }
                className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="text-xs font-semibold text-slate-800 block">
                  Deduplicate on Primary Key
                </span>
                <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">
                  Enforces uniqueness across (ISO3, Year, Indicator).
                </span>
              </div>
            </label>

            {/* Rule 3: Imputation Strategy */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                Econometric Imputation Method
              </label>
              <select
                value={cleaningOptions.imputation}
                onChange={(e) =>
                  setCleaningOptions({
                    ...cleaningOptions,
                    imputation: e.target.value as any,
                  })
                }
                className="w-full px-3 py-1.5 text-xs text-slate-900 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="none">None (Standard Python Script: Strict Drop)</option>
                <option value="ffill">Forward Fill (Last Observation Carried Forward)</option>
              </select>
              <span className="text-[11px] text-slate-500 block mt-1">
                Strict drop is standard practice for World Bank cross-country papers.
              </span>
            </div>
          </div>
        </div>

        {/* Audit Waterfall & Reconciliation */}
        <div className="bg-white p-6 rounded-lg border border-slate-200 md:col-span-2 space-y-5">
          <h2 className="text-base font-semibold text-slate-900">
            Observation Retention Waterfall
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-50 p-4 rounded border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Raw Input Rows
              </span>
              <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1 block">
                {rawN.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                100% of collected
              </span>
            </div>

            <div className="bg-amber-50/50 p-4 rounded border border-amber-200/60">
              <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider block">
                Null Rows Dropped
              </span>
              <span className="text-2xl font-bold text-amber-900 font-mono tabular-nums mt-1 block">
                -{emptyRemoved.toLocaleString()}
              </span>
              <span className="text-[10px] text-amber-700 font-mono block mt-0.5">
                {rawN > 0 ? ((emptyRemoved / rawN) * 100).toFixed(1) : 0}% of raw
              </span>
            </div>

            <div className="bg-amber-50/50 p-4 rounded border border-amber-200/60">
              <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider block">
                Duplicates Pruned
              </span>
              <span className="text-2xl font-bold text-amber-900 font-mono tabular-nums mt-1 block">
                -{duplicatesRemoved.toLocaleString()}
              </span>
              <span className="text-[10px] text-amber-700 font-mono block mt-0.5">
                Redundant keys
              </span>
            </div>

            <div className="bg-emerald-50/60 p-4 rounded border border-emerald-200">
              <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">
                Purified Dataset
              </span>
              <span className="text-2xl font-bold text-emerald-900 font-mono tabular-nums mt-1 block">
                {cleanN.toLocaleString()}
              </span>
              <span className="text-[10px] text-emerald-700 font-mono block mt-0.5">
                {retentionPct}% retention rate
              </span>
            </div>
          </div>

          {/* Verification Statement */}
          <div className="p-4 bg-slate-50 rounded border border-slate-200 text-xs text-slate-700 flex items-start gap-3">
            <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="text-slate-900">Type Guarantee:</strong> All `{cleanN.toLocaleString()}` kept values are strictly verified as non-null floating-point numbers (`typeof value === 'number' && !isNaN(value)`). Canonical composite index `(country_iso3, indicator_code, year)` is sorted and ready for panel estimators.
            </div>
          </div>
        </div>
      </div>

      {/* Clean Records Sample Inspection Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Cleaned Observation Stream Preview
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Showing first 8 records of the cleaned research dataset
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500">
            Total clean rows: {cleanN.toLocaleString()}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4 font-mono">ISO3</th>
                <th className="py-2.5 px-4">Country Name</th>
                <th className="py-2.5 px-4">Region</th>
                <th className="py-2.5 px-4 font-mono">Year</th>
                <th className="py-2.5 px-4 font-mono">Series Code</th>
                <th className="py-2.5 px-4 text-right font-mono">Value</th>
                <th className="py-2.5 px-4">Income Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono tabular-nums text-slate-700">
              {cleanRecords.slice(0, 8).map((r, i) => (
                <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-4 font-bold text-blue-700">{r.country_iso3}</td>
                  <td className="py-2.5 px-4 font-sans font-medium text-slate-900">{r.country_name}</td>
                  <td className="py-2.5 px-4 font-sans text-slate-600">{r.region}</td>
                  <td className="py-2.5 px-4 text-slate-800">{r.year}</td>
                  <td className="py-2.5 px-4 text-slate-600">{r.indicator_code}</td>
                  <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                    {r.value >= 10000 ? r.value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : r.value.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-4 font-sans text-slate-500 text-[11px]">{r.income_level}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
