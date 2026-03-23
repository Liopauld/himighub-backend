const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];

  const mime = String(file.mimetype || '').toLowerCase();
  const ext = path.extname(String(file.originalname || '')).toLowerCase();

  const mimeAllowed = allowedMimes.includes(mime);
  const genericImageMime = mime.startsWith('image/');
  const extensionAllowed = allowedExtensions.includes(ext);
  const mobileGenericMime = mime === 'application/octet-stream' || mime === 'binary/octet-stream';

  if (mimeAllowed || genericImageMime || (mobileGenericMime && extensionAllowed)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, WebP, HEIC, and HEIF images are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024, files: 5 },
});

module.exports = upload;
