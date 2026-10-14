const { pool } = require("../config/db");
const messageModel = require("../models/messageModel");

const userSockets = new Map();

const getConversationMemberIds = async (conversationId) => {
  const result = await pool.query(`SELECT user_id FROM conversation_members WHERE conversation_id = $1`, [conversationId]);
  return result.rows.map((row) => Number(row.user_id));
};

const emitToConversationMembers = async (io, conversationId, event, payload) => {
  const memberIds = await getConversationMemberIds(conversationId);
  for (const memberId of memberIds) {
    const sockets = userSockets.get(memberId);
    if (!sockets) continue;
    for (const socketId of sockets) io.to(socketId).emit(event, payload);
  }
};

const socketHandler = (io) => {
  io.on("connection", async (socket) => {
    const userId = Number(socket.user?.id);
    if (!userId) return socket.disconnect(true);

    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId).add(socket.id);

    await pool.query(`UPDATE users SET last_seen = NULL WHERE id = $1`, [userId]).catch(() => {});

    const onlineUsers = [...userSockets.keys()].map(Number);
    socket.emit("presence_snapshot", { onlineUsers });
    socket.broadcast.emit("presence_update", { userId, status: "online", lastSeen: null });

    socket.on("join_conversation", async (data = {}, callback) => {
      const reply = typeof callback === "function" ? callback : () => {};
      try {
        const conversationId = Number(data.conversationId);
        if (!Number.isInteger(conversationId) || conversationId <= 0) return reply({ success: false, message: "Valid conversation ID is required" });
        const member = await messageModel.isConversationMember(conversationId, userId);
        if (!member) return reply({ success: false, message: "You are not a member of this conversation" });
        await socket.join(`conversation:${conversationId}`);
        return reply({ success: true, conversationId, role: member.role });
      } catch (error) { console.error("join_conversation error", error); return reply({ success: false, message: "Unable to join conversation" }); }
    });

    socket.on("send_message", async (data = {}, callback) => {
      const reply = typeof callback === "function" ? callback : () => {};
      try {
        const conversationId = Number(data.conversationId);
        const content = typeof data.content === "string" ? data.content.trim() : "";
        const clientMessageId = typeof data.clientMessageId === "string" ? data.clientMessageId : null;
        if (!Number.isInteger(conversationId) || !content || content.length > 5000) return reply({ success: false, message: "Valid conversationId and message are required" });
        const member = await messageModel.isConversationMember(conversationId, userId);
        if (!member) return reply({ success: false, message: "You are not a member of this conversation" });

        const message = await messageModel.createMessage(conversationId, userId, content, clientMessageId);
        const members = await getConversationMemberIds(conversationId);
        for (const memberId of members) {
          if (memberId !== userId && userSockets.has(memberId)) {
            await messageModel.markDelivered(message.id, memberId);
          }
        }
        await pool.query(`UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [conversationId]);
        await emitToConversationMembers(io, conversationId, "new_message", message);
        return reply({ success: true, data: message });
      } catch (error) { console.error("send_message error", error); return reply({ success: false, message: "Unable to send message" }); }
    });

    socket.on("typing_start", async (data = {}) => {
      const conversationId = Number(data.conversationId);
      if (!Number.isInteger(conversationId)) return;
      const member = await messageModel.isConversationMember(conversationId, userId);
      if (!member) return;
      socket.to(`conversation:${conversationId}`).emit("typing_start", { conversationId, userId });
    });

    socket.on("typing_stop", async (data = {}) => {
      const conversationId = Number(data.conversationId);
      if (!Number.isInteger(conversationId)) return;
      const member = await messageModel.isConversationMember(conversationId, userId);
      if (!member) return;
      socket.to(`conversation:${conversationId}`).emit("typing_stop", { conversationId, userId });
    });

    socket.on("mark_read", async (data = {}) => {
      const conversationId = Number(data.conversationId);
      const messageId = Number(data.messageId);
      if (!conversationId || !messageId) return;
      try {
        const member = await messageModel.isConversationMember(conversationId, userId);
        if (!member) return;
        const read = await messageModel.markRead(conversationId, userId, messageId);
        if (!read) return;
        await emitToConversationMembers(io, conversationId, "message_read", { ...read, userId });
      } catch (error) { console.error("mark_read error", error); }
    });

    socket.on("edit_message", async (data = {}, callback) => {
      const reply = typeof callback === "function" ? callback : () => {};
      try {
        const messageId = Number(data.messageId);
        const content = typeof data.content === "string" ? data.content.trim() : "";
        if (!messageId || !content || content.length > 5000) return reply({ success: false, message: "Invalid message" });
        const messageBefore = await messageModel.getMessageById(messageId);
        if (!messageBefore || Number(messageBefore.sender_id) !== userId) return reply({ success: false, message: "You can edit only your own message" });
        const updated = await messageModel.editMessage(messageId, userId, content);
        if (!updated) return reply({ success: false, message: "Message can only be edited within 10 minutes" });
        await emitToConversationMembers(io, updated.conversation_id, "message_edited", updated);
        reply({ success: true, data: updated });
      } catch (error) { console.error("edit_message error", error); reply({ success: false, message: "Unable to edit message" }); }
    });

    socket.on("delete_message", async (data = {}, callback) => {
      const reply = typeof callback === "function" ? callback : () => {};
      try {
        const messageId = Number(data.messageId);
        const messageBefore = await messageModel.getMessageById(messageId);
        if (!messageBefore || Number(messageBefore.sender_id) !== userId) return reply({ success: false, message: "You can delete only your own message" });
        const deleted = await messageModel.deleteMessage(messageId, userId);
        if (!deleted) return reply({ success: false, message: "Message can only be deleted within 10 minutes" });
        await emitToConversationMembers(io, deleted.conversation_id, "message_deleted", deleted);
        reply({ success: true, data: deleted });
      } catch (error) { console.error("delete_message error", error); reply({ success: false, message: "Unable to delete message" }); }
    });

    socket.on("react_message", async (data = {}, callback) => {
      const reply = typeof callback === "function" ? callback : () => {};
      try {
        const messageId = Number(data.messageId);
        const emoji = typeof data.emoji === "string" ? data.emoji.trim().slice(0, 32) : "";
        const message = await messageModel.getMessageById(messageId);
        if (!message) return reply({ success: false, message: "Message not found" });
        const member = await messageModel.isConversationMember(message.conversation_id, userId);
        if (!member) return reply({ success: false, message: "You are not a member of this conversation" });
        const reactions = await messageModel.toggleReaction(messageId, userId, emoji);
        await emitToConversationMembers(io, message.conversation_id, "message_reaction", { messageId, reactions });
        reply({ success: true, reactions });
      } catch (error) { console.error("react_message error", error); reply({ success: false, message: "Unable to react" }); }
    });

    socket.on("disconnect", async (reason) => {
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size > 0) return;
        userSockets.delete(userId);
      }
      const lastSeen = new Date();
      await pool.query(`UPDATE users SET last_seen = $1 WHERE id = $2`, [lastSeen, userId]).catch(() => {});
      socket.broadcast.emit("presence_update", { userId, status: "offline", lastSeen: lastSeen.toISOString() });
      console.log("Socket disconnected:", socket.id, reason, "User:", userId);
    });
  });
};

module.exports = socketHandler;
