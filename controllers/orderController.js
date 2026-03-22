const Order = require('../models/Order');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const Promotion = require('../models/Promotion');
const User = require('../models/User');
const Notification = require('../models/Notification');
const sendNotification = require('../utils/sendNotification');
const { sendEmail } = require('../utils/emailService');
const { buildOrderReceiptEmail, buildOrderStatusEmail } = require('../utils/emailTemplates');

// POST /api/orders
const createOrder = async (req, res) => {
  const { items, shippingAddress, paymentMethod, promoCode, paymentDetails } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, message: 'No order items', data: {} });
  }

  try {
    // Calculate items price
    const itemsPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const shippingPrice = itemsPrice >= 1000 ? 0 : 99;

    let discountApplied = 0;
    let validPromoCode = '';

    if (promoCode) {
      const promo = await Promotion.findOne({
        code: promoCode.toUpperCase(),
        isActive: true,
        expiresAt: { $gt: new Date() },
      });

      if (!promo) {
        return res.status(400).json({ success: false, message: 'Invalid or expired promo code', data: {} });
      }

      if (itemsPrice < promo.minOrderAmount) {
        return res.status(400).json({
          success: false,
          message: `Minimum order amount for this promo is ₱${promo.minOrderAmount}`,
          data: {},
        });
      }

      if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) {
        return res.status(400).json({ success: false, message: 'Promo code usage limit reached', data: {} });
      }

      if (promo.discountType === 'percentage') {
        discountApplied = (itemsPrice * promo.discountValue) / 100;
      } else {
        discountApplied = promo.discountValue;
      }

      validPromoCode = promo.code;
      promo.usedCount += 1;
      await promo.save();
    }

    const totalPrice = Math.max(0, itemsPrice + shippingPrice - discountApplied);

    // Deduct stock
    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(404).json({ success: false, message: `Product ${item.product} not found`, data: {} });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}`,
          data: {},
        });
      }
      product.stock -= item.quantity;
      await product.save();
    }

    const normalizedPaymentMethod = String(paymentMethod || 'COD').toUpperCase();
    const gcashNumber = String(paymentDetails?.mobileNumber || '').trim();
    const rawCardNumber = String(paymentDetails?.cardNumber || '').replace(/\s+/g, '');

    if (normalizedPaymentMethod === 'GCASH' && !gcashNumber) {
      return res.status(400).json({ success: false, message: 'GCash mobile number is required', data: {} });
    }

    if (normalizedPaymentMethod === 'CARD' && rawCardNumber.length < 12) {
      return res.status(400).json({ success: false, message: 'Valid card number is required', data: {} });
    }

    let paymentReference = '';
    if (normalizedPaymentMethod === 'GCASH') {
      const masked = gcashNumber.length >= 4 ? `***${gcashNumber.slice(-4)}` : gcashNumber;
      paymentReference = `GCASH-${masked}`;
    }
    if (normalizedPaymentMethod === 'CARD') {
      const last4 = rawCardNumber.slice(-4);
      paymentReference = `CARD-****${last4}`;
    }

    const isCollectedNow = normalizedPaymentMethod === 'GCASH' || normalizedPaymentMethod === 'CARD';

    const order = await Order.create({
      user: req.user.id,
      items,
      shippingAddress,
      paymentMethod: normalizedPaymentMethod,
      itemsPrice,
      shippingPrice,
      totalPrice,
      promoCode: validPromoCode,
      discountApplied,
      isPaid: isCollectedNow,
      paidAt: isCollectedNow ? new Date() : null,
      paymentReference,
    });

    // Clear server-side cart
    await Cart.findOneAndUpdate({ user: req.user.id }, { items: [] });

    // Respond first so checkout UI can clear cart even if email delivery is slow.
    res.status(201).json({ success: true, message: 'Order placed', data: { order } });

    // Send receipt in background; failures should not affect checkout flow.
    (async () => {
      try {
        const orderOwner = await User.findById(req.user.id);
        if (!orderOwner?.email) return;

        const receiptEmail = buildOrderReceiptEmail({
          customerName: orderOwner.name,
          order,
        });

        await sendEmail({
          to: orderOwner.email,
          subject: receiptEmail.subject,
          text: receiptEmail.text,
          html: receiptEmail.html,
          attachments: receiptEmail.attachments,
        });
      } catch (mailErr) {
        console.warn('[orders/createOrder] receipt email failed:', mailErr?.message || mailErr);
      }
    })();

    return;
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: {} });
  }
};

// GET /api/orders/myorders
const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, message: '', data: { orders } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: {} });
  }
};

// GET /api/orders/:id
const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found', data: {} });

    const isOwner = order.user._id.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorised', data: {} });
    }

    return res.status(200).json({ success: true, message: '', data: { order } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: {} });
  }
};

// GET /api/orders  (admin)
const getAllOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const total = await Order.countDocuments();
    const orders = await Order.find()
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      success: true,
      message: '',
      data: { orders, total, page, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: {} });
  }
};

// PUT /api/orders/:id/status  (admin)
const updateOrderStatus = async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['Pending', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled'];

  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status', data: {} });
  }

  try {
    const order = await Order.findById(req.params.id).populate('user', 'pushTokens');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found', data: {} });

    order.status = status;
    if (status === 'Delivered') {
      order.deliveredAt = new Date();
      // COD is only collected when delivered.
      if (order.paymentMethod === 'COD' && !order.isPaid) {
        order.isPaid = true;
        order.paidAt = new Date();
      }
    }
    await order.save();

    const shortId = order._id.toString().slice(-6).toUpperCase();
    const orderId = order._id.toString();
    const orderUserId = (order.user._id || order.user).toString();

    // Return immediately so admin status modal can close without waiting for SMTP/push delivery.
    res.status(200).json({ success: true, message: 'Order status updated', data: { order } });

    // Execute side effects in background; failures should not block status updates.
    (async () => {
      try {
        const notificationPayload = {
          title: 'Order Update',
          body: `Your order #${shortId} is now: ${status}`,
          data: { orderId, screen: 'OrderDetails', type: 'order', status },
        };

        await Notification.create({
          user: orderUserId,
          title: notificationPayload.title,
          body: notificationPayload.body,
          type: status === 'Out for Delivery' ? 'delivery' : 'order',
          data: notificationPayload.data,
        });

        if (status === 'Delivered') {
          await Notification.create({
            user: orderUserId,
            title: 'Receipt Sent',
            body: `Your receipt for order #${shortId} has been emailed.`,
            type: 'order',
            data: { orderId, screen: 'OrderDetails', type: 'receipt', status },
          });
        }

        const orderOwner = await User.findById(orderUserId);
        if (orderOwner && orderOwner.pushTokens.length > 0) {
          await sendNotification(orderOwner.pushTokens, orderOwner._id.toString(), notificationPayload);
          if (status === 'Delivered') {
            await sendNotification(orderOwner.pushTokens, orderOwner._id.toString(), {
              title: 'Receipt Sent',
              body: `Your receipt for order #${shortId} was sent to your email.`,
              data: { orderId, screen: 'OrderDetails', type: 'receipt', status },
            });
          }
        }

        if (orderOwner?.email) {
          const statusEmail = buildOrderStatusEmail({
            customerName: orderOwner.name,
            order,
            status,
          });

          await sendEmail({
            to: orderOwner.email,
            subject: statusEmail.subject,
            text: statusEmail.text,
            html: statusEmail.html,
            attachments: statusEmail.attachments,
          });

          if (status === 'Delivered') {
            const receiptEmail = buildOrderReceiptEmail({
              customerName: orderOwner.name,
              order,
            });
            await sendEmail({
              to: orderOwner.email,
              subject: receiptEmail.subject,
              text: receiptEmail.text,
              html: receiptEmail.html,
              attachments: receiptEmail.attachments,
            });
          }
        }
      } catch (sideEffectErr) {
        console.warn('[orders/updateOrderStatus] background side effects failed:', sideEffectErr?.message || sideEffectErr);
      }
    })();

    return;
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: {} });
  }
};

module.exports = { createOrder, getMyOrders, getOrderById, getAllOrders, updateOrderStatus };
