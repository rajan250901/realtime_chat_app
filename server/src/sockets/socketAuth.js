
const jwt = require("jsonwebtoken");

const socketAuth = (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Authentication token is required"));
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET_KEY
    );

    if (!decoded.id) {
      return next(new Error("JWT must contain the user ID"));
    }

    socket.user = decoded;

    next();
  } catch (error) {
    console.error("Socket authentication failed:", error.message);
    next(new Error("Invalid or expired socket token"));
  }
};

module.exports = socketAuth;
