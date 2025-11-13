import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import ReviewModal from './ReviewModal';
import { MessageCircle } from 'lucide-react';

const SessionManager = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, loadUser } = useAuth();
  const navigate = useNavigate();

  const [scheduleForm, setScheduleForm] = useState({
    sessionId: null,
    dateTime: '',
    duration: 1,
    // meetingLink field is gone, as Zoom generates it
  });
  
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [reviewedSessionIds, setReviewedSessionIds] = useState(new Set());

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const res = await api.get('/sessions');
      setSessions(res.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [user]);

  const handleResponse = (sessionId, response) => {
    if (response === 'confirmed') {
      setScheduleForm({ 
        sessionId: sessionId, 
        dateTime: '', 
        duration: 1, 
      });
    } else {
      submitResponse(sessionId, 'cancelled');
    }
  };
  
  const submitResponse = async (sessionId, response, scheduleData = null) => {
    let body;
    if (response === 'confirmed') {
      body = {
        response: 'confirmed',
        scheduledTime: new Date(scheduleData.dateTime).toISOString(),
        durationHours: Number(scheduleData.duration),
        // We no longer send meetingLink
      };
    } else {
      body = { response: 'cancelled' };
    }
    
    try {
      await api.put(`/sessions/respond/${sessionId}`, body);
      fetchSessions();
    } catch (err) {
      console.error(err);
      alert('Failed to respond to session');
    }
  };
  
  const handleScheduleSubmit = (e) => {
    e.preventDefault();
    const { sessionId, dateTime, duration } = scheduleForm;
    if (!dateTime || duration <= 0) {
      alert('Please select a valid date/time and duration.');
      return;
    }
    submitResponse(sessionId, 'confirmed', scheduleForm);
    setScheduleForm({ sessionId: null, dateTime: '', duration: 1 });
  };
  
  const handleComplete = async (sessionId) => {
    if (!window.confirm('Are you sure you want to mark this session as complete?')) {
      return;
    }
    try {
      await api.put(`/sessions/complete/${sessionId}`);
      await loadUser();
      fetchSessions();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.msg || 'Failed to complete session');
    }
  };
  
  const openReviewModal = (session) => {
    setSelectedSession(session);
    setReviewModalOpen(true);
  };

  const onReviewSubmitted = () => {
    setReviewedSessionIds(prev => new Set(prev).add(selectedSession._id));
    loadUser();
  };

  const handleOpenChat = async (recipient) => {
    try {
      await api.get(`/messages/start/${recipient._id}`);
      navigate('/messages');
    } catch (err) {
      console.error("Failed to start chat", err);
      alert("Could not open chat.");
    }
  };

  if (loading) return <div className="card"><p>Loading sessions...</p></div>;

  const pendingRequests = sessions.filter(
    (s) => s.status === 'pending' && s.teacherId._id === user._id
  );
  const myRequests = sessions.filter(
    (s) => s.status === 'pending' && s.learnerId._id === user._id
  );
  const confirmedSessions = sessions.filter(s => s.status === 'confirmed');
  const completedSessions = sessions.filter(s => s.status === 'completed');

  return (
    <>
      {reviewModalOpen && (
        <ReviewModal
          session={selectedSession}
          onClose={() => setReviewModalOpen(false)}
          onReviewSubmitted={onReviewSubmitted}
        />
      )}
    
      <div className="card">
        <h3>My Sessions</h3>
        
        {/* 1. Pending Requests for Me */}
        <h4 style={{marginTop: '1rem'}}>Pending Requests for Me</h4>
        {pendingRequests.length > 0 ? (
          pendingRequests.map(s => (
            <div key={s._id} className="session-list-item" style={{flexWrap: 'wrap'}}>
              <div className="session-info">
                <p><strong>{s.learnerId.username}</strong> wants to learn <strong>{s.skill}</strong></p>
              </div>
              <div className="session-actions">
                <button 
                  className="btn btn-light btn-sm" 
                  title="Chat with user"
                  onClick={() => handleOpenChat(s.learnerId)}
                >
                  <MessageCircle size={16} />
                </button>
                <button className="btn btn-success btn-sm" onClick={() => handleResponse(s._id, 'confirmed')}>Accept</button>
                <button className="btn btn-danger btn-sm" onClick={() => handleResponse(s._id, 'cancelled')}>Decline</button>
              </div>
              
              {scheduleForm.sessionId === s._id && (
                <form onSubmit={handleScheduleSubmit} style={{ background: '#f9f9f9', padding: '1.5rem', marginTop: '1rem', borderRadius: '5px', width: '100%' }}>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ flex: 2, minWidth: '200px' }}>
                      <label>Date & Time</label>
                      <input 
                        type="datetime-local" 
                        value={scheduleForm.dateTime}
                        onChange={(e) => setScheduleForm({...scheduleForm, dateTime: e.target.value})}
                        required
                      />
                    </div>
                    <div className="form-group" style={{ flex: 1, minWidth: '100px' }}>
                      <label>Duration (hrs)</label>
                      <input 
                        type="number" min="0.5" step="0.5"
                        value={scheduleForm.duration}
                        onChange={(e) => setScheduleForm({...scheduleForm, duration: e.target.value})}
                        required
                      />
                    </div>
                  </div>
                  {/* The Meeting Link input field is intentionally removed */}
                  <button type="submit" className="btn btn-primary btn-sm">Confirm Session</button>
                  <button type="button" className="btn btn-light btn-sm" style={{marginLeft: '10px'}} onClick={() => setScheduleForm({sessionId: null, dateTime: '', duration: 1})}>Cancel</button>
                </form>
              )}
            </div>
          ))
        ) : (
          <p>No pending requests for you.</p>
        )}
        
        {/* 2. My Upcoming Sessions */}
        <h4 style={{marginTop: '2rem'}}>My Upcoming Sessions</h4>
        {confirmedSessions.length > 0 ? (
          confirmedSessions.map(s => {
            const otherUser = s.teacherId._id === user._id ? s.learnerId : s.teacherId;
            return (
              <div key={s._id} className="session-list-item">
                <div className="session-info">
                  <p><strong>{s.skill}</strong> with <b>{otherUser.username}</b></p>
                  <small>On: {new Date(s.scheduledTime).toLocaleString()}</small>
                  
                  {s.meetingLink && (
                    <div style={{marginTop: '10px'}}>
                      <a href={s.meetingLink} target="_blank" rel="noopener noreferrer" className="btn btn-success btn-sm">
                        Join Session
                      </a>
                    </div>
                  )}
                </div>
                <div className="session-actions">
                  <button 
                    className="btn btn-light btn-sm" 
                    title="Chat with user"
                    onClick={() => handleOpenChat(otherUser)}
                  >
                    <MessageCircle size={16} />
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => handleComplete(s._id)}>Mark as Complete</button>
                </div>
              </div>
            );
          })
        ) : (
          <p>No upcoming sessions.</p>
        )}

        {/* 3. My Outgoing Requests */}
        <h4 style={{marginTop: '2rem'}}>My Outgoing Requests (Pending)</h4>
        {myRequests.length > 0 ? (
          myRequests.map(s => (
            <div key={s._id} className="session-list-item">
              <div className="session-info">
                <p>Request for <strong>{s.skill}</strong> with <strong>{s.teacherId.username}</strong></p>
                <small>Status: Pending</small>
              </div>
              <div className="session-actions">
                <button 
                  className="btn btn-light btn-sm" 
                  title="Chat with user"
                  onClick={() => handleOpenChat(s.teacherId)}
                >
                  <MessageCircle size={16} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <p>You have no pending outgoing requests.</p>
        )}
        
        {/* 4. Completed Sessions */}
        <h4 style={{marginTop: '2rem'}}>My Completed Sessions</h4>
        {completedSessions.length > 0 ? (
          completedSessions.map(s => {
            const otherUser = s.teacherId._id === user._id ? s.learnerId : s.teacherId;
            return (
              <div key={s._id} className="session-list-item">
                <div className="session-info" style={{opacity: 0.7}}>
                  <p><strong>{s.skill}</strong> with <strong>{otherUser.username}</strong></p>
                  <small>Completed</small>
                </div>
                <div className="session-actions">
                  <button 
                    className="btn btn-warning btn-sm" 
                    onClick={() => openReviewModal(s)}
                    disabled={reviewedSessionIds.has(s._id)}
                  >
                    {reviewedSessionIds.has(s._id) ? 'Reviewed' : 'Leave Review'}
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <p>No sessions completed yet.</p>
        )}
      </div>
    </>
  );
};

export default SessionManager;