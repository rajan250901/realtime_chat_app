import { io } from "socket.io-client";

const SOCKET_URL =
    import.meta.env.VITE_SOCKET_URL;

let socket = null;


export const connectSocket = () => {

    const token =
        localStorage.getItem("token");

    if (!token) {
        console.log("JWT token not found");
        return null;
    }


    if (socket?.connected) {
        return socket;
    }

    socket = io(SOCKET_URL, {
  auth: {
    token: localStorage.getItem("token"),
  },
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});

    // socket = io(SOCKET_URL, {

    //     auth: {
    //         token
    //     },

    //     transports: ["websocket"],

    //     reconnection: true,

    //     reconnectionAttempts: 10,

    //     reconnectionDelay: 1000
    // });


    socket.on("connect", () => {

        console.log(
            "Socket connected:",
            socket.id
        );

    });


    socket.on("disconnect", (reason) => {

        console.log(
            "Socket disconnected:",
            reason
        );

    });


    socket.on("connect_error", (error) => {

        console.error(
            "Socket connection error:",
            error.message
        );

    });


    return socket;
};


export const getSocket = () => {
    return socket;
};


export const disconnectSocket = () => {

    if (socket) {

        socket.disconnect();

        socket = null;
    }
};