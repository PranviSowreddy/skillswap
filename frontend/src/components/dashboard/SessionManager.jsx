import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import ReviewModal from './ReviewModal';
import { MessageCircle, Calendar, CalendarX, RefreshCw } from 'lucide-react';
import { formatFullDateTime } from '../../utils/timezone';

const SessionManager = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, loadUser } = useAuth();
  const { showToast } = useToast();
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
  const [rescheduleForm, setRescheduleForm] = useState({
    sessionId: null,
    dateTime: '',
    duration: null,
  });
  const [userProfile, setUserProfile] = useState(null);

  const fetchUserProfile = async () => {
    try {
      const res = await api.get('/profile');
      setUserProfile(res.data);
    } catch (err) {
      console.error('Failed to fetch user profile', err);
    }
  };

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
    if (user) {
      fetchUserProfile();
      fetchSessions();
    }
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
      showToast('Failed to respond to session', 'error');
    }
  };
  
  const handleScheduleSubmit = (e) => {
    e.preventDefault();
    const { sessionId, dateTime, duration } = scheduleForm;
    if (!dateTime || duration <= 0) {
      showToast('Please select a valid date/time and duration.', 'warning');
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
      showToast(err.response?.data?.msg || 'Failed to complete session', 'error');
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
      showToast("Could not open chat.", 'error');
    }
  };

  const handleReschedule = async (sessionId) => {
    const { dateTime, duration } = rescheduleForm;
    if (!dateTime) {
      showToast('Please select a new date and time.', 'warning');
      return;
    }
    try {
      await api.put(`/sessions/reschedule/${sessionId}`, {
        scheduledTime: new Date(dateTime).toISOString(),
        durationHours: duration || undefined,
      });
      fetchSessions();
      setRescheduleForm({ sessionId: null, dateTime: '', duration: null });
      showToast('Session rescheduled successfully!', 'success');
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.msg || 'Failed to reschedule session', 'error');
    }
  };

  const handleCancel = async (sessionId) => {
    if (!window.confirm('Are you sure you want to cancel this session? This will reduce your total hours.')) {
      return;
    }
    try {
      await api.put(`/sessions/cancel/${sessionId}`);
      fetchSessions();
      showToast('Session cancelled successfully!', 'success');
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.msg || 'Failed to cancel session', 'error');
    }
  };

  if (loading) return <div className="card"><p>Loading sessions...</p></div>;

  const pendingRequests = sessions.filter(
    (s) => s.status === 'pending' && s.teacher._id === user._id
  );
  const myRequests = sessions.filter(
    (s) => s.status === 'pending' && s.learner._id === user._id
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
                <p><strong>{s.learner.username}</strong> wants to learn <strong>{s.skill}</strong></p>
              </div>
              <div className="session-actions">
                <button 
                  className="btn btn-light btn-sm" 
                  title="Chat with user"
                  onClick={() => handleOpenChat(s.learner)}
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
            const otherUser = s.teacher._id === user._id ? s.learner : s.teacher;
            const isTeacher = s.teacher._id === user._id;
            return (
              <div key={s._id} className="session-list-item" style={{flexWrap: 'wrap'}}>
                <div className="session-info">
                  <p><strong>{s.skill}</strong> with <b>{otherUser.username}</b></p>
                  <small>On: {formatFullDateTime(s.scheduledTime, userProfile?.availability?.timeZone || 'Not set')}</small>
                  
                  <div style={{marginTop: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
                    {s.meetingLink && (
                      <a href={s.meetingLink} target="_blank" rel="noopener noreferrer" className="btn btn-success btn-sm">
                        Join Session
                      </a>
                    )}
                    {s.calendarLink && (
                      <a 
                        href={s.calendarLink} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="btn btn-light btn-sm"
                        style={{display: 'inline-flex', alignItems: 'center', gap: '5px'}}
                      >
                        <Calendar size={14} />
                        View in Calendar
                      </a>
                    )}
                  </div>
                </div>
                <div className="session-actions">
                  <button 
                    className="btn btn-light btn-sm" 
                    title="Chat with user"
                    onClick={() => handleOpenChat(otherUser)}
                  >
                    <MessageCircle size={16} />
                  </button>
                  <button 
                    className="btn btn-warning btn-sm" 
                    onClick={() => {
                      const currentDateTime = s.scheduledTime 
                        ? new Date(s.scheduledTime).toISOString().slice(0, 16)
                        : '';
                      setRescheduleForm({
                        sessionId: s._id, 
                        dateTime: currentDateTime, 
                        duration: s.durationHours || null
                      });
                    }}
                    title="Reschedule session"
                  >
                    <RefreshCw size={14} />
                  </button>
                  <button 
                    className="btn btn-danger btn-sm" 
                    onClick={() => handleCancel(s._id)}
                    title="Cancel session"
                  >
                    <CalendarX size={14} />
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => handleComplete(s._id)}>Mark as Complete</button>
                </div>
                
                {rescheduleForm.sessionId === s._id && (
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleReschedule(s._id);
                    }} 
                    style={{ background: '#f9f9f9', padding: '1.5rem', marginTop: '1rem', borderRadius: '5px', width: '100%' }}
                  >
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <div className="form-group" style={{ flex: 2, minWidth: '200px' }}>
                        <label>New Date & Time</label>
                        <input 
                          type="datetime-local" 
                          value={rescheduleForm.dateTime}
                          onChange={(e) => setRescheduleForm({...rescheduleForm, dateTime: e.target.value})}
                          required
                        />
                      </div>
                      <div className="form-group" style={{ flex: 1, minWidth: '100px' }}>
                        <label>Duration (hrs)</label>
                        <input 
                          type="number" min="0.5" step="0.5"
                          value={rescheduleForm.duration || s.durationHours}
                          onChange={(e) => setRescheduleForm({...rescheduleForm, duration: e.target.value})}
                        />
                      </div>
                    </div>
                    <div style={{ marginTop: '10px' }}>
                      <button type="submit" className="btn btn-primary btn-sm">Reschedule Session</button>
                      <button 
                        type="button" 
                        className="btn btn-light btn-sm" 
                        style={{marginLeft: '10px'}} 
                        onClick={() => setRescheduleForm({sessionId: null, dateTime: '', duration: null})}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
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
                <p>Request for <strong>{s.skill}</strong> with <strong>{s.teacher.username}</strong></p>
                <small>Status: Pending</small>
              </div>
              <div className="session-actions">
                <button 
                  className="btn btn-light btn-sm" 
                  title="Chat with user"
                  onClick={() => handleOpenChat(s.teacher)}
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
            const otherUser = s.teacher._id === user._id ? s.learner : s.teacher;
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