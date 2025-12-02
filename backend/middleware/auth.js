const jwt = require('jsonwebtoken');
const jwtSecret = process.env.JWT_SECRET;
const User = require('../models/User');

module.exports = async function (req, res, next) {
  const token = req.header('x-auth-token');
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }
  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded.user;
    
    // Check if user is banned
    const user = await User.findById(req.user.id);
    if (user && user.isBanned) {
      return res.status(403).json({ 
        msg: 'Your account has been banned',
        banReason: user.banReason || 'No reason provided'
      });
    }
    
    // Check if user is timed out
    if (user && user.isTimedOut && user.timeoutUntil) {
      const now = new Date();
      if (now < user.timeoutUntil) {
        // Still timed out
        const daysLeft = Math.ceil((user.timeoutUntil - now) / (1000 * 60 * 60 * 24));
        return res.status(403).json({ 
          msg: `Your account is temporarily restricted from chatting. Timeout expires in ${daysLeft} day(s).`,
          timeoutReason: user.timeoutReason || 'No reason provided',
          timeoutUntil: user.timeoutUntil
        });
      } else {
        // Timeout expired, clear it
        user.isTimedOut = false;
        user.timeoutUntil = null;
        user.timeoutReason = null;
        user.timedOutBy = null;
        user.timedOutAt = null;
        await user.save();
      }
    }
    
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};