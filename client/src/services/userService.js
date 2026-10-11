import api from "./api";

export const getCurrentUser = async () => {
    const response = await api.get(
        "/users/me"
    );
    return response.data;
};

export const searchUsers = async (search) => {
    const response = await api.get(
        `/users/search?search=${encodeURIComponent(search)}`
    );
    return response.data;
};