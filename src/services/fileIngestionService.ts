import { RawRecord, WorldBankCountry } from '../types';

export interface ParseResult {
  records: RawRecord[];
  detectedFormat: 'long' | 'wide';
  rowCount: number;
  countryCount: number;
  indicatorCount: number;
  yearMin: string;
  yearMax: string;
  errors: string[];
}

/**
 * Robust zero-dependency CSV parser that handles quoted cells, commas, and line breaks.
 */
export function parseCSVToRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  // Normalize line endings
  const text = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (insideQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentCell += '"';
          i++;
        } else {
          // End of quoted cell
          insideQuotes = false;
        }
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (char === '\n') {
        currentRow.push(currentCell.trim());
        if (currentRow.some((c) => c !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
  }

  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Ingest external CSV files (e.g. Kaggle datasets, World Bank downloads, UN/OECD exports)
 * and map them to standard RawRecord format.
 */
export function ingestExternalResearchCSV(
  csvText: string,
  countriesMap: Record<string, WorldBankCountry>,
  filename: string = 'external_dataset.csv'
): ParseResult {
  const rows = parseCSVToRows(csvText);
  if (rows.length < 2) {
    return {
      records: [],
      detectedFormat: 'long',
      rowCount: 0,
      countryCount: 0,
      indicatorCount: 0,
      yearMin: '-',
      yearMax: '-',
      errors: ['File is empty or contains no observation data rows.'],
    };
  }

  const rawHeaders = rows[0];
  const headers = rawHeaders.map((h) => h.toLowerCase().replace(/[^a-z0-9_]/g, '_'));

  // Find country column
  const countryIdx = headers.findIndex((h) =>
    ['country_iso3', 'iso3', 'countrycode', 'country_code', 'country', 'country_name', 'nation'].includes(h)
  );

  // Find state / province column (for sub-national segregation)
  const stateIdx = headers.findIndex((h) =>
    ['state', 'province', 'state_province', 'subdivision', 'admin1', 'region_state', 'territory', 'department'].includes(h)
  );

  // Find year column
  const yearIdx = headers.findIndex((h) =>
    ['year', 'date', 'observation_year', 'time', 'period'].includes(h)
  );

  // Find indicator column (for long/tidy format)
  const indicatorIdx = headers.findIndex((h) =>
    ['indicator_code', 'indicator', 'series_code', 'series', 'variable', 'metric'].includes(h)
  );

  // Find value column (for long/tidy format)
  const valueIdx = headers.findIndex((h) =>
    ['value', 'val', 'observed_value', 'amount', 'score'].includes(h)
  );

  const collectedAt = new Date().toISOString();
  const records: RawRecord[] = [];
  const countriesSeen = new Set<string>();
  const indicatorsSeen = new Set<string>();
  const yearsSeen = new Set<number>();
  const errors: string[] = [];

  // Determine if it's Long format or Wide format
  const isLongFormat = indicatorIdx !== -1 && valueIdx !== -1;

  if (isLongFormat) {
    // Process Long Format
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (row.length <= 1) continue;

      const rawCountry = countryIdx !== -1 ? row[countryIdx] : 'WLD';
      const rawState = stateIdx !== -1 && row[stateIdx] ? row[stateIdx].trim() : undefined;
      const rawYear = yearIdx !== -1 ? row[yearIdx] : '2024';
      const rawInd = row[indicatorIdx] || 'CUSTOM.SERIES';
      const rawVal = row[valueIdx];

      const iso3 = rawCountry.length === 3 ? rawCountry.toUpperCase() : resolveCountryIso3(rawCountry, countriesMap);
      const meta = countriesMap[iso3] || {
        id: iso3,
        iso3,
        name: rawCountry,
        region: 'Unclassified',
        incomeLevel: 'Unclassified',
        capital: '',
      };

      const parsedVal = rawVal !== '' && rawVal !== null && rawVal !== undefined ? parseFloat(rawVal) : null;
      const numYear = parseInt(rawYear, 10);
      if (!isNaN(numYear)) yearsSeen.add(numYear);

      countriesSeen.add(iso3);
      indicatorsSeen.add(rawInd);

      records.push({
        country_iso3: iso3,
        country_name: meta.name,
        state: rawState || undefined,
        admin_level: rawState ? 'state' : 'national',
        region: meta.region,
        income_level: meta.incomeLevel,
        year: String(rawYear),
        indicator_code: rawInd,
        indicator_name: rawInd,
        value: !isNaN(parsedVal as number) ? parsedVal : null,
        source: `Kaggle/File: ${filename}`,
        source_url: 'https://www.kaggle.com/datasets',
        collected_at_utc: collectedAt,
      });
    }
  } else {
    // Process Wide Format: every column except Country, State, and Year is treated as an indicator
    const nonIndicatorCols = new Set([countryIdx, stateIdx, yearIdx].filter((idx) => idx !== -1));
    const indicatorCols: { colIndex: number; name: string }[] = [];

    for (let c = 0; c < headers.length; c++) {
      if (!nonIndicatorCols.has(c) && headers[c]) {
        indicatorCols.push({ colIndex: c, name: rawHeaders[c] });
      }
    }

    if (indicatorCols.length === 0) {
      errors.push('Could not detect numeric indicator columns in wide-format CSV.');
    }

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (row.length <= 1) continue;

      const rawCountry = countryIdx !== -1 ? row[countryIdx] : 'WLD';
      const rawState = stateIdx !== -1 && row[stateIdx] ? row[stateIdx].trim() : undefined;
      const rawYear = yearIdx !== -1 ? row[yearIdx] : '2024';
      const iso3 = rawCountry.length === 3 ? rawCountry.toUpperCase() : resolveCountryIso3(rawCountry, countriesMap);

      const meta = countriesMap[iso3] || {
        id: iso3,
        iso3,
        name: rawCountry,
        region: 'Unclassified',
        incomeLevel: 'Unclassified',
        capital: '',
      };

      const numYear = parseInt(rawYear, 10);
      if (!isNaN(numYear)) yearsSeen.add(numYear);
      countriesSeen.add(iso3);

      for (const indCol of indicatorCols) {
        const rawVal = row[indCol.colIndex];
        const parsedVal = rawVal !== '' && rawVal !== null && rawVal !== undefined ? parseFloat(rawVal) : null;

        indicatorsSeen.add(indCol.name);

        records.push({
          country_iso3: iso3,
          country_name: meta.name,
          state: rawState || undefined,
          admin_level: rawState ? 'state' : 'national',
          region: meta.region,
          income_level: meta.incomeLevel,
          year: String(rawYear),
          indicator_code: indCol.name,
          indicator_name: indCol.name,
          value: !isNaN(parsedVal as number) ? parsedVal : null,
          source: `Kaggle/File: ${filename}`,
          source_url: 'https://www.kaggle.com/datasets',
          collected_at_utc: collectedAt,
        });
      }
    }
  }

  const sortedYears = Array.from(yearsSeen).sort((a, b) => a - b);

  return {
    records,
    detectedFormat: isLongFormat ? 'long' : 'wide',
    rowCount: records.length,
    countryCount: countriesSeen.size,
    indicatorCount: indicatorsSeen.size,
    yearMin: sortedYears[0] ? String(sortedYears[0]) : '-',
    yearMax: sortedYears[sortedYears.length - 1] ? String(sortedYears[sortedYears.length - 1]) : '-',
    errors,
  };
}

function resolveCountryIso3(rawName: string, map: Record<string, WorldBankCountry>): string {
  const norm = rawName.trim().toLowerCase();
  for (const c of Object.values(map)) {
    if (c.iso3.toLowerCase() === norm || c.name.toLowerCase() === norm) {
      return c.iso3;
    }
  }
  return rawName.slice(0, 3).toUpperCase();
}
