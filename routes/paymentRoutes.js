const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const {
  createPaymongoCheckoutSession,
  verifyPaymongoCheckoutSession,
} = require('../controllers/paymentController');

router.post('/paymongo/checkout-session', verifyToken, createPaymongoCheckoutSession);
router.get('/paymongo/checkout-session/:sessionId', verifyToken, verifyPaymongoCheckoutSession);

module.exports = router;
