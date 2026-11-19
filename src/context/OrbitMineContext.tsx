import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { generateIllustrativeOrbitalCatalogue } from '../data/sampleCatalogue';
import { runIsolationForest } from '../engine/anomalyDetection';
import { runKMeansClustering } from '../engine/clustering';
import { validateDataset } from '../engine/dataPipeline';
import { trainAndEvaluateModels, TrainedModelArtifact } from '../engine/mlEngine';
import { runDataWrangling } from '../engine/wrangling';
import { checkBackendHealth } from '../services/apiBridge';
import {
  ActivityEvent,
  AnomalyDetectionResult,
  AppNotification,
  AppSettings,
  ClusteringResult,
  DatasetValidationSummary,
  MlTrainingConfig,
  ModelAlgorithm,
  NavSection,
  SatelliteRecord,
  WranglingConfig,
  WranglingResult,
} from '../types/orbit';

interface OrbitMineContextValue {
  activeNav: NavSection;
  setActiveNav: (nav: NavSection) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;

  // Dataset state
  datasetName: string;
  isDemoData: boolean;
  rawRecords: SatelliteRecord[];
  activeRecords: SatelliteRecord[];
  validation: DatasetValidationSummary;
  loadDataset: (records: SatelliteRecord[], name: string, isDemo: boolean) => void;
  resetToDemoDataset: () => void;

  // Wrangling
  wranglingConfig: WranglingConfig;
  setWranglingConfig: React.Dispatch<React.SetStateAction<WranglingConfig>>;
  wranglingResult: WranglingResult | null;
  executeWrangling: (overrideConfig?: WranglingConfig) => void;

  // ML Lab & Evaluation
  mlConfig: MlTrainingConfig;
  setMlConfig: React.Dispatch<React.SetStateAction<MlTrainingConfig>>;
  trainedModels: TrainedModelArtifact[];
  selectedModelId: ModelAlgorithm | null;
  setSelectedModelId: (id: ModelAlgorithm | null) => void;
  selectedModel: TrainedModelArtifact | null;
  isTraining: boolean;
  trainingProgress: number;
  executeModelTraining: () => void;
  saveModelToLocalStorage: (modelId: ModelAlgorithm) => void;
  loadModelFromJson: (jsonText: string) => void;

  // Anomaly Detection
  anomalyResult: AnomalyDetectionResult | null;
  anomalyContamination: number;
  setAnomalyContamination: (v: number) => void;
  executeAnomalyDetection: (features?: string[], contamination?: number) => void;

  // Clustering
  clusteringResult: ClusteringResult | null;
  clusterK: number;
  setClusterK: (k: number) => void;
  executeClustering: (features?: string[], k?: number) => void;

  // Activity & Notifications
  activities: ActivityEvent[];
  notifications: AppNotification[];
  notify: (type: AppNotification['type'], title: string, message: string) => void;
  dismissNotification: (id: string) => void;

  // Settings & Theme
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
  testBackendConnection: () => Promise<boolean>;
}

const OrbitMineContext = createContext<OrbitMineContextValue | null>(null);

const DEFAULT_ML_FEATURES = [
  'apogee_km',
  'perigee_km',
  'mean_altitude_km',
  'inclination_deg',
  'eccentricity',
  'mean_motion_rev_day',
  'orbital_period_min',
  'bstar_drag',
  'rcs_m2',
];

