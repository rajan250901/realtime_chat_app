const conversationModel = require("../models/conversationModel");

const createDirectConversation = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "userId is required",
            });
        }

        if (Number(userId) === Number(currentUserId)) {
            return res.status(400).json({
                success: false,
                message: "You cannot create a conversation with yourself",
            });
        }

        const existingConversation =
            await conversationModel.findDirectConversation(
                currentUserId,
                userId,
            );

        if (existingConversation) {
            return res.status(200).json({
                success: true,
                message: "Conversation already exists",
                conversation: existingConversation,
            });
        }

        const conversation = await conversationModel.createDirectConversation(
            currentUserId,
            userId,
        );

        return res.status(201).json({
            success: true,
            message: "Direct conversation created",
            conversation,
        });
    } catch (error) {
        console.error("Create conversation error:", error);

        return res.status(500).json({
            success: false,
            message: "Error creating conversation",
        });
    }
};

const createGroup = async (req, res) => {
    try {
        const currentUserId = req.user.id;

        const { name, memberIds = [] } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Group name is required",
            });
        }

        if (!Array.isArray(memberIds)) {
            return res.status(400).json({
                success: false,
                message: "memberIds must be an array",
            });
        }

        const group = await conversationModel.createGroupConversation(
            currentUserId,
            name.trim(),
            memberIds,
        );

        const members = await conversationModel.getGroupMembers(group.id);

        return res.status(201).json({
            success: true,
            message: "Group created successfully",
            group: {
                ...group,
                members,
                user: null,
            },
        });
    } catch (error) {
        console.error("Create group error:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Unable to create group",
        });
    }
};

const getUserConversations = async (req, res) => {
    try {
        const conversations = await conversationModel.getUserConversations(
            req.user.id,
        );

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

const getConversation = async (req, res) => {
    try {
        const conversationId = Number(req.params.id);

        if (!Number.isInteger(conversationId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid conversation ID",
            });
        }

        const conversation = await conversationModel.getConversationById(
            conversationId,
            req.user.id,
        );

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: "Conversation not found",
            });
        }

        let members = [];

        if (conversation.type === "group") {
            members = await conversationModel.getGroupMembers(conversationId);
        }

        return res.status(200).json({
            success: true,
            conversation: {
                ...conversation,
                members,
            },
        });
    } catch (error) {
        console.error("Get conversation error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to load conversation",
        });
    }
};

const renameGroup = async (req, res) => {
    try {
        const conversationId = Number(req.params.id);

        const { name } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Group name is required",
            });
        }

        const conversation = await conversationModel.getConversationById(
            conversationId,
            req.user.id,
        );

        if (!conversation || conversation.type !== "group") {
            return res.status(404).json({
                success: false,
                message: "Group not found",
            });
        }

        if (!["owner", "admin"].includes(conversation.my_role)) {
            return res.status(403).json({
                success: false,
                message: "You do not have permission to rename this group",
            });
        }

        const updated = await conversationModel.updateGroupName(
            conversationId,
            name.trim(),
        );

        return res.status(200).json({
            success: true,
            conversation: updated,
        });
    } catch (error) {
        console.error("Rename group error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to rename group",
        });
    }
};

const deleteGroup = async (req, res) => {
    try {
        const conversationId = Number(req.params.id);

        const conversation = await conversationModel.getConversationById(
            conversationId,
            req.user.id,
        );

        if (!conversation || conversation.type !== "group") {
            return res.status(404).json({
                success: false,
                message: "Group not found",
            });
        }

        if (conversation.my_role !== "owner") {
            return res.status(403).json({
                success: false,
                message: "Only the owner can delete the group",
            });
        }

        await conversationModel.deleteGroupConversation(conversationId);

        return res.status(200).json({
            success: true,
            message: "Group deleted successfully",
            conversationId,
        });
    } catch (error) {
        console.error("Delete group error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to delete group",
        });
    }
};

