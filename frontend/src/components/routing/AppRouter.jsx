import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Login from '../auth/Login';
import Register from '../auth/Register';
import Dashboard from '../dashboard/Dashboard';
import Profile from '../profile/Profile';
import ChatbotOnboarding from '../onboarding/ChatbotOnboarding';

// This component replaces the old PrivateRoute logic
const AppRouter = () => {
  const { isAuthenticated, profileComplete, loading } = useAuth();

  if (loading) {
    return <div className="container"><h2>Loading...</h2></div>;
  }

  // --- THIS IS THE CORE LOGIC ---
  if (isAuthenticated && !profileComplete) {
    // User is logged in BUT has not finished the profile.
    // Force them to the onboarding.
    return (
      <Routes>
        <Route path="*" element={<ChatbotOnboarding />} />
      </Routes>
    );
  }

  if (isAuthenticated && profileComplete) {
    // User is logged in AND has a profile.
    // Show the full app.
    return (
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        {/* Redirect any other path to the dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    );
  }

  // User is not authenticated.
  // Show only login/register.
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      {/* Redirect any other path to login */}
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
};

export default AppRouter;