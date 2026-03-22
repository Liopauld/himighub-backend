require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function cleanupUsers() {
  const keepEmail = (process.env.ADMIN_SEED_EMAIL || 'admin@himighub.com').toLowerCase();

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing in environment variables');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const before = await User.countDocuments({});
  const deleted = await User.deleteMany({ email: { $ne: keepEmail } });
  const after = await User.countDocuments({});
  const adminDoc = await User.findOne({ email: keepEmail }).select('email role name');

  console.log('Users before:', before);
  console.log('Deleted users:', deleted.deletedCount);
  console.log('Users after:', after);

  if (!adminDoc) {
    console.log('Warning: admin account not found:', keepEmail);
  } else {
    console.log('Remaining admin:', adminDoc.email, '| role:', adminDoc.role, '| name:', adminDoc.name);
  }
}

cleanupUsers()
  .catch((error) => {
    console.error('Cleanup failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
