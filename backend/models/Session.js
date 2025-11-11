const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema({
  learnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
  },
  teacherId: {
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
});

module.exports = mongoose.model('session', SessionSchema);