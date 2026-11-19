import {
  ClusterPoint,
  ClusterSummary,
  ClusteringResult,
  SatelliteRecord,
} from '../types/orbit';

function createRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sqDist(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return s;
}

/**
 * Computes top 2 Principal Components via covariance matrix and power iteration + deflation.
 */
function computePca2D(XStd: number[][]): {
  projected: Array<[number, number]>;
  explainedVariance: [number, number];
} {
  const n = XStd.length;
  const p = XStd[0]?.length ?? 0;
  if (n === 0 || p === 0) {
    return { projected: [], explainedVariance: [0, 0] };
  }

  // Covariance matrix C = (X^T X) / (n - 1)
  const cov: number[][] = Array.from({ length: p }, () => Array(p).fill(0));
  const denom = Math.max(1, n - 1);
  for (let i = 0; i < p; i++) {
    for (let j = i; j < p; j++) {
      let sum = 0;
      for (let r = 0; r < n; r++) {
        sum += XStd[r][i] * XStd[r][j];
      }
      cov[i][j] = sum / denom;
      cov[j][i] = cov[i][j];
    }
  }

  const totalVar = cov.reduce((s, row, i) => s + row[i], 0) || 1;

  const powerIteration = (mat: number[][]): { vec: number[]; val: number } => {
    let v = Array.from({ length: p }, (_, idx) => Math.sin(idx + 1) + 0.5);
    const normInit = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
    v = v.map((x) => x / normInit);

    for (let iter = 0; iter < 50; iter++) {
      const next = Array(p).fill(0);
      for (let i = 0; i < p; i++) {
        for (let j = 0; j < p; j++) {
          next[i] += mat[i][j] * v[j];
        }
      }
      const norm = Math.sqrt(next.reduce((s, x) => s + x * x, 0)) || 1;
      v = next.map((x) => x / norm);
    }

    // Rayleigh quotient eigenvalue
    let num = 0;
    for (let i = 0; i < p; i++) {
      let mv = 0;
      for (let j = 0; j < p; j++) mv += mat[i][j] * v[j];
      num += v[i] * mv;
    }
    return { vec: v, val: Math.max(0, num) };
  };

  const pc1 = powerIteration(cov);

  // Deflate covariance matrix for PC2
  const covDeflated = cov.map((row, i) =>
    row.map((val, j) => val - pc1.val * pc1.vec[i] * pc1.vec[j])
  );
  const pc2 = p >= 2 ? powerIteration(covDeflated) : { vec: Array(p).fill(0), val: 0 };

  const projected: Array<[number, number]> = XStd.map((row) => {
    let x1 = 0;
    let x2 = 0;
    for (let j = 0; j < p; j++) {
      x1 += row[j] * pc1.vec[j];
      x2 += row[j] * pc2.vec[j];
    }
    return [Number(x1.toFixed(4)), Number(x2.toFixed(4))];
  });

  return {
    projected,
    explainedVariance: [
      Number(((pc1.val / totalVar) * 100).toFixed(1)),
      Number(((pc2.val / totalVar) * 100).toFixed(1)),
    ],
  };
}

