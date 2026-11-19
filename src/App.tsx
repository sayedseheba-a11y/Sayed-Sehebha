import React, { useState } from 'react';
import { OrbitMineProvider, useOrbitMine } from './context/OrbitMineContext';
import { NotificationToastStack } from './components/common/MotionPrimitives';
import { LandingPage } from './components/landing/LandingPage';
import { Sidebar, WorkspaceTopBar } from './components/layout/Sidebar';
import { AnomalyDetectionView } from './components/modules/AnomalyDetectionView';
import { DashboardView } from './components/modules/DashboardView';
import { DataManagementView } from './components/modules/DataManagementView';
import { DataWranglingView } from './components/modules/DataWranglingView';
import { EdaView } from './components/modules/EdaView';
import { ExplainableAiView } from './components/modules/ExplainableAiView';
import { MlLabView } from './components/modules/MlLabView';
import { ModelEvaluationView } from './components/modules/ModelEvaluationView';
import { PatternDiscoveryView } from './components/modules/PatternDiscoveryView';
import { PredictionView } from './components/modules/PredictionView';
import { ReportsView } from './components/modules/ReportsView';
import { SettingsView } from './components/modules/SettingsView';

const OrbitMineShell: React.FC = () => {
  const { activeNav } = useOrbitMine();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (activeNav === 'home') {
    return (
      <>
        <LandingPage />
        <NotificationToastStack />
      </>
    );
  }

  const renderView = () => {
    switch (activeNav) {
      case 'dashboard':
        return <DashboardView />;
      case 'data-management':
        return <DataManagementView />;
      case 'data-wrangling':
        return <DataWranglingView />;
      case 'eda':
        return <EdaView />;
      case 'ml-lab':
        return <MlLabView />;
      case 'evaluation':
        return <ModelEvaluationView />;
      case 'explainable-ai':
        return <ExplainableAiView />;
      case 'anomaly-detection':
        return <AnomalyDetectionView />;
      case 'pattern-discovery':
        return <PatternDiscoveryView />;
      case 'prediction':
        return <PredictionView />;
      case 'reports':
        return <ReportsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#060913] text-slate-900 dark:text-slate-100">
      <Sidebar mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />
      <div className="flex-1 flex flex-col min-w-0">
        <WorkspaceTopBar onOpenMobileMenu={() => setMobileMenuOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {renderView()}
        </main>
      </div>
      <NotificationToastStack />
    </div>
  );
};

export default function App() {
  return (
    <OrbitMineProvider>
      <OrbitMineShell />
    </OrbitMineProvider>
  );
}
