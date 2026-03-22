import { useEffect, useState } from 'react';
import { api } from './utils/api';
import AuthView from './views/AuthView';
import DashboardView from './views/DashboardView';
import MyPostsView from './views/MyPostsView';
import MeetingsView from './views/MeetingsView';
import ProfileView from './views/ProfileView';
import AdminView from './views/AdminView';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('healthai_token') || '');
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('healthai_user');
    return raw ? JSON.parse(raw) : null;
  });
  
  const [view, setView] = useState('dashboard');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [theme, setTheme] = useState(localStorage.getItem('healthai_theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('healthai_theme', theme);
  }, [theme]);

  useEffect(() => {
    if (user && token) {
      loadNotifications();
    }
  }, [user, token, view]);

  async function loadNotifications() {
    if (!token) return;
    try {
      const data = await api('/api/notifications', {}, token);
      setNotifications(data);
    } catch (err) {
      console.error('Failed to load notifications', err);
    }
  }

  function handleLoginSuccess(newToken, newUser) {
    localStorage.setItem('healthai_token', newToken);
    localStorage.setItem('healthai_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setView('dashboard');
    showSuccess('Welcome back!');
  }

  function handleUpdateUser(updatedUser) {
    localStorage.setItem('healthai_user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  }

  function logout() {
    localStorage.removeItem('healthai_token');
    localStorage.removeItem('healthai_user');
    setToken('');
    setUser(null);
    setNotifications([]);
    setView('dashboard');
    showSuccess('Successfully logged out.');
  }

  function showSuccess(msg) {
    setMessage(msg);
    setError('');
    setTimeout(() => setMessage(''), 5000);
  }

  function showError(msg) {
    setError(msg);
    setMessage('');
    setTimeout(() => setError(''), 5000);
  }

  if (!user || !token) {
    return <AuthView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-shell animate-fade-in">
      <aside className="sidebar glass-sidebar">
        <div className="sidebar-header">
          <h2>HEALTH AI</h2>
          <div className="user-info">
            <div className="avatar">{user.name.charAt(0)}</div>
            <div>
              <p>{user.name}</p>
              <small className="role-badge">{user.role}</small>
            </div>
          </div>
        </div>

        <nav className="nav stack">
          <button className={`nav-button ${view === 'dashboard' ? 'active' : ''}`} onClick={() => setView('dashboard')}>
            <span className="icon">⊞</span> Dashboard
          </button>
          <button className={`nav-button ${view === 'my-posts' ? 'active' : ''}`} onClick={() => setView('my-posts')}>
            <span className="icon">✏️</span> My Posts
          </button>
          <button className={`nav-button ${view === 'meetings' ? 'active' : ''}`} onClick={() => setView('meetings')}>
            <span className="icon">🤝</span> Meetings
          </button>
          <button className={`nav-button ${view === 'profile' ? 'active' : ''}`} onClick={() => setView('profile')}>
            <span className="icon">⚙️</span> Profile & GDPR
          </button>
          {user.role === 'admin' && (
            <button className={`nav-button admin-btn ${view === 'admin' ? 'active' : ''}`} onClick={() => setView('admin')}>
              <span className="icon">🛡️</span> Admin Panel
            </button>
          )}
        </nav>
        <div className="sidebar-footer">
          <button className="logout-button" onClick={logout}>⍈ Logout</button>
        </div>
      </aside>

      <main className="content">
        <header className="topbar glass">
          <div>
            <h1>
              {view === 'dashboard' ? 'Project Dashboard' : 
               view === 'my-posts' ? 'Post Management' : 
               view === 'meetings' ? 'Meeting Requests' : 
               view === 'admin' ? 'System Administration' : 
               'Profile & Settings'}
            </h1>
            <p className="breadcrumb">Health AI Platform / {view}</p>
          </div>
          <div className="row gap align-center">
            <button className="small-button secondary theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
              {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
            </button>
            <div className="notification-pill pulse">
              <span className="bell">🔔</span> {notifications.length} Alerts
            </div>
          </div>
        </header>

        {(message || error) && (
          <div className="toast-container">
            {message && <div className="toast success animate-slide-up">{message}</div>}
            {error && <div className="toast error animate-slide-up">{error}</div>}
          </div>
        )}

        <div className="view-container">
          {view === 'dashboard' && <DashboardView token={token} user={user} onSuccess={showSuccess} onError={showError} />}
          {view === 'my-posts' && <MyPostsView token={token} user={user} onSuccess={showSuccess} onError={showError} />}
          {view === 'meetings' && <MeetingsView token={token} user={user} onSuccess={showSuccess} onError={showError} />}
          {view === 'profile' && <ProfileView token={token} user={user} notifications={notifications} onUpdateUser={handleUpdateUser} onSuccess={showSuccess} onError={showError} />}
          {view === 'admin' && user.role === 'admin' && <AdminView token={token} onSuccess={showSuccess} onError={showError} />}
        </div>
      </main>
    </div>
  );
}
