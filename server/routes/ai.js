import express from 'express';
import { callAiService } from '../utils/ai.js';
import { User } from '../models/User.js';
import { Image } from '../models/Image.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/images', requireAuth, async (req, res) => {
  try {
    const images = await Image.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json({ images });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/face-embeddings', requireAuth, async (req, res) => {
  const { path } = req.body;
  if (!path) return res.status(400).json({ error: 'path_required' });
  try {
    console.log(`[AI-ROUTE] Generating face embeddings for path: ${path.substring(0, 50)}...`);
    const result = await callAiService('face_embeddings', { path });
    console.log(`[AI-ROUTE] Found ${result.embeddings?.length || 0} embeddings.`);
    res.json(result);
  } catch (err) {
    console.error(`[AI-ROUTE-ERROR] face-embeddings:`, err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/ingest', requireAuth, async (req, res) => {
  const { images } = req.body; // Array of { url, path }
  if (!images || !Array.isArray(images)) return res.status(400).json({ error: 'images_required' });

  const userId = req.user.id;
  try {
    console.log(`[AI-ROUTE] Starting ingestion for ${images.length} images...`);
    const user = await User.findById(userId);
    const batchResult = await callAiService('ingest_batch', {
      user_embeddings: user.faceEmbeddings,
      images: images.map(img => ({ url: img.url, path: img.path }))
    });

    const results = [];
    if (batchResult.results) {
      for (const res of batchResult.results) {
        if (!res.embedding) {
          console.warn(`[AI-ROUTE] No embedding generated for ${res.url}`);
          continue;
        }
        const newImage = await Image.create({
          url: res.url,
          userId,
          multimodalEmbedding: res.embedding,
          hasUserFace: res.is_match,
        });
        results.push(newImage);
        
        if (!user.images.includes(res.url)) {
          user.images.push(res.url);
        }
      }
      await user.save();
      console.log(`[AI-ROUTE] Successfully ingested ${results.length}/${images.length} images.`);
    }
    res.json({ count: results.length, images: results });
  } catch (err) {
    console.error(`[AI-ROUTE-ERROR] ingest:`, err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/query', requireAuth, async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query_required' });

  try {
    console.log(`[AI-CHAT] Processing query: "${query}"`);
    const userId = req.user.id;
    
    // 1. Detect intent
    const intentResult = await callAiService('detect_intent', { query });
    const isPersonal = intentResult.intent === 'personal';
    console.log(`[AI-CHAT] Detected Intent: ${isPersonal ? 'Personal' : 'General'}`);

    // 2. Get text embedding
    const textResult = await callAiService('text_embedding', { query });
    const textEmbedding = textResult.embedding;

    if (!textEmbedding) {
      console.warn(`[AI-CHAT] Failed to generate text embedding for query.`);
      return res.status(500).json({ error: 'failed_to_generate_text_embedding' });
    }

    // 3. Fetch images
    const filter = { userId };
    if (isPersonal) {
      filter.hasUserFace = true;
    }
    
    const count = await Image.countDocuments({ userId });
    console.log(`[AI-CHAT] User has ${count} total indexed images.`);
    
    let candidates = await Image.find(filter);
    console.log(`[AI-CHAT] Found ${candidates.length} candidates (personal filter: ${isPersonal}).`);

    let finalLabel = isPersonal ? 'personal' : 'general';

    // Fallback to general if personal query returns nothing
    if (isPersonal && candidates.length === 0) {
      console.log(`[AI-CHAT] Fallback to general search.`);
      candidates = await Image.find({ userId });
      finalLabel = 'general (fallback)';
    }

    if (candidates.length === 0) {
      return res.json({ results: [], intent: finalLabel, isPersonalQuery: isPersonal });
    }

    // 4. Similarity ranking
    const scored = candidates.map(img => {
      const v1 = textEmbedding;
      const v2 = img.multimodalEmbedding || [];
      if (v1.length !== v2.length) return { ...img.toObject(), score: 0 };
      
      let dot = 0;
      let m1 = 0;
      let m2 = 0;
      for (let i = 0; i < v1.length; i++) {
        dot += v1[i] * v2[i];
        m1 += v1[i] * v1[i];
        m2 += v2[i] * v2[i];
      }
      const score = dot / (Math.sqrt(m1) * Math.sqrt(m2) || 1);
      return { ...img.toObject(), score };
    });

    scored.sort((a, b) => b.score - a.score);
    
    // Balanced View: Show top 3 most similar matches for better variety
    const topResults = scored.slice(0, 3);
    
    console.log(`[AI-CHAT] Top Score: ${topResults[0]?.score?.toFixed(4) || 'N/A'}`);

    res.json({
      results: topResults,
      intent: finalLabel,
      isPersonalQuery: isPersonal
    });
  } catch (err) {
    console.error(`[AI-CHAT-ERROR] /query:`, err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/clear', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`[AI-ROUTE] Clearing AI index for user: ${userId}`);
    await Image.deleteMany({ userId });
    res.json({ success: true, message: 'AI index cleared.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
