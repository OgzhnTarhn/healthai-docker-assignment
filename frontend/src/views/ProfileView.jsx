import { useState } from 'react';
import { api } from '../utils/api';

export default function ProfileView({ token, user, notifications, onUpdateUser, onSuccess, onError }) {
  const [profileForm, setProfileForm] = useState({ name: user.name || '', city: user.city || '', institution: user.institution || '' });
  const [loading, setLoading] = useState(false);

  async function updateProfile(event) {
    event.preventDefault();
    try {
      setLoading(true);
      const updated = await api('/api/profile/me', {
        method: 'PUT',
        body: JSON.stringify(profileForm),
      }, token);
      onUpdateUser(updated);
      onSuccess('Profile updated successfully.');
    } catch (err) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function exportProfileData() {
    try {
      setLoading(true);
      const data = await api('/api/profile/export', {}, token);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'healthai-profile-export.json';
      link.click();
      URL.revokeObjectURL(url);
      onSuccess('Profile data exported.');
    } catch (err) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="grid two-col animate-fade-in">
      <div className="panel glass">
        <h2>Edit Profile</h2>
        <form onSubmit={updateProfile} className="stack">
          <input placeholder="Name" value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} />
          <input placeholder="City" value={profileForm.city} onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })} />
          <input placeholder="Institution" value={profileForm.institution} onChange={(e) => setProfileForm({ ...profileForm, institution: e.target.value })} />
          <button type="submit" className="primary-button" disabled={loading}>Save Settings</button>
        </form>

        <div className="gdpr-box mt-2">
          <h3>Data Privacy (GDPR)</h3>
          <p className="card-meta mb-1">Download a complete copy of your generated data, posts, and activity logs.</p>
          <button className="primary-button outline" onClick={exportProfileData} disabled={loading}>Export My Data (JSON)</button>
          
          <div className="warning-box mt-2">
            <strong>Danger Zone</strong>
            <p className="card-meta">This demo shows the warning screen only.</p>
            <button className="small-button danger" type="button">Delete Account (Demo Warning)</button>
          </div>
        </div>
      </div>

      <div className="panel glass">
        <h2>Recent Notifications</h2>
        <div className="stack scroll-y">
          {notifications.map((item) => (
            <div key={item.id} className="list-card hover-lift">
              <strong className="card-meta">{new Date(item.created_at).toLocaleString()}</strong>
              <p className="mt-1">{item.message}</p>
            </div>
          ))}
          {notifications.length === 0 && <span className="empty-state">No notifications yet.</span>}
        </div>
      </div>
    </section>
  );
}
