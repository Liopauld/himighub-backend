const Promotion = require('../models/Promotion');

// POST /api/promotions/validate  (public — used at checkout)
const validatePromo = async (req, res) => {
  const { code, orderAmount } = req.body;

  if (!code) return res.status(400).json({ success: false, message: 'Promo code is required', data: {} });

  try {
    const promo = await Promotion.findOne({ code: code.toUpperCase() });

    if (!promo) return res.status(404).json({ success: false, message: 'Invalid promo code', data: {} });
    if (!promo.isActive) return res.status(400).json({ success: false, message: 'Promo code is inactive', data: {} });
    if (promo.expiresAt && new Date() > promo.expiresAt)
      return res.status(400).json({ success: false, message: 'Promo code has expired', data: {} });
    if (promo.usageLimit && promo.usedCount >= promo.usageLimit)
      return res.status(400).json({ success: false, message: 'Promo code usage limit reached', data: {} });
    if (promo.minOrderAmount && orderAmount < promo.minOrderAmount)
      return res.status(400).json({
        success: false,
        message: `Minimum order amount of ₱${promo.minOrderAmount} required`,
        data: {},
      });

    let discount = 0;
    if (promo.discountType === 'percentage') {
      discount = (orderAmount * promo.discountValue) / 100;
    } else {
      discount = promo.discountValue;
    }

    return res.status(200).json({
      success: true,
      message: 'Promo code applied',
      data: { discount: Math.min(discount, orderAmount), promo },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: {} });
  }
};

// POST /api/promotions  (admin)
const createPromotion = async (req, res) => {
  try {
    const promo = await Promotion.create(req.body);
    return res.status(201).json({ success: true, message: 'Promotion created', data: { promo } });
  } catch (err) {
    if (err.code === 11000)
      return res.status(400).json({ success: false, message: 'Promo code already exists', data: {} });
    return res.status(500).json({ success: false, message: err.message, data: {} });
  }
};

// GET /api/promotions  (admin)
const getAllPromotions = async (req, res) => {
  try {
    const promos = await Promotion.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, message: '', data: { promos } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: {} });
  }
};

// PUT /api/promotions/:id  (admin)
const updatePromotion = async (req, res) => {
  try {
    const promo = await Promotion.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!promo) return res.status(404).json({ success: false, message: 'Promotion not found', data: {} });
    return res.status(200).json({ success: true, message: 'Promotion updated', data: { promo } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: {} });
  }
};

// DELETE /api/promotions/:id  (admin)
const deletePromotion = async (req, res) => {
  try {
    const promo = await Promotion.findByIdAndDelete(req.params.id);
    if (!promo) return res.status(404).json({ success: false, message: 'Promotion not found', data: {} });
    return res.status(200).json({ success: true, message: 'Promotion deleted', data: {} });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: {} });
  }
};

module.exports = { validatePromo, createPromotion, getAllPromotions, updatePromotion, deletePromotion };
