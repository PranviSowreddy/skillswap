import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { LayoutDashboard, Search, User, LogOut, UserPlus, Users, MessageSquare, Bell } from 'lucide-react';

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  const onLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  // Fetch pending requests count
  useEffect(() => {
    if (isAuthenticated && user) {
      const fetchPendingCount = async () => {
        try {
          const res = await api.get('/sessions');
          const incomingRequests = res.data.filter(
            (s) => s.teacher._id === user._id && s.status === 'pending'
          );
          setPendingRequestsCount(incomingRequests.length);
        } catch (err) {
          console.error('Failed to fetch pending requests', err);
        }
      };
      fetchPendingCount();
      // Refresh every 30 seconds
      const interval = setInterval(fetchPendingCount, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, user]);

  const authLinks = (
    <div className="flex items-center gap-6">
      <Link 
        to="/dashboard" 
        className={`flex items-center gap-2 ${isActive('/dashboard') ? 'text-gray-900 font-medium' : 'text-gray-600 hover:text-gray-900'}`}
      >
        <LayoutDashboard size={20} />
        <span>Dashboard</span>
      </Link>
      <Link 
        to="/browse" 
        className={`flex items-center gap-2 pb-1 ${isActive('/browse') ? 'text-gray-900 font-medium border-b-2 border-purple-600' : 'text-gray-600 hover:text-gray-900'}`}
      >
        <Users size={20} />
        <span>Browse</span>
      </Link>
      <Link 
        to="/messages" 
        className={`flex items-center gap-2 pb-1 ${isActive('/messages') ? 'text-gray-900 font-medium border-b-2 border-purple-600' : 'text-gray-600 hover:text-gray-900'}`}
      >
        <MessageSquare size={20} />
        <span>Chat</span>
      </Link>
      <Link 
        to="/requests" 
        className={`flex items-center gap-2 pb-1 relative ${isActive('/requests') ? 'text-gray-900 font-medium border-b-2 border-purple-600' : 'text-gray-600 hover:text-gray-900'}`}
      >
        <Bell size={20} />
        <span>Requests</span>
        {pendingRequestsCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {pendingRequestsCount > 9 ? '9+' : pendingRequestsCount}
          </span>
        )}
      </Link>
      <Link 
        to="/profile" 
        className={`flex items-center gap-2 ${isActive('/profile') ? 'text-gray-900 font-medium' : 'text-gray-600 hover:text-gray-900'}`}
      >
        <User size={20} />
        <span>Profile</span>
      </Link>
      <button onClick={onLogout} className="flex items-center gap-2 text-red-500 hover:text-red-700">
        <LogOut size={20} />
        <span>Logout</span>
      </button>
    </div>
  );

  const guestLinks = (
    <div className="flex items-center gap-6">
      <Link to="/login" className="text-gray-600 hover:text-gray-900">
        Login
      </Link>
      <Link to="/register" className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-900">
        <UserPlus size={20} />
        <span>Register</span>
      </Link>
    </div>
  );

  return (
    <nav className="bg-white shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link to={isAuthenticated ? "/dashboard" : "/"} className="flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <span className="text-2xl font-bold text-gray-800">SkillSwap</span>
          </Link>
          <div>
            {isAuthenticated ? authLinks : guestLinks}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;