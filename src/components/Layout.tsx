import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useGrainVoice } from '../contexts/GrainVoiceContext';
import { GrainLogo } from './GrainLogo';
import HowItWorks from './HowItWorks';
import QuickAdd from './QuickAdd';
import GrainStatusBar from './GrainStatusBar';
import GrainWhisper from './GrainWhisper';

// ── Inline SVG Icons (Lucide-style, 24x24) ──

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

const navGroups = [
  {
    label: 'Memory',
    items: [
      {
        to: '/',
        label: 'Cortex',
        icon: (
          <Icon>
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </Icon>
        ),
      },
      {
        to: '/redo',
        label: 'Re-do',
        icon: (
          <Icon>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </Icon>
        ),
      },
      {
        to: '/recall',
        label: 'Recall',
        icon: (
          <Icon>
            <polygon points="11 19 2 12 11 5" />
            <polygon points="22 19 13 12 22 5" />
          </Icon>
        ),
      },
    ],
  },
  {
    label: 'Analysis',
    items: [
      {
        to: '/ledger',
        label: 'Ledger',
        icon: (
          <Icon>
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </Icon>
        ),
      },
      {
        to: '/oracle',
        label: 'Oracle',
        icon: (
          <Icon>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </Icon>
        ),
      },
      {
        to: '/scan',
        label: 'Scan',
        icon: (
          <Icon>
            <path d="M3 3v18h18" />
            <path d="M18 17V9" />
            <path d="M13 17V5" />
            <path d="M8 17v-3" />
          </Icon>
        ),
      },
      {
        to: '/compare',
        label: 'Compare',
        icon: (
          <Icon>
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </Icon>
        ),
      },
    ],
  },
  {
    label: 'Data',
    items: [
      {
        to: '/ingest',
        label: 'Ingest',
        icon: (
          <Icon>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </Icon>
        ),
      },
      {
        to: '/filters',
        label: 'Filters',
        icon: (
          <Icon>
            <line x1="4" y1="21" x2="4" y2="14" />
            <line x1="4" y1="10" x2="4" y2="3" />
            <line x1="12" y1="21" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12" y2="3" />
            <line x1="20" y1="21" x2="20" y2="16" />
            <line x1="20" y1="12" x2="20" y2="3" />
            <line x1="1" y1="14" x2="7" y2="14" />
            <line x1="9" y1="8" x2="15" y2="8" />
            <line x1="17" y1="16" x2="23" y2="16" />
          </Icon>
        ),
      },
      {
        to: '/chronicle',
        label: 'Chronicle',
        icon: (
          <Icon>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </Icon>
        ),
      },
    ],
  },
];

export default function Layout() {
  const api = useApi();
  const location = useLocation();
  const { reportPageVisit, reportPageLeave } = useGrainVoice();
  const [showHelp, setShowHelp] = useState(false);
  const [totalMemories, setTotalMemories] = useState<number | null>(null);

  // Track page visits for the grain
  useEffect(() => {
    reportPageVisit(location.pathname);
    return () => reportPageLeave(location.pathname);
  }, [location.pathname, reportPageVisit, reportPageLeave]);

  useEffect(() => {
    api.getTimelineStats()
      .then(s => setTotalMemories(s.totalEvents))
      .catch(() => {});
  }, []);

  return (
    <div className="h-screen flex flex-col bg-surface-0">
      {/* Title bar drag region */}
      <div className="drag-region h-8 flex items-center px-4 bg-sidebar-bg border-b border-sidebar-border shrink-0">
        <div className="no-drag flex items-center gap-1.5 ml-16">
          <GrainLogo size={14} variant="mark" className="text-grain-cyan" />
          <span className="w-1.5 h-1.5 rounded-full bg-grain-cyan rec-pulse" />
          <span className="text-[11px] text-grain-cyan font-mono font-semibold tracking-widest">MIRROR HISTORY</span>
        </div>
      </div>

      {/* Grain Status Bar — ambient recording indicator */}
      <GrainStatusBar />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav className="w-16 bg-sidebar-bg border-r border-sidebar-border sidebar-glow flex flex-col items-center pt-2 shrink-0">
          {navGroups.map((group, gi) => (
            <div key={group.label} className="w-full flex flex-col items-center">
              {gi > 0 && (
                <div className="w-8 border-t border-sidebar-border/40 my-1.5" />
              )}
              <span className="text-[7px] font-mono uppercase tracking-[0.2em] text-text-muted/40 mb-0.5">
                {group.label}
              </span>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `w-14 h-11 rounded-lg flex flex-col items-center justify-center transition-all relative ${
                      isActive
                        ? 'bg-sidebar-active text-grain-cyan'
                        : 'text-text-muted hover:text-text-secondary hover:bg-sidebar-hover'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <div className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r bg-grain-cyan" />
                      )}
                      {item.icon}
                      <span className="text-[11px] font-mono uppercase tracking-wider mt-0.5 leading-none">{item.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}

          {/* Memory counter */}
          {totalMemories !== null && (
            <div className="mt-auto text-center px-2 py-2 border-t border-sidebar-border">
              <div className="text-sm font-mono font-medium text-grain-cyan">
                {totalMemories.toLocaleString()}
              </div>
              <div className="text-[10px] font-mono text-text-muted uppercase tracking-widest">
                memories
              </div>
            </div>
          )}

          {/* Settings + Help — pushed to bottom */}
          <div className={`${totalMemories === null ? 'mt-auto' : ''} mb-3 flex flex-col items-center gap-0.5`}>
            <NavLink
              to="/neural"
              className={({ isActive }) =>
                `w-14 h-11 rounded-lg flex flex-col items-center justify-center transition-all relative ${
                  isActive ? 'bg-sidebar-active text-grain-cyan' : 'text-text-muted hover:text-text-secondary hover:bg-sidebar-hover'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r bg-grain-cyan" />
                  )}
                  <Icon>
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                  </Icon>
                  <span className="text-[11px] font-mono uppercase tracking-wider mt-0.5 leading-none">Neural</span>
                </>
              )}
            </NavLink>
            <button
              onClick={() => setShowHelp(true)}
              className="w-14 h-11 rounded-lg flex flex-col items-center justify-center text-text-muted hover:text-text-secondary hover:bg-sidebar-hover transition-all"
            >
              <Icon>
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </Icon>
              <span className="text-[11px] font-mono uppercase tracking-wider mt-0.5 leading-none">Help</span>
            </button>
          </div>
        </nav>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Floating QuickAdd button */}
      <QuickAdd />

      {/* The grain speaks */}
      <GrainWhisper />

      {showHelp && <HowItWorks onClose={() => setShowHelp(false)} />}
    </div>
  );
}
