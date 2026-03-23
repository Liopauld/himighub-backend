const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const { hasCloudinaryConfig } = require('../utils/cloudinaryService');

const collectedRevenueMatch = {
  status: { $ne: 'Cancelled' },
  $or: [
    { paymentMethod: 'COD', status: 'Delivered' },
    { paymentMethod: { $ne: 'COD' }, isPaid: true },
  ],
};

const getAnalytics = async (req, res) => {
  try {
    const [
      totalOrders,
      totalUsers,
      activeUsers,
      totalProducts,
      revenueAgg,
      orderStatusAgg,
      topProductsAgg,
      monthlySalesAgg,
    ] = await Promise.all([
      Order.countDocuments(),
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      Product.countDocuments(),
      Order.aggregate([
        { $match: collectedRevenueMatch },
        { $group: { _id: null, revenue: { $sum: '$totalPrice' } } },
      ]),
      Order.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: collectedRevenueMatch },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.product',
            name: { $first: '$items.name' },
            sold: { $sum: '$items.quantity' },
            revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          },
        },
        { $sort: { sold: -1 } },
        { $limit: 8 },
      ]),
      Order.aggregate([
        { $match: collectedRevenueMatch },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
            },
            orders: { $sum: 1 },
            revenue: { $sum: '$totalPrice' },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
    ]);

    const totalRevenue = revenueAgg[0]?.revenue || 0;
    const inactiveUsers = totalUsers - activeUsers;

    const monthlySales = monthlySalesAgg.slice(-6).map((entry) => ({
      label: `${String(entry._id.month).padStart(2, '0')}/${String(entry._id.year).slice(-2)}`,
      orders: entry.orders,
      revenue: entry.revenue,
    }));

    return res.status(200).json({
      success: true,
      message: '',
      data: {
        summary: {
          totalRevenue,
          totalOrders,
          totalUsers,
          activeUsers,
          inactiveUsers,
          totalProducts,
        },
        orderStatus: orderStatusAgg.map((s) => ({ status: s._id, count: s.count })),
        topProducts: topProductsAgg.map((p) => ({
          productId: p._id,
          name: p.name,
          sold: p.sold,
          revenue: p.revenue,
        })),
        monthlySales,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: {} });
  }
};

const getUploadDiagnostics = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: '',
      data: {
        cloudinary: {
          enabled: hasCloudinaryConfig,
          cloudName: process.env.CLOUDINARY_CLOUD_NAME || null,
          apiKeySuffix: process.env.CLOUDINARY_API_KEY
            ? String(process.env.CLOUDINARY_API_KEY).slice(-4)
            : null,
        },
        uploadLimits: {
          maxFileSizeMB: 15,
          maxFilesPerRequest: 6,
        },
        hints: {
          productUploadEndpoint: '/api/products (POST) or /api/products/:id (PUT), field name: images',
          profileUploadEndpoint: '/api/users/profile (PUT), field name: avatar',
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: {} });
  }
};

module.exports = { getAnalytics, getUploadDiagnostics };