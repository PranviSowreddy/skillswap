const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Session = require('../models/Session');
const User = require('../models/User');
const Review = require('../models/Review'); // Import Review model
const { createZoomMeeting, createInstantZoomMeeting } = require('../services/zoomService'); // Import Zoom service

// Helper function to safely convert to ObjectId
const toObjectId = (value) => {
  if (!value) return value;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (typeof value === 'string' && mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  return value;
};

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
    
    let newStreak;
    if (lastCompletion && lastCompletion.getTime() === today.getTime()) {
      return; // Already updated today, no need to update
    } else if (lastCompletion && lastCompletion.getTime() === yesterday.getTime()) {
      newStreak = (user.currentStreak || 0) + 1;
    } else {
      newStreak = 1;
    }
    
    // Use findByIdAndUpdate to only update specific fields without triggering full document validation
    // This avoids issues with availability field data inconsistency
    await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          currentStreak: newStreak,
          lastSessionCompleted: new Date()
        }
      },
      { runValidators: false } // Skip validation to avoid availability field issues
    );
    
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

// Helper function to generate session dates based on weeks, days, and time
const generateSessionDates = (startDate, numberOfWeeks, daysOfWeek, timeOfDay) => {
  const dates = [];
  const now = new Date();
  const [hours, minutes] = timeOfDay.split(':').map(Number);
  
  const dayIndexMap = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
  
  // Convert day names to indices
  const selectedDayIndices = daysOfWeek.map(day => dayIndexMap[day]).sort((a, b) => a - b);
  
  if (selectedDayIndices.length === 0) {
    return dates;
  }
  
  // Start from today
  let baseDate = new Date(now);
  baseDate.setHours(0, 0, 0, 0);
  
  // Find the first occurrence of the earliest selected day
  const firstDayIndex = selectedDayIndices[0];
  const currentDayOfWeek = baseDate.getDay();
  let daysUntilFirstDay = (firstDayIndex - currentDayOfWeek + 7) % 7;
  
  // If today is one of the selected days and time hasn't passed, start today
  if (daysUntilFirstDay === 0) {
    const testDate = new Date(baseDate);
    testDate.setHours(hours, minutes, 0, 0);
    if (testDate < now) {
      daysUntilFirstDay = 7; // Start next week
    }
  } else if (daysUntilFirstDay === 0 && selectedDayIndices.includes(currentDayOfWeek)) {
    const testDate = new Date(baseDate);
    testDate.setHours(hours, minutes, 0, 0);
    if (testDate < now) {
      daysUntilFirstDay = 7;
    }
  }
  
  // Generate dates for the specified number of weeks
  for (let week = 0; week < numberOfWeeks; week++) {
    for (const dayIndex of selectedDayIndices) {
      const sessionDate = new Date(baseDate);
      // Calculate days to add: base offset + week offset + day offset
      const daysToAdd = daysUntilFirstDay + (week * 7) + ((dayIndex - firstDayIndex + 7) % 7);
      sessionDate.setDate(sessionDate.getDate() + daysToAdd);
      sessionDate.setHours(hours, minutes, 0, 0);
      
      // Only add if date is in the future
      if (sessionDate >= now) {
        dates.push(new Date(sessionDate));
      }
    }
  }
  
  // Sort dates and remove duplicates
  const uniqueDates = Array.from(new Set(dates.map(d => d.getTime()))).map(t => new Date(t));
  return uniqueDates.sort((a, b) => a - b);
};

