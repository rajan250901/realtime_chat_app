const messageModel = require("../models/messageModel");

const sendMessage = async (req, res) => {
  try {
    const conversationId = Number(req.body.conversationId);
    const content = typeof req.body.content === "string" ? req.body.content.trim() : "";
    const clientMessageId = req.body.clientMessageId || null;
    if (!Number.isInteger(conversationId) || !content || content.length > 5000) return res.status(400).json({ success: false, message: "Valid conversationId and message are required" });
    const member = await messageModel.isConversationMember(conversationId, req.user.id);
    if (!member) return res.status(403).json({ success: false, message: "You are not a member of this conversation" });
    const message = await messageModel.createMessage(conversationId, req.user.id, content, clientMessageId);
    await messageModel.markDelivered(message.id, req.user.id);
    return res.status(201).json({ success: true, data: message });
  } catch (error) { console.error("Send message error:", error); return res.status(500).json({ success: false, message: "Error sending message" }); }
};

const getMessages = async (req, res) => {
  try {
    const conversationId = Number(req.params.conversationId);
    const member = await messageModel.isConversationMember(conversationId, req.user.id);
    if (!member) return res.status(403).json({ success: false, message: "You are not a member of this conversation" });
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 50);
    const messages = await messageModel.getMessages(conversationId, req.user.id, limit, req.query.before || null);
    return res.json({ success: true, data: messages.reverse(), pagination: { limit, hasMore: messages.length === limit, nextCursor: messages.length ? messages[0].id : null } });
  } catch (error) { console.error("Get messages error:", error); return res.status(500).json({ success: false, message: "Error fetching messages" }); }
};

module.exports = { sendMessage, getMessages };
