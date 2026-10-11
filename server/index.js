require('dotenv').config();  //dot env file ke data ko process.env ke through execute kar sakte hai. aur isko top mein dena chahiye jaha bhi process.env use hui hai uske pehle 

const express = require('express');
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const authRoutes = require('./src/routes/authRoutes');
// const msgRoutes = require('./src/routes/msgRoutes');
const userRoutes = require('./src/routes/userRoutes');
const conversationRoutes = require("./src/routes/conversationRoutes");

const {pool, connectDB } = require('./src/config/db');

const app = express();
const port = process.env.PORT || 8080;
connectDB();
app.use(express.json());  //app.use(express.json()) tab use karni chahiye jab aapka Express server client se JSON data receive kar raha ho.
app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true
}));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

app.use("/api/conversations", conversationRoutes);

const messageRoutes =
    require("./src/routes/messageRoutes");

app.use(
    "/api/messages",
    messageRoutes
);


app.get('/',(req,res) => {
    res.send("Hello World");
})


const socketAuth = require("./src/sockets/socketAuth");
const socketHandler = require("./src/sockets/socketHandler");

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  },
});

// Authenticate the socket before accepting connections.
io.use(socketAuth);

// Register socket events only once.
socketHandler(io);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});