const Review = require('../models/Review');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { hasBadWords, getCleanText } = require('../utils/badWordsFilter');

// Recalculate and update product's average rating and numReviews
const recalcProductRating = async (productId) => {
  const reviews = await Review.find({ product: productId });
  const numReviews = reviews.length;
  const ratings = numReviews > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / numReviews
    : 0;
  await Product.findByIdAndUpdate(productId, { ratings, numReviews });
};

// GET /api/reviews/product/:productId
const getProductReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ product: req.params.productId })
      .populate('user', 'name avatar')
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, message: '', data: { reviews } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: {} });
  }
};

// POST /api/reviews
const createReview = async (req, res) => {
  const { productId, orderId, rating, comment } = req.body;

  if (!productId || !rating) {
    return res.status(400).json({ success: false, message: 'productId and rating are required', data: {} });
  }

  // Validate comment for inappropriate language
  if (comment && hasBadWords(comment)) {
    return res.status(400).json({
      success: false,
      message: 'Your review contains inappropriate language. Please revise and try again.',
      data: {},
    });
  }

  try {
    // Verify the user has a delivered order containing this product.
    // If orderId is not provided from the client, fall back to the latest valid order.
    const query = {
      user: req.user.id,
      status: 'Delivered',
      'items.product': productId,
    };

    if (orderId) {
      query._id = orderId;
    }

    const order = await Order.findOne(query).sort({ createdAt: -1 });

    if (!order) {
      return res.status(403).json({
        success: false,
        message: 'You can only review products from a delivered order',
        data: {},
      });
    }

    // Clean the comment text before storing
    const cleanComment = comment ? getCleanText(comment) : '';

    const review = await Review.create({
      user: req.user.id,
      product: productId,
      order: order._id,
      rating,
      comment: cleanComment,
    });

    await recalcProductRating(productId);

    const populated = await review.populate('user', 'name avatar');
    return res.status(201).json({ success: true, message: 'Review submitted', data: { review: populated } });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'You have already reviewed this product', data: {} });
    }
    return res.status(500).json({ success: false, message: err.message, data: {} });
  }
};

// PUT /api/reviews/:id
const updateReview = async (req, res) => {
  const { rating, comment } = req.body;

  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found', data: {} });

    if (review.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorised', data: {} });
    }

    if (rating) review.rating = rating;
    if (comment !== undefined) review.comment = comment;
    await review.save();

    await recalcProductRating(review.product);

    const populated = await review.populate('user', 'name avatar');
    return res.status(200).json({ success: true, message: 'Review updated', data: { review: populated } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: {} });
  }
};

// DELETE /api/reviews/:id
const deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found', data: {} });

    const isOwner = review.user.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorised', data: {} });
    }

    const productId = review.product;
    await review.deleteOne();
    await recalcProductRating(productId);

    return res.status(200).json({ success: true, message: 'Review deleted', data: {} });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: {} });
  }
};

module.exports = { getProductReviews, createReview, updateReview, deleteReview };
