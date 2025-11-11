import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

// We import the components that the dashboard *used* to show
import SearchResults from './SearchResults';
import SessionManager from './SessionManager';

// We need the icons
import { MessageCircle, Search, Calendar, BarChart3 } from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();
  const [view, setView] = useState('main'); // 'main', 'search', 'sessions'
  const [messages, setMessages] = useState([]);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const messagesEndRef = useRef(null);

  // --- Search state (moved from old dashboard) ---
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searched, setSearched] = useState(false);

  // Helper to scroll to the bottom of the chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  // Helper to add a bot message
  const addBotMessage = (text) => {
    setIsBotTyping(true);
    setTimeout(() => {
      setMessages(prev => [...prev, { sender: 'bot', text }]);
      setIsBotTyping(false);
    }, 600);
  };

  // Add the initial welcome message
  useEffect(() => {
    setMessages([{ 
      sender: 'bot', 
      text: `Welcome back, ${user.username}! What would you like to do today?` 
    }]);
  }, [user.username]);

  // Handle clicking the main menu buttons
  const handleMenuClick = (selection) => {
    if (selection === 'stats') {
      setView('stats');
      addBotMessage("Here are your current stats:");
    } else if (selection === 'search') {
      setView('search');
      addBotMessage("Great! What skill are you looking for?");
    } else if (selection === 'sessions') {
      setView('sessions');
      addBotMessage("Here's a summary of all your sessions.");
    }
  };

  // Handle the search for skills
  const onSearch = async (e) => {
    e.preventDefault();
    if (searchTerm.trim() === '') return;
    
    setLoadingSearch(true);
    setSearched(true);
    addBotMessage(`Searching for teachers who know "${searchTerm}"...`);

    try {
      const res = await api.get(`/skills/search?skill=${searchTerm}`);
      const mySkills = user.skillsToTeach || [];
      const sortedResults = res.data.sort((a, b) => {
        const aWantsMySkill = a.skillsToLearn.some(skill => mySkills.includes(skill));
        const bWantsMySkill = b.skillsToLearn.some(skill => mySkills.includes(skill));
        if (aWantsMySkill && !bWantsMySkill) return -1;
        if (!aWantsMySkill && bWantsMySkill) return 1;
        return 0;
      });
      setResults(sortedResults);
    } catch (err) {
      console.error(err);
    }
    setLoadingSearch(false);
  };

  // This renders the correct "view" (stats, search, or sessions)
  const renderCurrentView = () => {
    switch (view) {
      case 'stats':
        return (
          <div className="bg-white rounded-xl shadow-md p-6 my-4">
            <div className="stats-grid">
              <div className="stat-item">
                <h2>{user?.hoursLearned || 0}</h2>
                <p>Hours Learned</p>
              </div>
              <div className="stat-item">
                <h2>{user?.hoursTaught || 0}</h2>
                <p>Hours Taught</p>
              </div>
              <div className="stat-item">
                <h2>{user?.currentStreak || 0}</h2>
                <p>Day Streak</p>
              </div>
            </div>
          </div>
        );
      case 'search':
        return (
          <div className="bg-gray-50 rounded-xl p-4 my-4">
            <form onSubmit={onSearch} style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                placeholder="e.g., 'SQL Basics' or 'Guitar'"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <button type="submit" className="btn btn-primary">Search</button>
            </form>
            {loadingSearch ? (
              <p style={{marginTop: '1.5rem'}}>Loading...</p>
            ) : (
              <SearchResults 
                results={results} 
                mySkills={user?.skillsToTeach || []}
                searched={searched}
              />
            )}
          </div>
        );
      case 'sessions':
        return (
          <div className="my-4">
            {/* We just render the SessionManager component directly.
                It's already styled with our original index.css */}
            <SessionManager />
          </div>
        );
      case 'main':
      default:
        return (
          <div className="flex flex-wrap gap-3 my-4">
            <button
              onClick={() => handleMenuClick('stats')}
              className="px-6 py-3 bg-white border-2 border-purple-500 text-purple-600 rounded-xl hover:bg-purple-500 hover:text-white transition font-medium flex items-center gap-2"
            >
              <BarChart3 size={20} /> My Stats
            </button>
            <button
              onClick={() => handleMenuClick('search')}
              className="px-6 py-3 bg-white border-2 border-purple-500 text-purple-600 rounded-xl hover:bg-purple-500 hover:text-white transition font-medium flex items-center gap-2"
            >
              <Search size={20} /> Find a Teacher
            </button>
            <button
              onClick={() => handleMenuClick('sessions')}
              className="px-6 py-3 bg-white border-2 border-purple-500 text-purple-600 rounded-xl hover:bg-purple-500 hover:text-white transition font-medium flex items-center gap-2"
            >
              <Calendar size={20} /> Manage My Sessions
            </button>
          </div>
        );
    }
  };

  return (
    // This is the outer shell, styled like your chatbot
    <div className="min-h-full bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 -m-8 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-t-2xl shadow-lg p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Dashboard</h2>
              <p className="text-sm text-gray-600">Your personal command center</p>
            </div>
          </div>
        </div>

        <div className="bg-white shadow-lg p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 250px)' }}>
          <div className="space-y-4 pb-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-4 rounded-2xl ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {isBotTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-100 p-4 rounded-2xl">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* This is where the interactive parts (menu, search, sessions) render */}
          {!isBotTyping && (
            <div>
              {renderCurrentView()}
            </div>
          )}

        </div>

        {/* This footer lets the user go back to the main menu */}
        <div className="bg-white rounded-b-2xl shadow-lg p-4 text-center">
          {view !== 'main' && (
            <button
              onClick={() => {
                setView('main');
                addBotMessage("What else can I help you with?");
              }}
              className="text-sm text-purple-600 hover:underline font-medium"
            >
              Back to Main Menu
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;