const logger = require("../utils/logger");
const Search = require("../models/search");

async function invalidateSearchCache(req) {
  const keys = await req.redisClient.keys("search:*");
  if (keys.length > 0) {
    await req.redisClient.del(keys);
  }
}

const searchPostController = async (req, res) => {
  logger.info("Search endpoint hit...");
  try {
    const { query } = req.query;
    const cacheKey = `search:${query}:`

    const cachedSearch = await req.redisClient.get(cacheKey);
    if (cachedSearch) {
      return res.json(JSON.parse(cachedSearch));
    }

    const results = await Search.find(
      {
        $text: {
          $search: query,
        },
      },
      {
        score: { $meta: "textScore" },
      }
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(10);

    invalidateSearchCache(req);
    await req.redisClient.setex(cacheKey, 180, JSON.stringify(results));

    res.json(results);
  } catch (error) {
    logger.error("Error while searching post", error);
    res.status(500).json({
      success: false,
      message: "Error while searching post",
    });
  }
};

module.exports = { searchPostController };
