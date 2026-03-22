import { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function AdminView({ token, onSuccess, onError }) {
  const [users, setUsers] = useState([]);
  const [adminPosts, setAdminPosts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [adminFilters, setAdminFilters] = useState({ userRole: '', postStatus: '', logAction: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAdminData();
  }, []);

  async function loadAdminData(currentFilters = adminFilters) {
    try {
      setLoading(true);
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
    } catch (err) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function applyAdminFilters() {
    await loadAdminData(adminFilters);
  }

  async function clearAdminFilters() {
    const next = { userRole: '', postStatus: '', logAction: '' };
    setAdminFilters(next);
    await loadAdminData(next);
  }

  async function removePostAdmin(id) {
    try {
      setLoading(true);
      await api(`/api/admin/posts/${id}`, { method: 'DELETE' }, token);
      onSuccess('Post removed by admin.');
      await loadAdminData();
    } catch (err) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function exportLogsCsv() {
    try {
      const csvText = await api('/api/admin/logs/export', { headers: { Accept: 'text/csv' } }, token);
      const blob = new Blob([csvText], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'activity_logs.csv';
      link.click();
      URL.revokeObjectURL(url);
      onSuccess('CSV exported successfully.');
    } catch (err) {
      onError(err.message);
    }
  }

  return (
    <div className="animate-fade-in stack">
      <section className="panel glass">
        <h2>Admin Filters</h2>
        <form className="filters admin-filters" onSubmit={(e) => { e.preventDefault(); applyAdminFilters(); }}>
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
            <button type="submit" className="primary-button outline" disabled={loading}>Apply Filters</button>
            <button type="button" className="secondary" onClick={clearAdminFilters} disabled={loading}>Clear Filters</button>
          </div>
        </form>
      </section>

      <section className="grid three-col">
        <div className="panel glass">
          <div className="card-header border-bottom pb-1">
            <h2>Users</h2>
            <span className="badge pending">{users.length}</span>
          </div>
          <div className="stack compact scroll-y mt-1" style={{ maxHeight: '400px' }}>
            {users.map((account) => (
              <div key={account.id} className="list-card compact hover-lift">
                <strong>{account.name}</strong>
                <p className="card-meta">{account.email}</p>
                <small className="card-owner">{account.role} • verified: {String(account.is_verified)}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="panel glass">
          <div className="card-header border-bottom pb-1">
            <h2>Posts</h2>
            <span className="badge pending">{adminPosts.length}</span>
          </div>
          <div className="stack compact scroll-y mt-1" style={{ maxHeight: '400px' }}>
            {adminPosts.map((post) => (
              <div key={post.id} className="list-card compact hover-lift">
                <strong>{post.title}</strong>
                <p className="card-meta">{post.owner_name} • {post.status}</p>
                <button className="small-button danger mt-1" onClick={() => removePostAdmin(post.id)} disabled={loading}>Remove</button>
              </div>
            ))}
          </div>
        </div>

        <div className="panel glass">
          <div className="card-header border-bottom pb-1">
            <h2>Activity Logs</h2>
            <button className="small-button outline" onClick={exportLogsCsv}>Export CSV</button>
          </div>
          <div className="stack compact scroll-y mt-1" style={{ maxHeight: '400px' }}>
            {logs.map((log) => (
              <div key={log.id} className="list-card compact hover-lift">
                <strong>{log.action_type}</strong>
                <p className="card-meta">{log.target_entity} • {log.result_status}</p>
                <small className="card-owner">{new Date(log.created_at).toLocaleString()}</small>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
