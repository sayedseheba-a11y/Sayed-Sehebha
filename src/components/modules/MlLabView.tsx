import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download, Play, ShieldCheck, Upload } from 'lucide-react';
import { useOrbitMine } from '../../context/OrbitMineContext';
import { ModelAlgorithm } from '../../types/orbit';
import { PageTransition, TechnicalTooltip } from '../common/MotionPrimitives';

export const MlLabView: React.FC = () => {
  const {
    validation,
    mlConfig,
    setMlConfig,
    trainedModels,
    isTraining,
    trainingProgress,
    executeModelTraining,
    saveModelToLocalStorage,
    loadModelFromJson,
    setSelectedModelId,
    setActiveNav,
  } = useOrbitMine();

  const availableNumericFeatures = useMemo(
    () => validation.numericFeatures,
    [validation.numericFeatures]
  );

  const [uploadError, setUploadError] = useState<string | null>(null);

  const toggleAlgorithm = (algo: ModelAlgorithm) => {
    setMlConfig((prev) => {
      const exists = prev.algorithms.includes(algo);
      return {
        ...prev,
        algorithms: exists
          ? prev.algorithms.filter((a) => a !== algo)
          : [...prev.algorithms, algo],
      };
    });
  };

  const toggleFeature = (feat: string) => {
    setMlConfig((prev) => {
      const exists = prev.selectedFeatures.includes(feat);
      return {
        ...prev,
        selectedFeatures: exists
          ? prev.selectedFeatures.filter((f) => f !== feat)
          : [...prev.selectedFeatures, feat],
      };
    });
  };

  const comparisonChartData = useMemo(
    () =>
      trainedModels.map((m) => ({
        name: m.modelName.replace(' (CART)', '').replace(' (L2)', ''),
        Accuracy: Number((m.evaluation.accuracy * 100).toFixed(2)),
        MacroF1: Number((m.evaluation.macroAvg.f1Score * 100).toFixed(2)),
        CVMean: Number((m.evaluation.cvMean * 100).toFixed(2)),
      })),
    [trainedModels]
  );

  const handleModelUpload = (file: File) => {
    setUploadError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        loadModelFromJson(String(e.target?.result ?? ''));
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Failed to parse model JSON');
      }
    };
    reader.readAsText(file);
  };

  return (
    <PageTransition className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800/80">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Machine Learning Lab
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configure leakage-free stratified train/test splits, train multiple supervised classifiers, and compare cross-validation results.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <label className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:border-cyan-500 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>Load Model JSON</span>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleModelUpload(f);
              }}
            />
          </label>
          <button
            type="button"
            disabled={isTraining}
            onClick={executeModelTraining}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{isTraining ? 'Training Pipeline...' : 'Train & Validate Models'}</span>
          </button>
        </div>
      </div>

      {/* Zero-Leakage Safeguard Notice */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>
            Leakage Prevention Active: Identifiers ({validation.identifierColumns.join(', ') || 'none'}) and target ({validation.targetColumn ?? 'object_type'}) are excluded from feature matrix X. Scaling &amp; imputation fit strictly on training partitions.
          </span>
        </div>
      </div>

      {/* Animated Progress Bar during Training */}
      {isTraining && (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-cyan-600 dark:text-cyan-400">
              Executing Stratified Split, Preprocessing Fit, Classifier Training &amp; {mlConfig.cvFolds}-Fold CV...
            </span>
            <span className="font-mono tabular-nums text-cyan-500">{trainingProgress}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-cyan-500 transition-all duration-200"
              style={{ width: `${trainingProgress}%` }}
            />
          </div>
        </div>
      )}

      {uploadError && (
        <p className="text-xs text-rose-500">{uploadError}</p>
      )}

      {/* Split & Algorithm Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6 space-y-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Experiment Configuration
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                Test Split Ratio ({Math.round(mlConfig.testSize * 100)}%)
              </label>
              <select
                value={mlConfig.testSize}
                onChange={(e) =>
                  setMlConfig((p) => ({ ...p, testSize: Number(e.target.value) }))
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#070B16] text-xs font-mono"
              >
                <option value={0.15}>85% Train / 15% Test</option>
                <option value={0.2}>80% Train / 20% Test</option>
                <option value={0.25}>75% Train / 25% Test</option>
                <option value={0.3}>70% Train / 30% Test</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                CV Folds
              </label>
              <select
                value={mlConfig.cvFolds}
                onChange={(e) =>
                  setMlConfig((p) => ({ ...p, cvFolds: Number(e.target.value) }))
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#070B16] text-xs font-mono"
              >
                <option value={3}>3-Fold Stratified CV</option>
                <option value={5}>5-Fold Stratified CV</option>
                <option value={10}>10-Fold Stratified CV</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                Pipeline Scaling
              </label>
              <select
                value={mlConfig.scalingInPipeline}
                onChange={(e) =>
                  setMlConfig((p) => ({
                    ...p,
                    scalingInPipeline: e.target.value as typeof p.scalingInPipeline,
                  }))
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#070B16] text-xs"
              >
                <option value="standard">StandardScaler (Train-fit)</option>
                <option value="minmax">MinMaxScaler (Train-fit)</option>
                <option value="none">Unscaled</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                Tree Max Depth
              </label>
              <input
                type="number"
                min={2}
                max={14}
                value={mlConfig.decisionTreeMaxDepth}
                onChange={(e) =>
                  setMlConfig((p) => ({
                    ...p,
                    decisionTreeMaxDepth: Math.max(2, Math.min(14, Number(e.target.value) || 6)),
                  }))
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#070B16] text-xs font-mono"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={mlConfig.stratify}
              onChange={(e) => setMlConfig((p) => ({ ...p, stratify: e.target.checked }))}
              className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
            />
            <span>
              <TechnicalTooltip
                term="Stratified Splitting"
                explanation="Preserves exact Payload, Rocket Body, and Debris class proportions across both training and test partitions."
              />
            </span>
          </label>

          {/* Algorithms */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Classifiers to Train
            </p>
            {[
              { id: 'decision_tree' as const, label: 'Decision Tree Classifier (CART Gini)' },
              { id: 'random_forest' as const, label: `Random Forest (${mlConfig.randomForestTrees} trees)` },
              { id: 'logistic_regression' as const, label: 'Multinomial Logistic Regression (L2)' },
            ].map((algo) => (
              <label
                key={algo.id}
                className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={mlConfig.algorithms.includes(algo.id)}
                  onChange={() => toggleAlgorithm(algo.id)}
                  className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                />
                <span>{algo.label}</span>
              </label>
            ))}
          </div>

          {/* Predictive Features */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">
              Predictive Input Features ({mlConfig.selectedFeatures.length} selected)
            </p>
            <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
              {availableNumericFeatures.map((feat) => (
                <label
                  key={feat}
                  className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer truncate"
                >
                  <input
                    type="checkbox"
                    checked={mlConfig.selectedFeatures.includes(feat)}
                    onChange={() => toggleFeature(feat)}
                    className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                  />
                  <span className="truncate font-mono">{feat}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Trained Model Comparison */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
              Model Benchmark Comparison (Real Hold-Out Test Metrics)
            </h2>

            {trainedModels.length > 0 ? (
              <>
                <div className="overflow-x-auto mb-6">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                        <th className="py-2 pr-3 font-medium">Model</th>
                        <th className="py-2 px-2.5 font-medium text-right">Test Acc</th>
                        <th className="py-2 px-2.5 font-medium text-right">Macro F1</th>
                        <th className="py-2 px-2.5 font-medium text-right">CV Mean</th>
                        <th className="py-2 px-2.5 font-medium text-right">Time</th>
                        <th className="py-2 pl-2.5 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                      {trainedModels.map((m) => (
                        <tr key={m.algorithm} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="py-2.5 pr-3 font-medium text-slate-900 dark:text-white">
                            {m.modelName}
                          </td>
                          <td className="py-2.5 px-2.5 text-right font-mono tabular-nums text-cyan-600 dark:text-cyan-400 font-semibold">
                            {(m.evaluation.accuracy * 100).toFixed(2)}%
                          </td>
                          <td className="py-2.5 px-2.5 text-right font-mono tabular-nums">
                            {(m.evaluation.macroAvg.f1Score * 100).toFixed(2)}%
                          </td>
                          <td className="py-2.5 px-2.5 text-right font-mono tabular-nums">
                            {(m.evaluation.cvMean * 100).toFixed(2)}%
                          </td>
                          <td className="py-2.5 px-2.5 text-right font-mono tabular-nums text-slate-500">
                            {m.evaluation.trainingTimeMs}ms
                          </td>
                          <td className="py-2.5 pl-2.5 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedModelId(m.algorithm);
                                setActiveNav('evaluation');
                              }}
                              className="text-cyan-600 dark:text-cyan-400 hover:underline mr-3"
                            >
                              Evaluate
                            </button>
                            <button
                              type="button"
                              onClick={() => saveModelToLocalStorage(m.algorithm)}
                              className="text-slate-500 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1"
                              title="Save model JSON"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonChartData} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                      <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fill: '#94A3B8', fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0F172A',
                          borderColor: '#1E293B',
                          borderRadius: '8px',
                          color: '#F8FAFC',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="Accuracy" fill="#06B6D4" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="MacroF1" fill="#6366F1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="CVMean" fill="#10B981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
                No models have been trained on the active dataset yet. Configure your split and click &ldquo;Train &amp; Validate Models&rdquo; to compute genuine benchmark metrics.
              </div>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
};
