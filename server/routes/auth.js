import express from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { signToken } from '../utils/tokens.js';
import { requireAuth } from '../middleware/auth.js';
import { callAiService } from '../utils/ai.js';

const router = express.Router();

router.post('/signup', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const images = Array.isArray(req.body?.images) ? req.body.images.filter(Boolean) : [];

    console.log(`[AUTH-SIGNUP] New signup request for: ${email}`);

    if (!name || !email || !password) return res.status(400).json({ error: 'missing_fields' });
    if (password.length < 6) return res.status(400).json({ error: 'weak_password' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'email_in_use' });

    const passwordHash = await bcrypt.hash(password, 10);
    
    // Process face embeddings
    const facePhotos = Array.isArray(req.body?.facePhotos) ? req.body.facePhotos : [];
    console.log(`[AUTH-SIGNUP] Face photos received count: ${facePhotos.length}`);
    
    let faceEmbeddings = [];
    if (facePhotos.length > 0) {
      try {
        console.log(`[AUTH-SIGNUP] Calling AI Service (face_embeddings_batch)...`);
        const result = await callAiService('face_embeddings_batch', { paths: facePhotos });
        
        if (result.embeddings && result.embeddings.length > 0) {
          faceEmbeddings = result.embeddings;
          console.log(`[AUTH-SIGNUP] Successfully captured ${faceEmbeddings.length} embeddings.`);
        } else {
          console.warn(`[AUTH-SIGNUP] WARNING: AI service returned zero embeddings.`);
        }
      } catch (err) {
        console.error(`[AUTH-SIGNUP-ERROR] AI Service call failed:`, err);
      }
    } else {
      console.warn(`[AUTH-SIGNUP] WARNING: No facePhotos in request body.`);
    }

    const user = await User.create({ name, email, passwordHash, images, faceEmbeddings });
    console.log(`[AUTH-SIGNUP] User created. FaceEmbeddings field size: ${user.faceEmbeddings.length}`);

    const token = signToken({ userId: user._id, email: user.email });
    res.status(201).json({ token, user: user.toSafeJSON() });
  } catch (err) {
    console.error(`[AUTH-SIGNUP-CRITICAL]:`, err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) return res.status(400).json({ error: 'missing_fields' });

  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: 'invalid_credentials' });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

  const token = signToken({ userId: user._id, email: user.email });
  res.json({ token, user: user.toSafeJSON() });
});

router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: req.user.toSafeJSON() });
});

router.post('/enroll-face', requireAuth, async (req, res) => {
  const { facePhotos } = req.body;
  if (!facePhotos || !Array.isArray(facePhotos)) return res.status(400).json({ error: 'facePhotos_required' });

  try {
    console.log(`[AUTH-ROUTE] Enrolling faces for user: ${req.user.email}`);
    const result = await callAiService('face_embeddings_batch', { paths: facePhotos });
    if (result.embeddings) {
      req.user.faceEmbeddings = result.embeddings;
      await req.user.save();
      console.log(`[AUTH-ROUTE] Successfully enrolled ${result.embeddings.length} embeddings.`);
      return res.json({ success: true, count: result.embeddings.length });
    }
    res.status(400).json({ error: 'failed_to_generate_embeddings' });
  } catch (err) {
    console.error(`[AUTH-ROUTE-ERROR] enroll-face:`, err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
