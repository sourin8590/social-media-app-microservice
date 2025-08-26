require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Redis = require("ioredis");
const helment = require("helmet");
const { rateLimit } = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const logger = require("./utils/logger");
const proxy = require("express-http-proxy");
const errorHandler = require("./middleware/errorHandler");
const validateToken = require("./middleware/authMiddleware");

const app = express();
const PORT = process.env.PORT;

const redisClient = new Redis(process.env.REDIS_URL);

// middleware
app.use(helment());
app.use(cors());
app.use(express.json());

// rate limiting
const rateLimitOptions = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100, // maximum no of request
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

app.use(rateLimitOptions); // using the above rate limiting as middleware

app.use((req, res, next) => {
  logger.info(`Received ${req.method} request to ${req.url}`);
  if (req.body && Object.keys(req.body).length > 0) {
    logger.info(`Request Body: ${JSON.stringify(req.body)}`);
  }
  next();
});

// creating proxy for redirecting to other services
const proxyOptions = {
  proxyReqPathResolver: (req) => {
    // Rewrite /v1/... → /api/...
    return req.originalUrl.replace(/^\/v1/, "/api");
  },

  proxyErrorHandler: (err, res, next) => {
    logger.error(`Proxy error: ${err.message}`);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: false,
        message: "Internal server error",
        error: err.message,
      })
    );
  },
};

// setting up proxy for our identity service
app.use(
  "/v1/auth",
  proxy(process.env.IDENTITY_SERVICE_URL, {
    ...proxyOptions,

    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.headers["content-type"] = "application/json";
      return proxyReqOpts;
    },

    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
      logger.info(
        `Response received from Identity service: ${proxyRes.statusCode}`
      );
      return proxyResData;
    },
  })
);

// setting up proxy for our post service
app.use(
  "/v1/posts",
  validateToken,
  proxy(process.env.POST_SERVICE_URL, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.headers["content-type"] = "application/json";
      proxyReqOpts.headers["x-user-id"] = srcReq.user.userId;

      return proxyReqOpts;
    },
    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
      logger.info(
        `Response received from Post service: ${proxyRes.statusCode}`
      );
      return proxyResData;
    },
  })
);

// setting up proxy for our media service
app.use(
  "/v1/media",
  validateToken,
  proxy(process.env.MEDIA_SERVICE_URL, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.headers["x-user-id"] = srcReq.user.userId;
      if (!srcReq.headers["content-type"].startsWith("multipart/form-data")) {
        proxyReqOpts.headers["content-type"] = "application/json";
      }

      return proxyReqOpts;
    },
    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
      logger.info(
        `Response received from Post service: ${proxyRes.statusCode}`
      );
      return proxyResData;
    },
    parseReqBody: false,
  })
);

// setting up proxy for our search service
app.use(
  "/v1/search",
  validateToken,
  proxy(process.env.SEARCH_SERVICE_URL, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.headers["content-type"] = "application/json";
      proxyReqOpts.headers["x-user-id"] = srcReq.user.userId;

      return proxyReqOpts;
    },
    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
      logger.info(
        `Response received from Post service: ${proxyRes.statusCode}`
      );
      return proxyResData;
    },
  })
);

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`API gateway is running on PORT: ${PORT}`);
  logger.info(
    `Identity service is running on PORT: 
    ${process.env.IDENTITY_SERVICE_URL}`
  );
  logger.info(
    `POST service is running on PORT: 
    ${process.env.POST_SERVICE_URL}`
  );
  logger.info(
    `MEDIA service is running on PORT: 
    ${process.env.MEDIA_SERVICE_URL}`
  );
  logger.info(
    `SEARCH service is running on PORT: 
    ${process.env.MEDIA_SERVICE_URL}`
  );
  logger.info(`Redis URL: ${process.env.REDIS_URL}`);
});
