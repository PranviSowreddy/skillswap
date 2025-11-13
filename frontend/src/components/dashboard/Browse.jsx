import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Search, ArrowRight, MessageSquare } from 'lucide-react';

const Browse = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await api.get('/profile/all');
        // Filter out current user
        const filteredUsers = res.data.filter(u => u._id !== user?._id);
        setUsers(filteredUsers);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    if (user) {
      fetchUsers();
    }
  }, [user]);

  const handleRequestSession = async (teacherId, skill) => {
    if (!skill) {
      setMessage('Please select a skill to learn');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    try {
      await api.post('/sessions/request', { teacherId, skill });
      setMessage('Session request sent successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.msg || 'Error sending session request.');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleStartChat = async (recipientId) => {
    try {
      // Find or create conversation
      const res = await api.get(`/messages/start/${recipientId}`);
      // Navigate to chat page with conversation ID
      navigate(`/messages?conversation=${res.data._id}`);
    } catch (err) {
      console.error('Failed to start chat', err);
      setMessage('Could not open chat. Please try again.');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const filteredUsers = users.filter(user => {
    if (!searchTerm.trim()) return true;
    const skillsToTeach = (user.skillsToTeach || []).join(' ').toLowerCase();
    const skillsToLearn = (user.skillsToLearn || []).join(' ').toLowerCase();
    const username = (user.username || '').toLowerCase();
    const searchTermLower = searchTerm.toLowerCase();
    return skillsToTeach.includes(searchTermLower) || 
           skillsToLearn.includes(searchTermLower) ||
           username.includes(searchTermLower);
  });

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (index) => {
    const colors = ['bg-teal-500', 'bg-blue-500', 'bg-purple-500'];
    return colors[index % colors.length];
  };

  const formatAvailability = (availability) => {
    if (!availability) return 'Not specified';
    const days = availability.preferredDays || 'Not set';
    if (days === 'Not set') return 'Not specified';
    return days;
  };

  return (
    <div className="bg-gray-50 min-h-screen -m-8 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Browse Skills</h1>
        <p className="text-gray-500 mb-8">Find peers to exchange knowledge with</p>

        {/* Search Bar */}
        <div className="mb-8 relative">
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            <Search size={20} />
          </div>
          <input
            type="text"
            placeholder="Search for skills (e.g., SQL, Guitar, Cooking)..."
            className="w-full pl-12 pr-4 py-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Message */}
        {message && (
          <div className={`p-4 rounded-lg mb-6 ${
            message.startsWith('Error') || message.includes('Error') || message.includes('Failed')
              ? 'bg-red-100 text-red-700 border border-red-200'
              : 'bg-green-100 text-green-700 border border-green-200'
          }`}>
            {message}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading users...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {searchTerm ? 'No users found matching your search.' : 'No users available at the moment.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredUsers.map((user, index) => (
              <div key={user._id} className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                {/* User Info */}
                <div className="flex items-center mb-6">
                  <div className={`w-16 h-16 ${getAvatarColor(index)} rounded-full flex items-center justify-center text-white text-xl font-bold flex-shrink-0 mr-4`}>
                    {getInitials(user.username)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold text-gray-800 truncate">{user.username}</h2>
                    <p className="text-sm text-gray-500">{formatAvailability(user.availability)}</p>
                  </div>
                </div>

                {/* Can Teach Section */}
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-gray-700 mb-2">Can teach:</h3>
                  <div className="flex flex-wrap gap-2">
                    {(user.skillsToTeach || []).length > 0 ? (
                      user.skillsToTeach.map(skill => (
                        <span
                          key={skill}
                          className="bg-teal-500 text-white px-3 py-1 rounded-full text-sm font-medium"
                        >
                          {skill}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-400 text-sm">No skills listed</span>
                    )}
                  </div>
                </div>

                {/* Wants to Learn Section */}
                <div className="mb-6">
                  <h3 className="text-sm font-bold text-gray-700 mb-2">Wants to learn:</h3>
                  <div className="flex flex-wrap gap-2">
                    {(user.skillsToLearn || []).length > 0 ? (
                      user.skillsToLearn.map(skill => (
                        <span
                          key={skill}
                          className="bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-medium"
                        >
                          {skill}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-400 text-sm">No skills listed</span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleStartChat(user._id)}
                    className="flex-1 bg-blue-500 text-white py-3 rounded-lg hover:bg-blue-600 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <MessageSquare size={18} />
                    <span>Chat</span>
                  </button>
                  <button
                    onClick={() => {
                      const firstSkill = (user.skillsToTeach || [])[0];
                      if (firstSkill) {
                        handleRequestSession(user._id, firstSkill);
                      } else {
                        setMessage('This user has no skills to teach.');
                        setTimeout(() => setMessage(''), 3000);
                      }
                    }}
                    className="flex-1 bg-teal-500 text-white py-3 rounded-lg hover:bg-teal-600 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <span>Request Session</span>
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Browse;
