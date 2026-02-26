import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { GrainLogo } from '../components/GrainLogo';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    }
    setLoading(false);
  };

  return (
    <div className="h-screen flex items-center justify-center bg-surface-0 relative overflow-hidden">
      {/* Dot-grid background */}
      <div className="absolute inset-0 login-grid-bg pointer-events-none" />

      {/* Scanning line */}
      <div className="login-scan-line" />

      <div className="w-full max-w-sm px-6 relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-grain-cyan/5 border border-grain-cyan/15 grain-glow mb-4">
            <GrainLogo size={48} variant="full" animated className="text-grain-cyan" />
          </div>
          <h1 className="text-xl font-mono font-bold text-text-primary tracking-tight glitch-text">MIRROR HISTORY</h1>
          <p className="text-[11px] font-mono text-text-muted uppercase tracking-widest mt-1">
            Grain authentication required
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-text-muted mb-1.5">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              className="w-full bg-surface-2 border border-surface-3 rounded-lg px-3 py-2.5 text-sm font-mono text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:ring-1 focus:ring-grain-cyan focus:border-grain-cyan transition-colors"
              placeholder="admin"
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-text-muted mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full bg-surface-2 border border-surface-3 rounded-lg px-3 py-2.5 text-sm font-mono text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:ring-1 focus:ring-grain-cyan focus:border-grain-cyan transition-colors"
              placeholder="changeme"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-grain-rose/10 border border-grain-rose/20">
              <div className="w-1.5 h-1.5 rounded-full bg-grain-rose shrink-0" />
              <p className="text-xs font-mono text-grain-rose">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full py-2.5 rounded-lg bg-grain-cyan text-surface-0 text-sm font-mono font-semibold hover:bg-grain-cyan-glow transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Authenticating...' : 'Initialize Session'}
          </button>
        </form>

        {/* Default credentials hint */}
        <p className="text-center text-[10px] font-mono text-text-muted/50 mt-6">
          Default credentials: admin / changeme
        </p>
      </div>
    </div>
  );
}
