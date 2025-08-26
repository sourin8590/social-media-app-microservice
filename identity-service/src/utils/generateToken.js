const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const RefreshToken = require("../models/RefreshToken");

const generateToken = async (user) => {
  const accessToken = jwt.sign(
    {
      userId: user._id,
      username: user.username,
    },
    process.env.JWT_SECRET,
    { expiresIn: "60min" }
  );

  const refreshToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date();

  expiresAt.setDate(expiresAt.getDate() + 7); // refresh token expires in 7days
  await RefreshToken.create({
    token: refreshToken,
    user: user._id,
    expiresAt: expiresAt,
  });

  return { accessToken, refreshToken };
};

module.exports = generateToken;
