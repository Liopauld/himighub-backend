const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');
const { getAnalytics } = require('../controllers/adminController');

router.get('/analytics', verifyToken, isAdmin, getAnalytics);

module.exports = router;