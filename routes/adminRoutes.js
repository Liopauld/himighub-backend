const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');
const { getAnalytics, getUploadDiagnostics } = require('../controllers/adminController');

router.get('/analytics', verifyToken, isAdmin, getAnalytics);
router.get('/diagnostics/uploads', verifyToken, isAdmin, getUploadDiagnostics);

module.exports = router;