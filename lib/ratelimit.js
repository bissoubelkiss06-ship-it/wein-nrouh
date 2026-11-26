'use strict';

function createLimiter(options) {
  const windowMs = options.windowMs;
  const max = options.max;
  const hits = new Map();

  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.reset <= now) hits.delete(key);
    }
  }, Math.min(windowMs, 60 * 1000));
  timer.unref();

  return function limiter(req, res, next) {
    const key = req.ip || 'unknown';
    const now = Date.now();
    let entry = hits.get(key);

    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.reset - now) / 1000)));
      return res.status(429).json({
        ok: false,
        message: 'أرسلت عددا كبيرا من الرسائل. حاول مجددا بعد بضع دقائق.'
      });
    }
    next();
  };
}

module.exports = { createLimiter };
