import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import ChatModal from './ChatModal';
import { useAuth } from '../../context/AuthContext';
import { MessageCircle, Check, X } from 'lucide-react';

const InboxPage = () => {
  const [conversations, setConversations] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedConvoId, setSelectedConvoId] = useState(null);
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [currentSessionToSchedule, setCurrentSessionToSchedule] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({
    numberOfWeeks: 1,
    daysOfWeek: [],
    timeOfDay: '',
    durationHours: 1,
  });
  const { user } = useAuth();

  const fetchInboxData = async () => {
    try {
      setLoading(true);
      const [conversationsRes, sessionsRes] = await Promise.all([
        api.get('/messages/conversations/my'),
        api.get('/sessions'),
      ]);
      setConversations(conversationsRes.data);
      
      // Filter sessions where current user is the teacher and status is pending
      const pending = sessionsRes.data.filter(
        (session) => session.teacher._id === user._id && session.status === 'pending'
      );
      setPendingRequests(pending);
      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch inbox data", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInboxData();
  }, [user]);

  const openChat = (convo) => {
    setSelectedRecipient(convo.participant);
    setSelectedConvoId(convo._id);
  };

  const handleAcceptSession = async () => {
    if (!currentSessionToSchedule) {
      alert('No session selected.');
      return;
    }
    
    if (!scheduleForm.numberOfWeeks || scheduleForm.daysOfWeek.length === 0 || !scheduleForm.timeOfDay || !scheduleForm.durationHours) {
      alert('Please provide number of weeks, days of week, time, and duration.');
      return;
    }
    
    try {
      const response = await api.put(`/sessions/respond/${currentSessionToSchedule._id}`, {
        response: 'confirmed',
        numberOfWeeks: scheduleForm.numberOfWeeks,
        daysOfWeek: scheduleForm.daysOfWeek,
        timeOfDay: scheduleForm.timeOfDay,
        durationHours: scheduleForm.durationHours,
        scheduledTime: new Date().toISOString(),
      });
      
      setShowScheduleModal(false);
      setCurrentSessionToSchedule(null);
      setScheduleForm({ numberOfWeeks: 1, daysOfWeek: [], timeOfDay: '', durationHours: 1 });
      fetchInboxData();
      
      if (response.data.sessions) {
        alert(`Successfully created ${response.data.sessions.length} sessions!`);
      }
    } catch (err) {
      console.error("Failed to accept session", err);
      alert(err.response?.data?.msg || 'Error accepting session.');
    }
  };

  const handleDeclineSession = async (sessionId) => {
    if (window.confirm('Are you sure you want to decline this session request?')) {
      try {
        await api.put(`/sessions/respond/${sessionId}`, { response: 'cancelled' });
        fetchInboxData();
      } catch (err) {
        console.error("Failed to decline session", err);
        alert('Error declining session.');
      }
    }
  };

  if (loading) {
    return <div className="card"><h2>Loading inbox...</h2></div>;
  }

  return (
    <>
      {selectedConvoId && (
        <ChatModal
          conversationId={selectedConvoId}
          recipient={selectedRecipient}
          onClose={() => setSelectedConvoId(null)}
        />
      )}

      {showScheduleModal && currentSessionToSchedule && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center">
          <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Schedule Sessions with {currentSessionToSchedule.learner.username}</h3>
            <div className="mb-4">
              <label htmlFor="numberOfWeeks" className="block text-gray-700 text-sm font-bold mb-2">Number of Weeks:</label>
              <input
                type="number"
                id="numberOfWeeks"
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                value={scheduleForm.numberOfWeeks}
                onChange={(e) => setScheduleForm(prev => ({ ...prev, numberOfWeeks: parseInt(e.target.value) || 1 }))}
                min="1"
                max="12"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">Days of Week:</label>
              <div className="grid grid-cols-2 gap-2">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                  <label key={day} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={scheduleForm.daysOfWeek.includes(day)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setScheduleForm(prev => ({ ...prev, daysOfWeek: [...prev.daysOfWeek, day] }));
                        } else {
                          setScheduleForm(prev => ({ ...prev, daysOfWeek: prev.daysOfWeek.filter(d => d !== day) }));
                        }
                      }}
                      className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm text-gray-700">{day}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <label htmlFor="timeOfDay" className="block text-gray-700 text-sm font-bold mb-2">Time of Day:</label>
              <input
                type="time"
                id="timeOfDay"
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                value={scheduleForm.timeOfDay}
                onChange={(e) => setScheduleForm(prev => ({ ...prev, timeOfDay: e.target.value }))}
                required
              />
            </div>
            <div className="mb-6">
              <label htmlFor="durationHours" className="block text-gray-700 text-sm font-bold mb-2">Duration (hours):</label>
              <input
                type="number"
                id="durationHours"
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                value={scheduleForm.durationHours}
                onChange={(e) => setScheduleForm(prev => ({ ...prev, durationHours: parseFloat(e.target.value) || 1 }))}
                min="0.5"
                max="8"
                step="0.5"
                required
              />
            </div>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => {
                  setShowScheduleModal(false);
                  setCurrentSessionToSchedule(null);
                  setScheduleForm({ numberOfWeeks: 1, daysOfWeek: [], timeOfDay: '', durationHours: 1 });
                }}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleAcceptSession}
                className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
              >
                Confirm Schedule
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="bg-gray-50 min-h-screen w-screen" style={{ marginLeft: 'calc(-50vw + 50%)', marginRight: 'calc(-50vw + 50%)', width: '100vw' }}>
        <div className="w-full px-8 py-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Inbox</h2>

        {/* Pending Session Requests */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Pending Session Requests</h3>
          {pendingRequests.length > 0 ? (
            <div className="space-y-4">
              {pendingRequests.map((request) => (
                <div key={request._id} className="flex items-center justify-between p-4 rounded-lg border border-gray-200">
                  <div>
                    <p className="font-semibold text-gray-800">
                      {request.learner.username} requested a session on {request.skill}
                    </p>
                    <p className="text-sm text-gray-500">
                      Requested on: {new Date(request.requestedDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setCurrentSessionToSchedule(request);
                        setShowScheduleModal(true);
                      }}
                      className="p-2 rounded-full bg-green-100 text-green-600 hover:bg-green-200"
                      title="Accept Request"
                    >
                      <Check size={20} />
                    </button>
                    <button
                      onClick={() => handleDeclineSession(request._id)}
                      className="p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200"
                      title="Decline Request"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No pending session requests.</p>
          )}
        </div>

        {/* My Messages */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">My Messages</h3>
          {conversations.length > 0 ? (
            <div className="space-y-4">
              {conversations.map(convo => (
                <div key={convo._id} className="flex items-center justify-between p-4 rounded-lg border border-gray-200">
                  <div>
                    <p className="font-semibold text-gray-800">{convo.participant.username}</p>
                    <small className="text-gray-500">Last updated: {new Date(convo.updatedAt).toLocaleString()}</small>
                  </div>
                  <button
                    className="p-2 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200"
                    onClick={() => openChat(convo)}
                    title="Open Chat"
                  >
                    <MessageCircle size={20} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">You have no active conversations. Start a chat from a user's profile or session request.</p>
          )}
        </div>
        </div>
      </div>
    </>
  );
};

export default InboxPage;