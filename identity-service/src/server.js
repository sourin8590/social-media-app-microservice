const express = require("express");
const connectDB = require("./utils/dbConnect");
require("dotenv").config();
const helmet = require("helmet");
const cors = require("cors");
const logger = require("./utils/logger");
const { RateLimiterRedis } = require("rate-limiter-flexible");
const Redis = require("ioredis");
const { rateLimit } = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const routes = require("./routes/identityService");
const errorHandler = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 3001;

// connect to DB
connectDB();

const redisClient = new Redis(process.env.REDIS_URL);

// middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  logger.info(`Received ${req.method} request to ${req.url}`);
  if (req.body && Object.keys(req.body).length > 0) {
    logger.info(`Request Body: ${JSON.stringify(req.body)}`);
  }
  next();
});

// DDoS protection and rate limiting
const rateLimitor = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: "middleware",
  points: 10,
  duration: 1,
});

app.use((req, res, next) => {
  rateLimitor
    .consume(req.ip)
    .then(() => next())
    .catch((e) => {
      logger.warn(`Rate limit exceeded for ip ${req.ip}`);
      res.status(429).json({ success: false, message: "Too many request" });
    });
});

// IP-based rate-limiting for sensitive endpoints
const sensitiveEndpointLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Sensitive endpoint rate limit exceeded for IP ${req.ip}`);
    res.status(429).json({
      success: false,
      message: "Too many requests",
    });
  },
  store: new RedisStore({
    sendCommand: (...args) => redisClient.call(...args), // ✅ works with ioredis
  }),
});

// apply limiter to sensitive route
app.use("/api/auth/register", sensitiveEndpointLimiter);

// routes
app.use("/api/auth", routes);

// error handler
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`✅ Identity service is running on port ${PORT}`);
});

// unhandled promise rejection
process.on("unhandledRejection", (reason, promise) => {
  if (reason instanceof Error) {
    logger.error(`💥 Unhandled Rejection ${reason}`);
  } else {
    logger.error(`💥 Unhandled Rejection ${reason}`);
  }
});

// uncaught exceptions (optional)
process.on("unhandledRejection", (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${ promise, reason }`);
});
