const axios = require('axios');
const Order = require('../models/Order');
const User = require('../models/User');

const PAYMONGO_BASE_URL = 'https://api.paymongo.com/v1';

const getPaymongoHeaders = () => {
  const secretKey = process.env.PAYMONGO_SECRET_KEY;
  if (!secretKey) {
    throw new Error('PAYMONGO_SECRET_KEY is not configured');
  }

  const encoded = Buffer.from(`${secretKey}:`).toString('base64');
  return {
    Authorization: `Basic ${encoded}`,
    'Content-Type': 'application/json',
  };
};

const createPaymongoCheckoutSession = async (req, res) => {
  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({ success: false, message: 'orderId is required', data: {} });
  }

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found', data: {} });
    }

    const isOwner = order.user.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorised', data: {} });
    }

    if (order.isPaid) {
      return res.status(400).json({ success: false, message: 'Order is already paid', data: {} });
    }

    const orderOwner = await User.findById(order.user).select('name email');

    const lineItems = (order.items || []).map((item) => ({
      currency: 'PHP',
      amount: Math.round(Number(item.price || 0) * 100),
      name: item.name || 'Product',
      quantity: Number(item.quantity || 1),
    }));

    if (Number(order.shippingPrice || 0) > 0) {
      lineItems.push({
        currency: 'PHP',
        amount: Math.round(Number(order.shippingPrice) * 100),
        name: 'Shipping Fee',
        quantity: 1,
      });
    }

    const discount = Math.round(Number(order.discountApplied || 0) * 100);
    if (discount > 0) {
      lineItems.push({
        currency: 'PHP',
        amount: -discount,
        name: `Promo Discount${order.promoCode ? ` (${order.promoCode})` : ''}`,
        quantity: 1,
      });
    }

    const successUrl =
      process.env.PAYMONGO_SUCCESS_URL ||
      'https://example.com/payment-success';
    const cancelUrl =
      process.env.PAYMONGO_CANCEL_URL ||
      'https://example.com/payment-cancelled';

    const payload = {
      data: {
        attributes: {
          billing: {
            name: orderOwner?.name || 'HIMIGHUB Customer',
            email: orderOwner?.email,
          },
          send_email_receipt: false,
          show_description: true,
          show_line_items: true,
          line_items: lineItems,
          payment_method_types: ['card', 'gcash', 'paymaya'],
          description: `HIMIGHUB Order #${order._id.toString().slice(-8).toUpperCase()}`,
          metadata: {
            orderId: order._id.toString(),
            userId: req.user.id,
          },
          success_url: successUrl,
          cancel_url: cancelUrl,
        },
      },
    };

    const response = await axios.post(
      `${PAYMONGO_BASE_URL}/checkout_sessions`,
      payload,
      { headers: getPaymongoHeaders() }
    );

    const session = response?.data?.data;
    if (!session?.id || !session?.attributes?.checkout_url) {
      return res.status(502).json({ success: false, message: 'Invalid PayMongo response', data: {} });
    }

    order.paymentMethod = 'PAYMONGO';
    order.paymongoCheckoutSessionId = session.id;
    await order.save();

    return res.status(201).json({
      success: true,
      message: 'PayMongo checkout session created',
      data: {
        sessionId: session.id,
        checkoutUrl: session.attributes.checkout_url,
      },
    });
  } catch (err) {
    const providerMessage = err?.response?.data?.errors?.[0]?.detail;
    return res.status(err?.response?.status || 500).json({
      success: false,
      message: providerMessage || err.message || 'Failed to create PayMongo checkout session',
      data: {},
    });
  }
};

const verifyPaymongoCheckoutSession = async (req, res) => {
  const { sessionId } = req.params;
  const { orderId } = req.query;

  if (!sessionId || !orderId) {
    return res.status(400).json({ success: false, message: 'sessionId and orderId are required', data: {} });
  }

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found', data: {} });
    }

    const isOwner = order.user.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorised', data: {} });
    }

    if (order.paymongoCheckoutSessionId && order.paymongoCheckoutSessionId !== sessionId) {
      return res.status(400).json({ success: false, message: 'Session does not match this order', data: {} });
    }

    const response = await axios.get(`${PAYMONGO_BASE_URL}/checkout_sessions/${sessionId}`, {
      headers: getPaymongoHeaders(),
    });

    const session = response?.data?.data;
    const attrs = session?.attributes || {};
    const paymentCount = Array.isArray(attrs.payments) ? attrs.payments.length : 0;
    const status = attrs.payment_intent?.attributes?.status || attrs.status || 'unknown';
    const isPaid = status === 'succeeded' || status === 'paid' || paymentCount > 0;

    if (isPaid) {
      order.isPaid = true;
      order.paidAt = order.paidAt || new Date();
      order.paymentMethod = 'PAYMONGO';
      order.paymongoCheckoutSessionId = sessionId;
      await order.save();
    }

    return res.status(200).json({
      success: true,
      message: isPaid ? 'Payment verified' : 'Payment not completed yet',
      data: {
        isPaid,
        status,
        order,
      },
    });
  } catch (err) {
    const providerMessage = err?.response?.data?.errors?.[0]?.detail;
    return res.status(err?.response?.status || 500).json({
      success: false,
      message: providerMessage || err.message || 'Failed to verify checkout session',
      data: {},
    });
  }
};

module.exports = {
  createPaymongoCheckoutSession,
  verifyPaymongoCheckoutSession,
};
