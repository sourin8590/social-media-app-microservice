// routes/postRoutes.js
const express = require("express");
const rateLimiter = require("../middleware/rateLimiter");
const {createPost, deletePost, getAllPost, getSinglePost} = require("../controllers/postController")

const router = express.Router();

// Create limiters inside middleware functions that use req.redisClient
const createPostLimiter = (req, res, next) =>
  rateLimiter({
    storeClient: req.redisClient,  // ✅ uses redisClient from req
    keyPrefix: "post:create",
    points: 2,
    duration: 60,
  })(req, res, next);

const deletePostLimiter = (req, res, next) =>
  rateLimiter({
    storeClient: req.redisClient,
    keyPrefix: "post:delete",
    points: 10,
    duration: 60,
  })(req, res, next);

const getAllPostsLimiter = (req, res, next) =>
  rateLimiter({
    storeClient: req.redisClient,
    keyPrefix: "post:getall",
    points: 30,
    duration: 60,
  })(req, res, next);

const getSinglePostLimiter = (req, res, next) =>
  rateLimiter({
    storeClient: req.redisClient,
    keyPrefix: "post:get",
    points: 60,
    duration: 60,
  })(req, res, next);

// Routes
router.post("/create-post", createPostLimiter, createPost);

router.delete("/:id", deletePostLimiter, deletePost);

router.get("/all-posts", getAllPostsLimiter, getAllPost);

router.get("/:id", getSinglePostLimiter, getSinglePost);

module.exports = router;
