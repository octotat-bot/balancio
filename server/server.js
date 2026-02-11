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

// ── Cached MongoDB connection for Vercel serverless ──
// On Vercel, each request may cold-start the function.
// We cache the connection promise so it's reused across warm invocations.
let cachedDbPromise = null;

function connectToDatabase() {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/split-expense';

    if (cachedDbPromise) {
        return cachedDbPromise;
    }

    // If already connected (warm invocation), resolve immediately
    if (mongoose.connection.readyState === 1) {
        cachedDbPromise = Promise.resolve(mongoose.connection);
        return cachedDbPromise;
    }

    cachedDbPromise = mongoose.connect(mongoUri, {
        bufferCommands: false, // Fail fast instead of buffering for 10s
    }).then((m) => {
        console.log('MongoDB connected');
        return m.connection;
    }).catch((err) => {
        // Reset cache so next request retries
        cachedDbPromise = null;
        throw err;
    });

    return cachedDbPromise;
}

// Middleware: ensure MongoDB is connected before handling API requests
app.use('/api', async (req, res, next) => {
    // Skip DB check for health endpoint
    if (req.path === '/health') return next();

    try {
        await connectToDatabase();
        next();
    } catch (err) {
        console.error('MongoDB connection error:', err.message);
        res.status(503).json({
            success: false,
            message: 'Database connection unavailable. Please try again shortly.',
        });
    }
});

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
    const dbState = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        db: dbState[mongoose.connection.readyState] || 'unknown',
    });
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

    // Handle Mongoose buffering timeout (serverless cold start)
    if (err.name === 'MongooseError' && err.message.includes('buffering timed out')) {
        statusCode = 503;
        message = 'Database temporarily unavailable. Please retry.';
    }

    res.status(statusCode).json({
        success: false,
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
});

// ── Start server (local development) ──
// On Vercel, the exported `app` is used directly as the handler.
// server.listen() is only needed for local development.
const isVercel = process.env.VERCEL || process.env.VERCEL_ENV;

if (!isVercel) {
    const startServer = async () => {
        try {
            await connectToDatabase();
            server.listen(PORT, () => {
                console.log(`Server running on port ${PORT}`);
            });
        } catch (error) {
            console.error('Failed to connect to MongoDB:', error.message);
            server.listen(PORT, () => {
                console.log(`Server running on port ${PORT} (MongoDB will retry on first request)`);
            });
        }
    };

    startServer();
}

export default app;
