require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const connectDB = require('../config/db');

// Connect to database
connectDB();

const createAdmin = async () => {
  try {
    const email = process.argv[2];
    const password = process.argv[3];
    
    if (!email || !password) {
      console.log('Usage: node createAdmin.js <email> <password>');
      console.log('Example: node createAdmin.js admin@skillswap.com admin123');
      process.exit(1);
    }
    
    // Check if admin already exists
    let admin = await User.findOne({ email });
    if (admin) {
      admin.role = 'admin';
      await admin.save();
      console.log(`User ${email} is now an admin!`);
    } else {
      // Create new admin user
      const bcrypt = require('bcryptjs');
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      admin = new User({
        username: 'admin',
        email,
        password: hashedPassword,
        role: 'admin',
        skillsToTeach: ['Platform Administration'],
      });
      
      await admin.save();
      console.log(`Admin user created successfully!`);
      console.log(`Email: ${email}`);
      console.log(`Password: ${password}`);
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error creating admin:', err);
    process.exit(1);
  }
};

createAdmin();

