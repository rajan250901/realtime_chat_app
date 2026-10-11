const messageModel = require("../models/messageModel");


// =============================
// SEND MESSAGE
// =============================

const sendMessage = async (req, res) => {

    try {

        const { conversationId, content } = req.body;

        const senderId = req.user.id;

        if (!conversationId || !content) {
            return res.status(400).json({
                success: false,
                message: "conversationId and content are required"
            });
        }


        // Check conversation membership
        const isMember =
            await messageModel.isConversationMember(
                conversationId,
                senderId
            );


        if (!isMember) {
            return res.status(403).json({
                success: false,
                message: "You are not a member of this conversation"
            });
        }


        // Create message
        const message =
            await messageModel.createMessage(
                conversationId,
                senderId,
                content
            );


        return res.status(201).json({
            success: true,
            message: "Message sent successfully",
            data: message
        });


    } catch (error) {

        console.error("Send message error:", error);

        return res.status(500).json({
            success: false,
            message: "Error sending message"
        });
    }
};



// =============================
// GET MESSAGES
// =============================

const getMessages = async (req, res) => {

    try {

        const { conversationId } = req.params;

        const userId = req.user.id;

        const limit = Math.min(
            Number(req.query.limit) || 20,
            50
        );

        const before = req.query.before || null;


        if (!conversationId) {
            return res.status(400).json({
                success: false,
                message: "Conversation ID is required"
            });
        }


        const isMember =
            await messageModel.isConversationMember(
                conversationId,
                userId
            );


        if (!isMember) {
            return res.status(403).json({
                success: false,
                message: "You are not a member of this conversation"
            });
        }


        const messages =
            await messageModel.getMessages(
                conversationId,
                limit,
                before
            );


        return res.status(200).json({
            success: true,
            message: "Messages fetched successfully",
            data: messages,
            pagination: {
                limit,
                before,
                hasMore: messages.length === limit
            }
        });


    } catch (error) {

        console.error("Get messages error:", error);

        return res.status(500).json({
            success: false,
            message: "Error fetching messages"
        });
    }
};


module.exports = {
    sendMessage,
    getMessages
};