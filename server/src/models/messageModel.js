const { pool } = require("../config/db");

const isConversationMember = async (conversationId, userId) => {
  const result = await pool.query(`SELECT id, role FROM conversation_members WHERE conversation_id = $1 AND user_id = $2`, [conversationId, userId]);
  return result.rows[0] || null;
};

const createMessage = async (conversationId, senderId, content, clientMessageId = null) => {
  const result = await pool.query(
    `INSERT INTO messages (conversation_id, sender_id, content, client_message_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (client_message_id) DO UPDATE SET content = messages.content
     RETURNING id, conversation_id, sender_id, content, client_message_id, edited, deleted_at, created_at, updated_at`,
    [conversationId, senderId, content, clientMessageId]
  );
  return result.rows[0];
};

const getMessages = async (conversationId, userId, limit = 30, before = null) => {
  const values = [conversationId, limit];
  let beforeSql = "";
  if (before) {
    values.push(Number(before));
    beforeSql = `AND m.id < $3`;
  }
  const result = await pool.query(
    `SELECT m.id, m.conversation_id, m.sender_id, u.name AS sender_name, u.email AS sender_email,
            m.content, m.client_message_id, m.edited, m.deleted_at, m.created_at, m.updated_at,
            COALESCE((SELECT json_agg(json_build_object('user_id', mr.user_id, 'emoji', mr.emoji)) FROM message_reactions mr WHERE mr.message_id = m.id), '[]'::json) AS reactions
     FROM messages m JOIN users u ON u.id = m.sender_id
     WHERE m.conversation_id = $1 ${beforeSql}
     ORDER BY m.id DESC LIMIT $2`,
    values
  );
  return result.rows;
};

const getMessageById = async (messageId) => {
  const result = await pool.query(
    `SELECT m.id, m.conversation_id, m.sender_id, m.content, m.client_message_id, m.edited, m.deleted_at, m.created_at, m.updated_at, u.name AS sender_name
     FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = $1`,
    [messageId]
  );
  return result.rows[0] || null;
};

const editMessage = async (messageId, userId, content) => {
  const result = await pool.query(
    `UPDATE messages SET content = $1, edited = TRUE, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND sender_id = $3 AND deleted_at IS NULL AND created_at >= CURRENT_TIMESTAMP - INTERVAL '10 minutes'
     RETURNING id, conversation_id, sender_id, content, client_message_id, edited, deleted_at, created_at, updated_at`,
    [content, messageId, userId]
  );
  return result.rows[0] || null;
};

const deleteMessage = async (messageId, userId) => {
  const result = await pool.query(
    `UPDATE messages SET content = 'This message was deleted', deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND sender_id = $2 AND deleted_at IS NULL AND created_at >= CURRENT_TIMESTAMP - INTERVAL '10 minutes'
     RETURNING id, conversation_id, sender_id, content, client_message_id, edited, deleted_at, created_at, updated_at`,
    [messageId, userId]
  );
  return result.rows[0] || null;
};

const toggleReaction = async (messageId, userId, emoji) => {
  const existing = await pool.query(`SELECT id FROM message_reactions WHERE message_id = $1 AND user_id = $2`, [messageId, userId]);
  if (existing.rows[0]) {
    if (!emoji) {
      await pool.query(`DELETE FROM message_reactions WHERE id = $1`, [existing.rows[0].id]);
    } else {
      await pool.query(`UPDATE message_reactions SET emoji = $1 WHERE id = $2`, [emoji, existing.rows[0].id]);
    }
  } else if (emoji) {
    await pool.query(`INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)`, [messageId, userId, emoji]);
  }
  const result = await pool.query(`SELECT user_id, emoji FROM message_reactions WHERE message_id = $1 ORDER BY id ASC`, [messageId]);
  return result.rows;
};

const markDelivered = async (messageId, userId) => {
  await pool.query(`INSERT INTO message_deliveries (message_id, user_id) VALUES ($1, $2) ON CONFLICT (message_id, user_id) DO UPDATE SET delivered_at = CURRENT_TIMESTAMP`, [messageId, userId]);
};

const markRead = async (conversationId, userId, messageId) => {
  const valid = await pool.query(`SELECT id FROM messages WHERE id = $1 AND conversation_id = $2`, [messageId, conversationId]);
  if (!valid.rows[0]) return null;
  const result = await pool.query(
    `INSERT INTO conversation_reads (conversation_id, user_id, last_read_message_id, updated_at)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
     ON CONFLICT (conversation_id, user_id) DO UPDATE SET last_read_message_id = EXCLUDED.last_read_message_id, updated_at = CURRENT_TIMESTAMP
     RETURNING conversation_id, user_id, last_read_message_id, updated_at`,
    [conversationId, userId, messageId]
  );
  return result.rows[0];
};

module.exports = { isConversationMember, createMessage, getMessages, getMessageById, editMessage, deleteMessage, toggleReaction, markDelivered, markRead };
