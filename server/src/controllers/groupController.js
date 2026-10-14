const { pool } = require("../config/db");

const getMembership = async (conversationId, userId) => {
  const result = await pool.query(
    `SELECT conversation_id, user_id, role FROM conversation_members WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, userId]
  );
  return result.rows[0] || null;
};

const canManageGroup = (role) => role === "owner" || role === "admin";

const createGroup = async (req, res) => {
  const client = await pool.connect();
  try {
    const ownerId = Number(req.user.id);
    const { name, memberIds = [] } = req.body;
    const groupName = String(name || "").trim();
    if (!groupName) return res.status(400).json({ success: false, message: "Group name is required" });
    if (groupName.length > 100) return res.status(400).json({ success: false, message: "Group name must be 100 characters or less" });

    const ids = [...new Set([ownerId, ...memberIds.map(Number).filter(Number.isInteger)])];
    await client.query("BEGIN");
    const groupResult = await client.query(
      `INSERT INTO conversations (type, name, created_by) VALUES ('group', $1, $2) RETURNING id, type, name, avatar_url, created_by, created_at, updated_at`,
      [groupName, ownerId]
    );
    const group = groupResult.rows[0];

    for (const id of ids) {
      await client.query(
        `INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT (conversation_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
        [group.id, id, id === ownerId ? "owner" : "member"]
      );
    }
    await client.query("COMMIT");
    return res.status(201).json({ success: true, group });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create group error:", error);
    return res.status(500).json({ success: false, message: "Unable to create group" });
  } finally { client.release(); }
};

const getGroupDetails = async (req, res) => {
  try {
    const conversationId = Number(req.params.id);
    const userId = Number(req.user.id);
    const membership = await getMembership(conversationId, userId);
    if (!membership) return res.status(403).json({ success: false, message: "You are not a member of this group" });

    const groupResult = await pool.query(
      `SELECT id, type, name, avatar_url, created_by, created_at, updated_at FROM conversations WHERE id = $1 AND type = 'group'`,
      [conversationId]
    );
    if (!groupResult.rows[0]) return res.status(404).json({ success: false, message: "Group not found" });

    const members = await pool.query(
      `SELECT u.id, u.name, u.email, u.avatar_url, u.last_seen, cm.role, cm.joined_at
       FROM conversation_members cm JOIN users u ON u.id = cm.user_id
       WHERE cm.conversation_id = $1 ORDER BY CASE cm.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END, u.name ASC`,
      [conversationId]
    );
    return res.json({ success: true, group: groupResult.rows[0], members: members.rows, myRole: membership.role });
  } catch (error) {
    console.error("Get group details error:", error);
    return res.status(500).json({ success: false, message: "Unable to load group" });
  }
};

const addMembers = async (req, res) => {
  try {
    const conversationId = Number(req.params.id);
    const membership = await getMembership(conversationId, Number(req.user.id));
    if (!membership || !canManageGroup(membership.role)) return res.status(403).json({ success: false, message: "Only owner/admin can add members" });
    const memberIds = [...new Set((req.body.memberIds || []).map(Number).filter(Number.isInteger))];
    for (const id of memberIds) {
      await pool.query(`INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT (conversation_id, user_id) DO NOTHING`, [conversationId, id]);
    }
    return res.json({ success: true, message: "Members added" });
  } catch (error) {
    console.error("Add members error:", error);
    return res.status(500).json({ success: false, message: "Unable to add members" });
  }
};

const removeMember = async (req, res) => {
  try {
    const conversationId = Number(req.params.id);
    const targetId = Number(req.params.userId);
    const membership = await getMembership(conversationId, Number(req.user.id));
    const target = await getMembership(conversationId, targetId);
    if (!membership || !target) return res.status(404).json({ success: false, message: "Member not found" });
    if (target.role === "owner") return res.status(403).json({ success: false, message: "Owner cannot be removed" });
    if (membership.role === "admin" && target.role === "admin") return res.status(403).json({ success: false, message: "Admin cannot remove another admin" });
    if (!canManageGroup(membership.role) && targetId !== Number(req.user.id)) return res.status(403).json({ success: false, message: "You cannot remove this member" });
    await pool.query(`DELETE FROM conversation_members WHERE conversation_id = $1 AND user_id = $2`, [conversationId, targetId]);
    return res.json({ success: true, message: "Member removed" });
  } catch (error) {
    console.error("Remove member error:", error);
    return res.status(500).json({ success: false, message: "Unable to remove member" });
  }
};

