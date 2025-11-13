import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (isAuthenticated && user) {
      // Connect to the socket server if user is logged in
      const newSocket = io('http://localhost:5000');
      
      // Join user's personal room when connected
      newSocket.on('connect', () => {
        newSocket.emit('joinUserRoom', user._id);
      });
      
      setSocket(newSocket);

      // Clean up on disconnect or logout
      return () => {
        newSocket.close();
      };
    } else {
      // If user logs out, disconnect socket
      if (socket) {
        socket.close();
        setSocket(null);
      }
    }
  }, [isAuthenticated, user]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};