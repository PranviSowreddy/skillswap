import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, User, Clock, Video, BookOpen, Target, Settings, LogOut, Calendar, Globe } from 'lucide-react';

const SkillExchangePlatform = () => {
  const [currentView, setCurrentView] = useState('auth');
  const [authMode, setAuthMode] = useState('login');
  const [user, setUser] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  
  const [authForm, setAuthForm] = useState({
    email: '',
    password: '',
    name: ''
  });

  const predefinedSkills = [
    'JavaScript', 'Python', 'React', 'Node.js', 'Web Design', 'UI/UX Design',
    'Graphic Design', 'Photography', 'Video Editing', 'Content Writing',
    'Digital Marketing', 'SEO', 'Social Media Marketing', 'Data Analysis',
    'Machine Learning', 'Mobile Development', 'Guitar', 'Piano', 'Singing',
    'Dancing', 'Yoga', 'Fitness Training', 'Cooking', 'Baking', 'Drawing',
    'Painting', 'Public Speaking', 'Language Teaching', 'Math Tutoring',
    'Science Tutoring', 'Business Strategy', 'Financial Planning', 'Excel',
    'PowerPoint', 'Photoshop', 'Illustrator', 'Video Production', '3D Modeling',
    'Animation', 'Game Development', 'Blockchain', 'Cybersecurity', 'Cloud Computing'
  ];

  const timezones = [
    'GMT-12:00', 'GMT-11:00', 'GMT-10:00', 'GMT-09:00', 'GMT-08:00 (PST)',
    'GMT-07:00 (MST)', 'GMT-06:00 (CST)', 'GMT-05:00 (EST)', 'GMT-04:00',
    'GMT-03:00', 'GMT-02:00', 'GMT-01:00', 'GMT+00:00', 'GMT+01:00',
    'GMT+02:00', 'GMT+03:00', 'GMT+04:00', 'GMT+05:00', 'GMT+05:30 (IST)',
    'GMT+06:00', 'GMT+07:00', 'GMT+08:00', 'GMT+09:00', 'GMT+10:00',
    'GMT+11:00', 'GMT+12:00'
  ];

  const timeSlots = [
    'Early Morning (6AM-9AM)', 'Morning (9AM-12PM)', 'Afternoon (12PM-3PM)',
    'Evening (3PM-6PM)', 'Night (6PM-9PM)', 'Late Night (9PM-12AM)'
  ];

  const [profileData, setProfileData] = useState({
    skillsToTeach: [],
    skillsToLearn: [],
    availability: [],
    timezone: '',
    preferredFormat: [],
    sessionsWanted: '',
    preferredDays: []
  });

  const [messages, setMessages] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSkills, setSelectedSkills] = useState([]);
  const messagesEndRef = useRef(null);

  const chatSteps = [
    {
      question: "Great to meet you! 👋 Let's build your profile together. First, what skills can you teach others? Search and select from the list below:",
      field: 'skillsToTeach',
      type: 'skill-select'
    },
    {
      question: "Awesome! Now, what skills would you like to learn? Select from the available skills:",
      field: 'skillsToLearn',
      type: 'skill-select'
    },
    {
      question: "Perfect! How many teaching/learning sessions would you like per week?",
      field: 'sessionsWanted',
      type: 'choice',
      options: ['1-2 sessions', '3-4 sessions', '5+ sessions', 'Flexible']
    },
    {
      question: "Do you prefer weekdays, weekends, or both for your sessions?",
      field: 'preferredDays',
      type: 'choice',
      options: ['Weekdays only', 'Weekends only', 'Both weekdays and weekends', 'Flexible']
    },
    {
      question: "What's your timezone? Select from the list:",
      field: 'timezone',
      type: 'dropdown',
      options: timezones
    },
    {
      question: "What time slots work best for you? You can select multiple:",
      field: 'availability',
      type: 'multiple',
      options: [...timeSlots, 'Flexible']
    },
    {
      question: "How would you prefer to connect with others? Select all that apply:",
      field: 'preferredFormat',
      type: 'multiple',
      options: ['Video Call', 'In-Person', 'Chat-Based', 'Phone Call', 'Flexible']
    }
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (currentView === 'chatbot' && messages.length === 0) {
      setTimeout(() => addBotMessage(chatSteps[0].question), 500);
    }
  }, [currentView]);

  const addBotMessage = (text) => {
    setIsTyping(true);
    setTimeout(() => {
      setMessages(prev => [...prev, { sender: 'bot', text }]);
      setIsTyping(false);
    }, 800);
  };

  const addUserMessage = (text) => {
    setMessages(prev => [...prev, { sender: 'user', text }]);
  };

  const handleAuth = () => {
    if (authMode === 'register') {
      if (authForm.name && authForm.email && authForm.password) {
        setUser({ name: authForm.name, email: authForm.email });
        setCurrentView('chatbot');
      }
    } else {
      if (authForm.email && authForm.password) {
        setUser({ name: authForm.email.split('@')[0], email: authForm.email });
        setCurrentView('chatbot');
      }
    }
  };

  const handleSkillSelect = (skill) => {
    if (selectedSkills.includes(skill)) {
      setSelectedSkills(selectedSkills.filter(s => s !== skill));
    } else {
      setSelectedSkills([...selectedSkills, skill]);
    }
  };

  const confirmSkillSelection = () => {
    if (selectedSkills.length === 0) return;
    
    const step = chatSteps[currentStep];
    addUserMessage(selectedSkills.join(', '));
    setProfileData(prev => ({ ...prev, [step.field]: selectedSkills }));
    setSelectedSkills([]);
    setSearchQuery('');
    moveToNextStep();
  };

  const handleOptionClick = (option) => {
    const step = chatSteps[currentStep];

    if (step.type === 'choice' || step.type === 'dropdown') {
      addUserMessage(option);
      setProfileData(prev => ({ ...prev, [step.field]: option }));
      moveToNextStep();
    } else if (step.type === 'multiple') {
      const existing = profileData[step.field] || [];
      let newData;
      
      if (existing.includes(option)) {
        newData = existing.filter(item => item !== option);
      } else {
        newData = [...existing, option];
      }
      
      setProfileData(prev => ({ ...prev, [step.field]: newData }));
    }
  };

  const confirmMultipleSelection = () => {
    const step = chatSteps[currentStep];
    const selections = profileData[step.field];
    
    if (selections && selections.length > 0) {
      addUserMessage(selections.join(', '));
      moveToNextStep();
    }
  };

  const moveToNextStep = () => {
    if (currentStep < chatSteps.length - 1) {
      setTimeout(() => {
        setCurrentStep(currentStep + 1);
        addBotMessage(chatSteps[currentStep + 1].question);
      }, 1000);
    } else {
      setTimeout(() => {
        addBotMessage("🎉 Fantastic! Your profile is complete. Redirecting you to your dashboard...");
        setTimeout(() => {
          setCurrentView('dashboard');
        }, 2000);
      }, 1000);
    }
  };

  const filteredSkills = predefinedSkills.filter(skill =>
    skill.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLogout = () => {
    setUser(null);
    setCurrentView('auth');
    setMessages([]);
    setCurrentStep(0);
    setProfileData({
      skillsToTeach: [],
      skillsToLearn: [],
      availability: [],
      timezone: '',
      preferredFormat: [],
      sessionsWanted: '',
      preferredDays: []
    });
  };

  const handleEditProfile = () => {
    setIsEditMode(true);
    setCurrentView('chatbot');
    setMessages([]);
    setCurrentStep(0);
    setTimeout(() => addBotMessage(chatSteps[0].question), 500);
  };

  if (currentView === 'auth') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full mb-4">
              <MessageCircle className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">SkillSwap</h1>
            <p className="text-gray-600">Exchange skills, grow together</p>
          </div>

          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setAuthMode('login')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                authMode === 'login'
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setAuthMode('register')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                authMode === 'register'
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Register
            </button>
          </div>

          <div className="space-y-4">
            {authMode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={authForm.name}
                  onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={authForm.email}
                onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={authForm.password}
                onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            <button
              onClick={handleAuth}
              className="w-full bg-gradient-to-r from-purple-500 to-blue-500 text-white py-3 rounded-lg font-medium hover:from-purple-600 hover:to-blue-600 transition"
            >
              {authMode === 'login' ? 'Login' : 'Create Account'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === 'dashboard') {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        {/* Sidebar */}
        <div className="w-64 bg-white shadow-lg">
          <div className="p-6 border-b">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">{user?.name}</h3>
                <p className="text-xs text-gray-600">{user?.email}</p>
              </div>
            </div>
          </div>
          
          <nav className="p-4">
            <button className="w-full flex items-center gap-3 px-4 py-3 bg-purple-50 text-purple-600 rounded-lg mb-2">
              <User className="w-5 h-5" />
              <span className="font-medium">Profile</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-lg mb-2">
              <Calendar className="w-5 h-5" />
              <span className="font-medium">My Sessions</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-lg mb-2">
              <MessageCircle className="w-5 h-5" />
              <span className="font-medium">Messages</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-lg mb-2">
              <Settings className="w-5 h-5" />
              <span className="font-medium">Settings</span>
            </button>
          </nav>

          <div className="absolute bottom-0 w-64 p-4 border-t">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          <div className="max-w-5xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">My Profile</h1>
            <p className="text-gray-600 mb-8">Manage your skills and preferences</p>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-purple-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">Skills I Can Teach</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {profileData.skillsToTeach.length > 0 ? (
                    profileData.skillsToTeach.map((skill, idx) => (
                      <span key={idx} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                        {skill}
                      </span>
                    ))
                  ) : (
                    <p className="text-gray-400 italic">No skills added yet</p>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Target className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">Skills I Want to Learn</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {profileData.skillsToLearn.length > 0 ? (
                    profileData.skillsToLearn.map((skill, idx) => (
                      <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                        {skill}
                      </span>
                    ))
                  ) : (
                    <p className="text-gray-400 italic">No skills added yet</p>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">Availability</h3>
                </div>
                <div className="space-y-2 text-gray-700">
                  <p><span className="font-medium">Sessions per week:</span> {profileData.sessionsWanted || 'Not set'}</p>
                  <p><span className="font-medium">Preferred days:</span> {profileData.preferredDays || 'Not set'}</p>
                  <p><span className="font-medium">Time slots:</span></p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {profileData.availability.length > 0 ? (
                      profileData.availability.map((slot, idx) => (
                        <span key={idx} className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                          {slot}
                        </span>
                      ))
                    ) : (
                      <p className="text-gray-400 italic text-sm">No time slots selected</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
                    <Video className="w-5 h-5 text-pink-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">Preferences</h3>
                </div>
                <div className="space-y-2 text-gray-700">
                  <p><span className="font-medium">Timezone:</span> {profileData.timezone || 'Not set'}</p>
                  <p><span className="font-medium">Preferred formats:</span></p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {profileData.preferredFormat.length > 0 ? (
                      profileData.preferredFormat.map((format, idx) => (
                        <span key={idx} className="px-3 py-1 bg-pink-100 text-pink-700 rounded-full text-sm">
                          {format}
                        </span>
                      ))
                    ) : (
                      <p className="text-gray-400 italic text-sm">No formats selected</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-center">
              <button
                onClick={handleEditProfile}
                className="px-8 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-blue-600 transition shadow-lg"
              >
                Edit Profile
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Chatbot View
  const currentStepData = chatSteps[currentStep];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-t-2xl shadow-lg p-6 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Welcome, {user?.name}!</h2>
                <p className="text-sm text-gray-600">Let's set up your profile</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">Progress</div>
              <div className="text-lg font-bold text-purple-600">
                {currentStep + 1}/{chatSteps.length}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white shadow-lg p-6 overflow-y-auto" style={{ maxHeight: '600px' }}>
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

            {isTyping && (
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

            {!isTyping && currentStep < chatSteps.length && (
              <div className="mt-4 pb-4">
                {/* Skill Selection */}
                {currentStepData.type === 'skill-select' && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search skills..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <div className="max-h-48 overflow-y-auto mb-3 space-y-2">
                      {filteredSkills.map((skill, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSkillSelect(skill)}
                          className={`w-full text-left px-4 py-2 rounded-lg transition ${
                            selectedSkills.includes(skill)
                              ? 'bg-purple-500 text-white'
                              : 'bg-white text-gray-700 hover:bg-purple-50'
                          }`}
                        >
                          {skill}
                        </button>
                      ))}
                    </div>
                    {selectedSkills.length > 0 && (
                      <div className="mb-3">
                        <p className="text-sm text-gray-600 mb-2">Selected skills:</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedSkills.map((skill, idx) => (
                            <span key={idx} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <button
                      onClick={confirmSkillSelection}
                      disabled={selectedSkills.length === 0}
                      className="w-full bg-gradient-to-r from-purple-500 to-blue-500 text-white py-2 rounded-lg font-medium hover:from-purple-600 hover:to-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Confirm Selection
                    </button>
                  </div>
                )}

                {/* Choice Buttons */}
                {currentStepData.type === 'choice' && (
                  <div className="flex flex-wrap gap-3">
                    {currentStepData.options.map((option, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleOptionClick(option)}
                        className="px-6 py-3 bg-white border-2 border-purple-500 text-purple-600 rounded-xl hover:bg-purple-500 hover:text-white transition font-medium"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}

                {/* Dropdown */}
                {currentStepData.type === 'dropdown' && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <select
                      onChange={(e) => handleOptionClick(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      defaultValue=""
                    >
                      <option value="" disabled>Select your timezone</option>
                      {currentStepData.options.map((option, idx) => (
                        <option key={idx} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Multiple Selection */}
                {currentStepData.type === 'multiple' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-3">
                      {currentStepData.options.map((option, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleOptionClick(option)}
                          className={`px-6 py-3 rounded-xl font-medium transition ${
                            profileData[currentStepData.field]?.includes(option)
                              ? 'bg-purple-500 text-white'
                              : 'bg-white border-2 border-purple-500 text-purple-600 hover:bg-purple-500 hover:text-white'
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                    {profileData[currentStepData.field]?.length > 0 && (
                      <button
                        onClick={confirmMultipleSelection}
                        className="w-full bg-gradient-to-r from-purple-500 to-blue-500 text-white py-4 rounded-lg font-medium hover:from-purple-600 hover:to-blue-600 transition shadow-lg text-lg"
                      >
                        Continue →
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="bg-white rounded-b-2xl shadow-lg p-6">
          <div className="text-center text-gray-500 text-sm">
            Select your preferences above to continue
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkillExchangePlatform;

