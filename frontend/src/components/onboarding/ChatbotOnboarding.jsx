import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, User } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

// This is the chatbot component, extracted from your code.
// I've removed the 'auth' and 'dashboard' views from it.
const ChatbotOnboarding = () => {
  const { user, loadUser } = useAuth(); // Get user and the function to update context

  // --- All the state from your chatbot ---
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

  // --- All the data arrays from your chatbot ---
  const predefinedSkills = [
    'JavaScript', 'Python', 'React', 'Node.js', 'Web Design', 'UI/UX Design',
    'Graphic Design', 'Photography', 'Video Editing', 'Content Writing',
    'Digital Marketing', 'SEO', 'Social Media Marketing', 'Data Analysis',
    'Machine Learning', 'Mobile Development', 'Guitar', 'Piano', 'Singing',
    'Dancing', 'Yoga', 'Fitness Training', 'Cooking', 'Baking', 'Drawing',
    'Painting', 'Public Speaking', 'Language Teaching', 'Math Tutoring'
    // ... (rest of your skills)
  ];
  const timezones = [
    'GMT-12:00', 'GMT-11:00', 'GMT-10:00', 'GMT-09:00', 'GMT-08:00 (PST)',
    'GMT-07:00 (MST)', 'GMT-06:00 (CST)', 'GMT-05:00 (EST)', 'GMT-04:00',
    'GMT+05:30 (IST)', 'GMT+08:00', 'GMT+10:00'
    // ... (rest of your timezones)
  ];
  const timeSlots = [
    'Early Morning (6AM-9AM)', 'Morning (9AM-12PM)', 'Afternoon (12PM-3PM)',
    'Evening (3PM-6PM)', 'Night (6PM-9PM)', 'Late Night (9PM-12AM)'
  ];

  // --- All the functions from your chatbot ---
  const chatSteps = [
    {
      question: `Great to meet you, ${user.username}! 👋 Let's build your profile. First, what skills can you teach others?`,
      field: 'skillsToTeach',
      type: 'skill-select'
    },
    {
      question: "Awesome! Now, what skills would you like to learn?",
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

  // Start the chat
  useEffect(() => {
    if (messages.length === 0) {
      setTimeout(() => addBotMessage(chatSteps[0].question), 500);
    }
  }, []);

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

  // --- MODIFIED moveToNextStep ---
  // This now calls our API on the final step
  const moveToNextStep = async () => {
    if (currentStep < chatSteps.length - 1) {
      // Not the final step, just move to the next question
      setTimeout(() => {
        setCurrentStep(currentStep + 1);
        addBotMessage(chatSteps[currentStep + 1].question);
      }, 1000);
    } else {
      // This is the final step
      setTimeout(async () => {
        addBotMessage("🎉 Fantastic! Your profile is complete. Saving...");
        try {
          // --- API CALL ---
          // Send the data to our backend
          await api.put('/profile', profileData);

          addBotMessage("Profile saved! Taking you to your dashboard...");
          
          // --- UPDATE CONTEXT ---
          // Tell AuthContext to reload the user data.
          // This will set 'profileComplete' to true.
          await loadUser(); 

          // The AppRouter will automatically detect this change
          // and redirect to the dashboard.
          
        } catch (err) {
          console.error("Failed to save profile:", err);
          addBotMessage("Oh no, something went wrong saving your profile. Please try again.");
        }
      }, 1000);
    }
  };

  const filteredSkills = predefinedSkills.filter(skill =>
    skill.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // --- This is the Chatbot UI, using Tailwind CSS ---
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
                <h2 className="text-xl font-bold text-gray-800">Welcome, {user?.username}!</h2>
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

export default ChatbotOnboarding;