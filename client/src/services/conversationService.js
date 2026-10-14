import api from "./api";

export const createDirectConversation = async (userId) => {
  const response = await api.post("/conversations/direct", {
    userId,
  });

  return response.data;
};

export const getUserConversations = async () => {
  const response = await api.get("/conversations");

  return response.data;
};

export const getGroupInfo = async (conversationId) => {
  const response = await api.get(`/groups/${conversationId}`);

  return response.data;
};

export const createGroup = async (name, memberIds = []) => {
  const response = await api.post("/groups", {
    name,
    memberIds,
  });

  return response.data;
};

export const addGroupMember = async (conversationId, userId) => {
  const response = await api.post(`/groups/${conversationId}/members`, {
    userId,
  });

  return response.data;
};

export const removeGroupMember = async (conversationId, userId) => {
  const response = await api.delete(
    `/groups/${conversationId}/members/${userId}`,
  );

  return response.data;
};

export const updateGroupName = async (conversationId, name) => {
  const response = await api.patch(`/groups/${conversationId}/name`, {
    name,
  });

  return response.data;
};

export const updateGroupRole = async (conversationId, userId, role) => {
  const response = await api.patch(
    `/groups/${conversationId}/members/${userId}/role`,
    {
      role,
    },
  );

  return response.data;
};

export const transferGroupOwnership = async (conversationId, userId) => {
  const response = await api.post(`/groups/${conversationId}/transfer-owner`, {
    userId,
  });

  return response.data;
};

export const deleteGroup = async (conversationId) => {
  const response = await api.delete(`/groups/${conversationId}`);

  return response.data;
};