export function runKMeansClustering(
  records: SatelliteRecord[],
  features: string[],
  k: number
): ClusteringResult {
  const n = records.length;
  if (n < k || features.length === 0) {
    return {
      k,
      silhouetteScore: 0,
      inertia: 0,
      explainedVariance: [0, 0],
      points: [],
      summaries: [],
      usedFeatures: features,
      executedAt: new Date().toISOString(),
    };
  }

  const rng = createRng(918273 + k);

  // Impute & Standardize
  const means: number[] = [];
  const stds: number[] = [];
  const rawFilled: number[][] = records.map((r) =>
    features.map((f) => {
      const v = Number(r[f]);
      return Number.isNaN(v) ? NaN : v;
    })
  );

  for (let j = 0; j < features.length; j++) {
    const valid = rawFilled.map((r) => r[j]).filter((v) => !Number.isNaN(v));
    const mean = valid.reduce((a, b) => a + b, 0) / (valid.length || 1);
    const std =
      Math.sqrt(valid.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (valid.length || 1)) || 1;
    means.push(mean);
    stds.push(std > 1e-12 ? std : 1);
  }

  const cleanRaw = rawFilled.map((row) =>
    row.map((v, j) => (Number.isNaN(v) ? means[j] : v))
  );
  const XStd = cleanRaw.map((row) =>
    row.map((v, j) => (v - means[j]) / stds[j])
  );

  // K-Means++ initialization
  const centroids: number[][] = [];
  centroids.push([...XStd[Math.floor(rng() * n)]]);
  while (centroids.length < k) {
    const dists = XStd.map((x) => Math.min(...centroids.map((c) => sqDist(x, c))));
    const totalDist = dists.reduce((a, b) => a + b, 0) || 1;
    let target = rng() * totalDist;
    let picked = 0;
    for (let i = 0; i < n; i++) {
      target -= dists[i];
      if (target <= 0) {
        picked = i;
        break;
      }
    }
    centroids.push([...XStd[picked]]);
  }

  let assignments = Array(n).fill(0);
  for (let iter = 0; iter < 40; iter++) {
    let changed = false;
    for (let i = 0; i < n; i++) {
      let bestC = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const d = sqDist(XStd[i], centroids[c]);
        if (d < bestD) {
          bestD = d;
          bestC = c;
        }
      }
      if (assignments[i] !== bestC) {
        assignments[i] = bestC;
        changed = true;
      }
    }

    // Update centroids
    const sums = Array.from({ length: k }, () => Array(features.length).fill(0));
    const counts = Array(k).fill(0);
    for (let i = 0; i < n; i++) {
      const c = assignments[i];
      counts[c] += 1;
      for (let j = 0; j < features.length; j++) {
        sums[c][j] += XStd[i][j];
      }
    }
    for (let c = 0; c < k; c++) {
      if (counts[c] > 0) {
        for (let j = 0; j < features.length; j++) {
          centroids[c][j] = sums[c][j] / counts[c];
        }
      }
    }
    if (!changed) break;
  }

  const inertia = Number(
    XStd.reduce((sum, x, i) => sum + sqDist(x, centroids[assignments[i]]), 0).toFixed(2)
  );

  // Silhouette Score (sampled up to 250 points for responsiveness while remaining exact for <= 250)
  const sampleStep = Math.max(1, Math.floor(n / 250));
  const sampleIndices: number[] = [];
  for (let i = 0; i < n; i += sampleStep) sampleIndices.push(i);

  let silSum = 0;
  for (const i of sampleIndices) {
    const ci = assignments[i];
    let intraSum = 0;
    let intraCount = 0;
    const interSums = Array(k).fill(0);
    const interCounts = Array(k).fill(0);

    for (const j of sampleIndices) {
      if (i === j) continue;
      const d = Math.sqrt(sqDist(XStd[i], XStd[j]));
      const cj = assignments[j];
      if (cj === ci) {
        intraSum += d;
        intraCount += 1;
      } else {
        interSums[cj] += d;
        interCounts[cj] += 1;
      }
    }

    const a = intraCount > 0 ? intraSum / intraCount : 0;
    let b = Infinity;
    for (let c = 0; c < k; c++) {
      if (c !== ci && interCounts[c] > 0) {
        b = Math.min(b, interSums[c] / interCounts[c]);
      }
    }
    if (b === Infinity) b = 0;
    const s = Math.max(a, b) > 0 ? (b - a) / Math.max(a, b) : 0;
    silSum += s;
  }
  const silhouetteScore = Number((silSum / (sampleIndices.length || 1)).toFixed(4));

  // 2D PCA projection
  const { projected, explainedVariance } = computePca2D(XStd);

  const points: ClusterPoint[] = records.map((r, idx) => ({
    index: idx,
    norad_id: String(r.norad_id ?? `OBJ-${idx + 1}`),
    object_name: String(r.object_name ?? 'UNKNOWN'),
    object_type: String(r.object_type ?? 'UNKNOWN'),
    clusterId: assignments[idx],
    pc1: projected[idx][0],
    pc2: projected[idx][1],
    mean_altitude_km: Number(r.mean_altitude_km ?? 0),
    inclination_deg: Number(r.inclination_deg ?? 0),
    eccentricity: Number(r.eccentricity ?? 0),
    mean_motion_rev_day: Number(r.mean_motion_rev_day ?? 0),
  }));

  const summaries: ClusterSummary[] = Array.from({ length: k }, (_, c) => {
    const memberIndices = assignments
      .map((a, idx) => (a === c ? idx : -1))
      .filter((idx) => idx !== -1);
    const size = memberIndices.length;
    const sharePct = Number(((size / n) * 100).toFixed(1));

    const typeCounts = new Map<string, number>();
    for (const idx of memberIndices) {
      const t = String(records[idx].object_type ?? 'UNKNOWN');
      typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
    }
    let dominantType = 'N/A';
    let bestCount = -1;
    for (const [t, cnt] of typeCounts.entries()) {
      if (cnt > bestCount) {
        dominantType = t;
        bestCount = cnt;
      }
    }

    const centroidFeatures: Record<string, number> = {};
    features.forEach((f, j) => {
      const meanVal =
        size > 0
          ? memberIndices.reduce((s, idx) => s + cleanRaw[idx][j], 0) / size
          : 0;
      centroidFeatures[f] = Number(meanVal.toFixed(4));
    });

    const alt = centroidFeatures.mean_altitude_km ?? centroidFeatures[features[0]] ?? 0;
    const inc = centroidFeatures.inclination_deg ?? 0;
    const ecc = centroidFeatures.eccentricity ?? 0;

    let band = 'Low-Earth band';
    if (alt > 30000) band = 'High / Geosynchronous band';
    else if (alt > 2000) band = 'Medium-Earth / Transfer band';

    const eccDesc = ecc > 0.15 ? 'eccentric transfer geometry' : 'near-circular geometry';
    const interpretation = `Empirical grouping centered near ${alt.toFixed(0)} km altitude, ${inc.toFixed(1)}° inclination (${eccDesc}, ${band}). Majority observed label: ${dominantType}.`;

    return {
      clusterId: c,
      size,
      sharePct,
      dominantType,
      centroidFeatures,
      interpretation,
    };
  });

  return {
    k,
    silhouetteScore,
    inertia,
    explainedVariance,
    points,
    summaries,
    usedFeatures: features,
    executedAt: new Date().toISOString(),
  };
}
