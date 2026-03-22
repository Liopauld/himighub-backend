const express = require('express');
const router = express.Router();
const {
	broadcastNotification,
	getMyNotifications,
	markNotificationRead,
} = require('../controllers/notificationController');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

router.get('/', verifyToken, getMyNotifications);
router.put('/:id/read', verifyToken, markNotificationRead);
router.post('/broadcast', verifyToken, isAdmin, broadcastNotification);

module.exports = router;
