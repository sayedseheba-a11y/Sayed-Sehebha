import { SatelliteRecord } from '../types/orbit';

export interface HistogramBin {
  range: string;
  midpoint: number;
  count: number;
}

export function buildHistogram(
  records: SatelliteRecord[],
  feature: string,
  binsCount = 12
): HistogramBin[] {
  const values = records
    .map((r) => Number(r[feature]))
    .filter((v) => !Number.isNaN(v) && Number.isFinite(v));

  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return [{ range: `${min.toFixed(2)}`, midpoint: min, count: values.length }];
  }

  const step = (max - min) / binsCount;
  const bins: HistogramBin[] = Array.from({ length: binsCount }, (_, idx) => {
    const start = min + idx * step;
    const end = start + step;
    const fmt = (n: number) => (Math.abs(n) >= 100 ? n.toFixed(0) : Math.abs(n) >= 1 ? n.toFixed(2) : n.toFixed(4));
    return {
      range: `${fmt(start)}–${fmt(end)}`,
      midpoint: Number(((start + end) / 2).toFixed(4)),
      count: 0,
    };
  });

  for (const val of values) {
    let idx = Math.floor((val - min) / step);
    if (idx >= binsCount) idx = binsCount - 1;
    if (idx < 0) idx = 0;
    bins[idx].count += 1;
  }

  return bins;
}

export function computePearsonCorrelationMatrix(
  records: SatelliteRecord[],
  features: string[]
): { features: string[]; matrix: number[][] } {
  const n = records.length;
  const k = features.length;
  const matrix: number[][] = Array.from({ length: k }, () => Array(k).fill(0));

  const vectors: number[][] = features.map((f) =>
    records.map((r) => {
      const val = Number(r[f]);
      return Number.isNaN(val) ? NaN : val;
    })
  );

  for (let i = 0; i < k; i++) {
    for (let j = i; j < k; j++) {
      if (i === j) {
        matrix[i][j] = 1;
        continue;
      }
      const pairs: Array<[number, number]> = [];
      for (let idx = 0; idx < n; idx++) {
        const a = vectors[i][idx];
        const b = vectors[j][idx];
        if (!Number.isNaN(a) && !Number.isNaN(b)) {
          pairs.push([a, b]);
        }
      }
      if (pairs.length < 3) {
        matrix[i][j] = 0;
        matrix[j][i] = 0;
        continue;
      }
      const meanA = pairs.reduce((s, p) => s + p[0], 0) / pairs.length;
      const meanB = pairs.reduce((s, p) => s + p[1], 0) / pairs.length;
      let num = 0;
      let denA = 0;
      let denB = 0;
      for (const [a, b] of pairs) {
        const da = a - meanA;
        const db = b - meanB;
        num += da * db;
        denA += da * da;
        denB += db * db;
      }
      const denom = Math.sqrt(denA * denB);
      const r = denom > 1e-12 ? Number((num / denom).toFixed(3)) : 0;
      matrix[i][j] = r;
      matrix[j][i] = r;
    }
  }

  return { features, matrix };
}
