const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema({
  learner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
  },
  skill: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled'],
    default: 'pending',
  },
  requestedDate: {
    type: Date,
    default: Date.now,
  },
  scheduledTime: {
    type: Date,
  },
  durationHours: {
    type: Number,
    default: 1,
  },
  meetingLink: {
    type: String,
  },
  startUrl: {
    type: String,
  },
  teacherReviewed: {
    type: Boolean,
    default: false,
  },
  learnerReviewed: {
    type: Boolean,
    default: false,
  },
  calendarEventId: {
    type: String,
  },
  calendarProvider: {
    type: String,
    enum: ['google', 'outlook', null],
    default: null,
  },
  calendarLink: {
    type: String,
  },
  // Barter system: Link to the paired session
  barterSessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'session',
    default: null,
  },
});

module.exports = mongoose.model('session', SessionSchema);