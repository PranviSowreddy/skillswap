const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Session = require('../models/Session');

// @route   GET api/stats
// @desc    Get user's dashboard stats
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const hoursExchanged = (user.hoursTaught || 0) + (user.hoursLearned || 0);

    // Calculate hours this week
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0);
    
    const sessionsThisWeek = await Session.find({
      $or: [{ learner: req.user.id }, { teacher: req.user.id }],
      status: 'completed',
      scheduledTime: { $gte: startOfWeek, $lte: now }
    });
    
    const hoursThisWeek = sessionsThisWeek.reduce((total, session) => {
      return total + (session.durationHours || 0);
    }, 0);

    const activeSessions = await Session.countDocuments({
      $or: [{ learner: req.user.id }, { teacher: req.user.id }],
      status: { $in: ['pending', 'confirmed'] },
      scheduledTime: { $gte: new Date() },
    });

    const learningStreak = user.currentStreak || 0;

    // Define "mastered" as teaching a skill for more than 5 hours
    const taughtSessions = await Session.find({ teacher: req.user.id, status: 'completed' });
    const skillsMastered = taughtSessions.reduce((acc, session) => {
        const hours = session.durationHours || 0; // Use durationHours directly
        if(acc[session.skill]) {
            acc[session.skill] += hours;
        } else {
            acc[session.skill] = hours;
        }
        return acc;
    }, {});

    const masteredCount = Object.values(skillsMastered).filter(hours => hours >= 5).length;

    // Calculate skills in progress (skills being learned but not yet mastered)
    const learningSessions = await Session.find({ 
      learner: req.user.id, 
      status: { $in: ['confirmed', 'pending'] }
    });
    const skillsInProgress = new Set(learningSessions.map(s => s.skill)).size;

    res.json({
      hoursExchanged,
      hoursThisWeek,
      activeSessions,
      learningStreak,
      skillsMastered: masteredCount,
      skillsInProgress,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
