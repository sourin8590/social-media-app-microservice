const logger = require("../utils/logger");
const { validateRegistration, validateLogin } = require("../utils/validation");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const RefreshToken = require("../models/RefreshToken");

// user registration
const registerUser = async (req, res) => {
  logger.info("Registration endpoint hit...");
  try {
    const { error } = validateRegistration(req.body);

    if (error) {
      logger.warn(`Validation error ${error.details[0].message}`);
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const { email, password, username } = req.body;

    let user = await User.findOne({
      $or: [{ email: email }, { username: username }],
    });

    // console.log("asdsadsadiowqdnoandoisd============================");

    if (user) {
      logger.warn("User already exists");
      return res.status(400).json({
        success: false,
        message: "User already exits",
      });
    }

    user = new User({ username, email, password });
    await user.save();

    logger.warn("User saved successfully", user._id);

    const { accessToken, refreshToken } = await generateToken(user);

    return res.status(200).json({
      success: true,
      message: "User registered successfully",
      accessToken,
      refreshToken,
    });
  } catch (error) {
    logger.warn("Registration error occured here", e);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// user login
const loginUser = async (req, res) => {
  logger.info("Login endpoint hit...");
  try {
    const { error } = validateLogin(req.body);
    if (error) {
      logger.warn(`Validation error ${error.details[0].message}`);
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      logger.warn("Invalid user");
      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      logger.warn("Invalid password");
      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const { accessToken, refreshToken } = await generateToken(user);

    return res.json({
      accessToken,
      refreshToken,
      userId: user._id,
    });
  } catch (error) {
    logger.error("Login error occurred:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// refresh token
const refreshTokenUser = async (req, re) => {
  logger.info("Refresh token endpoint hit...");
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      logger.warn("Refresh Token missing");
      return res.status(400).json({
        success: false,
        message: "Refresh Token missing",
      });
    }

    const storedToken = await RefreshToken.findOne({ refreshToken });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      logger.warn("Invalid or expired refresh token");
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token",
      });
    }

    const user = await User.findById(storedToken.user);

    if (!user) {
      logger.warn("User not found");
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
      await generateToken(user);

    await RefreshToken.deleteOne({ _id: storedToken._id });

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    logger.error("RefreshToken endpoint error occurred:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// logout
const logOutUser = async (req, res) => {
  logger.info("Logout endpoint hit...");
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      logger.warn("Refresh Token missing");
      return res.status(400).json({
        success: false,
        message: "Refresh Token missing",
      });
    }

    await RefreshToken.deleteOne({ token: refreshToken });

    logger.info("Refresh Token deleted for logout");
    return res.json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    logger.error("Logout while logging out", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
module.exports = { registerUser, loginUser, refreshTokenUser, logOutUser };
