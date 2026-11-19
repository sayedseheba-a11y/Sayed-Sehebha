import React from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { useOrbitMine } from '../../context/OrbitMineContext';
import { exportRecordsToCsv } from '../../engine/dataPipeline';
import { exportFullReportPdf } from '../../utils/reportGenerator';
import { PageTransition } from '../common/MotionPrimitives';

export const ReportsView: React.FC = () => {
  const {
    datasetName,
    isDemoData,
    activeRecords,
    validation,
    wranglingResult,
    trainedModels,
    selectedModel,
    anomalyResult,
    clusteringResult,
    notify,
  } = useOrbitMine();

  const evaluations = trainedModels.map((m) => m.evaluation);

  const handleExportPdf = () => {
    exportFullReportPdf({
      datasetName,
      isDemoData,
      validation,
      wrangling: wranglingResult,
      evaluations,
      selectedModel: selectedModel?.evaluation ?? null,
      anomalyResult,
      clusteringResult,
    });
    notify('success', 'PDF Report Exported', 'Full ORBITMINE scientific report downloaded.');
  };

  const handleExportCsvSummary = () => {
    const rows = evaluations.map((ev) => ({
      model_name: ev.modelName,
      accuracy: ev.accuracy,
      macro_precision: ev.macroAvg.precision,
      macro_recall: ev.macroAvg.recall,
      macro_f1: ev.macroAvg.f1Score,
      weighted_f1: ev.weightedAvg.f1Score,
      roc_auc_macro: ev.rocAucMacro ?? 'N/A',
      cv_mean: ev.cvMean,
      cv_std: ev.cvStd,
      train_samples: ev.trainCount,
      test_samples: ev.testCount,
    }));
    if (rows.length > 0) {
      exportRecordsToCsv(rows as never, `orbitmine_model_report_${Date.now()}.csv`);
    } else {
      exportRecordsToCsv(activeRecords, `orbitmine_dataset_summary_${Date.now()}.csv`);
    }
    notify('success', 'CSV Exported', 'Analytical summary exported to CSV.');
  };

  return (
    <PageTransition className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800/80">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Analysis Report Generation
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Compile dataset profiling, wrangling deltas, EDA, supervised evaluation, confusion matrix, anomalies, and clusters into downloadable PDF or CSV reports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCsvSummary}
            className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:border-cyan-500 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Full PDF Report</span>
          </button>
        </div>
      </div>

      {/* Report Sections Preview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6 space-y-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-500" />
            <span>01. Dataset &amp; Cleaning Summary</span>
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Source: <span className="font-mono">{datasetName}</span> ({validation.rowCount} rows × {validation.columnCount} columns, {validation.completenessPct}% completeness).
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {wranglingResult
              ? `Wrangling removed ${wranglingResult.duplicatesRemoved} duplicates, handled ${wranglingResult.missingImputed} missing values, and processed ${wranglingResult.outliersDetected} outliers.`
              : 'Wrangling pipeline has not been executed yet; reporting raw dataset statistics.'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6 space-y-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            02. EDA &amp; Feature Overview
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Numeric parameters profiled: <span className="font-mono">{validation.numericFeatures.join(', ')}</span>.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Identifier columns excluded from modeling: {validation.identifierColumns.join(', ') || 'None'}.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6 space-y-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            03. Supervised ML &amp; Confusion Matrix
          </h2>
          {evaluations.length > 0 ? (
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1 font-mono tabular-nums">
              {evaluations.map((ev) => (
                <li key={ev.modelId}>
                  {ev.modelName}: Acc {(ev.accuracy * 100).toFixed(2)}% · Macro F1 {(ev.macroAvg.f1Score * 100).toFixed(2)}% · CV {(ev.cvMean * 100).toFixed(2)}%
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No supervised classifiers trained yet. Train models in Machine Learning Lab to include evaluation tables and confusion matrices.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6 space-y-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            04. Anomaly &amp; Clustering Insights
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {anomalyResult
              ? `Isolation Forest: ${anomalyResult.anomalyCount} unusual objects flagged across ${anomalyResult.totalCount} records (threshold ${anomalyResult.thresholdScore}).`
              : 'Anomaly detection not yet run.'}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {clusteringResult
              ? `K-Means++ (k=${clusteringResult.k}): Silhouette Score ${clusteringResult.silhouetteScore} with ${(clusteringResult.explainedVariance[0] + clusteringResult.explainedVariance[1]).toFixed(1)}% 2D PCA variance.`
              : 'K-Means clustering not yet run.'}
          </p>
        </div>
      </div>
    </PageTransition>
  );
};
