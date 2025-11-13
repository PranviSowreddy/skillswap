import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import api from '../../services/api';
import { Clock, Users, TrendingUp, Award, ChevronLeft, ChevronRight, Video, CheckCircle, Star } from 'lucide-react';
import ReviewModal from './ReviewModal';

const StatCard = ({ icon, label, value, change, bgColor, iconColor }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm flex items-start justify-between">
    <div>
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-3xl font-bold text-gray-800">{value}</p>
      {change && <p className="text-sm text-gray-400 mt-1">{change}</p>}
    </div>
    <div className={`p-3 rounded-full ${bgColor}`}>
      {React.cloneElement(icon, { className: iconColor })}
    </div>
  </div>
);

const SessionCalendar = ({ sessions, user }) => {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [activeTab, setActiveTab] = useState('teaching'); // 'teaching' or 'learning'

  const monthName = new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long' });
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

  // Get previous month's trailing days
  const prevMonth = new Date(currentYear, currentMonth, 0);
  const daysInPrevMonth = prevMonth.getDate();
  const trailingDays = [];
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    trailingDays.push(daysInPrevMonth - i);
  }

  // Get next month's leading days
  const totalCells = 42; // 6 weeks * 7 days
  const cellsUsed = trailingDays.length + daysInMonth;
  const leadingDays = [];
  for (let i = 1; i <= totalCells - cellsUsed; i++) {
    leadingDays.push(i);
  }

  // Filter sessions based on active tab - exclude completed sessions
  const filteredSessions = sessions.filter(s => {
    const isNotCompleted = s.status !== 'completed';
    const hasScheduledTime = s.scheduledTime && new Date(s.scheduledTime) >= new Date();
    
    if (activeTab === 'teaching') {
      return s.teacher._id === user._id && s.status === 'confirmed' && isNotCompleted && hasScheduledTime;
    } else {
      return s.learner._id === user._id && s.status === 'confirmed' && isNotCompleted && hasScheduledTime;
    }
  });

  // Get dates with sessions (only for current month)
  const sessionDates = new Set(
    filteredSessions
      .filter(s => {
        const date = new Date(s.scheduledTime);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      })
      .map(s => {
        const date = new Date(s.scheduledTime);
        return date.getDate();
      })
  );

  // Count only upcoming (not completed) sessions
  const teachingCount = sessions.filter(s => 
    s.teacher._id === user._id && 
    s.status === 'confirmed' && 
    s.status !== 'completed' && 
    s.scheduledTime && 
    new Date(s.scheduledTime) >= new Date()
  ).length;
  
  const learningCount = sessions.filter(s => 
    s.learner._id === user._id && 
    s.status === 'confirmed' && 
    s.status !== 'completed' && 
    s.scheduledTime && 
    new Date(s.scheduledTime) >= new Date()
  ).length;

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const isToday = (day) => {
    return day === today.getDate() && 
           currentMonth === today.getMonth() && 
           currentYear === today.getFullYear();
  };

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 p-6 rounded-3xl shadow-2xl border border-gray-200/50">
      {/* Month navigation */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-bold text-gray-800 capitalize">
          {monthName} <span className="text-gray-500 font-semibold">{currentYear}</span>
        </h3>
        <div className="flex gap-2">
          <button 
            onClick={handlePrevMonth} 
            className="p-2 rounded-lg bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all duration-200 shadow-sm hover:shadow-md border border-gray-200"
            aria-label="Previous month"
          >
            <ChevronLeft size={18} />
          </button>
          <button 
            onClick={handleNextMonth} 
            className="p-2 rounded-lg bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all duration-200 shadow-sm hover:shadow-md border border-gray-200"
            aria-label="Next month"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-2 mb-3">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div 
            key={day} 
            className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2 mb-6">
        {/* Previous month days */}
        {trailingDays.map((day) => (
          <div 
            key={`prev-${day}`} 
            className="aspect-square flex items-center justify-center text-gray-300 text-sm rounded-lg"
          >
            {day}
          </div>
        ))}

        {/* Current month days */}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const hasSession = sessionDates.has(day);
          const isTodayDate = isToday(day);

          return (
            <div
              key={day}
              className={`aspect-square flex flex-col items-center justify-center rounded-lg transition-all duration-200 ${
                isTodayDate
                  ? 'bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-lg font-bold'
                  : hasSession
                  ? 'bg-white hover:bg-gray-50 cursor-pointer'
                  : 'bg-white hover:bg-gray-50 cursor-pointer'
              }`}
            >
              <span className={`text-sm font-medium ${isTodayDate ? 'text-white' : 'text-gray-800'}`}>
                {day}
              </span>
              {hasSession && (
                <span className={`text-xs font-bold mt-0.5 ${isTodayDate ? 'text-white' : 'text-gray-600'}`}>
                  .
                </span>
              )}
            </div>
          );
        })}

        {/* Next month days */}
        {leadingDays.map((day) => (
          <div 
            key={`next-${day}`} 
            className="aspect-square flex items-center justify-center text-gray-300 text-sm rounded-lg"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Teaching/Learning tabs below calendar */}
      <div className="flex items-center justify-center gap-3 pt-4 border-t border-gray-200">
        <button
          onClick={() => setActiveTab('teaching')}
          className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
            activeTab === 'teaching'
              ? 'bg-blue-500 text-white shadow-md'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Teaching <span className="ml-1 font-bold">{teachingCount}</span>
        </button>
        <button
          onClick={() => setActiveTab('learning')}
          className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
            activeTab === 'learning'
              ? 'bg-orange-500 text-white shadow-md'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Learning <span className="ml-1 font-bold">{learningCount}</span>
        </button>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { user } = useAuth();
  const socket = useSocket();
  const [stats, setStats] = useState({
    hoursExchanged: 0,
    hoursThisWeek: 0,
    activeSessions: 0,
    learningStreak: 0,
    skillsMastered: 0,
    skillsInProgress: 0,
  });
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [teachingSessions, setTeachingSessions] = useState([]);
  const [learningSessions, setLearningSessions] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [allSessions, setAllSessions] = useState([]);
  const [skillProgress, setSkillProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSessionTab, setActiveSessionTab] = useState('teaching'); // 'teaching' or 'learning'
  const [dateFilter, setDateFilter] = useState(30); // 7, 15, or 30 days

  // Review Modal States
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [currentSessionToReview, setCurrentSessionToReview] = useState(null);
  const [revieweeIdForModal, setRevieweeIdForModal] = useState(null);

  const fetchData = async () => {
    try {
      const [statsRes, sessionsRes, reviewsRes, skillsRes] = await Promise.all([
        api.get('/stats'),
        api.get('/sessions'),
        api.get('/reviews/my'),
        api.get('/stats/skills'),
      ]);
      setStats(statsRes.data);
      setAllSessions(sessionsRes.data);
      setSkillProgress(skillsRes.data || []);

      const now = new Date();
      const upcoming = sessionsRes.data
        .filter(s => s.scheduledTime && new Date(s.scheduledTime) > now && s.status !== 'completed')
        .sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime));

      // Filter recent activity: top 7 completed sessions that are unreviewed
      const completed = sessionsRes.data
        .filter(s => s.status === 'completed')
        .sort((a, b) => new Date(b.scheduledTime || b.requestedDate) - new Date(a.scheduledTime || a.requestedDate));
      
      // Get unreviewed sessions (where user hasn't reviewed yet)
      const recent = completed.filter(session => {
        const isTeacher = session.teacher._id === user._id;
        const isLearner = session.learner._id === user._id;
        
        // Check if user has reviewed
        const hasReviewed = (isTeacher && session.teacherReviewed) || (isLearner && session.learnerReviewed);
        const userReview = reviewsRes.data.find(
          review => review.sessionId === session._id && review.reviewerId === user._id
        );
        
        return !hasReviewed && !userReview;
      }).slice(0, 7);

      // Attach review data to recent activities
      // Check both session review flags and reviews API
      const recentWithReviews = recent.map(session => {
        const isTeacher = session.teacher._id === user._id;
        const isLearner = session.learner._id === user._id;
        
        // Check if user has reviewed using session flags (more reliable)
        const hasReviewedFlag = (isTeacher && session.teacherReviewed) || (isLearner && session.learnerReviewed);
        
        // Also check reviews API for the actual review object
        const userReview = reviewsRes.data.find(
          review => review.sessionId === session._id && review.reviewerId === user._id
        );
        
        // If session flag says reviewed but no review object found, create a placeholder
        // This handles cases where flags are set but review data isn't loaded yet
        const reviewStatus = hasReviewedFlag || userReview ? (userReview || { exists: true }) : null;
        
        return { ...session, userReview: reviewStatus };
      });

      // Filter sessions by date range
      const filterDate = new Date();
      filterDate.setDate(filterDate.getDate() + dateFilter);
      
      const filteredUpcoming = upcoming.filter(s => {
        const sessionDate = new Date(s.scheduledTime);
        return sessionDate <= filterDate;
      });

      // Separate teaching and learning sessions
      const teaching = filteredUpcoming.filter(s => s.teacher._id === user._id);
      const learning = filteredUpcoming.filter(s => s.learner._id === user._id);

      setUpcomingSessions(filteredUpcoming);
      setTeachingSessions(teaching);
      setLearningSessions(learning);
      setRecentActivity(recentWithReviews);

      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, dateFilter]);

  // Listen for meeting created event
  useEffect(() => {
    if (socket) {
      socket.on('meetingCreated', (data) => {
        // Update all session states with the new meeting link
        const updateSession = (session) => {
          if (session._id === data.sessionId) {
            return {
              ...session,
              meetingLink: data.meetingLink,
            };
          }
          return session;
        };

        setAllSessions(prev => prev.map(updateSession));
        setTeachingSessions(prev => prev.map(updateSession));
        setLearningSessions(prev => prev.map(updateSession));
        setUpcomingSessions(prev => prev.map(updateSession));
        
        // Show notification
        alert(`Meeting created! ${data.teacher} has started the session for ${data.skill}.`);
      });

      return () => {
        socket.off('meetingCreated');
      };
    }
  }, [socket]);

  const handleStartSession = async (session) => {
    const isTeaching = session.teacher._id === user._id;
    
    // If teacher and no meeting exists, create one
    if (isTeaching && !session.meetingLink) {
      try {
        const res = await api.post(`/sessions/create-meeting/${session._id}`);
        // Update session with meeting link
        const updatedSession = {
          ...session,
          meetingLink: res.data.meetingLink,
          startUrl: res.data.startUrl
        };
        
        // Update local state
        setAllSessions(prev => prev.map(s => s._id === session._id ? updatedSession : s));
        setUpcomingSessions(prev => prev.map(s => s._id === session._id ? updatedSession : s));
        setTeachingSessions(prev => prev.map(s => s._id === session._id ? updatedSession : s));
        setLearningSessions(prev => prev.map(s => s._id === session._id ? updatedSession : s));
        
        // Open meeting
        if (res.data.startUrl) {
          window.open(res.data.startUrl, '_blank');
        } else if (res.data.meetingLink) {
          window.open(res.data.meetingLink, '_blank');
        }
      } catch (err) {
        console.error('Failed to create meeting', err);
        alert(err.response?.data?.msg || 'Failed to create meeting');
      }
    } else {
      // Student joins or teacher opens existing meeting
      if (session.startUrl && isTeaching) {
        window.open(session.startUrl, '_blank');
      } else if (session.meetingLink) {
        window.open(session.meetingLink, '_blank');
      }
    }
  };

  const handleCompleteSession = async (session) => {
    if (window.confirm('Are you sure you want to end this session?')) {
      try {
        await api.put(`/sessions/complete/${session._id}`);
        fetchData();
      } catch (err) {
        console.error('Error completing session:', err);
        alert('Failed to complete session.');
      }
    }
  };

  const handleOpenReview = (session) => {
    // Only learners can review teachers
    const isLearner = session.learner._id === user._id;
    const hasReviewed = !!(session.userReview);
    
    // Prevent opening modal if already reviewed (defensive check)
    if (isLearner && !hasReviewed) {
      setCurrentSessionToReview(session);
      setRevieweeIdForModal(session.teacher._id);
      setShowReviewModal(true);
    }
    // If already reviewed, do nothing (button should be disabled anyway)
  };

  const handleReviewSubmitted = async (submittedSessionId) => {
    setShowReviewModal(false);
    setCurrentSessionToReview(null);
    setRevieweeIdForModal(null);
    
    // Immediately update local state to mark session as reviewed (optimistic update)
    if (submittedSessionId) {
      setRecentActivity(prev => 
        prev.map(session => {
          if (session._id === submittedSessionId) {
            // Mark as reviewed by adding a placeholder review object that matches API structure
            return { 
              ...session, 
              userReview: { 
                _id: 'temp-review-id', // Temporary ID
                sessionId: submittedSessionId, 
                reviewerId: user._id,
                revieweeId: session.teacher._id,
                rating: 0, // Will be updated when fetchData completes
                comment: '',
                date: new Date()
              } 
            };
          }
          return session;
        })
      );
    }
    
    // Then refresh data from server to get the actual review
    await fetchData();
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const tomorrowOnly = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());

    if (dateOnly.getTime() === todayOnly.getTime()) {
      return `Today, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    } else if (dateOnly.getTime() === tomorrowOnly.getTime()) {
      return `Tomorrow, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        hour: 'numeric', 
        minute: '2-digit' 
      });
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  };

  if (loading) {
    return <div className="text-center p-10">Loading dashboard...</div>;
  }

  return (
    <div className="bg-gray-50 min-h-screen w-screen" style={{ marginLeft: 'calc(-50vw + 50%)', marginRight: 'calc(-50vw + 50%)', width: '100vw' }}>
      {showReviewModal && currentSessionToReview && (
        <ReviewModal
          sessionId={currentSessionToReview._id}
          revieweeId={revieweeIdForModal}
          onClose={() => setShowReviewModal(false)}
          onReviewSubmitted={handleReviewSubmitted}
        />
      )}

      <div className="w-full px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Welcome back, {user?.username}!</h1>
        <p className="text-gray-500 mb-8">Track your learning journey and upcoming sessions</p>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={<Clock size={24} />}
            label="Hours Exchanged"
            value={stats.hoursExchanged}
            change={stats.hoursThisWeek > 0 ? `+${stats.hoursThisWeek} this week` : null}
            bgColor="bg-blue-100"
            iconColor="text-blue-500"
          />
          <StatCard
            icon={<Users size={24} />}
            label="Active Sessions"
            value={stats.activeSessions}
            change={upcomingSessions.length > 0 ? `${upcomingSessions.length} upcoming` : null}
            bgColor="bg-orange-100"
            iconColor="text-orange-500"
          />
          <StatCard
            icon={<TrendingUp size={24} />}
            label="Learning Streak"
            value={stats.learningStreak}
            change="days"
            bgColor="bg-purple-100"
            iconColor="text-purple-500"
          />
          <StatCard
            icon={<Award size={24} />}
            label="Skills Mastered"
            value={stats.skillsMastered}
            change={stats.skillsInProgress > 0 ? `${stats.skillsInProgress} in progress` : null}
            bgColor="bg-green-100"
            iconColor="text-green-500"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-6 gap-8">
          <div className="lg:col-span-4 space-y-8">
            {/* Upcoming Sessions with Tabs */}
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
                <h3 className="font-bold text-lg text-gray-800">Upcoming Sessions</h3>
                <div className="flex gap-2 flex-wrap">
                  {/* Date Filter */}
                  <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-2 py-1">
                    <span className="text-xs text-gray-600">Filter:</span>
                    <button
                      onClick={() => setDateFilter(7)}
                      className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                        dateFilter === 7
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      7 days
                    </button>
                    <button
                      onClick={() => setDateFilter(15)}
                      className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                        dateFilter === 15
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      15 days
                    </button>
                    <button
                      onClick={() => setDateFilter(30)}
                      className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                        dateFilter === 30
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      30 days
                    </button>
                  </div>
                  {/* Session Type Tabs */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setActiveSessionTab('teaching')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        activeSessionTab === 'teaching'
                          ? 'bg-teal-500 text-white shadow-md'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Teaching ({teachingSessions.length})
                    </button>
                    <button
                      onClick={() => setActiveSessionTab('learning')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        activeSessionTab === 'learning'
                          ? 'bg-orange-500 text-white shadow-md'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Learning ({learningSessions.length})
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                {activeSessionTab === 'teaching' ? (
                  teachingSessions.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No upcoming teaching sessions</p>
                  ) : (
                    teachingSessions.map(session => {
                      const otherUser = session.learner;
                      const otherUserInitial = getInitials(otherUser.username);

                      return (
                        <div key={session._id} className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50">
                          <div className="flex items-center gap-4 flex-1">
                            <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center font-bold text-teal-600 text-lg">
                              {otherUserInitial}
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-gray-800">{session.skill}</p>
                              <p className="text-sm text-gray-500">Teaching {otherUser.username}</p>
                              <p className="text-sm text-gray-400">{formatDate(session.scheduledTime)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="px-3 py-1 text-xs font-medium rounded-full bg-teal-100 text-teal-700">
                              Teaching
                            </span>
                            {session.status === 'confirmed' && (
                              <button
                                onClick={() => handleStartSession(session)}
                                className="p-2 text-gray-600 hover:text-gray-800"
                                title={session.meetingLink ? 'Start Session' : 'Create & Start Meeting'}
                              >
                                <Video size={20} />
                              </button>
                            )}
                            {session.status === 'confirmed' && (
                              <button
                                onClick={() => handleCompleteSession(session)}
                                className="p-2 text-green-600 hover:text-green-800"
                                title="End Session"
                              >
                                <CheckCircle size={20} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )
                ) : (
                  learningSessions.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No upcoming learning sessions</p>
                  ) : (
                    learningSessions.map(session => {
                      const otherUser = session.teacher;
                      const otherUserInitial = getInitials(otherUser.username);

                      return (
                        <div key={session._id} className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50">
                          <div className="flex items-center gap-4 flex-1">
                            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center font-bold text-orange-600 text-lg">
                              {otherUserInitial}
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-gray-800">{session.skill}</p>
                              <p className="text-sm text-gray-500">Learning from {otherUser.username}</p>
                              <p className="text-sm text-gray-400">{formatDate(session.scheduledTime)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="px-3 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700">
                              Learning
                            </span>
                            {session.status === 'confirmed' && session.meetingLink && (
                              <button
                                onClick={() => handleStartSession(session)}
                                className="p-2 text-gray-600 hover:text-gray-800"
                                title="Join Session"
                              >
                                <Video size={20} />
                              </button>
                            )}
                            {session.status === 'confirmed' && !session.meetingLink && (
                              <span className="text-xs text-gray-500">Waiting for teacher to start...</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <h3 className="font-bold text-lg text-gray-800 mb-4">Recent Activity</h3>
              <div className="space-y-4">
                {recentActivity.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No recent activity</p>
                ) : (
                  recentActivity.map(activity => {
                    const isTeaching = activity.teacher._id === user._id;
                    const isLearner = activity.learner._id === user._id;
                    const otherUser = isTeaching ? activity.learner : activity.teacher;
                    const otherUserInitial = getInitials(otherUser.username);
                    // Check if user has reviewed - check if userReview object exists
                    const hasReviewed = !!(activity.userReview);
                    const canReview = isLearner && !hasReviewed;

                    return (
                      <div key={activity._id} className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-600 text-lg">
                            {otherUserInitial}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-gray-800">{activity.skill}</p>
                            <p className="text-sm text-gray-500">{otherUser.username}</p>
                            <p className="text-sm text-gray-400">{formatDate(activity.scheduledTime || activity.requestedDate)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-3 py-1 text-xs font-medium rounded-full ${
                              isTeaching
                                ? 'bg-teal-100 text-teal-700'
                                : 'bg-orange-100 text-orange-700'
                            }`}
                          >
                            {isTeaching ? 'Teaching' : 'Learning'}
                          </span>
                          <span className="px-3 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                            Completed
                          </span>
                          {/* Review Button - Only for learners */}
                          {isLearner && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                // Only open review modal if not already reviewed
                                if (!hasReviewed) {
                                  handleOpenReview(activity);
                                }
                              }}
                              disabled={hasReviewed}
                              className={`px-3 py-1.5 text-xs font-semibold rounded-lg shadow-sm transition-all duration-200 flex items-center gap-1.5 ${
                                hasReviewed
                                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed opacity-60'
                                  : 'bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white hover:shadow-md cursor-pointer'
                              }`}
                              title={hasReviewed ? 'You have already reviewed this teacher' : 'Review this teacher'}
                            >
                              <Star size={14} fill={hasReviewed ? "currentColor" : "none"} />
                              <span>{hasReviewed ? 'Reviewed' : 'Review'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Session Calendar and Progress */}
          <div className="lg:col-span-2 space-y-8">
            <SessionCalendar sessions={allSessions} user={user} />
            
            {/* Learning Skills Progress */}
            {skillProgress.length > 0 && (
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <h3 className="font-bold text-lg text-gray-800 mb-4">Learning Skills Progress</h3>
                <div className="space-y-4">
                  {skillProgress.map((skill) => (
                    <div key={skill.skill} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">{skill.skill}</span>
                        <span className="text-sm text-gray-500">
                          {skill.hoursCompleted.toFixed(1)} / {skill.totalHours} hours
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-teal-500 to-teal-600 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${skill.progress}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-400 text-right">
                        {skill.progress.toFixed(1)}% complete
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
