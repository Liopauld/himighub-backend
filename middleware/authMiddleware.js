const jwt = require('jsonwebtoken');
const User = require('../models/User');

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided', data: {} });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('isActive role');
    if (!user || !user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated', data: {} });
    }
    req.user = decoded;
    req.user.role = user.role;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token', data: {} });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ success: false, message: 'Admin access required', data: {} });
};

module.exports = { verifyToken, isAdmin };
