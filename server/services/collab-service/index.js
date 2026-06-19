import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import mongoose from 'mongoose';

import { initSocketHandler } from '../../socket/socketHandler.js';
import { connectRedis } from '../../utils/redisHelper.js';

import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env configuration from root server directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const httpServer = createServer(app);

const allowedOrigins = [
  'https://codesync-eight-ashy.vercel.app',
  'http://localhost:5173',
  'http://localhost:5000',
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || origin.startsWith('http://localhost')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST'],
  credentials: true
}));

app.get('/', (req, res) => {
  res.json({ service: 'CodeSync Collaboration Microservice', status: 'healthy' });
});

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const PORT = process.env.COLLAB_PORT || 5003;
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/codesync';

const start = async () => {
  try {
    // 1. Connect MongoDB (for mapping user lists and saving session summaries)
    await mongoose.connect(MONGO_URI);
    console.log('[Collab Service] MongoDB connected successfully');

    // 2. Connect Redis for Room State adapter
    await connectRedis();

    // 3. Connect Redis for Socket.io PubSub Horizontal Scaling
    const pubClient = createClient({
      url: REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 3) return new Error('Redis adapter connection failed');
          return Math.min(retries * 1000, 3000);
        }
      }
    });
    const subClient = pubClient.duplicate();

    pubClient.on('error', (err) => {
      console.warn('[Collab Service] Redis Pub Client Error, running socket.io adapter in memory:', err.message);
    });
    subClient.on('error', (err) => {
      console.warn('[Collab Service] Redis Sub Client Error, running socket.io adapter in memory:', err.message);
    });

    try {
      await Promise.all([pubClient.connect(), subClient.connect()]);
      io.adapter(createAdapter(pubClient, subClient));
      console.log('[Collab Service] Socket.io Redis Adapter successfully connected');
    } catch (adapterErr) {
      console.warn('[Collab Service] Socket.io Redis Adapter connection failed, falling back to local memory adapter.');
    }

    // 4. Initialize Socket.io events
    initSocketHandler(io);

    // 5. Start Collaboration HTTP server
    httpServer.listen(PORT, () => {
      console.log(`[Collab Service] WebSocket listening on http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error('[Collab Service] Startup failure:', error);
    process.exit(1);
  }
};

start();
