import { useEffect, useMemo, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const emptyPost = {
  title: '',
  domain: '',
  required_expertise: '',
  project_stage: 'Idea',
  confidentiality_level: 'Public short pitch',
  city: '',
  country: 'Türkiye',
  description: '',
  collaboration_type: '',
  commitment_level: '',
  expiry_date: '',
  auto_close: false,
  status: 'draft',
};

async function api(path, options = {}, token) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ message: 'Request failed.' }));
    throw new Error(data.message || 'Request failed.');
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('healthai_token') || '');
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('healthai_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [view, setView] = useState('dashboard');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [posts, setPosts] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [users, setUsers] = useState([]);
  const [adminPosts, setAdminPosts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selectedPost, setSelectedPost] = useState(null);
  const [postForm, setPostForm] = useState(emptyPost);
  const [editingPostId, setEditingPostId] = useState(null);
  const [filters, setFilters] = useState({ domain: '', city: '', status: '', expertise: '' });
  const [loginForm, setLoginForm] = useState({ email: 'engineer@cankaya.edu.tr', password: '123456' });
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '', role: 'engineer', city: '', institution: '' });
  const [verifyEmail, setVerifyEmail] = useState('');
  const [meetingForm, setMeetingForm] = useState({ message: '', proposedTimeSlot: '', ndaAccepted: false });
  const [profileForm, setProfileForm] = useState({ name: '', city: '', institution: '' });
  const [adminFilters, setAdminFilters] = useState({ userRole: '', postStatus: '', logAction: '' });

  const myPosts = useMemo(() => posts.filter((post) => user && post.user_id === user.id), [posts, user]);

  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name || '',
        city: user.city || '',
        institution: user.institution || '',
      });
      refreshAll();
    }
  }, [user]);

  async function refreshAll() {
    try {
      await Promise.all([loadPosts(), loadMeetings(), loadNotifications(), user?.role === 'admin' ? loadAdminData() : Promise.resolve()]);
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadPosts(currentFilters = filters) {
    const params = new URLSearchParams({ ...currentFilters });
    if (user?.id) params.set('userId', user.id);
    const data = await api(`/api/posts?${params.toString()}`);
    setPosts(data);
    if (selectedPost) {
      const current = data.find((p) => p.id === selectedPost.id);
      if (current) setSelectedPost(current);
    }
  }

  async function loadMeetings() {
    if (!token) return;
    const data = await api('/api/meetings/mine', {}, token);
    setMeetings(data);
  }

  async function loadNotifications() {
    if (!token) return;
    const data = await api('/api/notifications', {}, token);
    setNotifications(data);
  }

  async function loadAdminData(currentFilters = adminFilters) {
    const userParams = new URLSearchParams();
    const postParams = new URLSearchParams();
    const logParams = new URLSearchParams();
    if (currentFilters.userRole) userParams.set('role', currentFilters.userRole);
    if (currentFilters.postStatus) postParams.set('status', currentFilters.postStatus);
    if (currentFilters.logAction) logParams.set('action', currentFilters.logAction);

    const [usersData, postsData, logsData] = await Promise.all([
      api(`/api/admin/users?${userParams.toString()}`, {}, token),
      api(`/api/admin/posts?${postParams.toString()}`, {}, token),
      api(`/api/admin/logs?${logParams.toString()}`, {}, token),
    ]);
    setUsers(usersData);
    setAdminPosts(postsData);
    setLogs(logsData);
  }

  async function handleLogin(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginForm),
      });
      localStorage.setItem('healthai_token', data.token);
      localStorage.setItem('healthai_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      setView('dashboard');
      setMessage('Login successful.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      const data = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(registerForm),
      });
      setVerifyEmail(registerForm.email);
      setMessage(`${data.message} Registered email: ${registerForm.email}`);
      setRegisterForm({ name: '', email: '', password: '', role: 'engineer', city: '', institution: '' });
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleVerify() {
    setError('');
    setMessage('');
    try {
      const data = await api('/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ email: verifyEmail }),
      });
      setMessage(`${data.message} You can now log in.`);
    } catch (err) {
      setError(err.message);
    }
  }

  function logout() {
    localStorage.removeItem('healthai_token');
    localStorage.removeItem('healthai_user');
    setToken('');
    setUser(null);
    setPosts([]);
    setMeetings([]);
    setNotifications([]);
    setUsers([]);
    setAdminPosts([]);
    setLogs([]);
    setSelectedPost(null);
    setView('dashboard');
    setMessage('Logged out.');
  }

  function fillPostForm(post = null) {
    if (!post) {
      setEditingPostId(null);
      setPostForm(emptyPost);
      return;
    }
    setEditingPostId(post.id);
    setPostForm({
      title: post.title || '',
      domain: post.domain || '',
      required_expertise: post.required_expertise || '',
      project_stage: post.project_stage || 'Idea',
      confidentiality_level: post.confidentiality_level || 'Public short pitch',
      city: post.city || '',
      country: post.country || 'Türkiye',
      description: post.description || '',
      collaboration_type: post.collaboration_type || '',
      commitment_level: post.commitment_level || '',
      expiry_date: post.expiry_date ? String(post.expiry_date).slice(0, 10) : '',
      auto_close: Boolean(post.auto_close),
      status: post.status || 'draft',
    });
  }

  async function savePost(forceStatus = null) {
    setError('');
    setMessage('');
    try {
      const payload = { ...postForm, status: forceStatus || postForm.status };
      if (editingPostId) {
        await api(`/api/posts/${editingPostId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        }, token);
        setMessage('Post updated successfully.');
      } else {
        await api('/api/posts', {
          method: 'POST',
          body: JSON.stringify(payload),
        }, token);
        setMessage(`Post saved as ${payload.status}.`);
      }
      fillPostForm();
      await loadPosts();
      if (user?.role === 'admin') await loadAdminData();
      setView('my-posts');
    } catch (err) {
      setError(err.message);
    }
  }

  async function changePostStatus(id, status) {
    setError('');
    setMessage('');
    try {
      await api(`/api/posts/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }, token);
      await loadPosts();
      if (user?.role === 'admin') await loadAdminData();
      setMessage(`Post status changed to ${status}.`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitMeetingRequest(event) {
    event.preventDefault();
    if (!selectedPost) return;
    setError('');
    setMessage('');
    try {
      await api('/api/meetings', {
        method: 'POST',
        body: JSON.stringify({
          postId: selectedPost.id,
          message: meetingForm.message,
          proposedTimeSlot: meetingForm.proposedTimeSlot,
          ndaAccepted: meetingForm.ndaAccepted,
        }),
      }, token);
      setMeetingForm({ message: '', proposedTimeSlot: '', ndaAccepted: false });
      setMessage('Meeting request sent.');
      await loadMeetings();
      await loadNotifications();
    } catch (err) {
      setError(err.message);
    }
  }

  async function respondMeeting(id, status) {
    setError('');
    setMessage('');
    try {
      await api(`/api/meetings/${id}/respond`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }, token);
      setMessage(`Meeting request ${status}.`);
      await loadMeetings();
      await loadPosts();
      await loadNotifications();
      if (user?.role === 'admin') await loadAdminData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function updateProfile(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      const updated = await api('/api/profile/me', {
        method: 'PUT',
        body: JSON.stringify(profileForm),
      }, token);
      setUser(updated);
      localStorage.setItem('healthai_user', JSON.stringify(updated));
      setMessage('Profile updated.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function exportProfileData() {
    setError('');
    setMessage('');
    try {
      const data = await api('/api/profile/export', {}, token);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'healthai-profile-export.json';
      link.click();
      URL.revokeObjectURL(url);
      setMessage('Profile data exported.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function applyAdminFilters() {
    try {
      await loadAdminData(adminFilters);
    } catch (err) {
      setError(err.message);
    }
  }

  async function clearAdminFilters() {
    const next = { userRole: '', postStatus: '', logAction: '' };
    setAdminFilters(next);
    try {
      await loadAdminData(next);
    } catch (err) {
      setError(err.message);
    }
  }

  async function removePostAdmin(id) {
    setError('');
    setMessage('');
    try {
      await api(`/api/admin/posts/${id}`, { method: 'DELETE' }, token);
      setMessage('Post removed by admin.');
      await loadAdminData();
      await loadPosts();
    } catch (err) {
      setError(err.message);
    }
  }

  async function exportLogsCsv() {
    setError('');
    setMessage('');
    try {
      const csvText = await api('/api/admin/logs/export', {
        headers: {
          Accept: 'text/csv',
        },
      }, token);
      const blob = new Blob([csvText], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'activity_logs.csv';
      link.click();
      URL.revokeObjectURL(url);
      setMessage('CSV exported.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function applyFilters() {
    await loadPosts(filters);
  }

  async function clearFilters() {
    const next = { domain: '', city: '', status: '', expertise: '' };
    setFilters(next);
    await loadPosts(next);
  }

  if (!user) {
    return (
      <div className="auth-layout">
        <div className="hero-card">
          <h1>HEALTH AI Platform</h1>
          <p>React + Express.js + PostgreSQL + Docker Compose</p>
          <ul>
            <li>Invalid non-.edu registration check</li>
            <li>Mocked email verification</li>
            <li>Posts, filters, meeting requests, admin panel</li>
          </ul>
          <div className="demo-box">
            <strong>Seed accounts</strong>
            <p>admin@health.edu / 123456</p>
            <p>engineer@cankaya.edu.tr / 123456</p>
            <p>doctor@hacettepe.edu.tr / 123456</p>
          </div>
        </div>

        <div className="auth-column">
          <section className="panel">
            <h2>Login</h2>
            <form onSubmit={handleLogin} className="stack">
              <input placeholder="Email" value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} />
              <input placeholder="Password" type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} />
              <button type="submit">Login</button>
            </form>
          </section>

          <section className="panel">
            <h2>Register</h2>
            <form onSubmit={handleRegister} className="stack">
              <input placeholder="Full name" value={registerForm.name} onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })} />
              <input placeholder="Institutional email" value={registerForm.email} onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })} />
              <input placeholder="Password" type="password" value={registerForm.password} onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })} />
              <select value={registerForm.role} onChange={(e) => setRegisterForm({ ...registerForm, role: e.target.value })}>
                <option value="engineer">Engineer</option>
                <option value="healthcare">Healthcare Professional</option>
              </select>
              <input placeholder="City" value={registerForm.city} onChange={(e) => setRegisterForm({ ...registerForm, city: e.target.value })} />
              <input placeholder="Institution" value={registerForm.institution} onChange={(e) => setRegisterForm({ ...registerForm, institution: e.target.value })} />
              <button type="submit">Register</button>
            </form>
          </section>

          <section className="panel">
            <h2>Mock Email Verification</h2>
            <div className="stack">
              <input placeholder="Registered email" value={verifyEmail} onChange={(e) => setVerifyEmail(e.target.value)} />
              <button onClick={handleVerify}>Verify Email</button>
            </div>
          </section>

          {message && <div className="success">{message}</div>}
          {error && <div className="error">{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h2>HEALTH AI</h2>
        <p>{user.name}</p>
        <small>{user.role}</small>
        <nav className="nav stack">
          <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>Dashboard</button>
          <button className={view === 'my-posts' ? 'active' : ''} onClick={() => { setView('my-posts'); fillPostForm(); }}>My Posts</button>
          <button className={view === 'meetings' ? 'active' : ''} onClick={() => setView('meetings')}>Meetings</button>
          <button className={view === 'profile' ? 'active' : ''} onClick={() => setView('profile')}>Profile & GDPR</button>
          {user.role === 'admin' && <button className={view === 'admin' ? 'active' : ''} onClick={() => setView('admin')}>Admin Panel</button>}
        </nav>
        <button className="secondary" onClick={logout}>Logout</button>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <h1>{view === 'dashboard' ? 'Dashboard' : view === 'my-posts' ? 'Post Management' : view === 'meetings' ? 'Meeting Requests' : view === 'admin' ? 'Admin Panel' : 'Profile & GDPR'}</h1>
            <p>Backend-connected demo application</p>
          </div>
          <div className="notification-pill">Notifications: {notifications.length}</div>
        </header>

        {message && <div className="success">{message}</div>}
        {error && <div className="error">{error}</div>}

        {view === 'dashboard' && (
          <section className="grid two-col">
            <div className="panel">
              <h2>Search & Filter</h2>
              <div className="filters">
                <input placeholder="Domain" value={filters.domain} onChange={(e) => setFilters({ ...filters, domain: e.target.value })} />
                <input placeholder="City" value={filters.city} onChange={(e) => setFilters({ ...filters, city: e.target.value })} />
                <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                  <option value="">All statuses</option>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="meeting_scheduled">Meeting Scheduled</option>
                  <option value="partner_found">Partner Found</option>
                  <option value="expired">Expired</option>
                </select>
                <input placeholder="Required expertise" value={filters.expertise} onChange={(e) => setFilters({ ...filters, expertise: e.target.value })} />
                <div className="row gap">
                  <button onClick={applyFilters}>Apply Filters</button>
                  <button className="secondary" onClick={clearFilters}>Clear</button>
                </div>
              </div>

              <h3>Post Feed</h3>
              <div className="stack">
                {posts.map((post) => (
                  <button key={post.id} className={`card-button ${selectedPost?.id === post.id ? 'selected' : ''}`} onClick={() => setSelectedPost(post)}>
                    <div className="card-header">
                      <strong>{post.title}</strong>
                      <span className={`badge ${post.status}`}>{post.status}</span>
                    </div>
                    <p>{post.domain} • {post.city} • Needed: {post.required_expertise}</p>
                    <small>Owner: {post.owner_name}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="panel">
              <h2>Post Detail</h2>
              {selectedPost ? (
                <>
                  <h3>{selectedPost.title}</h3>
                  <p><strong>Domain:</strong> {selectedPost.domain}</p>
                  <p><strong>Expertise:</strong> {selectedPost.required_expertise}</p>
                  <p><strong>Stage:</strong> {selectedPost.project_stage}</p>
                  <p><strong>Confidentiality:</strong> {selectedPost.confidentiality_level}</p>
                  <p><strong>City:</strong> {selectedPost.city}</p>
                  <p><strong>Description:</strong> {selectedPost.description}</p>
                  {!selectedPost.isOwner && user.id !== selectedPost.user_id ? (
                    <form onSubmit={submitMeetingRequest} className="stack meeting-box">
                      <h3>Request Meeting</h3>
                      <textarea placeholder="Why are you interested?" value={meetingForm.message} onChange={(e) => setMeetingForm({ ...meetingForm, message: e.target.value })} />
                      <input placeholder="Proposed time slot (e.g. 2026-03-25 14:00)" value={meetingForm.proposedTimeSlot} onChange={(e) => setMeetingForm({ ...meetingForm, proposedTimeSlot: e.target.value })} />
                      <label className="checkbox">
                        <input type="checkbox" checked={meetingForm.ndaAccepted} onChange={(e) => setMeetingForm({ ...meetingForm, ndaAccepted: e.target.checked })} />
                        I accept the NDA requirement if applicable.
                      </label>
                      <button type="submit">Express Interest / Request Meeting</button>
                    </form>
                  ) : (
                    <div className="info-box">This is your own post. Use My Posts to edit or update status.</div>
                  )}
                </>
              ) : (
                <p>Select a post from the list to view details.</p>
              )}
            </div>
          </section>
        )}

        {view === 'my-posts' && (
          <section className="grid two-col">
            <div className="panel">
              <h2>{editingPostId ? `Edit Post #${editingPostId}` : 'Create New Post'}</h2>
              <div className="stack">
                <input placeholder="Title" value={postForm.title} onChange={(e) => setPostForm({ ...postForm, title: e.target.value })} />
                <input placeholder="Working domain" value={postForm.domain} onChange={(e) => setPostForm({ ...postForm, domain: e.target.value })} />
                <input placeholder="Required expertise" value={postForm.required_expertise} onChange={(e) => setPostForm({ ...postForm, required_expertise: e.target.value })} />
                <input placeholder="Project stage" value={postForm.project_stage} onChange={(e) => setPostForm({ ...postForm, project_stage: e.target.value })} />
                <select value={postForm.confidentiality_level} onChange={(e) => setPostForm({ ...postForm, confidentiality_level: e.target.value })}>
                  <option>Public short pitch</option>
                  <option>Details discussed in meeting only</option>
                </select>
                <input placeholder="City" value={postForm.city} onChange={(e) => setPostForm({ ...postForm, city: e.target.value })} />
                <input placeholder="Country" value={postForm.country} onChange={(e) => setPostForm({ ...postForm, country: e.target.value })} />
                <input placeholder="Collaboration type" value={postForm.collaboration_type} onChange={(e) => setPostForm({ ...postForm, collaboration_type: e.target.value })} />
                <input placeholder="Commitment level" value={postForm.commitment_level} onChange={(e) => setPostForm({ ...postForm, commitment_level: e.target.value })} />
                <input type="date" value={postForm.expiry_date} onChange={(e) => setPostForm({ ...postForm, expiry_date: e.target.value })} />
                <label className="checkbox">
                  <input type="checkbox" checked={postForm.auto_close} onChange={(e) => setPostForm({ ...postForm, auto_close: e.target.checked })} />
                  Auto-close on expiry
                </label>
                <textarea placeholder="Description" value={postForm.description} onChange={(e) => setPostForm({ ...postForm, description: e.target.value })} />
                <div className="row gap wrap">
                  <button onClick={() => savePost('draft')}>Save as Draft</button>
                  <button onClick={() => savePost('active')}>Publish</button>
                  <button className="secondary" onClick={() => fillPostForm()}>Clear</button>
                </div>
              </div>
            </div>

            <div className="panel">
              <h2>My Posts</h2>
              <div className="stack">
                {myPosts.map((post) => (
                  <div key={post.id} className="list-card">
                    <div className="card-header">
                      <strong>{post.title}</strong>
                      <span className={`badge ${post.status}`}>{post.status}</span>
                    </div>
                    <p>{post.domain} • {post.city}</p>
                    <div className="row gap wrap">
                      <button onClick={() => fillPostForm(post)}>Edit</button>
                      <button className="secondary" onClick={() => changePostStatus(post.id, 'active')}>Set Active</button>
                      <button className="secondary" onClick={() => changePostStatus(post.id, 'partner_found')}>Mark Partner Found</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {view === 'meetings' && (
          <section className="panel">
            <h2>Meeting Requests</h2>
            <div className="stack">
              {meetings.map((meeting) => {
                const ownerView = user.id === meeting.owner_id;
                return (
                  <div key={meeting.id} className="list-card">
                    <div className="card-header">
                      <strong>{meeting.post_title}</strong>
                      <span className={`badge ${meeting.status}`}>{meeting.status}</span>
                    </div>
                    <p><strong>Requester:</strong> {meeting.requester_name}</p>
                    <p><strong>Owner:</strong> {meeting.owner_name}</p>
                    <p><strong>Time Slot:</strong> {meeting.proposed_time_slot}</p>
                    <p><strong>Message:</strong> {meeting.message || '—'}</p>
                    <p><strong>NDA accepted:</strong> {meeting.nda_accepted ? 'Yes' : 'No'}</p>
                    {ownerView && meeting.status === 'pending' && (
                      <div className="row gap wrap">
                        <button onClick={() => respondMeeting(meeting.id, 'accepted')}>Accept</button>
                        <button className="secondary" onClick={() => respondMeeting(meeting.id, 'declined')}>Decline</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {view === 'profile' && (
          <section className="grid two-col">
            <div className="panel">
              <h2>Edit Profile</h2>
              <form onSubmit={updateProfile} className="stack">
                <input value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} />
                <input value={profileForm.city} onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })} />
                <input value={profileForm.institution} onChange={(e) => setProfileForm({ ...profileForm, institution: e.target.value })} />
                <button type="submit">Save Profile</button>
              </form>

              <div className="gdpr-box">
                <h3>GDPR</h3>
                <button onClick={exportProfileData}>Export My Data</button>
                <div className="warning-box">
                  <strong>Delete Account Flow</strong>
                  <p>This demo shows the warning screen only. Do not actually delete during presentation.</p>
                  <button className="danger" type="button">Delete Account (Demo Warning)</button>
                </div>
              </div>
            </div>

            <div className="panel">
              <h2>Notifications</h2>
              <div className="stack">
                {notifications.map((item) => (
                  <div key={item.id} className="list-card">
                    <strong>{new Date(item.created_at).toLocaleString()}</strong>
                    <p>{item.message}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {view === 'admin' && user.role === 'admin' && (
          <>
            <section className="panel">
              <h2>Admin Filters</h2>
              <div className="filters admin-filters">
                <select value={adminFilters.userRole} onChange={(e) => setAdminFilters({ ...adminFilters, userRole: e.target.value })}>
                  <option value="">All user roles</option>
                  <option value="admin">Admin</option>
                  <option value="engineer">Engineer</option>
                  <option value="healthcare">Healthcare Professional</option>
                </select>
                <select value={adminFilters.postStatus} onChange={(e) => setAdminFilters({ ...adminFilters, postStatus: e.target.value })}>
                  <option value="">All post statuses</option>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="meeting_scheduled">Meeting Scheduled</option>
                  <option value="partner_found">Partner Found</option>
                  <option value="expired">Expired</option>
                </select>
                <input placeholder="Filter logs by action" value={adminFilters.logAction} onChange={(e) => setAdminFilters({ ...adminFilters, logAction: e.target.value })} />
                <div className="row gap wrap">
                  <button onClick={applyAdminFilters}>Apply Admin Filters</button>
                  <button className="secondary" onClick={clearAdminFilters}>Clear</button>
                </div>
              </div>
            </section>
            <section className="grid three-col">
              <div className="panel">
                <div className="card-header">
                  <h2>Users</h2>
                  <span>{users.length}</span>
                </div>
                <div className="stack compact">
                  {users.map((account) => (
                    <div key={account.id} className="list-card compact">
                      <strong>{account.name}</strong>
                      <p>{account.email}</p>
                      <small>{account.role} • verified: {String(account.is_verified)}</small>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel">
                <div className="card-header">
                  <h2>Posts</h2>
                  <span>{adminPosts.length}</span>
                </div>
                <div className="stack compact">
                  {adminPosts.map((post) => (
                    <div key={post.id} className="list-card compact">
                      <strong>{post.title}</strong>
                      <p>{post.owner_name} • {post.status}</p>
                      <button className="danger" onClick={() => removePostAdmin(post.id)}>Remove</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel">
                <div className="card-header">
                  <h2>Activity Logs</h2>
                  <button onClick={exportLogsCsv}>Export CSV</button>
                </div>
                <div className="stack compact">
                  {logs.map((log) => (
                    <div key={log.id} className="list-card compact">
                      <strong>{log.action_type}</strong>
                      <p>{log.target_entity} • {log.result_status}</p>
                      <small>{new Date(log.created_at).toLocaleString()}</small>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
