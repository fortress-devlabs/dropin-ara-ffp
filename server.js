// =======================
// File: server.js
// =======================

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files (HTML, CSS, JS) from "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// Socket.IO signaling & frame relay
io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Join a room
    socket.on('join', (roomId) => {
        socket.join(roomId);
        console.log(`${socket.id} joined room ${roomId}`);

        // Notify existing users
        const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
        socket.emit('existing_users', clients.filter(id => id !== socket.id));

        // Notify others
        socket.to(roomId).emit('user_joined', socket.id);
    });

    // Relay video/screen frames
    socket.on('frame', ({ data, type }) => {
        const rooms = [...socket.rooms].filter(r => r !== socket.id);
        rooms.forEach(roomId => {
            socket.to(roomId).emit('frame', { senderId: socket.id, data, type });
        });
    });

    // Relay mic/cam toggles
    socket.on('toggle-audio', (enabled) => {
        const rooms = [...socket.rooms].filter(r => r !== socket.id);
        rooms.forEach(roomId => {
            socket.to(roomId).emit('participant-toggle-audio', { senderId: socket.id, enabled });
        });
    });

    socket.on('toggle-video', (enabled) => {
        const rooms = [...socket.rooms].filter(r => r !== socket.id);
        rooms.forEach(roomId => {
            socket.to(roomId).emit('participant-toggle-video', { senderId: socket.id, enabled });
        });
    });

    // Relay screen share events
    socket.on('start-screen-share', () => {
        const rooms = [...socket.rooms].filter(r => r !== socket.id);
        rooms.forEach(roomId => {
            socket.to(roomId).emit('start-screen-share', { senderId: socket.id });
        });
    });

    socket.on('stop-screen-share', () => {
        const rooms = [...socket.rooms].filter(r => r !== socket.id);
        rooms.forEach(roomId => {
            socket.to(roomId).emit('stop-screen-share', { senderId: socket.id });
        });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
        const rooms = [...socket.rooms].filter(r => r !== socket.id);
        rooms.forEach(roomId => {
            socket.to(roomId).emit('participant-left', socket.id);
        });
    });
});

// Start server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`ARA FFP server running at http://localhost:${PORT}`);
});
