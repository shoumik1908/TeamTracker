import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const stars = useMemo(() => {
    return [...Array(40)].map(() => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      animationDelay: `${Math.random() * 4}s`
    }));
  }, []);

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        const res = await authApi.login({ email, password });
        login(res.data.token, res.data.user);
        navigate('/');
      } else {
        const res = await authApi.register({ name, email, password });
        login(res.data.token, res.data.user);
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-container">
      <div className="stars" id="stars">
        {stars.map((style, i) => (
          <span key={i} style={style} />
        ))}
      </div>

      {/* Left: brand / story panel */}
      <div className="brand">
        <div className="brand-top">
          <div className="mark">
            <img src="/logo.png" alt="Team Tracker Logo" />
          </div>
          <span className="brand-name">Team Tracker</span>
        </div>

        <div className="brand-mid">
          <h1>Team <span className="grad">Tracker</span></h1>
          <p className="desc">Track your team's progress and status in real time, all from one secure workspace.</p>
        </div>

        <div className="brand-bottom">
          <span>© 2026 Team Tracker</span>
          <a href="#">Need help?</a>
        </div>
      </div>

      {/* Right: credentials panel */}
      <div className="auth">
        <div className="auth-card">
          <div className="auth-heading">
            <h2 id="heading-title">{isLogin ? 'Welcome back' : 'Create your account'}</h2>
            <p id="heading-sub">{isLogin ? 'Sign in to continue to your workspace.' : 'Get started tracking your team in minutes.'}</p>
          </div>

          <div className="tabs">
            <button type="button" className={`tab ${isLogin ? 'active' : ''}`} onClick={() => { setIsLogin(true); setError(''); }}>Sign in</button>
            <button type="button" className={`tab ${!isLogin ? 'active' : ''}`} onClick={() => { setIsLogin(false); setError(''); }}>Sign up</button>
          </div>

          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                {error}
              </div>
            )}

            {!isLogin && (
              <div className="field" id="name-field">
                <label htmlFor="name">Full name</label>
                <input type="text" id="name" placeholder="Jordan Lee" autoComplete="name" value={name} onChange={e => setName(e.target.value)} required={!isLogin} />
              </div>
            )}

            <div className="field">
              <label htmlFor="email">Email address</label>
              <input type="email" id="email" placeholder="name@xebia.com" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="input-wrap">
                <input type={showPassword ? 'text' : 'password'} id="password" placeholder="Enter your password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
                <button type="button" className="eye-btn" onClick={() => setShowPassword(!showPassword)} aria-label="Show password">
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.6 21.6 0 0 1 5.06-6.06M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a21.6 21.6 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" /><path d="M1 1l22 22" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" /><circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="row-between">
              {isLogin ? (
                <a href="#" className="link" onClick={(e) => { e.preventDefault(); setError('Please contact your administrator to reset your password.'); }}>Forgot Password?</a>
              ) : (
                <div />
              )}
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Processing...' : (isLogin ? 'Login' : 'Create account')}
              {!loading && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>}
            </button>
          </form>

          <div className="divider">or</div>

          <p className="footnote">
            {isLogin ? (
              <>Don't have an account? <a href="#" onClick={(e) => { e.preventDefault(); setIsLogin(false); setError(''); }}>Sign up</a></>
            ) : (
              <>Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); setIsLogin(true); setError(''); }}>Sign in</a></>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
