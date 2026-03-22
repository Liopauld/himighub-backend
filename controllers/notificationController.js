const User = require('../models/User');
const Notification = require('../models/Notification');
const sendNotification = require('../utils/sendNotification');

// GET /api/notifications
const getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(100);

    return res.status(200).json({
      success: true,
      message: '',
      data: { notifications },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: {} });
  }
};

// PUT /api/notifications/:id/read
const markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found', data: {} });
    }

    return res.status(200).json({ success: true, message: 'Notification marked as read', data: { notification } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: {} });
  }
};

// POST /api/notifications/broadcast  (admin)
const broadcastNotification = async (req, res) => {
  const { title, body, data = {}, userIds = [] } = req.body;

  if (!title || !body) {
    return res.status(400).json({ success: false, message: 'title and body are required', data: {} });
  }

  try {
    let users;

    if (userIds.length > 0) {
      users = await User.find({ _id: { $in: userIds }, pushTokens: { $exists: true, $not: { $size: 0 } } });
    } else {
      // broadcast to all customers
      users = await User.find({ role: 'customer', pushTokens: { $exists: true, $not: { $size: 0 } } });
    }

    if (users.length === 0) {
      return res.status(200).json({ success: true, message: 'No users with push tokens found', data: { sent: 0 } });
    }

    let sent = 0;
    for (const user of users) {
      if (user.pushTokens && user.pushTokens.length > 0) {
        await sendNotification(user.pushTokens, user._id.toString(), { title, body, data });
      }

      await Notification.create({
        user: user._id,
        title,
        body,
        type: data?.type || 'system',
        data,
      });

      if (user.pushTokens && user.pushTokens.length > 0) {
        sent++;
      }
    }

    return res.status(200).json({
      success: true,
      message: `Notification sent to ${sent} user(s)`,
      data: { sent },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: {} });
  }
};

module.exports = { broadcastNotification, getMyNotifications, markNotificationRead };
