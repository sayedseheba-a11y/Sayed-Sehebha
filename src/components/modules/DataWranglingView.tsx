import React from 'react';
import { Download, Play, RotateCcw } from 'lucide-react';
import { useOrbitMine } from '../../context/OrbitMineContext';
import { exportRecordsToCsv, validateDataset } from '../../engine/dataPipeline';
import { PageTransition, TechnicalTooltip } from '../common/MotionPrimitives';

export const DataWranglingView: React.FC = () => {
  const {
    rawRecords,
    activeRecords,
    wranglingConfig,
    setWranglingConfig,
    wranglingResult,
    executeWrangling,
    loadDataset,
    datasetName,
    isDemoData,
    setActiveNav,
  } = useOrbitMine();

  const rawValidation = React.useMemo(() => validateDataset(rawRecords), [rawRecords]);

  const toggleFeature = (feat: string) => {
    setWranglingConfig((prev) => {
      const exists = prev.selectedFeatures.includes(feat);
      return {
        ...prev,
        selectedFeatures: exists
          ? prev.selectedFeatures.filter((f) => f !== feat)
          : [...prev.selectedFeatures, feat],
      };
    });
  };

  return (
    <PageTransition className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800/80">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Data Wrangling &amp; Preprocessing
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Clean missing orbital telemetry, deduplicate records, handle extreme outliers, and inspect before/after deltas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => loadDataset(rawRecords, datasetName, isDemoData)}
            className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-cyan-500 transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Revert to Raw</span>
          </button>
          <button
            type="button"
            onClick={() => exportRecordsToCsv(activeRecords, `cleaned_${datasetName}`)}
            className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-cyan-500 transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Cleaned CSV</span>
          </button>
          <button
            type="button"
            onClick={() => executeWrangling()}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Run Wrangling Pipeline</span>
          </button>
        </div>
      </div>

      {/* Controls + Before/After Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Configuration Panel */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6 space-y-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Preprocessing Configuration
          </h2>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              Missing Value Strategy
            </label>
            <select
              value={wranglingConfig.missingStrategy}
              onChange={(e) =>
                setWranglingConfig((p) => ({
                  ...p,
                  missingStrategy: e.target.value as typeof p.missingStrategy,
                }))
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#070B16] text-xs text-slate-900 dark:text-slate-100"
            >
              <option value="median">Impute Numeric with Median (Recommended)</option>
              <option value="mean">Impute Numeric with Mean</option>
              <option value="mode">Impute with Mode</option>
              <option value="drop">Drop Incomplete Rows</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              <TechnicalTooltip
                term="Outlier Handling"
                explanation="IQR Capping (Winsorization) clamps extreme values to [Q1 - 1.5*IQR, Q3 + 1.5*IQR] without discarding legitimate high-orbit satellites."
              />
            </label>
            <select
              value={wranglingConfig.outlierMethod}
              onChange={(e) =>
                setWranglingConfig((p) => ({
                  ...p,
                  outlierMethod: e.target.value as typeof p.outlierMethod,
                }))
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#070B16] text-xs text-slate-900 dark:text-slate-100"
            >
              <option value="none">Retain All Orbital Extremes (Recommended for GEO/HEO)</option>
              <option value="iqr_cap">IQR 1.5× Winsorization (Cap Extremes)</option>
              <option value="iqr_remove">IQR 1.5× Row Removal</option>
              <option value="zscore_remove">Z-Score (&gt; 3.0σ) Row Removal</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              Feature Scaling Preference (Applied in ML Split)
            </label>
            <select
              value={wranglingConfig.scalingMethod}
              onChange={(e) =>
                setWranglingConfig((p) => ({
                  ...p,
                  scalingMethod: e.target.value as typeof p.scalingMethod,
                }))
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#070B16] text-xs text-slate-900 dark:text-slate-100"
            >
              <option value="standard">StandardScaler (Zero Mean, Unit Variance)</option>
              <option value="minmax">MinMaxScaler ([0, 1] Range)</option>
              <option value="none">No Scaling</option>
            </select>
          </div>

          <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={wranglingConfig.removeDuplicates}
                onChange={(e) =>
                  setWranglingConfig((p) => ({ ...p, removeDuplicates: e.target.checked }))
                }
                className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
              />
              <span>Remove exact duplicate rows ({rawValidation.duplicateCount} detected)</span>
            </label>

            <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={wranglingConfig.encodeCategorical}
                onChange={(e) =>
                  setWranglingConfig((p) => ({ ...p, encodeCategorical: e.target.checked }))
                }
                className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
              />
              <span>Encode non-target categorical features (e.g., orbit_regime)</span>
            </label>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">
              Features Selected for Outlier &amp; Downstream Analysis
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {rawValidation.numericFeatures.map((feat) => (
                <label
                  key={feat}
                  className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer truncate"
                >
                  <input
                    type="checkbox"
                    checked={wranglingConfig.selectedFeatures.includes(feat)}
                    onChange={() => toggleFeature(feat)}
                    className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                  />
                  <span className="truncate font-mono">{feat}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Before & After Comparison + Log */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
              Before &amp; After Wrangling Statistics
            </h2>

            {wranglingResult ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                      <th className="py-2 pr-4 font-medium">Metric</th>
                      <th className="py-2 px-3 font-medium text-right">Raw Dataset</th>
                      <th className="py-2 px-3 font-medium text-right">Cleaned Dataset</th>
                      <th className="py-2 pl-3 font-medium text-right">Delta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                    <tr>
                      <td className="py-2.5 pr-4 text-slate-700 dark:text-slate-300">Total Rows</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {wranglingResult.beforeStats.rowCount}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                        {wranglingResult.afterStats.rowCount}
                      </td>
                      <td className="py-2.5 pl-3 text-right font-mono tabular-nums text-cyan-500">
                        {wranglingResult.afterStats.rowCount - wranglingResult.beforeStats.rowCount}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 pr-4 text-slate-700 dark:text-slate-300">Missing Cells</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-amber-500">
                        {wranglingResult.beforeStats.missingCells}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-emerald-500">
                        {wranglingResult.afterStats.missingCells}
                      </td>
                      <td className="py-2.5 pl-3 text-right font-mono tabular-nums text-emerald-500">
                        {wranglingResult.afterStats.missingCells - wranglingResult.beforeStats.missingCells}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 pr-4 text-slate-700 dark:text-slate-300">Duplicate Rows</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {wranglingResult.beforeStats.duplicateRows}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold">
                        {wranglingResult.afterStats.duplicateRows}
                      </td>
                      <td className="py-2.5 pl-3 text-right font-mono tabular-nums text-cyan-500">
                        -{wranglingResult.duplicatesRemoved}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 pr-4 text-slate-700 dark:text-slate-300">Completeness</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {wranglingResult.beforeStats.completenessPct}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-emerald-500">
                        {wranglingResult.afterStats.completenessPct}%
                      </td>
                      <td className="py-2.5 pl-3 text-right font-mono tabular-nums text-emerald-500">
                        +{(wranglingResult.afterStats.completenessPct - wranglingResult.beforeStats.completenessPct).toFixed(2)}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-6 text-xs text-slate-500 dark:text-slate-400">
                Raw dataset currently contains{' '}
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {rawValidation.totalMissingCells}
                </span>{' '}
                missing cells and{' '}
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {rawValidation.duplicateCount}
                </span>{' '}
                duplicates. Click &ldquo;Run Wrangling Pipeline&rdquo; to apply transformations.
              </div>
            )}
          </div>

          {/* Processing Log */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Wrangling Execution Log
              </h2>
              {wranglingResult && (
                <button
                  type="button"
                  onClick={() => setActiveNav('ml-lab')}
                  className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline"
                >
                  Train Models on Cleaned Data →
                </button>
              )}
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-[#060913] border border-slate-200 dark:border-slate-800 p-4 font-mono text-xs space-y-1.5 max-h-56 overflow-y-auto text-slate-700 dark:text-slate-300">
              {wranglingResult ? (
                wranglingResult.logs.map((entry, idx) => (
                  <p key={idx}>
                    <span className="text-cyan-500 mr-2">[{String(idx + 1).padStart(2, '0')}]</span>
                    {entry}
                  </p>
                ))
              ) : (
                <p className="text-slate-400">Awaiting pipeline execution...</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
};
