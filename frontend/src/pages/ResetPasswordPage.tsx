import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound, Eye, EyeOff, CheckCircle, Loader2, AlertTriangle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/**
 * Public page reached from a single-use reset link. No session is required — the
 * token in the query string is the credential, and it dies as soon as it is used.
 */
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // These mirror assertPasswordAcceptable in backend/src/routes/auth.ts. If they
  // drift, the form says "valid" and the server answers 400.
  const passwordRules = [
    { label: 'At least 10 characters', ok: newPassword.length >= 10 },
    { label: 'At least one letter', ok: /[a-zA-Z]/.test(newPassword) },
    { label: 'At least one number', ok: /[0-9]/.test(newPassword) },
  ];
  const allRulesOk = passwordRules.every(r => r.ok);

  const mutation = useMutation({
    mutationFn: (newPasswordValue: string) =>
      api.post('/auth/reset-password', { token, newPassword: newPasswordValue }).then(r => r.data),
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    },
    onError: (err) => setError(errorMessage(err, 'Could not reset your password.')),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!allRulesOk) { setError('Password does not meet all requirements.'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    mutation.mutate(newPassword);
  }

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#1c1926]/80 backdrop-blur-md rounded-2xl border border-white/5 shadow-2xl p-8">
        {children}
      </div>
    </div>
  );

  if (!token) {
    return shell(
      <div className="text-center space-y-3">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
        <h1 className="text-lg font-semibold text-foreground">This link is incomplete</h1>
        <p className="text-sm text-white/60">Ask an administrator to send you a new reset link.</p>
        <button onClick={() => navigate('/login')} className="text-sm text-azure-400 hover:text-azure-300">
          Back to sign in
        </button>
      </div>,
    );
  }

  if (success) {
    return shell(
      <div className="text-center space-y-3">
        <CheckCircle className="w-10 h-10 text-green-400 mx-auto" />
        <h1 className="text-lg font-semibold text-foreground">Password set</h1>
        <p className="text-sm text-white/60">Taking you to the sign-in page…</p>
      </div>,
    );
  }

  const field = (
    label: string, value: string, onChange: (v: string) => void,
    show: boolean, toggle: () => void, id: string,
  ) => (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-white/60 mb-1.5">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          required
          className="w-full px-3 py-2.5 pr-10 text-sm bg-background border border-white/10 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-azure-500/40"
        />
        <button
          type="button"
          onClick={toggle}
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );

  return shell(
    <>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-azure-500/10 flex items-center justify-center">
          <KeyRound className="w-5 h-5 text-azure-400" />
        </div>
        <div>
          <h1 className="font-semibold text-foreground">Choose a new password</h1>
          <p className="text-xs text-white/50">This link can only be used once.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {field('New password', newPassword, setNewPassword, showNew, () => setShowNew(v => !v), 'new-password')}
        {field('Confirm password', confirmPassword, setConfirmPassword, showConfirm, () => setShowConfirm(v => !v), 'confirm-password')}

        <ul className="space-y-1">
          {passwordRules.map(rule => (
            <li key={rule.label} className={`text-xs flex items-center gap-2 ${rule.ok ? 'text-green-400' : 'text-white/40'}`}>
              <span aria-hidden>{rule.ok ? '✓' : '○'}</span>
              {rule.label}
            </li>
          ))}
        </ul>

        {error && <p className="text-xs text-rose-400">{error}</p>}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-azure-500 text-white rounded-xl hover:bg-azure-600 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Set password
        </button>
      </form>
    </>,
  );
}
