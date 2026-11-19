import {
  SatelliteRecord,
  WranglingConfig,
  WranglingResult,
  WranglingStatsSnapshot,
} from '../types/orbit';
import { countDuplicateRows, validateDataset } from './dataPipeline';

function medianOf(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function modeOf<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  const counts = new Map<T, number>();
  for (const item of items) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  let best = items[0];
  let bestCount = -1;
  for (const [k, c] of counts.entries()) {
    if (c > bestCount) {
      best = k;
      bestCount = c;
    }
  }
  return best;
}

function computeStatsSnapshot(records: SatelliteRecord[], numericFeatures: string[]): WranglingStatsSnapshot {
  const validation = validateDataset(records);
  const featureMeans: Record<string, number> = {};
  for (const feat of numericFeatures) {
    const vals = records
      .map((r) => Number(r[feat]))
      .filter((n) => !Number.isNaN(n) && Number.isFinite(n));
    featureMeans[feat] = vals.length > 0 ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(4)) : 0;
  }

  return {
    rowCount: validation.rowCount,
    columnCount: validation.columnCount,
    missingCells: validation.totalMissingCells,
    completenessPct: validation.completenessPct,
    duplicateRows: validation.duplicateCount,
    featureMeans,
  };
}

export function runDataWrangling(
  rawRecords: SatelliteRecord[],
  config: WranglingConfig
): WranglingResult {
  const logs: string[] = [];
  const validationBefore = validateDataset(rawRecords);
  const numericFeatures = validationBefore.numericFeatures;
  const beforeStats = computeStatsSnapshot(rawRecords, numericFeatures);

  logs.push(`Loaded ${rawRecords.length} rows across ${validationBefore.columnCount} columns.`);

  // Deep clone
  let working: SatelliteRecord[] = rawRecords.map((r) => ({ ...r }));

  // 1. Duplicate removal
  let duplicatesRemoved = 0;
  if (config.removeDuplicates) {
    const seen = new Set<string>();
    const deduped: SatelliteRecord[] = [];
    for (const row of working) {
      const sig = JSON.stringify(row);
      if (seen.has(sig)) {
        duplicatesRemoved += 1;
      } else {
        seen.add(sig);
        deduped.push(row);
      }
    }
    working = deduped;
    logs.push(`Duplicate removal: eliminated ${duplicatesRemoved} exact duplicate rows.`);
  } else {
    logs.push(`Duplicate removal skipped (${countDuplicateRows(working)} duplicates retained).`);
  }

  // 2. Missing value handling
  let missingImputed = 0;
  const allCols = validationBefore.columns.map((c) => c.name);
  if (config.missingStrategy === 'drop') {
    const beforeCount = working.length;
    working = working.filter((row) =>
      allCols.every((c) => row[c] !== null && row[c] !== undefined && row[c] !== '')
    );
    const dropped = beforeCount - working.length;
    missingImputed = validationBefore.totalMissingCells;
    logs.push(`Missing values (drop strategy): removed ${dropped} incomplete records.`);
  } else {
    for (const col of validationBefore.columns) {
      const colName = col.name;
      const missingIndices: number[] = [];
      const nonNullValues: Array<string | number> = [];

      working.forEach((row, idx) => {
        const val = row[colName];
        if (val === null || val === undefined || val === '') {
          missingIndices.push(idx);
        } else {
          nonNullValues.push(val);
        }
      });

      if (missingIndices.length === 0) continue;

      if (col.dataType === 'numeric') {
        const nums = nonNullValues.map(Number).filter((n) => !Number.isNaN(n));
        if (nums.length === 0) continue;

        let fillValue = 0;
        if (config.missingStrategy === 'mean') {
          fillValue = nums.reduce((a, b) => a + b, 0) / nums.length;
        } else if (config.missingStrategy === 'median') {
          fillValue = medianOf(nums);
        } else {
          fillValue = Number(modeOf(nums) ?? nums[0]);
        }

        const rounded = Number(fillValue.toFixed(5));
        for (const idx of missingIndices) {
          working[idx][colName] = rounded;
          missingImputed += 1;
        }
        logs.push(`Imputed ${missingIndices.length} missing values in '${colName}' using ${config.missingStrategy} (${rounded}).`);
      } else {
        const fillCat = modeOf(nonNullValues) ?? 'UNKNOWN';
        for (const idx of missingIndices) {
          working[idx][colName] = fillCat;
          missingImputed += 1;
        }
        logs.push(`Imputed ${missingIndices.length} missing categorical values in '${colName}' with mode '${String(fillCat)}'.`);
      }
    }
  }

  // 3. Outlier detection & handling
  let outliersDetected = 0;
  const outlierFeatures = config.selectedFeatures.length > 0
    ? config.selectedFeatures.filter((f) => numericFeatures.includes(f))
    : numericFeatures;

  if (config.outlierMethod !== 'none' && working.length > 5) {
    const outlierRowFlags = new Set<number>();

    for (const feat of outlierFeatures) {
      const vals = working
        .map((r) => Number(r[feat]))
        .filter((n) => !Number.isNaN(n) && Number.isFinite(n));
      if (vals.length < 4) continue;

      const sorted = [...vals].sort((a, b) => a - b);
      const q1 = sorted[Math.floor(sorted.length * 0.25)];
      const q3 = sorted[Math.floor(sorted.length * 0.75)];
      const iqr = q3 - q1;
      const lowerFence = q1 - 1.5 * iqr;
      const upperFence = q3 + 1.5 * iqr;

      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const std = Math.sqrt(vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / vals.length) || 1e-9;

      working.forEach((row, idx) => {
        const v = Number(row[feat]);
        if (Number.isNaN(v)) return;

        if (config.outlierMethod === 'iqr_cap') {
          if (v < lowerFence) {
            row[feat] = Number(lowerFence.toFixed(5));
            outliersDetected += 1;
          } else if (v > upperFence) {
            row[feat] = Number(upperFence.toFixed(5));
            outliersDetected += 1;
          }
        } else if (config.outlierMethod === 'iqr_remove') {
          if (v < lowerFence || v > upperFence) {
            outlierRowFlags.add(idx);
          }
        } else if (config.outlierMethod === 'zscore_remove') {
          const z = Math.abs((v - mean) / std);
          if (z > config.outlierThreshold) {
            outlierRowFlags.add(idx);
          }
        }
      });
    }

    if (config.outlierMethod === 'iqr_remove' || config.outlierMethod === 'zscore_remove') {
      outliersDetected = outlierRowFlags.size;
      working = working.filter((_, idx) => !outlierRowFlags.has(idx));
      logs.push(`Outlier filtering (${config.outlierMethod}): removed ${outliersDetected} outlier rows.`);
    } else {
      logs.push(`Outlier capping (IQR 1.5x): winsorized ${outliersDetected} extreme cell values.`);
    }
  } else {
    logs.push('Outlier handling skipped.');
  }

  // 4. Categorical encoding (excluding target & identifier columns)
  const encodedColumns: string[] = [];
  if (config.encodeCategorical) {
    for (const catCol of validationBefore.categoricalFeatures) {
      const uniqueCats = Array.from(
        new Set(working.map((r) => String(r[catCol] ?? 'UNKNOWN')))
      ).sort();
      if (uniqueCats.length > 1 && uniqueCats.length <= 12) {
        const encColName = `${catCol}_encoded`;
        const mapping = new Map<string, number>();
        uniqueCats.forEach((c, idx) => mapping.set(c, idx));
        working.forEach((row) => {
          row[encColName] = mapping.get(String(row[catCol] ?? 'UNKNOWN')) ?? 0;
        });
        encodedColumns.push(encColName);
        logs.push(`Encoded categorical column '${catCol}' into numeric index '${encColName}' (${uniqueCats.length} categories).`);
      }
    }
  }

  // 5. Note on scaling (we record preview scaling note; ML Lab fits scaler strictly on X_train to prevent leakage)
  if (config.scalingMethod !== 'none') {
    logs.push(`Scaling preference '${config.scalingMethod}' registered (will be fit strictly on training split inside ML Lab to prevent data leakage).`);
  }

  const afterStats = computeStatsSnapshot(working, numericFeatures);
  logs.push(`Wrangling complete: ${afterStats.rowCount} rows ready, completeness ${afterStats.completenessPct}%.`);

  return {
    cleanedData: working,
    beforeStats,
    afterStats,
    logs,
    outliersDetected,
    duplicatesRemoved,
    missingImputed,
    encodedColumns,
    timestamp: new Date().toISOString(),
  };
}
