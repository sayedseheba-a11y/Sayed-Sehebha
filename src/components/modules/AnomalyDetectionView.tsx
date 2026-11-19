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
import { Download, Play, Search } from 'lucide-react';
import { useOrbitMine } from '../../context/OrbitMineContext';
import { exportRecordsToCsv } from '../../engine/dataPipeline';
import { PageTransition, TechnicalTooltip } from '../common/MotionPrimitives';

export const AnomalyDetectionView: React.FC = () => {
  const {
    validation,
    anomalyResult,
    anomalyContamination,
    setAnomalyContamination,
    executeAnomalyDetection,
  } = useOrbitMine();

  const numericFeatures = useMemo(
    () => validation.numericFeatures.filter((f) => !f.endsWith('_encoded')),
    [validation.numericFeatures]
  );

  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(() =>
    numericFeatures.slice(0, 6)
  );
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ANOMALY' | 'NORMAL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const toggleFeature = (f: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(f) ? prev.filter((item) => item !== f) : [...prev, f]
    );
  };

  const filteredRecords = useMemo(() => {
    if (!anomalyResult) return [];
    const q = searchQuery.trim().toLowerCase();
    return anomalyResult.records
      .filter((r) => {
        if (statusFilter === 'ANOMALY' && !r.isAnomaly) return false;
        if (statusFilter === 'NORMAL' && r.isAnomaly) return false;
        if (q) {
          return (
            r.object_name.toLowerCase().includes(q) ||
            r.norad_id.toLowerCase().includes(q) ||
            r.object_type.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => b.anomalyScore - a.anomalyScore);
  }, [anomalyResult, statusFilter, searchQuery]);

  const handleExportAnomalies = () => {
    if (!anomalyResult) return;
    const rows = filteredRecords.map((r) => ({
      norad_id: r.norad_id,
      object_name: r.object_name,
      object_type: r.object_type,
      anomaly_score: r.anomalyScore,
      status: r.isAnomaly ? 'ANOMALY' : 'NORMAL',
      mean_altitude_km: r.mean_altitude_km,
      inclination_deg: r.inclination_deg,
      eccentricity: r.eccentricity,
      bstar_drag: r.bstar_drag,
      rcs_m2: r.rcs_m2,
      deviation_summary: r.reasonSummary,
    }));
    exportRecordsToCsv(rows as never, `orbitmine_anomalies_${Date.now()}.csv`);
  };

  return (
    <PageTransition className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800/80">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Smart Orbital Anomaly Detection (Isolation Forest)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Identify statistically unusual orbital elements via recursive random tree isolation—measuring parameter rarity rather than collision risk.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportAnomalies}
            disabled={!anomalyResult}
            className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:border-cyan-500 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => executeAnomalyDetection(selectedFeatures, anomalyContamination)}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Run Isolation Forest</span>
          </button>
        </div>
      </div>

      {/* Controls + Score Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6 space-y-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Isolation Forest Parameters
          </h2>

          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-600 dark:text-slate-300">
                <TechnicalTooltip
                  term="Contamination Rate"
                  explanation="Expected proportion of statistical outliers in the orbital catalogue used to calibrate the anomaly score cutoff threshold."
                />
              </span>
              <span className="font-mono tabular-nums font-semibold text-cyan-500">
                {(anomalyContamination * 100).toFixed(1)}%
              </span>
            </div>
            <input
              type="range"
              min={0.01}
              max={0.2}
              step={0.01}
              value={anomalyContamination}
              onChange={(e) => setAnomalyContamination(Number(e.target.value))}
              className="w-full accent-cyan-500"
            />
          </div>

          <div>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">
              Orbital Features Included ({selectedFeatures.length})
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

          {anomalyResult && (
            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div>
                <p className="text-slate-500 dark:text-slate-400">Scanned</p>
                <p className="font-mono tabular-nums font-bold text-slate-900 dark:text-white text-base">
                  {anomalyResult.totalCount}
                </p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">Flagged</p>
                <p className="font-mono tabular-nums font-bold text-amber-500 text-base">
                  {anomalyResult.anomalyCount}
                </p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">Cutoff</p>
                <p className="font-mono tabular-nums font-bold text-cyan-500 text-base">
                  {anomalyResult.thresholdScore}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Anomaly Score Distribution */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
            Anomaly Score Distribution
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Scores closer to 1.0 indicate shorter isolation tree path lengths (unusual parameter combinations)
          </p>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={anomalyResult?.scoreHistogram ?? []}
                margin={{ top: 8, right: 12, left: -12, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis
                  dataKey="bin"
                  tick={{ fill: '#94A3B8', fontSize: 10 }}
                  angle={-20}
                  textAnchor="end"
                  height={48}
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
                <Bar dataKey="normal" stackId="a" fill="#06B6D4" name="Normal" />
                <Bar dataKey="anomaly" stackId="a" fill="#F59E0B" name="Anomaly" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Filterable Flagged Records Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#070B16] border border-slate-200 dark:border-slate-800 w-fit">
            {(['ALL', 'ANOMALY', 'NORMAL'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  statusFilter === status
                    ? 'bg-white dark:bg-cyan-500/20 text-slate-900 dark:text-cyan-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter object or NORAD ID..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#070B16] text-xs"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="py-2.5 pr-3 font-medium">Object</th>
                <th className="py-2.5 px-2.5 font-medium">Status</th>
                <th className="py-2.5 px-2.5 font-medium text-right">Score</th>
                <th className="py-2.5 px-2.5 font-medium text-right">Alt (km)</th>
                <th className="py-2.5 px-2.5 font-medium text-right">Inc (°)</th>
                <th className="py-2.5 px-2.5 font-medium text-right">Ecc</th>
                <th className="py-2.5 pl-3 font-medium">Contributing Orbital Deviation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredRecords.slice(0, 25).map((r) => (
                <tr key={`${r.norad_id}-${r.index}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="py-2.5 pr-3">
                    <p className="font-medium text-slate-900 dark:text-white">{r.object_name}</p>
                    <p className="text-[11px] font-mono text-slate-400">
                      NORAD {r.norad_id} · {r.object_type}
                    </p>
                  </td>
                  <td className="py-2.5 px-2.5 font-medium">
                    <span className={r.isAnomaly ? 'text-amber-500' : 'text-emerald-500'}>
                      {r.isAnomaly ? '▲ Anomaly' : '● Normal'}
                    </span>
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono tabular-nums font-semibold">
                    {r.anomalyScore.toFixed(4)}
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono tabular-nums">
                    {r.mean_altitude_km.toFixed(1)}
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono tabular-nums">
                    {r.inclination_deg.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono tabular-nums">
                    {r.eccentricity.toFixed(4)}
                  </td>
                  <td className="py-2.5 pl-3 text-slate-600 dark:text-slate-300 max-w-md">
                    {r.reasonSummary}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageTransition>
  );
};
