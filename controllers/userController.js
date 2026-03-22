const path = require('path');
const User = require('../models/User');
const { sendEmail } = require('../utils/emailService');

// GET /api/users/profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found', data: {} });

    return res.status(200).json({ success: true, message: '', data: { user } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: {} });
  }
};

// PUT /api/users/profile
const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found', data: {} });

    const phoneValue = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
    if (!phoneValue) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required',
        data: {},
      });
    }

    if (req.body.name) user.name = req.body.name;
    user.phone = phoneValue;

    if (req.body.email && req.body.email !== user.email) {
      const existing = await User.findOne({ email: req.body.email.toLowerCase().trim() });
      if (existing && existing._id.toString() !== user._id.toString()) {
        return res.status(400).json({ success: false, message: 'Email already in use', data: {} });
      }
      user.email = req.body.email.toLowerCase().trim();
    }

    if (req.body.address) {
      const addr = typeof req.body.address === 'string'
        ? JSON.parse(req.body.address)
        : req.body.address;
      user.address = { ...user.address.toObject?.() ?? user.address, ...addr };
    }

    if (req.file) {
      user.avatar = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated',
      data: {
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

// PUT /api/users/push-token
const savePushToken = async (req, res) => {
  const { token } = req.body;

  if (!token || !token.startsWith('ExponentPushToken[')) {
    return res
      .status(400)
      .json({ success: false, message: 'Invalid push token format', data: {} });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found', data: {} });

    // Clean stale tokens (keep only valid format ones) and add new
    user.pushTokens = user.pushTokens.filter((t) => t.startsWith('ExponentPushToken['));
    if (!user.pushTokens.includes(token)) {
      user.pushTokens.push(token);
    }

    await user.save();

    return res.status(200).json({ success: true, message: 'Push token saved', data: {} });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: {} });
  }
};

// GET /api/users  (admin)
const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const total = await User.countDocuments();
    const users = await User.find().select('-password').skip(skip).limit(limit).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: '',
      data: { users, total, page, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: {} });
  }
};

// PUT /api/users/:id/status  (admin)
const updateUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found', data: {} });

    if (user.role === 'admin' && req.user.id !== user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot deactivate another admin account', data: {} });
    }

    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isActive must be a boolean', data: {} });
    }

    user.isActive = isActive;
    await user.save();

    await sendEmail({
      to: user.email,
      subject: isActive
        ? 'HIMIGHUB Account Verification Successful'
        : 'HIMIGHUB Account Deactivated',
      text: isActive
        ? `Hi ${user.name}, your account has been verified and activated. You can now use HIMIGHUB.`
        : `Hi ${user.name}, your account has been deactivated. If this is unexpected, contact support.`,
      html: isActive
        ? `<p>Hi <strong>${user.name}</strong>,</p><p>Your account has been verified and activated. You can now use HIMIGHUB.</p>`
        : `<p>Hi <strong>${user.name}</strong>,</p><p>Your account has been deactivated. If this is unexpected, contact support.</p>`,
    });

    return res.status(200).json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'}`,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: {} });
  }
};

// PUT /api/users/:id/role  (admin)
const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['user', 'admin'];

    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role', data: {} });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found', data: {} });

    // Prevent accidentally stripping your own admin permissions.
    if (req.user.id === user._id.toString() && role !== 'admin') {
      return res.status(400).json({ success: false, message: 'You cannot remove your own admin role', data: {} });
    }

    user.role = role;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'User role updated',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: {} });
  }
};

module.exports = { getProfile, updateProfile, savePushToken, getAllUsers, updateUserStatus, updateUserRole };
