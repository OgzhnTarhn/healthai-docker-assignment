import { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function MeetingsView({ token, user, onSuccess, onError }) {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadMeetings();
  }, [user]);

  async function loadMeetings() {
    try {
      setLoading(true);
      const data = await api('/api/meetings/mine', {}, token);
      setMeetings(data);
    } catch (err) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function respondMeeting(id, status) {
    try {
      setLoading(true);
      await api(`/api/meetings/${id}/respond`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }, token);
      onSuccess(`Meeting request ${status}.`);
      await loadMeetings();
    } catch (err) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel glass animate-fade-in">
      <h2>Meeting Requests</h2>
      <div className="stack">
        {meetings.map((meeting) => {
          const ownerView = user.id === meeting.owner_id;
          return (
            <div key={meeting.id} className="list-card hover-lift">
              <div className="card-header border-bottom">
                <strong>{meeting.post_title}</strong>
                <span className={`badge ${meeting.status}`}>{meeting.status}</span>
              </div>
              <div className="detail-grid mt-1">
                <p><strong>Requester:</strong> {meeting.requester_name}</p>
                <p><strong>Owner:</strong> {meeting.owner_name}</p>
                <p><strong>Time Slot:</strong> {meeting.proposed_time_slot}</p>
                <p><strong>NDA accepted:</strong> {meeting.nda_accepted ? 'Yes' : 'No'}</p>
              </div>
              <div className="description-box mt-1">
                <strong>Message:</strong>
                <p>{meeting.message || '—'}</p>
              </div>
              {ownerView && meeting.status === 'pending' && (
                <div className="row gap wrap mt-1">
                  <button className="primary-button" onClick={() => respondMeeting(meeting.id, 'accepted')} disabled={loading}>Accept</button>
                  <button className="primary-button danger" onClick={() => respondMeeting(meeting.id, 'declined')} disabled={loading}>Decline</button>
                </div>
              )}
            </div>
          );
        })}
        {meetings.length === 0 && !loading && <span className="empty-state">No meeting requests found.</span>}
      </div>
    </section>
  );
}
