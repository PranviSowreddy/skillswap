const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

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

    // If not, create one
    if (!conversation) {
      conversation = new Conversation({
        participants: [senderId, recipientId],
      });
      await conversation.save();
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
// @desc    Get all conversations for the logged-in user
router.get('/conversations/my', auth, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user.id,
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

module.exports = router;