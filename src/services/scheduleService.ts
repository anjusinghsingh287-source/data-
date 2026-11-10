export interface SyncHistoryItem {
  timestamp: string;
  recordsCount: number;
  status: 'success' | 'failed';
  message: string;
}

export interface ScheduleConfig {
  enabled: boolean;
  intervalMonths: number; // default: 3
  cadenceName: string; // 'Quarterly (Every 3 Months)'
  lastSyncUtc: string;
  nextSyncUtc: string;
  autoCleanOnSync: boolean;
  autoExportCsv: boolean;
  history: SyncHistoryItem[];
}

const STORAGE_KEY = 'wb_quarterly_schedule_config';

/**
 * Calculates a date exactly 3 months forward from the given date.
 */
export function calculateNextQuarterDate(fromDate: Date = new Date()): Date {
  const next = new Date(fromDate);
  next.setMonth(next.getMonth() + 3);
  return next;
}

/**
 * Gets the current World Bank data quarter string (e.g., "Q4 2026").
 */
export function getQuarterString(date: Date = new Date()): string {
  const q = Math.floor(date.getMonth() / 3) + 1;
  return `Q${q} ${date.getFullYear()}`;
}

export function getDefaultScheduleConfig(): ScheduleConfig {
  const now = new Date();
  const nextQuarter = calculateNextQuarterDate(now);

  return {
    enabled: true,
    intervalMonths: 3,
    cadenceName: 'Quarterly (Every 3 Months)',
    lastSyncUtc: now.toISOString(),
    nextSyncUtc: nextQuarter.toISOString(),
    autoCleanOnSync: true,
    autoExportCsv: false,
    history: [
      {
        timestamp: now.toISOString(),
        recordsCount: 3120,
        status: 'success',
        message: 'Initial baseline dataset initialized for Q4 2026.',
      },
    ],
  };
}

export function loadScheduleConfig(): ScheduleConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultScheduleConfig();
    const parsed = JSON.parse(raw);
    return { ...getDefaultScheduleConfig(), ...parsed };
  } catch {
    return getDefaultScheduleConfig();
  }
}

export function saveScheduleConfig(config: ScheduleConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save schedule config', e);
  }
}

/**
 * Check if the 3-month quarterly interval has elapsed and sync is due.
 */
export function checkIsQuarterlySyncDue(config: ScheduleConfig): boolean {
  if (!config.enabled) return false;
  const nextDate = new Date(config.nextSyncUtc).getTime();
  return Date.now() >= nextDate;
}

/**
 * Records a completed sync run and sets next run date to 3 months later.
 */
export function recordCompletedSync(
  currentConfig: ScheduleConfig,
  recordsCount: number,
  status: 'success' | 'failed',
  message: string
): ScheduleConfig {
  const now = new Date();
  const nextRun = calculateNextQuarterDate(now);

  const newHistoryItem: SyncHistoryItem = {
    timestamp: now.toISOString(),
    recordsCount,
    status,
    message,
  };

  const updated: ScheduleConfig = {
    ...currentConfig,
    lastSyncUtc: now.toISOString(),
    nextSyncUtc: nextRun.toISOString(),
    history: [newHistoryItem, ...(currentConfig.history || []).slice(0, 19)],
  };

  saveScheduleConfig(updated);
  return updated;
}

/**
 * Generates an automated GitHub Actions YAML workflow for quarterly updates.
 */
