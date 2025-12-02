const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  skillsToTeach: [String],
  skillsToLearn: [String],
  availability: {
    preferredDays: { type: String, default: 'Not set' },
    timeZone: { type: String, default: 'Not set' },
    format: { type: String, default: 'Not set' },
  },
  preferredFormat: [String],
  hoursTaught: {
    type: Number,
    default: 0,
  },
  hoursLearned: {
    type: Number,
    default: 0,
  },
  hoursExchanged: {
    type: Number,
    default: 0,
  },
  peersConnected: {
    type: Number,
    default: 0,
  },
  currentStreak: { // Daily session streak
    type: Number,
    default: 0,
  },
  lastSessionCompleted: {
    type: Date,
  },
  averageRating: {
    type: Number,
    default: 0,
  },
  totalRatings: {
    type: Number,
    default: 0,
  },
  memberSince: {
    type: Date,
    default: Date.now,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  calendarProvider: {
    type: String,
    enum: ['google', 'outlook', null],
    default: null,
  },
  googleCalendarToken: {
    type: String,
  },
  googleCalendarRefreshToken: {
    type: String,
  },
  outlookCalendarToken: {
    type: String,
  },
  outlookCalendarRefreshToken: {
    type: String,
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  isBanned: {
    type: Boolean,
    default: false,
  },
  banReason: {
    type: String,
  },
  bannedAt: {
    type: Date,
  },
  bannedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
  },
  isTimedOut: {
    type: Boolean,
    default: false,
  },
  timeoutUntil: {
    type: Date,
  },
  timeoutReason: {
    type: String,
  },
  timedOutBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
  },
  timedOutAt: {
    type: Date,
  },
});

module.exports = mongoose.model('user', UserSchema);