require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const authRoutes = require("./src/routes/authRoutes");
const userRoutes = require("./src/routes/userRoutes");
const conversationRoutes = require("./src/routes/conversationRoutes");
const messageRoutes = require("./src/routes/messageRoutes");
const groupRoutes = require("./src/routes/groupRoutes");

const { connectDB } = require("./src/config/db");

const socketAuth = require("./src/sockets/socketAuth");
const socketHandler = require("./src/sockets/socketHandler");

const app = express();

const PORT = process.env.PORT || 5000;

const allowedOrigin =
  process.env.CLIENT_URL ||
  "http://localhost:5173";

app.use(
  cors({
    origin: allowedOrigin,
    credentials: true,
    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);

app.use(express.json());

connectDB();

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use(
  "/api/conversations",
  conversationRoutes
);
app.use("/api/messages", messageRoutes);
app.use("/api/groups", groupRoutes);

app.get("/", (req, res) => {
  res.status(200).send(
    "Real-Time Chat API is running"
  );
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    credentials: true,
    methods: ["GET", "POST"],
  },
});

app.set("io", io);

io.use(socketAuth);

socketHandler(io);

server.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );
});