const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const groupController = require("../controllers/groupController");

router.post("/", authMiddleware, groupController.create);

router.get("/:id", authMiddleware, groupController.info);

router.patch("/:id/name", authMiddleware, groupController.updateName);

router.post("/:id/members", authMiddleware, groupController.addMember);

router.delete(
    "/:id/members/:userId",
    authMiddleware,
    groupController.removeMember,
);

router.patch(
    "/:id/members/:userId/role",
    authMiddleware,
    groupController.changeRole,
);

router.post(
    "/:id/transfer-owner",
    authMiddleware,
    groupController.transferOwnership,
);

router.delete("/:id", authMiddleware, groupController.removeGroup);

module.exports = router;
