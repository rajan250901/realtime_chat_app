require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const authRoutes = require("./src/routes/authRoutes");

const userRoutes = require("./src/routes/userRoutes");

const conversationRoutes = require("./src/routes/conversationRoutes");

const messageRoutes = require("./src/routes/messageRoutes");

const { connectDB } = require("./src/config/db");

const socketAuth = require("./src/sockets/socketAuth");

const socketHandler = require("./src/sockets/socketHandler");

const app = express();

const PORT = process.env.PORT || 5000;

const allowedOrigin = process.env.CLIENT_URL || "http://localhost:5173";

console.log("CLIENT_URL:", allowedOrigin);

app.use(
    cors({
        origin: allowedOrigin,

        credentials: true,

        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

        allowedHeaders: ["Content-Type", "Authorization"],
    }),
);

app.use(express.json());

// Database
connectDB()
    .then(() => {
        console.log("Database connection initialized");
    })
    .catch((error) => {
        console.error("Database initialization error:", error);
    });

// Routes
app.use("/api/auth", authRoutes);

app.use("/api/users", userRoutes);

app.use("/api/conversations", conversationRoutes);

app.use("/api/messages", messageRoutes);

// Health check
app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Real-Time Chat API is running",
        environment: process.env.NODE_ENV || "production",
    });
});

// HTTP server
const server = http.createServer(app);

// Socket.IO
const io = new Server(server, {
    cors: {
        origin: allowedOrigin,

        credentials: true,

        methods: ["GET", "POST"],
    },

    transports: ["websocket", "polling"],

    pingInterval: 25000,

    pingTimeout: 20000,
});

// Socket authentication
io.use(socketAuth);

// Socket handlers
socketHandler(io);

// Start server
server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);

    console.log(
        `Allowed client:
${allowedOrigin}`,
    );
});
