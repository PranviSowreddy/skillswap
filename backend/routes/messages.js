const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Report = require('../models/Report');
const User = require('../models/User');

// @route   POST api/messages/request/:recipientId
// @desc    Send a chat request to a recipient
router.post('/request/:recipientId', auth, async (req, res) => {
  try {
    const { recipientId } = req.params;
    const senderId = req.user.id;

    if (!recipientId || !senderId) {
      return res.status(400).json({ msg: 'Invalid recipient or sender ID' });
    }
    if (senderId === recipientId) {
      return res.status(400).json({ msg: 'Cannot send chat request to yourself' });
    }

    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, recipientId] },
    });

    if (conversation) {
      if (conversation.status === 'accepted') {
        return res.status(400).json({ msg: 'Chat already exists and is accepted' });
      }
      if (conversation.status === 'pending' && conversation.requestedBy && conversation.requestedBy.toString() === senderId) {
        return res.status(400).json({ msg: 'Chat request already sent' });
      }
      conversation.status = 'pending';
      conversation.requestedBy = senderId;
      await conversation.save();
    } else {
      conversation = new Conversation({
        participants: [senderId, recipientId],
        status: 'pending',
        requestedBy: senderId,
      });
      await conversation.save();
    }

    try {
      const io = req.app.get('io');
      if (io) {
        io.to(`user_${recipientId}`).emit('newChatRequest', { conversationId: conversation._id });
        io.to(`user_${recipientId}`).emit('conversationUpdate');
      }
    } catch (socketErr) {
      console.error('Socket notification error:', socketErr);
    }
    res.json(conversation);
  } catch (err) {
    console.error('Error in chat request:', err);
    res.status(500).json({ msg: err.message || 'Server Error' });
  }
});

// @route   GET api/messages/start/:recipientId
// @desc    Find or create a conversation with a recipient
router.get('/start/:recipientId', auth, async (req, res) => {
  try {
    const { recipientId } = req.params;
    const senderId = req.user.id;

    // Find if a conversation already exists between these two users
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, recipientId] },
    });

    // If not, create one with pending status
    if (!conversation) {
      conversation = new Conversation({
        participants: [senderId, recipientId],
        status: 'pending',
        requestedBy: senderId,
      });
      await conversation.save();
    }

    res.json(conversation);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/messages/requests/pending
// @desc    Get pending chat requests (incoming and outgoing)
router.get('/requests/pending', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const allConversations = await Conversation.find({
      participants: userId,
      status: 'pending',
    })
    .populate('participants', 'username')
    .populate('requestedBy', 'username')
    .sort({ createdAt: -1 });

    const incoming = [];
    const outgoing = [];

    allConversations.forEach(convo => {
      const otherParticipant = convo.participants.find(p => p._id.toString() !== userId);
      const convoData = {
        _id: convo._id,
        participant: otherParticipant || { username: 'Unknown' },
        createdAt: convo.createdAt,
      };

      if (convo.requestedBy && convo.requestedBy.toString() === userId) {
        outgoing.push(convoData);
      } else {
        incoming.push(convoData);
      }
    });

    res.json({ incoming, outgoing });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/messages/requests/:conversationId/accept
// @desc    Accept a chat request
router.post('/requests/:conversationId/accept', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const io = req.app.get('io');

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ msg: 'Conversation not found' });
    }
    if (!conversation.participants.includes(userId)) {
      return res.status(403).json({ msg: 'Not authorized' });
    }
    if (conversation.status === 'accepted') {
      return res.status(400).json({ msg: 'Chat request already accepted' });
    }
    if (conversation.requestedBy && conversation.requestedBy.toString() === userId) {
      return res.status(400).json({ msg: 'Cannot accept your own request' });
    }

    conversation.status = 'accepted';
    await conversation.save();

    if (io) {
      conversation.participants.forEach(participantId => {
        io.to(`user_${participantId}`).emit('conversationUpdate');
        io.to(`user_${participantId}`).emit('chatRequestAccepted', { conversationId });
      });
    }

    res.json(conversation);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/messages/requests/:conversationId/reject
