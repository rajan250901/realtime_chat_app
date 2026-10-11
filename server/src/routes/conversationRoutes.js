const express = require("express");

// const authMiddleware = require("../middleware/authMiddleware");
const authMiddleware = require("../middleware/authMiddleware");

const {
    getUserConversations,createDirectConversation
} = require("../controllers/conversationController");

const router = express.Router();

router.get("/", authMiddleware, getUserConversations);


router.post(
    "/direct",
    authMiddleware,
    createDirectConversation
);

module.exports = router;