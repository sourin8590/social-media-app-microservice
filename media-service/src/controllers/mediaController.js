const Media = require("../models/media");
const { uploadMediaToCloudinary } = require("../utils/cloudinary");
const logger = require("../utils/logger");

const uploadMedia = async (req, res) => {
  logger.info("Starting media upload...");
  try {
    if (!req.file) {
      logger.error("No file found, please add a file and try again!");
      return res.status(401).json({
        success: false,
        message: "No file found, please add a file and try again!",
      });
    }

    const { originalname, mimetype, buffer } = req.file;
    const userId = req.user.userId;

    logger.info(`File details: name=${originalname}, type=${mimetype}`);
    logger.info(`Uploading to cloudinary starting...`);
    const cloudinaryUploadResult = await uploadMediaToCloudinary(req.file);
    logger.info(
      `Cloudinary upload successful. Public Id: ${cloudinaryUploadResult.public_id}`
    );

    const newlyCreatedMedia = new Media({
      publicId: cloudinaryUploadResult.public_id,
      url: cloudinaryUploadResult.secure_url,
      originalname,
      mimetype,
      userId,
    });

    await newlyCreatedMedia.save();

    res.status(201).json({
      success: true,
      mediaId: newlyCreatedMedia._id,
      url: newlyCreatedMedia.url,
      message: "Media upload is successful",
    });
  } catch (error) {
    logger.error("Error uploading file", error);
    res.status(500).json({
      success: false,
      message: "Error uploading file",
    });
  }
};

const getAllMedia = async (req, res) => {
  try {
    const result = await Media.find({});
    return res.json({
      result,
    });
  } catch (error) {
    logger.error("Error fetching medias", error);
    res.status(500).json({
      success: false,
      message: "Error fetching medias",
    });
  }
};

module.exports = { uploadMedia, getAllMedia };
