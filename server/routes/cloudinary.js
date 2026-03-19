import express from 'express';
import crypto from 'crypto';

const router = express.Router();

function getCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.cloud_name;
  const apiKey = process.env.CLOUDINARY_API_KEY || process.env.api_key;
  const apiSecret = process.env.CLOUDINARY_API_SECRET || process.env.api_secret;
  return { cloudName, apiKey, apiSecret };
}

function cloudinarySignature(params, apiSecret) {
  // Cloudinary signature is SHA1 of "key=value&key2=value2...{api_secret}"
  const keys = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && String(params[k]).length > 0)
    .sort();
  const toSign = keys.map((k) => `${k}=${params[k]}`).join('&') + apiSecret;
  return crypto.createHash('sha1').update(toSign).digest('hex');
}

router.post('/sign', async (req, res) => {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  if (!cloudName || !apiKey || !apiSecret) {
    return res.status(500).json({ error: 'cloudinary_not_configured' });
  }

  // Keep it tight: only sign a limited, safe set of params
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = String(req.body?.folder || 'chatbot-gallery').trim();

  const params = { timestamp, folder };
  const signature = cloudinarySignature(params, apiSecret);

  return res.json({
    cloudName,
    apiKey,
    timestamp,
    folder,
    signature,
  });
});

export default router;

