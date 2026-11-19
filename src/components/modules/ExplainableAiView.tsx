import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { GitBranch, Info } from 'lucide-react';
import { useOrbitMine } from '../../context/OrbitMineContext';
import { explainPrediction } from '../../engine/explainability';
import { EmptyStateCard, PageTransition, TechnicalTooltip } from '../common/MotionPrimitives';

export const ExplainableAiView: React.FC = () => {
  const {
    activeRecords,
    trainedModels,
    selectedModel,
    setSelectedModelId,
    setActiveNav,
  } = useOrbitMine();

  const [selectedObjectIdx, setSelectedObjectIdx] = useState<number>(0);

  const sampleObjects = useMemo(() => activeRecords.slice(0, 60), [activeRecords]);

  const localExplanation = useMemo(() => {
    if (!selectedModel || sampleObjects.length === 0) return null;
    const obj = sampleObjects[Math.min(selectedObjectIdx, sampleObjects.length - 1)];
    return {
      record: obj,
      explanation: explainPrediction(selectedModel, obj),
    };
  }, [selectedModel, sampleObjects, selectedObjectIdx]);

  if (trainedModels.length === 0 || !selectedModel) {
    return (
      <PageTransition>
        <EmptyStateCard
          icon={<GitBranch className="w-5 h-5" />}
          title="Train a Model to Unlock SHAP Explanations"
          description="Explainable AI inspects real trained model boundaries. Train a Decision Tree, Random Forest, or Logistic Regression classifier first."
          actionLabel="Go to Machine Learning Lab"
          onAction={() => setActiveNav('ml-lab')}
        />
      </PageTransition>
    );
  }

  const globalImportances = selectedModel.evaluation.featureImportances.map((f) => ({
    feature: f.feature,
    importancePct: Number((f.importance * 100).toFixed(2)),
  }));

  const localChartData =
    localExplanation?.explanation.contributions.map((c) => ({
      feature: `${c.feature} (${c.featureValue})`,
      contributionPct: Number((c.shapValue * 100).toFixed(2)),
    })) ?? [];

  return (
    <PageTransition className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800/80">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Explainable AI (SHAP Feature Attribution)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Inspect global feature drivers and instance-level Shapley contributions explaining Payload, Rocket Body, and Debris predictions.
          </p>
        </div>

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

      {/* Global Importance + Local SHAP Explanation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Global SHAP / Feature Importance */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
            <TechnicalTooltip
              term="Global Feature Importance"
              explanation="Relative share of predictive split gain or standardized coefficient magnitude contributed by each orbital parameter across the training distribution."
            />
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Overall orbital parameter influence for {selectedModel.modelName}
          </p>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={globalImportances}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 24, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis type="number" tick={{ fill: '#94A3B8', fontSize: 11 }} unit="%" />
                <YAxis
                  type="category"
                  dataKey="feature"
                  width={120}
                  tick={{ fill: '#94A3B8', fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderColor: '#1E293B',
                    borderRadius: '8px',
                    color: '#F8FAFC',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="importancePct" fill="#06B6D4" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Local Instance SHAP Explanation */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Local Object SHAP Contribution Plot
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Additive probability shifts relative to training baseline prior
              </p>
            </div>

            <select
              value={selectedObjectIdx}
              onChange={(e) => setSelectedObjectIdx(Number(e.target.value))}
              aria-label="Select catalogue object to explain"
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#070B16] text-xs font-mono max-w-xs"
            >
              {sampleObjects.map((obj, idx) => (
                <option key={`${obj.norad_id}-${idx}`} value={idx}>
                  {obj.object_name} ({obj.object_type})
                </option>
              ))}
            </select>
          </div>

          {localExplanation && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-3 border-y border-slate-100 dark:border-slate-800/80 text-xs">
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Predicted Class</p>
                  <p className="font-bold text-cyan-600 dark:text-cyan-400 text-sm mt-0.5">
                    {localExplanation.explanation.predictedClass}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Actual Catalogue Label</p>
                  <p className="font-semibold text-slate-900 dark:text-white text-sm mt-0.5">
                    {String(localExplanation.record.object_type)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Baseline Prior Probability</p>
                  <p className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white text-sm mt-0.5">
                    {(localExplanation.explanation.baseValue * 100).toFixed(1)}%
                  </p>
                </div>
              </div>

              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={localChartData}
                    layout="vertical"
                    margin={{ top: 4, right: 20, left: 32, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                    <XAxis type="number" tick={{ fill: '#94A3B8', fontSize: 11 }} unit="%" />
                    <YAxis
                      type="category"
                      dataKey="feature"
                      width={150}
                      tick={{ fill: '#94A3B8', fontSize: 10 }}
                    />
                    <ReferenceLine x={0} stroke="#64748B" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        borderColor: '#1E293B',
                        borderRadius: '8px',
                        color: '#F8FAFC',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="contributionPct" radius={[3, 3, 3, 3]}>
                      {localChartData.map((entry, idx) => (
                        <Cell
                          key={idx}
                          fill={entry.contributionPct >= 0 ? '#06B6D4' : '#F59E0B'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-lg bg-slate-50 dark:bg-[#070B16] border border-slate-200 dark:border-slate-800 p-4 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                <span className="font-semibold text-slate-900 dark:text-white block mb-1">
                  Plain-Language Explanation
                </span>
                {localExplanation.explanation.narrative}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Model Limitations Panel */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-cyan-500 mt-0.5 shrink-0" />
          <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Methodological Limitations &amp; Interpretability Caveats
            </h3>
            <p>
              1. Feature correlation sensitivity: Orbital features such as apogee, perigee, mean altitude, and orbital period are physically coupled via Kepler&apos;s third law; marginal SHAP attributions split credit across correlated parameters.
            </p>
            <p>
              2. Class overlap in transfer orbits: Spent rocket upper stages and inactive payloads sharing GTO/HEO regimes may exhibit overlapping Radar Cross Section (RCS) and drag signatures.
            </p>
            <p>
              3. Catalogue scope: Explanations describe statistical decision boundaries learned from the active dataset rather than physical spacecraft telemetry internals.
            </p>
          </div>
        </div>
      </div>
    </PageTransition>
  );
};
