const { pool } = require("../config/db");

/* --------------------------------
   CHECK CONVERSATION MEMBER
-------------------------------- */

const isConversationMember = async (conversationId, userId) => {
  const result = await pool.query(
    `
    SELECT role
    FROM conversation_members
    WHERE conversation_id = $1
      AND user_id = $2
    `,
    [conversationId, userId],
  );

  return result.rows[0] || null;
};

/* --------------------------------
   GET SINGLE MESSAGE
   Complete payload for Socket.IO
-------------------------------- */

const getMessageById = async (messageId) => {
  const result = await pool.query(
    `
    SELECT
      m.id,
      m.conversation_id,
      m.sender_id,
      u.name AS sender_name,
      u.email AS sender_email,
      m.content,
      m.client_message_id,
      m.created_at,
      m.updated_at,
      m.edited,
      m.deleted_at,

      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'emoji', mr.emoji,
              'user_id', mr.user_id
            )
          )
          FROM message_reactions mr
          WHERE mr.message_id = m.id
        ),
        '[]'
      ) AS reactions

    FROM messages m

    JOIN users u
      ON u.id = m.sender_id

    WHERE m.id = $1
    `,
    [messageId],
  );

  return result.rows[0] || null;
};

/* --------------------------------
   CREATE MESSAGE
-------------------------------- */

const createMessage = async (
  conversationId,
  senderId,
  content,
  clientMessageId = null,
) => {
  let messageId = null;

  /*
    New message
  */
  const inserted = await pool.query(
    `
    INSERT INTO messages
      (
        conversation_id,
        sender_id,
        content,
        client_message_id
      )
    VALUES
      ($1, $2, $3, $4)

    ON CONFLICT (client_message_id)
    DO NOTHING

    RETURNING id
    `,
    [conversationId, senderId, content, clientMessageId],
  );

  /*
    New message inserted
  */
  if (inserted.rows.length > 0) {
    messageId = inserted.rows[0].id;
  } else if (clientMessageId) {
    /*
      Duplicate client message.
      Fetch existing message.
    */
    const existing = await pool.query(
      `
      SELECT id
      FROM messages
      WHERE client_message_id = $1
      LIMIT 1
      `,
      [clientMessageId],
    );

    messageId = existing.rows[0]?.id;
  }

  if (!messageId) {
    throw new Error("Unable to create or find message");
  }

  /*
    Return complete message object.
  */
  const message = await getMessageById(messageId);

  return message;
};

/* --------------------------------
   GET MESSAGES
-------------------------------- */

const getMessages = async (conversationId, limit = 20, before = null) => {
  let query;
  let values;

  if (before) {
    query = `
      SELECT
        m.id,
        m.conversation_id,
        m.sender_id,
        u.name AS sender_name,
        u.email AS sender_email,
        m.content,
        m.client_message_id,
        m.created_at,
        m.updated_at,
        m.edited,
        m.deleted_at,

        COALESCE(
          json_agg(
            json_build_object(
              'emoji', mr.emoji,
              'user_id', mr.user_id
            )
          )
          FILTER (
            WHERE mr.id IS NOT NULL
          ),
          '[]'
        ) AS reactions

      FROM messages m

      JOIN users u
        ON u.id = m.sender_id

      LEFT JOIN message_reactions mr
        ON mr.message_id = m.id

      WHERE
        m.conversation_id = $1
        AND m.id < $2

      GROUP BY
        m.id,
        u.name,
        u.email

      ORDER BY m.id DESC

      LIMIT $3
    `;

    values = [conversationId, before, limit];
  } else {
    query = `
      SELECT
        m.id,
        m.conversation_id,
        m.sender_id,
        u.name AS sender_name,
        u.email AS sender_email,
        m.content,
        m.client_message_id,
        m.created_at,
        m.updated_at,
        m.edited,
        m.deleted_at,

        COALESCE(
          json_agg(
            json_build_object(
              'emoji', mr.emoji,
              'user_id', mr.user_id
            )
          )
          FILTER (
            WHERE mr.id IS NOT NULL
          ),
          '[]'
        ) AS reactions

      FROM messages m

      JOIN users u
        ON u.id = m.sender_id

      LEFT JOIN message_reactions mr
        ON mr.message_id = m.id

      WHERE
        m.conversation_id = $1

      GROUP BY
        m.id,
        u.name,
        u.email

      ORDER BY m.id DESC

      LIMIT $2
    `;

    values = [conversationId, limit];
  }

  const result = await pool.query(query, values);

  return result.rows;
};

/* --------------------------------
   EDIT MESSAGE
-------------------------------- */

const editMessage = async (messageId, userId, content) => {
  const result = await pool.query(
    `
    UPDATE messages

    SET
      content = $1,
      edited = TRUE,
      updated_at = CURRENT_TIMESTAMP

    WHERE
      id = $2
      AND sender_id = $3
      AND deleted_at IS NULL

    RETURNING id
    `,
    [content, messageId, userId],
  );

  if (!result.rows[0]) {
    return null;
  }

  return getMessageById(messageId);
};

/* --------------------------------
   DELETE MESSAGE
-------------------------------- */

