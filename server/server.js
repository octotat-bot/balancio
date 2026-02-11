import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import http from 'http';
import { Server } from 'socket.io';

import authRoutes from './routes/authRoutes.js';
import groupRoutes from './routes/groupRoutes.js';
import userRoutes from './routes/userRoutes.js';
import settlementRoutes from './routes/settlementRoutes.js';
import friendRoutes from './routes/friendRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import { initializeSocket } from './socket/index.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5001;

const allowedOrigins = [
    process.env.FRONTEND_URL,
    "https://balancio-three.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000"
].filter(Boolean);

const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
            callback(null, true);
        } else {
            console.log('Blocked by CORS:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
};

const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        methods: ["GET", "POST"],
        credentials: true
    }
});

initializeSocket(io);

app.use(cors(corsOptions));
app.use(express.json());

app.use((req, res, next) => {
    req.io = io;
    next();
});

app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settlements', settlementRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/messages', messageRoutes);

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
    res.json({
        message: 'Balancio API Server',
        version: '1.0.0',
        endpoints: {
            health: '/api/health',
            auth: '/api/auth',
            groups: '/api/groups',
            friends: '/api/friends',
            settlements: '/api/settlements'
        }
    });
});

app.use((err, req, res, next) => {
    let statusCode = err.status || 500;
    let message = err.message || 'Something went wrong!';

    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = Object.values(err.errors)
            .map(val => val.message)
            .join('. ');
    }

    if (err.code === 11000) {
        statusCode = 400;
        const field = Object.keys(err.keyValue)[0];
        message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists.`;
    }

    if (err.name === 'CastError') {
        statusCode = 400;
        message = `Resource not found or invalid ID: ${err.value}`;
    }

    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid authentication token. Please log in again.';
    }

    if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Session expired. Please log in again.';
    }

    res.status(statusCode).json({
        success: false,
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
});

const startServer = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/split-expense';
        await mongoose.connect(mongoUri);

        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT} (without MongoDB)`);
        });
    }
};

startServer();

export default app;
