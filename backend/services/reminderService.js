const cron = require('node-cron');
const Session = require('../models/Session');
const transporter = require('../config/mailer');

console.log('Reminder service initialized. Waiting for cron tasks.');

// Runs every hour at the 0-minute mark (e.g., 2:00, 3:00)
cron.schedule('0 * * * *', async () => {
  console.log('Running hourly reminder check...');
  
  const now = new Date();
  const reminderWindowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const reminderWindowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  try {
    const sessionsToRemind = await Session.find({
      status: 'confirmed',
      scheduledTime: {
        $gte: reminderWindowStart,
        $lte: reminderWindowEnd,
      },
    }).populate('learnerId', 'email username')
      .populate('teacherId', 'email username');

    if (sessionsToRemind.length > 0) {
      console.log(`Found ${sessionsToRemind.length} sessions to remind...`);
    }

    for (const session of sessionsToRemind) {
      const { learnerId, teacherId, skill, scheduledTime, meetingLink } = session;
      const formattedTime = new Date(scheduledTime).toLocaleString('en-US', {
        dateStyle: 'full',
        timeStyle: 'short',
      });

      const emailSubject = `SkillSwap Reminder: ${skill} Session Tomorrow!`;
      const linkHtml = meetingLink ? `<p><strong>Meeting Link:</strong> <a href="${meetingLink}">${meetingLink}</a></p>` : '';

      // 1. Email to Learner
      await transporter.sendMail({
        from: '"SkillSwap" <noreply@skillswap.com>',
        to: learnerId.email,
        subject: emailSubject,
        html: `<p>Hi ${learnerId.username},</p><p>This is a reminder for your upcoming SkillSwap session to learn <strong>${skill}</strong> from <strong>${teacherId.username}</strong>.</p><p><strong>When:</strong> ${formattedTime}</p>${linkHtml}<p>Enjoy the session!<br>- The SkillSwap Team</p>`,
      });
      
      // 2. Email to Teacher
      await transporter.sendMail({
        from: '"SkillSwap" <noreply@skillswap.com>',
        to: teacherId.email,
        subject: emailSubject,
        html: `<p>Hi ${teacherId.username},</p><p>This is a reminder for your upcoming SkillSwap session to teach <strong>${skill}</strong> to <strong>${learnerId.username}</strong>.</p><p><strong>When:</strong> ${formattedTime}</p>${linkHtml}<p>Enjoy the session!<br>- The SkillSwap Team</p>`,
      });
    }
  } catch (err) {
    console.error('Error sending reminders:', err);
  }
});