export const OrbitMineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeNav, setActiveNav] = useState<NavSection>('home');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const initialSample = useMemo(() => generateIllustrativeOrbitalCatalogue(420), []);
  const [datasetName, setDatasetName] = useState('illustrative_orbital_catalogue_420.csv');
  const [isDemoData, setIsDemoData] = useState(true);
  const [rawRecords, setRawRecords] = useState<SatelliteRecord[]>(initialSample);
  const [activeRecords, setActiveRecords] = useState<SatelliteRecord[]>(initialSample);

  const validation = useMemo(() => validateDataset(activeRecords), [activeRecords]);

  const [wranglingConfig, setWranglingConfig] = useState<WranglingConfig>({
    missingStrategy: 'median',
    removeDuplicates: true,
    outlierMethod: 'none',
    outlierThreshold: 3.0,
    encodeCategorical: true,
    scalingMethod: 'standard',
    selectedFeatures: DEFAULT_ML_FEATURES,
  });
  const [wranglingResult, setWranglingResult] = useState<WranglingResult | null>(null);

  const [mlConfig, setMlConfig] = useState<MlTrainingConfig>({
    testSize: 0.2,
    stratify: true,
    randomSeed: 42,
    cvFolds: 5,
    selectedFeatures: DEFAULT_ML_FEATURES,
    algorithms: ['decision_tree', 'random_forest', 'logistic_regression'],
    scalingInPipeline: 'standard',
    decisionTreeMaxDepth: 6,
    randomForestTrees: 24,
    logisticMaxIter: 220,
  });

  const [trainedModels, setTrainedModels] = useState<TrainedModelArtifact[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<ModelAlgorithm | null>(null);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);

  const [anomalyContamination, setAnomalyContamination] = useState(0.05);
  const [anomalyResult, setAnomalyResult] = useState<AnomalyDetectionResult | null>(() =>
    runIsolationForest(initialSample, ['mean_altitude_km', 'inclination_deg', 'eccentricity', 'bstar_drag', 'rcs_m2'], 0.05)
  );

  const [clusterK, setClusterK] = useState(4);
  const [clusteringResult, setClusteringResult] = useState<ClusteringResult | null>(null);

  const [activities, setActivities] = useState<ActivityEvent[]>([
    {
      id: 'init-1',
      module: 'Data Management',
      action: 'Loaded Illustrative Catalogue',
      detail: '420 orbital records initialized with Keplerian elements and physical parameters.',
      timestamp: new Date().toLocaleTimeString(),
    },
    {
      id: 'init-2',
      module: 'Anomaly Detection',
      action: 'Initial Isolation Forest Scan',
      detail: 'Scanned catalogue at 5.0% contamination threshold for orbital deviations.',
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const [settings, setSettings] = useState<AppSettings>({
    backendUrl: 'http://localhost:8000',
    executionMode: 'local-browser',
    backendConnected: false,
    theme: 'dark',
  });

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings.theme]);

  const notify = useCallback((type: AppNotification['type'], title: string, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setNotifications((prev) => [...prev.slice(-3), { id, type, title, message }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4500);
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const logActivity = useCallback((module: string, action: string, detail: string) => {
    setActivities((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        module,
        action,
        detail,
        timestamp: new Date().toLocaleTimeString(),
      },
      ...prev.slice(0, 14),
    ]);
  }, []);

  const loadDataset = useCallback(
    (records: SatelliteRecord[], name: string, isDemo: boolean) => {
      const val = validateDataset(records);
      setRawRecords(records);
      setActiveRecords(records);
      setDatasetName(name);
      setIsDemoData(isDemo);
      setWranglingResult(null);
      setTrainedModels([]);
      setSelectedModelId(null);
      setClusteringResult(null);

      const availableNum = val.numericFeatures;
      setWranglingConfig((prev) => ({ ...prev, selectedFeatures: availableNum }));
      setMlConfig((prev) => ({
        ...prev,
        selectedFeatures: availableNum.filter((f) => !f.endsWith('_encoded')),
      }));

      if (availableNum.length >= 2) {
        setAnomalyResult(runIsolationForest(records, availableNum.slice(0, 6), anomalyContamination));
      } else {
        setAnomalyResult(null);
      }

      logActivity('Data Management', isDemo ? 'Reset Sample Catalogue' : 'Uploaded CSV Dataset', `${records.length} rows (${name})`);
      notify('success', 'Dataset Loaded', `${name} (${records.length} records) is now active.`);
    },
    [anomalyContamination, logActivity, notify]
  );

  const resetToDemoDataset = useCallback(() => {
    const fresh = generateIllustrativeOrbitalCatalogue(420);
    loadDataset(fresh, 'illustrative_orbital_catalogue_420.csv', true);
  }, [loadDataset]);

  const executeWrangling = useCallback(
    (overrideConfig?: WranglingConfig) => {
      const cfg = overrideConfig ?? wranglingConfig;
      const result = runDataWrangling(rawRecords, cfg);
      setWranglingResult(result);
      setActiveRecords(result.cleanedData);

      const postVal = validateDataset(result.cleanedData);
      const validFeatures = postVal.numericFeatures.filter((f) => !f.endsWith('_encoded'));
      setMlConfig((prev) => ({
        ...prev,
        selectedFeatures: prev.selectedFeatures.filter((f) => postVal.numericFeatures.includes(f)).length > 0
          ? prev.selectedFeatures.filter((f) => postVal.numericFeatures.includes(f))
          : validFeatures,
      }));

      logActivity(
        'Data Wrangling',
        'Applied Preprocessing Pipeline',
        `${result.afterStats.rowCount} rows retained (${result.duplicatesRemoved} dupes removed, ${result.missingImputed} missing handled).`
      );
      notify('success', 'Wrangling Complete', `Dataset cleaned to ${result.afterStats.completenessPct}% completeness.`);
    },
    [rawRecords, wranglingConfig, logActivity, notify]
  );

  const executeModelTraining = useCallback(() => {
    if (!validation.targetColumn) {
      notify('error', 'Missing Target Column', 'Dataset must contain an object_type / category label column.');
      return;
    }
    if (mlConfig.selectedFeatures.length < 2) {
      notify('error', 'Insufficient Features', 'Select at least 2 numeric orbital features before training.');
      return;
    }
    if (mlConfig.algorithms.length === 0) {
      notify('error', 'No Algorithm Selected', 'Choose at least one classifier to train.');
      return;
    }

    setIsTraining(true);
    setTrainingProgress(15);

    setTimeout(() => {
      setTrainingProgress(55);
      setTimeout(() => {
        try {
          const artifacts = trainAndEvaluateModels(
            activeRecords,
            validation.targetColumn!,
            mlConfig
          );
          setTrainedModels(artifacts);
          const best = [...artifacts].sort((a, b) => b.evaluation.accuracy - a.evaluation.accuracy)[0];
          setSelectedModelId(best?.algorithm ?? null);
          setTrainingProgress(100);
          logActivity(
            'Machine Learning Lab',
            `Trained ${artifacts.length} Classifier${artifacts.length > 1 ? 's' : ''}`,
            `Best test accuracy: ${(best.evaluation.accuracy * 100).toFixed(2)}% (${best.modelName}).`
          );
          notify('success', 'Training Finished', `Evaluated ${artifacts.length} models with ${mlConfig.cvFolds}-fold cross-validation.`);
        } catch (err) {
          notify('error', 'Training Error', err instanceof Error ? err.message : 'Failed to train models.');
        } finally {
          setTimeout(() => {
            setIsTraining(false);
            setTrainingProgress(0);
          }, 250);
        }
      }, 180);
    }, 140);
  }, [activeRecords, mlConfig, validation.targetColumn, logActivity, notify]);

  const saveModelToLocalStorage = useCallback(
    (modelId: ModelAlgorithm) => {
      const artifact = trainedModels.find((m) => m.algorithm === modelId);
      if (!artifact) {
        notify('error', 'Model Not Found', 'Train the model before exporting.');
        return;
      }
      const serialized = JSON.stringify(artifact, null, 2);
      localStorage.setItem(`orbitmine_model_${modelId}`, serialized);
      const blob = new Blob([serialized], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orbitmine_${modelId}_model.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      logActivity('Machine Learning Lab', 'Exported Model Artifact', `${artifact.modelName} saved to JSON.`);
      notify('success', 'Model Saved', `${artifact.modelName} exported as JSON artifact.`);
    },
    [trainedModels, logActivity, notify]
  );

  const loadModelFromJson = useCallback(
    (jsonText: string) => {
      try {
        const parsed = JSON.parse(jsonText) as TrainedModelArtifact;
        if (!parsed.algorithm || !parsed.features || !parsed.evaluation) {
          throw new Error('Invalid ORBITMINE model artifact schema.');
        }
        setTrainedModels((prev) => {
          const filtered = prev.filter((m) => m.algorithm !== parsed.algorithm);
          return [...filtered, parsed];
        });
        setSelectedModelId(parsed.algorithm);
        logActivity('Machine Learning Lab', 'Loaded Model Artifact', `Restored ${parsed.modelName}.`);
        notify('success', 'Model Loaded', `${parsed.modelName} is ready for evaluation and prediction.`);
      } catch (err) {
        notify('error', 'Load Failed', err instanceof Error ? err.message : 'Invalid model file.');
      }
    },
    [logActivity, notify]
  );

  const executeAnomalyDetection = useCallback(
    (features?: string[], contamination?: number) => {
      const usedFeatures =
        features && features.length > 0
          ? features
          : validation.numericFeatures.slice(0, 6);
      const rate = contamination ?? anomalyContamination;
      if (usedFeatures.length < 2) {
        notify('error', 'Insufficient Features', 'Select at least 2 numeric features for Isolation Forest.');
        return;
      }
      const res = runIsolationForest(activeRecords, usedFeatures, rate);
      setAnomalyResult(res);
      logActivity(
        'Anomaly Detection',
        'Executed Isolation Forest',
        `Flagged ${res.anomalyCount} unusual orbital records out of ${res.totalCount}.`
      );
      notify('info', 'Anomaly Scan Complete', `Identified ${res.anomalyCount} anomalous objects.`);
    },
    [activeRecords, anomalyContamination, validation.numericFeatures, logActivity, notify]
  );

  const executeClustering = useCallback(
    (features?: string[], kOverride?: number) => {
      const usedFeatures =
        features && features.length > 0
          ? features
          : validation.numericFeatures.slice(0, 6);
      const kVal = kOverride ?? clusterK;
      if (usedFeatures.length < 2) {
        notify('error', 'Insufficient Features', 'Select at least 2 numeric features for K-Means clustering.');
        return;
      }
      const res = runKMeansClustering(activeRecords, usedFeatures, kVal);
      setClusteringResult(res);
      logActivity(
        'Pattern Discovery',
        `K-Means Clustering (k=${kVal})`,
        `Silhouette Score: ${res.silhouetteScore} across ${res.points.length} objects.`
      );
      notify('success', 'Clustering Complete', `Discovered ${kVal} orbital clusters (Silhouette ${res.silhouetteScore}).`);
    },
    [activeRecords, clusterK, validation.numericFeatures, logActivity, notify]
  );

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const testBackendConnection = useCallback(async () => {
    const status = await checkBackendHealth(settings.backendUrl);
    updateSettings({ backendConnected: status.online });
    if (status.online) {
      notify('success', 'FastAPI Connected', `Backend online (${status.latencyMs}ms).`);
    } else {
      notify('warning', 'Backend Offline', `Could not reach ${settings.backendUrl}. Local Browser Engine remains active.`);
    }
    return status.online;
  }, [settings.backendUrl, updateSettings, notify]);

  const selectedModel = useMemo(
    () => trainedModels.find((m) => m.algorithm === selectedModelId) ?? trainedModels[0] ?? null,
    [trainedModels, selectedModelId]
  );

  return (
    <OrbitMineContext.Provider
      value={{
        activeNav,
        setActiveNav,
        sidebarCollapsed,
        setSidebarCollapsed,
        datasetName,
        isDemoData,
        rawRecords,
        activeRecords,
        validation,
        loadDataset,
        resetToDemoDataset,
        wranglingConfig,
        setWranglingConfig,
        wranglingResult,
        executeWrangling,
        mlConfig,
        setMlConfig,
        trainedModels,
        selectedModelId,
        setSelectedModelId,
        selectedModel,
        isTraining,
        trainingProgress,
        executeModelTraining,
        saveModelToLocalStorage,
        loadModelFromJson,
        anomalyResult,
        anomalyContamination,
        setAnomalyContamination,
        executeAnomalyDetection,
        clusteringResult,
        clusterK,
        setClusterK,
        executeClustering,
        activities,
        notifications,
        notify,
        dismissNotification,
        settings,
        updateSettings,
        testBackendConnection,
      }}
    >
      {children}
    </OrbitMineContext.Provider>
  );
};

export function useOrbitMine() {
  const ctx = useContext(OrbitMineContext);
  if (!ctx) throw new Error('useOrbitMine must be used inside OrbitMineProvider');
  return ctx;
}