export function generateGitHubActionsWorkflow(
  indicators: string[],
  startYear: number,
  endYear: number
): string {
  const indString = indicators.join(' ');

  return `name: Quarterly World Bank Data Sync (Every 3 Months)

# Runs automatically on the 1st day of every 3rd month at 00:00 UTC (Quarterly: Jan, Apr, Jul, Oct)
on:
  schedule:
    - cron: '0 0 1 */3 *'
  workflow_dispatch: # Allows manual trigger from GitHub Actions tab

permissions:
  contents: write

jobs:
  harvest-and-update:
    name: Harvest World Bank Quarterly Data
    runs-on: ubuntu-latest
    steps:
      - name: Check out repository
        uses: actions/checkout@v4

      - name: Set up Python 3.11
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Execute Automated 3-Month Harvest
        run: |
          CURRENT_YEAR=$(date +'%Y')
          echo "Harvesting quarterly data from World Bank API (${startYear} to \${CURRENT_YEAR})..."
          python global_data_collector.py \\
            --start ${startYear} \\
            --end \${CURRENT_YEAR} \\
            --indicators ${indString} \\
            --out data/global_data.csv

      - name: Verify Dataset Integrity & Row Count
        run: |
          ROW_COUNT=$(wc -l < data/global_data.csv)
          echo "Collected \${ROW_COUNT} rows in updated dataset."
          if [ "\${ROW_COUNT}" -lt 50 ]; then
            echo "Error: Output file too small, possible API failure."
            exit 1
          fi

      - name: Commit and Push Updated Dataset
        run: |
          git config --global user.name "github-actions[bot]"
          git config --global user.email "github-actions[bot]@users.noreply.github.com"
          git add data/global_data.csv
          QUARTER=$(date +'%Y-Q')$(( ($(date +'%-m') - 1) / 3 + 1 ))
          git commit -m "chore(data): automated 3-month quarterly sync (\${QUARTER}) [skip ci]" || echo "No changes to commit"
          git push
`;
}

/**
 * Generates crontab syntax for Linux/macOS daemon execution every 3 months.
 */
export function generateCrontabSyntax(indicators: string[]): string {
  const indString = indicators.join(' ');
  return `# World Bank Quantitative Collector - Automated 3-Month Sync
# Schedule: At 00:00 on day 1 of every 3rd month (Jan 1, Apr 1, Jul 1, Oct 1)
0 0 1 */3 * /usr/bin/python3 /opt/research/global_data_collector.py --indicators ${indString} --out /opt/research/global_data.csv >> /var/log/wb_quarterly_collector.log 2>&1
`;
}

/**
 * Generates a standalone Python 3 continuous daemon with 3-month sleep timing.
 */
export function generatePythonDaemonScript(indicators: string[], startYear: number): string {
  const indList = JSON.stringify(indicators, null, 2);

  return `#!/usr/bin/env python3
"""
World Bank Continuous Quarterly Harvester (Every 3 Months)
Runs continuously in background, sleeping between quarterly observation releases.
"""
import time
import datetime
import subprocess
import sys

THREE_MONTHS_SECONDS = 90 * 24 * 3600  # 90 days (~3 months)
INDICATORS = ${indList}

def run_sync():
    now = datetime.datetime.now(datetime.timezone.utc)
    current_year = now.year
    print(f"[{now.isoformat()}] Starting quarterly 3-month harvest (Year: ${startYear}-{current_year})...")
    
    cmd = [
        sys.executable,
        "global_data_collector.py",
        "--start", "${startYear}",
        "--end", str(current_year),
        "--out", "global_data_quarterly.csv",
        "--indicators"
    ] + INDICATORS
    
    res = subprocess.run(cmd)
    if res.returncode == 0:
        print(f"[{datetime.datetime.now().isoformat()}] Quarterly harvest completed successfully.")
    else:
        print(f"[{datetime.datetime.now().isoformat()}] Harvest encountered errors (code {res.returncode}).")

def main():
    print("=== World Bank 3-Month Scheduled Harvester Started ===")
    print("Cadence: Every 3 months (90 days)")
    
    # Run first harvest immediately
    run_sync()
    
    while True:
        next_run = datetime.datetime.now() + datetime.timedelta(days=90)
        print(f"Sleeping for 90 days. Next quarterly run scheduled for: {next_run.strftime('%Y-%m-%d %H:%M:%S')}")
        time.sleep(THREE_MONTHS_SECONDS)
        run_sync()

if __name__ == "__main__":
    main()
`;
}
