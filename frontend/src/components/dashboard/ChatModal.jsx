import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const ChatModal = ({ conversationId, recipient, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const socket = useSocket();
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 1. Fetch old messages and join room on load
  useEffect(() => {
    if (!socket || !conversationId) return;

    socket.emit('joinRoom', conversationId);
    
    const fetchMessages = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/messages/${conversationId}`);
        setMessages(res.data);
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch messages', err);
        setLoading(false);
      }
    };
    fetchMessages();
  }, [socket, conversationId]);

  // 2. Listen for new incoming messages (THE FIX IS HERE)
  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (message) => {
      // 'message' is the real message from the server, with a real DB _id
      setMessages((prev) => {
        if (message.sender._id === user._id) {
          // This message is from me. I need to *replace* my optimistic message.
          
          // Find the first message from the end of the array that is optimistic
          // and has the same content. This is the one to replace.
          const optimisticMsgIndex = findLastIndex(
            prev,
            m => m.isOptimistic && m.sender._id === user._id && m.content === message.content
          );

          if (optimisticMsgIndex > -1) {
            // Found the optimistic message. Replace it with the server's
            // confirmed message (which has the real _id).
            const newMessages = [...prev];
            newMessages[optimisticMsgIndex] = message;
            return newMessages;
          } else {
            // I sent this, but couldn't find an optimistic version?
            // This is a weird case, but to be safe, just add it.
            // (This also handles messages from another tab)
            if (!prev.find(m => m._id === message._id)) {
              return [...prev, message];
            }
            return prev;
          }

        } else {
          // This message is from the *other* user.
          // Just add it to the end.
          if (!prev.find(m => m._id === message._id)) {
            return [...prev, message];
          }
          return prev;
        }
      });
    };

    // Helper function to find last index
    const findLastIndex = (arr, predicate) => {
      for (let i = arr.length - 1; i >= 0; i--) {
        if (predicate(arr[i])) {
          return i;
        }
      }
      return -1;
    };

    socket.on('receiveMessage', handleReceiveMessage);

    // Clean up listener
    return () => {
      socket.off('receiveMessage', handleReceiveMessage);
    };
  }, [socket, user._id]); // Added user._id

  // 3. Scroll to bottom
  useEffect(scrollToBottom, [messages]);

  // 4. Handle sending a message (ADD THE FLAG)
  const handleSubmit = (e) => {
    e.preventDefault();
    if (newMessage.trim() === '' || !socket) return;

    const optimisticMessage = {
      // No database _id yet
      sender: { _id: user._id, username: user.username },
      content: newMessage,
      createdAt: new Date().toISOString(),
      isOptimistic: true // <-- ADD THIS FLAG
    }
    setMessages((prev) => [...prev, optimisticMessage]);
    
    socket.emit('sendMessage', {
      conversationId,
      senderId: user._id,
      content: newMessage,
    });
    
    setNewMessage('');
  };

  // --- (The rest of the JSX is exactly the same) ---
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ height: '70vh', display: 'flex', flexDirection: 'column' }}>
        <h3>Chat with {recipient?.username || 'User'}</h3>
        
        <div className="form-group" style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)', padding: '1rem', borderRadius: 'var(--border-radius)' }}>
          {loading ? (
            <p>Loading messages...</p>
          ) : (
            messages.map((msg, idx) => (
              <div key={msg._id || `optimistic-${idx}`} style={{ 
                textAlign: msg.sender._id === user._id ? 'right' : 'left', 
                margin: '0.5rem 0' 
              }}>
                <div style={{
                  display: 'inline-block',
                  padding: '0.5rem 1rem',
                  borderRadius: '15px',
                  background: msg.sender._id === user._id ? 'var(--primary-color)' : 'var(--light-color)',
                  color: msg.sender._id === user._id ? '#fff' : '#333',
                  border: msg.sender._id !== user._id ? '1px solid var(--border-color)' : 'none',
                  opacity: msg.isOptimistic ? 0.7 : 1 // Optimistic messages are slightly faded
                }}>
                  <strong>{msg.sender.username}: </strong>{msg.content}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', marginTop: '1rem', gap: '10px' }}>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="form-group"
            style={{ flex: 1, margin: 0 }}
          />
          <button type="submit" className="btn btn-primary">Send</button>
        </form>
      </div>
    </div>
  );
};

export default ChatModal;