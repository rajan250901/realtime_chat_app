import api from "./api";

export const createDirectConversation = async (userId) => {
  const response = await api.post("/conversations/direct", { userId });
  return response.data;
};

export const getUserConversations = async () => {
  const response = await api.get("/conversations");
  return response.data;
};
