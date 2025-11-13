const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Review = require('../models/Review');
const Session = require('../models/Session');
const User = require('../models/User');

// @route   POST api/reviews/:sessionId
// @desc    Leave a review for a completed session
router.post('/:sessionId', auth, async (req, res) => {
  const { rating, comment } = req.body;
  const { sessionId } = req.params;
  const reviewerId = req.user.id;

  try {
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ msg: 'Session not found' });
    }
    if (session.status !== 'completed') {
      return res.status(400).json({ msg: 'Session must be completed to leave a review' });
    }

    let revieweeId;
    if (session.learner.toString() === reviewerId) { // Changed from learnerId to learner
      revieweeId = session.teacher; // Changed from teacherId to teacher
    } else if (session.teacher.toString() === reviewerId) { // Changed from teacherId to teacher
      revieweeId = session.learner; // Changed from learnerId to learner
    } else {
      return res.status(401).json({ msg: 'User not part of this session' });
    }

    let review = await Review.findOne({ sessionId, reviewerId });
    if (review) {
      return res.status(400).json({ msg: 'You have already reviewed this session' });
    }

    review = new Review({
      sessionId,
      reviewerId,
      revieweeId,
      rating: Number(rating),
      comment,
    });
    await review.save();

    const reviewee = await User.findById(revieweeId);
    const newTotalRatings = reviewee.totalRatings + 1;
    const newAverage =
      (reviewee.averageRating * reviewee.totalRatings + Number(rating)) /
      newTotalRatings;

    reviewee.averageRating = newAverage;
    reviewee.totalRatings = newTotalRatings;
    await reviewee.save();

    res.json(review);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/reviews/user/:userId
// @desc    Get all reviews for a specific user
router.get('/user/:userId', async (req, res) => {
  try {
    const reviews = await Review.find({ revieweeId: req.params.userId })
      .populate('reviewerId', 'username')
      .sort({ date: -1 });
    res.json(reviews);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/reviews/my
// @desc    Get all reviews submitted by the logged-in user
router.get('/my', auth, async (req, res) => {
  try {
    const reviews = await Review.find({ reviewerId: req.user.id })
      .populate('revieweeId', 'username')
      .populate('sessionId', 'skill') // Populate session skill for context
      .sort({ date: -1 });
    res.json(reviews);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;