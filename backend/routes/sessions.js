const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Session = require('../models/Session');
const User = require('../models/User');

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
      learnerId: req.user.id,
      teacherId: teacherId,
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

// @route   GET api/sessions
// @desc    Get all sessions for the logged-in user
router.get('/', auth, async (req, res) => {
  try {
    const sessions = await Session.find({
      $or: [{ learnerId: req.user.id }, { teacherId: req.user.id }],
    })
      .populate('learnerId', 'username')
      .populate('teacherId', 'username')
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
  const { response, scheduledTime, durationHours, meetingLink } = req.body; 

  try {
    let session = await Session.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ msg: 'Session not found' });
    }
    if (session.teacherId.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }

    session.status = response;
    if (response === 'confirmed') {
      if (!scheduledTime || !durationHours) {
        return res.status(400).json({ msg: 'Schedule time and duration are required' });
      }
      session.scheduledTime = scheduledTime;
      session.durationHours = durationHours;
      if (meetingLink) session.meetingLink = meetingLink;
    } else {
      session.scheduledTime = null;
      session.durationHours = 1;
      session.meetingLink = null;
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
      session.learnerId.toString() !== req.user.id &&
      session.teacherId.toString() !== req.user.id
    ) {
      return res.status(401).json({ msg: 'User not authorized' });
    }
    if (session.status === 'completed') {
      return res.status(400).json({ msg: 'Session already marked as complete' });
    }
    
    session.status = 'completed';
    await session.save();

    const hours = session.durationHours || 1;
    await User.findByIdAndUpdate(session.teacherId, { $inc: { hoursTaught: hours } });
    await User.findByIdAndUpdate(session.learnerId, { $inc: { hoursLearned: hours } });

    await updateStreak(session.teacherId);
    await updateStreak(session.learnerId);

    res.json(session);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;