const deleteMessage = async (messageId, userId) => {
  const result = await pool.query(
    `
    UPDATE messages

    SET
      deleted_at = CURRENT_TIMESTAMP,
      content = 'This message was deleted',
      updated_at = CURRENT_TIMESTAMP

    WHERE
      id = $1
      AND sender_id = $2
      AND deleted_at IS NULL
      AND created_at >=
          CURRENT_TIMESTAMP - INTERVAL '10 minutes'

    RETURNING id
    `,
    [messageId, userId],
  );

  if (!result.rows[0]) {
    return null;
  }

  return getMessageById(messageId);
};

/* --------------------------------
   ADD REACTION
-------------------------------- */

const addReaction = async (messageId, userId, emoji) => {
  const result = await pool.query(
    `
    INSERT INTO message_reactions
      (
        message_id,
        user_id,
        emoji
      )

    VALUES
      ($1, $2, $3)

    ON CONFLICT
      (message_id, user_id, emoji)
    DO NOTHING

    RETURNING
      id,
      message_id,
      user_id,
      emoji
    `,
    [messageId, userId, emoji],
  );

  return result.rows[0] || null;
};

/* --------------------------------
   REMOVE REACTION
-------------------------------- */

const removeReaction = async (messageId, userId, emoji) => {
  const result = await pool.query(
    `
    DELETE FROM message_reactions

    WHERE
      message_id = $1
      AND user_id = $2
      AND emoji = $3

    RETURNING
      id,
      message_id,
      user_id,
      emoji
    `,
    [messageId, userId, emoji],
  );

  return result.rows[0] || null;
};

/* --------------------------------
   GET CONVERSATION MEMBERS
-------------------------------- */

const getConversationMemberIds = async (conversationId) => {
  const result = await pool.query(
    `
    SELECT
      user_id,
      role

    FROM conversation_members

    WHERE conversation_id = $1
    `,
    [conversationId],
  );

  return result.rows;
};

/* --------------------------------
   DELIVERY ROWS
-------------------------------- */

const ensureDeliveryRows = async (messageId, conversationId, senderId) => {
  await pool.query(
    `
    INSERT INTO message_deliveries
      (
        message_id,
        user_id,
        delivered_at
      )

    SELECT
      $1,
      user_id,
      NULL

    FROM conversation_members

    WHERE
      conversation_id = $2
      AND user_id <> $3

    ON CONFLICT
      (message_id, user_id)
    DO NOTHING
    `,
    [messageId, conversationId, senderId],
  );
};

/* --------------------------------
   MARK DELIVERED
-------------------------------- */

const markDelivered = async (conversationId, userId) => {
  await pool.query(
    `
    UPDATE message_deliveries md

    SET
      delivered_at =
        COALESCE(
          md.delivered_at,
          CURRENT_TIMESTAMP
        )

    FROM messages m

    WHERE
      md.message_id = m.id
      AND md.user_id = $2
      AND m.conversation_id = $1
    `,
    [conversationId, userId],
  );
};

/* --------------------------------
   MARK READ
-------------------------------- */

const markRead = async (conversationId, userId) => {
  const latest = await pool.query(
    `
    SELECT id

    FROM messages

    WHERE conversation_id = $1

    ORDER BY id DESC

    LIMIT 1
    `,
    [conversationId],
  );

  const latestId = latest.rows[0]?.id || null;

  await pool.query(
    `
    INSERT INTO conversation_reads
      (
        conversation_id,
        user_id,
        last_read_message_id,
        read_at
      )

    VALUES
      ($1, $2, $3, CURRENT_TIMESTAMP)

    ON CONFLICT
      (conversation_id, user_id)

    DO UPDATE SET

      last_read_message_id =
        CASE

          WHEN EXCLUDED.last_read_message_id IS NULL
            THEN conversation_reads.last_read_message_id

          WHEN conversation_reads.last_read_message_id IS NULL
            THEN EXCLUDED.last_read_message_id

          ELSE GREATEST(
            conversation_reads.last_read_message_id,
            EXCLUDED.last_read_message_id
          )

        END,

      read_at = CURRENT_TIMESTAMP
    `,
    [conversationId, userId, latestId],
  );

  if (latestId) {
    await pool.query(
      `
      UPDATE message_deliveries

      SET
        delivered_at =
          COALESCE(
            delivered_at,
            CURRENT_TIMESTAMP
          ),
        read_at = CURRENT_TIMESTAMP

      WHERE
        user_id = $1

        AND message_id IN (
          SELECT id
          FROM messages
          WHERE conversation_id = $2
        )
      `,
      [userId, conversationId],
    );
  }

  return latestId;
};

/* --------------------------------
   READ SUMMARY
-------------------------------- */

const getReadSummary = async (conversationId, messageId) => {
  const result = await pool.query(
    `
    SELECT

      COUNT(cm.user_id)::int
        AS total_members,

      COUNT(cr.user_id)
        FILTER (
          WHERE cr.last_read_message_id >= $2
        )::int
        AS seen_members

    FROM conversation_members cm

    LEFT JOIN conversation_reads cr

      ON cr.conversation_id =
         cm.conversation_id

      AND cr.user_id =
          cm.user_id

    WHERE
      cm.conversation_id = $1
    `,
    [conversationId, messageId],
  );

  return result.rows[0];
};

/* --------------------------------
   EXPORTS
-------------------------------- */

module.exports = {
  isConversationMember,
  createMessage,
  getMessages,
  getMessageById,
  editMessage,
  deleteMessage,
  addReaction,
  removeReaction,
  getConversationMemberIds,
  ensureDeliveryRows,
  markDelivered,
  markRead,
  getReadSummary,
};
