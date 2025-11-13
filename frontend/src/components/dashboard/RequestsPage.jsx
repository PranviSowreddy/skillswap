import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Check, X, Clock, MessageSquare, Calendar } from 'lucide-react';

const RequestsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [currentSessionToSchedule, setCurrentSessionToSchedule] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({
    scheduledTime: '',
    durationHours: 1,
  });

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const res = await api.get('/sessions');
      setSessions(res.data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch sessions', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [user]);

  const handleAcceptSession = async () => {
    if (!currentSessionToSchedule || !scheduleForm.scheduledTime || !scheduleForm.durationHours) {
      alert('Please provide a scheduled time and duration.');
      return;
    }
    try {
      await api.put(`/sessions/respond/${currentSessionToSchedule._id}`, {
        response: 'confirmed',
        scheduledTime: new Date(scheduleForm.scheduledTime).toISOString(),
        durationHours: scheduleForm.durationHours,
      });
      setShowScheduleModal(false);
      setCurrentSessionToSchedule(null);
      setScheduleForm({ scheduledTime: '', durationHours: 1 });
      fetchSessions();
    } catch (err) {
      console.error('Failed to accept session', err);
      alert(err.response?.data?.msg || 'Error accepting session.');
    }
  };

  const handleDeclineSession = async (sessionId) => {
    if (window.confirm('Are you sure you want to decline this session request?')) {
      try {
        await api.put(`/sessions/respond/${sessionId}`, { response: 'declined' });
        fetchSessions();
      } catch (err) {
        console.error('Failed to decline session', err);
        alert('Error declining session.');
      }
    }
  };

  const handleStartChat = async (recipientId) => {
    try {
      const res = await api.get(`/messages/start/${recipientId}`);
      navigate(`/messages?conversation=${res.data._id}`);
    } catch (err) {
      console.error('Failed to start chat', err);
      alert('Could not open chat. Please try again.');
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (name) => {
    const colors = ['bg-orange-500', 'bg-red-500', 'bg-blue-500', 'bg-purple-500', 'bg-teal-500'];
    const index = name ? name.charCodeAt(0) % colors.length : 0;
    return colors[index];
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not scheduled';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Filter sessions
  const incomingRequests = sessions.filter(
    (s) => s.teacher._id === user._id && s.status === 'pending'
  );
  const outgoingRequests = sessions.filter(
    (s) => s.learner._id === user._id && s.status === 'pending'
  );
  const confirmedSessions = sessions.filter(
    (s) => (s.teacher._id === user._id || s.learner._id === user._id) && s.status === 'confirmed'
  );

  if (loading) {
    return (
      <div className="bg-gray-50 min-h-screen -m-8 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <p className="text-gray-500">Loading requests...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen -m-8 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Session Requests</h1>
        <p className="text-gray-500 mb-8">Manage your incoming and outgoing session requests</p>

        {/* Schedule Modal */}
        {showScheduleModal && currentSessionToSchedule && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">
                  Schedule Session with {currentSessionToSchedule.learner.username}
                </h3>
                <button
                  onClick={() => {
                    setShowScheduleModal(false);
                    setCurrentSessionToSchedule(null);
                    setScheduleForm({ scheduledTime: '', durationHours: 1 });
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={24} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Scheduled Time
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduleForm.scheduledTime}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, scheduledTime: e.target.value }))}
                    min={new Date().toISOString().slice(0, 16)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration (hours)
                  </label>
                  <input
                    type="number"
                    value={scheduleForm.durationHours}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, durationHours: parseFloat(e.target.value) || 1 }))}
                    min="0.5"
                    max="8"
                    step="0.5"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    required
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowScheduleModal(false);
                      setCurrentSessionToSchedule(null);
                      setScheduleForm({ scheduledTime: '', durationHours: 1 });
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAcceptSession}
                    className="flex-1 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
                  >
                    Confirm Schedule
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Incoming Requests */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">Incoming Requests</h2>
            {incomingRequests.length > 0 && (
              <span className="bg-orange-500 text-white text-xs font-bold rounded-full px-3 py-1">
                {incomingRequests.length}
              </span>
            )}
          </div>
          {incomingRequests.length > 0 ? (
            <div className="space-y-4">
              {incomingRequests.map((request) => (
                <div
                  key={request._id}
                  className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div
                      className={`w-12 h-12 ${getAvatarColor(request.learner.username)} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}
                    >
                      {getInitials(request.learner.username)}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800">
                        <span className="text-teal-600">{request.learner.username}</span> wants to learn{' '}
                        <span className="font-bold">{request.skill}</span>
                      </p>
                      <p className="text-sm text-gray-500">
                        Requested on {formatDate(request.requestedDate)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleStartChat(request.learner._id)}
                      className="p-2 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                      title="Chat with user"
                    >
                      <MessageSquare size={20} />
                    </button>
                    <button
                      onClick={() => {
                        setCurrentSessionToSchedule(request);
                        setShowScheduleModal(true);
                      }}
                      className="p-2 rounded-full bg-green-100 text-green-600 hover:bg-green-200 transition-colors"
                      title="Accept Request"
                    >
                      <Check size={20} />
                    </button>
                    <button
                      onClick={() => handleDeclineSession(request._id)}
                      className="p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                      title="Decline Request"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No incoming requests</p>
          )}
        </div>

        {/* Outgoing Requests */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">Outgoing Requests</h2>
            {outgoingRequests.length > 0 && (
              <span className="bg-blue-500 text-white text-xs font-bold rounded-full px-3 py-1">
                {outgoingRequests.length}
              </span>
            )}
          </div>
          {outgoingRequests.length > 0 ? (
            <div className="space-y-4">
              {outgoingRequests.map((request) => (
                <div
                  key={request._id}
                  className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div
                      className={`w-12 h-12 ${getAvatarColor(request.teacher.username)} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}
                    >
                      {getInitials(request.teacher.username)}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800">
                        You requested to learn <span className="font-bold">{request.skill}</span> from{' '}
                        <span className="text-teal-600">{request.teacher.username}</span>
                      </p>
                      <p className="text-sm text-gray-500">
                        Requested on {formatDate(request.requestedDate)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium flex items-center gap-1">
                      <Clock size={14} />
                      Pending
                    </span>
                    <button
                      onClick={() => handleStartChat(request.teacher._id)}
                      className="p-2 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                      title="Chat with teacher"
                    >
                      <MessageSquare size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No outgoing requests</p>
          )}
        </div>

        {/* Confirmed Sessions */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">Confirmed Sessions</h2>
            {confirmedSessions.length > 0 && (
              <span className="bg-green-500 text-white text-xs font-bold rounded-full px-3 py-1">
                {confirmedSessions.length}
              </span>
            )}
          </div>
          {confirmedSessions.length > 0 ? (
            <div className="space-y-4">
              {confirmedSessions.map((session) => {
                const otherUser = session.teacher._id === user._id ? session.learner : session.teacher;
                const isTeacher = session.teacher._id === user._id;
                return (
                  <div
                    key={session._id}
                    className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div
                        className={`w-12 h-12 ${getAvatarColor(otherUser.username)} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}
                      >
                        {getInitials(otherUser.username)}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800">
                          <span className="font-bold">{session.skill}</span> with{' '}
                          <span className="text-teal-600">{otherUser.username}</span>
                        </p>
                        <p className="text-sm text-gray-500">
                          <Calendar size={14} className="inline mr-1" />
                          {formatDate(session.scheduledTime)}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {isTeacher ? 'You are teaching' : 'You are learning'} • Duration: {session.durationHours} hour{session.durationHours !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                        Confirmed
                      </span>
                      {session.meetingLink && (
                        <a
                          href={isTeacher && session.startUrl ? session.startUrl : session.meetingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors text-sm font-medium"
                        >
                          {isTeacher ? 'Start' : 'Join'} Meeting
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No confirmed sessions</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default RequestsPage;

