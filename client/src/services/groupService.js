import api from "./api";

export const createGroup = async (name, memberIds) => {
  const response = await api.post("/groups", { name, memberIds });
  return response.data;
};

export const getGroupDetails = async (groupId) => {
  const response = await api.get(`/groups/${groupId}`);
  return response.data;
};

export const updateGroup = async (groupId, data) => {
  const response = await api.put(`/groups/${groupId}`, data);
  return response.data;
};

export const deleteGroup = async (groupId) => {
  const response = await api.delete(`/groups/${groupId}`);
  return response.data;
};

export const addGroupMembers = async (groupId, memberIds) => {
  const response = await api.post(`/groups/${groupId}/members`, { memberIds });
  return response.data;
};

export const removeGroupMember = async (groupId, userId) => {
  const response = await api.delete(`/groups/${groupId}/members/${userId}`);
  return response.data;
};

export const updateGroupMemberRole = async (groupId, userId, role) => {
  const response = await api.patch(`/groups/${groupId}/members/${userId}/role`, { role });
  return response.data;
};

export const transferGroupOwner = async (groupId, userId) => {
  const response = await api.post(`/groups/${groupId}/transfer-owner`, { userId });
  return response.data;
};
