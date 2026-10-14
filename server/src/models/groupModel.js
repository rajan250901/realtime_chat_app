const { pool } = require("../config/db");

const createGroup = async (name, createdBy, memberIds = []) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const conversationResult = await client.query(
            `INSERT INTO conversations (type, name, created_by)
       VALUES ('group', $1, $2)
       RETURNING id, type, name, avatar_url, created_by, created_at, updated_at`,
            [name, createdBy],
        );

        const conversation = conversationResult.rows[0];

        const ids = [
            ...new Set([
                Number(createdBy),
                ...memberIds.map(Number).filter((id) => Number.isInteger(id)),
            ]),
        ];

        for (const userId of ids) {
            await client.query(
                `INSERT INTO conversation_members
          (conversation_id, user_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (conversation_id, user_id)
         DO NOTHING`,
                [
                    conversation.id,
                    userId,
                    Number(userId) === Number(createdBy) ? "owner" : "member",
                ],
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

const getGroupInfo = async (conversationId, userId) => {
    const result = await pool.query(
        `SELECT
       c.id,
       c.name,
       c.avatar_url,
       c.created_by,
       mine.role AS current_user_role,
       COALESCE(
         json_agg(
           json_build_object(
             'id', u.id,
             'user_id', u.id,
             'name', u.name,
             'email', u.email,
             'avatar_url', u.avatar_url,
             'role', cm.role,
             'last_seen', u.last_seen
           )
           ORDER BY u.name
         ) FILTER (WHERE u.id IS NOT NULL),
         '[]'
       ) AS members
     FROM conversations c
     JOIN conversation_members mine
       ON mine.conversation_id = c.id
      AND mine.user_id = $2
     LEFT JOIN conversation_members cm
       ON cm.conversation_id = c.id
     LEFT JOIN users u
       ON u.id = cm.user_id
     WHERE c.id = $1
       AND c.type = 'group'
     GROUP BY c.id, mine.role`,
        [conversationId, userId],
    );

    return result.rows[0] || null;
};

const updateGroupName = async (conversationId, name) => {
    const result = await pool.query(
        `UPDATE conversations
     SET name = $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
       AND type = 'group'
     RETURNING id, name, avatar_url, updated_at`,
        [name, conversationId],
    );

    return result.rows[0] || null;
};

const addMember = async (conversationId, userId) => {
    const result = await pool.query(
        `INSERT INTO conversation_members
      (conversation_id, user_id, role)
     VALUES ($1, $2, 'member')
     ON CONFLICT (conversation_id, user_id)
     DO NOTHING
     RETURNING id, conversation_id, user_id, role`,
        [conversationId, userId],
    );

    return result.rows[0] || null;
};

const removeMember = async (conversationId, userId) => {
    const result = await pool.query(
        `DELETE FROM conversation_members
     WHERE conversation_id = $1
       AND user_id = $2
     RETURNING conversation_id, user_id, role`,
        [conversationId, userId],
    );

    return result.rows[0] || null;
};

const changeRole = async (conversationId, userId, role) => {
    const result = await pool.query(
        `UPDATE conversation_members
     SET role = $1
     WHERE conversation_id = $2
       AND user_id = $3
       AND role <> 'owner'
     RETURNING conversation_id, user_id, role`,
        [role, conversationId, userId],
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

        const targetCheck = await client.query(
            `SELECT user_id
       FROM conversation_members
       WHERE conversation_id = $1
         AND user_id = $2`,
            [conversationId, newOwnerId],
        );

        if (targetCheck.rows.length === 0) {
            throw new Error("Target user is not a group member");
        }

        await client.query(
            `UPDATE conversation_members
       SET role = 'admin'
       WHERE conversation_id = $1
         AND user_id = $2
         AND role = 'owner'`,
            [conversationId, currentOwnerId],
        );

        const result = await client.query(
            `UPDATE conversation_members
       SET role = 'owner'
       WHERE conversation_id = $1
         AND user_id = $2
       RETURNING conversation_id, user_id, role`,
            [conversationId, newOwnerId],
        );

        if (result.rows.length === 0) {
            throw new Error("Unable to transfer ownership");
        }

        await client.query("COMMIT");

        return result.rows[0];
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

const deleteGroup = async (conversationId) => {
    await pool.query(
        `DELETE FROM conversations
     WHERE id = $1
       AND type = 'group'`,
        [conversationId],
    );
};

module.exports = {
    createGroup,
    getGroupInfo,
    updateGroupName,
    addMember,
    removeMember,
    changeRole,
    transferOwnership,
    deleteGroup,
};