// @route   PUT api/sessions/respond/:id
// @desc    Respond to a session request (Accept/Decline)
router.put('/respond/:id', auth, async (req, res) => {
  const { response, scheduledTime, durationHours, numberOfWeeks, daysOfWeek, timeOfDay } = req.body; 

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

    // Handle decline - change to 'cancelled' to match enum
    if (response === 'declined' || response === 'cancelled') {
      session.status = 'cancelled';
      session.scheduledTime = null;
      session.durationHours = 1;
      session.meetingLink = null;
      session.startUrl = null;
      await session.save();
      return res.json(session);
    }

    if (response === 'confirmed') {
      // New flow: support multiple sessions with weeks/days/time
      if (numberOfWeeks && daysOfWeek && timeOfDay) {
        // Generate multiple session dates
        const sessionDates = generateSessionDates(
          scheduledTime || new Date(),
          numberOfWeeks,
          daysOfWeek,
          timeOfDay
        );

        if (sessionDates.length === 0) {
          return res.status(400).json({ msg: 'No valid session dates generated' });
        }

        const createdSessions = [];
        
        // Update the original session with the first date
        session.status = 'confirmed';
        session.scheduledTime = sessionDates[0];
        session.durationHours = durationHours || 1;
        // Don't create Zoom meeting yet - will be created when teacher clicks video button
        session.meetingLink = null;
        session.startUrl = null;
        
        await session.save();
        createdSessions.push(session);

        // Create additional sessions for remaining dates
        for (let i = 1; i < sessionDates.length; i++) {
          const newSession = new Session({
            learner: session.learner,
            teacher: session.teacher,
            skill: session.skill,
            status: 'confirmed',
            scheduledTime: sessionDates[i],
            durationHours: durationHours || 1,
            requestedDate: session.requestedDate,
            meetingLink: null,
            startUrl: null,
          });

          await newSession.save();
          createdSessions.push(newSession);
        }

        return res.json({ sessions: createdSessions, message: `Created ${createdSessions.length} sessions` });
      } else {
        // Legacy flow: single session
        if (!scheduledTime || !durationHours) {
          return res.status(400).json({ msg: 'Schedule time and duration are required' });
        }
        session.status = 'confirmed';
        session.scheduledTime = scheduledTime;
        session.durationHours = durationHours;
        // Don't create Zoom meeting yet - will be created when teacher clicks video button
        session.meetingLink = null;
        session.startUrl = null;
        
        await session.save();
        return res.json(session);
      }
    }

    await session.save();
    res.json(session);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/sessions/create-meeting/:id
// @desc    Create Zoom meeting for a session (teacher only, on-demand)
router.post('/create-meeting/:id', auth, async (req, res) => {
  try {
    let session = await Session.findById(req.params.id)
      .populate('learner', 'username _id')
      .populate('teacher', 'username _id');
    
    if (!session) {
      return res.status(404).json({ msg: 'Session not found' });
    }
    
    // Only teacher can create meeting
    if (session.teacher._id.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Only the teacher can create the meeting' });
    }
    
    if (session.status !== 'confirmed') {
      return res.status(400).json({ msg: 'Only confirmed sessions can have meetings' });
    }

    // If meeting already exists, return it
    if (session.meetingLink) {
      return res.json({
        meetingLink: session.meetingLink,
        startUrl: session.startUrl,
        message: 'Meeting already exists'
      });
    }

    // Create Zoom meeting
    try {
      const topic = `SkillSwap: ${session.skill} (${session.teacher.username} & ${session.learner.username})`;
      const scheduledTime = session.scheduledTime || new Date();
      const zoomMeeting = await createZoomMeeting(topic, scheduledTime);
      
      session.meetingLink = zoomMeeting.join_url;
      session.startUrl = zoomMeeting.start_url;
      await session.save();

      // Emit socket event to notify learner
      // We'll need to access io from the route - we'll pass it via req.app
      const io = req.app.get('io');
      if (io) {
        io.to(`user_${session.learner._id}`).emit('meetingCreated', {
          sessionId: session._id,
          meetingLink: zoomMeeting.join_url,
          skill: session.skill,
          teacher: session.teacher.username
        });
      }

      res.json({
        meetingLink: zoomMeeting.join_url,
        startUrl: zoomMeeting.start_url,
        message: 'Meeting created successfully'
      });
    } catch (zoomErr) {
      console.error('Zoom API failed:', zoomErr.message);
      res.status(500).json({ msg: 'Could not create Zoom meeting' });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/sessions/reschedule/:id
// @desc    Reschedule a confirmed session (teacher only)
router.put('/reschedule/:id', auth, async (req, res) => {
  const { scheduledTime, durationHours } = req.body;

  try {
    let session = await Session.findById(req.params.id)
      .populate('learner', 'username')
      .populate('teacher', 'username');
    
    if (!session) {
      return res.status(404).json({ msg: 'Session not found' });
    }
    
    // Only teacher can reschedule
    if (session.teacher._id.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Only the teacher can reschedule sessions' });
    }
    
    if (session.status !== 'confirmed') {
      return res.status(400).json({ msg: 'Only confirmed sessions can be rescheduled' });
    }

    if (!scheduledTime) {
      return res.status(400).json({ msg: 'New scheduled time is required' });
    }

    session.scheduledTime = scheduledTime;
    if (durationHours) {
      session.durationHours = durationHours;
    }

    // Clear existing meeting links when rescheduling - teacher will need to create new meeting
    session.meetingLink = null;
    session.startUrl = null;

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
    // Validate rating is provided and is valid
    if (!rating || rating === 0) {
      return res.status(400).json({ msg: 'Rating is required' });
    }
    const ratingNum = Number(rating);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ msg: 'Rating must be a number between 1 and 5' });
    }

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

    // First check session review flags (more reliable)
    const isTeacher = reviewerId === session.teacher.toString();
    const isLearner = reviewerId === session.learner.toString();
    
    // Debug logging
    console.log('Review check:', {
      sessionId,
      reviewerId,
      isTeacher,
      isLearner,
      teacherReviewed: session.teacherReviewed,
      learnerReviewed: session.learnerReviewed,
      teacherId: session.teacher.toString(),
      learnerId: session.learner.toString()
    });
    
    // Check session review flags - use strict check and handle null/undefined
    const teacherReviewed = session.teacherReviewed === true || session.teacherReviewed === 'true';
    const learnerReviewed = session.learnerReviewed === true || session.learnerReviewed === 'true';
    
    // First check Review collection to see if review actually exists
    // Use helper function to safely convert to ObjectIds
    let existingReview = null;
    try {
      const sessionObjectId = toObjectId(sessionId);
      const reviewerObjectId = toObjectId(reviewerId);
      
      existingReview = await Review.findOne({ 
        sessionId: sessionObjectId,
        reviewerId: reviewerObjectId
      });
      
      // Debug: Log the query and results
      console.log('Review query:', {
        sessionId: sessionId,
        reviewerId: reviewerId,
        sessionIdType: typeof sessionId,
        reviewerIdType: typeof reviewerId,
        foundReview: !!existingReview,
        reviewId: existingReview?._id
      });
    } catch (queryError) {
      console.error('Error querying for existing review:', queryError);
      // If ObjectId conversion fails, try without conversion
      existingReview = await Review.findOne({ 
        sessionId: sessionId,
        reviewerId: reviewerId
      });
    }
    
    // If review exists in database, update flags if needed and block
    if (existingReview) {
      console.log('Found existing review in database:', existingReview._id);
      // If review exists in collection but flags aren't set, update the flags
      if (isTeacher && !session.teacherReviewed) {
        session.teacherReviewed = true;
        await session.save();
        console.log('Updated teacherReviewed flag to true');
      }
      if (isLearner && !session.learnerReviewed) {
        session.learnerReviewed = true;
        await session.save();
        console.log('Updated learnerReviewed flag to true');
      }
      return res.status(400).json({ msg: 'You have already reviewed this session' });
    }
    
    // If flags are set but no review exists, reset the flags (data inconsistency fix)
    if (isTeacher && teacherReviewed) {
      console.log('Warning: teacherReviewed flag is true but no review found. Resetting flag.');
      session.teacherReviewed = false;
      await session.save();
    }
    if (isLearner && learnerReviewed) {
      console.log('Warning: learnerReviewed flag is true but no review found. Resetting flag.');
      session.learnerReviewed = false;
      await session.save();
    }
    
    console.log('No existing review found, proceeding with new review');

    // Ensure all IDs are properly formatted as ObjectIds using helper function
    const newReview = new Review({
      sessionId: toObjectId(sessionId),
      reviewerId: toObjectId(reviewerId),
      revieweeId: toObjectId(revieweeId),
      rating: ratingNum,
      comment: comment || '',
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
    const revieweeUser = await User.findById(toObjectId(revieweeId));
    if (revieweeUser) {
      const currentTotalRatings = revieweeUser.totalRatings || 0;
      const currentAverageRating = revieweeUser.averageRating || 0;
      const totalRatings = currentTotalRatings + 1;
      
      // Calculate new average: (currentAverage * currentTotal + newRating) / newTotal
      const newAverageRating = currentTotalRatings === 0 
        ? ratingNum 
        : ((currentAverageRating * currentTotalRatings) + ratingNum) / totalRatings;
      
      // Use findByIdAndUpdate to only update specific fields without triggering full document validation
      // This avoids issues with availability field data inconsistency
      await User.findByIdAndUpdate(
        toObjectId(revieweeId),
        {
          $set: {
            averageRating: newAverageRating,
            totalRatings: totalRatings
          }
        },
        { runValidators: false } // Skip validation to avoid availability field issues
      );
    }

    res.json(newReview);
  } catch (err) {
    console.error('Error in review submission:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({ msg: err.message || 'Server Error' });
  }
});

module.exports = router;