const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Session = require('../models/Session');
const User = require('../models/User');
const Review = require('../models/Review'); // Import Review model
const { createZoomMeeting, createInstantZoomMeeting } = require('../services/zoomService'); // Import Zoom service

// Helper function for Streak Logic
const updateStreak = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let lastCompletion = null;
    if (user.lastSessionCompleted) {
      lastCompletion = new Date(user.lastSessionCompleted);
      lastCompletion.setHours(0, 0, 0, 0);
    }
    
    if (lastCompletion && lastCompletion.getTime() === today.getTime()) {
      return; 
    } else if (lastCompletion && lastCompletion.getTime() === yesterday.getTime()) {
      user.currentStreak += 1;
    } else {
      user.currentStreak = 1;
    }
    
    user.lastSessionCompleted = new Date();
    await user.save();
    
  } catch (err) {
    console.error(`Error updating streak for user ${userId}:`, err.message);
  }
};

// @route   POST api/sessions/request
// @desc    Request a new session
router.post('/request', auth, async (req, res) => {
  const { teacherId, skill } = req.body;
  try {
    const teacher = await User.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ msg: 'Teacher not found' });
    }
    const newSession = new Session({
      learner: req.user.id,
      teacher: teacherId,
      skill: skill,
      status: 'pending',
    });
    const session = await newSession.save();
    res.json(session);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/sessions/instant
// @desc    Create an instant session with Zoom meeting
router.post('/instant', auth, async (req, res) => {
  const { teacherId, skill } = req.body;
  try {
    const teacher = await User.findById(teacherId).select('username');
    if (!teacher) {
      return res.status(404).json({ msg: 'Teacher not found' });
    }

    const learner = await User.findById(req.user.id).select('username');
    const topic = `SkillSwap: ${skill || 'Session'} (${teacher.username} & ${learner.username})`;

    // Create instant Zoom meeting
    let zoomMeeting;
    try {
      zoomMeeting = await createInstantZoomMeeting(topic);
    } catch (zoomErr) {
      console.error('Zoom API failed:', zoomErr.message);
      return res.status(500).json({ msg: 'Could not create Zoom meeting' });
    }

    // Create session record
    const newSession = new Session({
      learner: req.user.id,
      teacher: teacherId,
      skill: skill || 'General Session',
      status: 'confirmed',
      scheduledTime: new Date(),
      durationHours: 1,
      meetingLink: zoomMeeting.join_url,
      startUrl: zoomMeeting.start_url,
    });

    const session = await newSession.save();
    res.json(session);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/sessions
// @desc    Get all sessions for the logged-in user
router.get('/', auth, async (req, res) => {
  try {
    const sessions = await Session.find({
      $or: [{ learner: req.user.id }, { teacher: req.user.id }],
    })
      .populate('learner', 'username')
      .populate('teacher', 'username')
      .sort({ requestedDate: -1 });

    res.json(sessions);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/sessions/respond/:id
// @desc    Respond to a session request (Accept/Decline)
router.put('/respond/:id', auth, async (req, res) => {
  // We no longer get meetingLink from the user
  const { response, scheduledTime, durationHours } = req.body; 

  try {
    let session = await Session.findById(req.params.id)
      .populate('learner', 'username')
      .populate('teacher', 'username');
    
    if (!session) {
      return res.status(404).json({ msg: 'Session not found' });
    }
    if (session.teacher._id.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }

    session.status = response;
    if (response === 'confirmed') {
      if (!scheduledTime || !durationHours) {
        return res.status(400).json({ msg: 'Schedule time and duration are required' });
      }
      session.scheduledTime = scheduledTime;
      session.durationHours = durationHours;
      
      // --- NEW: Auto-create Zoom Link ---
      try {
        const topic = `SkillSwap: ${session.skill} (${session.teacher.username} & ${session.learner.username})`;
        const zoomMeeting = await createZoomMeeting(topic, scheduledTime);
        
        session.meetingLink = zoomMeeting.join_url;
        session.startUrl = zoomMeeting.start_url; // Store start URL for teacher
        console.log(`Zoom meeting created: ${zoomMeeting.join_url}`);
        
      } catch (zoomErr) {
        console.error('Zoom API failed:', zoomErr.message);
        session.meetingLink = null;
        session.startUrl = null; 
      }
      // --- END NEW ---
      
    } else {
      session.scheduledTime = null;
      session.durationHours = 1;
      session.meetingLink = null;
      session.startUrl = null;
    }

    await session.save();
    res.json(session);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/sessions/complete/:id
// @desc    Mark a session as completed
router.put('/complete/:id', auth, async (req, res) => {
  try {
    let session = await Session.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ msg: 'Session not found' });
    }
    if (
      session.learner.toString() !== req.user.id &&
      session.teacher.toString() !== req.user.id
    ) {
      return res.status(401).json({ msg: 'User not authorized' });
    }
    if (session.status === 'completed') {
      return res.status(400).json({ msg: 'Session already marked as complete' });
    }
    
    session.status = 'completed';
    session.teacherReviewed = false; // Reset review status
    session.learnerReviewed = false; // Reset review status
    await session.save();

    const hours = session.durationHours || 1;
    await User.findByIdAndUpdate(session.teacher, { $inc: { hoursTaught: hours } });
    await User.findByIdAndUpdate(session.learner, { $inc: { hoursLearned: hours } });

    await updateStreak(session.teacher);
    await updateStreak(session.learner);

    res.json(session);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/reviews
// @desc    Submit a review for a session
router.post('/reviews', auth, async (req, res) => {
  const { sessionId, revieweeId, rating, comment } = req.body;
  const reviewerId = req.user.id;

  try {
    // Check if session exists and is completed
    const session = await Session.findById(sessionId);
    if (!session || session.status !== 'completed') {
      return res.status(400).json({ msg: 'Cannot review an uncompleted or non-existent session' });
    }

    // Check if reviewer is part of the session
    if (session.learner.toString() !== reviewerId && session.teacher.toString() !== reviewerId) {
      return res.status(401).json({ msg: 'User not authorized to review this session' });
    }

    // Check if reviewee is part of the session
    if (session.learner.toString() !== revieweeId && session.teacher.toString() !== revieweeId) {
      return res.status(400).json({ msg: 'Reviewee is not part of this session' });
    }

    // Prevent self-review
    if (reviewerId === revieweeId) {
      return res.status(400).json({ msg: 'Cannot review yourself' });
    }

    // Check if review already exists for this session by this reviewer
    let existingReview = await Review.findOne({ sessionId, reviewerId });
    if (existingReview) {
      return res.status(400).json({ msg: 'You have already reviewed this session' });
    }

    const newReview = new Review({
      sessionId,
      reviewerId,
      revieweeId,
      rating,
      comment,
    });

    await newReview.save();

    // Update session review status
    if (reviewerId === session.teacher.toString()) {
      session.teacherReviewed = true;
    } else if (reviewerId === session.learner.toString()) {
      session.learnerReviewed = true;
    }
    await session.save();

    // Update reviewee's average rating and total ratings
    const revieweeUser = await User.findById(revieweeId);
    if (revieweeUser) {
      const totalRatings = revieweeUser.totalRatings + 1;
      const newAverageRating = 
        ((revieweeUser.averageRating * revieweeUser.totalRatings) + rating) / totalRatings;
      
      revieweeUser.averageRating = newAverageRating;
      revieweeUser.totalRatings = totalRatings;
      await revieweeUser.save();
    }

    res.json(newReview);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;