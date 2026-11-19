import React from 'react';
import {
  Activity,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Compass,
  Cpu,
  Database,
  FileSpreadsheet,
  Filter,
  GitBranch,
  Home,
  LayoutDashboard,
  Orbit,
  Radar,
  Settings,
  ShieldAlert,
  Sparkles,
  Sun,
  Moon,
  Menu,
  X,
} from 'lucide-react';
import { useOrbitMine } from '../../context/OrbitMineContext';
import { NavSection } from '../../types/orbit';

const NAV_ITEMS: Array<{ id: NavSection; label: string; icon: React.FC<{ className?: string }> }> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'data-management', label: 'Data Management', icon: Database },
  { id: 'data-wrangling', label: 'Data Wrangling', icon: Filter },
  { id: 'eda', label: 'Exploratory Analysis', icon: BarChart3 },
  { id: 'ml-lab', label: 'Machine Learning Lab', icon: Cpu },
  { id: 'evaluation', label: 'Model Evaluation', icon: Activity },
  { id: 'explainable-ai', label: 'Explainable AI', icon: GitBranch },
  { id: 'anomaly-detection', label: 'Anomaly Detection', icon: ShieldAlert },
  { id: 'pattern-discovery', label: 'Pattern Discovery', icon: Compass },
  { id: 'prediction', label: 'Satellite Prediction', icon: Radar },
  { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC<{
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}> = ({ mobileOpen, setMobileOpen }) => {
  const {
    activeNav,
    setActiveNav,
    sidebarCollapsed,
    setSidebarCollapsed,
    settings,
    updateSettings,
  } = useOrbitMine();

  const handleSelect = (id: NavSection) => {
    setActiveNav(id);
    setMobileOpen(false);
  };

  const toggleTheme = () => {
    updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' });
  };

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen flex flex-col border-r border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#070B16] transition-all duration-200 shrink-0 ${
          sidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-[252px]'
        } ${mobileOpen ? 'translate-x-0 w-[260px]' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand Row */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80">
          <button
            type="button"
            onClick={() => handleSelect('home')}
            className="flex items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded-md min-w-0"
          >
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-500 flex items-center justify-center shrink-0">
              <Orbit className="w-4 h-4" />
            </div>
            {!sidebarCollapsed && (
              <span className="font-display font-bold tracking-tight text-slate-900 dark:text-white text-base whitespace-nowrap">
                ORBITMINE
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:flex items-center justify-center w-7 h-7 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation menu"
            className="lg:hidden flex items-center justify-center w-8 h-8 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5" aria-label="Primary Sidebar">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                title={sidebarCollapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-cyan-500/12 text-cyan-600 dark:text-cyan-400 border border-cyan-500/25'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent'
                } ${sidebarCollapsed ? 'justify-center px-2' : ''}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Theme Switch Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800/80">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle color theme"
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors whitespace-nowrap ${
              sidebarCollapsed ? 'justify-center px-2' : ''
            }`}
          >
            {settings.theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700 shrink-0" />
            )}
            {!sidebarCollapsed && (
              <span>{settings.theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</span>
            )}
          </button>
        </div>
      </aside>
    </>
  );
};

export const WorkspaceTopBar: React.FC<{
  onOpenMobileMenu: () => void;
}> = ({ onOpenMobileMenu }) => {
  const { activeNav, datasetName, isDemoData, activeRecords, setActiveNav, settings } = useOrbitMine();
  const currentTitle = NAV_ITEMS.find((i) => i.id === activeNav)?.label ?? 'ORBITMINE';

  return (
    <header className="sticky top-0 z-30 h-14 px-4 sm:px-6 flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-[#060913]/90 backdrop-blur-md">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <Menu className="w-4 h-4" />
        </button>
        <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
          {currentTitle}
        </h2>
        <span className="hidden md:inline text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
          <span aria-hidden="true">/</span> {datasetName} · <span className="font-mono tabular-nums">{activeRecords.length}</span> objects
          {isDemoData ? ' · Illustrative Sample' : ''}
        </span>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <span className="hidden sm:inline text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
          {settings.executionMode === 'fastapi-backend' && settings.backendConnected
            ? 'FastAPI Backend Connected'
            : 'Local Browser Engine'}
        </span>
        <button
          type="button"
          onClick={() => setActiveNav('prediction')}
          className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Classify Object</span>
        </button>
      </div>
    </header>
  );
};
