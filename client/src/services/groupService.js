import api from "./api";

export const createGroup = async (name, memberIds = []) => {
  const response = await api.post("/groups", {
    name,
    memberIds,
  });

  return response.data;
};

export const getGroupInfo = async (conversationId) => {
  const response = await api.get(`/groups/${conversationId}`);

  return response.data;
};

export const addMember = async (conversationId, userId) => {
  const response = await api.post(`/groups/${conversationId}/members`, {
    userId,
  });

  return response.data;
};

export const removeMember = async (conversationId, userId) => {
  const response = await api.delete(
    `/groups/${conversationId}/members/${userId}`,
  );

  return response.data;
};

export const renameGroup = async (conversationId, name) => {
  const response = await api.patch(`/groups/${conversationId}/name`, {
    name,
  });

  return response.data;
};

export const promoteMember = async (conversationId, userId) => {
  const response = await api.patch(
    `/groups/${conversationId}/members/${userId}/role`,
    {
      role: "admin",
    },
  );

  return response.data;
};

export const demoteMember = async (conversationId, userId) => {
  const response = await api.patch(
    `/groups/${conversationId}/members/${userId}/role`,
    {
      role: "member",
    },
  );

  return response.data;
};

export const transferOwnership = async (conversationId, userId) => {
  const response = await api.post(`/groups/${conversationId}/transfer-owner`, {
    userId,
  });

  return response.data;
};

export const deleteGroup = async (conversationId) => {
  const response = await api.delete(`/groups/${conversationId}`);

  return response.data;
};
