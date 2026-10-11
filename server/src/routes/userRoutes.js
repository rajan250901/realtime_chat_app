
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const {
  getCurrentUser,
  searchUsersController,
} = require("../controllers/userController");

router.get("/me", authMiddleware, getCurrentUser);
router.get("/search", authMiddleware, searchUsersController);

module.exports = router;
