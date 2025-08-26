const mongoose = require("mongoose");
const logger = require("./logger");

const connectDB = () => {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
      logger.info("MongoDB connected");
    })
    .catch((e) => {
      logger.warn("DB connection Error", e);
    });
};

module.exports = connectDB