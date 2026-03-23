const { validationResult } = require('express-validator');
const admin = require('../config/firebase');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const { sendEmail } = require('../utils/emailService');

const isRetryableFirebaseError = (err) => {
  const code = String(err?.code || '').toUpperCase();
  const message = String(err?.message || '').toLowerCase();
  return (
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'ENOTFOUND' ||
    code === 'EAI_AGAIN' ||
    message.includes('timeout') ||
    message.includes('network')
  );
};

const verifyIdTokenWithRetry = async (firebaseToken, retries = 2, delayMs = 500) => {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await admin.auth().verifyIdToken(firebaseToken);
    } catch (err) {
      lastError = err;
      if (!isRetryableFirebaseError(err) || attempt === retries) break;
      await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }
  throw lastError;
};

// POST /api/auth/register
const register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg, data: {} });
  }

  const { name, email, password } = req.body;
  const normalizedEmail = String(email || '').trim().toLowerCase();

  try {
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already in use', data: {} });
    }

    const user = await User.create({ name, email: normalizedEmail, password });

    await sendEmail({
      to: user.email,
      subject: 'Welcome to HIMIGHUB - Account Created',
      text: `Hi ${user.name}, your HIMIGHUB account has been created successfully.`,
      html: `<p>Hi <strong>${user.name}</strong>,</p><p>Your HIMIGHUB account has been created successfully.</p>`,
    });

    const token = generateToken({ id: user._id, role: user.role });

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar,
          address: user.address,
          role: user.role,
          isActive: user.isActive,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: {} });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg, data: {} });
  }

  const { email, password } = req.body;
  const normalizedEmail = String(email || '').trim().toLowerCase();

  try {
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password', data: {} });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated. Please contact support.', data: {} });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password', data: {} });
    }

    const token = generateToken({ id: user._id, role: user.role });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar,
          address: user.address,
          role: user.role,
          isActive: user.isActive,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: {} });
  }
};

// POST /api/auth/firebase  (Google + Facebook via Firebase)
const firebaseAuth = async (req, res) => {
  const { firebaseToken } = req.body;

  if (!firebaseToken) {
    return res.status(400).json({ success: false, message: 'firebaseToken is required', data: {} });
  }

  try {
    const decoded = await verifyIdTokenWithRetry(firebaseToken);
    const { uid, email, name, picture } = decoded;
    const provider = decoded.firebase?.sign_in_provider;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'No email associated with this account',
        data: {},
      });
    }

    let user = await User.findOne({ email });

    if (user) {
      if (!user.isActive) {
        return res.status(403).json({ success: false, message: 'Account is deactivated. Please contact support.', data: {} });
      }
      // Merge provider ID into existing user
      if (provider === 'google.com' && !user.googleId) user.googleId = uid;
      if (provider === 'facebook.com' && !user.facebookId) user.facebookId = uid;
      if (!user.avatar && picture) user.avatar = picture;
      await user.save();
    } else {
      const createData = {
        name: name || email.split('@')[0],
        email,
        avatar: picture || '',
      };
      if (provider === 'google.com') createData.googleId = uid;
      if (provider === 'facebook.com') createData.facebookId = uid;

      user = await User.create(createData);

      await sendEmail({
        to: user.email,
        subject: 'Welcome to HIMIGHUB - Account Created',
        text: `Hi ${user.name}, your HIMIGHUB account has been created successfully.`,
        html: `<p>Hi <strong>${user.name}</strong>,</p><p>Your HIMIGHUB account has been created successfully.</p>`,
      });
    }

    const token = generateToken({ id: user._id, role: user.role });

    return res.status(200).json({
      success: true,
      message: 'Firebase authentication successful',
      data: {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar,
          address: user.address,
          role: user.role,
          isActive: user.isActive,
        },
      },
    });
  } catch (err) {
    console.error('[auth/firebase] verifyIdToken failed', {
      code: err?.code,
      message: err?.message,
    });

    if (isRetryableFirebaseError(err)) {
      return res.status(503).json({
        success: false,
        message: 'Temporary Firebase verification timeout. Please try again in a few seconds.',
        data: {},
      });
    }

    const detail = err?.message || 'Unknown Firebase token verification error';
    const code = err?.code ? ` (${err.code})` : '';
    return res.status(401).json({
      success: false,
      message: `Invalid Firebase token${code}: ${detail}`,
      data: {},
    });
  }
};

// POST /api/auth/logout
const logout = async (req, res) => {
  const { pushToken } = req.body;

  if (!pushToken) {
    return res.status(200).json({ success: true, message: 'Logged out', data: {} });
  }

  try {
    // Remove the push token from whichever user owns it
    await User.updateMany(
      { pushTokens: pushToken },
      { $pull: { pushTokens: pushToken } }
    );

    return res.status(200).json({ success: true, message: 'Logged out and push token removed', data: {} });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: {} });
  }
};

module.exports = { register, login, firebaseAuth, logout };
