import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { Info, Play } from 'lucide-react';
import { useOrbitMine } from '../../context/OrbitMineContext';
import { PageTransition, TechnicalTooltip } from '../common/MotionPrimitives';

const CLUSTER_COLORS = ['#06B6D4', '#6366F1', '#F59E0B', '#10B981', '#EC4899', '#8B5CF6', '#38BDF8', '#FB7185'];

export const PatternDiscoveryView: React.FC = () => {
  const {
    validation,
    clusteringResult,
    clusterK,
    setClusterK,
    executeClustering,
  } = useOrbitMine();

  const numericFeatures = useMemo(
    () => validation.numericFeatures.filter((f) => !f.endsWith('_encoded')),
    [validation.numericFeatures]
  );

  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(() =>
    numericFeatures.slice(0, 6)
  );

  const toggleFeature = (f: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(f) ? prev.filter((item) => item !== f) : [...prev, f]
    );
  };

  const clusterGroups = useMemo(() => {
    if (!clusteringResult) return [];
    return Array.from({ length: clusteringResult.k }, (_, c) => ({
      clusterId: c,
      name: `Cluster ${c + 1}`,
      color: CLUSTER_COLORS[c % CLUSTER_COLORS.length],
      data: clusteringResult.points.filter((p) => p.clusterId === c),
    }));
  }, [clusteringResult]);

  const sizeDistribution = useMemo(
    () =>
      clusteringResult?.summaries.map((s) => ({
        name: `C${s.clusterId + 1}`,
        size: s.size,
        color: CLUSTER_COLORS[s.clusterId % CLUSTER_COLORS.length],
      })) ?? [],
    [clusteringResult]
  );

  return (
    <PageTransition className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800/80">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Orbital Pattern Discovery (K-Means + PCA)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Discover latent orbital structure via unsupervised K-Means++ clustering projected onto 2D Principal Component coordinates.
          </p>
        </div>

        <button
          type="button"
          onClick={() => executeClustering(selectedFeatures, clusterK)}
          className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 w-fit"
        >
          <Play className="w-3.5 h-3.5" />
          <span>Discover Clusters (k={clusterK})</span>
        </button>
      </div>

      {/* Controls + PCA Scatter Plot */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6 space-y-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Clustering Configuration
          </h2>

          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-600 dark:text-slate-300">Number of Clusters (k)</span>
              <span className="font-mono tabular-nums font-semibold text-cyan-500">{clusterK}</span>
            </div>
            <input
              type="range"
              min={2}
              max={8}
              step={1}
              value={clusterK}
              onChange={(e) => setClusterK(Number(e.target.value))}
              className="w-full accent-cyan-500"
            />
          </div>

          <div>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">
              Standardized Feature Matrix ({selectedFeatures.length})
            </p>
            <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto">
              {numericFeatures.map((f) => (
                <label
                  key={f}
                  className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer truncate"
                >
                  <input
                    type="checkbox"
                    checked={selectedFeatures.includes(f)}
                    onChange={() => toggleFeature(f)}
                    className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                  />
                  <span className="truncate font-mono">{f}</span>
                </label>
              ))}
            </div>
          </div>

          {clusteringResult && (
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div>
                <p className="text-slate-500 dark:text-slate-400">
                  <TechnicalTooltip
                    term="Silhouette Score"
                    explanation="Measures cluster cohesion vs. separation from -1 to +1. Values above 0.45 indicate well-separated orbital clusters."
                  />
                </p>
                <p className="font-mono tabular-nums font-bold text-cyan-500 text-lg mt-0.5">
                  {clusteringResult.silhouetteScore}
                </p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">2D PCA Variance</p>
                <p className="font-mono tabular-nums font-bold text-slate-900 dark:text-white text-lg mt-0.5">
                  {(clusteringResult.explainedVariance[0] + clusteringResult.explainedVariance[1]).toFixed(1)}%
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 2D PCA Cluster Scatter Plot */}
        <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                PCA 2D Cluster Projection
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {clusteringResult
                  ? `PC1 (${clusteringResult.explainedVariance[0]}% var) vs. PC2 (${clusteringResult.explainedVariance[1]}% var)`
                  : 'Run K-Means clustering to project orbital groupings onto principal components'}
              </p>
            </div>
          </div>

          {clusteringResult ? (
            <>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 16, left: -6, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                    <XAxis type="number" dataKey="pc1" name="PC1" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                    <YAxis type="number" dataKey="pc2" name="PC2" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                    <ZAxis range={[28, 28]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        borderColor: '#1E293B',
                        borderRadius: '8px',
                        color: '#F8FAFC',
                        fontSize: '12px',
                      }}
                    />
                    {clusterGroups.map((g) => (
                      <Scatter
                        key={g.clusterId}
                        name={g.name}
                        data={g.data}
                        fill={g.color}
                        fillOpacity={0.82}
                      />
                    ))}
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-4 text-xs mt-2">
                {clusterGroups.map((g) => (
                  <span key={g.clusterId} className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                    {g.name} ({g.data.length})
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="h-72 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
              Click &ldquo;Discover Clusters&rdquo; to compute K-Means++ centroids and PCA projection.
            </div>
          )}
        </div>
      </div>

      {/* Cluster Size Distribution & Characteristics */}
      {clusteringResult && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
              Cluster Size Distribution
            </h2>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sizeDistribution} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                  <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#1E293B',
                      borderRadius: '8px',
                      color: '#F8FAFC',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="size" radius={[4, 4, 0, 0]}>
                    {sizeDistribution.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
              Cluster Characteristics &amp; Empirical Summary
            </h2>
            <div className="space-y-3">
              {clusteringResult.summaries.map((s) => (
                <div
                  key={s.clusterId}
                  className="p-3.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-[#070B16]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-1">
                    <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: CLUSTER_COLORS[s.clusterId % CLUSTER_COLORS.length] }}
                      />
                      Cluster {s.clusterId + 1}
                    </span>
                    <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {s.size} objects ({s.sharePct}%) · Dominant observed label: {s.dominantType}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {s.interpretation}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Unsupervised Discovery Caveat */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-5 flex items-start gap-3 text-xs text-slate-600 dark:text-slate-400">
        <Info className="w-4 h-4 text-cyan-500 mt-0.5 shrink-0" />
        <p>
          Important Methodological Note: K-Means clusters are discovered purely from mathematical proximity in standardized feature space. They do not automatically correspond to official orbital regime classifications (LEO, MEO, GEO, HEO) or operational satellite missions without domain validation.
        </p>
      </div>
    </PageTransition>
  );
};
