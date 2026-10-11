const conversationModel = require("../models/conversationModel");

const createDirectConversation = async (req, res) => {

    try {

        const currentUserId = req.user.id;

        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "userId is required"
            });
        }

        if (Number(userId) === Number(currentUserId)) {
            return res.status(400).json({
                success: false,
                message: "You cannot create a conversation with yourself"
            });
        }

        // Check whether conversation already exists
        const existingConversation =
            await conversationModel.findDirectConversation(
                currentUserId,
                userId
            );

        if (existingConversation) {

            return res.status(200).json({
                success: true,
                message: "Conversation already exists",
                conversation: existingConversation
            });
        }

        // Create new conversation
        const conversation =
            await conversationModel.createDirectConversation(
                currentUserId,
                userId
            );

        return res.status(201).json({
            success: true,
            message: "Direct conversation created",
            conversation
        });

    } catch (error) {

        console.error("Create conversation error:", error);

        return res.status(500).json({
            success: false,
            message: "Error creating conversation"
        });
    }
};


// const conversationModel = require("../models/conversationModel");

const getUserConversations = async (req, res) => {
  try {
    const conversations =
      await conversationModel.getUserConversations(req.user.id);

    return res.status(200).json({
      success: true,
      conversations,
    });
  } catch (error) {
    console.error("Get conversations error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch conversations",
    });
  }
};

module.exports = {
  // Apne existing exports ko bhi yahan preserve karna.
  getUserConversations,createDirectConversation
};
