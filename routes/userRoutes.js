const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const {
  getProfile,
  updateProfile,
  savePushToken,
  getAllUsers,
  updateUserStatus,
  updateUserRole,
} = require('../controllers/userController');

router.get('/profile', verifyToken, getProfile);
router.put('/profile', verifyToken, upload.single('avatar'), updateProfile);
router.put('/push-token', verifyToken, savePushToken);

router.get('/', verifyToken, isAdmin, getAllUsers);
router.put('/:id/status', verifyToken, isAdmin, updateUserStatus);
router.put('/:id/role', verifyToken, isAdmin, updateUserRole);

module.exports = router;
