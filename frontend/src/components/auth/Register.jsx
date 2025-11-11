import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  
  // Get the 'register' function from our auth context
  const { register } = useAuth();
  
  // useNavigate is still useful if we want to redirect on error, etc.
  // but not strictly needed on success anymore.
  const navigate = useNavigate(); 

  const { username, email, password } = formData;

  const onChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(''); // Clear previous errors
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    try {
      await register(username, email, password);
      // Success!
      // We don't need to navigate. The AuthContext will detect
      // the new token, run loadUser(), find the profile is incomplete,
      // and the AppRouter will automatically show the chatbot.
    } catch (err) {
      const errorMsg = err.response?.data?.msg || 'Registration failed. Please try again.';
      setError(errorMsg);
      console.error('Registration failed', errorMsg);
    }
  };

  return (
    <div className="form-container">
      <h2>Register</h2>
      <form onSubmit={onSubmit}>
        <div className="form-group">
          <label>Username</label>
          <input
            type="text"
            name="username"
            value={username}
            onChange={onChange}
            required
          />
        </div>
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            name="email"
            value={email}
            onChange={onChange}
            required
          />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            name="password"
            value={password}
            onChange={onChange}
            required
            minLength="6"
          />
        </div>
        
        {/* Error Display */}
        {error && (
          <div style={{ color: 'var(--danger-color)', marginBottom: '1rem', textAlign: 'center' }}>
            {error}
          </div>
        )}
        
        <button type="submit" className="btn btn-primary btn-block">Register</button>
      </form>
      <p style={{marginTop: '1.5rem', textAlign: 'center'}}>
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </div>
  );
};

export default Register;