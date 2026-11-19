import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { useOrbitMine } from '../../context/OrbitMineContext';
import { buildHistogram, computePearsonCorrelationMatrix } from '../../engine/eda';
import { PageTransition, TechnicalTooltip } from '../common/MotionPrimitives';

export const EdaView: React.FC = () => {
  const { activeRecords, validation } = useOrbitMine();

  const numericFeatures = useMemo(
    () => validation.numericFeatures.filter((f) => !f.endsWith('_encoded')),
    [validation.numericFeatures]
  );

  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [histFeature, setHistFeature] = useState<string>(
    numericFeatures.includes('mean_altitude_km') ? 'mean_altitude_km' : numericFeatures[0] ?? 'mean_altitude_km'
  );
  const [scatterX, setScatterX] = useState<string>(
    numericFeatures.includes('mean_altitude_km') ? 'mean_altitude_km' : numericFeatures[0] ?? 'mean_altitude_km'
  );
  const [scatterY, setScatterY] = useState<string>(
    numericFeatures.includes('inclination_deg') ? 'inclination_deg' : numericFeatures[1] ?? 'inclination_deg'
  );

  const filteredRecords = useMemo(() => {
    if (categoryFilter === 'ALL') return activeRecords;
    return activeRecords.filter(
      (r) => String(r.object_type ?? '').toUpperCase() === categoryFilter
    );
  }, [activeRecords, categoryFilter]);

  const histogramData = useMemo(
    () => buildHistogram(filteredRecords, histFeature, 12),
    [filteredRecords, histFeature]
  );

  const eccentricityHist = useMemo(
    () => buildHistogram(filteredRecords, 'eccentricity', 10),
    [filteredRecords]
  );

  const scatterByType = useMemo(() => {
    const groups: Record<string, Array<{ x: number; y: number; name: string }>> = {
      PAYLOAD: [],
      'ROCKET BODY': [],
      DEBRIS: [],
    };
    filteredRecords.forEach((r) => {
      const xv = Number(r[scatterX]);
      const yv = Number(r[scatterY]);
      if (Number.isNaN(xv) || Number.isNaN(yv)) return;
      const t = String(r.object_type ?? 'DEBRIS').toUpperCase();
      const key = t.includes('PAYLOAD') ? 'PAYLOAD' : t.includes('ROCKET') ? 'ROCKET BODY' : 'DEBRIS';
      groups[key].push({ x: xv, y: yv, name: String(r.object_name ?? r.norad_id) });
    });
    return groups;
  }, [filteredRecords, scatterX, scatterY]);

  const corrFeatures = useMemo(() => numericFeatures.slice(0, 8), [numericFeatures]);
  const correlation = useMemo(
    () => computePearsonCorrelationMatrix(filteredRecords, corrFeatures),
    [filteredRecords, corrFeatures]
  );

  const corrColor = (val: number) => {
    if (val >= 0.7) return 'bg-cyan-500/80 text-white';
    if (val >= 0.35) return 'bg-cyan-500/35 text-slate-900 dark:text-cyan-100';
    if (val <= -0.7) return 'bg-amber-500/80 text-white';
    if (val <= -0.35) return 'bg-amber-500/35 text-slate-900 dark:text-amber-100';
    return 'bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300';
  };

  return (
    <PageTransition className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800/80">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Exploratory Orbital Data Analysis
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Inspect Keplerian parameter distributions, altitude vs. inclination structure, eccentricity, and feature correlations.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#0C1222] border border-slate-200 dark:border-slate-800 w-fit">
          {['ALL', 'PAYLOAD', 'ROCKET BODY', 'DEBRIS'].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                categoryFilter === cat
                  ? 'bg-white dark:bg-cyan-500/20 text-slate-900 dark:text-cyan-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Scatter Plot + Dynamic Histogram */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Bivariate Orbital Scatter Plot
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Compare orbital regimes and class separability across parameter pairs
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <select
                value={scatterX}
                onChange={(e) => setScatterX(e.target.value)}
                aria-label="Scatter X axis"
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#070B16] font-mono text-xs"
              >
                {numericFeatures.map((f) => (
                  <option key={f} value={f}>
                    X: {f}
                  </option>
                ))}
              </select>
              <select
                value={scatterY}
                onChange={(e) => setScatterY(e.target.value)}
                aria-label="Scatter Y axis"
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#070B16] font-mono text-xs"
              >
                {numericFeatures.map((f) => (
                  <option key={f} value={f}>
                    Y: {f}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 16, left: -6, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name={scatterX}
                  tick={{ fill: '#94A3B8', fontSize: 11 }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name={scatterY}
                  tick={{ fill: '#94A3B8', fontSize: 11 }}
                />
                <ZAxis range={[26, 26]} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderColor: '#1E293B',
                    borderRadius: '8px',
                    color: '#F8FAFC',
                    fontSize: '12px',
                  }}
                />
                <Scatter name="Payload" data={scatterByType.PAYLOAD} fill="#06B6D4" fillOpacity={0.78} />
                <Scatter name="Rocket Body" data={scatterByType['ROCKET BODY']} fill="#6366F1" fillOpacity={0.78} />
                <Scatter name="Debris" data={scatterByType.DEBRIS} fill="#F59E0B" fillOpacity={0.78} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-5 text-xs mt-2">
            <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" /> Payload
            </span>
            <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Rocket Body
            </span>
            <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Debris
            </span>
          </div>
        </div>

        {/* Interactive Feature Histogram */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Parameter Distribution
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Frequency across {filteredRecords.length} objects
              </p>
            </div>
            <select
              value={histFeature}
              onChange={(e) => setHistFeature(e.target.value)}
              aria-label="Histogram feature"
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#070B16] font-mono text-xs max-w-[165px]"
            >
              {numericFeatures.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogramData} margin={{ top: 10, right: 8, left: -12, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis
                  dataKey="range"
                  tick={{ fill: '#94A3B8', fontSize: 10 }}
                  angle={-28}
                  textAnchor="end"
                  height={55}
                />
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
                <Bar dataKey="count" fill="#06B6D4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Eccentricity & Correlation Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
            <TechnicalTooltip
              term="Eccentricity Distribution"
              explanation="Orbital eccentricity measures how circular (0.0) versus elongated (>0.2) an object's trajectory is."
            />
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Separates circular operational constellations from GTO transfer stages
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={eccentricityHist} margin={{ top: 8, right: 8, left: -12, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis
                  dataKey="range"
                  tick={{ fill: '#94A3B8', fontSize: 10 }}
                  angle={-25}
                  textAnchor="end"
                  height={50}
                />
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
                <Bar dataKey="count" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pearson Correlation Heatmap */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Pearson Correlation Heatmap
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Linear correlation coefficients (-1.00 to +1.00) computed on filtered records
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-mono border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="text-left p-1 text-slate-400 font-normal">Feature</th>
                  {correlation.features.map((f) => (
                    <th key={f} className="p-1 text-center text-slate-500 dark:text-slate-400 font-normal max-w-[72px] truncate" title={f}>
                      {f.replace('_km', '').replace('_deg', '').replace('_rev_day', '').replace('_min', '')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {correlation.features.map((rowFeat, i) => (
                  <tr key={rowFeat}>
                    <td className="p-1 text-slate-600 dark:text-slate-300 truncate max-w-[110px]" title={rowFeat}>
                      {rowFeat}
                    </td>
                    {correlation.matrix[i].map((val, j) => (
                      <td
                        key={j}
                        className={`p-1.5 text-center rounded tabular-nums ${corrColor(val)}`}
                        title={`${rowFeat} vs ${correlation.features[j]}: ${val}`}
                      >
                        {val.toFixed(2)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageTransition>
  );
};