// @desc    Reject a chat request
router.post('/requests/:conversationId/reject', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const io = req.app.get('io');

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ msg: 'Conversation not found' });
    }
    if (!conversation.participants.includes(userId)) {
      return res.status(403).json({ msg: 'Not authorized' });
    }
    if (conversation.requestedBy && conversation.requestedBy.toString() === userId) {
      return res.status(400).json({ msg: 'Cannot reject your own request' });
    }

    conversation.status = 'rejected';
    await conversation.save();

    if (io && conversation.requestedBy) {
      io.to(`user_${conversation.requestedBy}`).emit('chatRequestRejected', { conversationId });
      io.to(`user_${conversation.requestedBy}`).emit('conversationUpdate');
    }

    res.json(conversation);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/messages/:conversationId
// @desc    Get all messages for a conversation
router.get('/:conversationId', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ msg: 'Conversation not found' });
    }
    if (!conversation.participants.includes(userId)) {
      return res.status(403).json({ msg: 'Not authorized' });
    }
    if (conversation.status !== 'accepted') {
      return res.status(403).json({ msg: 'Chat request not accepted yet' });
    }
    
    const messages = await Message.find({ conversationId })
      .populate('sender', 'username')
      .sort({ createdAt: 1 }); // Get messages in chronological order

    res.json(messages);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// ... (existing routes for /start/:recipientId and /:conversationId)

// --- NEW ROUTE ---
// @route   GET api/messages/conversations/my
// @desc    Get all conversations for the logged-in user (only accepted)
router.get('/conversations/my', auth, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user.id,
      status: 'accepted',
    })
    .populate({
         path: 'participants',
         select: 'username' // Only select username
    })
    .sort({ updatedAt: -1 }); // Show most recent chats first
    
    // Get last message for each conversation
    const conversationsWithMessages = await Promise.all(
      conversations.map(async (convo) => {
        const lastMessage = await Message.findOne({ conversationId: convo._id })
          .populate('sender', 'username')
          .sort({ createdAt: -1 })
          .limit(1)
          .lean();
        
        const otherParticipant = convo.participants.find(
          p => p._id.toString() !== req.user.id
        );
        
        return {
          _id: convo._id,
          updatedAt: convo.updatedAt,
          participant: otherParticipant || { username: 'Unknown User' },
          lastMessage: lastMessage || null
        };
      })
    );

    res.json(conversationsWithMessages);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});
// --- END NEW ROUTE ---

// @route   POST api/messages/report
// @desc    Report a user or message
router.post('/report', auth, async (req, res) => {
  try {
    const { reportedUserId, conversationId, messageId, reason, description } = req.body;
    
    if (!reportedUserId || !reason || !description) {
      return res.status(400).json({ msg: 'Missing required fields' });
    }
    
    // Check if user is trying to report themselves
    if (reportedUserId === req.user.id) {
      return res.status(400).json({ msg: 'Cannot report yourself' });
    }
    
    // Check if reported user exists
    const reportedUser = await User.findById(reportedUserId);
    if (!reportedUser) {
      return res.status(404).json({ msg: 'Reported user not found' });
    }
    
    // Check if conversation exists and user is part of it
    if (conversationId) {
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({ msg: 'Conversation not found' });
      }
      if (!conversation.participants.includes(req.user.id)) {
        return res.status(403).json({ msg: 'Not authorized to report this conversation' });
      }
    }
    
    // Check if message exists and is part of the conversation
    if (messageId) {
      const message = await Message.findById(messageId);
      if (!message) {
        return res.status(404).json({ msg: 'Message not found' });
      }
      if (conversationId && message.conversationId.toString() !== conversationId) {
        return res.status(400).json({ msg: 'Message does not belong to this conversation' });
      }
    }
    
    // Create report
    const report = new Report({
      reportedBy: req.user.id,
      reportedUser: reportedUserId,
      conversationId: conversationId || null,
      messageId: messageId || null,
      reason,
      description,
      status: 'pending',
    });
    
    await report.save();
    
    // Populate report for socket emission
    const populatedReport = await Report.findById(report._id)
      .populate('reportedBy', 'username email')
      .populate('reportedUser', 'username email isBanned');
    
    // Emit socket event to all admins
    const io = req.app.get('io');
    if (io) {
      // Emit to admin room for real-time updates
      io.to('admin_room').emit('newReport', populatedReport);
      // Also emit dashboard update event
      io.to('admin_room').emit('dashboardUpdate');
    }
    
    res.json({ msg: 'Report submitted successfully. Our team will review it.', report });
  } catch (err) {
    console.error('Error creating report:', err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

module.exports = router;