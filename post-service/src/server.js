const express = require("express");
require("dotenv").config();
const Redis = require("ioredis");
const cors = require("cors");
const helmet = require("helmet");
const postRoutes = require("./routes/postRoutes");
const errorHandler = require("./middleware/errorHandler");
const logger = require("./utils/logger");
const dbConnect = require("./utils/dbConnect");
const {
  authenticateRequest,
} = require("../../media-service/src/middleware/authMiddleware");
const { connectToRabbitMQ } = require("./utils/rabbitmq");

const app = express();
const PORT = process.env.PORT;

dbConnect();

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

// TODO --> IP based rate limiting
// It is done in routes file

// routes --> pass redisclient to routes for caching in controller file
app.use(
  "/api/posts",
  (req, res, next) => {
    req.redisClient = redisClient;
    next();
  },
  authenticateRequest,
  postRoutes
);

app.use(errorHandler);

async function startServer() {
  try {
    await connectToRabbitMQ();
    app.listen(PORT, () => {
      logger.info(`✅ Post service is running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to connect to server");
    process.exit(1);
  }
}

startServer();

// uncaught exceptions (optional)
process.on("unhandledRejection", (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${(promise, reason)}`);
});
