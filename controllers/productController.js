const Product = require('../models/Product');
const { hasCloudinaryConfig, uploadImageFromPath } = require('../utils/cloudinaryService');

const toNumber = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const toBoolean = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(lowered)) return true;
    if (['false', '0', 'no', 'off'].includes(lowered)) return false;
  }
  return undefined;
};

const parseSizes = (rawSizes) => {
  if (rawSizes === undefined || rawSizes === null || rawSizes === '') return undefined;
  if (Array.isArray(rawSizes)) return rawSizes;
  if (typeof rawSizes === 'string') {
    try {
      const parsed = JSON.parse(rawSizes);
      return Array.isArray(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
};

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
    const sizes = parseSizes(rawSizes) || [];

    const images = [];
    console.log('[products/create] upload payload', {
      filesCount: Array.isArray(req.files) ? req.files.length : 0,
      cloudinaryEnabled: hasCloudinaryConfig,
    });
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

    console.log('[products/create] image sources', {
      count: images.length,
      cloudinaryUrls: images.filter((u) => /^https:\/\/res\.cloudinary\.com\//i.test(u)).length,
    });

    const product = await Product.create({
      name,
      description,
      price: toNumber(price),
      originalPrice: toNumber(originalPrice) ?? null,
      discountPercent: toNumber(discountPercent) ?? 0,
      category,
      stock: toNumber(stock),
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

    if (req.body.name !== undefined) product.name = req.body.name;
    if (req.body.description !== undefined) product.description = req.body.description;
    if (req.body.category !== undefined) product.category = req.body.category;
    if (req.body.brand !== undefined) product.brand = req.body.brand;

    const parsedPrice = toNumber(req.body.price);
    if (parsedPrice !== undefined) product.price = parsedPrice;

    const parsedOriginalPrice = toNumber(req.body.originalPrice);
    if (req.body.originalPrice !== undefined) {
      product.originalPrice = parsedOriginalPrice === undefined ? null : parsedOriginalPrice;
    }

    const parsedDiscount = toNumber(req.body.discountPercent);
    if (parsedDiscount !== undefined) product.discountPercent = parsedDiscount;

    const parsedStock = toNumber(req.body.stock);
    if (parsedStock !== undefined) product.stock = parsedStock;

    const parsedIsAvailable = toBoolean(req.body.isAvailable);
    if (parsedIsAvailable !== undefined) product.isAvailable = parsedIsAvailable;

    const rawSizes = req.body.sizes ?? req.body['sizes[]'];
    const parsedSizes = parseSizes(rawSizes);
    if (parsedSizes !== undefined) {
      product.sizes = parsedSizes;
    }

    if (req.files && req.files.length > 0) {
      console.log('[products/update] upload payload', {
        productId: req.params.id,
        filesCount: req.files.length,
        cloudinaryEnabled: hasCloudinaryConfig,
      });
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
      product.images = [...(product.images || []), ...newImages];

      console.log('[products/update] image sources', {
        productId: req.params.id,
        newCount: newImages.length,
        cloudinaryUrls: newImages.filter((u) => /^https:\/\/res\.cloudinary\.com\//i.test(u)).length,
      });
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
