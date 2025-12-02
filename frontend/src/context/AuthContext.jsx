import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));
  
  // --- NEW STATE ---
  // This will be true if the user has filled out their profile
  const [profileComplete, setProfileComplete] = useState(false);
  // --- END NEW ---

  const loadUser = async () => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      setToken(storedToken); // Set token for api interceptor
      setLoading(true); // Set loading to true when starting to load
      try {
        const userRes = await api.get('/auth');
        const userData = userRes.data;
        // Ensure role field exists (default to 'user' if not set)
        if (!userData.role) {
          userData.role = 'user';
        }
        setUser(userData);
        
        // --- NEW LOGIC ---
        // Also load the profile to check if it's complete
        try {
          const profileRes = await api.get('/profile');
          if (profileRes.data.skillsToTeach && profileRes.data.skillsToTeach.length > 0) {
            setProfileComplete(true);
          } else {
            setProfileComplete(false);
          }
        } catch (profileErr) {
          // Profile might not exist yet, that's okay
          console.log('Profile not found or incomplete:', profileErr);
          setProfileComplete(false);
        }
        // --- END NEW ---
        
      } catch (err) {
        console.error('Failed to load user', err);
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        setProfileComplete(false);
      }
    } else {
      setUser(null);
      setProfileComplete(false);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadUser();
  }, [token]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', res.data.token);
    setToken(res.data.token);
    // Explicitly call loadUser to ensure state updates immediately
    await loadUser();
  };

  const register = async (username, email, password) => {
    const res = await api.post('/auth/register', { username, email, password });
    localStorage.setItem('token', res.data.token);
    setToken(res.data.token);
    // Explicitly call loadUser to ensure state updates immediately
    await loadUser();
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setProfileComplete(false); // --- NEW ---
  };

  const value = {
    user,
    token,
    login,
    register,
    logout,
    loading,
    isAuthenticated: !!token,
    loadUser, // Expose this so the chatbot can call it
    profileComplete // --- NEW ---
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};