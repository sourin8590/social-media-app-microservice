require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const dbConnect = require("./utils/dbConnect");
const mediaRoute = require("./routes/mediaRoute");
const errorHandler = require("./middleware/errorHandler");
const logger = require("./utils/logger");
const { connectToRabbitMQ, consumeEvent } = require("./utils/rabbitmq");
const { handlePostDeleted } = require("./eventHandlers/media-event-handlers");
const Redis = require("ioredis");

const app = express();
const PORT = process.env.PORT || 3003;

// db connect
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

// TODO --> IP based rate limiting for sensitive end points

app.use(
  "/api/media",
  (req, res, next) => {
    req.redisClient = redisClient;
    next();
  },
  mediaRoute
);

app.use(errorHandler);

async function startServer() {
  try {
    await connectToRabbitMQ();

    // consume all event
    await consumeEvent("post.deleted", handlePostDeleted);

    app.listen(PORT, () => {
      logger.info(`✅ Media service is running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to connect to server");
    process.exit(1);
  }
}

startServer();

app.listen(PORT, () => {
  logger.info(`✅ Post service is running on port ${PORT}`);
});

// uncaught exceptions (optional)
process.on("unhandledRejection", (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${(promise, reason)}`);
});
