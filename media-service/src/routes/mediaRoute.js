const express = require("express");
const multer = require("multer");
const rateLimiter = require("../middleware/rateLimiter");
const { uploadMedia, getAllMedia } = require("../controllers/mediaController");
const { authenticateRequest } = require("../middleware/authMiddleware");
const logger = require("../utils/logger");

const router = express.Router();

const uploadImageLimiter = (req, res, next) =>
  rateLimiter({
    storeClient: req.redisClient, // ✅ uses redisClient from req
    keyPrefix: "post:create",
    points: 5,
    duration: 60,
  })(req, res, next);

// configure multer for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
}).single("file");

router.post(
  "/upload",
  authenticateRequest, // authentication middleware
  uploadImageLimiter, // middleware for rate limit
  (req, res, next) => {
    upload(req, res, function (err) {
      if (err instanceof multer.MulterError) {
        logger.error("Multer error while uploading", err);
        return res.status(400).json({
          message: "Multer error while uploading",
          error: err.message,
          stack: err.stack,
        });
      } else if (err) {
        logger.error("Unknown error occured while uploading", err);
        return res.status(500).json({
          message: "Unknown error occured while uploading",
          error: err.message,
          stack: err.stack,
        });
      }

      if (!req.file) {
        return res.status(400).json({
          message: "No file found",
        });
      }

      next();
    });
  },
  uploadMedia
);

router.get("/get", authenticateRequest, getAllMedia);


module.exports = router;
