const { pool } = require("../config/db");
const messageModel = require("../models/messageModel");
const userModels = require("../models/userModels");

const userSockets = new Map();

const roomName = (conversationId) => `conversation:${conversationId}`;

const normalizePayload = (data) => {
  if (data === null || data === undefined) {
    return {};
  }

  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return {
        conversationId: data,
      };
    }
  }

  if (typeof data === "number") {
    return {
      conversationId: data,
    };
  }

  if (typeof data === "object") {
    return data;
  }

  return {};
};

const getConversationId = (data) => {
  const payload = normalizePayload(data);

  const value =
    payload.conversationId ??
    payload.conversation_id ??
    payload.id;

  const conversationId = Number(value);

  if (!Number.isInteger(conversationId) || conversationId <= 0) {
    return null;
  }

  return conversationId;
};

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
  payload
) => {
  const members = await messageModel.getConversationMemberIds(
    conversationId
  );

  for (const member of members) {
    emitToUser(io, member.user_id, event, payload);
  }
};

const broadcastPresence = async (io, userId, online) => {
  try {
    const user = await userModels.getUserById(userId);

    io.emit("presence_update", {
      userId: Number(userId),
      online,
      status: online ? "online" : "offline",
      lastSeen: user?.last_seen || null,
    });
  } catch (error) {
    console.error("Broadcast presence error:", error);

    io.emit("presence_update", {
      userId: Number(userId),
      online,
      status: online ? "online" : "offline",
      lastSeen: null,
    });
  }
};

