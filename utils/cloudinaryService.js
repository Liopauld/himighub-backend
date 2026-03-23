const fs = require('fs');
const { v2: cloudinary } = require('cloudinary');

const hasCloudinaryConfig = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (hasCloudinaryConfig) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  console.log('[Cloudinary] Enabled', {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKeySuffix: String(process.env.CLOUDINARY_API_KEY).slice(-4),
  });
} else {
  console.warn('[Cloudinary] Disabled: missing CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET');
}

const safeUnlink = (filePath) => {
  if (!filePath) return;
  fs.unlink(filePath, () => {});
};

const CLOUDINARY_UPLOAD_TIMEOUT_MS = 30000;

const uploadImageFromPath = async (filePath, folder = 'himighub') => {
  if (!filePath) return null;
  if (!hasCloudinaryConfig) return null;

  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: 'image',
      timeout: CLOUDINARY_UPLOAD_TIMEOUT_MS,
    });

    console.log('[Cloudinary] Upload success', {
      folder,
      publicId: result.public_id,
      secureUrlHost: result.secure_url ? new URL(result.secure_url).host : null,
    });

    safeUnlink(filePath);
    return result.secure_url;
  } catch (err) {
    console.warn('[Cloudinary] Upload failed, falling back to local upload URL:', err?.message || err);
    return null;
  }
};

const extractCloudinaryPublicId = (assetUrl) => {
  if (!assetUrl || typeof assetUrl !== 'string') return null;

  const withoutQuery = assetUrl.split('?')[0];
  const match = withoutQuery.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z0-9]+$/i);
  return match?.[1] || null;
};

const deleteCloudinaryImageByUrl = async (assetUrl) => {
  if (!hasCloudinaryConfig) return { deleted: false, reason: 'cloudinary-disabled' };

  const publicId = extractCloudinaryPublicId(assetUrl);
  if (!publicId) return { deleted: false, reason: 'invalid-cloudinary-url' };

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image',
      invalidate: true,
    });

    return { deleted: result?.result === 'ok', result: result?.result || 'unknown', publicId };
  } catch (err) {
    console.warn('[Cloudinary] Delete failed', {
      publicId,
      message: err?.message || err,
    });
    return { deleted: false, reason: err?.message || 'delete-failed', publicId };
  }
};

module.exports = {
  hasCloudinaryConfig,
  uploadImageFromPath,
  deleteCloudinaryImageByUrl,
};
