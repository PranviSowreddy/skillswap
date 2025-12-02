import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Search, ArrowRight, MessageSquare, UserPlus, Star, Clock, GraduationCap, BookOpen, Calendar, Video, Users as UsersIcon, MessageCircle, X } from 'lucide-react';
import { predefinedSkills, normalizeSkillName, getAllUserSkills } from '../../utils/skills';
import UserProfileModal from './UserProfileModal';
import { parseTimeSlots } from '../../utils/timeSlots';
import { parseTimezoneOffset } from '../../utils/timezone';

const MINUTES_PER_DAY = 1440;

const normalizeMinute = (value) => {
  return ((value % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
};

const buildAvailabilityProfile = (userInfo) => {
  if (!userInfo) {
    return { isFlexible: false, minutes: null, totalHours: 0 };
  }

  const availabilityFormat = userInfo.availability?.format || '';
  const timeZone = userInfo.availability?.timeZone || 'Not set';
  const normalizedFormat = availabilityFormat.trim();

  if (!normalizedFormat || normalizedFormat === 'Not set') {
    return { isFlexible: false, minutes: null, totalHours: 0 };
  }

  const isFlexible = normalizedFormat.toLowerCase().includes('flexible');
  if (isFlexible) {
    return { isFlexible: true, minutes: null, totalHours: 24 };
  }

  const ranges = parseTimeSlots(normalizedFormat);
  if (!ranges.length) {
    return { isFlexible: false, minutes: null, totalHours: 0 };
  }

  const offsetMinutes = Math.round(parseTimezoneOffset(timeZone) * 60);
  const availabilityMinutes = new Array(MINUTES_PER_DAY).fill(false);
  let totalMinutes = 0;

  ranges.forEach((range) => {
    if (range.start === null || range.end === null) return;
    let duration = range.end - range.start;
    if (duration <= 0) {
      duration += MINUTES_PER_DAY;
    }
    duration = Math.min(duration, MINUTES_PER_DAY);

    for (let i = 0; i < duration; i++) {
      const localMinute = (range.start + i) % MINUTES_PER_DAY;
      const utcMinute = normalizeMinute(localMinute - offsetMinutes);
      if (!availabilityMinutes[utcMinute]) {
        availabilityMinutes[utcMinute] = true;
        totalMinutes++;
      }
    }
  });

  return {
    isFlexible: false,
    minutes: availabilityMinutes,
    totalHours: totalMinutes / 60,
  };
};

const calculateOverlapHours = (profileA, profileB) => {
  if (!profileA || !profileB) return 0;

  if (profileA.isFlexible && profileB.isFlexible) {
    return 24;
  }
  if (profileA.isFlexible) {
    return profileB.totalHours || 0;
  }
  if (profileB.isFlexible) {
    return profileA.totalHours || 0;
  }
  if (!profileA.minutes || !profileB.minutes) {
    return 0;
  }

  let overlapMinutes = 0;
  for (let i = 0; i < MINUTES_PER_DAY; i++) {
    if (profileA.minutes[i] && profileB.minutes[i]) {
      overlapMinutes++;
    }
  }
  return overlapMinutes / 60;
};

const Browse = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [pendingRequests, setPendingRequests] = useState({ incoming: [], outgoing: [] });
  const [allAvailableSkills, setAllAvailableSkills] = useState(predefinedSkills);
  const [selectedSkillForRequest, setSelectedSkillForRequest] = useState('');
  const [skillSearchForRequest, setSkillSearchForRequest] = useState('');
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [currentTeacherForRequest, setCurrentTeacherForRequest] = useState(null);
  const [selectedUserProfile, setSelectedUserProfile] = useState(null);

  const userAvailabilityProfile = useMemo(() => buildAvailabilityProfile(user), [user]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, conversationsRes, requestsRes] = await Promise.all([
          api.get('/profile/all'),
          api.get('/messages/conversations/my').catch(() => ({ data: [] })),
          api.get('/messages/requests/pending').catch(() => ({ data: { incoming: [], outgoing: [] } }))
        ]);
        // Filter out current user
        const filteredUsers = usersRes.data.filter(u => u._id !== user?._id);
        setUsers(filteredUsers);
        setConversations(conversationsRes.data || []);
        setPendingRequests(requestsRes.data || { incoming: [], outgoing: [] });
        
        // Load all available skills
        const userSkills = await getAllUserSkills(api);
        const combined = [...new Set([...predefinedSkills, ...userSkills])].sort();
        setAllAvailableSkills(combined);
        
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    if (user) {
      fetchData();
    }
  }, [user]);

  // Close modal when clicking outside or pressing Escape
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && showSkillModal) {
        setShowSkillModal(false);
        setCurrentTeacherForRequest(null);
        setSelectedSkillForRequest('');
        setSkillSearchForRequest('');
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showSkillModal]);

  const handleRequestSession = async (teacherId, skill) => {
    const normalizedSkill = normalizeSkillName(skill);
    if (!normalizedSkill) {
      showToast('Please select a skill to learn', 'warning');
      return;
    }
    try {
      await api.post('/sessions/request', { teacherId, skill: normalizedSkill });
      showToast('Session request sent successfully!', 'success');
      setSelectedSkillForRequest('');
      setSkillSearchForRequest('');
      setShowSkillModal(false);
      setCurrentTeacherForRequest(null);
      
      // Add to available skills if it's new
      if (!allAvailableSkills.some(s => s.toLowerCase() === normalizedSkill.toLowerCase())) {
        setAllAvailableSkills([...allAvailableSkills, normalizedSkill].sort());
      }
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.msg || 'Error sending session request.', 'error');
    }
  };

  const getFilteredSkillsForRequest = (searchQuery) => {
    // Get the teacher's skills to teach
    const teacherSkills = currentTeacherForRequest?.skillsToTeach || [];
    
    // If no teacher is selected, return empty array
    if (!currentTeacherForRequest || teacherSkills.length === 0) {
      return [];
    }
    
    // Filter based on search query
    if (!searchQuery.trim()) {
      // Show all teacher skills if no search query
      return teacherSkills.slice(0, 20);
    }
    
    const query = searchQuery.toLowerCase();
    return teacherSkills.filter(skill => 
      skill.toLowerCase().includes(query)
    ).slice(0, 20);
  };

  const handleConnect = async (recipientId) => {
    try {
      // Send chat request
      await api.post(`/messages/request/${recipientId}`);
      showToast('Connection request sent! The user will need to accept it before you can chat.', 'success', 5000);
      // Refresh data
      const requestsRes = await api.get('/messages/requests/pending').catch(() => ({ data: { incoming: [], outgoing: [] } }));
      setPendingRequests(requestsRes.data || { incoming: [], outgoing: [] });
    } catch (err) {
      console.error('Failed to send connection request', err);
      showToast(err.response?.data?.msg || 'Could not send connection request. Please try again.', 'error');
    }
  };

  const handleStartChat = async (recipientId) => {
    try {
      // Find the accepted conversation
      const conversation = conversations.find(c => c.participant._id === recipientId);
      if (conversation) {
        navigate(`/messages?conversation=${conversation._id}`);
      } else {
        // Try to get or create conversation
      const res = await api.get(`/messages/start/${recipientId}`);
      navigate(`/messages?conversation=${res.data._id}`);
      }
    } catch (err) {
      console.error('Failed to start chat', err);
      showToast('Could not open chat. Please try again.', 'error');
    }
  };

  // Check if user is connected (has accepted conversation)
  const isConnected = (userId) => {
    return conversations.some(c => c.participant._id === userId);
  };

  // Check if there's a pending request (outgoing)
  const hasPendingRequest = (userId) => {
    return pendingRequests.outgoing.some(req => req.participant._id === userId);
  };

  // Weight Model for Matching
  const calculateMatchScore = (teacher, currentUser, teacherAvailabilityProfile, userAvailabilityProfile) => {
    let score = 0;
    
    // 1. Rating (30% weight) - Quality indicator
    const rating = teacher.averageRating || 0;
    score += (rating / 5) * 30; // Normalize to 0-5 scale, 30% weight
    
    // 2. Hours Taught (20% weight) - Experience indicator
    const hoursTaught = teacher.hoursTaught || 0;
    // Normalize: 0-10 hours = 0-50%, 10-50 hours = 50-90%, 50+ hours = 90-100%
    const hoursScore = hoursTaught <= 10 
      ? (hoursTaught / 10) * 0.5 
      : hoursTaught <= 50 
        ? 0.5 + ((hoursTaught - 10) / 40) * 0.4 
        : 0.9 + Math.min((hoursTaught - 50) / 100, 0.1);
    score += hoursScore * 20;
    
    // 3. Preferred Days Match (20% weight)
    const userPreferredDays = (currentUser.availability?.preferredDays || '').toLowerCase();
    const teacherPreferredDays = (teacher.availability?.preferredDays || '').toLowerCase();
    let daysMatch = 0;
    if (userPreferredDays && teacherPreferredDays && userPreferredDays !== 'not set' && teacherPreferredDays !== 'not set') {
      if (userPreferredDays === 'flexible' || teacherPreferredDays === 'flexible') {
        daysMatch = 1.0; // Full score if either is flexible
      } else if (userPreferredDays === teacherPreferredDays) {
        daysMatch = 1.0; // Exact match = full score
      } else {
        // Partial matches
        if ((userPreferredDays.includes('both') && teacherPreferredDays.includes('weekday')) ||
            (userPreferredDays.includes('both') && teacherPreferredDays.includes('weekend')) ||
            (teacherPreferredDays.includes('both') && userPreferredDays.includes('weekday')) ||
            (teacherPreferredDays.includes('both') && userPreferredDays.includes('weekend'))) {
          daysMatch = 0.7; // Partial match
        } else {
          daysMatch = 0.3; // Low match
        }
      }
    }
    score += daysMatch * 20;
    
    // 4. Availability Overlap (15% weight) - Actual overlapping hours in UTC
    let hoursMatch = 0;
    let overlapHours = 0;
    if (userAvailabilityProfile && teacherAvailabilityProfile) {
      overlapHours = calculateOverlapHours(userAvailabilityProfile, teacherAvailabilityProfile);
      const userHours = userAvailabilityProfile.totalHours || (userAvailabilityProfile.isFlexible ? 24 : 0);
      const teacherHours = teacherAvailabilityProfile.totalHours || (teacherAvailabilityProfile.isFlexible ? 24 : 0);
      
      let normalizationBase = Math.min(userHours, teacherHours);
      if (userAvailabilityProfile.isFlexible && !teacherAvailabilityProfile.isFlexible) {
        normalizationBase = teacherHours;
      } else if (!userAvailabilityProfile.isFlexible && teacherAvailabilityProfile.isFlexible) {
        normalizationBase = userHours;
      } else if (userAvailabilityProfile.isFlexible && teacherAvailabilityProfile.isFlexible) {
        normalizationBase = 24;
      }
      
      if (normalizationBase > 0) {
        hoursMatch = Math.min(overlapHours / normalizationBase, 1);
      }
    }
    score += hoursMatch * 15;
    
    // 5. Mode of Learning Match (15% weight)
    const userPreferredFormat = (currentUser.preferredFormat || []).map(f => f.toLowerCase());
    const teacherPreferredFormat = (teacher.preferredFormat || []).map(f => f.toLowerCase());
    let formatMatch = 0;
    if (userPreferredFormat.length > 0 && teacherPreferredFormat.length > 0) {
      // Check for flexible
      if (userPreferredFormat.includes('flexible') || teacherPreferredFormat.includes('flexible')) {
        formatMatch = 1.0; // Full score if either is flexible
      } else {
        // Exact matches
        const exactMatches = userPreferredFormat.filter(f => teacherPreferredFormat.includes(f));
        if (exactMatches.length > 0) {
          formatMatch = exactMatches.length / Math.max(userPreferredFormat.length, teacherPreferredFormat.length);
        }
      }
    } else if (userPreferredFormat.length === 0 || teacherPreferredFormat.length === 0) {
      // If one doesn't have preferences, give partial score
      formatMatch = 0.5;
    }
    score += formatMatch * 15;
    
    // Get matching skills for display (not used in score calculation)
    const userSkillsToLearn = (currentUser.skillsToLearn || []).map(s => s.toLowerCase());
    const teacherSkillsToTeach = (teacher.skillsToTeach || []).map(s => s.toLowerCase());
    const matchingSkills = userSkillsToLearn.filter(skill => 
      teacherSkillsToTeach.some(ts => ts === skill)
    );
    
    return {
      score: Math.round(score * 100) / 100, // Round to 2 decimal places
      matchingSkills,
      rating,
      hoursTaught,
      daysMatch,
      hoursMatch,
      overlapHours,
      formatMatch
    };
  };

  // Filter and categorize users
  const processedUsers = users.map(teacher => {
    const teacherAvailabilityProfile = buildAvailabilityProfile(teacher);
    const matchData = calculateMatchScore(teacher, user, teacherAvailabilityProfile, userAvailabilityProfile);
    return {
      ...teacher,
      matchData,
      hasMatch: matchData.matchingSkills.length > 0
    };
  });

  // Separate into matches and all teachers
  const matchedUsers = processedUsers
    .filter(u => u.hasMatch)
    .sort((a, b) => b.matchData.score - a.matchData.score);
  
  const allOtherUsers = processedUsers
    .filter(u => !u.hasMatch)
    .sort((a, b) => b.matchData.score - a.matchData.score);

  // Apply search filter
  const filteredMatchedUsers = matchedUsers.filter(teacher => {
    if (!searchTerm.trim()) return true;
    const skillsToTeach = (teacher.skillsToTeach || []).join(' ').toLowerCase();
    const username = (teacher.username || '').toLowerCase();
    const searchTermLower = searchTerm.toLowerCase();
    return skillsToTeach.includes(searchTermLower) || username.includes(searchTermLower);
  });

  const filteredAllUsers = allOtherUsers.filter(teacher => {
    if (!searchTerm.trim()) return true;
    const skillsToTeach = (teacher.skillsToTeach || []).join(' ').toLowerCase();
    const username = (teacher.username || '').toLowerCase();
    const searchTermLower = searchTerm.toLowerCase();
    return skillsToTeach.includes(searchTermLower) || username.includes(searchTermLower);
  });

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (index) => {
    const colors = ['bg-teal-500', 'bg-blue-500', 'bg-purple-500'];
    return colors[index % colors.length];
  };

  // Render Teacher Card Component
  const renderTeacherCard = (teacher, index, isMatch) => {
    const skillsToTeach = teacher.skillsToTeach || [];
    const skillsToLearn = teacher.skillsToLearn || [];
    const availability = teacher.availability || {};
    const preferredFormat = teacher.preferredFormat || [];
    const matchData = teacher.matchData || { score: 0, matchingSkills: [] };
    
    return (
      <div 
        key={teacher._id} 
        className={`bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 border overflow-hidden flex flex-col ${
          isMatch ? 'border-emerald-200/60 ring-1 ring-emerald-100/50' : 'border-stone-200/60'
        }`}
      >
        {/* Match Badge */}
        {isMatch && (
          <div className="bg-gradient-to-r from-emerald-200 to-emerald-300 text-emerald-900 px-4 py-2.5 text-center shadow-sm">
            <div className="flex items-center justify-center gap-2">
              <Star size={14} className="fill-emerald-700" />
              <span className="text-xs font-bold">Match Score: {matchData.score.toFixed(1)}%</span>
            </div>
            {matchData.matchingSkills.length > 0 && (
              <p className="text-xs mt-1 text-emerald-800">
                Matches: {matchData.matchingSkills.join(', ')}
              </p>
            )}
          </div>
        )}

        {/* User Header with Subtle Background */}
        <div className="bg-gradient-to-br from-stone-50 via-gray-50 to-stone-50 border-b border-stone-200 p-6">
          <div className="flex items-center gap-4">
            <div className="relative cursor-pointer hover:scale-105 transition-transform" onClick={() => setSelectedUserProfile(teacher._id)}>
              <div className={`w-16 h-16 ${getAvatarColor(index)} rounded-full flex items-center justify-center text-white text-xl font-bold flex-shrink-0 shadow-md border-2 border-white`}>
                {getInitials(teacher.username)}
              </div>
              {/* Teaching indicator ring */}
              {skillsToTeach.length > 0 && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-300 rounded-full flex items-center justify-center border-2 border-white shadow-md">
                  <GraduationCap size={10} className="text-emerald-800" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 
                className="text-lg font-bold text-gray-800 truncate mb-1 cursor-pointer hover:text-teal-600 transition-colors"
                onClick={() => setSelectedUserProfile(teacher._id)}
              >
                {teacher.username}
              </h2>
              <div className="flex items-center gap-3 flex-wrap">
                {/* Rating */}
                <div className="flex items-center gap-1 bg-white/80 backdrop-blur-sm px-2 py-0.5 rounded-full border border-gray-200/50 shadow-sm">
                  <Star size={12} className="text-amber-500 fill-amber-500" />
                  <span className="text-xs font-semibold text-gray-700">
                    {teacher.averageRating ? teacher.averageRating.toFixed(1) : '0.0'}
                  </span>
                  {teacher.totalRatings > 0 && (
                    <span className="text-xs text-gray-500">
                      ({teacher.totalRatings})
                    </span>
                  )}
                </div>
                {/* Hours Taught */}
                <div className="flex items-center gap-1 bg-white/80 backdrop-blur-sm px-2 py-0.5 rounded-full border border-gray-200/50 shadow-sm">
                  <Clock size={12} className="text-emerald-500" />
                  <span className="text-xs font-semibold text-gray-700">
                    {teacher.hoursTaught || 0}h
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Section - Fixed Height */}
        <div className="p-5 flex-1 flex flex-col">
          {/* Can Teach Section - Prominent */}
          <div className="mb-4 flex-shrink-0 bg-emerald-50/50 rounded-lg p-3 border border-emerald-100/80">
            <h3 className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2.5 flex items-center gap-2">
              <div className="bg-emerald-200 p-1 rounded-md shadow-sm">
                <GraduationCap size={12} className="text-emerald-800" />
              </div>
              <span>Can Teach</span>
              {skillsToTeach.length > 0 && (
                <span className="ml-auto bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded-md text-xs font-bold shadow-sm">
                  {skillsToTeach.length}
                </span>
              )}
            </h3>
            <div className="min-h-[3rem] max-h-[6rem] overflow-y-auto">
              {skillsToTeach.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {skillsToTeach.map(skill => (
                    <span
                      key={skill}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium shadow-sm hover:shadow transition-all flex-shrink-0 ${
                        isMatch && matchData.matchingSkills.some(ms => ms.toLowerCase() === skill.toLowerCase())
                          ? 'bg-emerald-300 text-emerald-900 ring-2 ring-emerald-200 shadow-md'
                          : 'bg-emerald-200 text-emerald-800 hover:bg-emerald-300'
                      }`}
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-gray-400 text-xs italic">No skills listed</span>
              )}
            </div>
          </div>

          {/* Wants to Learn Section */}
          <div className="mb-4 flex-shrink-0 bg-blue-50/50 rounded-lg p-3 border border-blue-100/80">
            <h3 className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2.5 flex items-center gap-2">
              <div className="bg-blue-200 p-1 rounded-md shadow-sm">
                <BookOpen size={12} className="text-blue-800" />
              </div>
              <span>Wants to Learn</span>
              {skillsToLearn.length > 0 && (
                <span className="ml-auto bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded-md text-xs font-bold shadow-sm">
                  {skillsToLearn.length}
                </span>
              )}
            </h3>
            <div className="min-h-[3rem] max-h-[6rem] overflow-y-auto">
              {skillsToLearn.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {skillsToLearn.map(skill => (
                    <span
                      key={skill}
                      className="bg-blue-200 text-blue-800 px-2.5 py-1 rounded-md text-xs font-medium shadow-sm hover:bg-blue-300 hover:shadow transition-all flex-shrink-0"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-gray-400 text-xs italic">No skills listed</span>
              )}
            </div>
          </div>

          {/* Availability & Mode of Learning */}
          <div className="mb-4 space-y-2 flex-shrink-0">
            {/* Preferred Days */}
            {availability.preferredDays && availability.preferredDays !== 'Not set' && (
              <div className="flex items-center gap-2 text-xs bg-stone-50/80 px-3 py-2 rounded-lg border border-stone-200/60">
                <Calendar size={12} className="text-emerald-500" />
                <span className="font-semibold text-stone-600">Preferred Days:</span>
                <span className="font-medium text-stone-500">{availability.preferredDays}</span>
              </div>
            )}
            
            {/* Time Slots */}
            {availability.format && availability.format !== 'Not set' && (
              <div className="flex items-center gap-2 text-xs bg-stone-50/80 px-3 py-2 rounded-lg border border-stone-200/60">
                <Clock size={12} className="text-emerald-500" />
                <span className="font-semibold text-stone-600">Time Slots:</span>
                <span className="font-medium text-stone-500 truncate">{availability.format}</span>
              </div>
            )}
            
            {/* Mode of Learning */}
            {preferredFormat.length > 0 && (
              <div className="flex items-center gap-2 text-xs bg-stone-50/80 px-3 py-2 rounded-lg border border-stone-200/60 flex-wrap">
                <MessageCircle size={12} className="text-emerald-500 flex-shrink-0" />
                <span className="font-semibold text-stone-600">Mode of Learning:</span>
                <div className="flex flex-wrap gap-1.5">
                  {preferredFormat.map((format, idx) => (
                    <span key={idx} className="px-2.5 py-1 bg-white border border-stone-200 text-stone-600 rounded-md text-xs font-semibold shadow-sm">
                      {format}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons - Always at bottom */}
          <div className="flex gap-2 mt-auto pt-2">
            {isConnected(teacher._id) ? (
              <button
                onClick={() => handleStartChat(teacher._id)}
                className="flex-1 bg-indigo-200 text-indigo-800 py-2.5 rounded-lg hover:bg-indigo-300 transition-all font-medium flex items-center justify-center gap-1.5 text-sm shadow-sm hover:shadow-md"
              >
                <MessageSquare size={16} />
                <span>Chat</span>
              </button>
            ) : (
              <button
                onClick={() => handleConnect(teacher._id)}
                disabled={hasPendingRequest(teacher._id)}
                className={`flex-1 py-2.5 rounded-lg transition-all font-medium flex items-center justify-center gap-1.5 text-sm shadow-sm hover:shadow-md ${
                  hasPendingRequest(teacher._id)
                    ? 'bg-stone-100 text-stone-400 cursor-not-allowed'
                    : 'bg-indigo-200 text-indigo-800 hover:bg-indigo-300'
                }`}
              >
                <UserPlus size={16} />
                <span>{hasPendingRequest(teacher._id) ? 'Request Sent' : 'Connect'}</span>
              </button>
            )}
            <div className="flex-1">
              <button
                onClick={() => {
                  setCurrentTeacherForRequest(teacher);
                  setShowSkillModal(true);
                  setSkillSearchForRequest('');
                  setSelectedSkillForRequest('');
                }}
                className="w-full bg-emerald-200 text-emerald-800 py-2.5 rounded-lg hover:bg-emerald-300 transition-all font-medium flex items-center justify-center gap-1.5 text-sm shadow-sm hover:shadow-md"
              >
                <BookOpen size={16} />
                <span>Request Session</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-50 min-h-screen w-screen" style={{ marginLeft: 'calc(-50vw + 50%)', marginRight: 'calc(-50vw + 50%)', width: '100vw' }}>
      <div className="w-full px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Learn</h1>
        <p className="text-gray-500 mb-8">Find peers to exchange knowledge with</p>

        {/* Search Bar */}
        <div className="mb-8 relative">
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            <Search size={20} />
          </div>
          <input
            type="text"
            placeholder="Search for skills they can teach (e.g., SQL, Guitar, Cooking)..."
            className="w-full pl-12 pr-4 py-4 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-300 bg-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>


        {/* Loading State */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading users...</p>
          </div>
        ) : (
          <>
            {/* Matches Section */}
            {filteredMatchedUsers.length > 0 && (
              <div className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-1 h-8 bg-emerald-300 rounded-full"></div>
                  <h2 className="text-2xl font-bold text-gray-700">Best Matches</h2>
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-semibold">
                    {filteredMatchedUsers.length} {filteredMatchedUsers.length === 1 ? 'match' : 'matches'}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredMatchedUsers.map((teacher, index) => renderTeacherCard(teacher, index, true))}
                </div>
              </div>
            )}

            {/* All Teachers Section */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-8 bg-gradient-to-b from-gray-400 to-gray-500 rounded-full"></div>
                <h2 className="text-2xl font-bold text-gray-800">All Teachers</h2>
                <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-semibold">
                  {filteredAllUsers.length} {filteredAllUsers.length === 1 ? 'teacher' : 'teachers'}
                </span>
              </div>
              {filteredAllUsers.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl">
            <p className="text-gray-500">
                    {searchTerm ? 'No teachers found matching your search.' : 'No teachers available at the moment.'}
            </p>
          </div>
        ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredAllUsers.map((teacher, index) => renderTeacherCard(teacher, index, false))}
                </div>
              )}
            </div>
          </>
        )}
                </div>

      {/* Request Session Modal */}
      {showSkillModal && currentTeacherForRequest && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowSkillModal(false);
              setCurrentTeacherForRequest(null);
              setSelectedSkillForRequest('');
              setSkillSearchForRequest('');
            }
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative animate-in fade-in zoom-in">
            {/* Close Button */}
            <button
              onClick={() => {
                setShowSkillModal(false);
                setCurrentTeacherForRequest(null);
                setSelectedSkillForRequest('');
                setSkillSearchForRequest('');
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10"
            >
              <X size={24} />
            </button>

            {/* Modal Header */}
            <div className="bg-gradient-to-r from-teal-500 to-teal-600 p-6 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                  <BookOpen size={24} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Request Session</h2>
                  <p className="text-teal-100 text-sm">with {currentTeacherForRequest.username}</p>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Select or search for a skill to learn from {currentTeacherForRequest.username}:
                </label>
                {currentTeacherForRequest.skillsToTeach && currentTeacherForRequest.skillsToTeach.length > 0 ? (
                  <p className="text-xs text-gray-500 mb-2">
                    Available skills: {currentTeacherForRequest.skillsToTeach.join(', ')}
                  </p>
                ) : (
                  <p className="text-xs text-orange-600 mb-2">
                    This teacher hasn't added any skills yet.
                  </p>
                )}
                <div className="relative">
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                    <Search size={18} />
                  </div>
                  <input
                    type="text"
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                    placeholder="Search or type skill..."
                    value={skillSearchForRequest}
                    onChange={(e) => {
                      setSkillSearchForRequest(e.target.value);
                      setSelectedSkillForRequest(e.target.value);
                    }}
                    autoFocus
                  />
                  </div>
                </div>

              {/* Skills List */}
                <div className="mb-6">
                <div className="max-h-64 overflow-y-auto border-2 border-gray-100 rounded-xl p-2">
                  {getFilteredSkillsForRequest(skillSearchForRequest).length > 0 ? (
                    <div className="space-y-2">
                      {getFilteredSkillsForRequest(skillSearchForRequest).map((skill, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setSelectedSkillForRequest(skill);
                            setSkillSearchForRequest(skill);
                          }}
                          className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                            selectedSkillForRequest === skill
                              ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-md transform scale-[1.02]'
                              : 'bg-gray-50 hover:bg-teal-50 text-gray-700 hover:border-teal-300 border-2 border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <BookOpen size={16} className={selectedSkillForRequest === skill ? 'text-white' : 'text-teal-600'} />
                            <span className="font-medium">{skill}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <BookOpen size={48} className="mx-auto text-gray-300 mb-3" />
                      <p className="text-gray-500 font-medium">
                        {currentTeacherForRequest.skillsToTeach && currentTeacherForRequest.skillsToTeach.length === 0
                          ? 'This teacher has no skills available'
                          : 'No skills found matching your search'}
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        {currentTeacherForRequest.skillsToTeach && currentTeacherForRequest.skillsToTeach.length > 0
                          ? 'Try a different search term'
                          : 'Please contact the teacher to add skills'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Selected Skill Display */}
              {selectedSkillForRequest && (
                <div className="mb-6 p-4 bg-teal-50 border-2 border-teal-200 rounded-xl">
                  <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-2">Selected Skill:</p>
                  <div className="flex items-center gap-2">
                    <div className="px-3 py-1.5 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg font-semibold text-sm">
                      {selectedSkillForRequest}
                    </div>
                  </div>
                </div>
              )}

                {/* Action Buttons */}
              <div className="flex gap-3">
                  <button
                  onClick={() => {
                    if (currentTeacherForRequest) {
                      handleRequestSession(currentTeacherForRequest._id, selectedSkillForRequest || skillSearchForRequest);
                    }
                  }}
                  disabled={!selectedSkillForRequest && !skillSearchForRequest}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-xl hover:from-teal-600 hover:to-teal-700 transition-all font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2"
                >
                  <BookOpen size={18} />
                  <span>Send Request</span>
                  </button>
                  <button
                    onClick={() => {
                    setShowSkillModal(false);
                    setCurrentTeacherForRequest(null);
                    setSelectedSkillForRequest('');
                    setSkillSearchForRequest('');
                  }}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all font-semibold"
                >
                  Cancel
                  </button>
                </div>
              </div>
          </div>
          </div>
        )}

      {/* User Profile Modal */}
      {selectedUserProfile && (
        <UserProfileModal
          userId={selectedUserProfile}
          onClose={() => setSelectedUserProfile(null)}
        />
      )}
    </div>
  );
};

export default Browse;
