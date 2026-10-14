const { pool } = require("../config/db");

const messageModel = require("../models/messageModel");

const userModels = require("../models/userModels");

const userSockets = new Map();

const roomName = (conversationId) => `conversation:${conversationId}`;

const addSocketForUser = (userId, socketId) => {
  const key = Number(userId);

  if (!userSockets.has(key)) {
    userSockets.set(key, new Set());
  }

  userSockets.get(key).add(socketId);
};

const removeSocketForUser = (userId, socketId) => {
  const key = Number(userId);

  const sockets = userSockets.get(key);

  if (!sockets) {
    return 0;
  }

  sockets.delete(socketId);

  if (sockets.size === 0) {
    userSockets.delete(key);

    return 0;
  }

  return sockets.size;
};

const emitToUser = (io, userId, event, payload) => {
  const sockets = userSockets.get(Number(userId));

  if (!sockets) {
    return;
  }

  for (const socketId of sockets) {
    io.to(socketId).emit(event, payload);
  }
};

const emitToConversationMembers = async (
  io,
  conversationId,
  event,
  payload,
) => {
  try {
    const members = await messageModel.getConversationMemberIds(conversationId);

    for (const member of members) {
      emitToUser(io, member.user_id, event, payload);
    }
  } catch (error) {
    console.error("Conversation member broadcast error:", error);
  }
};

const broadcastPresence = async (io, userId, online) => {
  try {
    const user = await userModels.getUserById(userId);

    io.emit("presence_update", {
      userId: Number(userId),

      online,

      lastSeen: user?.last_seen || null,
    });
  } catch (error) {
    console.error("Presence broadcast error:", error);

    // Do not terminate socket because
    // of a presence database error.

    io.emit("presence_update", {
      userId: Number(userId),

      online,

      lastSeen: null,
    });
  }
};

