const express = require('express');
const router = express.Router();
const {
  validatePromo,
  createPromotion,
  getAllPromotions,
  updatePromotion,
  deletePromotion,
} = require('../controllers/promotionController');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

router.post('/validate', validatePromo);                          // public

router.use(verifyToken, isAdmin);

router.get('/', getAllPromotions);
router.post('/', createPromotion);
router.put('/:id', updatePromotion);
router.delete('/:id', deletePromotion);

module.exports = router;
