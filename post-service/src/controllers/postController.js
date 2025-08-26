const Post = require("../models/post");
const logger = require("../utils/logger");
const { publishEvent } = require("../utils/rabbitmq");
const { validateCreatePost } = require("../utils/validation");

async function invalidatePostCache(req, input) {
  const keys = await req.redisClient.keys("posts:*");
  if (keys.length > 0) {
    await req.redisClient.del(keys);
  }

  const cacheKey = `posts:${input}`;
  await req.redisClient.del(cacheKey);
}

const createPost = async (req, res) => {
  logger.info("Create post endpoint hit....");
  try {
    const { error } = validateCreatePost(req.body);

    console.log(req.user.userId, "asdsadsadsa");

    if (error) {
      logger.warn(`Validation error ${error.details[0].message}`);
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const { content, mediaIds } = req.body;
    const newlyCreatePost = new Post({
      user: req.user.userId,
      content,
      mediaIds: mediaIds || [],
    });

    await newlyCreatePost.save();

    // publishing event to search service
    await publishEvent('post.created', {
      postId: newlyCreatePost._id.toString(),
      userId: newlyCreatePost.user.toString(),
      content: newlyCreatePost.content,
      createdAt: newlyCreatePost.createdAt
    })

    await invalidatePostCache(req, newlyCreatePost._id.toString());
    logger.info("Post created successfully");
    res.status(201).json({
      success: true,
      message: "Post created successfully",
    });
  } catch (error) {
    logger.error(`Error creating post ${error}`);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getAllPost = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const startIndex = (page - 1) * limit;

    const cacheKey = `posts:${page}:${limit}`;
    const cachedPosts = await req.redisClient.get(cacheKey);

    if (cachedPosts) {
      return res.json(JSON.parse(cachedPosts));
    }

    const posts = await Post.find({})
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit);

      // This is for getting the media details with the help of media ids the post schema

    const totalNoOfPost = await Post.countDocuments();
    const results = {
      posts,
      currentPage: page,
      totalPages: Math.ceil(totalNoOfPost / limit),
      totalPost: totalNoOfPost,
    };

    // save posts in redis cache for 5 min
    await req.redisClient.setex(cacheKey, 300, JSON.stringify(results));

    res.json(results);
  } catch (error) {
    logger.error(`Error fetching post ${error}`);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getSinglePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const cacheKey = `posts:${postId}`;

    const cachedPost = await req.redisClient.get(cacheKey);

    if (cachedPost) {
      return res.json(JSON.parse(cachedPost));
    }

    const singlePostById = await Post.findById(postId);

    if (!singlePostById) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // cache for 1 hour
    await req.redisClient.setex(cacheKey, 3600, JSON.stringify(singlePostById));

    res.json(singlePostById);
  } catch (error) {
    logger.error("Error fetching post", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const deletePost = async (req, res) => {
  try {
    const postId = req.params.id;

    const deletedPost = await Post.findOneAndDelete({
      _id: postId,
      user: req.user.userId,
    });
    if (!deletedPost) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // publish post delete method to the media service
    await publishEvent("post.deleted", {
      postId: deletedPost._id.toString(),
      userId: req.user.userId,
      mediaIds: deletedPost.mediaIds,
    });


    await invalidatePostCache(req, postId);

    res.status(200).json({
      success: true,
      message: "Post deleted Successfully",
    });
  } catch (error) {
    logger.error(`Error deleting post ${error}`);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = { createPost, getAllPost, getSinglePost, deletePost };
