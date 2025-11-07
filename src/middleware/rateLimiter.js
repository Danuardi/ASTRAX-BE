// simple in-memory rate limiter per IP for demo purposes
// Not suitable for multi-instance production.

const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_MAX = 20; // 20 requests per window

const stores = new Map();

function rateLimiter(options = {}) {
  const windowMs = options.windowMs || DEFAULT_WINDOW_MS;
  const max = options.max || DEFAULT_MAX;

  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    let entry = stores.get(key);
    if (!entry || now - entry.start > windowMs) {
      entry = { start: now, count: 0 };
      stores.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.set('Retry-After', Math.ceil((entry.start + windowMs - now) / 1000));
      return res.status(429).json({ error: 'Too many requests' });
    }
    next();
  };
}

module.exports = rateLimiter;
