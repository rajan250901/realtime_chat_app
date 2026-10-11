const { pool } = require("../config/db");


// Check whether user belongs to conversation
const isConversationMember = async (conversationId, userId) => {

    const result = await pool.query(
        `
        SELECT id
        FROM conversation_members
        WHERE conversation_id = $1
        AND user_id = $2
        `,
        [conversationId, userId]
    );

    return result.rows.length > 0;
};


// Create new message
const createMessage = async (
    conversationId,
    senderId,
    content
) => {

    const result = await pool.query(
        `
        INSERT INTO messages
        (conversation_id, sender_id, content)
        VALUES ($1, $2, $3)
        RETURNING
            id,
            conversation_id,
            sender_id,
            content,
            created_at
        `,
        [
            conversationId,
            senderId,
            content
        ]
    );

    return result.rows[0];
};


// Get messages of a conversation
const getMessages = async (
    conversationId,
    limit = 20,
    before = null
) => {

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
                m.created_at,
                m.updated_at
            FROM messages m
            JOIN users u
                ON m.sender_id = u.id
            WHERE m.conversation_id = $1
              AND m.id < $2
            ORDER BY m.id DESC
            LIMIT $3
        `;

        values = [
            conversationId,
            before,
            limit
        ];

    } else {

        query = `
            SELECT
                m.id,
                m.conversation_id,
                m.sender_id,
                u.name AS sender_name,
                u.email AS sender_email,
                m.content,
                m.created_at,
                m.updated_at
            FROM messages m
            JOIN users u
                ON m.sender_id = u.id
            WHERE m.conversation_id = $1
            ORDER BY m.id DESC
            LIMIT $2
        `;

        values = [
            conversationId,
            limit
        ];
    }

    const result = await pool.query(
        query,
        values
    );

    return result.rows;
};


module.exports = {
    isConversationMember,
    createMessage,
    getMessages
};