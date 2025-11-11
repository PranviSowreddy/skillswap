import React, { useState } from 'react';
import api from '../../services/api';

const SearchResults = ({ results, mySkills, searched }) => {
  const [requestSent, setRequestSent] = useState(new Set());
  const [error, setError] = useState('');

  if (searched && results.length === 0) {
    return <p style={{marginTop: '1rem'}}>No users found. Try another skill.</p>;
  }
  if (!searched) {
     return <p style={{marginTop: '1rem'}}>Search for a skill to find matches.</p>;
  }

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
              <button 
                className={`btn ${requested ? 'btn-light' : 'btn-success'}`}
                onClick={() => handleRequest(teacher._id, teacher.skillsToTeach[0])} // Just request first skill for now
                disabled={requested}
              >
                {requested ? 'Requested' : 'Request Session'}
              </button>
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