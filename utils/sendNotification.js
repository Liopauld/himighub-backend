const axios = require('axios');
const User = require('../models/User');

/**
 * Send Expo push notifications to an array of Expo push tokens.
 * Automatically removes stale/invalid tokens from the user's document.
 * @param {string[]} tokens - Array of Expo tokens (ExponentPushToken[...])
 * @param {string} userId   - MongoDB User _id (for stale token cleanup)
 * @param {object} payload  - { title, body, data }
 */
const sendNotification = async (tokens, userId, payload) => {
  if (!tokens || tokens.length === 0) return;

  const expoTokens = tokens.filter((t) => typeof t === 'string' && t.startsWith('ExponentPushToken['));
  if (expoTokens.length === 0) return;

  const staleTokens = [];

  const messages = expoTokens.map((to) => ({
    to,
    title: payload.title,
    body: payload.body,
    data: payload.data
      ? Object.fromEntries(Object.entries(payload.data).map(([k, v]) => [k, String(v)]))
      : {},
    sound: 'default',
    priority: 'high',
    channelId: 'default',
  }));

  try {
    const response = await axios.post('https://exp.host/--/api/v2/push/send', messages, {
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    const tickets = response?.data?.data || [];
    tickets.forEach((ticket, idx) => {
      if (ticket?.status === 'error' && ticket?.details?.error === 'DeviceNotRegistered') {
        staleTokens.push(expoTokens[idx]);
      }
    });
  } catch (err) {
    console.error('[ExpoPush] send failed:', err?.message || err);
  }

  if (staleTokens.length > 0 && userId) {
    await User.findByIdAndUpdate(userId, {
      $pull: { pushTokens: { $in: staleTokens } },
    });
  }
};

module.exports = sendNotification;
