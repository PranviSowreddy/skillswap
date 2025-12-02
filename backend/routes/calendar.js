const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const calendarService = require('../services/calendarService');
const axios = require('axios');

// @route   GET api/calendar/google/auth
// @desc    Get Google Calendar OAuth URL
router.get('/google/auth', auth, (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(500).json({ 
      msg: 'Google Calendar integration is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.' 
    });
  }
  
  try {
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/calendar/google/callback';
    console.log('Using redirect URI:', redirectUri);
    console.log('Make sure this EXACT URI is added to Google Cloud Console authorized redirect URIs');
    
    const authUrl = calendarService.google.getAuthUrl() + `&state=${req.user.id}`;
    res.json({ authUrl });
  } catch (err) {
    console.error('Error generating Google OAuth URL:', err);
    res.status(500).json({ msg: 'Failed to generate OAuth URL' });
  }
});

// @route   GET api/calendar/google/callback
// @desc    Handle Google Calendar OAuth callback
router.get('/google/callback', async (req, res) => {
  const { code, state, error } = req.query;
  
  if (error) {
    console.error('Google OAuth error:', error);
    const errorMsg = error === 'access_denied' 
      ? 'Access was denied. Please try again and grant the necessary permissions.'
      : `OAuth error: ${error}`;
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/profile?calendar=google&status=error&msg=${encodeURIComponent(errorMsg)}`);
  }
  
  if (!code || !state) {
    return res.status(400).json({ msg: 'Authorization code or state not provided' });
  }

  try {
    const tokens = await calendarService.google.getTokensFromCode(code);
    
    await User.findByIdAndUpdate(state, {
      calendarProvider: 'google',
      googleCalendarToken: tokens.access_token,
      googleCalendarRefreshToken: tokens.refresh_token,
    });

    // Redirect to frontend with success message
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/profile?calendar=google&status=connected`);
  } catch (err) {
    console.error('Google Calendar OAuth error:', err);
    const errorMsg = err.message || 'Failed to connect Google Calendar';
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/profile?calendar=google&status=error&msg=${encodeURIComponent(errorMsg)}`);
  }
});

// @route   GET api/calendar/outlook/auth
// @desc    Get Outlook Calendar OAuth URL
router.get('/outlook/auth', auth, (req, res) => {
  // Trim whitespace from environment variables
  const clientId = process.env.OUTLOOK_CLIENT_ID?.trim();
  const clientSecret = process.env.OUTLOOK_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    return res.status(500).json({ 
      msg: 'Outlook Calendar integration is not configured. Please set OUTLOOK_CLIENT_ID and OUTLOOK_CLIENT_SECRET environment variables in the backend/.env file and restart your server.' 
    });
  }
  
  try {
    const scopes = ['https://graph.microsoft.com/Calendars.ReadWrite', 'offline_access'];
    const redirectUri = process.env.OUTLOOK_REDIRECT_URI?.trim() || 'http://localhost:5000/api/calendar/outlook/callback';
    
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
      `client_id=${clientId}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_mode=query&` +
      `scope=${encodeURIComponent(scopes.join(' '))}&` +
      `state=${req.user.id}`;
    
    res.json({ authUrl });
  } catch (err) {
    console.error('Error generating Outlook OAuth URL:', err);
    res.status(500).json({ msg: 'Failed to generate OAuth URL' });
  }
});

// @route   GET api/calendar/outlook/callback
// @desc    Handle Outlook Calendar OAuth callback
router.get('/outlook/callback', async (req, res) => {
  const { code, state, error } = req.query;
  
  if (error) {
    console.error('Outlook OAuth error:', error);
    const errorMsg = error === 'access_denied' 
      ? 'Access was denied. Please try again and grant the necessary permissions.'
      : `OAuth error: ${error}`;
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/profile?calendar=outlook&status=error&msg=${encodeURIComponent(errorMsg)}`);
  }
  
  if (!code || !state) {
    return res.status(400).json({ msg: 'Authorization code or state not provided' });
  }

  try {
    const tokenResponse = await axios.post(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      {
        client_id: process.env.OUTLOOK_CLIENT_ID?.trim(),
        client_secret: process.env.OUTLOOK_CLIENT_SECRET?.trim(),
        code: code,
        redirect_uri: process.env.OUTLOOK_REDIRECT_URI?.trim() || 'http://localhost:5000/api/calendar/outlook/callback',
        grant_type: 'authorization_code',
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    await User.findByIdAndUpdate(state, {
      calendarProvider: 'outlook',
      outlookCalendarToken: tokenResponse.data.access_token,
      outlookCalendarRefreshToken: tokenResponse.data.refresh_token,
    });

    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/profile?calendar=outlook&status=connected`);
  } catch (err) {
    console.error('Outlook Calendar OAuth error:', err);
    const errorMsg = err.response?.data?.error_description || err.message || 'Failed to connect Outlook Calendar';
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/profile?calendar=outlook&status=error&msg=${encodeURIComponent(errorMsg)}`);
  }
});

// @route   GET api/calendar/status
// @desc    Get user's calendar connection status
router.get('/status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('calendarProvider outlookCalendarToken googleCalendarToken');
    const connected = !!(user.calendarProvider && (
      (user.calendarProvider === 'outlook' && user.outlookCalendarToken) ||
      (user.calendarProvider === 'google' && user.googleCalendarToken)
    ));
    res.json({
      provider: user.calendarProvider,
      connected: connected,
    });
  } catch (err) {
    console.error('Error fetching calendar status:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE api/calendar/disconnect
// @desc    Disconnect calendar
router.delete('/disconnect', auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, {
      calendarProvider: null,
      googleCalendarToken: null,
      googleCalendarRefreshToken: null,
      outlookCalendarToken: null,
      outlookCalendarRefreshToken: null,
    });
    res.json({ msg: 'Calendar disconnected successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;

