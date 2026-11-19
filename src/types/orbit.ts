export type ObjectCategory = 'PAYLOAD' | 'ROCKET BODY' | 'DEBRIS';

export type OrbitRegime = 'LEO' | 'MEO' | 'GEO' | 'HEO';

export type NavSection =
  | 'home'
  | 'dashboard'
  | 'data-management'
  | 'data-wrangling'
  | 'eda'
  | 'ml-lab'
  | 'evaluation'
  | 'explainable-ai'
  | 'anomaly-detection'
  | 'pattern-discovery'
  | 'prediction'
  | 'reports'
  | 'settings';

export interface SatelliteRecord {
  norad_id: string;
  object_name: string;
  object_type: ObjectCategory | string;
  orbit_regime?: OrbitRegime | string;
  apogee_km: number | null;
  perigee_km: number | null;
  mean_altitude_km: number | null;
  inclination_deg: number | null;
  eccentricity: number | null;
  mean_motion_rev_day: number | null;
  orbital_period_min: number | null;
  bstar_drag: number | null;
  rcs_m2: number | null;
  launch_year: number | null;
  [key: string]: string | number | null | undefined;
}

export interface ColumnProfile {
  name: string;
  dataType: 'numeric' | 'categorical' | 'identifier';
  missingCount: number;
  missingPct: number;
  uniqueCount: number;
  mean?: number;
  std?: number;
  min?: number;
  max?: number;
  isIdentifier: boolean;
  isTarget: boolean;
}

export interface DatasetValidationSummary {
  isValid: boolean;
  rowCount: number;
  columnCount: number;
  totalMissingCells: number;
  completenessPct: number;
  duplicateCount: number;
  identifierColumns: string[];
  numericFeatures: string[];
  categoricalFeatures: string[];
  targetColumn: string | null;
  warnings: string[];
  errors: string[];
  columns: ColumnProfile[];
}

export interface WranglingConfig {
  missingStrategy: 'drop' | 'mean' | 'median' | 'mode';
  removeDuplicates: boolean;
  outlierMethod: 'none' | 'iqr_cap' | 'iqr_remove' | 'zscore_remove';
  outlierThreshold: number;
  encodeCategorical: boolean;
  scalingMethod: 'none' | 'standard' | 'minmax';
  selectedFeatures: string[];
}

export interface WranglingStatsSnapshot {
  rowCount: number;
  columnCount: number;
  missingCells: number;
  completenessPct: number;
  duplicateRows: number;
  featureMeans: Record<string, number>;
}

export interface WranglingResult {
  cleanedData: SatelliteRecord[];
  beforeStats: WranglingStatsSnapshot;
  afterStats: WranglingStatsSnapshot;
  logs: string[];
  outliersDetected: number;
  duplicatesRemoved: number;
  missingImputed: number;
  encodedColumns: string[];
  timestamp: string;
}

export type ModelAlgorithm = 'decision_tree' | 'random_forest' | 'logistic_regression';

export interface MlTrainingConfig {
  testSize: number; // e.g., 0.2
  stratify: boolean;
  randomSeed: number;
  cvFolds: number;
  selectedFeatures: string[];
  algorithms: ModelAlgorithm[];
  scalingInPipeline: 'standard' | 'minmax' | 'none';
  decisionTreeMaxDepth: number;
  randomForestTrees: number;
  logisticMaxIter: number;
}

export interface ClassMetrics {
  label: string;
  precision: number;
  recall: number;
  f1Score: number;
  support: number;
  rocAuc: number | null;
}

export interface ModelEvaluationReport {
  modelId: ModelAlgorithm;
  modelName: string;
  accuracy: number;
  macroAvg: { precision: number; recall: number; f1Score: number };
  weightedAvg: { precision: number; recall: number; f1Score: number };
  rocAucMacro: number | null;
  classMetrics: ClassMetrics[];
  labels: string[];
  confusionMatrix: number[][];
  cvScores: number[];
  cvMean: number;
  cvStd: number;
  trainCount: number;
  testCount: number;
  trainingTimeMs: number;
  featureImportances: Array<{ feature: string; importance: number }>;
  trainedAt: string;
}

export interface FeatureContribution {
  feature: string;
  featureValue: number;
  shapValue: number; // positive pushes toward predicted class, negative pushes away
  absImpact: number;
}

export interface LocalExplanation {
  predictedClass: string;
  probabilities: Record<string, number>;
  baseValue: number;
  contributions: FeatureContribution[];
  narrative: string;
}

export interface AnomalyRecord {
  index: number;
  norad_id: string;
  object_name: string;
  object_type: string;
  mean_altitude_km: number;
  inclination_deg: number;
  eccentricity: number;
  mean_motion_rev_day: number;
  bstar_drag: number;
  rcs_m2: number;
  anomalyScore: number; // 0 to 1, closer to 1 = more anomalous
  isAnomaly: boolean;
  topDeviatingFeatures: Array<{ feature: string; zScore: number; value: number }>;
  reasonSummary: string;
}

export interface AnomalyDetectionResult {
  records: AnomalyRecord[];
  totalCount: number;
  anomalyCount: number;
  contaminationRate: number;
  thresholdScore: number;
  scoreHistogram: Array<{ bin: string; normal: number; anomaly: number }>;
  executedAt: string;
}

export interface ClusterPoint {
  index: number;
  norad_id: string;
  object_name: string;
  object_type: string;
  clusterId: number;
  pc1: number;
  pc2: number;
  mean_altitude_km: number;
  inclination_deg: number;
  eccentricity: number;
  mean_motion_rev_day: number;
}

export interface ClusterSummary {
  clusterId: number;
  size: number;
  sharePct: number;
  dominantType: string;
  centroidFeatures: Record<string, number>;
  interpretation: string;
}

export interface ClusteringResult {
  k: number;
  silhouetteScore: number;
  inertia: number;
  explainedVariance: [number, number];
  points: ClusterPoint[];
  summaries: ClusterSummary[];
  usedFeatures: string[];
  executedAt: string;
}

export interface ActivityEvent {
  id: string;
  module: string;
  action: string;
  detail: string;
  timestamp: string;
}

export interface AppNotification {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
}

export interface AppSettings {
  backendUrl: string;
  executionMode: 'local-browser' | 'fastapi-backend';
  backendConnected: boolean;
  theme: 'dark' | 'light';
}
