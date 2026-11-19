import {
  AnomalyDetectionResult,
  AnomalyRecord,
  SatelliteRecord,
} from '../types/orbit';

interface IsoNode {
  isLeaf: boolean;
  size: number;
  splitAttr?: number;
  splitVal?: number;
  left?: IsoNode;
  right?: IsoNode;
}

function createRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function harmonicC(n: number): number {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1)) / n;
}

function buildIsoTree(
  X: number[][],
  height: number,
  maxHeight: number,
  rng: () => number
): IsoNode {
  if (height >= maxHeight || X.length <= 1) {
    return { isLeaf: true, size: X.length };
  }

  const numCols = X[0].length;
  const cols = Array.from({ length: numCols }, (_, i) => i);
  // Try random attribute with non-constant values
  for (let attempt = 0; attempt < numCols; attempt++) {
    const pickIdx = Math.floor(rng() * cols.length);
    const attr = cols[pickIdx];
    const vals = X.map((r) => r[attr]);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    if (max > min) {
      const splitVal = min + rng() * (max - min);
      const leftData: number[][] = [];
      const rightData: number[][] = [];
      for (const row of X) {
        if (row[attr] < splitVal) leftData.push(row);
        else rightData.push(row);
      }
      return {
        isLeaf: false,
        size: X.length,
        splitAttr: attr,
        splitVal,
        left: buildIsoTree(leftData, height + 1, maxHeight, rng),
        right: buildIsoTree(rightData, height + 1, maxHeight, rng),
      };
    }
    cols.splice(pickIdx, 1);
  }

  return { isLeaf: true, size: X.length };
}

function pathLength(node: IsoNode, x: number[], currentHeight = 0): number {
  if (node.isLeaf || node.splitAttr === undefined || node.splitVal === undefined) {
    return currentHeight + harmonicC(node.size);
  }
  if (x[node.splitAttr] < node.splitVal) {
    return pathLength(node.left!, x, currentHeight + 1);
  }
  return pathLength(node.right!, x, currentHeight + 1);
}

export function runIsolationForest(
  records: SatelliteRecord[],
  features: string[],
  contaminationRate = 0.05,
  nTrees = 80
): AnomalyDetectionResult {
  const rng = createRng(424242);
  const n = records.length;
  if (n === 0 || features.length === 0) {
    return {
      records: [],
      totalCount: 0,
      anomalyCount: 0,
      contaminationRate,
      thresholdScore: 0.5,
      scoreHistogram: [],
      executedAt: new Date().toISOString(),
    };
  }

  // Compute feature medians, means, stds for imputation & standardization
  const means: number[] = [];
  const stds: number[] = [];
  const rawMatrix: number[][] = records.map((r) =>
    features.map((f) => {
      const v = Number(r[f]);
      return Number.isNaN(v) ? NaN : v;
    })
  );

  for (let j = 0; j < features.length; j++) {
    const valid = rawMatrix.map((r) => r[j]).filter((v) => !Number.isNaN(v));
    const mean = valid.reduce((a, b) => a + b, 0) / (valid.length || 1);
    const std = Math.sqrt(
      valid.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (valid.length || 1)
    ) || 1;
    means.push(mean);
    stds.push(std > 1e-12 ? std : 1);
  }

  const XStd: number[][] = rawMatrix.map((row) =>
    row.map((val, j) => {
      const filled = Number.isNaN(val) ? means[j] : val;
      return (filled - means[j]) / stds[j];
    })
  );

  const sampleSize = Math.min(256, n);
  const maxHeight = Math.ceil(Math.log2(sampleSize));
  const cNorm = harmonicC(sampleSize) || 1;

  const forest: IsoNode[] = [];
  for (let t = 0; t < nTrees; t++) {
    const subsample: number[][] = [];
    for (let s = 0; s < sampleSize; s++) {
      const idx = Math.floor(rng() * n);
      subsample.push(XStd[idx]);
    }
    forest.push(buildIsoTree(subsample, 0, maxHeight, rng));
  }

  const scores = XStd.map((x) => {
    const avgPath =
      forest.reduce((sum, tree) => sum + pathLength(tree, x), 0) / forest.length;
    return Number(Math.pow(2, -avgPath / cNorm).toFixed(4));
  });

  const sortedScores = [...scores].sort((a, b) => b - a);
  const cutoffIdx = Math.max(0, Math.min(n - 1, Math.floor(n * contaminationRate) - 1));
  const thresholdScore = sortedScores[cutoffIdx] ?? 0.6;

  const anomalyRecords: AnomalyRecord[] = records.map((rec, idx) => {
    const score = scores[idx];
    const isAnomaly = score >= thresholdScore && score > 0.5;

    const deviations = features
      .map((feature, j) => ({
        feature,
        zScore: Number(XStd[idx][j].toFixed(2)),
        value: Number((Number.isNaN(rawMatrix[idx][j]) ? means[j] : rawMatrix[idx][j]).toFixed(4)),
      }))
      .sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore))
      .slice(0, 3);

    const topDev = deviations[0];
    const reasonSummary = isAnomaly
      ? `Isolated rapidly due to ${topDev.feature} (${topDev.zScore > 0 ? '+' : ''}${topDev.zScore}σ from catalogue mean) and ${deviations[1]?.feature ?? 'multi-feature orbital spread'}.`
      : 'Orbital parameters fall within expected multi-dimensional catalogue density.';

    return {
      index: idx,
      norad_id: String(rec.norad_id ?? `OBJ-${idx + 1}`),
      object_name: String(rec.object_name ?? 'UNKNOWN'),
      object_type: String(rec.object_type ?? 'UNKNOWN'),
      mean_altitude_km: Number(rec.mean_altitude_km ?? 0),
      inclination_deg: Number(rec.inclination_deg ?? 0),
      eccentricity: Number(rec.eccentricity ?? 0),
      mean_motion_rev_day: Number(rec.mean_motion_rev_day ?? 0),
      bstar_drag: Number(rec.bstar_drag ?? 0),
      rcs_m2: Number(rec.rcs_m2 ?? 0),
      anomalyScore: score,
      isAnomaly,
      topDeviatingFeatures: deviations,
      reasonSummary,
    };
  });

  // Build score distribution histogram (10 bins from 0.3 to 0.9)
  const binsCount = 10;
  const minS = Math.min(...scores);
  const maxS = Math.max(...scores);
  const step = Math.max(0.01, (maxS - minS) / binsCount);
  const scoreHistogram = Array.from({ length: binsCount }, (_, b) => {
    const lo = minS + b * step;
    const hi = lo + step;
    return {
      bin: `${lo.toFixed(2)}–${hi.toFixed(2)}`,
      normal: 0,
      anomaly: 0,
    };
  });

  anomalyRecords.forEach((r) => {
    let bIdx = Math.floor((r.anomalyScore - minS) / step);
    if (bIdx >= binsCount) bIdx = binsCount - 1;
    if (bIdx < 0) bIdx = 0;
    if (r.isAnomaly) scoreHistogram[bIdx].anomaly += 1;
    else scoreHistogram[bIdx].normal += 1;
  });

  const anomalyCount = anomalyRecords.filter((r) => r.isAnomaly).length;

  return {
    records: anomalyRecords,
    totalCount: n,
    anomalyCount,
    contaminationRate,
    thresholdScore: Number(thresholdScore.toFixed(4)),
    scoreHistogram,
    executedAt: new Date().toISOString(),
  };
}
