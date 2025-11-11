const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');

// @route   GET api/skills/search
// @desc    Search for users who can teach a skill
router.get('/search', auth, async (req, res) => {
  const { skill } = req.query;

  try {
    const teachers = await User.find({
      skillsToTeach: { $regex: new RegExp(skill, 'i') },
      _id: { $ne: req.user.id }, 
    }).select('-password');

    res.json(teachers);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;