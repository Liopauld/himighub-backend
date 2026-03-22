const Product = require('../models/Product');
const { hasCloudinaryConfig, uploadImageFromPath } = require('../utils/cloudinaryService');

// GET /api/products
const getProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    const query = { isAvailable: true };

    if (req.query.search) {
      const regex = new RegExp(req.query.search, 'i');
      query.$or = [{ name: regex }, { description: regex }];
    }

    if (req.query.category) {
      query.category = new RegExp(`^${req.query.category}$`, 'i');
    }

    if (req.query.minPrice || req.query.maxPrice) {
      query.price = {};
      if (req.query.minPrice) query.price.$gte = parseFloat(req.query.minPrice);
      if (req.query.maxPrice) query.price.$lte = parseFloat(req.query.maxPrice);
    }

    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: '',
      data: { products, total, page, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: {} });
  }
};

// GET /api/products/:id
const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate({
      path: 'createdBy',
      select: 'name',
    });

    if (!product || !product.isAvailable) {
      return res.status(404).json({ success: false, message: 'Product not found', data: {} });
    }

    return res.status(200).json({ success: true, message: '', data: { product } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: {} });
  }
};

// POST /api/products  (admin)
const createProduct = async (req, res) => {
  try {
    const {
      name, description, price, originalPrice,
      category, stock, brand, discountPercent,
    } = req.body;

    const rawSizes = req.body.sizes ?? req.body['sizes[]'];
    const sizes = rawSizes
      ? (Array.isArray(rawSizes) ? rawSizes : JSON.parse(rawSizes))
      : [];

    const images = [];
    if (req.files && req.files.length > 0) {
      for (const f of req.files) {
        if (hasCloudinaryConfig) {
          const uploadedUrl = await uploadImageFromPath(f.path, 'himighub/products');
          if (uploadedUrl) {
            images.push(uploadedUrl);
            continue;
          }
        }
        images.push(`${req.protocol}://${req.get('host')}/uploads/${f.filename}`);
      }
    }

    const product = await Product.create({
      name,
      description,
      price: parseFloat(price),
      originalPrice: originalPrice ? parseFloat(originalPrice) : null,
      discountPercent: discountPercent ? parseFloat(discountPercent) : 0,
      category,
      stock: parseInt(stock),
      brand,
      sizes,
      images,
      createdBy: req.user.id,
    });

    return res.status(201).json({ success: true, message: 'Product created', data: { product } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: {} });
  }
};

// PUT /api/products/:id  (admin)
const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found', data: {} });

    const fields = ['name', 'description', 'price', 'originalPrice', 'discountPercent', 'category', 'stock', 'brand', 'isAvailable'];
    fields.forEach((field) => {
      if (req.body[field] !== undefined) product[field] = req.body[field];
    });

    const rawSizes = req.body.sizes ?? req.body['sizes[]'];
    if (rawSizes) {
      product.sizes = Array.isArray(rawSizes) ? rawSizes : JSON.parse(rawSizes);
    }

    if (req.files && req.files.length > 0) {
      const newImages = [];
      for (const f of req.files) {
        if (hasCloudinaryConfig) {
          const uploadedUrl = await uploadImageFromPath(f.path, 'himighub/products');
          if (uploadedUrl) {
            newImages.push(uploadedUrl);
            continue;
          }
        }
        newImages.push(`${req.protocol}://${req.get('host')}/uploads/${f.filename}`);
      }
      product.images = [...product.images, ...newImages];
    }

    await product.save();

    return res.status(200).json({ success: true, message: 'Product updated', data: { product } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: {} });
  }
};

// DELETE /api/products/:id  (admin)
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found', data: {} });

    product.isAvailable = false;
    await product.save();

    return res.status(200).json({ success: true, message: 'Product removed', data: {} });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: {} });
  }
};

// PUT /api/products/:id/stock  (admin)
const restockProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found', data: {} });

    const stock = parseInt(req.body.stock);
    if (isNaN(stock) || stock < 0) {
      return res.status(400).json({ success: false, message: 'Invalid stock value', data: {} });
    }

    product.stock = stock;
    await product.save();

    return res.status(200).json({ success: true, message: 'Stock updated', data: { stock: product.stock } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: {} });
  }
};

module.exports = { getProducts, getProductById, createProduct, updateProduct, deleteProduct, restockProduct };
