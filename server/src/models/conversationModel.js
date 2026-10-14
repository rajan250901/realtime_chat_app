const { pool } = require("../config/db");

const findDirectConversation = async (userId1, userId2) => {
  const result = await pool.query(
    `SELECT c.id, c.type, c.name, c.avatar_url, c.created_at, c.updated_at
     FROM conversations c
     JOIN conversation_members cm1 ON c.id = cm1.conversation_id
     JOIN conversation_members cm2 ON c.id = cm2.conversation_id
     WHERE c.type = 'direct' AND cm1.user_id = $1 AND cm2.user_id = $2
       AND (SELECT COUNT(*) FROM conversation_members cmx WHERE cmx.conversation_id = c.id) = 2
     LIMIT 1`, [userId1, userId2]
  );
  return result.rows[0];
};

const createDirectConversation = async (userId1, userId2) => {
  const existing = await findDirectConversation(userId1, userId2);
  if (existing) return existing;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const conversationResult = await client.query(`INSERT INTO conversations (type, created_by) VALUES ('direct', $1) RETURNING id, type, name, avatar_url, created_by, created_at, updated_at`, [userId1]);
    const conversation = conversationResult.rows[0];
    await client.query(`INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ($1, $2, 'member'), ($1, $3, 'member')`, [conversation.id, userId1, userId2]);
    await client.query("COMMIT");
    return conversation;
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
};

const getUserConversations = async (userId) => {
  const result = await pool.query(
    `SELECT c.id, c.type, c.name, c.avatar_url, c.created_at, c.updated_at,
            COALESCE(lm.created_at, c.updated_at, c.created_at) AS last_activity_at,
            lm.content AS last_message, lm.created_at AS last_message_at,
            other_user.id AS other_user_id, other_user.name AS other_user_name, other_user.email AS other_user_email,
            other_user.avatar_url AS other_user_avatar, other_user.last_seen AS other_user_last_seen,
            mine.role AS my_role,
            COALESCE(unread.unread_count, 0) AS unread_count
     FROM conversations c
     JOIN conversation_members mine ON mine.conversation_id = c.id AND mine.user_id = $1
     LEFT JOIN conversation_members other_member ON other_member.conversation_id = c.id AND other_member.user_id <> $1 AND c.type = 'direct'
     LEFT JOIN users other_user ON other_user.id = other_member.user_id
     LEFT JOIN LATERAL (SELECT content, created_at FROM messages WHERE conversation_id = c.id ORDER BY id DESC LIMIT 1) lm ON TRUE
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS unread_count
       FROM messages m
       LEFT JOIN conversation_reads cr ON cr.conversation_id = c.id AND cr.user_id = $1
       WHERE m.conversation_id = c.id AND m.sender_id <> $1 AND (cr.last_read_message_id IS NULL OR m.id > cr.last_read_message_id)
     ) unread ON TRUE
     ORDER BY last_activity_at DESC NULLS LAST, c.id DESC`, [userId]
  );
  return result.rows;
};

module.exports = { findDirectConversation, createDirectConversation, getUserConversations };
