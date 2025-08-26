const express = require("express");
const { authenticateRequest } = require("../middleware/authMiddleware");
const { searchPostController } = require("../controllers/searchController");
const rateLimiter = require("../middleware/rateLimiter")


const router = express.Router();

const searchingLimit = (req, res, next) =>
  rateLimiter({
    storeClient: req.redisClient, // ✅ uses redisClient from req
    keyPrefix: "media:search",
    points: 10,
    duration: 60,
  })(req, res, next);


router.use(authenticateRequest);

router.get("/posts", searchingLimit, searchPostController);

module.exports = router;
