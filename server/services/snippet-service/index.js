import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import snippetRoutes from '../../routes/snippets.js';

import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env configuration from root server directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();

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
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(express.json());

// Expose snippet routes
app.use('/api/snippets', snippetRoutes);

app.get('/', (req, res) => {
  res.json({ service: 'CodeSync Snippet Microservice', status: 'healthy' });
});

const PORT = process.env.SNIPPET_PORT || 5002;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/codesync';

const start = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('[Snippet Service] MongoDB connected successfully');
    
    app.listen(PORT, () => {
      console.log(`[Snippet Service] Running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('[Snippet Service] Connection error:', error);
    process.exit(1);
  }
};

start();
