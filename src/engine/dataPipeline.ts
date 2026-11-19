import Papa from 'papaparse';
import {
  ColumnProfile,
  DatasetValidationSummary,
  SatelliteRecord,
} from '../types/orbit';

const IDENTIFIER_HINTS = ['norad', 'id', 'name', 'object_name', 'catalog', 'cospar', 'designator'];
const TARGET_HINTS = ['object_type', 'type', 'category', 'class', 'label'];

export function isIdentifierColumn(colName: string): boolean {
  const lower = colName.toLowerCase().trim();
  return IDENTIFIER_HINTS.some((hint) => lower === hint || lower.includes('norad') || lower.endsWith('_id') || lower.includes('object_name'));
}

export function detectTargetColumn(columns: string[]): string | null {
  for (const hint of TARGET_HINTS) {
    const found = columns.find((c) => c.toLowerCase().trim() === hint);
    if (found) return found;
  }
  return null;
}

export function parseCsvToRecords(csvText: string): {
  records: SatelliteRecord[];
  errors: string[];
} {
  const parsed = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
    transformHeader: (h) => h.trim(),
  });

  const parseErrors = parsed.errors.slice(0, 5).map((e) => `Row ${e.row ?? '?'}: ${e.message}`);

  const records: SatelliteRecord[] = parsed.data.map((row, idx) => {
    const normalized: Record<string, string | number | null> = {};
    Object.entries(row).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '' || (typeof v === 'number' && Number.isNaN(v))) {
        normalized[k] = null;
      } else if (typeof v === 'string') {
        const trimmed = v.trim();
        normalized[k] = trimmed === '' || trimmed.toLowerCase() === 'nan' || trimmed.toLowerCase() === 'null' ? null : trimmed;
      } else if (typeof v === 'number') {
        normalized[k] = v;
      } else {
        normalized[k] = String(v);
      }
    });

    if (!normalized.norad_id) {
      normalized.norad_id = String(row.norad_id ?? row.id ?? `OBJ-${idx + 1}`);
    }
    if (!normalized.object_name) {
      normalized.object_name = String(row.object_name ?? row.name ?? `SATELLITE-${idx + 1}`);
    }
    if (!normalized.object_type) {
      normalized.object_type = String(row.object_type ?? row.category ?? row.type ?? 'UNKNOWN');
    }

    return normalized as SatelliteRecord;
  });

  return { records, errors: parseErrors };
}

export function countDuplicateRows(records: SatelliteRecord[]): number {
  const seen = new Set<string>();
  let dupes = 0;
  for (const row of records) {
    const signature = JSON.stringify(row);
    if (seen.has(signature)) {
      dupes += 1;
    } else {
      seen.add(signature);
    }
  }
  return dupes;
}

export function validateDataset(records: SatelliteRecord[]): DatasetValidationSummary {
  if (!records || records.length === 0) {
    return {
      isValid: false,
      rowCount: 0,
      columnCount: 0,
      totalMissingCells: 0,
      completenessPct: 0,
      duplicateCount: 0,
      identifierColumns: [],
      numericFeatures: [],
      categoricalFeatures: [],
      targetColumn: null,
      warnings: [],
      errors: ['No records loaded in the active workspace.'],
      columns: [],
    };
  }

  const colNames = Array.from(
    new Set(records.flatMap((r) => Object.keys(r)))
  );
  const targetColumn = detectTargetColumn(colNames);
  const duplicateCount = countDuplicateRows(records);
  const columns: ColumnProfile[] = [];
  const identifierColumns: string[] = [];
  const numericFeatures: string[] = [];
  const categoricalFeatures: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  let totalMissingCells = 0;

  for (const col of colNames) {
    const values = records.map((r) => r[col]);
    const nonNull = values.filter((v) => v !== null && v !== undefined && v !== '');
    const missingCount = records.length - nonNull.length;
    totalMissingCells += missingCount;
    const missingPct = Number(((missingCount / records.length) * 100).toFixed(2));
    const uniqueCount = new Set(nonNull.map((v) => String(v))).size;

    const isId = isIdentifierColumn(col);
    const isTarget = col === targetColumn;

    const numericVals = nonNull
      .map((v) => (typeof v === 'number' ? v : Number(v)))
      .filter((n) => !Number.isNaN(n) && Number.isFinite(n));

    const isNumeric = !isId && !isTarget && nonNull.length > 0 && numericVals.length >= nonNull.length * 0.8;

    let dataType: ColumnProfile['dataType'] = 'categorical';
    if (isId) dataType = 'identifier';
    else if (isNumeric) dataType = 'numeric';

    let mean: number | undefined;
    let std: number | undefined;
    let min: number | undefined;
    let max: number | undefined;

    if (dataType === 'numeric' && numericVals.length > 0) {
      const sum = numericVals.reduce((acc, v) => acc + v, 0);
      mean = sum / numericVals.length;
      const variance = numericVals.reduce((acc, v) => acc + Math.pow(v - mean!, 2), 0) / numericVals.length;
      std = Math.sqrt(variance);
      min = Math.min(...numericVals);
      max = Math.max(...numericVals);
      numericFeatures.push(col);
    } else if (isId) {
      identifierColumns.push(col);
    } else if (!isTarget) {
      categoricalFeatures.push(col);
    }

    columns.push({
      name: col,
      dataType,
      missingCount,
      missingPct,
      uniqueCount,
      mean: mean !== undefined ? Number(mean.toFixed(4)) : undefined,
      std: std !== undefined ? Number(std.toFixed(4)) : undefined,
      min: min !== undefined ? Number(min.toFixed(4)) : undefined,
      max: max !== undefined ? Number(max.toFixed(4)) : undefined,
      isIdentifier: isId,
      isTarget,
    });
  }

  const totalCells = records.length * colNames.length;
  const completenessPct = totalCells > 0 ? Number((((totalCells - totalMissingCells) / totalCells) * 100).toFixed(2)) : 0;

  if (!targetColumn) {
    errors.push('Target classification column (object_type / category) was not detected. Supervised training requires a class label.');
  }
  if (numericFeatures.length < 2) {
    errors.push('At least 2 numeric orbital parameters are required for machine learning and clustering.');
  }
  if (totalMissingCells > 0) {
    warnings.push(`${totalMissingCells} missing values detected across ${columns.filter((c) => c.missingCount > 0).length} columns. Apply Data Wrangling before modeling.`);
  }
  if (duplicateCount > 0) {
    warnings.push(`${duplicateCount} duplicate records detected. Deduplicate to prevent train/test split contamination.`);
  }
  if (identifierColumns.length > 0) {
    warnings.push(`Identifier columns (${identifierColumns.join(', ')}) will be automatically excluded from ML feature matrices.`);
  }

  return {
    isValid: errors.length === 0,
    rowCount: records.length,
    columnCount: colNames.length,
    totalMissingCells,
    completenessPct,
    duplicateCount,
    identifierColumns,
    numericFeatures,
    categoricalFeatures,
    targetColumn,
    warnings,
    errors,
    columns,
  };
}

export function exportRecordsToCsv(records: SatelliteRecord[], filename: string): void {
  const csv = Papa.unparse(records);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
