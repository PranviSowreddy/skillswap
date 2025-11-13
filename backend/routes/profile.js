const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Session = require('../models/Session');

// @route   GET api/profile
// @desc    Get current user's profile
router.get('/', auth, async (req, res) => {
  try {
    const profile = await User.findById(req.user.id).select('-password');
    if (!profile) {
      return res.status(404).json({ msg: 'Profile not found' });
    }
    
    // Calculate derived stats
    profile.hoursExchanged = (profile.hoursTaught || 0) + (profile.hoursLearned || 0);
    
    // Calculate unique peers connected (users who have had sessions with this user)
    const sessions = await Session.find({
      $or: [{ learner: req.user.id }, { teacher: req.user.id }],
      status: 'completed'
    });
    
    const peerIds = new Set();
    sessions.forEach(session => {
      if (session.learner.toString() === req.user.id) {
        peerIds.add(session.teacher.toString());
      } else {
        peerIds.add(session.learner.toString());
      }
    });
    
    profile.peersConnected = peerIds.size;


    res.json(profile);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/profile
// @desc    Update user's profile
router.put('/', auth, async (req, res) => {
  const { skillsToTeach, skillsToLearn, availability, preferredFormat } = req.body;

  const profileFields = {};
  if (skillsToTeach) profileFields.skillsToTeach = skillsToTeach;
  if (skillsToLearn) profileFields.skillsToLearn = skillsToLearn;
  if (availability) {
    profileFields.availability = {
        preferredDays: availability.preferredDays,
        timeZone: availability.timeZone,
        format: availability.format,
    };
  }
  if (preferredFormat) profileFields.preferredFormat = preferredFormat;

  try {
    let profile = await User.findByIdAndUpdate(
      req.user.id,
      { $set: profileFields },
      { new: true }
    ).select('-password');

    res.json(profile);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/profile/all
// @desc    Get all user profiles
router.get('/all', auth, async (req, res) => {
  try {
    const profiles = await User.find().select('-password');
    res.json(profiles);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});


module.exports = router;