import React, { useEffect, useState } from 'react';
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
import { Download, Radar, Sparkles } from 'lucide-react';
import { useOrbitMine } from '../../context/OrbitMineContext';
import { explainPrediction } from '../../engine/explainability';
import { LocalExplanation } from '../../types/orbit';
import { exportPredictionPdf } from '../../utils/reportGenerator';
import { EmptyStateCard, PageTransition } from '../common/MotionPrimitives';

const PRESET_ORBITS: Array<{
  label: string;
  values: Record<string, number>;
}> = [
  {
    label: 'LEO Constellation Payload',
    values: {
      apogee_km: 560,
      perigee_km: 545,
      mean_altitude_km: 552.5,
      inclination_deg: 53.2,
      eccentricity: 0.0011,
      mean_motion_rev_day: 15.05,
      orbital_period_min: 95.68,
      bstar_drag: 0.00012,
      rcs_m2: 3.4,
    },
  },
  {
    label: 'High-Drag LEO Debris',
    values: {
      apogee_km: 890,
      perigee_km: 610,
      mean_altitude_km: 750,
      inclination_deg: 82.4,
      eccentricity: 0.0196,
      mean_motion_rev_day: 14.42,
      orbital_period_min: 99.86,
      bstar_drag: 0.00195,
      rcs_m2: 0.045,
    },
  },
  {
    label: 'GTO Rocket Upper Stage',
    values: {
      apogee_km: 35650,
      perigee_km: 260,
      mean_altitude_km: 17955,
      inclination_deg: 27.1,
      eccentricity: 0.727,
      mean_motion_rev_day: 2.28,
      orbital_period_min: 631.5,
      bstar_drag: 0.00042,
      rcs_m2: 9.8,
    },
  },
];

export const PredictionView: React.FC = () => {
  const { trainedModels, selectedModel, setSelectedModelId, setActiveNav } = useOrbitMine();
  const [inputs, setInputs] = useState<Record<string, number>>(PRESET_ORBITS[0].values);
  const [result, setResult] = useState<LocalExplanation | null>(null);

  useEffect(() => {
    if (selectedModel) {
      const aligned: Record<string, number> = {};
      selectedModel.features.forEach((f, idx) => {
        aligned[f] = inputs[f] ?? Number(selectedModel.scaler.medians[idx]?.toFixed(4) ?? 0);
      });
      setInputs(aligned);
      setResult(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModel?.algorithm]);

  if (trainedModels.length === 0 || !selectedModel) {
    return (
      <PageTransition>
        <EmptyStateCard
          icon={<Radar className="w-5 h-5" />}
          title="No Trained Classification Model Active"
          description="To prevent fabricated predictions, ORBITMINE requires a real trained classifier before scoring unseen satellite parameters."
          actionLabel="Train Model in ML Lab"
          onAction={() => setActiveNav('ml-lab')}
        />
      </PageTransition>
    );
  }

  const handlePredict = (e: React.FormEvent) => {
    e.preventDefault();
    const explanation = explainPrediction(selectedModel, inputs);
    setResult(explanation);
  };

  const applyPreset = (values: Record<string, number>) => {
    const next = { ...inputs };
    selectedModel.features.forEach((f) => {
      if (values[f] !== undefined) next[f] = values[f];
    });
    setInputs(next);
    setResult(null);
  };

  const probEntries = result
    ? Object.entries(result.probabilities).sort((a, b) => b[1] - a[1])
    : [];

  const shapChart =
    result?.contributions.map((c) => ({
      feature: c.feature,
      contribution: Number((c.shapValue * 100).toFixed(2)),
    })) ?? [];

  return (
    <PageTransition className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800/80">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Unseen Satellite Classification &amp; SHAP Explanation
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Enter orbital elements for an unseen object to infer its category with calibrated class probabilities and local SHAP feature attributions.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#0C1222] border border-slate-200 dark:border-slate-800 w-fit">
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Parameter Input Form */}
        <form
          onSubmit={handlePredict}
          className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6 space-y-5"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Orbital Feature Inputs
            </h2>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {PRESET_ORBITS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset.values)}
                className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 hover:border-cyan-500 text-[11px] text-slate-600 dark:text-slate-300 transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            {selectedModel.features.map((feat) => (
              <div key={feat}>
                <label className="block text-[11px] font-mono text-slate-500 dark:text-slate-400 mb-1 truncate">
                  {feat}
                </label>
                <input
                  type="number"
                  step="any"
                  value={inputs[feat] ?? 0}
                  onChange={(e) =>
                    setInputs((prev) => ({
                      ...prev,
                      [feat]: Number(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#070B16] font-mono tabular-nums text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            ))}
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Predict Object Category</span>
          </button>
        </form>

        {/* Prediction & SHAP Result */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6 flex flex-col justify-between">
          {result ? (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Predicted Object Category ({selectedModel.modelName})
                  </p>
                  <p className="text-3xl font-display font-bold text-cyan-600 dark:text-cyan-400 mt-1">
                    {result.predictedClass}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => exportPredictionPdf(selectedModel.modelName, inputs, result)}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:border-cyan-500 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1.5 w-fit"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Prediction PDF</span>
                </button>
              </div>

              {/* Class Probability Bars */}
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-slate-900 dark:text-white">
                  Model Class Probability Distribution
                </p>
                {probEntries.map(([cls, prob]) => (
                  <div key={cls} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-300">{cls}</span>
                      <span className="font-mono tabular-nums text-slate-900 dark:text-white">
                        {(prob * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          cls === result.predictedClass ? 'bg-cyan-500' : 'bg-slate-400 dark:bg-slate-600'
                        }`}
                        style={{ width: `${Math.min(100, prob * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Local SHAP Chart */}
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white mb-2">
                  SHAP Feature Contributions
                </p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={shapChart} layout="vertical" margin={{ top: 4, right: 18, left: 24, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                      <XAxis type="number" tick={{ fill: '#94A3B8', fontSize: 11 }} unit="%" />
                      <YAxis type="category" dataKey="feature" width={120} tick={{ fill: '#94A3B8', fontSize: 10 }} />
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
                      <Bar dataKey="contribution" radius={[3, 3, 3, 3]}>
                        {shapChart.map((entry, idx) => (
                          <Cell key={idx} fill={entry.contribution >= 0 ? '#06B6D4' : '#F59E0B'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 dark:bg-[#070B16] border border-slate-200 dark:border-slate-800 p-3.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {result.narrative}
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[340px] flex flex-col items-center justify-center text-center px-6">
              <Radar className="w-8 h-8 text-cyan-500 mb-3 opacity-80" />
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Ready for Unseen Orbital Inference
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-sm">
                Adjust orbital parameters or select a physical preset on the left, then click &ldquo;Predict Object Category&rdquo; to inspect calibrated probabilities and SHAP attributions.
              </p>
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
};
