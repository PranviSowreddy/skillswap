import React, { useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const StarRating = ({ rating, setRating }) => {
  return (
    <div className="star-rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          type="button"
          key={star}
          className={star <= rating ? 'on' : 'off'}
          onClick={() => setRating(star)}
        >
          &#9733;
        </button>
      ))}
    </div>
  );
};

const ReviewModal = ({ session, onClose, onReviewSubmitted }) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const { user } = useAuth();

  if (!session) return null;

  const reviewee =
    session.learnerId._id === user._id
      ? session.teacherId
      : session.learnerId;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) {
      setError('Please select a star rating');
      return;
    }
    setError('');
    try {
      await api.post(`/reviews/${session._id}`, { rating, comment });
      onReviewSubmitted();
      onClose();
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to submit review');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Leave a Review for {reviewee.username}</h3>
        <p>For session: <strong>{session.skill}</strong></p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Rating</label>
            <StarRating rating={rating} setRating={setRating} />
          </div>
          <div className="form-group">
            <label>Comment (Optional)</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={`How was your session with ${reviewee.username}?`}
            ></textarea>
          </div>
          {error && <p style={{ color: 'var(--danger-color)' }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1rem' }}>
            <button type="button" className="btn btn-light" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Submit Review
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReviewModal;