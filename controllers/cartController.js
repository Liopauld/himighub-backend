const Cart = require('../models/Cart');

// GET /api/cart
const getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id }).populate('items.product', 'name images price stock isAvailable');
    if (!cart) return res.status(200).json({ success: true, message: '', data: { items: [] } });

    return res.status(200).json({ success: true, message: '', data: { items: cart.items } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: {} });
  }
};

// POST /api/cart
const addToCart = async (req, res) => {
  const { productId, quantity, size } = req.body;

  if (!productId || !quantity) {
    return res.status(400).json({ success: false, message: 'productId and quantity are required', data: {} });
  }

  try {
    let cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
      cart = await Cart.create({ user: req.user.id, items: [] });
    }

    const existingIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId && item.size === (size || '')
    );

    if (existingIndex >= 0) {
      cart.items[existingIndex].quantity += parseInt(quantity);
    } else {
      cart.items.push({
        product: productId,
        name: req.body.name || '',
        image: req.body.image || '',
        price: req.body.price || 0,
        quantity: parseInt(quantity),
        size: size || '',
      });
    }

    await cart.save();

    return res.status(200).json({ success: true, message: 'Item added to cart', data: { items: cart.items } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: {} });
  }
};

// PUT /api/cart/:productId
const updateCartItem = async (req, res) => {
  const { quantity, size } = req.body;

  try {
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found', data: {} });

    const index = cart.items.findIndex((item) => item.product.toString() === req.params.productId);
    if (index < 0) {
      return res.status(404).json({ success: false, message: 'Item not found in cart', data: {} });
    }

    if (quantity !== undefined) cart.items[index].quantity = parseInt(quantity);
    if (size !== undefined) cart.items[index].size = size;

    await cart.save();

    return res.status(200).json({ success: true, message: 'Cart updated', data: { items: cart.items } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: {} });
  }
};

// DELETE /api/cart/:productId
const removeCartItem = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found', data: {} });

    cart.items = cart.items.filter((item) => item.product.toString() !== req.params.productId);
    await cart.save();

    return res.status(200).json({ success: true, message: 'Item removed', data: { items: cart.items } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: {} });
  }
};

// DELETE /api/cart
const clearCart = async (req, res) => {
  try {
    await Cart.findOneAndUpdate({ user: req.user.id }, { items: [] });
    return res.status(200).json({ success: true, message: 'Cart cleared', data: {} });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: {} });
  }
};

module.exports = { getCart, addToCart, updateCartItem, removeCartItem, clearCart };
