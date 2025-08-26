const Search = require("../models/search");
const logger = require("../utils/logger");

const handlePostCreated = async (event) => {
  try {
    const newSearchPost = new Search({
      postId: event.postId.toString(),
      content: event.content,
      userId: event.userId.toString(),
      createdAt: event.createdAt,
    });

    await newSearchPost.save();

    logger.info(`Search post created ${event.postId}, ${newSearchPost._id}`);
  } catch (error) {
    logger.error("Error handling post creation event");
  }
};

const handlePostDeleted = async (event) => {
  try {
    await Search.findOneAndDelete({ postId: event.postId });
    logger.info(`Search post deleted ${event.postId}`);

  } catch (error) {
    logger.error("Error handling post deletion event");
  }
};

module.exports = { handlePostCreated, handlePostDeleted };
