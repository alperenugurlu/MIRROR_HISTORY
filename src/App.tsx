import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useApi } from './hooks/useApi';
import { useAuth } from './contexts/AuthContext';
import { GrainLogo } from './components/GrainLogo';
import Layout from './components/Layout';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import Onboarding from './pages/Onboarding';
import Cortex from './pages/Cortex';
import Ledger from './pages/Ledger';
import Recall from './pages/Recall';
import Oracle from './pages/Oracle';
import Ingest from './pages/Ingest';
import Scan from './pages/Scan';
import Filters from './pages/Filters';
import Chronicle from './pages/Chronicle';
import Neural from './pages/Neural';
import Redo from './pages/Redo';
import Compare from './pages/Compare';

export default function App() {
  const api = useApi();
  const { isAuthenticated, user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [hasData, setHasData] = useState<boolean | null>(null);
  const [startupError, setStartupError] = useState(false);

  const checkData = () => {
    setStartupError(false);
    api.hasData().then(setHasData).catch(() => setStartupError(true));
  };

  useEffect(() => {
    if (isAuthenticated && !user?.mustChangePassword) {
      checkData();
    }
  }, [isAuthenticated, user?.mustChangePassword]);

  const onImportComplete = () => {
    setHasData(true);
    navigate('/');
  };

  // Auth loading state
  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface-0">
        <div className="text-center space-y-3">
          <GrainLogo size={32} variant="full" animated className="text-grain-cyan mx-auto" />
          <p className="text-text-muted text-sm font-mono animate-glow-pulse">Initializing Grain...</p>
        </div>
      </div>
    );
  }

  // Not authenticated — show login
  if (!isAuthenticated) {
    return <Login />;
  }

  // Must change password
  if (user?.mustChangePassword) {
    return <ChangePassword />;
  }

  if (startupError) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface-0">
        <div className="max-w-sm text-center space-y-3">
          <p className="text-sm font-medium text-text-primary">Unable to load database</p>
          <p className="text-xs text-text-secondary">The local database could not be opened. This may happen if the file is locked or corrupted.</p>
          <button
            onClick={checkData}
            className="px-4 py-2 rounded-lg bg-grain-cyan hover:bg-grain-cyan-glow text-surface-0 text-sm transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (hasData === null) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface-0">
        <div className="text-center space-y-3">
          <GrainLogo size={32} variant="full" animated className="text-grain-cyan mx-auto" />
          <p className="text-text-muted text-sm font-mono animate-glow-pulse">Loading memories...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/onboarding" element={<Onboarding onComplete={onImportComplete} />} />
      <Route element={<Layout />}>
        <Route path="/" element={hasData ? <Cortex /> : <Navigate to="/onboarding" />} />
        <Route path="/redo" element={<Redo />} />
        <Route path="/recall" element={<Recall />} />
        <Route path="/ledger" element={<Ledger />} />
        <Route path="/oracle" element={<Oracle />} />
        <Route path="/ingest" element={<Ingest />} />
        <Route path="/scan" element={<Scan />} />
        <Route path="/filters" element={<Filters />} />
        <Route path="/chronicle" element={<Chronicle />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/neural" element={<Neural />} />

        {/* Legacy route redirects */}
        <Route path="/timeline" element={<Navigate to="/recall" replace />} />
        <Route path="/money" element={<Navigate to="/ledger" replace />} />
        <Route path="/chat" element={<Navigate to="/oracle" replace />} />
        <Route path="/import" element={<Navigate to="/ingest" replace />} />
        <Route path="/audit" element={<Navigate to="/scan" replace />} />
        <Route path="/rules" element={<Navigate to="/filters" replace />} />
        <Route path="/activity" element={<Navigate to="/chronicle" replace />} />
        <Route path="/settings" element={<Navigate to="/neural" replace />} />
      </Route>
    </Routes>
  );
}
