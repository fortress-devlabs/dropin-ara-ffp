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

    // Join a room with persistent userId
    socket.on('join', ({ roomId, userId }) => {
        socket.join(roomId);
        socket.data.userId = userId; // store persistent ID on socket
        console.log(`${socket.id} (${userId}) joined room ${roomId}`);

        // Notify new client about existing users
        const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
        const users = clients.map(id => {
            const s = io.sockets.sockets.get(id);
            return { socketId: id, userId: s?.data.userId || id };
        });
        socket.emit('existing_users', users.filter(u => u.socketId !== socket.id));

        // Notify others about new user
        socket.to(roomId).emit('user_joined', { socketId: socket.id, userId });
    });

    // Relay video/screen frames
    socket.on('frame', ({ data, type, userId }) => {
        const rooms = [...socket.rooms].filter(r => r !== socket.id);
        rooms.forEach(roomId => {
            socket.to(roomId).emit('frame', { senderId: socket.id, userId, data, type });
        });
    });

    // Relay mic/cam toggles
    socket.on('toggle-audio', (enabled) => {
        const rooms = [...socket.rooms].filter(r => r !== socket.id);
        rooms.forEach(roomId => {
            socket.to(roomId).emit('participant-toggle-audio', { senderId: socket.id, userId: socket.data.userId, enabled });
        });
    });

    socket.on('toggle-video', (enabled) => {
        const rooms = [...socket.rooms].filter(r => r !== socket.id);
        rooms.forEach(roomId => {
            socket.to(roomId).emit('participant-toggle-video', { senderId: socket.id, userId: socket.data.userId, enabled });
        });
    });

    // Relay screen share events
    socket.on('start-screen-share', () => {
        const rooms = [...socket.rooms].filter(r => r !== socket.id);
        rooms.forEach(roomId => {
            socket.to(roomId).emit('start-screen-share', { senderId: socket.id, userId: socket.data.userId });
        });
    });

    socket.on('stop-screen-share', () => {
        const rooms = [...socket.rooms].filter(r => r !== socket.id);
        rooms.forEach(roomId => {
            socket.to(roomId).emit('stop-screen-share', { senderId: socket.id, userId: socket.data.userId });
        });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id} (${socket.data.userId})`);
        const rooms = [...socket.rooms].filter(r => r !== socket.id);
        rooms.forEach(roomId => {
            socket.to(roomId).emit('participant-left', { socketId: socket.id, userId: socket.data.userId });
        });
    });
});

// Start server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`ARA FFP server running at http://localhost:${PORT}`);
});
