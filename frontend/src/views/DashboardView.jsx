import { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function DashboardView({ token, user, onSuccess, onError }) {
  const [posts, setPosts] = useState([]);
  const [filters, setFilters] = useState({ domain: '', city: '', status: '', expertise: '' });
  const [selectedPost, setSelectedPost] = useState(null);
  const [meetingForm, setMeetingForm] = useState({ message: '', proposedTimeSlot: '', ndaAccepted: false });
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState('newest');

  const getDomainEmoji = (domain) => {
    if (!domain) return '🔬';
    const d = domain.toLowerCase();
    if (d.includes('cardio') || d.includes('kalp')) return '🫀';
    if (d.includes('neuro') || d.includes('beyin') || d.includes('sinir')) return '🧠';
    if (d.includes('oncol') || d.includes('kanser')) return '🧬';
    if (d.includes('ortho') || d.includes('kemik')) return '🦴';
    if (d.includes('dent') || d.includes('diş')) return '🦷';
    if (d.includes('eye') || d.includes('göz')) return '👁️';
    if (d.includes('pedi') || d.includes('çocuk')) return '👶';
    if (d.includes('ai') || d.includes('yapay') || d.includes('data')) return '🤖';
    if (d.includes('software') || d.includes('yazılım')) return '💻';
    return '🔬';
  };

  useEffect(() => {
    loadPosts();
  }, [user]);

  async function loadPosts(currentFilters = filters) {
    try {
      setLoading(true);
      const params = new URLSearchParams({ ...currentFilters });
      if (user?.id) params.set('userId', user.id);
      const data = await api(`/api/posts?${params.toString()}`, {}, token);
      
      let finalData = data;
      if (sortBy === 'oldest') finalData = data.reverse();
      
      setPosts(finalData);
      if (selectedPost) {
        const current = finalData.find((p) => p.id === selectedPost.id);
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

  async function handleShare(post) {
    const text = `${post.title} - ${post.domain}, seeking ${post.required_expertise}!`;
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      onSuccess('Post details copied to clipboard!');
    }
  }

  const activeCount = posts.filter(p => p.status === 'active').length;
  const matchCount = posts.filter(p => p.status === 'partner_found').length;

  return (
    <section className="grid two-col animate-fade-in">
      <div className="stack">
        <div className="kpi-grid animate-slide-up">
          <div className="kpi-card">
            <span className="kpi-value">{posts.length}</span>
            <span className="kpi-label">Total Posts</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-value">{activeCount}</span>
            <span className="kpi-label">Active Posts</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-value">{matchCount}</span>
            <span className="kpi-label">Matches Found</span>
          </div>
        </div>

        <div className="panel glass">
          <h2>Search & Filter</h2>
        <form className="filters" onSubmit={(e) => { e.preventDefault(); applyFilters(); }}>
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
          <div className="row gap align-center">
            <select value={sortBy} onChange={(e) => { setSortBy(e.target.value); loadPosts(filters); }} style={{ width: '150px' }}>
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
            <button type="submit" className="primary-button" disabled={loading}>Apply Filters</button>
            <button type="button" className="secondary" onClick={clearFilters} disabled={loading}>Clear</button>
          </div>
        </form>

        <h3>Post Feed</h3>
        <div className="stack scroll-y">
          {loading && posts.length === 0 ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="list-card">
                <div className="card-header"><div className="skeleton skeleton-title"></div></div>
                <div className="skeleton skeleton-text"></div>
                <div className="skeleton skeleton-text" style={{ width: '80%' }}></div>
              </div>
            ))
          ) : (
            posts.map((post) => (
              <button key={post.id} className={`list-card hover-lift ${selectedPost?.id === post.id ? 'selected' : ''}`} onClick={() => setSelectedPost(post)}>
                <div className="card-header">
                  <strong>{getDomainEmoji(post.domain)} {post.title}</strong>
                  <span className={`badge ${post.status}`}>{post.status}</span>
                </div>
                <p className="card-meta">{post.domain} • {post.city} • Needed: {post.required_expertise}</p>
                <small className="card-owner">Owner: {post.owner_name}</small>
              </button>
            ))
          )}
          {posts.length === 0 && !loading && <span className="empty-state">No matching posts found.</span>}
        </div>
      </div>
      </div>

      <div className="panel glass sticky">
        <div className="card-header border-bottom pb-1">
          <h2>Post Detail</h2>
          {selectedPost && (
            <button className="small-button outline" onClick={() => handleShare(selectedPost)}>🔗 Share</button>
          )}
        </div>
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
