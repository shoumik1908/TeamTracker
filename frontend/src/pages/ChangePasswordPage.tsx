import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Eye, EyeOff, CheckCircle, Loader2, ShieldCheck } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const { login, user, token } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const passwordRules = [
    { label: 'At least 8 characters', ok: newPassword.length >= 8 },
    { label: 'At least one uppercase letter', ok: /[A-Z]/.test(newPassword) },
    { label: 'At least one number', ok: /[0-9]/.test(newPassword) },
  ];
  const allRulesOk = passwordRules.every(r => r.ok);

  const mutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.post('/auth/change-password', data).then(r => r.data),
    onSuccess: (data) => {
      // Update token & user in context so mustChangePassword is cleared
      if (data.token && data.user) {
        login(data.token, data.user);
      }
      setSuccess(true);
      setTimeout(() => navigate('/'), 2000);
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to change password. Please try again.');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!allRulesOk) { setError('Password does not meet all requirements.'); return; }
    if (newPassword !== confirmPassword) { setError('New passwords do not match.'); return; }
    if (newPassword === currentPassword) { setError('New password must be different from your current password.'); return; }
    mutation.mutate({ currentPassword, newPassword });
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-400" />
        </div>
        <h2 className="text-xl font-bold text-white">Password Changed!</h2>
        <p className="text-sm text-muted-foreground">Redirecting you to the dashboard...</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-10">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
          <ShieldCheck className="w-6 h-6 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Change Password</h1>
          <p className="text-sm text-muted-foreground">Update your account password</p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-[#211e28]/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-xl space-y-5"
      >
        {/* User info */}
        <div className="flex items-center gap-3 pb-4 border-b border-white/5">
          <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
            {(user?.name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium text-white">{user?.name}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        {/* Current password */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#cac3d8]">Current Password</label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type={showCurrent ? 'text' : 'password'}
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              required
              placeholder="Enter current password"
              className="w-full pl-10 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
            <button type="button" onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white">
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* New password */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#cac3d8]">New Password</label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
              placeholder="Enter new password"
              className="w-full pl-10 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
            <button type="button" onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white">
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Password strength rules */}
          {newPassword.length > 0 && (
            <ul className="mt-2 space-y-1">
              {passwordRules.map(rule => (
                <li key={rule.label} className={`flex items-center gap-2 text-xs transition-colors ${rule.ok ? 'text-green-400' : 'text-muted-foreground'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${rule.ok ? 'bg-green-400' : 'bg-muted-foreground/40'}`} />
                  {rule.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Confirm password */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#cac3d8]">Confirm New Password</label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              placeholder="Confirm new password"
              className={`w-full pl-10 pr-10 py-2.5 bg-white/5 border rounded-lg text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
                confirmPassword && confirmPassword !== newPassword ? 'border-red-500/50' : 'border-white/10'
              }`}
            />
            <button type="button" onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white">
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {confirmPassword && confirmPassword !== newPassword && (
            <p className="text-xs text-red-400">Passwords do not match</p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-muted-foreground bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending || !currentPassword || !newPassword || !confirmPassword}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Updating...</>
            ) : (
              <><ShieldCheck className="w-4 h-4" /> Update Password</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
