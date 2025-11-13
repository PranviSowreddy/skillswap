import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { Video, Calendar, Send, Bell, X } from 'lucide-react';

const ChatPage = () => {
  const { user } = useAuth();
  const socket = useSocket();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const messagesEndRef = useRef(null);
  const [unreadCounts, setUnreadCounts] = useState({});

  // Fetch conversations
  const fetchConversations = async () => {
    try {
      const res = await api.get('/messages/conversations/my');
      setConversations(res.data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch conversations', err);
      setLoading(false);
    }
  };

  // Fetch messages for selected conversation
  const fetchMessages = async (conversationId) => {
    try {
      const res = await api.get(`/messages/${conversationId}`);
      setMessages(res.data);
      // Mark messages as read
      if (socket && conversationId) {
        socket.emit('markAsRead', { conversationId, userId: user._id });
      }
    } catch (err) {
      console.error('Failed to fetch messages', err);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [user]);

  // Handle conversation from URL parameter
  useEffect(() => {
    const conversationId = searchParams.get('conversation');
    if (conversationId) {
      // First check if conversation exists in the list
      const conversation = conversations.find(c => c._id === conversationId);
      if (conversation) {
        setSelectedConversation(conversation);
        // Clear the URL parameter after setting conversation
        setSearchParams({});
      } else if (!loading) {
        // If conversation not in list, fetch it directly
        // This handles newly created conversations
        const fetchConversation = async () => {
          try {
            // Fetch all conversations again to get the new one
            const res = await api.get('/messages/conversations/my');
            setConversations(res.data);
            const foundConversation = res.data.find(c => c._id === conversationId);
            if (foundConversation) {
              setSelectedConversation(foundConversation);
              setSearchParams({});
            }
          } catch (err) {
            console.error('Failed to fetch conversation', err);
          }
        };
        fetchConversation();
      }
    }
  }, [conversations, searchParams, setSearchParams, loading]);

  // Socket connection and room joining
  useEffect(() => {
    if (!socket || !user) return;

    // Join user's personal room for notifications
    socket.emit('joinUserRoom', user._id);

    // Listen for new messages
    const handleReceiveMessage = (message) => {
      if (message.conversationId === selectedConversation?._id) {
        // Message is for current conversation
        setMessages((prev) => {
          // Check if this is a replacement for an optimistic message
          if (message.sender._id === user._id) {
            // This is my message - replace optimistic version
            const optimisticIndex = prev.findIndex(
              m => m.isOptimistic && m.sender._id === user._id && m.content === message.content
            );
            if (optimisticIndex > -1) {
              const newMessages = [...prev];
              newMessages[optimisticIndex] = message;
              return newMessages;
            }
          }
          // Check if message already exists
          if (!prev.find(m => m._id === message._id)) {
            return [...prev, message];
          }
          return prev;
        });
        // Mark as read
        socket.emit('markAsRead', { conversationId: message.conversationId, userId: user._id });
      } else {
        // Message is for another conversation - update unread count
        setUnreadCounts((prev) => ({
          ...prev,
          [message.conversationId]: (prev[message.conversationId] || 0) + 1,
        }));
        // Update conversation list
        fetchConversations();
      }
    };

    // Listen for conversation updates
    const handleConversationUpdate = () => {
      fetchConversations();
    };

    // Listen for online status updates
    const handleUserOnline = (userId) => {
      setOnlineUsers((prev) => new Set([...prev, userId]));
    };

    const handleUserOffline = (userId) => {
      setOnlineUsers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    };

    socket.on('receiveMessage', handleReceiveMessage);
    socket.on('conversationUpdate', handleConversationUpdate);
    socket.on('userOnline', handleUserOnline);
    socket.on('userOffline', handleUserOffline);

    return () => {
      socket.off('receiveMessage', handleReceiveMessage);
      socket.off('conversationUpdate', handleConversationUpdate);
      socket.off('userOnline', handleUserOnline);
      socket.off('userOffline', handleUserOffline);
    };
  }, [socket, user, selectedConversation]);

  // Join conversation room when selected
  useEffect(() => {
    if (socket && selectedConversation) {
      socket.emit('joinRoom', selectedConversation._id);
      fetchMessages(selectedConversation._id);
      // Clear unread count for this conversation
      setUnreadCounts((prev) => {
        const newCounts = { ...prev };
        delete newCounts[selectedConversation._id];
        return newCounts;
      });
    }
  }, [socket, selectedConversation]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket || !selectedConversation) return;

    const optimisticMessage = {
      _id: `temp-${Date.now()}`,
      sender: { _id: user._id, username: user.username },
      content: newMessage,
      createdAt: new Date().toISOString(),
      isOptimistic: true,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    
    socket.emit('sendMessage', {
      conversationId: selectedConversation._id,
      senderId: user._id,
      content: newMessage,
    });

    setNewMessage('');
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

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const formatMessageTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const [showBookModal, setShowBookModal] = useState(false);
  const [bookForm, setBookForm] = useState({
    skill: '',
    scheduledTime: '',
    durationHours: 1,
  });
  const [loadingSession, setLoadingSession] = useState(false);

  const handleStartSession = async () => {
    if (!selectedConversation) return;
    
    const teacherId = selectedConversation.participant._id;
    
    setLoadingSession(true);
    try {
      // Get the other person's profile to see what they can teach
      const teacherProfileRes = await api.get(`/profile/all`);
      const teacherProfile = teacherProfileRes.data.find(p => p._id === teacherId);
      const teacherSkills = teacherProfile?.skillsToTeach || [];
      
      // Get user's skills to learn to find a match
      const userProfileRes = await api.get('/profile');
      const userSkillsToLearn = userProfileRes.data.skillsToLearn || [];
      
      // Find a matching skill (skill user wants to learn that teacher can teach)
      const matchingSkill = userSkillsToLearn.find(skill => 
        teacherSkills.some(ts => ts.toLowerCase() === skill.toLowerCase())
      ) || teacherSkills[0] || userSkillsToLearn[0] || 'General Session';
      
      // Create instant session
      const res = await api.post('/sessions/instant', {
        teacherId,
        skill: matchingSkill,
      });
      
      // Open Zoom meeting in new tab
      if (res.data.startUrl) {
        window.open(res.data.startUrl, '_blank');
      } else if (res.data.meetingLink) {
        window.open(res.data.meetingLink, '_blank');
      }
      
      // Send a message in the chat about the session
      if (socket && selectedConversation) {
        socket.emit('sendMessage', {
          conversationId: selectedConversation._id,
          senderId: user._id,
          content: `Started an instant session on ${matchingSkill}. Zoom meeting opened!`,
        });
      }
    } catch (err) {
      console.error('Failed to start session', err);
      alert(err.response?.data?.msg || 'Failed to start session. Please try again.');
    } finally {
      setLoadingSession(false);
    }
  };

  const handleBookSession = async () => {
    if (!selectedConversation) return;
    setShowBookModal(true);
    
    try {
      // Get both profiles to find matching skills
      const [teacherProfileRes, userProfileRes] = await Promise.all([
        api.get(`/profile/all`),
        api.get('/profile')
      ]);
      
      const teacherProfile = teacherProfileRes.data.find(p => p._id === selectedConversation.participant._id);
      const teacherSkills = teacherProfile?.skillsToTeach || [];
      const userSkillsToLearn = userProfileRes.data.skillsToLearn || [];
      
      // Find a matching skill or use first available
      const matchingSkill = userSkillsToLearn.find(skill => 
        teacherSkills.some(ts => ts.toLowerCase() === skill.toLowerCase())
      ) || teacherSkills[0] || userSkillsToLearn[0] || '';
      
      if (matchingSkill) {
        setBookForm(prev => ({ ...prev, skill: matchingSkill }));
      }
    } catch (err) {
      console.error('Failed to fetch profiles', err);
    }
  };

  const handleSubmitBookSession = async (e) => {
    e.preventDefault();
    if (!selectedConversation || !bookForm.skill || !bookForm.scheduledTime) {
      alert('Please fill in all required fields');
      return;
    }

    const teacherId = selectedConversation.participant._id;
    setLoadingSession(true);
    
    try {
      await api.post('/sessions/request', {
        teacherId,
        skill: bookForm.skill,
      });
      
      // Send a message in the chat about the booking
      if (socket && selectedConversation) {
        const formattedDate = new Date(bookForm.scheduledTime).toLocaleString();
        socket.emit('sendMessage', {
          conversationId: selectedConversation._id,
          senderId: user._id,
          content: `Requested a session on ${bookForm.skill} scheduled for ${formattedDate} (${bookForm.durationHours} hour${bookForm.durationHours > 1 ? 's' : ''})`,
        });
      }
      
      setShowBookModal(false);
      setBookForm({ skill: '', scheduledTime: '', durationHours: 1 });
      alert('Session request sent! The teacher will confirm the schedule.');
    } catch (err) {
      console.error('Failed to book session', err);
      alert(err.response?.data?.msg || 'Failed to book session. Please try again.');
    } finally {
      setLoadingSession(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 w-screen" style={{ marginLeft: 'calc(-50vw + 50%)', marginRight: 'calc(-50vw + 50%)', width: '100vw' }}>
      {/* Left Sidebar - Conversations List */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">Messages</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500">Loading conversations...</div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No conversations yet</div>
          ) : (
            conversations.map((convo) => {
              const isSelected = selectedConversation?._id === convo._id;
              const unreadCount = unreadCounts[convo._id] || 0;
              const isOnline = onlineUsers.has(convo.participant._id);

              return (
                <div
                  key={convo._id}
                  onClick={() => setSelectedConversation(convo)}
                  className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                    isSelected ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="relative">
                      <div
                        className={`w-12 h-12 ${getAvatarColor(convo.participant.username)} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}
                      >
                        {getInitials(convo.participant.username)}
                      </div>
                      {isOnline && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-gray-800 truncate">
                          {convo.participant.username}
                        </h3>
                        {convo.lastMessage && (
                          <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                            {formatTime(convo.lastMessage.createdAt || convo.updatedAt)}
                          </span>
                        )}
                      </div>
                      {convo.lastMessage && (
                        <p className="text-sm text-gray-600 truncate">
                          {convo.lastMessage.content}
                        </p>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <div className="flex-shrink-0">
                        <span className="bg-orange-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                          {unreadCount}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div
                    className={`w-10 h-10 ${getAvatarColor(selectedConversation.participant.username)} rounded-full flex items-center justify-center text-white font-bold`}
                  >
                    {getInitials(selectedConversation.participant.username)}
                  </div>
                  {onlineUsers.has(selectedConversation.participant._id) && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">
                    {selectedConversation.participant.username}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {onlineUsers.has(selectedConversation.participant._id) ? 'Online' : 'Offline'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleStartSession}
                  disabled={loadingSession}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Video size={18} />
                  <span>{loadingSession ? 'Starting...' : 'Start Session'}</span>
                </button>
                <button
                  onClick={handleBookSession}
                  disabled={loadingSession}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Calendar size={18} />
                  <span>Book Session</span>
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 mt-8">No messages yet. Start the conversation!</div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => {
                    const isOwn = msg.sender._id === user._id;
                    return (
                      <div
                        key={msg._id || `temp-${msg.createdAt}`}
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`flex items-start gap-2 max-w-[70%] ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                          {!isOwn && (
                            <div className={`w-8 h-8 ${getAvatarColor(msg.sender.username)} rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                              {getInitials(msg.sender.username)}
                            </div>
                          )}
                          <div className={`rounded-2xl px-4 py-2 ${
                            isOwn
                              ? 'bg-gradient-to-r from-teal-500 to-blue-500 text-white'
                              : 'bg-blue-100 text-gray-800'
                          } ${msg.isOptimistic ? 'opacity-70' : ''}`}>
                            <p className="text-sm">{msg.content}</p>
                            <p className={`text-xs mt-1 ${isOwn ? 'text-white/70' : 'text-gray-500'}`}>
                              {formatMessageTime(msg.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Message Input */}
            <div className="bg-white border-t border-gray-200 p-4">
              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  className="bg-gradient-to-r from-teal-500 to-blue-500 text-white p-3 rounded-full hover:from-teal-600 hover:to-blue-600 transition-colors flex-shrink-0"
                >
                  <Send size={20} />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center text-gray-500">
              <p className="text-lg mb-2">Select a conversation to start chatting</p>
              <p className="text-sm">Choose a conversation from the sidebar</p>
            </div>
          </div>
        )}
      </div>

      {/* Book Session Modal */}
      {showBookModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">Book a Session</h3>
              <button
                onClick={() => {
                  setShowBookModal(false);
                  setBookForm({ skill: '', scheduledTime: '', durationHours: 1 });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmitBookSession} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Skill to Learn
                </label>
                <input
                  type="text"
                  value={bookForm.skill}
                  onChange={(e) => setBookForm(prev => ({ ...prev, skill: e.target.value }))}
                  placeholder="e.g., SQL, Guitar, Cooking"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={bookForm.scheduledTime}
                  onChange={(e) => setBookForm(prev => ({ ...prev, scheduledTime: e.target.value }))}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duration (hours)
                </label>
                <input
                  type="number"
                  value={bookForm.durationHours}
                  onChange={(e) => setBookForm(prev => ({ ...prev, durationHours: parseFloat(e.target.value) || 1 }))}
                  min="0.5"
                  max="8"
                  step="0.5"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowBookModal(false);
                    setBookForm({ skill: '', scheduledTime: '', durationHours: 1 });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loadingSession}
                  className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingSession ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPage;

