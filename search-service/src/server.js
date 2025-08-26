const express = require("express");
require("dotenv").config();
const cors = require("cors");
const helmet = require("helmet");
const errorHandler = require("./middleware/errorHandler");
const logger = require("./utils/logger");
const dbConnect = require("./utils/dbConnect");
const { connectToRabbitMQ, consumeEvent } = require("./utils/rabbitmq");
const searchRoutes = require("./routes/searchRoutes");
const Redis = require("ioredis");

const {
  handlePostCreated,
  handlePostDeleted,
} = require("./eventHandler/searchEventHandler");

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

// TODO --> IP based rate limiting (Done in route file)
// TODO --> Redis caching (pass redis client as part of request and then implement redis caching(for 2-5 mins))
app.use(
  "/api/search",
  (req, res, next) => {
    req.redisClient = redisClient;
    next();
  },
  searchRoutes
);

app.use(errorHandler);

async function startServer() {
  try {
    await connectToRabbitMQ();
    // cosume events or subscribe event

    await consumeEvent("post.created", handlePostCreated);
    await consumeEvent("post.deleted", handlePostDeleted);

    app.listen(PORT, () => {
      logger.info(`✅ Search service is running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to start search service", error);
    process.exit(1);
  }
}

startServer();
