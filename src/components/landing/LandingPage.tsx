import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  Compass,
  GitBranch,
  Orbit,
  ShieldAlert,
  Database,
  Cpu,
  BarChart3,
  Sun,
  Moon,
} from 'lucide-react';
import { useOrbitMine } from '../../context/OrbitMineContext';
import { AnimatedNumber } from '../common/MotionPrimitives';

export const LandingPage: React.FC = () => {
  const { setActiveNav, activeRecords, anomalyResult, settings, updateSettings } = useOrbitMine();
  const prefersReduced = useReducedMotion();

  const toggleTheme = () => {
    updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#060913] text-slate-900 dark:text-slate-100">
      {/* Top Bar Contract: 3 clean zones */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800/80 bg-white/85 dark:bg-[#060913]/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-2.5 text-lg font-display font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            <Orbit className="w-5 h-5 text-cyan-500" />
            <span>ORBITMINE</span>
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a href="#capabilities" className="hover:text-cyan-500 transition-colors whitespace-nowrap shrink-0">
              Capabilities
            </a>
            <a href="#architecture" className="hover:text-cyan-500 transition-colors whitespace-nowrap shrink-0">
              ML Pipeline
            </a>
            <a href="#stack" className="hover:text-cyan-500 transition-colors whitespace-nowrap shrink-0">
              Technology
            </a>
            <button
              type="button"
              onClick={() => setActiveNav('data-management')}
              className="hover:text-cyan-500 transition-colors whitespace-nowrap shrink-0"
            >
              Upload Data
            </button>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              {settings.theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => setActiveNav('dashboard')}
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              Explore Dashboard
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="top" className="relative overflow-hidden border-b border-slate-200 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-6 py-16 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center">
            <p className="text-xs font-medium tracking-wider uppercase text-cyan-600 dark:text-cyan-400 mb-4">
              Orbital Data Mining · Explainable Machine Learning
            </p>
            <h1 className="font-display font-bold tracking-tight text-slate-900 dark:text-white text-4xl sm:text-5xl lg:text-[3.4rem] leading-[1.08] text-balance mb-6">
              Discover the Hidden Intelligence of Earth&apos;s Orbit.
            </h1>
            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl mb-8">
              ORBITMINE transforms raw satellite catalogues and Keplerian orbital elements into
              validated classification models, SHAP explanations, Isolation Forest anomaly scans,
              and unsupervised orbital regime clusters.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => setActiveNav('data-management')}
                className="px-6 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setActiveNav('dashboard')}
                className="px-6 py-3 rounded-lg border border-slate-300 dark:border-slate-700 hover:border-cyan-500/60 text-slate-800 dark:text-slate-200 text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                Explore Dashboard
              </button>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
              <span>Zero-Leakage Stratified Splits</span>
              <span aria-hidden="true">·</span>
              <span>SHAP Feature Attributions</span>
              <span aria-hidden="true">·</span>
              <span>FastAPI + In-Browser Engine</span>
            </div>
          </div>

          {/* Animated Earth & Orbital Visual */}
          <div className="lg:col-span-6 relative min-h-[360px] lg:min-h-[460px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-[#060913]">
            <img
              src="/src/assets/images/hero_earth_orbit_1795106585007.jpg"
              alt="Earth horizon from low Earth orbit at dawn"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#060913] via-[#060913]/20 to-transparent" />

            {/* Animated SVG Orbital Ring Overlay */}
            <svg
              viewBox="0 0 600 460"
              className="absolute inset-0 w-full h-full pointer-events-none"
              aria-hidden="true"
            >
              <g transform="translate(300, 235)">
                <g className={prefersReduced ? '' : 'animate-orbit-slow'}>
                  <ellipse
                    cx="0"
                    cy="0"
                    rx="235"
                    ry="95"
                    fill="none"
                    stroke="rgba(34, 211, 238, 0.42)"
                    strokeWidth="1.25"
                    strokeDasharray="6 6"
                    transform="rotate(-18)"
                  />
                  <circle cx="215" cy="-58" r="4.5" fill="#22D3EE" />
                </g>
                <g className={prefersReduced ? '' : 'animate-orbit-reverse'}>
                  <ellipse
                    cx="0"
                    cy="0"
                    rx="195"
                    ry="135"
                    fill="none"
                    stroke="rgba(99, 102, 241, 0.38)"
                    strokeWidth="1"
                    strokeDasharray="3 7"
                    transform="rotate(24)"
                  />
                  <circle cx="-170" cy="65" r="3.5" fill="#818CF8" />
                </g>
              </g>
            </svg>

            <div className="absolute bottom-5 left-5 right-5 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-300">
              <span className="font-mono">LEO / MEO / GEO / HEO TELEMETRY</span>
              <span className="font-mono tabular-nums text-cyan-300">
                {activeRecords.length} TRACKED CATALOGUE OBJECTS
              </span>
            </div>
          </div>
        </div>

        {/* Full-Width 4-Column Project Statistics Strip */}
        <div className="border-t border-slate-200 dark:border-slate-800/80 bg-white/60 dark:bg-[#090E1C]">
          <div className="max-w-7xl mx-auto px-6 py-7 grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Active Catalogue Objects</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                <AnimatedNumber value={activeRecords.length} />
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Supervised Classifiers</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-mono tabular-nums">
                3 <span className="text-xs font-normal text-slate-400">CART · RF · LogReg</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Flagged Orbital Outliers</p>
              <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400 mt-1">
                <AnimatedNumber value={anomalyResult?.anomalyCount ?? 0} />
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Analysis Modules</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-mono tabular-nums">
                12 <span className="text-xs font-normal text-slate-400">End-to-End</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Intelligence Capabilities */}
      <section id="capabilities" className="max-w-7xl mx-auto px-6 py-20">
        <div className="max-w-2xl mb-12">
          <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
            Scientific Data Mining Without Black-Box Guesswork
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mt-3 text-base leading-relaxed">
            Every metric in ORBITMINE is computed directly from your uploaded or illustrative
            orbital dataset using leakage-free validation splits.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div
            whileHover={prefersReduced ? undefined : { y: -3 }}
            transition={{ duration: 0.18 }}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6 flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 text-cyan-500 flex items-center justify-center mb-5">
                <GitBranch className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                Explainable AI
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Quantify global permutation importance and local SHAP-style feature contributions
                showing exactly how altitude, eccentricity, inclination, drag, and RCS drive
                payload vs. debris classification.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveNav('explainable-ai')}
              className="mt-6 text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline inline-flex items-center gap-1.5 w-fit"
            >
              <span>Open Explainable AI</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </motion.div>

          <motion.div
            whileHover={prefersReduced ? undefined : { y: -3 }}
            transition={{ duration: 0.18 }}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6 flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center mb-5">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                Anomaly Detection
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Isolate statistically unusual orbital regimes using Isolation Forest path-length
                scoring, highlighting extreme drag coefficients, eccentricities, or atypical
                altitude-inclination combinations.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveNav('anomaly-detection')}
              className="mt-6 text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline inline-flex items-center gap-1.5 w-fit"
            >
              <span>Open Anomaly Scanner</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </motion.div>

          <motion.div
            whileHover={prefersReduced ? undefined : { y: -3 }}
            transition={{ duration: 0.18 }}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-6 flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-5">
                <Compass className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                Pattern Discovery
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Uncover latent orbital groupings using K-Means++ clustering projected onto 2D PCA
                coordinates, evaluated objectively via Silhouette Score and centroid profiles.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveNav('pattern-discovery')}
              className="mt-6 text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline inline-flex items-center gap-1.5 w-fit"
            >
              <span>Explore Clusters</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        </div>
      </section>

      {/* Pipeline & Spacecraft Visual Split */}
      <section
        id="architecture"
        className="border-t border-b border-slate-200 dark:border-slate-800/80 bg-white/50 dark:bg-[#090E1C]"
      >
        <div className="max-w-7xl mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-[#070B16]">
            <img
              src="/src/assets/images/satellite_isometric_render_1795106583440.jpg"
              alt="Isometric scientific rendering of an Earth observation satellite"
              referrerPolicy="no-referrer"
              className="w-full h-auto object-cover"
            />
          </div>

          <div className="lg:col-span-6 space-y-6">
            <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
              End-to-End Orbital Mining Workflow
            </h2>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <Database className="w-5 h-5 text-cyan-500 mt-0.5 shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    01. Ingestion, Validation &amp; Wrangling
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Upload CSV orbital catalogues, inspect missingness and duplicates, impute or
                    winsorize outliers, and review before-and-after statistical deltas.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <BarChart3 className="w-5 h-5 text-cyan-500 mt-0.5 shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    02. Exploratory Orbital Analytics
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Inspect altitude vs. inclination distributions, eccentricity histograms, and
                    Pearson correlation heatmaps filtered by object class.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <Cpu className="w-5 h-5 text-cyan-500 mt-0.5 shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    03. Leakage-Free Training &amp; Evaluation
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Stratified train-test splits fit scaling exclusively on training partitions,
                    reporting macro/weighted F1, ROC-AUC, confusion matrices, and K-Fold CV.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Technology Stack */}
      <section id="stack" className="max-w-7xl mx-auto px-6 py-16">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              Architecture &amp; Technology Stack
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Dual-engine design pairing an interactive React/TypeScript analytical suite with a
              ready-to-run Python FastAPI + Scikit-learn + SHAP backend.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveNav('settings')}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:border-cyan-500 transition-colors whitespace-nowrap shrink-0 w-fit"
          >
            Configure Backend Connection
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mt-8">
          {[
            { name: 'React 19 + TS', role: 'Modular Workspace' },
            { name: 'Recharts', role: 'Interactive Plots' },
            { name: 'FastAPI', role: 'Python ML Bridge' },
            { name: 'Scikit-learn', role: 'CART · RF · KMeans' },
            { name: 'SHAP', role: 'Feature Attribution' },
            { name: 'Pandas & NumPy', role: 'Data Wrangling' },
          ].map((tech) => (
            <div
              key={tech.name}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-4"
            >
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{tech.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{tech.role}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Clean Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <p>ORBITMINE — Intelligent Data Mining Framework for Satellite Orbital Data</p>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => setActiveNav('dashboard')}
              className="hover:text-cyan-500 transition-colors"
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => setActiveNav('reports')}
              className="hover:text-cyan-500 transition-colors"
            >
              Reports
            </button>
            <button
              type="button"
              onClick={() => setActiveNav('settings')}
              className="hover:text-cyan-500 transition-colors"
            >
              Backend Setup
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
