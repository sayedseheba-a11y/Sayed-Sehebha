import React from 'react';
import { RefreshCw, Server, Sun, Moon } from 'lucide-react';
import { useOrbitMine } from '../../context/OrbitMineContext';
import { PageTransition } from '../common/MotionPrimitives';

export const SettingsView: React.FC = () => {
  const { settings, updateSettings, testBackendConnection, resetToDemoDataset } = useOrbitMine();

  return (
    <PageTransition className="space-y-6 max-w-4xl">
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800/80">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Platform Settings &amp; Python Backend Bridge
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Configure execution mode, Python FastAPI endpoint connectivity, visual theme, and sample catalogue reset.
        </p>
      </div>

      {/* Appearance */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Interface Color Mode
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Switch between Deep Space Observatory (Dark) and Laboratory Slate (Light) workspaces.
          </p>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#070B16] border border-slate-200 dark:border-slate-800 w-fit">
          <button
            type="button"
            onClick={() => updateSettings({ theme: 'dark' })}
            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
              settings.theme === 'dark'
                ? 'bg-cyan-500/20 text-cyan-300'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Moon className="w-3.5 h-3.5" />
            <span>Dark</span>
          </button>
          <button
            type="button"
            onClick={() => updateSettings({ theme: 'light' })}
            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
              settings.theme === 'light'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            <span>Light</span>
          </button>
        </div>
      </div>

      {/* Backend Integration Layer */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-cyan-500" />
              <span>Python FastAPI Integration (Pandas · Scikit-learn · SHAP)</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              When running the included FastAPI server locally, connect ORBITMINE directly to Python ML pipelines or continue using the built-in browser engine.
            </p>
          </div>
          <span
            className={`text-xs font-medium whitespace-nowrap ${
              settings.backendConnected ? 'text-emerald-500' : 'text-amber-500'
            }`}
          >
            {settings.backendConnected ? '● Connected' : '○ Local Browser Mode'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-8">
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
              FastAPI Server URL
            </label>
            <input
              type="url"
              value={settings.backendUrl}
              onChange={(e) => updateSettings({ backendUrl: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#070B16] font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div className="sm:col-span-4">
            <button
              type="button"
              onClick={() => testBackendConnection()}
              className="w-full px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-colors"
            >
              Test Backend Health
            </button>
          </div>
        </div>

        <div className="rounded-lg bg-slate-50 dark:bg-[#060913] border border-slate-200 dark:border-slate-800 p-4 font-mono text-xs text-slate-700 dark:text-slate-300 space-y-1">
          <p className="text-slate-400"># Start the Python FastAPI backend locally:</p>
          <p>cd backend &amp;&amp; pip install -r requirements.txt</p>
          <p>uvicorn main:app --host 0.0.0.0 --port 8000 --reload</p>
        </div>
      </div>

      {/* Dataset Reset */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Reset Illustrative Sample Catalogue
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Restore the 420-object illustrative orbital catalogue and clear current trained models.
          </p>
        </div>
        <button
          type="button"
          onClick={resetToDemoDataset}
          className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:border-cyan-500 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1.5 w-fit"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reset Demo Data</span>
        </button>
      </div>
    </PageTransition>
  );
};
