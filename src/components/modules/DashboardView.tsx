import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowUpRight, Database, Filter, ShieldAlert } from 'lucide-react';
import { useOrbitMine } from '../../context/OrbitMineContext';
import { buildHistogram } from '../../engine/eda';
import { AnimatedNumber, PageTransition, TechnicalTooltip } from '../common/MotionPrimitives';

const CATEGORY_COLORS: Record<string, string> = {
  PAYLOAD: '#06B6D4',
  'ROCKET BODY': '#6366F1',
  DEBRIS: '#F59E0B',
  UNKNOWN: '#64748B',
};

export const DashboardView: React.FC = () => {
  const {
    activeRecords,
    validation,
    anomalyResult,
    activities,
    isDemoData,
    setActiveNav,
    trainedModels,
  } = useOrbitMine();

  const [regimeFilter, setRegimeFilter] = useState<string>('ALL');
  const [minYear, setMinYear] = useState<number>(1980);
  const [maxYear, setMaxYear] = useState<number>(2026);

  const filteredRecords = useMemo(() => {
    return activeRecords.filter((r) => {
      const regimeMatch =
        regimeFilter === 'ALL' || String(r.orbit_regime ?? '').toUpperCase() === regimeFilter;
      const yr = Number(r.launch_year);
      const yearMatch = Number.isNaN(yr) || r.launch_year === null || (yr >= minYear && yr <= maxYear);
      return regimeMatch && yearMatch;
    });
  }, [activeRecords, regimeFilter, minYear, maxYear]);

  const counts = useMemo(() => {
    let payloads = 0;
    let rocketBodies = 0;
    let debris = 0;
    const regimeMap = new Map<string, number>();

    filteredRecords.forEach((r) => {
      const t = String(r.object_type ?? '').toUpperCase();
      if (t.includes('PAYLOAD')) payloads += 1;
      else if (t.includes('ROCKET')) rocketBodies += 1;
      else debris += 1;

      const reg = String(r.orbit_regime ?? 'LEO').toUpperCase();
      regimeMap.set(reg, (regimeMap.get(reg) ?? 0) + 1);
    });

    const pieData = [
      { name: 'PAYLOAD', value: payloads },
      { name: 'ROCKET BODY', value: rocketBodies },
      { name: 'DEBRIS', value: debris },
    ].filter((d) => d.value > 0);

    const regimeData = Array.from(regimeMap.entries()).map(([regime, count]) => ({
      regime,
      count,
    }));

    return { payloads, rocketBodies, debris, pieData, regimeData };
  }, [filteredRecords]);

  const altitudeHistogram = useMemo(
    () => buildHistogram(filteredRecords, 'mean_altitude_km', 10),
    [filteredRecords]
  );

  const filteredAnomaliesCount = useMemo(() => {
    if (!anomalyResult) return 0;
    const idSet = new Set(filteredRecords.map((r) => String(r.norad_id)));
    return anomalyResult.records.filter((a) => a.isAnomaly && idSet.has(a.norad_id)).length;
  }, [anomalyResult, filteredRecords]);

  return (
    <PageTransition className="space-y-6">
      {/* Header & Interactive Filters */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800/80">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Orbital Intelligence Overview
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isDemoData ? 'Illustrative Sample Catalogue active' : 'Uploaded CSV Catalogue active'}
            <span aria-hidden="true"> · </span>
            Showing <span className="font-mono tabular-nums">{filteredRecords.length}</span> of{' '}
            <span className="font-mono tabular-nums">{activeRecords.length}</span> records
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Regime Segmented Control */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#0C1222] border border-slate-200 dark:border-slate-800">
            {['ALL', 'LEO', 'MEO', 'GEO', 'HEO'].map((reg) => (
              <button
                key={reg}
                type="button"
                onClick={() => setRegimeFilter(reg)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  regimeFilter === reg
                    ? 'bg-white dark:bg-cyan-500/20 text-slate-900 dark:text-cyan-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {reg}
              </button>
            ))}
          </div>

          {/* Launch Year Range Filter */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <label htmlFor="dash-min-yr" className="text-slate-500 dark:text-slate-400">
              Year:
            </label>
            <input
              id="dash-min-yr"
              type="number"
              min={1957}
              max={maxYear}
              value={minYear}
              onChange={(e) => setMinYear(Number(e.target.value) || 1957)}
              className="w-14 bg-transparent font-mono tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none"
            />
            <span className="text-slate-400">–</span>
            <input
              type="number"
              min={minYear}
              max={2026}
              value={maxYear}
              onChange={(e) => setMaxYear(Number(e.target.value) || 2026)}
              aria-label="Max launch year"
              className="w-14 bg-transparent font-mono tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Total Satellite Objects</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
            <AnimatedNumber value={filteredRecords.length} />
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">Filtered catalogue</p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Payloads</p>
          <p className="text-3xl font-bold text-cyan-600 dark:text-cyan-400 mt-2">
            <AnimatedNumber value={counts.payloads} />
          </p>
          <p className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-1.5">
            {filteredRecords.length > 0 ? ((counts.payloads / filteredRecords.length) * 100).toFixed(1) : '0.0'}% share
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Rocket Bodies &amp; Debris</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
            <AnimatedNumber value={counts.rocketBodies + counts.debris} />
          </p>
          <p className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-1.5">
            {counts.rocketBodies} R/B · {counts.debris} DEB
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            <TechnicalTooltip
              term="Dataset Completeness"
              explanation="Percentage of non-missing cells across all rows and columns in the active dataset."
            />
          </p>
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
            <AnimatedNumber value={validation.completenessPct} decimals={1} suffix="%" />
          </p>
          <p className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-1.5">
            {validation.totalMissingCells} missing cells
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Detected Anomalies</p>
          <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-2">
            <AnimatedNumber value={filteredAnomaliesCount} />
          </p>
          <button
            type="button"
            onClick={() => setActiveNav('anomaly-detection')}
            className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline mt-1.5 inline-flex items-center gap-1"
          >
            <span>Inspect Isolation Forest</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Category Pie Chart */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Object Category Breakdown
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Payloads, spent rocket stages, and catalogued debris
              </p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={counts.pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={56}
                  outerRadius={88}
                  paddingAngle={3}
                >
                  {counts.pieData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={CATEGORY_COLORS[entry.name] ?? '#64748B'}
                      stroke="transparent"
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderColor: '#1E293B',
                    borderRadius: '8px',
                    color: '#F8FAFC',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-5 text-xs mt-2">
            {counts.pieData.map((d) => (
              <div key={d.name} className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-xs"
                  style={{ backgroundColor: CATEGORY_COLORS[d.name] ?? '#64748B' }}
                />
                <span className="text-slate-600 dark:text-slate-300">{d.name}</span>
                <span className="font-mono tabular-nums text-slate-900 dark:text-white font-semibold">
                  {d.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Orbital Regime Distribution */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Orbital Regime Distribution
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Object counts across Low (LEO), Medium (MEO), Geosynchronous (GEO), and High Elliptical (HEO) regimes
            </p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={counts.regimeData} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="regime" tick={{ fill: '#94A3B8', fontSize: 12 }} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 12 }} />
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

      {/* Altitude Distribution & Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Mean Orbital Altitude Distribution (km)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Binned semi-major axis altitude above Earth&apos;s mean radius
            </p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={altitudeHistogram} margin={{ top: 10, right: 16, left: -10, bottom: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis
                  dataKey="range"
                  tick={{ fill: '#94A3B8', fontSize: 10 }}
                  angle={-20}
                  textAnchor="end"
                  height={48}
                />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderColor: '#1E293B',
                    borderRadius: '8px',
                    color: '#F8FAFC',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" fill="#6366F1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Analysis Activity & Quick Launch */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Recent Analysis Activity
              </h3>
              <span className="text-xs font-mono text-slate-400">
                {trainedModels.length} trained models
              </span>
            </div>
            <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
              {activities.map((act) => (
                <div
                  key={act.id}
                  className="pb-3 border-b border-slate-100 dark:border-slate-800/70 last:border-0"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {act.action}
                    </span>
                    <span className="font-mono text-slate-400 shrink-0">{act.timestamp}</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {act.module} · {act.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveNav('data-wrangling')}
              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 transition-colors flex items-center gap-1.5"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Wrangle Data</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveNav('ml-lab')}
              className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Train ML Models</span>
            </button>
          </div>
        </div>
      </div>
    </PageTransition>
  );
};
