import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { GrainVoiceProvider } from './contexts/GrainVoiceContext';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <GrainVoiceProvider>
          {/* Sci-fi ambient overlays */}
          <div className="crt-overlay" />
          <div className="crt-vignette" />
          <div className="ambient-scan-line" />
          <App />
        </GrainVoiceProvider>
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>,
);
