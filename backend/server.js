const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");

// Initialize express and HTTP server
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000", // Allow connection from your frontend origin
    methods: ["GET", "POST"], // Allow the necessary HTTP methods
  },
});

// Serve static files for Next.js front end (if needed)
app.use(express.static("public"));
app.use(cors());

// Handle WebSocket connections
io.on("connection", (socket) => {
  console.log("A user connected");

  // When desktop (streamer) sends an offer, relay to mobile (viewer)
  socket.on("offer", (offer) => {
    console.log("Received offer:", offer);
    socket.broadcast.emit("offer", offer);
  });

  // When mobile (viewer) sends an answer, relay to desktop (streamer)
  socket.on("answer", (answer) => {
    console.log("Received answer:", answer);
    socket.broadcast.emit("answer", answer);
  });

  // When the desktop or mobile sends ICE candidates, relay to the other peer
  socket.on("ice-candidate", (candidate) => {
    console.log("Received ICE candidate:", candidate);
    socket.broadcast.emit("ice-candidate", candidate);
  });

  // Handle disconnections
  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
