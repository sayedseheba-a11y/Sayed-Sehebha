import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownUp,
  CheckCircle2,
  Download,
  RefreshCw,
  Search,
  Upload,
} from 'lucide-react';
import { useOrbitMine } from '../../context/OrbitMineContext';
import { exportRecordsToCsv, parseCsvToRecords } from '../../engine/dataPipeline';
import { PageTransition, TechnicalTooltip } from '../common/MotionPrimitives';

export const DataManagementView: React.FC = () => {
  const {
    datasetName,
    isDemoData,
    activeRecords,
    validation,
    loadDataset,
    resetToDemoDataset,
    notify,
    setActiveNav,
  } = useOrbitMine();

  const [isDragging, setIsDragging] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortCol, setSortCol] = useState<string>('norad_id');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const pageSize = 12;

  const handleFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      notify('error', 'Unsupported File', 'Please upload a valid .csv satellite orbital catalogue.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result ?? '');
      const { records, errors } = parseCsvToRecords(text);
      if (records.length === 0) {
        notify('error', 'Empty CSV', errors[0] ?? 'No valid rows detected in the uploaded CSV.');
        return;
      }
      loadDataset(records, file.name, false);
      setPage(0);
    };
    reader.readAsText(file);
  };

  const previewColumns = useMemo(
    () => validation.columns.slice(0, 10).map((c) => c.name),
    [validation.columns]
  );

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? activeRecords.filter((r) =>
          Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(q))
        )
      : activeRecords;

    return [...filtered].sort((a, b) => {
      const va = a[sortCol];
      const vb = b[sortCol];
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      const na = Number(va);
      const nb = Number(vb);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) {
        return sortDir === 'asc' ? na - nb : nb - na;
      }
      return sortDir === 'asc'
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
  }, [activeRecords, searchQuery, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / pageSize));
  const pagedRows = filteredAndSorted.slice(page * pageSize, (page + 1) * pageSize);

  const toggleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800/80">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Data Management &amp; Ingestion
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Active File: <span className="font-mono text-slate-800 dark:text-slate-200">{datasetName}</span>
            {isDemoData ? ' · Illustrative Sample Dataset' : ' · User Uploaded CSV'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={resetToDemoDataset}
            className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:border-cyan-500 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Load Sample Catalogue</span>
          </button>
          <button
            type="button"
            onClick={() => exportRecordsToCsv(activeRecords, `orbitmine_${datasetName}`)}
            className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV</span>
          </button>
        </div>
      </div>

      {/* Drag & Drop Upload + Validation Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
          className={`lg:col-span-5 rounded-xl border-2 border-dashed p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-cyan-500 bg-cyan-500/10'
              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0C1222] hover:border-cyan-500/70'
          }`}
        >
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <div className="w-11 h-11 rounded-lg bg-cyan-500/10 text-cyan-500 flex items-center justify-center mb-3">
            <Upload className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Drop orbital catalogue CSV here or click to browse
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-xs">
            Supports NORAD/Space-Track style CSVs with columns such as object_type, mean_altitude_km,
            inclination_deg, eccentricity, mean_motion_rev_day, bstar_drag, and rcs_m2.
          </p>
        </label>

        {/* Dataset Validation Summary */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Dataset Validation Summary
            </h2>
            <span
              className={`text-xs font-medium inline-flex items-center gap-1.5 ${
                validation.isValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
              }`}
            >
              {validation.isValid ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Schema Validated</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  <span>Attention Required</span>
                </>
              )}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-3 border-y border-slate-100 dark:border-slate-800/80">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Rows</p>
              <p className="text-lg font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                {validation.rowCount}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Columns</p>
              <p className="text-lg font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                {validation.columnCount}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Missing Values</p>
              <p className="text-lg font-mono tabular-nums font-bold text-amber-600 dark:text-amber-400">
                {validation.totalMissingCells}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Duplicates</p>
              <p className="text-lg font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                {validation.duplicateCount}
              </p>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            {validation.errors.map((err, i) => (
              <p key={i} className="text-rose-600 dark:text-rose-400">
                Error: {err}
              </p>
            ))}
            {validation.warnings.map((w, i) => (
              <p key={i} className="text-amber-600 dark:text-amber-400">
                Note: {w}
              </p>
            ))}
            {validation.warnings.length === 0 && validation.errors.length === 0 && (
              <p className="text-emerald-600 dark:text-emerald-400">
                Dataset is clean, deduplicated, and ready for ML modeling.
              </p>
            )}
          </div>

          {(validation.totalMissingCells > 0 || validation.duplicateCount > 0) && (
            <button
              type="button"
              onClick={() => setActiveNav('data-wrangling')}
              className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline"
            >
              Proceed to Data Wrangling to clean missing values and duplicates →
            </button>
          )}
        </div>
      </div>

      {/* Column Schema Profiler */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
          Column Schema &amp; Feature Profiler
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="py-2.5 pr-4 font-medium">Column</th>
                <th className="py-2.5 px-3 font-medium">Role / Type</th>
                <th className="py-2.5 px-3 font-medium text-right">Missing</th>
                <th className="py-2.5 px-3 font-medium text-right">Unique</th>
                <th className="py-2.5 px-3 font-medium text-right">Mean</th>
                <th className="py-2.5 px-3 font-medium text-right">Min</th>
                <th className="py-2.5 pl-3 font-medium text-right">Max</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {validation.columns.map((col) => (
                <tr key={col.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="py-2.5 pr-4 font-mono font-medium text-slate-900 dark:text-slate-100">
                    {col.name}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                    {col.isTarget
                      ? 'Target Label'
                      : col.isIdentifier
                      ? 'Identifier (Excluded from X)'
                      : col.dataType === 'numeric'
                      ? 'Numeric Feature'
                      : 'Categorical'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {col.missingCount} ({col.missingPct}%)
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {col.uniqueCount}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {col.mean !== undefined ? col.mean : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {col.min !== undefined ? col.min : '—'}
                  </td>
                  <td className="py-2.5 pl-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {col.max !== undefined ? col.max : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interactive Dataset Table Preview */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            <TechnicalTooltip
              term="Catalogue Record Preview"
              explanation="Search across all orbital records and click any column header to sort numerically or alphabetically."
            />
          </h2>
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Search NORAD ID, name, class..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#070B16] text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                {previewColumns.map((col) => (
                  <th key={col} className="py-2.5 px-2.5 font-medium whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort(col)}
                      className="inline-flex items-center gap-1 hover:text-cyan-500 transition-colors"
                    >
                      <span>{col}</span>
                      <ArrowDownUp className="w-3 h-3 opacity-60" />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {pagedRows.map((row, rIdx) => (
                <tr key={`${row.norad_id}-${rIdx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  {previewColumns.map((col) => {
                    const val = row[col];
                    const isNum = typeof val === 'number';
                    return (
                      <td
                        key={col}
                        className={`py-2 px-2.5 whitespace-nowrap ${
                          isNum ? 'font-mono tabular-nums text-slate-700 dark:text-slate-300' : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {val === null || val === undefined ? (
                          <span className="text-amber-500 font-mono">null</span>
                        ) : (
                          String(val)
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-mono tabular-nums">
            Page {page + 1} of {totalPages} · {filteredAndSorted.length} matching rows
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="px-3 py-1 rounded-md border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:border-cyan-500"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="px-3 py-1 rounded-md border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:border-cyan-500"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </PageTransition>
  );
};
