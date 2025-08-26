// middleware/rateLimiter.js
const { RateLimiterRedis } = require("rate-limiter-flexible");

const rateLimiter = (opts) => {
  const limiter = new RateLimiterRedis(opts);

  return async (req, res, next) => {
    try {
      // Use userId if available (auth middleware sets it), otherwise fallback to IP
      const key = req.user?.userId || req.ip;

      await limiter.consume(key);  // try to "spend" a point

      return next();               // ✅ must call next() to continue
    } catch (err) {
      // ✅ must send a response when rate limit is exceeded
      return res.status(429).json({
        success: false,
        message: "Too many requests",
        retryAfter: Math.ceil(err.msBeforeNext / 1000) || 1,
      });
    }
  };
};

module.exports = rateLimiter;
