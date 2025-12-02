const { google } = require('googleapis');
const axios = require('axios');
const User = require('../models/User');

/**
 * Google Calendar Service
 */
class GoogleCalendarService {
  constructor() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/calendar/google/callback';
    
    if (!clientId || !clientSecret) {
      console.warn('Google Calendar credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.');
    }
    
    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );
  }

  getAuthUrl() {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      throw new Error('Google Calendar credentials not configured');
    }
    
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/calendar/google/callback';
    
    // Ensure the OAuth2Client is using the correct redirect URI
    if (this.oauth2Client.redirectUri !== redirectUri) {
      this.oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        redirectUri
      );
    }
    
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ];
    
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
    });
    
    console.log('Generated OAuth URL with redirect URI:', redirectUri);
    return authUrl;
  }

  async getTokensFromCode(code) {
    const { tokens } = await this.oauth2Client.getToken(code);
    return tokens;
  }

  async getClient(userId) {
    const user = await User.findById(userId);
    if (!user || !user.googleCalendarToken) {
      throw new Error('Google Calendar not connected');
    }

    this.oauth2Client.setCredentials({
      access_token: user.googleCalendarToken,
      refresh_token: user.googleCalendarRefreshToken,
    });

    // Refresh token if needed
    try {
      await this.oauth2Client.getAccessToken();
    } catch (err) {
      // Token might be expired, try to refresh
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      await User.findByIdAndUpdate(userId, {
        googleCalendarToken: credentials.access_token,
        googleCalendarRefreshToken: credentials.refresh_token || user.googleCalendarRefreshToken,
      });
      this.oauth2Client.setCredentials(credentials);
    }

    return google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  async createEvent(userId, session) {
    const calendar = await this.getClient(userId);
    const learner = await User.findById(session.learner).select('username email');
    const teacher = await User.findById(session.teacher).select('username email');

    const startTime = new Date(session.scheduledTime);
    const endTime = new Date(startTime.getTime() + session.durationHours * 60 * 60 * 1000);

    const event = {
      summary: `SkillSwap: ${session.skill}`,
      description: `Teaching session: ${session.skill}\nTeacher: ${teacher.username}\nLearner: ${learner.username}${session.meetingLink ? `\nMeeting Link: ${session.meetingLink}` : ''}`,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      attendees: [
        { email: learner.email },
        { email: teacher.email },
      ],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 24 hours before
          { method: 'popup', minutes: 15 }, // 15 minutes before
        ],
      },
      conferenceData: session.meetingLink ? {
        createRequest: {
          requestId: session._id.toString(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      } : undefined,
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      sendUpdates: 'all',
    });

    return {
      eventId: response.data.id,
      htmlLink: response.data.htmlLink,
      hangoutLink: response.data.hangoutLink,
    };
  }

  async updateEvent(userId, session) {
    const calendar = await this.getClient(userId);
    if (!session.calendarEventId) {
      return this.createEvent(userId, session);
    }

    const learner = await User.findById(session.learner).select('username email');
    const teacher = await User.findById(session.teacher).select('username email');

    const startTime = new Date(session.scheduledTime);
    const endTime = new Date(startTime.getTime() + session.durationHours * 60 * 60 * 1000);

    const event = {
      summary: `SkillSwap: ${session.skill}`,
      description: `Teaching session: ${session.skill}\nTeacher: ${teacher.username}\nLearner: ${learner.username}${session.meetingLink ? `\nMeeting Link: ${session.meetingLink}` : ''}`,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      attendees: [
        { email: learner.email },
        { email: teacher.email },
      ],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 15 },
        ],
      },
    };

    try {
      const response = await calendar.events.update({
        calendarId: 'primary',
        eventId: session.calendarEventId,
        resource: event,
        sendUpdates: 'all',
      });

      return {
        eventId: response.data.id,
        htmlLink: response.data.htmlLink,
      };
    } catch (err) {
      if (err.code === 404) {
        // Event not found, create a new one
        return this.createEvent(userId, session);
      }
      throw err;
    }
  }

  async deleteEvent(userId, calendarEventId) {
    if (!calendarEventId) return;
    
    const calendar = await this.getClient(userId);
    try {
      await calendar.events.delete({
        calendarId: 'primary',
        eventId: calendarEventId,
        sendUpdates: 'all',
      });
    } catch (err) {
      if (err.code !== 404) {
        throw err;
      }
      // Event already deleted, ignore
    }
  }
}

/**
 * Outlook Calendar Service
 */
class OutlookCalendarService {
  async getAccessToken(userId) {
    const user = await User.findById(userId);
    if (!user || !user.outlookCalendarToken) {
      throw new Error('Outlook Calendar not connected');
    }

    // Check if token is expired and refresh if needed
    // For simplicity, we'll assume the token is valid
    // In production, you'd check expiration and refresh
    return user.outlookCalendarToken;
  }