const socketHandler = (io) => {
  io.on("connection", async (socket) => {
    try {
      const userId = Number(socket.user?.id);

      if (!userId) {
        socket.disconnect(true);
        return;
      }

      const user = await userModels.getUserById(userId);

      socket.user.name = user?.name || `User ${userId}`;

      addSocketForUser(userId, socket.id);

      console.log(
        "Socket connected:",
        socket.id,
        "User:",
        userId,
        "Open tabs:",
        userSockets.get(userId)?.size
      );

      await pool
        .query(
          `UPDATE users
           SET last_seen = NULL
           WHERE id = $1`,
          [userId]
        )
        .catch(() => {});

      const onlineUserIds = [...userSockets.keys()].map(Number);

      socket.emit("presence_snapshot", {
        onlineUserIds,
        onlineUsers: onlineUserIds,
      });

      if (userSockets.get(userId)?.size === 1) {
        await broadcastPresence(io, userId, true);
      }

      socket.on("join_conversation", async (data = {}, callback) => {
        const reply =
          typeof callback === "function" ? callback : () => {};

        try {
          const conversationId = getConversationId(data);

          if (!conversationId) {
            return reply({
              success: false,
              message: "Valid conversation ID is required",
            });
          }

          const membership =
            await messageModel.isConversationMember(
              conversationId,
              userId
            );

          if (!membership) {
            return reply({
              success: false,
              message:
                "You are not a member of this conversation",
            });
          }

          await socket.join(roomName(conversationId));

          try {
            await messageModel.markDelivered(
              conversationId,
              userId
            );
          } catch (error) {
            console.error(
              "Mark delivered error:",
              error
            );
          }

          try {
            await emitToConversationMembers(
              io,
              conversationId,
              "message_delivered",
              {
                conversationId,
                userId,
              }
            );
          } catch (error) {
            console.error(
              "Delivery broadcast error:",
              error
            );
          }

          return reply({
            success: true,
            conversationId,
            role: membership.role,
          });
        } catch (error) {
          console.error(
            "Join conversation error:",
            error
          );

          return reply({
            success: false,
            message: "Unable to join conversation",
          });
        }
      });

      socket.on("send_message", async (data = {}, callback) => {
        const reply =
          typeof callback === "function" ? callback : () => {};

        try {
          const payload = normalizePayload(data);

          const conversationId =
            getConversationId(payload);

          const content =
            typeof payload.content === "string"
              ? payload.content.trim()
              : "";

          const clientMessageId =
            typeof payload.clientMessageId === "string"
              ? payload.clientMessageId
                  .trim()
                  .slice(0, 100)
              : null;

          if (!conversationId) {
            return reply({
              success: false,
              message:
                "Valid conversation ID is required",
            });
          }

          if (!content || content.length > 5000) {
            return reply({
              success: false,
              message:
                "Message must contain 1 to 5000 characters",
            });
          }

          const membership =
            await messageModel.isConversationMember(
              conversationId,
              userId
            );

          if (!membership) {
            return reply({
              success: false,
              message:
                "You are not a member of this conversation",
            });
          }

          if (clientMessageId) {
            const existing = await pool.query(
              `SELECT
                id,
                conversation_id,
                sender_id,
                content,
                client_message_id,
                created_at,
                updated_at,
                edited,
                deleted_at
               FROM messages
               WHERE client_message_id = $1
               LIMIT 1`,
              [clientMessageId]
            );

            if (existing.rows[0]) {
              const previous = existing.rows[0];

              if (
                Number(previous.sender_id) !== userId ||
                Number(previous.conversation_id) !==
                  conversationId
              ) {
                return reply({
                  success: false,
                  message:
                    "Invalid client message ID",
                });
              }

              return reply({
                success: true,
                duplicate: true,
                data: {
                  ...previous,
                  sender_name:
                    socket.user.name,
                  reactions: [],
                },
              });
            }
          }

          const message =
            await messageModel.createMessage(
              conversationId,
              userId,
              content,
              clientMessageId
            );

          try {
            await messageModel.ensureDeliveryRows(
              message.id,
              conversationId,
              userId
            );
          } catch (error) {
            console.error(
              "Ensure delivery rows error:",
              error
            );
          }

          await pool.query(
            `UPDATE conversations
             SET updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [conversationId]
          );

          const messageForClient = {
            ...message,
            sender_name: socket.user.name,
            reactions: [],
          };

          await emitToConversationMembers(
            io,
            conversationId,
            "new_message",
            messageForClient
          );

          return reply({
            success: true,
            message:
              "Message sent successfully",
            data: messageForClient,
          });
        } catch (error) {
          console.error(
            "Socket send_message error:",
            error
          );

          return reply({
            success: false,
            message:
              "Unable to send message",
          });
        }
      });

      socket.on("typing_start", async (data = {}) => {
        try {
          const conversationId =
            getConversationId(data);

          if (!conversationId) {
            return;
          }

          const membership =
            await messageModel.isConversationMember(
              conversationId,
              userId
            );

          if (!membership) {
            return;
          }

          const now = Date.now();

          if (!socket._typingTimes) {
            socket._typingTimes = new Map();
          }

          const last =
            socket._typingTimes.get(
              conversationId
            ) || 0;

          if (now - last < 500) {
            return;
          }

          socket._typingTimes.set(
            conversationId,
            now
          );

          socket
            .to(roomName(conversationId))
            .emit("typing_start", {
              conversationId,
              userId,
              name: socket.user.name,
            });
        } catch (error) {
          console.error(
            "Typing start error:",
            error
          );
        }
      });

      socket.on("typing_stop", async (data = {}) => {
        try {
          const conversationId =
            getConversationId(data);

          if (!conversationId) {
            return;
          }

          const membership =
            await messageModel.isConversationMember(
              conversationId,
              userId
            );

          if (!membership) {
            return;
          }

          socket
            .to(roomName(conversationId))
            .emit("typing_stop", {
              conversationId,
              userId,
            });
        } catch (error) {
          console.error(
            "Typing stop error:",
            error
          );
        }
      });

      socket.on(
        "mark_read",
        async (data = {}, callback) => {
          const reply =
            typeof callback === "function"
              ? callback
              : () => {};

          try {
            const payload =
              normalizePayload(data);

            const conversationId =
              getConversationId(payload);

            if (!conversationId) {
              return reply({
                success: false,
                message:
                  "Valid conversation ID is required",
              });
            }

            const membership =
              await messageModel.isConversationMember(
                conversationId,
                userId
              );

            if (!membership) {
              return reply({
                success: false,
                message:
                  "You are not a member of this conversation",
              });
            }

            const lastReadMessageId =
              await messageModel.markRead(
                conversationId,
                userId
              );

            const summary =
              lastReadMessageId
                ? await messageModel.getReadSummary(
                    conversationId,
                    lastReadMessageId
                  )
                : null;

            const readPayload = {
              conversationId,
              userId,
              lastReadMessageId,
              summary,
            };

            await emitToConversationMembers(
              io,
              conversationId,
              "message_read",
              readPayload
            );

            return reply({
              success: true,
              ...readPayload,
            });
          } catch (error) {
            console.error(
              "Mark read error:",
              error
            );

            return reply({
              success: false,
              message:
                "Unable to mark messages as read",
            });
          }
        }
      );

      socket.on(
        "edit_message",
        async (data = {}, callback) => {
          const reply =
            typeof callback === "function"
              ? callback
              : () => {};

          try {
            const payload =
              normalizePayload(data);

            const messageId = Number(
              payload.messageId
            );

            const content =
              typeof payload.content === "string"
                ? payload.content.trim()
                : "";

            if (
              !messageId ||
              !content ||
              content.length > 5000
            ) {
              return reply({
                success: false,
                message:
                  "Valid message ID and content are required",
              });
            }

            const existing =
              await messageModel.getMessageById(
                messageId
              );

            if (
              !existing ||
              Number(existing.sender_id) !==
                userId
            ) {
              return reply({
                success: false,
                message:
                  "You can edit only your own messages",
              });
            }

            const membership =
              await messageModel.isConversationMember(
                existing.conversation_id,
                userId
              );

            if (!membership) {
              return reply({
                success: false,
                message:
                  "You are not a member of this conversation",
              });
            }

            const updated =
              await messageModel.editMessage(
                messageId,
                userId,
                content
              );

            if (!updated) {
              return reply({
                success: false,
                message:
                  "Message cannot be edited",
              });
            }

            await emitToConversationMembers(
              io,
              updated.conversation_id,
              "message_edited",
              updated
            );

            return reply({
              success: true,
              data: updated,
            });
          } catch (error) {
            console.error(
              "Edit message error:",
              error
            );

            return reply({
              success: false,
              message:
                "Unable to edit message",
            });
          }
        }
      );

      socket.on(
        "delete_message",
        async (data = {}, callback) => {
          const reply =
            typeof callback === "function"
              ? callback
              : () => {};

          try {
            const payload =
              normalizePayload(data);

            const messageId = Number(
              payload.messageId
            );

            if (!messageId) {
              return reply({
                success: false,
                message:
                  "Valid message ID is required",
              });
            }

            const existing =
              await messageModel.getMessageById(
                messageId
              );

            if (
              !existing ||
              Number(existing.sender_id) !==
                userId
            ) {
              return reply({
                success: false,
                message:
                  "You can delete only your own messages",
              });
            }

            const membership =
              await messageModel.isConversationMember(
                existing.conversation_id,
                userId
              );

            if (!membership) {
              return reply({
                success: false,
                message:
                  "You are not a member of this conversation",
              });
            }

            const deleted =
              await messageModel.deleteMessage(
                messageId,
                userId
              );

            if (!deleted) {
              return reply({
                success: false,
                message:
                  "Message can be deleted only within 10 minutes",
              });
            }

            await emitToConversationMembers(
              io,
              deleted.conversation_id,
              "message_deleted",
              deleted
            );

            return reply({
              success: true,
              data: deleted,
            });
          } catch (error) {
            console.error(
              "Delete message error:",
              error
            );

            return reply({
              success: false,
              message:
                "Unable to delete message",
            });
          }
        }
      );

      socket.on(
        "react_message",
        async (data = {}, callback) => {
          const reply =
            typeof callback === "function"
              ? callback
              : () => {};

          try {
            const payload =
              normalizePayload(data);

            const messageId = Number(
              payload.messageId
            );

            const emoji =
              typeof payload.emoji === "string"
                ? payload.emoji
                    .trim()
                    .slice(0, 20)
                : "";

            if (!messageId || !emoji) {
              return reply({
                success: false,
                message:
                  "messageId and emoji are required",
              });
            }

            const message =
              await messageModel.getMessageById(
                messageId
              );

            if (!message) {
              return reply({
                success: false,
                message: "Message not found",
              });
            }

            const membership =
              await messageModel.isConversationMember(
                message.conversation_id,
                userId
              );

            if (!membership) {
              return reply({
                success: false,
                message:
                  "You are not a member of this conversation",
              });
            }

            const existing =
              await pool.query(
                `SELECT id
                 FROM message_reactions
                 WHERE message_id = $1
                 AND user_id = $2
                 AND emoji = $3`,
                [
                  messageId,
                  userId,
                  emoji,
                ]
              );

            let reaction;

            if (existing.rowCount) {
              reaction =
                await messageModel.removeReaction(
                  messageId,
                  userId,
                  emoji
                );
            } else {
              reaction =
                await messageModel.addReaction(
                  messageId,
                  userId,
                  emoji
                );
            }

            const reactionPayload = {
              messageId,
              conversationId:
                message.conversation_id,
              userId,
              emoji,
              action: existing.rowCount
                ? "removed"
                : "added",
              reaction,
            };

            await emitToConversationMembers(
              io,
              message.conversation_id,
              "message_reaction",
              reactionPayload
            );

            return reply({
              success: true,
              ...reactionPayload,
            });
          } catch (error) {
            console.error(
              "Reaction error:",
              error
            );

            return reply({
              success: false,
              message:
                "Unable to update reaction",
            });
          }
        }
      );

      socket.on("disconnect", async (reason) => {
        const remaining =
          removeSocketForUser(
            userId,
            socket.id
          );

        console.log(
          "Socket disconnected:",
          socket.id,
          reason,
          "Remaining tabs:",
          remaining
        );

        if (remaining === 0) {
          try {
            const lastSeen = new Date();

            await pool.query(
              `UPDATE users
               SET last_seen = $1
               WHERE id = $2`,
              [lastSeen, userId]
            );

            await broadcastPresence(
              io,
              userId,
              false
            );
          } catch (error) {
            console.error(
              "Update last seen error:",
              error
            );
          }
        }
      });
    } catch (error) {
      console.error(
        "Socket connection setup error:",
        error
      );

      socket.disconnect(true);
    }
  });
};

module.exports = socketHandler;