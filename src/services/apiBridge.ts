import {
  AnomalyDetectionResult,
  ClusteringResult,
  MlTrainingConfig,
  ModelAlgorithm,
  ModelEvaluationReport,
  SatelliteRecord,
  WranglingConfig,
} from '../types/orbit';

export interface BackendHealthStatus {
  online: boolean;
  version?: string;
  libraries?: string[];
  latencyMs?: number;
  error?: string;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 4500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkBackendHealth(baseUrl: string): Promise<BackendHealthStatus> {
  const cleanUrl = baseUrl.replace(/\/+$/, '');
  const t0 = performance.now();
  try {
    const res = await fetchWithTimeout(`${cleanUrl}/health`, { method: 'GET' }, 2500);
    if (!res.ok) {
      return { online: false, error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    return {
      online: true,
      version: data.version ?? '1.0.0',
      libraries: data.libraries ?? ['pandas', 'numpy', 'scikit-learn', 'shap'],
      latencyMs: Math.round(performance.now() - t0),
    };
  } catch (err) {
    return {
      online: false,
      error: err instanceof Error ? err.message : 'Backend unreachable',
    };
  }
}

export async function apiUploadDataset(baseUrl: string, records: SatelliteRecord[]) {
  const cleanUrl = baseUrl.replace(/\/+$/, '');
  const res = await fetchWithTimeout(`${cleanUrl}/api/dataset/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ records }),
  }, 8000);
  if (!res.ok) throw new Error(`Backend upload failed (${res.status})`);
  return res.json();
}

export async function apiWrangleDataset(baseUrl: string, config: WranglingConfig) {
  const cleanUrl = baseUrl.replace(/\/+$/, '');
  const res = await fetchWithTimeout(`${cleanUrl}/api/dataset/wrangle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  }, 10000);
  if (!res.ok) throw new Error(`Backend wrangling failed (${res.status})`);
  return res.json();
}

export async function apiTrainModels(
  baseUrl: string,
  config: MlTrainingConfig
): Promise<{ evaluations: ModelEvaluationReport[] }> {
  const cleanUrl = baseUrl.replace(/\/+$/, '');
  const res = await fetchWithTimeout(`${cleanUrl}/api/ml/train`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  }, 20000);
  if (!res.ok) throw new Error(`Backend training failed (${res.status})`);
  return res.json();
}

export async function apiSaveModel(baseUrl: string, algorithm: ModelAlgorithm, label: string) {
  const cleanUrl = baseUrl.replace(/\/+$/, '');
  const res = await fetchWithTimeout(`${cleanUrl}/api/ml/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ algorithm, model_label: label }),
  });
  if (!res.ok) throw new Error(`Backend save failed (${res.status})`);
  return res.json();
}

export async function apiLoadModel(baseUrl: string, modelLabel: string) {
  const cleanUrl = baseUrl.replace(/\/+$/, '');
  const res = await fetchWithTimeout(`${cleanUrl}/api/ml/load`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model_label: modelLabel }),
  });
  if (!res.ok) throw new Error(`Backend load failed (${res.status})`);
  return res.json();
}

export async function apiRunAnomalyDetection(
  baseUrl: string,
  features: string[],
  contamination: number
): Promise<AnomalyDetectionResult> {
  const cleanUrl = baseUrl.replace(/\/+$/, '');
  const res = await fetchWithTimeout(`${cleanUrl}/api/anomaly/detect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ features, contamination }),
  }, 10000);
  if (!res.ok) throw new Error(`Backend anomaly detection failed (${res.status})`);
  return res.json();
}

export async function apiRunClustering(
  baseUrl: string,
  features: string[],
  k: number
): Promise<ClusteringResult> {
  const cleanUrl = baseUrl.replace(/\/+$/, '');
  const res = await fetchWithTimeout(`${cleanUrl}/api/cluster/kmeans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ features, k }),
  }, 10000);
  if (!res.ok) throw new Error(`Backend clustering failed (${res.status})`);
  return res.json();
}
