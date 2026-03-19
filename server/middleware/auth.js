import { verifyToken } from '../utils/tokens.js';
import { User } from '../models/User.js';

export async function requireAuth(req, res, next) {
  try {
    const raw = req.headers.authorization || '';
    const token = raw.startsWith('Bearer ') ? raw.slice('Bearer '.length) : null;
    if (!token) return res.status(401).json({ error: 'unauthorized' });

    const decoded = verifyToken(token);
    const userId = decoded?.sub;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ error: 'unauthorized' });

    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'unauthorized' });
  }
}