const updateRole = async (req, res) => {
  try {
    const conversationId = Number(req.params.id);
    const targetId = Number(req.params.userId);
    const role = req.body.role;
    const membership = await getMembership(conversationId, Number(req.user.id));
    const target = await getMembership(conversationId, targetId);
    if (!membership || !target) return res.status(404).json({ success: false, message: "Member not found" });
    if (membership.role !== "owner") return res.status(403).json({ success: false, message: "Only owner can change roles" });
    if (!["admin", "member"].includes(role) || target.role === "owner") return res.status(400).json({ success: false, message: "Invalid role" });
    await pool.query(`UPDATE conversation_members SET role = $1 WHERE conversation_id = $2 AND user_id = $3`, [role, conversationId, targetId]);
    return res.json({ success: true, message: `Member is now ${role}` });
  } catch (error) {
    console.error("Update role error:", error);
    return res.status(500).json({ success: false, message: "Unable to update role" });
  }
};

const transferOwner = async (req, res) => {
  const client = await pool.connect();
  try {
    const conversationId = Number(req.params.id);
    const newOwnerId = Number(req.body.userId);
    const currentOwner = await getMembership(conversationId, Number(req.user.id));
    const newOwner = await getMembership(conversationId, newOwnerId);
    if (!currentOwner || currentOwner.role !== "owner") return res.status(403).json({ success: false, message: "Only owner can transfer ownership" });
    if (!newOwner) return res.status(404).json({ success: false, message: "New owner must be a group member" });
    await client.query("BEGIN");
    await client.query(`UPDATE conversation_members SET role = 'admin' WHERE conversation_id = $1 AND user_id = $2`, [conversationId, Number(req.user.id)]);
    await client.query(`UPDATE conversation_members SET role = 'owner' WHERE conversation_id = $1 AND user_id = $2`, [conversationId, newOwnerId]);
    await client.query(`UPDATE conversations SET created_by = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [newOwnerId, conversationId]);
    await client.query("COMMIT");
    return res.json({ success: true, message: "Ownership transferred" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Transfer owner error:", error);
    return res.status(500).json({ success: false, message: "Unable to transfer ownership" });
  } finally { client.release(); }
};

const updateGroup = async (req, res) => {
  try {
    const conversationId = Number(req.params.id);
    const membership = await getMembership(conversationId, Number(req.user.id));
    if (!membership || !canManageGroup(membership.role)) return res.status(403).json({ success: false, message: "Only owner/admin can update the group" });
    const name = req.body.name === undefined ? undefined : String(req.body.name).trim();
    const avatarUrl = req.body.avatarUrl === undefined ? undefined : String(req.body.avatarUrl).trim();
    if (name !== undefined && (!name || name.length > 100)) return res.status(400).json({ success: false, message: "Invalid group name" });
    const result = await pool.query(`UPDATE conversations SET name = COALESCE($1, name), avatar_url = COALESCE($2, avatar_url), updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND type = 'group' RETURNING id, type, name, avatar_url, updated_at`, [name ?? null, avatarUrl ?? null, conversationId]);
    return res.json({ success: true, group: result.rows[0] });
  } catch (error) {
    console.error("Update group error:", error);
    return res.status(500).json({ success: false, message: "Unable to update group" });
  }
};

const deleteGroup = async (req, res) => {
  try {
    const conversationId = Number(req.params.id);
    const membership = await getMembership(conversationId, Number(req.user.id));
    if (!membership || membership.role !== "owner") return res.status(403).json({ success: false, message: "Only owner can delete the group" });
    await pool.query(`DELETE FROM conversations WHERE id = $1 AND type = 'group'`, [conversationId]);
    return res.json({ success: true, message: "Group deleted" });
  } catch (error) {
    console.error("Delete group error:", error);
    return res.status(500).json({ success: false, message: "Unable to delete group" });
  }
};

module.exports = { createGroup, getGroupDetails, addMembers, removeMember, updateRole, transferOwner, updateGroup, deleteGroup };
