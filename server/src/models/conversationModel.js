const { pool } = require("../config/db");

const findDirectConversation = async (userId1, userId2) => {
  const result = await pool.query(
    `SELECT
      c.id,
      c.type,
      c.name,
      c.avatar_url,
      c.created_by,
      c.created_at,
      c.updated_at
     FROM conversations c
     JOIN conversation_members cm1
       ON c.id = cm1.conversation_id
     JOIN conversation_members cm2
       ON c.id = cm2.conversation_id
     WHERE c.type = 'direct'
       AND cm1.user_id = $1
       AND cm2.user_id = $2
       AND (
         SELECT COUNT(*)
         FROM conversation_members cmx
         WHERE cmx.conversation_id = c.id
       ) = 2
     LIMIT 1`,
    [userId1, userId2],
  );

  return result.rows[0] || null;
};

const createDirectConversation = async (userId1, userId2) => {
  const existing = await findDirectConversation(userId1, userId2);

  if (existing) {
    return existing;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const conversationResult = await client.query(
      `INSERT INTO conversations
       (type, created_by)
       VALUES ('direct', $1)
       RETURNING
         id,
         type,
         name,
         avatar_url,
         created_by,
         created_at,
         updated_at`,
      [userId1],
    );

    const conversation = conversationResult.rows[0];

    await client.query(
      `INSERT INTO conversation_members
       (conversation_id, user_id, role)
       VALUES
       ($1, $2, 'member'),
       ($1, $3, 'member')`,
      [conversation.id, userId1, userId2],
    );

    await client.query("COMMIT");

    return conversation;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const createGroupConversation = async (ownerId, name, memberIds = []) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const conversationResult = await client.query(
      `INSERT INTO conversations
         (type, name, created_by)
         VALUES ('group', $1, $2)
         RETURNING
           id,
           type,
           name,
           avatar_url,
           created_by,
           created_at,
           updated_at`,
      [name, ownerId],
    );

    const conversation = conversationResult.rows[0];

    const uniqueMemberIds = [
      ownerId,
      ...memberIds
        .map(Number)
        .filter((id) => Number.isInteger(id) && id !== Number(ownerId)),
    ].filter((id, index, array) => array.indexOf(id) === index);

    for (const userId of uniqueMemberIds) {
      const role = Number(userId) === Number(ownerId) ? "owner" : "member";

      await client.query(
        `INSERT INTO conversation_members
         (conversation_id, user_id, role)
         VALUES ($1, $2, $3)`,
        [conversation.id, userId, role],
      );
    }

    await client.query("COMMIT");

    return conversation;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const getUserConversations = async (userId) => {
  const result = await pool.query(
    `SELECT
      c.id,
      c.type,
      c.name,
      c.avatar_url,
      c.created_by,
      c.created_at,
      c.updated_at,

      COALESCE(
        lm.created_at,
        c.updated_at,
        c.created_at
      ) AS last_activity_at,

      lm.content AS last_message,
      lm.created_at AS last_message_at,

      other_user.id AS other_user_id,
      other_user.name AS other_user_name,
      other_user.email AS other_user_email,
      other_user.avatar_url AS other_user_avatar,
      other_user.last_seen AS other_user_last_seen,

      mine.role AS my_role,

      COALESCE(
        unread.unread_count,
        0
      ) AS unread_count

     FROM conversations c

     JOIN conversation_members mine
       ON mine.conversation_id = c.id
       AND mine.user_id = $1

     LEFT JOIN conversation_members other_member
       ON other_member.conversation_id = c.id
       AND other_member.user_id <> $1
       AND c.type = 'direct'

     LEFT JOIN users other_user
       ON other_user.id = other_member.user_id

     LEFT JOIN LATERAL (
       SELECT
         content,
         created_at
       FROM messages
       WHERE conversation_id = c.id
       ORDER BY id DESC
       LIMIT 1
     ) lm ON TRUE

     LEFT JOIN LATERAL (
       SELECT
         COUNT(*)::int AS unread_count
       FROM messages m
       LEFT JOIN conversation_reads cr
         ON cr.conversation_id = c.id
         AND cr.user_id = $1
       WHERE m.conversation_id = c.id
         AND m.sender_id <> $1
         AND (
           cr.last_read_message_id IS NULL
           OR m.id > cr.last_read_message_id
         )
     ) unread ON TRUE

     ORDER BY
       last_activity_at DESC NULLS LAST,
       c.id DESC`,
    [userId],
  );

  return result.rows.map((conversation) => ({
    ...conversation,
    user:
      conversation.type === "direct"
        ? {
            id: conversation.other_user_id,
            name: conversation.other_user_name || "User",
            email: conversation.other_user_email,
            avatar_url: conversation.other_user_avatar,
            last_seen: conversation.other_user_last_seen,
          }
        : null,
  }));
};

const getConversationById = async (conversationId, userId) => {
  const result = await pool.query(
    `SELECT
      c.id,
      c.type,
      c.name,
      c.avatar_url,
      c.created_by,
      c.created_at,
      c.updated_at,
      cm.role AS my_role
     FROM conversations c
     JOIN conversation_members cm
       ON cm.conversation_id = c.id
       AND cm.user_id = $2
     WHERE c.id = $1`,
    [conversationId, userId],
  );

  return result.rows[0] || null;
};

const getGroupMembers = async (conversationId) => {
  const result = await pool.query(
    `SELECT
      u.id,
      u.name,
      u.email,
      u.avatar_url,
      u.last_seen,
      cm.role,
      cm.joined_at
     FROM conversation_members cm
     JOIN users u
       ON u.id = cm.user_id
     WHERE cm.conversation_id = $1
     ORDER BY
       CASE cm.role
         WHEN 'owner' THEN 1
         WHEN 'admin' THEN 2
         ELSE 3
       END,
       u.name ASC`,
    [conversationId],
  );

  return result.rows;
};

const updateGroupName = async (conversationId, name) => {
  const result = await pool.query(
    `UPDATE conversations
     SET
       name = $1,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
       AND type = 'group'
     RETURNING
       id,
       type,
       name,
       avatar_url,
       created_by,
       created_at,
       updated_at`,
    [name, conversationId],
  );

  return result.rows[0] || null;
};

const deleteGroupConversation = async (conversationId) => {
  const result = await pool.query(
    `DELETE FROM conversations
     WHERE id = $1
       AND type = 'group'
     RETURNING id`,
    [conversationId],
  );

  return result.rows[0] || null;
};

const removeGroupMember = async (conversationId, userId) => {
  const result = await pool.query(
    `DELETE FROM conversation_members
     WHERE conversation_id = $1
       AND user_id = $2
     RETURNING id, conversation_id, user_id, role`,
    [conversationId, userId],
  );

  return result.rows[0] || null;
};

const updateMemberRole = async (conversationId, userId, role) => {
  const result = await pool.query(
    `UPDATE conversation_members
     SET role = $3
     WHERE conversation_id = $1
       AND user_id = $2
     RETURNING
       id,
       conversation_id,
       user_id,
       role`,
    [conversationId, userId, role],
  );

  return result.rows[0] || null;
};

const transferOwnership = async (
  conversationId,
  currentOwnerId,
  newOwnerId,
) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const newOwnerResult = await client.query(
      `SELECT id
         FROM conversation_members
         WHERE conversation_id = $1
           AND user_id = $2`,
      [conversationId, newOwnerId],
    );

    if (newOwnerResult.rows.length === 0) {
      throw new Error("New owner is not a group member");
    }

    await client.query(
      `UPDATE conversation_members
       SET role = 'admin'
       WHERE conversation_id = $1
         AND user_id = $2`,
      [conversationId, currentOwnerId],
    );

    await client.query(
      `UPDATE conversation_members
       SET role = 'owner'
       WHERE conversation_id = $1
         AND user_id = $2`,
      [conversationId, newOwnerId],
    );

    await client.query(
      `UPDATE conversations
       SET
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [conversationId],
    );

    await client.query("COMMIT");

    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  findDirectConversation,
  createDirectConversation,
  createGroupConversation,
  getUserConversations,
  getConversationById,
  getGroupMembers,
  updateGroupName,
  deleteGroupConversation,
  removeGroupMember,
  updateMemberRole,
  transferOwnership,
};
