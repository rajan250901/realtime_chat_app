const userModels = require("../models/userModels");

const getCurrentUser = async (req, res) => {
  try {
    const user = await userModels.getUserById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    return res.json({ success: true, user });
  } catch (error) { console.error("Get current user error:", error); return res.status(500).json({ success: false, message: "Error getting current user" }); }
};

const searchUsersController = async (req, res) => {
  try {
    const search = req.query.search?.trim();
    if (!search) return res.status(400).json({ success: false, message: "Please provide search text" });
    const users = await userModels.searchUsers(search, req.user.id);
    return res.json({ success: true, users });
  } catch (error) { console.error("Search users error:", error); return res.status(500).json({ success: false, message: "Error searching users" }); }
};

module.exports = { getCurrentUser, searchUsersController };
