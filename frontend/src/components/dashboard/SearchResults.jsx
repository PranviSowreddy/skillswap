import React, { useState } from 'react';
import api from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';

const SearchResults = ({ results, mySkills, searched }) => {
  const [requestSent, setRequestSent] = useState(new Set());
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleRequest = async (teacherId, skill) => {
    setError('');
    try {
      await api.post('/sessions/request', { teacherId, skill });
      setRequestSent(prev => new Set(prev).add(teacherId));
    } catch (err) {
      console.error(err);
      setError('Failed to send request. You may have an existing request with this user.');
    }
  };

  const handleOpenChat = async (recipient) => {
    try {
      // Find or create the conversation
      await api.get(`/messages/start/${recipient._id}`);
      // Navigate to the inbox
      navigate('/messages');
    } catch (err) {
      console.error("Failed to start chat", err);
      alert("Could not open chat.");
    }
  };

  if (searched && results.length === 0) {
    return <p style={{marginTop: '1rem'}}>No users found. Try another skill.</p>;
  }
  if (!searched) {
     return <p style={{marginTop: '1rem'}}>Search for a skill to find matches.</p>;
  }

  return (
    <div style={{ marginTop: '1.5rem' }}>
      {error && <p style={{color: 'var(--danger-color)'}}>{error}</p>}
      
      {results.map((teacher) => {
        const reciprocalSkill = teacher.skillsToLearn.find(skill => 
          mySkills.includes(skill)
        );
        const requested = requestSent.has(teacher._id);

        return (
          <div key={teacher._id} className="search-result-card">
            <div className="search-result-header">
              <div className="user-info">
                <strong>{teacher.username}</strong>
                <span className="rating-info">
                  {' '}• <span className="star">★</span> {teacher.averageRating.toFixed(1)} ({teacher.totalRatings} ratings)
                </span>
              </div>
              
              <div className="session-actions" style={{flexShrink: 0}}>
                <button
                  className="btn btn-light btn-sm"
                  title="Chat with user"
                  onClick={() => handleOpenChat(teacher)}
                >
                  <MessageCircle size={16} />
                </button>
                <button 
                  className={`btn ${requested ? 'btn-light' : 'btn-success'} btn-sm`}
                  onClick={() => handleRequest(teacher._id, teacher.skillsToTeach[0])}
                  disabled={requested}
                >
                  {requested ? 'Requested' : 'Request Session'}
                </button>
              </div>
            </div>
            <div className="search-result-body">
              <p><strong>Teaches:</strong> {teacher.skillsToTeach.join(', ')}</p>
              {reciprocalSkill && (
                <p className="reciprocal-match">
                  Also wants to learn: {reciprocalSkill}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SearchResults;