const socketHandler = (io) => {
  io.on("connection", async (socket) => {
    const userId = Number(socket.user?.id);

    if (!userId) {
      console.error("Socket user ID missing");

      socket.disconnect(true);

      return;
    }

    addSocketForUser(userId, socket.id);

    console.log(
      "Socket connected:",
      socket.id,
      "User:",
      userId,
      "Open tabs:",
      userSockets.get(userId)?.size,
    );

    // Send currently connected users.
    socket.emit("presence_snapshot", {
      onlineUserIds: [...userSockets.keys()],
    });

    // Only first tab changes
    // user to online.
    if (userSockets.get(userId)?.size === 1) {
      await broadcastPresence(io, userId, true);
    }

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

        const membership = await messageModel.isConversationMember(
          conversationId,
          userId,
        );

        if (!membership) {
          return reply({
            success: false,
            message: "You are not a member of this conversation",
          });
        }

        await socket.join(roomName(conversationId));

        // Delivery tracking should
        // never destroy the socket.
        try {
          await messageModel.markDelivered(conversationId, userId);
        } catch (deliveryError) {
          console.error("Mark delivered error:", deliveryError);
        }

        await emitToConversationMembers(
          io,
          conversationId,
          "message_delivered",
          {
            conversationId,
            userId,
          },
        );

        return reply({
          success: true,
          message: "Joined conversation",
          conversationId,
          role: membership.role,
        });
      } catch (error) {
        console.error("Join conversation error:", error);

        return reply({
          success: false,
          message: "Unable to join conversation",
        });
      }
    });

    socket.on("send_message", async (data = {}, callback) => {
      const reply = typeof callback === "function" ? callback : () => {};

      try {
        const conversationId = Number(data.conversationId);

        const content =
          typeof data.content === "string" ? data.content.trim() : "";

        const clientMessageId =
          typeof data.clientMessageId === "string"
            ? data.clientMessageId.slice(0, 100)
            : null;

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

        const membership = await messageModel.isConversationMember(
          conversationId,
          userId,
        );

        if (!membership) {
          return reply({
            success: false,
            message: "You are not a member of this conversation",
          });
        }

        const message = await messageModel.createMessage(
          conversationId,
          userId,
          content,
          clientMessageId,
        );

        try {
          await messageModel.ensureDeliveryRows(
            message.id,
            conversationId,
            userId,
          );
        } catch (deliveryError) {
          console.error("Create delivery rows error:", deliveryError);
        }

        await emitToConversationMembers(
          io,
          conversationId,
          "new_message",
          message,
        );

        return reply({
          success: true,
          message,
        });
      } catch (error) {
        console.error("Send message error:", error);

        return reply({
          success: false,
          message: "Unable to send message",
        });
      }
    });

    socket.on("typing_start", async (data = {}) => {
      try {
        const conversationId = Number(data.conversationId);

        const membership = await messageModel.isConversationMember(
          conversationId,
          userId,
        );

        if (!membership) {
          return;
        }

        await emitToConversationMembers(io, conversationId, "typing_start", {
          conversationId,
          userId,
        });
      } catch (error) {
        console.error("Typing start error:", error);
      }
    });

    socket.on("typing_stop", async (data = {}) => {
      try {
        const conversationId = Number(data.conversationId);

        const membership = await messageModel.isConversationMember(
          conversationId,
          userId,
        );

        if (!membership) {
          return;
        }

        await emitToConversationMembers(io, conversationId, "typing_stop", {
          conversationId,
          userId,
        });
      } catch (error) {
        console.error("Typing stop error:", error);
      }
    });

    socket.on("mark_read", async (data = {}, callback) => {
      const reply = typeof callback === "function" ? callback : () => {};

      try {
        const conversationId = Number(data.conversationId);

        const membership = await messageModel.isConversationMember(
          conversationId,
          userId,
        );

        if (!membership) {
          return reply({
            success: false,
            message: "You are not a member of this conversation",
          });
        }

        const latestId = await messageModel.markRead(conversationId, userId);

        await emitToConversationMembers(io, conversationId, "message_read", {
          conversationId,
          userId,
          messageId: latestId,
        });

        return reply({
          success: true,
          messageId: latestId,
        });
      } catch (error) {
        console.error("Mark read error:", error);

        return reply({
          success: false,
          message: "Unable to mark messages as read",
        });
      }
    });

    socket.on("edit_message", async (data = {}, callback) => {
      const reply = typeof callback === "function" ? callback : () => {};

      try {
        const messageId = Number(data.messageId);

        const content =
          typeof data.content === "string" ? data.content.trim() : "";

        if (!messageId) {
          return reply({
            success: false,
            message: "Valid message ID is required",
          });
        }

        if (!content || content.length > 5000) {
          return reply({
            success: false,
            message: "Message cannot be empty",
          });
        }

        const existing = await messageModel.getMessageById(messageId);

        if (!existing) {
          return reply({
            success: false,
            message: "Message not found",
          });
        }

        const membership = await messageModel.isConversationMember(
          existing.conversation_id,
          userId,
        );

        if (!membership) {
          return reply({
            success: false,
            message: "You are not a member of this conversation",
          });
        }

        const updated = await messageModel.editMessage(
          messageId,
          userId,
          content,
        );

        if (!updated) {
          return reply({
            success: false,
            message: "Only your own message can be edited",
          });
        }

        await emitToConversationMembers(
          io,
          updated.conversation_id,
          "message_edited",
          updated,
        );

        return reply({
          success: true,
          message: updated,
        });
      } catch (error) {
        console.error("Edit message error:", error);

        return reply({
          success: false,
          message: "Unable to edit message",
        });
      }
    });

    socket.on("delete_message", async (data = {}, callback) => {
      const reply = typeof callback === "function" ? callback : () => {};

      try {
        const messageId = Number(data.messageId);

        const existing = await messageModel.getMessageById(messageId);

        if (!existing) {
          return reply({
            success: false,
            message: "Message not found",
          });
        }

        const membership = await messageModel.isConversationMember(
          existing.conversation_id,
          userId,
        );

        if (!membership) {
          return reply({
            success: false,
            message: "You are not a member of this conversation",
          });
        }

        const deleted = await messageModel.deleteMessage(messageId, userId);

        if (!deleted) {
          return reply({
            success: false,
            message:
              "Message cannot be deleted. Only your own messages within 10 minutes can be deleted.",
          });
        }

        await emitToConversationMembers(
          io,
          deleted.conversation_id,
          "message_deleted",
          deleted,
        );

        return reply({
          success: true,
          message: deleted,
        });
      } catch (error) {
        console.error("Delete message error:", error);

        return reply({
          success: false,
          message: "Unable to delete message",
        });
      }
    });

    socket.on("react_message", async (data = {}, callback) => {
      const reply = typeof callback === "function" ? callback : () => {};

      try {
        const messageId = Number(data.messageId);

        const emoji = typeof data.emoji === "string" ? data.emoji.trim() : "";

        if (!messageId || !emoji) {
          return reply({
            success: false,
            message: "Message ID and emoji are required",
          });
        }

        const message = await messageModel.getMessageById(messageId);

        if (!message) {
          return reply({
            success: false,
            message: "Message not found",
          });
        }

        const membership = await messageModel.isConversationMember(
          message.conversation_id,
          userId,
        );

        if (!membership) {
          return reply({
            success: false,
            message: "You are not a member of this conversation",
          });
        }

        const existing = await pool.query(
          `SELECT id

                 FROM message_reactions

                 WHERE
                   message_id = $1
                   AND user_id = $2
                   AND emoji = $3`,
          [messageId, userId, emoji],
        );

        let reaction;

        if (existing.rowCount) {
          reaction = await messageModel.removeReaction(
            messageId,
            userId,
            emoji,
          );
        } else {
          reaction = await messageModel.addReaction(messageId, userId, emoji);
        }

        const payload = {
          messageId,

          conversationId: message.conversation_id,

          userId,

          emoji,

          action: existing.rowCount ? "removed" : "added",

          reaction,
        };

        await emitToConversationMembers(
          io,
          message.conversation_id,
          "message_reaction",
          payload,
        );

        return reply({
          success: true,
          ...payload,
        });
      } catch (error) {
        console.error("Reaction error:", error);

        return reply({
          success: false,
          message: "Unable to update reaction",
        });
      }
    });

    socket.on("disconnect", async (reason) => {
      const remaining = removeSocketForUser(userId, socket.id);

      console.log(
        "Socket disconnected:",
        socket.id,
        reason,
        "Remaining tabs:",
        remaining,
      );

      if (remaining === 0) {
        try {
          await userModels.updateLastSeen(userId);
        } catch (error) {
          console.error("Update last seen error:", error);
        }

        await broadcastPresence(io, userId, false);
      }
    });
  });
};

module.exports = socketHandler;
