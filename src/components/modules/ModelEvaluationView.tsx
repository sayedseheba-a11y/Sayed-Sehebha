import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Cpu } from 'lucide-react';
import { useOrbitMine } from '../../context/OrbitMineContext';
import { EmptyStateCard, PageTransition, TechnicalTooltip } from '../common/MotionPrimitives';

export const ModelEvaluationView: React.FC = () => {
  const {
    trainedModels,
    selectedModel,
    setSelectedModelId,
    setActiveNav,
  } = useOrbitMine();

  if (trainedModels.length === 0 || !selectedModel) {
    return (
      <PageTransition>
        <EmptyStateCard
          icon={<Cpu className="w-5 h-5" />}
          title="No Trained Model Available for Evaluation"
          description="ORBITMINE never fabricates evaluation scores. Train at least one classifier in the Machine Learning Lab to inspect real accuracy, confusion matrices, ROC-AUC, and cross-validation metrics."
          actionLabel="Open Machine Learning Lab"
          onAction={() => setActiveNav('ml-lab')}
        />
      </PageTransition>
    );
  }

  const ev = selectedModel.evaluation;

  const cvChartData = ev.cvScores.map((score, idx) => ({
    fold: `Fold ${idx + 1}`,
    accuracy: Number((score * 100).toFixed(2)),
  }));

  const comparisonData = trainedModels.map((m) => ({
    model: m.modelName.replace(' (CART)', '').replace(' (L2)', ''),
    Accuracy: Number((m.evaluation.accuracy * 100).toFixed(2)),
    MacroF1: Number((m.evaluation.macroAvg.f1Score * 100).toFixed(2)),
    WeightedF1: Number((m.evaluation.weightedAvg.f1Score * 100).toFixed(2)),
  }));

  const maxCmVal = Math.max(1, ...ev.confusionMatrix.flat());

  return (
    <PageTransition className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800/80">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Model Evaluation &amp; Classification Diagnostics
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Hold-out test set (<span className="font-mono tabular-nums">{ev.testCount}</span> objects) · Trained on{' '}
            <span className="font-mono tabular-nums">{ev.trainCount}</span> objects
          </p>
        </div>

        {/* Model Selector */}
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#0C1222] border border-slate-200 dark:border-slate-800 w-fit">
          {trainedModels.map((m) => (
            <button
              key={m.algorithm}
              type="button"
              onClick={() => setSelectedModelId(m.algorithm)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                selectedModel.algorithm === m.algorithm
                  ? 'bg-white dark:bg-cyan-500/20 text-slate-900 dark:text-cyan-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {m.modelName}
            </button>
          ))}
        </div>
      </div>

      {/* Top Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Test Accuracy</p>
          <p className="text-2xl font-mono tabular-nums font-bold text-cyan-600 dark:text-cyan-400 mt-1.5">
            {(ev.accuracy * 100).toFixed(2)}%
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            <TechnicalTooltip
              term="Macro Avg F1"
              explanation="Unweighted arithmetic mean of F1 across all classes, treating minority classes (e.g. Debris or Rocket Bodies) equally."
            />
          </p>
          <p className="text-2xl font-mono tabular-nums font-bold text-slate-900 dark:text-white mt-1.5">
            {(ev.macroAvg.f1Score * 100).toFixed(2)}%
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            <TechnicalTooltip
              term="Weighted Avg F1"
              explanation="Support-weighted F1 average across classes, reflecting overall catalogue class frequencies."
            />
          </p>
          <p className="text-2xl font-mono tabular-nums font-bold text-slate-900 dark:text-white mt-1.5">
            {(ev.weightedAvg.f1Score * 100).toFixed(2)}%
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Macro ROC-AUC (OvR)</p>
          <p className="text-2xl font-mono tabular-nums font-bold text-indigo-500 mt-1.5">
            {ev.rocAucMacro !== null ? ev.rocAucMacro.toFixed(4) : 'N/A'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">CV Mean ± Std</p>
          <p className="text-2xl font-mono tabular-nums font-bold text-emerald-500 mt-1.5">
            {(ev.cvMean * 100).toFixed(1)}% <span className="text-xs font-normal text-slate-400">±{(ev.cvStd * 100).toFixed(1)}%</span>
          </p>
        </div>
      </div>

      {/* Classification Report Table + Confusion Matrix Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
            Classification Report (Per-Class vs. Macro vs. Weighted)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Macro average weights each orbital class equally; weighted average weights by true class support.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="py-2 pr-3 font-medium">Class / Summary</th>
                  <th className="py-2 px-3 font-medium text-right">Precision</th>
                  <th className="py-2 px-3 font-medium text-right">Recall</th>
                  <th className="py-2 px-3 font-medium text-right">F1-Score</th>
                  <th className="py-2 px-3 font-medium text-right">ROC-AUC</th>
                  <th className="py-2 pl-3 font-medium text-right">Support</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {ev.classMetrics.map((cm) => (
                  <tr key={cm.label}>
                    <td className="py-2.5 pr-3 font-semibold text-slate-900 dark:text-white">
                      {cm.label}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {(cm.precision * 100).toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {(cm.recall * 100).toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-cyan-600 dark:text-cyan-400">
                      {(cm.f1Score * 100).toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {cm.rocAuc !== null ? cm.rocAuc.toFixed(3) : '—'}
                    </td>
                    <td className="py-2.5 pl-3 text-right font-mono tabular-nums text-slate-500">
                      {cm.support}
                    </td>
                  </tr>
                ))}

                <tr className="bg-slate-50 dark:bg-slate-800/40 font-medium">
                  <td className="py-2.5 pr-3 text-slate-700 dark:text-slate-200">Macro Average</td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                    {(ev.macroAvg.precision * 100).toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                    {(ev.macroAvg.recall * 100).toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                    {(ev.macroAvg.f1Score * 100).toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                    {ev.rocAucMacro !== null ? ev.rocAucMacro.toFixed(3) : '—'}
                  </td>
                  <td className="py-2.5 pl-3 text-right font-mono tabular-nums">{ev.testCount}</td>
                </tr>

                <tr className="bg-slate-50 dark:bg-slate-800/40 font-medium">
                  <td className="py-2.5 pr-3 text-slate-700 dark:text-slate-200">Weighted Average</td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                    {(ev.weightedAvg.precision * 100).toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                    {(ev.weightedAvg.recall * 100).toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                    {(ev.weightedAvg.f1Score * 100).toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums">—</td>
                  <td className="py-2.5 pl-3 text-right font-mono tabular-nums">{ev.testCount}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Confusion Matrix Heatmap */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
            Confusion Matrix Heatmap
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Rows = Actual Class · Columns = Predicted Class
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono border-separate border-spacing-1.5">
              <thead>
                <tr>
                  <th className="p-1 text-left text-slate-400 font-normal">True \ Pred</th>
                  {ev.labels.map((lbl) => (
                    <th key={lbl} className="p-1 text-center text-slate-500 dark:text-slate-400 font-medium">
                      {lbl.slice(0, 7)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ev.confusionMatrix.map((row, rIdx) => (
                  <tr key={ev.labels[rIdx]}>
                    <td className="p-1 font-medium text-slate-700 dark:text-slate-300">
                      {ev.labels[rIdx].slice(0, 9)}
                    </td>
                    {row.map((cell, cIdx) => {
                      const intensity = cell / maxCmVal;
                      const isDiag = rIdx === cIdx;
                      const bg = isDiag
                        ? `rgba(6, 182, 212, ${0.18 + intensity * 0.72})`
                        : cell > 0
                        ? `rgba(245, 158, 11, ${0.15 + intensity * 0.6})`
                        : 'rgba(148, 163, 184, 0.08)';
                      return (
                        <td
                          key={cIdx}
                          style={{ backgroundColor: bg }}
                          className="p-3 text-center rounded-md font-bold tabular-nums text-slate-900 dark:text-white"
                        >
                          {cell}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Cross-Validation Scores & Model Comparison Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
            Stratified K-Fold Cross-Validation Scores
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Fold-by-fold accuracy across training partitions
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cvChartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="fold" tick={{ fill: '#94A3B8', fontSize: 11 }} />
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
                <Bar dataKey="accuracy" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
            Cross-Model Performance Comparison
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Comparison of Accuracy, Macro F1, and Weighted F1 across trained classifiers
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="model" tick={{ fill: '#94A3B8', fontSize: 11 }} />
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
                <Bar dataKey="WeightedF1" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </PageTransition>
  );
};
