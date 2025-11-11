import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

// --- UPDATED TagInput Component ---
// Now adds tag on "Blur" (when you click away)
const TagInput = ({ tags, setTags }) => {
  const [input, setInput] = useState('');

  const addTag = (e) => {
    // Check for Enter key or blur event
    if ((e.key === 'Enter' || e.type === 'blur') && input.trim() !== '') {
      e.preventDefault();
      if (!tags.includes(input.trim())) {
        setTags([...tags, input.trim()]);
      }
      setInput(''); // Clear input after adding
    }
  };
  
  const removeTag = (indexToRemove) => {
    setTags(tags.filter((_, index) => index !== indexToRemove));
  };

  return (
    <div className="tag-input-container">
      {tags.map((tag, index) => (
        <div key={index} className="tag-item">
          <span>{tag}</span>
          <button type="button" onClick={() => removeTag(index)}>&times;</button>
        </div>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={addTag}
        onBlur={addTag} // <-- NEW: Adds tag when you click away
        placeholder="Type skill & press Enter"
      />
    </div>
  );
};

// --- UPDATED Profile Page Component ---
const Profile = () => {
  const { user } = useAuth();

  // --- FIX: Initialize with all profile fields ---
  const [profile, setProfile] = useState({
    skillsToTeach: [],
    skillsToLearn: [],
    availability: { timezone: 'UTC', slots: [] },
    preferredFormat: [],
  });

  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      setLoading(true);
      setReviewsLoading(true);
      try {
        const res = await api.get('/profile');
        
        // --- FIX: Load the *full* profile, not just skills ---
        setProfile({
          skillsToTeach: res.data.skillsToTeach || [],
          skillsToLearn: res.data.skillsToLearn || [],
          availability: res.data.availability || { timezone: 'UTC', slots: [] },
          preferredFormat: res.data.preferredFormat || [],
        });
        setLoading(false);
        
        const reviewRes = await api.get(`/reviews/user/${user._id}`);
        setReviews(reviewRes.data);
        setReviewsLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
        setReviewsLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  const setSkillsToTeach = (tags) => setProfile({ ...profile, skillsToTeach: tags });
  const setSkillsToLearn = (tags) => setProfile({ ...profile, skillsToLearn: tags });
  
  const onSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      // Now sends the *full* profile object, preserving other fields
      await api.put('/profile', profile);
      setMessage('Profile Updated Successfully!');
    } catch (err) {
      console.error(err);
      setMessage('Error updating profile.');
    }
  };
  
  if (loading) return <h2>Loading profile...</h2>;

  return (
    <>
      <div className="form-container" style={{maxWidth: '700px'}}>
        <h2>My Profile</h2>
        <h3>{user?.username} ({user?.email})</h3>
        
        <div style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>
          <strong>Average Rating: </strong>
          <span style={{ color: 'var(--warning-color)', fontWeight: 'bold' }}>
            ★ {user?.averageRating.toFixed(1)}
          </span>
          <span style={{ color: 'var(--text-muted)' }}> ({user?.totalRatings} ratings)</span>
        </div>
        
        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label>Skills I Can Teach</label>
            <TagInput tags={profile.skillsToTeach} setTags={setSkillsToTeach} />
          </div>

          <div className="form-group">
            <label>Skills I Want to Learn</label>
            <TagInput tags={profile.skillsToLearn} setTags={setSkillsToLearn} />
          </div>
          
          {/* We'll build the UI for these in a future version,
              but they are now correctly loaded and saved. */}
            
          {message && <p style={{ color: message.startsWith('Error') ? 'var(--danger-color)' : 'var(--success-color)', marginBottom: '1rem' }}>{message}</p>}
          <button type="submit" className="btn btn-primary btn-block">Save Profile</button>
        </form>
      </div>
      
      <div className="card" style={{ marginTop: '2rem', maxWidth: '700px', margin: '2rem auto' }}>
        <h3>Reviews About Me</h3>
        {reviewsLoading ? (
          <p>Loading reviews...</p>
        ) : reviews.length > 0 ? (
          reviews.map(review => (
            <div key={review._id} className="review-item">
              <div className="review-meta">
                <span className="review-stars">
                  {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                </span>
                <span className="review-author">
                  by <strong>{review.reviewerId.username}</strong>
                </span>
              </div>
              <p className="review-comment">"{review.comment || 'No comment provided.'}"</p>
            </div>
          ))
        ) : (
          <p>You have not received any reviews yet.</p>
        )}
      </div>
    </>
  );
};

export default Profile;