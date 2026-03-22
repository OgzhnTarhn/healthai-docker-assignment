import { useState, useEffect } from 'react';
import { api } from '../utils/api';

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

export default function MyPostsView({ token, user, onSuccess, onError }) {
  const [myPosts, setMyPosts] = useState([]);
  const [postForm, setPostForm] = useState(emptyPost);
  const [editingPostId, setEditingPostId] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadMyPosts();
  }, [user]);

  async function loadMyPosts() {
    try {
      setLoading(true);
      const params = new URLSearchParams({ userId: user.id });
      const data = await api(`/api/posts?${params.toString()}`, {}, token);
      setMyPosts(data.filter((post) => post.user_id === user.id));
    } catch (err) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
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
    try {
      setLoading(true);
      const payload = { ...postForm, status: forceStatus || postForm.status };
      if (editingPostId) {
        await api(`/api/posts/${editingPostId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        }, token);
        onSuccess('Post updated successfully.');
      } else {
        await api('/api/posts', {
          method: 'POST',
          body: JSON.stringify(payload),
        }, token);
        onSuccess(`Post saved as ${payload.status}.`);
      }
      fillPostForm();
      await loadMyPosts();
    } catch (err) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function changePostStatus(id, status) {
    try {
      setLoading(true);
      await api(`/api/posts/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }, token);
      onSuccess(`Post status changed to ${status}.`);
      await loadMyPosts();
    } catch (err) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="grid two-col animate-fade-in">
      <div className="panel glass">
        <h2>{editingPostId ? `Edit Post #${editingPostId}` : 'Create New Post'}</h2>
        <div className="stack form-grid">
          <input placeholder="Title" value={postForm.title} onChange={(e) => setPostForm({ ...postForm, title: e.target.value })} />
          <input placeholder="Working domain" value={postForm.domain} onChange={(e) => setPostForm({ ...postForm, domain: e.target.value })} />
          <input placeholder="Required expertise" value={postForm.required_expertise} onChange={(e) => setPostForm({ ...postForm, required_expertise: e.target.value })} />
          <input placeholder="Project stage" value={postForm.project_stage} onChange={(e) => setPostForm({ ...postForm, project_stage: e.target.value })} />
          
          <select value={postForm.confidentiality_level} onChange={(e) => setPostForm({ ...postForm, confidentiality_level: e.target.value })}>
            <option>Public short pitch</option>
            <option>Details discussed in meeting only</option>
          </select>
          
          <div className="row gap">
            <input placeholder="City" value={postForm.city} onChange={(e) => setPostForm({ ...postForm, city: e.target.value })} />
            <input placeholder="Country" value={postForm.country} onChange={(e) => setPostForm({ ...postForm, country: e.target.value })} />
          </div>
          
          <div className="row gap">
            <input placeholder="Collaboration type" value={postForm.collaboration_type} onChange={(e) => setPostForm({ ...postForm, collaboration_type: e.target.value })} />
            <input placeholder="Commitment level" value={postForm.commitment_level} onChange={(e) => setPostForm({ ...postForm, commitment_level: e.target.value })} />
          </div>

          <div className="row gap align-center">
            <input type="date" value={postForm.expiry_date} onChange={(e) => setPostForm({ ...postForm, expiry_date: e.target.value })} />
            <label className="checkbox">
              <input type="checkbox" checked={postForm.auto_close} onChange={(e) => setPostForm({ ...postForm, auto_close: e.target.checked })} />
              Auto-close
            </label>
          </div>

          <textarea placeholder="Description" value={postForm.description} onChange={(e) => setPostForm({ ...postForm, description: e.target.value })} />
          
          <div className="row gap wrap">
            <button className="primary-button outline" onClick={() => savePost('draft')} disabled={loading}>Save Draft</button>
            <button className="primary-button" onClick={() => savePost('active')} disabled={loading}>Publish Active</button>
            <button className="secondary" onClick={() => fillPostForm()} disabled={loading}>Clear Form</button>
          </div>
        </div>
      </div>

      <div className="panel glass">
        <h2>My List</h2>
        <div className="stack scroll-y">
          {myPosts.map((post) => (
            <div key={post.id} className="list-card hover-lift">
              <div className="card-header">
                <strong>{post.title}</strong>
                <span className={`badge ${post.status}`}>{post.status}</span>
              </div>
              <p className="card-meta">{post.domain} • {post.city}</p>
              <div className="row gap wrap mt-1">
                <button className="small-button" onClick={() => fillPostForm(post)}>Edit</button>
                <button className="small-button secondary" onClick={() => changePostStatus(post.id, 'active')}>Active</button>
                <button className="small-button accent" onClick={() => changePostStatus(post.id, 'partner_found')}>Found Partner</button>
              </div>
            </div>
          ))}
          {myPosts.length === 0 && !loading && <span className="empty-state">You haven't posted anything yet.</span>}
        </div>
      </div>
    </section>
  );
}
