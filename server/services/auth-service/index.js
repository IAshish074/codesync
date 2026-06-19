import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from '../../routes/auth.js';

import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env configuration from root server directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(express.json());

// Expose Auth routes
app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
  res.json({ service: 'CodeSync Auth Microservice', status: 'healthy' });
});

const PORT = process.env.AUTH_PORT || 5001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/codesync';

const start = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('[Auth Service] MongoDB connected successfully');
    
    app.listen(PORT, () => {
      console.log(`[Auth Service] Running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('[Auth Service] Connection error:', error);
    // Exit process on db failure so supervisor can restart it
    process.exit(1);
  }
};

start();
