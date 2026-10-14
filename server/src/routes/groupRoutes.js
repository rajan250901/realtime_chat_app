const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const controller = require("../controllers/groupController");

const router = express.Router();
router.post("/", authMiddleware, controller.createGroup);
router.get("/:id", authMiddleware, controller.getGroupDetails);
router.put("/:id", authMiddleware, controller.updateGroup);
router.delete("/:id", authMiddleware, controller.deleteGroup);
router.post("/:id/members", authMiddleware, controller.addMembers);
router.delete("/:id/members/:userId", authMiddleware, controller.removeMember);
router.patch("/:id/members/:userId/role", authMiddleware, controller.updateRole);
router.post("/:id/transfer-owner", authMiddleware, controller.transferOwner);

module.exports = router;
