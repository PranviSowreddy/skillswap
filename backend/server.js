require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const http = require('http'); // 1. Import http
const { Server } = require('socket.io'); // 2. Import socket.io

// Import models for chat
const Message = require('./models/Message');
const User = require('./models/User');

// Connect to Database
connectDB();
require('./services/reminderService');

const app = express();

// --- 3. Create HTTP server and Socket.IO server ---
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173', // Your frontend URL
    methods: ['GET', 'POST'],
  },
});
// --- End Socket.IO setup ---

// Init Middleware
app.use(cors());
app.use(express.json({ extended: false }));

// Make io accessible to routes
app.set('io', io);

// Define Routes
app.get('/', (req, res) => res.send('SkillSwap API Running'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/skills', require('./routes/skills'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/messages', require('./routes/messages')); // --- NEW ---
app.use('/api/stats', require('./routes/stats'));

// --- 4. Socket.IO Connection Logic ---
const Conversation = require('./models/Conversation');

// Store user socket mappings
const userSockets = new Map(); // userId -> socketId

io.on('connection', (socket) => {
  console.log(`User Connected: ${socket.id}`);

  // Handle user joining their personal room
  socket.on('joinUserRoom', async (userId) => {
    socket.join(`user_${userId}`);
    userSockets.set(userId, socket.id);
    
    // Notify others that this user is online
    socket.broadcast.emit('userOnline', userId);
    console.log(`User ${userId} joined their room`);
  });

  // Join a room based on conversationId
  socket.on('joinRoom', (conversationId) => {
    socket.join(conversationId);
    console.log(`User ${socket.id} joined room ${conversationId}`);
  });

  // Listen for a new message
  socket.on('sendMessage', async ({ conversationId, senderId, content }) => {
    try {
      // 1. Save the message to the database
      const newMessage = new Message({
        conversationId,
        sender: senderId,
        content,
      });
      await newMessage.save();
      
      // 2. Update conversation's updatedAt
      await Conversation.findByIdAndUpdate(conversationId, { updatedAt: new Date() });
      
      // 3. Populate sender info before emitting
      const populatedMessage = await Message.findById(newMessage._id).populate('sender', 'username');

      // 4. Emit the message to all users in the conversation room
      io.to(conversationId).emit('receiveMessage', populatedMessage);
      
      // 5. Notify all participants to refresh their conversation list
      const conversation = await Conversation.findById(conversationId);
      if (conversation) {
        conversation.participants.forEach(participantId => {
          io.to(`user_${participantId}`).emit('conversationUpdate');
        });
      }
    } catch (err) {
      console.error('Error saving or emitting message:', err);
    }
  });

  // Handle marking messages as read
  socket.on('markAsRead', async ({ conversationId, userId }) => {
    // This can be used to update read receipts if needed
    // For now, we'll just acknowledge it
    console.log(`User ${userId} marked conversation ${conversationId} as read`);
  });

  socket.on('disconnect', () => {
    // Find and remove user from online users
    for (const [userId, socketId] of userSockets.entries()) {
      if (socketId === socket.id) {
        userSockets.delete(userId);
        // Notify others that this user is offline
        socket.broadcast.emit('userOffline', userId);
        break;
      }
    }
    console.log(`User Disconnected: ${socket.id}`);
  });
});
// --- End Socket.IO logic ---

const PORT = process.env.PORT || 5000;

// 5. Listen on the 'server' (not 'app')
server.listen(PORT, () => console.log(`Server started on port ${PORT}`));