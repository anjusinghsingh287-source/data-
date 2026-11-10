import React, { useState } from 'react';
import { CleanRecord } from '../types';
import {
  generateReproducibleCode,
  exportToCSV,
  exportDataDictionaryCSV,
  exportMLFeatureMatrixCSV,
  exportToJSON,
  exportToExcel,
  exportToParquet,
  generateJupyterNotebookContent,
  generateMachineLearningPipelineScript,
} from '../services/worldBankService';
import {
  generateGitHubActionsWorkflow,
  generateCrontabSyntax,
  generatePythonDaemonScript,
} from '../services/scheduleService';
import {
  Download,
  Copy,
  Check,
  FileCode,
  BookOpen,
  Quote,
  Sparkles,
  Clock,
  Terminal,
  Cpu,
  Layers,
  Play,
  CheckCheck,
  FileSpreadsheet,
  Database,
  Binary,
  FileJson,
  FileText,
  Loader2,
  Table,
} from 'lucide-react';

interface ExportStepProps {
  cleanRecords: CleanRecord[];
  selectedIndicators: string[];
  startYear: number;
  endYear: number;
  researchTitle: string;
}

export type ExportFormat = 'csv' | 'json' | 'parquet' | 'xlsx';

export const ExportStep: React.FC<ExportStepProps> = ({
  cleanRecords,
  selectedIndicators,
  startYear,
  endYear,
  researchTitle,
}) => {
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [ingestionLibrary, setIngestionLibrary] = useState<'pandas' | 'pyspark'>('pandas');
  const [copiedIngestionCode, setCopiedIngestionCode] = useState(false);

  const [activeCodeLang, setActiveCodeLang] = useState<'jupyter' | 'ml_python' | 'python' | 'r' | 'stata'>('jupyter');
  const [targetIndicator, setTargetIndicator] = useState<string>(selectedIndicators[0] || 'NY.GDP.PCAP.CD');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedBibtex, setCopiedBibtex] = useState(false);

  const codeText = generateReproducibleCode(activeCodeLang, selectedIndicators, startYear, endYear, targetIndicator);

  const bibtexText = `@misc{worldbank_${new Date().getFullYear()},
  author = {{The World Bank}},
  title = {World Development Indicators: Open Data API},
  year = {${new Date().getFullYear()}},
  url = {https://data.worldbank.org/},
  note = {Accessed via Global Data Collection Studio on ${new Date().toISOString().split('T')[0]}}
}`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(codeText);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyBibtex = () => {
    navigator.clipboard.writeText(bibtexText);
    setCopiedBibtex(true);
    setTimeout(() => setCopiedBibtex(false), 2000);
  };

  const downloadData = (filename: string, content: string | Uint8Array, mimeType: string) => {
    const blob = new Blob([content as any], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownload = async (target: 'ml_matrix' | 'long' | 'wide' | 'dictionary' | 'master') => {
    setIsExporting(target);
    try {
      if (exportFormat === 'csv') {
        const mime = 'text/csv;charset=utf-8;';
        if (target === 'ml_matrix') {
          downloadData('ml_feature_matrix.csv', exportMLFeatureMatrixCSV(cleanRecords), mime);
        } else if (target === 'long') {
          downloadData('global_data.csv', exportToCSV(cleanRecords, 'long'), mime);
        } else if (target === 'wide') {
          downloadData('global_data_wide_panel.csv', exportToCSV(cleanRecords, 'wide'), mime);
        } else if (target === 'dictionary') {
          downloadData('global_data_dictionary.csv', exportDataDictionaryCSV(selectedIndicators), mime);
        }
      } else if (exportFormat === 'json') {
        const mime = 'application/json;charset=utf-8;';
        if (target === 'ml_matrix') {
          downloadData('ml_feature_matrix.json', exportToJSON(cleanRecords, 'ml_matrix', selectedIndicators), mime);
        } else if (target === 'long') {
          downloadData('global_data.json', exportToJSON(cleanRecords, 'long', selectedIndicators), mime);
        } else if (target === 'wide') {
          downloadData('global_data_wide_panel.json', exportToJSON(cleanRecords, 'wide', selectedIndicators), mime);
        } else if (target === 'dictionary') {
          downloadData('global_data_dictionary.json', exportToJSON(cleanRecords, 'dictionary', selectedIndicators), mime);
        }
      } else if (exportFormat === 'xlsx') {
        const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        if (target === 'master') {
          const buf = exportToExcel(cleanRecords, selectedIndicators, 'master');
          downloadData('global_data_master_workbook.xlsx', buf, mime);
        } else if (target === 'ml_matrix') {
          const buf = exportToExcel(cleanRecords, selectedIndicators, 'ml_matrix');
          downloadData('ml_feature_matrix.xlsx', buf, mime);
        } else if (target === 'long') {
          const buf = exportToExcel(cleanRecords, selectedIndicators, 'long');
          downloadData('global_data.xlsx', buf, mime);
        } else if (target === 'wide') {
          const buf = exportToExcel(cleanRecords, selectedIndicators, 'wide');
          downloadData('global_data_wide_panel.xlsx', buf, mime);
        } else if (target === 'dictionary') {
          const buf = exportToExcel(cleanRecords, selectedIndicators, 'dictionary');
          downloadData('global_data_dictionary.xlsx', buf, mime);
        }
      } else if (exportFormat === 'parquet') {
        const mime = 'application/octet-stream';
        if (target === 'ml_matrix') {
          const buf = await exportToParquet(cleanRecords, 'ml_matrix', selectedIndicators);
          downloadData('ml_feature_matrix.parquet', buf, mime);
        } else if (target === 'long') {
          const buf = await exportToParquet(cleanRecords, 'long', selectedIndicators);
          downloadData('global_data.parquet', buf, mime);
        } else if (target === 'wide') {
          const buf = await exportToParquet(cleanRecords, 'wide', selectedIndicators);
          downloadData('global_data_wide_panel.parquet', buf, mime);
        } else if (target === 'dictionary') {
          const buf = await exportToParquet(cleanRecords, 'dictionary', selectedIndicators);
          downloadData('global_data_dictionary.parquet', buf, mime);
        }
      }
    } catch (err) {
      console.error('Export download error:', err);
    } finally {
      setIsExporting(null);
    }
  };

  const handleDownloadJupyterNotebook = () => {
    const ipynbContent = generateJupyterNotebookContent(selectedIndicators, startYear, endYear, targetIndicator);
    downloadData('worldbank_ml_pipeline.ipynb', ipynbContent, 'application/json');
  };

  const fileExt = exportFormat === 'xlsx' ? 'xlsx' : exportFormat === 'parquet' ? 'parquet' : exportFormat === 'json' ? 'json' : 'csv';

  // Pandas & PySpark snippet generator for active format
  const getIngestionSnippet = (): string => {
    if (exportFormat === 'parquet') {
      if (ingestionLibrary === 'pandas') {
        return `# Ingest Parquet into Pandas (with PyArrow engine)
import pandas as pd

df = pd.read_parquet("ml_feature_matrix.parquet", engine="pyarrow")
print(f"Loaded {df.shape[0]:,} rows x {df.shape[1]} features.")
print("Train split:", (df["ml_split"] == "train").sum())
print("Test split :", (df["ml_split"] == "test").sum())`;
      } else {
        return `# Ingest Parquet into PySpark (Distributed columnar scan)
from pyspark.sql import SparkSession

spark = SparkSession.builder.appName("WorldBankML").getOrCreate()
df = spark.read.parquet("ml_feature_matrix.parquet")
df.printSchema()
df.groupBy("ml_split").count().show()`;
      }
    } else if (exportFormat === 'json') {
      if (ingestionLibrary === 'pandas') {
        return `# Ingest structured JSON records into Pandas
import pandas as pd

df = pd.read_json("ml_feature_matrix.json")
print(f"Loaded {df.shape[0]:,} rows x {df.shape[1]} features.")
df.head()`;
      } else {
        return `# Ingest JSON records into PySpark
from pyspark.sql import SparkSession

spark = SparkSession.builder.appName("WorldBankML").getOrCreate()
df = spark.read.json("ml_feature_matrix.json")
df.printSchema()
df.show(5)`;
      }
    } else if (exportFormat === 'xlsx') {
      if (ingestionLibrary === 'pandas') {
        return `# Ingest Excel into Pandas (using openpyxl engine)
import pandas as pd

# 1. Read Master multi-sheet workbook or individual file
df_ml = pd.read_excel("global_data_master_workbook.xlsx", sheet_name="ML_Feature_Matrix")
# 2. Inspect available sheets
excel_book = pd.ExcelFile("global_data_master_workbook.xlsx")
print("Sheets:", excel_book.sheet_names)
print(f"Loaded {df_ml.shape[0]:,} rows x {df_ml.shape[1]} features.")`;
      } else {
        return `# Ingest Excel into PySpark (via spark-excel package)
from pyspark.sql import SparkSession

spark = SparkSession.builder.appName("WorldBankML").getOrCreate()
df = spark.read.format("com.crealytics.spark.excel") \\
    .option("header", "true") \\
    .option("dataAddress", "'ML_Feature_Matrix'!A1") \\
    .load("global_data_master_workbook.xlsx")
df.show(5)`;
      }
    } else {
      // CSV
      if (ingestionLibrary === 'pandas') {
        return `# Ingest CSV with UTF-8 BOM encoding into Pandas
import pandas as pd

df = pd.read_csv("ml_feature_matrix.csv", encoding="utf-8-sig")
print(f"Loaded {df.shape[0]:,} rows x {df.shape[1]} features.")
df.head()`;
      } else {
        return `# Ingest CSV into PySpark with schema inference
from pyspark.sql import SparkSession

spark = SparkSession.builder.appName("WorldBankML").getOrCreate()
df = spark.read.option("header", "true") \\
    .option("inferSchema", "true") \\
    .csv("ml_feature_matrix.csv")
df.printSchema()
df.show(5)`;
      }
    }
  };

  const handleCopyIngestion = () => {
    navigator.clipboard.writeText(getIngestionSnippet());
    setCopiedIngestionCode(true);
    setTimeout(() => setCopiedIngestionCode(false), 2000);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Editorial Title Section */}
      <div className="border-b border-slate-200 pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-blue-700 tracking-wider uppercase">
              Step 6 · Dissemination & Replication
            </span>
            <span className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
              Panel up to {endYear} Active
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Export Artifacts & Replication Package
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Download peer-review ready datasets in CSV, JSON, Apache Parquet, or Excel (.xlsx) formats with full data compatibility for Pandas, PySpark, and scikit-learn.
          </p>
        </div>
      </div>

      {/* Format Selector Bar */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
              <Database className="w-4 h-4 text-blue-600" />
              Target Dataset Export Format
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select the serialization structure for machine learning workflows and statistical toolchains.
            </p>
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            Active: <span className="font-semibold text-blue-700 uppercase">.{fileExt}</span>
          </div>
        </div>

        {/* Format Selector Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {/* CSV */}
          <button
            onClick={() => setExportFormat('csv')}
            className={`p-3 text-left rounded border transition-all cursor-pointer ${
              exportFormat === 'csv'
                ? 'bg-white border-blue-600 ring-1 ring-blue-600 shadow-xs'
                : 'bg-white/80 border-slate-200 hover:border-slate-300 hover:bg-white text-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <FileText className={`w-4 h-4 ${exportFormat === 'csv' ? 'text-blue-600' : 'text-slate-500'}`} />
                <span className="text-xs font-bold text-slate-900">CSV (RFC 4180)</span>
              </div>
              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded">
                .csv
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">
              Standard UTF-8 BOM. Universal support across R, Stata, Excel, and Pandas.
            </p>
            <div className="mt-2 text-[10px] font-mono text-slate-400">
              Universal · Text
            </div>
          </button>

          {/* JSON */}
          <button
            onClick={() => setExportFormat('json')}
            className={`p-3 text-left rounded border transition-all cursor-pointer ${
              exportFormat === 'json'
                ? 'bg-white border-blue-600 ring-1 ring-blue-600 shadow-xs'
                : 'bg-white/80 border-slate-200 hover:border-slate-300 hover:bg-white text-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <FileJson className={`w-4 h-4 ${exportFormat === 'json' ? 'text-blue-600' : 'text-slate-500'}`} />
                <span className="text-xs font-bold text-slate-900">JSON (Structured)</span>
              </div>
              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded">
                .json
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">
              Tidy object arrays. Ideal for Web APIs, document stores, and JavaScript.
            </p>
            <div className="mt-2 text-[10px] font-mono text-slate-400">
              REST · Pandas · PySpark
            </div>
          </button>

          {/* Parquet */}
          <button
            onClick={() => setExportFormat('parquet')}
            className={`p-3 text-left rounded border transition-all cursor-pointer ${
              exportFormat === 'parquet'
                ? 'bg-white border-blue-600 ring-1 ring-blue-600 shadow-xs'
                : 'bg-white/80 border-slate-200 hover:border-slate-300 hover:bg-white text-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Binary className={`w-4 h-4 ${exportFormat === 'parquet' ? 'text-blue-600' : 'text-slate-500'}`} />
                <span className="text-xs font-bold text-slate-900">Apache Parquet</span>
              </div>
              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                .parquet
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">
              Snappy columnar compression. 5x–10x faster I/O for PySpark, DuckDB & PyTorch.
            </p>
            <div className="mt-2 text-[10px] font-mono text-blue-600 font-semibold">
              PySpark & Pandas ML Standard
            </div>
          </button>

          {/* Excel (.xlsx) */}
          <button
            onClick={() => setExportFormat('xlsx')}
            className={`p-3 text-left rounded border transition-all cursor-pointer ${
              exportFormat === 'xlsx'
                ? 'bg-white border-blue-600 ring-1 ring-blue-600 shadow-xs'
                : 'bg-white/80 border-slate-200 hover:border-slate-300 hover:bg-white text-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <FileSpreadsheet className={`w-4 h-4 ${exportFormat === 'xlsx' ? 'text-emerald-600' : 'text-slate-500'}`} />
                <span className="text-xs font-bold text-slate-900">Excel (.xlsx)</span>
              </div>
              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                .xlsx
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">
              Multi-sheet formatted spreadsheets. Directly opens in Microsoft Excel & Tableau.
            </p>
            <div className="mt-2 text-[10px] font-mono text-emerald-700 font-semibold">
              Master Multi-Sheet Workbook
            </div>
          </button>
        </div>

        {/* Pandas / PySpark Ingestion Quick Snippet Box */}
        <div className="mt-3 bg-slate-900 text-slate-200 rounded border border-slate-800 p-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2 mb-2">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs font-semibold text-slate-100">
                Machine Learning Ingestion Code ({exportFormat.toUpperCase()} &rarr; {ingestionLibrary === 'pandas' ? 'Pandas' : 'PySpark'})
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Toggle Pandas vs PySpark */}
              <div className="flex items-center bg-slate-800 p-0.5 rounded border border-slate-700 text-[11px]">
                <button
                  onClick={() => setIngestionLibrary('pandas')}
                  className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                    ingestionLibrary === 'pandas' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Pandas
                </button>
                <button
                  onClick={() => setIngestionLibrary('pyspark')}
                  className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                    ingestionLibrary === 'pyspark' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  PySpark
                </button>
              </div>

              <button
                onClick={handleCopyIngestion}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors cursor-pointer"
                title="Copy ingestion code"
              >
                {copiedIngestionCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedIngestionCode ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <pre className="text-xs font-mono text-blue-200/90 overflow-x-auto whitespace-pre leading-relaxed">
            {getIngestionSnippet()}
          </pre>
        </div>
      </div>

      {/* Dataset Download Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Card 1: Machine Learning Feature Matrix (Featured Card) */}
        <div className="bg-gradient-to-b from-blue-50/60 to-white p-5 rounded-lg border-2 border-blue-600 space-y-3 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-blue-600" />
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  ML Feature Matrix
                </h2>
              </div>
              <span className="text-[9px] font-semibold font-mono bg-blue-600 text-white px-1.5 py-0.2 rounded">
                .{fileExt}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
              Rectangular matrix with temporal split (<code className="text-blue-700">train &le; 2023</code>, <code className="text-emerald-700">test 2024–{endYear}</code>), Lag-1 predictors, and YoY % growth rates.
            </p>
            <div className="mt-2 text-[10px] font-mono text-slate-500 tabular-nums">
              {selectedIndicators.length * 3 + 6} features · Leakage-free
            </div>
          </div>

          <button
            onClick={() => handleDownload('ml_matrix')}
            disabled={isExporting === 'ml_matrix'}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors shadow-sm cursor-pointer disabled:opacity-75"
          >
            {isExporting === 'ml_matrix' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>Download ml_feature_matrix.{fileExt}</span>
          </button>
        </div>

        {/* Card 2: Main Long Dataset */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 space-y-3 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Download className="w-4 h-4 text-slate-700" />
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Primary Long Panel
                </h2>
              </div>
              <span className="text-[9px] font-semibold font-mono bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200">
                .{fileExt}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
              Canonical long panel format with columns `(country, state, year, indicator, value)` ready for panel estimators.
            </p>
            <div className="mt-2 text-[10px] font-mono text-slate-400 tabular-nums">
              {cleanRecords.length.toLocaleString()} rows · 12 fields
            </div>
          </div>

          <button
            onClick={() => handleDownload('long')}
            disabled={isExporting === 'long'}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded transition-colors cursor-pointer disabled:opacity-75"
          >
            {isExporting === 'long' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>Download global_data.{fileExt}</span>
          </button>
        </div>

        {/* Card 3: Wide Panel */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 space-y-3 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-600" />
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Wide Panel Matrix
                </h2>
              </div>
              <span className="text-[9px] font-semibold font-mono bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200">
                .{fileExt}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
              Pivoted rectangular format where each series is an individual column. Tailored directly for Stata and multivariate regressions.
            </p>
            <div className="mt-2 text-[10px] font-mono text-slate-400 tabular-nums">
              {selectedIndicators.length} series columns · Panel matrix
            </div>
          </div>

          <button
            onClick={() => handleDownload('wide')}
            disabled={isExporting === 'wide'}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded transition-colors cursor-pointer disabled:opacity-75"
          >
            {isExporting === 'wide' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>Download wide_panel.{fileExt}</span>
          </button>
        </div>

        {/* Card 4: Data Dictionary */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 space-y-3 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-purple-600" />
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Data Dictionary
                </h2>
              </div>
              <span className="text-[9px] font-semibold font-mono bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200">
                .{fileExt}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
              Harmonized variable documentation schema with series definitions, units, and official World Bank citations.
            </p>
            <div className="mt-2 text-[10px] font-mono text-slate-400 tabular-nums">
              ISO 3166 & World Bank definition catalog
            </div>
          </div>

          <button
            onClick={() => handleDownload('dictionary')}
            disabled={isExporting === 'dictionary'}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded transition-colors cursor-pointer disabled:opacity-75"
          >
            {isExporting === 'dictionary' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>Download dictionary.{fileExt}</span>
          </button>
        </div>

        {/* Card 5: Master Workbook (When Excel is active) OR Kaggle Spec (When other formats) */}
        {exportFormat === 'xlsx' ? (
          <div className="bg-gradient-to-b from-emerald-50/70 to-white p-5 rounded-lg border-2 border-emerald-600 space-y-3 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Table className="w-4 h-4 text-emerald-700" />
                  <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Master Workbook
                  </h2>
                </div>
                <span className="text-[9px] font-semibold font-mono bg-emerald-600 text-white px-1.5 py-0.2 rounded">
                  4 SHEETS
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                Single multi-sheet workbook consolidating <strong>ML_Feature_Matrix</strong>, <strong>Primary_Long_Panel</strong>, <strong>Wide_Panel</strong>, and <strong>Data_Dictionary</strong>.
              </p>
              <div className="mt-2 text-[10px] font-mono text-emerald-800 tabular-nums">
                All 4 panels unified in one file
              </div>
            </div>

            <button
              onClick={() => handleDownload('master')}
              disabled={isExporting === 'master'}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded transition-colors shadow-sm cursor-pointer disabled:opacity-75"
            >
              {isExporting === 'master' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>Download master_workbook.xlsx</span>
            </button>
          </div>
        ) : (
          <div className="bg-white p-5 rounded-lg border border-slate-200 space-y-3 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-sky-500" />
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Kaggle Spec (JSON)
                </h2>
              </div>
              <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                Official Kaggle API metadata schema for instant publishing to <span className="font-mono text-slate-700">kaggle.com/datasets</span> with license CC-BY-4.0.
              </p>
              <div className="mt-2 text-[10px] font-mono text-slate-400 tabular-nums">
                Kaggle API v1 format · Manifest JSON
              </div>
            </div>

            <button
              onClick={() => {
                const slug = (researchTitle || 'global-research-dataset')
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/(^-|-$)+/g, '');
                const kaggleMeta = {
                  title: researchTitle || "Global Sovereign Indicators & Development Metrics",
                  id: `researcher/${slug || 'global-indicators'}`,
                  licenses: [{ name: "CC-BY-4.0" }],
                  description: `Empirical research dataset harvested from World Bank Open Data catalog covering ${cleanRecords.length} observations across indicators (${selectedIndicators.join(', ')}) from ${startYear} to ${endYear}. Includes Machine Learning features and temporal split partitions.`,
                  keywords: ["world bank", "economics", "machine learning", "forecasting", "panel data", "time series"],
                  resources: [
                    {
                      path: `ml_feature_matrix.${fileExt}`,
                      description: `Machine Learning feature matrix (${fileExt.toUpperCase()}) with temporal split, lags, and YoY growth`
                    },
                    {
                      path: `global_data.${fileExt}`,
                      description: `Standard long format observations (${fileExt.toUpperCase()})`
                    },
                    {
                      path: `global_data_wide_panel.${fileExt}`,
                      description: `Econometric panel rectangular matrix (${fileExt.toUpperCase()})`
                    },
                    {
                      path: `global_data_dictionary.${fileExt}`,
                      description: `Variable dictionary & citation catalog (${fileExt.toUpperCase()})`
                    }
                  ]
                };
                downloadData('dataset-metadata.json', JSON.stringify(kaggleMeta, null, 2), 'application/json');
              }}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download dataset-metadata.json</span>
            </button>
          </div>
        )}
      </div>


      {/* Featured Machine Learning & Jupyter Notebook Pipeline Generator */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden space-y-4 p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-slate-900">
                Jupyter Notebook & Machine Learning Script Generator
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded">
                Colab & VS Code Ready
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1 max-w-3xl">
              Complete self-contained pipeline specifically designed for users to copy/paste directly into Jupyter Notebooks, Google Colab, or machine learning repositories. Includes automated API pagination, composite deduplication, temporal feature engineering, and baseline scikit-learn forecasting.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={handleDownloadJupyterNotebook}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors shadow-sm cursor-pointer"
              title="Download runnable .ipynb file directly"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .ipynb Notebook</span>
            </button>

            <button
              onClick={() => {
                const pyScript = generateMachineLearningPipelineScript(selectedIndicators, startYear, endYear, targetIndicator);
                downloadData('ml_pipeline.py', pyScript, 'text/x-python');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded transition-colors cursor-pointer"
              title="Download standalone CLI Python script"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download ml_pipeline.py</span>
            </button>

            <button
              onClick={handleCopyCode}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors shadow-sm cursor-pointer"
            >
              {copiedCode ? <CheckCheck className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? 'Copied to Clipboard!' : 'Copy Code for Jupyter'}</span>
            </button>
          </div>
        </div>

        {/* Configuration Row: Target Variable & Language Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded border border-slate-200">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">
              ML Target Variable:
            </span>
            <select
              value={targetIndicator}
              onChange={(e) => setTargetIndicator(e.target.value)}
              className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded font-sans text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
            >
              {selectedIndicators.map((ind) => (
                <option key={ind} value={ind}>
                  {ind} (Target)
                </option>
              ))}
            </select>
            <span className="text-[11px] text-slate-500 hidden md:inline">
              (Used as regression outcome in model training step)
            </span>
          </div>

          {/* Language Switcher Tabs */}
          <div className="flex items-center p-1 bg-white rounded border border-slate-200 text-xs">
            <button
              onClick={() => setActiveCodeLang('jupyter')}
              className={`px-2.5 py-1 font-medium rounded transition-colors cursor-pointer ${
                activeCodeLang === 'jupyter'
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Jupyter Notebook Cells
            </button>
            <button
              onClick={() => setActiveCodeLang('ml_python')}
              className={`px-2.5 py-1 font-medium rounded transition-colors cursor-pointer ${
                activeCodeLang === 'ml_python'
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Python ML Pipeline (.py)
            </button>
            <button
              onClick={() => setActiveCodeLang('python')}
              className={`px-2.5 py-1 font-medium rounded transition-colors cursor-pointer ${
                activeCodeLang === 'python'
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Python (Std Lib)
            </button>
            <button
              onClick={() => setActiveCodeLang('r')}
              className={`px-2.5 py-1 font-medium rounded transition-colors cursor-pointer ${
                activeCodeLang === 'r'
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              R (WDI)
            </button>
            <button
              onClick={() => setActiveCodeLang('stata')}
              className={`px-2.5 py-1 font-medium rounded transition-colors cursor-pointer ${
                activeCodeLang === 'stata'
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Stata (.do)
            </button>
          </div>
        </div>

        {/* Code Display Area */}
        <div className="relative bg-slate-950 text-slate-100 rounded-lg border border-slate-800 overflow-hidden font-mono text-xs leading-relaxed">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
              <span className="ml-2 font-mono text-slate-300">
                {activeCodeLang === 'jupyter'
                  ? 'jupyter_notebook_cells.py (with # %% markers)'
                  : activeCodeLang === 'ml_python'
                  ? 'worldbank_ml_pipeline.py'
                  : activeCodeLang === 'python'
                  ? 'global_data_collector.py'
                  : activeCodeLang === 'r'
                  ? 'worldbank_pipeline.R'
                  : 'worldbank_stata.do'}
              </span>
            </div>
            <span className="text-slate-500">
              {startYear}–{endYear} · {selectedIndicators.length} series · UTF-8
            </span>
          </div>

          <pre className="p-4 max-h-[460px] overflow-y-auto selection:bg-blue-600 selection:text-white">
            {codeText}
          </pre>
        </div>
      </div>

      {/* BibTeX Citation Box */}

      {/* BibTeX Citation Box */}
      <div className="bg-slate-50 rounded-lg border border-slate-200 p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Quote className="w-4 h-4 text-slate-700" />
            <h3 className="text-sm font-semibold text-slate-900">
              Academic Citation (BibTeX)
            </h3>
          </div>
          <button
            onClick={handleCopyBibtex}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded transition-colors"
          >
            {copiedBibtex ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
            <span>{copiedBibtex ? 'Copied' : 'Copy BibTeX'}</span>
          </button>
        </div>
        <p className="text-xs text-slate-600">
          Paste into your `.bib` reference file to cite the World Bank Open Data license and data source in scholarly literature.
        </p>
        <pre className="p-3 bg-white border border-slate-200 rounded font-mono text-xs text-slate-800 overflow-x-auto">
          {bibtexText}
        </pre>
      </div>

      {/* 3-Month Automated Update Package */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <h3 className="text-base font-semibold text-slate-900">
                Quarterly Automated Harvester Package (Every 3 Months)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Download continuous synchronization workflows to automatically fetch new World Bank releases every 3 months (`cron: 0 0 1 */3 *`).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const yml = generateGitHubActionsWorkflow(selectedIndicators, startYear, endYear);
                downloadData('quarterly_data_update.yml', yml, 'text/yaml');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>GitHub Actions YAML</span>
            </button>

            <button
              onClick={() => {
                const py = generatePythonDaemonScript(selectedIndicators, startYear);
                downloadData('quarterly_collector_daemon.py', py, 'text/x-python');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Python 3-Month Daemon</span>
            </button>
          </div>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs font-mono text-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-slate-500" />
            <span>Crontab: 0 0 1 */3 * /usr/bin/python3 global_data_collector.py --out global_data.csv</span>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(generateCrontabSyntax(selectedIndicators));
            }}
            className="text-[11px] font-semibold text-blue-600 hover:underline"
          >
            Copy Line
          </button>
        </div>
      </div>
    </div>
  );
};