  async refreshToken(userId) {
    const user = await User.findById(userId);
    if (!user || !user.outlookCalendarRefreshToken) {
      throw new Error('Outlook refresh token not available');
    }

    try {
      const response = await axios.post('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        client_id: process.env.OUTLOOK_CLIENT_ID,
        client_secret: process.env.OUTLOOK_CLIENT_SECRET,
        refresh_token: user.outlookCalendarRefreshToken,
        grant_type: 'refresh_token',
      });

      await User.findByIdAndUpdate(userId, {
        outlookCalendarToken: response.data.access_token,
        outlookCalendarRefreshToken: response.data.refresh_token || user.outlookCalendarRefreshToken,
      });

      return response.data.access_token;
    } catch (err) {
      throw new Error('Failed to refresh Outlook token');
    }
  }

  async createEvent(userId, session) {
    const accessToken = await this.getAccessToken(userId);
    const learner = await User.findById(session.learner).select('username email');
    const teacher = await User.findById(session.teacher).select('username email');

    const startTime = new Date(session.scheduledTime);
    const endTime = new Date(startTime.getTime() + session.durationHours * 60 * 60 * 1000);

    const event = {
      subject: `SkillSwap: ${session.skill}`,
      body: {
        contentType: 'HTML',
        content: `Teaching session: ${session.skill}<br>Teacher: ${teacher.username}<br>Learner: ${learner.username}${session.meetingLink ? `<br><a href="${session.meetingLink}">Meeting Link</a>` : ''}`,
      },
      start: {
        dateTime: startTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      attendees: [
        { emailAddress: { address: learner.email }, type: 'required' },
        { emailAddress: { address: teacher.email }, type: 'required' },
      ],
      reminderMinutesBeforeStart: 15,
      isReminderOn: true,
    };

    try {
      const response = await axios.post(
        'https://graph.microsoft.com/v1.0/me/calendar/events',
        event,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        eventId: response.data.id,
        webLink: response.data.webLink,
      };
    } catch (err) {
      if (err.response?.status === 401) {
        // Token expired, try to refresh
        const newToken = await this.refreshToken(userId);
        const retryResponse = await axios.post(
          'https://graph.microsoft.com/v1.0/me/calendar/events',
          event,
          {
            headers: {
              Authorization: `Bearer ${newToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
        return {
          eventId: retryResponse.data.id,
          webLink: retryResponse.data.webLink,
        };
      }
      throw err;
    }
  }

  async updateEvent(userId, session) {
    if (!session.calendarEventId) {
      return this.createEvent(userId, session);
    }

    const accessToken = await this.getAccessToken(userId);
    const learner = await User.findById(session.learner).select('username email');
    const teacher = await User.findById(session.teacher).select('username email');

    const startTime = new Date(session.scheduledTime);
    const endTime = new Date(startTime.getTime() + session.durationHours * 60 * 60 * 1000);

    const event = {
      subject: `SkillSwap: ${session.skill}`,
      body: {
        contentType: 'HTML',
        content: `Teaching session: ${session.skill}<br>Teacher: ${teacher.username}<br>Learner: ${learner.username}${session.meetingLink ? `<br><a href="${session.meetingLink}">Meeting Link</a>` : ''}`,
      },
      start: {
        dateTime: startTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      attendees: [
        { emailAddress: { address: learner.email }, type: 'required' },
        { emailAddress: { address: teacher.email }, type: 'required' },
      ],
      reminderMinutesBeforeStart: 15,
      isReminderOn: true,
    };

    try {
      const response = await axios.patch(
        `https://graph.microsoft.com/v1.0/me/calendar/events/${session.calendarEventId}`,
        event,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        eventId: response.data.id,
        webLink: response.data.webLink,
      };
    } catch (err) {
      if (err.response?.status === 401) {
        const newToken = await this.refreshToken(userId);
        const retryResponse = await axios.patch(
          `https://graph.microsoft.com/v1.0/me/calendar/events/${session.calendarEventId}`,
          event,
          {
            headers: {
              Authorization: `Bearer ${newToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
        return {
          eventId: retryResponse.data.id,
          webLink: retryResponse.data.webLink,
        };
      } else if (err.response?.status === 404) {
        // Event not found, create a new one
        return this.createEvent(userId, session);
      }
      throw err;
    }
  }

  async deleteEvent(userId, calendarEventId) {
    if (!calendarEventId) return;

    const accessToken = await this.getAccessToken(userId);
    try {
      await axios.delete(
        `https://graph.microsoft.com/v1.0/me/calendar/events/${calendarEventId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
    } catch (err) {
      if (err.response?.status === 401) {
        const newToken = await this.refreshToken(userId);
        await axios.delete(
          `https://graph.microsoft.com/v1.0/me/calendar/events/${calendarEventId}`,
          {
            headers: {
              Authorization: `Bearer ${newToken}`,
            },
          }
        );
      } else if (err.response?.status !== 404) {
        throw err;
      }
      // Event already deleted, ignore
    }
  }
}

/**
 * Main Calendar Service - Factory pattern
 */
class CalendarService {
  constructor() {
    this.google = new GoogleCalendarService();
    this.outlook = new OutlookCalendarService();
  }

  async createEvent(userId, session, provider) {
    if (provider === 'google') {
      return this.google.createEvent(userId, session);
    } else if (provider === 'outlook') {
      return this.outlook.createEvent(userId, session);
    }
    throw new Error('Invalid calendar provider');
  }

  async updateEvent(userId, session, provider) {
    if (provider === 'google') {
      return this.google.updateEvent(userId, session);
    } else if (provider === 'outlook') {
      return this.outlook.updateEvent(userId, session);
    }
    throw new Error('Invalid calendar provider');
  }

  async deleteEvent(userId, calendarEventId, provider) {
    if (provider === 'google') {
      return this.google.deleteEvent(userId, calendarEventId);
    } else if (provider === 'outlook') {
      return this.outlook.deleteEvent(userId, calendarEventId);
    }
    throw new Error('Invalid calendar provider');
  }
}

module.exports = new CalendarService();
module.exports.GoogleCalendarService = GoogleCalendarService;
module.exports.OutlookCalendarService = OutlookCalendarService;