const removeMember = async (req, res) => {
    try {
        const conversationId = Number(req.params.id);

        const userId = Number(req.params.userId);

        const conversation = await conversationModel.getConversationById(
            conversationId,
            req.user.id,
        );

        if (!conversation || conversation.type !== "group") {
            return res.status(404).json({
                success: false,
                message: "Group not found",
            });
        }

        if (!["owner", "admin"].includes(conversation.my_role)) {
            return res.status(403).json({
                success: false,
                message: "You do not have permission to remove members",
            });
        }

        const member = await conversationModel.getGroupMembers(conversationId);

        const target = member.find((item) => Number(item.id) === userId);

        if (!target) {
            return res.status(404).json({
                success: false,
                message: "Member not found",
            });
        }

        if (target.role === "owner") {
            return res.status(403).json({
                success: false,
                message: "The owner cannot be removed",
            });
        }

        if (conversation.my_role === "admin" && target.role === "admin") {
            return res.status(403).json({
                success: false,
                message: "Admin cannot remove another admin",
            });
        }

        const removed = await conversationModel.removeGroupMember(
            conversationId,
            userId,
        );

        return res.status(200).json({
            success: true,
            message: "Member removed successfully",
            member: removed,
        });
    } catch (error) {
        console.error("Remove member error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to remove member",
        });
    }
};

const promoteMember = async (req, res) => {
    try {
        const conversationId = Number(req.params.id);

        const userId = Number(req.params.userId);

        const conversation = await conversationModel.getConversationById(
            conversationId,
            req.user.id,
        );

        if (!conversation || conversation.type !== "group") {
            return res.status(404).json({
                success: false,
                message: "Group not found",
            });
        }

        if (conversation.my_role !== "owner") {
            return res.status(403).json({
                success: false,
                message: "Only the owner can promote members",
            });
        }

        const updated = await conversationModel.updateMemberRole(
            conversationId,
            userId,
            "admin",
        );

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: "Member not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Member promoted successfully",
            member: updated,
        });
    } catch (error) {
        console.error("Promote member error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to promote member",
        });
    }
};

const demoteMember = async (req, res) => {
    try {
        const conversationId = Number(req.params.id);

        const userId = Number(req.params.userId);

        const conversation = await conversationModel.getConversationById(
            conversationId,
            req.user.id,
        );

        if (!conversation || conversation.type !== "group") {
            return res.status(404).json({
                success: false,
                message: "Group not found",
            });
        }

        if (conversation.my_role !== "owner") {
            return res.status(403).json({
                success: false,
                message: "Only the owner can demote members",
            });
        }

        const updated = await conversationModel.updateMemberRole(
            conversationId,
            userId,
            "member",
        );

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: "Member not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Member demoted successfully",
            member: updated,
        });
    } catch (error) {
        console.error("Demote member error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to demote member",
        });
    }
};

const transferOwnership = async (req, res) => {
    try {
        const conversationId = Number(req.params.id);

        const userId = Number(req.params.userId);

        const conversation = await conversationModel.getConversationById(
            conversationId,
            req.user.id,
        );

        if (!conversation || conversation.type !== "group") {
            return res.status(404).json({
                success: false,
                message: "Group not found",
            });
        }

        if (conversation.my_role !== "owner") {
            return res.status(403).json({
                success: false,
                message: "Only the owner can transfer ownership",
            });
        }

        if (Number(req.user.id) === userId) {
            return res.status(400).json({
                success: false,
                message: "You are already the owner",
            });
        }

        await conversationModel.transferOwnership(
            conversationId,
            req.user.id,
            userId,
        );

        return res.status(200).json({
            success: true,
            message: "Ownership transferred successfully",
        });
    } catch (error) {
        console.error("Transfer ownership error:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Unable to transfer ownership",
        });
    }
};

module.exports = {
    getUserConversations,
    createDirectConversation,
    createGroup,
    getConversation,
    renameGroup,
    deleteGroup,
    removeMember,
    promoteMember,
    demoteMember,
    transferOwnership,
};
