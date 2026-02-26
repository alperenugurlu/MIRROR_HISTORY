import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

function getPasswordStrengthError(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[a-z]/.test(password)) return 'Must contain a lowercase letter';
  if (!/[A-Z]/.test(password)) return 'Must contain an uppercase letter';
  if (!/\d/.test(password)) return 'Must contain a digit';
  return null;
}

export default function ChangePassword() {
  const { changePassword, user } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const strengthError = getPasswordStrengthError(newPassword);
    if (strengthError) {
      setError(strengthError);
      return;
    }

    if (newPassword === oldPassword) {
      setError('New password must be different from current password');
      return;
    }

    setLoading(true);
    const result = await changePassword(oldPassword, newPassword);
    if (!result.success) {
      setError(result.error || 'Failed to change password');
    }
    setLoading(false);
  };

  return (
    <div className="h-screen flex items-center justify-center bg-surface-0">
      <div className="w-full max-w-sm px-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-grain-rose/10 border border-grain-rose/20 mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-grain-rose">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="text-xl font-mono font-bold text-text-primary tracking-tight">Password Change Required</h1>
          <p className="text-[11px] font-mono text-text-muted uppercase tracking-widest mt-1">
            {user?.mustChangePassword
              ? 'The grain requires a secure password before proceeding'
              : 'Update your credentials'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-text-muted mb-1.5">
              Current Password
            </label>
            <input
              type="password"
              value={oldPassword}
              onChange={e => setOldPassword(e.target.value)}
              autoFocus
              autoComplete="current-password"
              className="w-full bg-surface-2 border border-surface-3 rounded-lg px-3 py-2.5 text-sm font-mono text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:ring-1 focus:ring-grain-cyan focus:border-grain-cyan transition-colors"
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-text-muted mb-1.5">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full bg-surface-2 border border-surface-3 rounded-lg px-3 py-2.5 text-sm font-mono text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:ring-1 focus:ring-grain-cyan focus:border-grain-cyan transition-colors"
              placeholder="Min. 8 chars, upper+lower+digit"
            />
            {newPassword && (
              <p className={`text-[10px] font-mono mt-1 ${
                getPasswordStrengthError(newPassword) ? 'text-grain-rose' : 'text-grain-cyan'
              }`}>
                {getPasswordStrengthError(newPassword) || 'Password strength: OK'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-text-muted mb-1.5">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full bg-surface-2 border border-surface-3 rounded-lg px-3 py-2.5 text-sm font-mono text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:ring-1 focus:ring-grain-cyan focus:border-grain-cyan transition-colors"
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
            disabled={loading || !oldPassword || !newPassword || !confirmPassword}
            className="w-full py-2.5 rounded-lg bg-grain-cyan text-surface-0 text-sm font-mono font-semibold hover:bg-grain-cyan-glow transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Updating...' : 'Set New Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
