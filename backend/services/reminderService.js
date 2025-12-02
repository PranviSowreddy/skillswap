const cron = require('node-cron');
const Session = require('../models/Session');

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
      // Email functionality removed - can be replaced with in-app notifications or other notification methods
      for (const session of sessionsToRemind) {
        const { learnerId, teacherId, skill, scheduledTime } = session;
        const formattedTime = new Date(scheduledTime).toLocaleString('en-US', {
          dateStyle: 'full',
          timeStyle: 'short',
        });
        console.log(`Reminder: ${learnerId.username} and ${teacherId.username} have a ${skill} session at ${formattedTime}`);
      }
    }
  } catch (err) {
    console.error('Error checking reminders:', err);
  }
});