import { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function DashboardView({ token, user, onSuccess, onError }) {
  const [posts, setPosts] = useState([]);
  const [filters, setFilters] = useState({ domain: '', city: '', status: '', expertise: '' });
  const [selectedPost, setSelectedPost] = useState(null);
  const [meetingForm, setMeetingForm] = useState({ message: '', proposedTimeSlot: '', ndaAccepted: false });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPosts();
  }, [user]);

  async function loadPosts(currentFilters = filters) {
    try {
      setLoading(true);
      const params = new URLSearchParams({ ...currentFilters });
      if (user?.id) params.set('userId', user.id);
      const data = await api(`/api/posts?${params.toString()}`, {}, token);
      setPosts(data);
      if (selectedPost) {
        const current = data.find((p) => p.id === selectedPost.id);
        if (current) setSelectedPost(current);
      }
    } catch (err) {
      onError(err.message);
    } finally {
      setLoading(false);
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

  async function submitMeetingRequest(event) {
    event.preventDefault();
    if (!selectedPost) return;
    try {
      setLoading(true);
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
      onSuccess('Meeting request sent.');
    } catch (err) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="grid two-col animate-fade-in">
      <div className="panel glass">
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
            <button className="primary-button" onClick={applyFilters} disabled={loading}>Apply Filters</button>
            <button className="secondary" onClick={clearFilters} disabled={loading}>Clear</button>
          </div>
        </div>

        <h3>Post Feed</h3>
        <div className="stack scroll-y">
          {posts.map((post) => (
            <button key={post.id} className={`list-card hover-lift ${selectedPost?.id === post.id ? 'selected' : ''}`} onClick={() => setSelectedPost(post)}>
              <div className="card-header">
                <strong>{post.title}</strong>
                <span className={`badge ${post.status}`}>{post.status}</span>
              </div>
              <p className="card-meta">{post.domain} • {post.city} • Needed: {post.required_expertise}</p>
              <small className="card-owner">Owner: {post.owner_name}</small>
            </button>
          ))}
          {posts.length === 0 && !loading && <span className="empty-state">No posts found.</span>}
        </div>
      </div>

      <div className="panel glass sticky">
        <h2>Post Detail</h2>
        {selectedPost ? (
          <div className="post-detail animate-slide-up">
            <h3>{selectedPost.title}</h3>
            <div className="detail-grid">
              <p><strong>Domain:</strong> {selectedPost.domain}</p>
              <p><strong>Expertise:</strong> {selectedPost.required_expertise}</p>
              <p><strong>Stage:</strong> {selectedPost.project_stage}</p>
              <p><strong>Confidentiality:</strong> {selectedPost.confidentiality_level}</p>
              <p><strong>City:</strong> {selectedPost.city}</p>
            </div>
            <div className="description-box">
              <strong>Description:</strong>
              <p>{selectedPost.description}</p>
            </div>
            {!selectedPost.isOwner && user.id !== selectedPost.user_id ? (
              <form onSubmit={submitMeetingRequest} className="stack meeting-box">
                <h3>Request Meeting</h3>
                <textarea placeholder="Why are you interested?" value={meetingForm.message} onChange={(e) => setMeetingForm({ ...meetingForm, message: e.target.value })} />
                <input placeholder="Proposed time slot (e.g. 2026-03-25 14:00)" value={meetingForm.proposedTimeSlot} onChange={(e) => setMeetingForm({ ...meetingForm, proposedTimeSlot: e.target.value })} />
                <label className="checkbox">
                  <input type="checkbox" checked={meetingForm.ndaAccepted} onChange={(e) => setMeetingForm({ ...meetingForm, ndaAccepted: e.target.checked })} />
                  I accept the NDA requirement if applicable.
                </label>
                <button type="submit" className="primary-button" disabled={loading}>Express Interest</button>
              </form>
            ) : (
              <div className="info-box">This is your own post. Use My Posts to edit or update status.</div>
            )}
          </div>
        ) : (
          <div className="empty-box">Select a post from the feed to view details.</div>
        )}
      </div>
    </section>
  );
}
