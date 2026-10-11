const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
    sendMessage,
    getMessages
} = require("../controllers/messageController");

const router = express.Router();


// Send message
router.post(
    "/",
    authMiddleware,
    sendMessage
);


// Get conversation messages
router.get(
    "/:conversationId",
    authMiddleware,
    getMessages
);


module.exports = router;