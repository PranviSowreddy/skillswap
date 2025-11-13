import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { Edit, Plus, X } from 'lucide-react';

const ProfileStat = ({ value, label }) => (
  <div className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200 hover:shadow-md transition-shadow">
    <p className="text-4xl font-bold text-gray-800 mb-2">{value}</p>
    <p className="text-sm font-medium text-gray-600 text-center">{label}</p>
  </div>
);

const SkillPill = ({ skill, onRemove, color }) => (
  <span className={`${color} text-white px-4 py-2 rounded-full font-medium flex items-center gap-2`}>
    {skill}
    {onRemove && (
      <button 
        onClick={onRemove} 
        className="text-white hover:text-gray-200 transition-colors"
        title="Remove skill"
      >
        <X size={16} />
      </button>
    )}
  </span>
);

const Profile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);

  // Skill Management States
  const [newSkillToTeach, setNewSkillToTeach] = useState('');
  const [newSkillToLearn, setNewSkillToLearn] = useState('');
  const [showAddSkillTeach, setShowAddSkillTeach] = useState(false);
  const [showAddSkillLearn, setShowAddSkillLearn] = useState(false);

  // Availability Management States
  const [editingAvailability, setEditingAvailability] = useState(false);
  const [preferredDays, setPreferredDays] = useState('Not set');
  const [timeZone, setTimeZone] = useState('Not set');
  const [format, setFormat] = useState('Not set');

  const fetchProfileAndReviews = async () => {
    if (!user) return;
    setLoading(true);
    setLoadingReviews(true);
    try {
      const res = await api.get('/profile');
      setProfile(res.data);
      setPreferredDays(res.data.availability?.preferredDays || 'Not set');
      setTimeZone(res.data.availability?.timeZone || 'Not set');
      setFormat(res.data.availability?.format || 'Not set');
      setLoading(false);

      const reviewRes = await api.get(`/reviews/user/${user._id}`);
      setReviews(reviewRes.data);
      setLoadingReviews(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
      setLoadingReviews(false);
    }
  };

  useEffect(() => {
    fetchProfileAndReviews();
  }, [user]);

  const handleAddSkill = async (skillType, newSkill, setNewSkill, setShowAdd) => {
    if (!newSkill.trim()) return;
    try {
      const updatedSkills = [...(profile[skillType] || []), newSkill.trim()];
      const updatedProfile = { ...profile, [skillType]: updatedSkills };
      await api.put('/profile', updatedProfile);
      setProfile(updatedProfile);
      setNewSkill('');
      setShowAdd(false);
    } catch (err) {
      console.error('Error adding skill:', err);
      alert('Failed to add skill');
    }
  };

  const handleRemoveSkill = async (skillType, skillToRemove) => {
    try {
      const updatedSkills = (profile[skillType] || []).filter(skill => skill !== skillToRemove);
      const updatedProfile = { ...profile, [skillType]: updatedSkills };
      await api.put('/profile', updatedProfile);
      setProfile(updatedProfile);
    } catch (err) {
      console.error('Error removing skill:', err);
      alert('Failed to remove skill');
    }
  };

  const handleUpdateAvailability = async () => {
    try {
      const updatedAvailability = { preferredDays, timeZone, format };
      const updatedProfile = { ...profile, availability: updatedAvailability };
      await api.put('/profile', updatedProfile);
      setProfile(updatedProfile);
      setEditingAvailability(false);
    } catch (err) {
      console.error('Error updating availability:', err);
      alert('Failed to update availability');
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  if (loading) {
    return <div className="text-center p-10">Loading profile...</div>;
  }

  if (!profile) {
    return <div className="text-center p-10">Could not load profile.</div>;
  }

  const {
    skillsToTeach = [],
    skillsToLearn = [],
    averageRating = 0,
    hoursExchanged = 0,
    peersConnected = 0,
    memberSince,
  } = profile;

  const displayName = user.username || 'User';
  const memberSinceDate = memberSince 
    ? new Date(memberSince).toLocaleDateString("en-US", { year: 'numeric', month: 'short' })
    : 'Recently';

  return (
    <div className="bg-gray-50 min-h-screen w-screen" style={{ marginLeft: 'calc(-50vw + 50%)', marginRight: 'calc(-50vw + 50%)', width: '100vw' }}>
      <div className="w-full px-8 py-8">
        {/* User Profile Card */}
        <div className="bg-white rounded-xl shadow-sm p-10 mb-8">
          <div className="flex flex-col items-center text-center">
            {/* Avatar with gradient */}
            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white text-4xl font-bold mb-5 shadow-lg">
              {getInitials(displayName)}
            </div>

            {/* Name and Member Since */}
            <h1 className="text-4xl font-bold text-gray-800 mb-2">{displayName}</h1>
            <p className="text-base text-gray-500 mb-8">Member since {memberSinceDate}</p>

            {/* Stats Section */}
            <div className="grid grid-cols-3 gap-6 w-full max-w-3xl">
              <ProfileStat value={hoursExchanged} label="Hours Exchanged" />
              <ProfileStat value={peersConnected} label="Peers Connected" />
              <ProfileStat value={averageRating.toFixed(1)} label="Rating" />
            </div>
          </div>
        </div>

        {/* Skills I Can Teach */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-2xl font-bold text-gray-800">Skills I Can Teach</h2>
            <button
              onClick={() => {
                setShowAddSkillTeach(!showAddSkillTeach);
                setShowAddSkillLearn(false);
              }}
              className="flex items-center gap-2 text-sm font-medium text-teal-600 hover:text-teal-700 bg-teal-50 hover:bg-teal-100 px-4 py-2 rounded-lg transition-colors"
            >
              <Plus size={18} />
              Add Skill
            </button>
          </div>
          <div className="flex flex-wrap gap-3 mb-4">
            {skillsToTeach.length > 0 ? (
              skillsToTeach.map(skill => (
                <SkillPill
                  key={skill}
                  skill={skill}
                  onRemove={() => handleRemoveSkill('skillsToTeach', skill)}
                  color="bg-teal-500"
                />
              ))
            ) : (
              <p className="text-gray-500 text-sm">No skills added yet.</p>
            )}
          </div>
          {showAddSkillTeach && (
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="Enter skill name..."
                value={newSkillToTeach}
                onChange={(e) => setNewSkillToTeach(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddSkill('skillsToTeach', newSkillToTeach, setNewSkillToTeach, setShowAddSkillTeach);
                  }
                }}
                autoFocus
              />
              <button
                onClick={() => handleAddSkill('skillsToTeach', newSkillToTeach, setNewSkillToTeach, setShowAddSkillTeach)}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setShowAddSkillTeach(false);
                  setNewSkillToTeach('');
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Skills I Want to Learn */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-2xl font-bold text-gray-800">Skills I Want to Learn</h2>
            <button
              onClick={() => {
                setShowAddSkillLearn(!showAddSkillLearn);
                setShowAddSkillTeach(false);
              }}
              className="flex items-center gap-2 text-sm font-medium text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-4 py-2 rounded-lg transition-colors"
            >
              <Plus size={18} />
              Add Skill
            </button>
          </div>
          <div className="flex flex-wrap gap-3 mb-4">
            {skillsToLearn.length > 0 ? (
              skillsToLearn.map(skill => (
                <SkillPill
                  key={skill}
                  skill={skill}
                  onRemove={() => handleRemoveSkill('skillsToLearn', skill)}
                  color="bg-orange-500"
                />
              ))
            ) : (
              <p className="text-gray-500 text-sm">No skills added yet.</p>
            )}
          </div>
          {showAddSkillLearn && (
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Enter skill name..."
                value={newSkillToLearn}
                onChange={(e) => setNewSkillToLearn(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddSkill('skillsToLearn', newSkillToLearn, setNewSkillToLearn, setShowAddSkillLearn);
                  }
                }}
                autoFocus
              />
              <button
                onClick={() => handleAddSkill('skillsToLearn', newSkillToLearn, setNewSkillToLearn, setShowAddSkillLearn)}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setShowAddSkillLearn(false);
                  setNewSkillToLearn('');
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Availability */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-5">Availability</h2>
          {!editingAvailability ? (
            <>
              <div className="space-y-3 text-sm mb-6">
                <div>
                  <p className="text-gray-800">
                    <span className="font-medium">Preferred Days:</span> {preferredDays}
                  </p>
                </div>
                <div>
                  <p className="text-gray-800">
                    <span className="font-medium">Time Zone:</span> {timeZone}
                  </p>
                </div>
                <div>
                  <p className="text-gray-800">
                    <span className="font-medium">Format:</span> {format}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingAvailability(true)}
                className="w-full bg-gradient-to-r from-teal-500 to-teal-600 text-white py-3 rounded-lg hover:from-teal-600 hover:to-teal-700 transition-all font-medium shadow-sm hover:shadow-md"
              >
                Update Availability
              </button>
            </>
          ) : (
            <>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Days:</label>
                  <input
                    type="text"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                    value={preferredDays}
                    onChange={(e) => setPreferredDays(e.target.value)}
                    placeholder="e.g., Weekends, Weekday Evenings"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Time Zone:</label>
                  <select
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                    value={timeZone}
                    onChange={(e) => setTimeZone(e.target.value)}
                  >
                    <option value="Not set">Select Time Zone</option>
                    <option value="IST (UTC+5:30)">IST (UTC+5:30)</option>
                    <option value="GMT (UTC+0)">GMT (UTC+0)</option>
                    <option value="EST (UTC-5)">EST (UTC-5)</option>
                    <option value="PST (UTC-8)">PST (UTC-8)</option>
                    <option value="UTC+1">UTC+1</option>
                    <option value="UTC+2">UTC+2</option>
                    <option value="UTC+3">UTC+3</option>
                    <option value="UTC+4">UTC+4</option>
                    <option value="UTC+5">UTC+5</option>
                    <option value="UTC+6">UTC+6</option>
                    <option value="UTC+7">UTC+7</option>
                    <option value="UTC+8">UTC+8</option>
                    <option value="UTC+9">UTC+9</option>
                    <option value="UTC+10">UTC+10</option>
                    <option value="UTC+11">UTC+11</option>
                    <option value="UTC+12">UTC+12</option>
                    <option value="UTC-1">UTC-1</option>
                    <option value="UTC-2">UTC-2</option>
                    <option value="UTC-3">UTC-3</option>
                    <option value="UTC-4">UTC-4</option>
                    <option value="UTC-6">UTC-6</option>
                    <option value="UTC-7">UTC-7</option>
                    <option value="UTC-9">UTC-9</option>
                    <option value="UTC-10">UTC-10</option>
                    <option value="UTC-11">UTC-11</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Format:</label>
                  <input
                    type="text"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    placeholder="e.g., Video Call, In-Person"
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={handleUpdateAvailability}
                  className="flex-1 bg-gradient-to-r from-teal-500 to-teal-600 text-white py-3 rounded-lg hover:from-teal-600 hover:to-teal-700 transition-all font-medium shadow-sm hover:shadow-md"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditingAvailability(false);
                    setPreferredDays(profile.availability?.preferredDays || 'Not set');
                    setTimeZone(profile.availability?.timeZone || 'Not set');
                    setFormat(profile.availability?.format || 'Not set');
                  }}
                  className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg hover:bg-gray-300 transition-all font-medium"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>

        {/* Reviews Section */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Reviews About Me</h2>
          {loadingReviews ? (
            <p className="text-gray-500">Loading reviews...</p>
          ) : reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.map(review => (
                <div key={review._id} className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow bg-gray-50">
                  <div className="flex items-center mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-gray-800">{review.rating}.0</span>
                      <div className="flex text-yellow-400">
                        {[...Array(5)].map((_, i) => (
                          <span key={i}>{i < review.rating ? '★' : '☆'}</span>
                        ))}
                      </div>
                    </div>
                    <p className="text-gray-600 ml-4 font-medium">by {review.reviewer?.username || review.reviewerId?.username || 'Anonymous'}</p>
                    <p className="text-sm text-gray-400 ml-auto">on {new Date(review.date).toLocaleDateString()}</p>
                  </div>
                  <p className="text-gray-700 italic">"{review.comment}"</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No reviews yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
