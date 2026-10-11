
const { pool } = require("../config/db");

const socketHandler = (io) => {
  io.on("connection", (socket) => {
    const userId = socket.user?.id;

    console.log("Socket connected:", socket.id, "User:", userId);

    if (!userId) {
      socket.disconnect(true);
      return;
    }

    // Join a conversation only if the user is a member.
    socket.on("join_conversation", async (data = {}, callback) => {
      const reply = typeof callback === "function" ? callback : () => {};

      try {
        const conversationId = Number(data.conversationId);

        if (!Number.isInteger(conversationId) || conversationId <= 0) {
          return reply({
            success: false,
            message: "Valid conversation ID is required",
          });
        }

        const membership = await pool.query(
          `SELECT 1
           FROM conversation_members
           WHERE conversation_id = $1 AND user_id = $2`,
          [conversationId, userId]
        );

        if (membership.rowCount === 0) {
          return reply({
            success: false,
            message: "You are not a member of this conversation",
          });
        }

        const room = `conversation:${conversationId}`;
        await socket.join(room);

        return reply({
          success: true,
          message: "Joined conversation",
          conversationId,
        });
      } catch (error) {
        console.error("Join conversation error:", error);
        return reply({
          success: false,
          message: "Unable to join conversation",
        });
      }
    });

    // Save a message and broadcast it to all members in the room.
    socket.on("send_message", async (data = {}, callback) => {
      const reply = typeof callback === "function" ? callback : () => {};

      try {
        const conversationId = Number(data.conversationId);
        const content =
          typeof data.content === "string" ? data.content.trim() : "";

        if (!Number.isInteger(conversationId) || conversationId <= 0) {
          return reply({
            success: false,
            message: "Valid conversation ID is required",
          });
        }

        if (!content || content.length > 5000) {
          return reply({
            success: false,
            message: "Message must contain 1 to 5000 characters",
          });
        }

        // Never trust a sender ID supplied by the client.
        const membership = await pool.query(
          `SELECT 1
           FROM conversation_members
           WHERE conversation_id = $1 AND user_id = $2`,
          [conversationId, userId]
        );

        if (membership.rowCount === 0) {
          return reply({
            success: false,
            message: "You are not a member of this conversation",
          });
        }

        const result = await pool.query(
          `INSERT INTO messages
             (conversation_id, sender_id, content)
           VALUES ($1, $2, $3)
           RETURNING id, conversation_id, sender_id, content,
                     created_at, updated_at`,
          [conversationId, userId, content]
        );

        const message = result.rows[0];
        const room = `conversation:${conversationId}`;

        // Send to all members, including the sender's other tabs.
        io.to(room).emit("new_message", message);

        // Update conversation activity for sidebar ordering.
        await pool.query(
          `UPDATE conversations
           SET updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [conversationId]
        );

        return reply({
          success: true,
          message: "Message sent successfully",
          data: message,
        });
      } catch (error) {
        console.error("Socket send_message error:", error);
        return reply({
          success: false,
          message: "Unable to send message",
        });
      }
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", socket.id, reason);
    });
  });
};

module.exports = socketHandler;
