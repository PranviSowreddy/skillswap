const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');

// @route   GET api/profile
// @desc    Get current user's profile
router.get('/', auth, async (req, res) => {
  try {
    const profile = await User.findById(req.user.id).select('-password');
    if (!profile) {
      return res.status(404).json({ msg: 'Profile not found' });
    }
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
  if (availability) profileFields.availability = availability;
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

module.exports = router;