import { useState } from 'react';
import { api } from '../utils/api';

export default function AuthView({ onLoginSuccess }) {
  const [loginForm, setLoginForm] = useState({ email: 'engineer@cankaya.edu.tr', password: '123456' });
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '', role: 'engineer', city: '', institution: '' });
  const [verifyEmail, setVerifyEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError(''); setMessage(''); setLoading(true);
    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginForm),
      });
      onLoginSuccess(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError(''); setMessage(''); setLoading(true);
    try {
      const data = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(registerForm),
      });
      setVerifyEmail(registerForm.email);
      setMessage(`${data.message} Registered: ${registerForm.email}`);
      setRegisterForm({ name: '', email: '', password: '', role: 'engineer', city: '', institution: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e) {
    e.preventDefault();
    setError(''); setMessage(''); setLoading(true);
    try {
      const data = await api('/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ email: verifyEmail }),
      });
      setMessage(`${data.message} You can now log in.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-layout animate-fade-in">
      <div className="hero-card glass">
        <div className="hero-content">
          <h1>HEALTH AI Platform</h1>
          <p className="subtitle">Empowering Healthcare Collaboration</p>
          <ul className="features-list">
            <li>✓ Secure NDA-protected data sharing</li>
            <li>✓ Match with expert researchers</li>
            <li>✓ Modern encrypted communication</li>
          </ul>
          <div className="demo-box">
            <strong>Demo Accounts</strong>
            <p>admin@health.edu / 123456</p>
            <p>engineer@cankaya.edu.tr / 123456</p>
            <p>doctor@hacettepe.edu.tr / 123456</p>
          </div>
        </div>
      </div>

      <div className="auth-column">
        {error && <div className="toast error animate-slide-up">{error}</div>}
        {message && <div className="toast success animate-slide-up">{message}</div>}

        <section className="panel glass">
          <h2>Welcome Back</h2>
          <form onSubmit={handleLogin} className="stack">
            <input placeholder="Email Address" value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} />
            <input placeholder="Password" type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} />
            <button type="submit" className="primary-button" disabled={loading}>
              {loading ? <span className="spinner"></span> : 'Sign In'}
            </button>
          </form>
        </section>

        <section className="panel glass">
          <h2>Create Account</h2>
          <form onSubmit={handleRegister} className="stack">
            <input placeholder="Full Name" value={registerForm.name} onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })} />
            <input placeholder="Institutional Email (.edu or .edu.tr)" value={registerForm.email} onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })} />
            <input placeholder="Password" type="password" value={registerForm.password} onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })} />
            <select value={registerForm.role} onChange={(e) => setRegisterForm({ ...registerForm, role: e.target.value })}>
              <option value="engineer">Engineer</option>
              <option value="healthcare">Healthcare Professional</option>
            </select>
            <div className="row gap">
              <input placeholder="City" value={registerForm.city} onChange={(e) => setRegisterForm({ ...registerForm, city: e.target.value })} />
              <input placeholder="Institution" value={registerForm.institution} onChange={(e) => setRegisterForm({ ...registerForm, institution: e.target.value })} />
            </div>
            <button type="submit" className="primary-button outline" disabled={loading}>Register</button>
          </form>
        </section>

        <section className="panel glass">
          <h2>Verify Identity</h2>
          <form onSubmit={handleVerify} className="row gap">
            <input placeholder="Registered Email" value={verifyEmail} onChange={(e) => setVerifyEmail(e.target.value)} />
            <button type="submit" className="secondary" disabled={loading}>Verify</button>
          </form>
        </section>
      </div>
    </div>
  );
}
