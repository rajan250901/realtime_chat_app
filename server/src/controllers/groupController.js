const groupModel = require("../models/groupModel");
const { pool } = require("../config/db");

const getMembership = async (conversationId, userId) => {
  const result = await pool.query(
    `SELECT user_id, role
     FROM conversation_members
     WHERE conversation_id = $1
       AND user_id = $2`,
    [conversationId, userId],
  );

  return result.rows[0] || null;
};

const create = async (req, res) => {
  try {
    const { name, memberIds = [] } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Group name is required",
      });
    }

    const cleanMemberIds = Array.isArray(memberIds)
      ? [...new Set(memberIds.map(Number).filter(Number.isInteger))]
      : [];

    const conversation = await groupModel.createGroup(
      name.trim(),
      req.user.id,
      cleanMemberIds,
    );

    return res.status(201).json({
      success: true,
      message: "Group created successfully",
      conversation,
    });
  } catch (error) {
    console.error("Create group error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create group",
    });
  }
};

const info = async (req, res) => {
  try {
    const conversationId = Number(req.params.id);

    if (!Number.isInteger(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid group id",
      });
    }

    const group = await groupModel.getGroupInfo(conversationId, req.user.id);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found or you are not a member",
      });
    }

    return res.status(200).json({
      success: true,
      group,
    });
  } catch (error) {
    console.error("Group info error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch group",
    });
  }
};

const requireAdmin = async (conversationId, userId) => {
  const member = await getMembership(conversationId, userId);

  if (!member) {
    return null;
  }

  if (!["owner", "admin"].includes(member.role)) {
    return null;
  }

  return member;
};

const addMember = async (req, res) => {
  try {
    const conversationId = Number(req.params.id);
    const userId = Number(req.body.userId);

    if (!Number.isInteger(conversationId) || !Number.isInteger(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid group or user id",
      });
    }

    const actor = await requireAdmin(conversationId, req.user.id);

    if (!actor) {
      return res.status(403).json({
        success: false,
        message: "Admin permission required",
      });
    }

    const member = await groupModel.addMember(conversationId, userId);

    if (!member) {
      return res.status(400).json({
        success: false,
        message: "User is already a member",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Member added",
      member,
    });
  } catch (error) {
    console.error("Add member error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to add member",
    });
  }
};

const removeMember = async (req, res) => {
  try {
    const conversationId = Number(req.params.id);
    const targetId = Number(req.params.userId);

    const actor = await getMembership(conversationId, req.user.id);

    if (!actor || !["owner", "admin"].includes(actor.role)) {
      return res.status(403).json({
        success: false,
        message: "Admin permission required",
      });
    }

    const target = await getMembership(conversationId, targetId);

    if (!target) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    if (target.role === "owner") {
      return res.status(400).json({
        success: false,
        message: "Owner cannot be removed",
      });
    }

    if (actor.role === "admin" && target.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin cannot remove another admin",
      });
    }

    const removed = await groupModel.removeMember(conversationId, targetId);

    return res.status(200).json({
      success: true,
      message: "Member removed",
      member: removed,
    });
  } catch (error) {
    console.error("Remove member error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to remove member",
    });
  }
};

const updateName = async (req, res) => {
  try {
    const conversationId = Number(req.params.id);
    const name = req.body.name?.trim();

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Group name is required",
      });
    }

    const actor = await requireAdmin(conversationId, req.user.id);

    if (!actor) {
      return res.status(403).json({
        success: false,
        message: "Admin permission required",
      });
    }

    const group = await groupModel.updateGroupName(conversationId, name);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Group name updated",
      group,
    });
  } catch (error) {
    console.error("Update group error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update group",
    });
  }
};

const changeRole = async (req, res) => {
  try {
    const conversationId = Number(req.params.id);
    const targetUserId = Number(req.params.userId);
    const role = req.body.role;

    if (!Number.isInteger(conversationId) || !Number.isInteger(targetUserId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid group or user id",
      });
    }

    if (!["admin", "member"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role",
      });
    }

    const actor = await getMembership(conversationId, req.user.id);

    if (!actor) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this group",
      });
    }

    if (actor.role !== "owner") {
      return res.status(403).json({
        success: false,
        message: "Owner permission required",
      });
    }

    const target = await getMembership(conversationId, targetUserId);

    if (!target) {
      return res.status(404).json({
        success: false,
        message: "Target member not found",
      });
    }

    if (target.role === "owner") {
      return res.status(400).json({
        success: false,
        message: "Owner role cannot be changed",
      });
    }

    const member = await groupModel.changeRole(
      conversationId,
      targetUserId,
      role,
    );

    if (!member) {
      return res.status(400).json({
        success: false,
        message: "Unable to update member role",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Member role updated",
      member,
    });
  } catch (error) {
    console.error("Change role error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Unable to change role",
    });
  }
};

const transferOwnership = async (req, res) => {
  try {
    const conversationId = Number(req.params.id);
    const newOwnerId = Number(req.body.userId);

    const actor = await getMembership(conversationId, req.user.id);

    if (!actor || actor.role !== "owner") {
      return res.status(403).json({
        success: false,
        message: "Owner permission required",
      });
    }

    const target = await getMembership(conversationId, newOwnerId);

    if (!target) {
      return res.status(404).json({
        success: false,
        message: "Target member not found",
      });
    }

    const member = await groupModel.transferOwnership(
      conversationId,
      req.user.id,
      newOwnerId,
    );

    return res.status(200).json({
      success: true,
      message: "Ownership transferred",
      member,
    });
  } catch (error) {
    console.error("Transfer ownership error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Unable to transfer ownership",
    });
  }
};

const removeGroup = async (req, res) => {
  try {
    const conversationId = Number(req.params.id);

    const actor = await getMembership(conversationId, req.user.id);

    if (!actor || actor.role !== "owner") {
      return res.status(403).json({
        success: false,
        message: "Owner permission required",
      });
    }

    await groupModel.deleteGroup(conversationId);

    return res.status(200).json({
      success: true,
      message: "Group deleted",
      conversationId,
    });
  } catch (error) {
    console.error("Delete group error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to delete group",
    });
  }
};

module.exports = {
  create,
  info,
  addMember,
  removeMember,
  updateName,
  changeRole,
  transferOwnership,
  removeGroup,
};
