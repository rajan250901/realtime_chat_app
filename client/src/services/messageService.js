import api from "./api";


export const sendMessage = async (
    conversationId,
    content,
    clientMessageId
) => {

    const response = await api.post(
        "/messages",
        {
            conversationId,
            content,
            clientMessageId
        }
    );

    return response.data;
};


export const getMessages = async (
    conversationId,
    limit = 20,
    before = null
) => {

    let url =
        `/messages/${conversationId}?limit=${limit}`;

    if (before) {
        url += `&before=${before}`;
    }

    const response = await api.get(url);

    return response.data;
};