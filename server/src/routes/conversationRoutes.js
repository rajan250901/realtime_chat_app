const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
    getUserConversations,
    createDirectConversation,
    createGroup,
    getConversation,
    renameGroup,
    deleteGroup,
    removeMember,
    promoteMember,
    demoteMember,
    transferOwnership,
} = require("../controllers/conversationController");

const router = express.Router();

router.get("/", authMiddleware, getUserConversations);

router.post("/", authMiddleware, createGroup);

router.post("/direct", authMiddleware, createDirectConversation);

router.get("/:id", authMiddleware, getConversation);

router.put("/:id", authMiddleware, renameGroup);

router.delete("/:id", authMiddleware, deleteGroup);

router.delete("/:id/members/:userId", authMiddleware, removeMember);

router.put("/:id/members/:userId/promote", authMiddleware, promoteMember);

router.put("/:id/members/:userId/demote", authMiddleware, demoteMember);

router.put(
    "/:id/members/:userId/transfer-ownership",
    authMiddleware,
    transferOwnership,
);

module.exports = router;
