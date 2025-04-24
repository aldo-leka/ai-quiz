import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';

import { setupRoutes } from './api/rest';
import { setupSocketHandlers } from './api/ws/gameMonolith';
import { createTRPCContext, appRouter } from './api/trpc';

const PORT = process.env.PORT || 3001;
// Parse CORS origins - can be a comma-separated string for multiple origins
const CORS_ORIGIN = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : 'http://localhost:3000';

// Create Express app
const app = express();

// Middleware
app.use(helmet());
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// Create Socket.IO server
const io = new SocketIOServer(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Setup REST routes
setupRoutes(app);

// Setup Socket.IO handlers
setupSocketHandlers(io);

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export type AppRouter = typeof appRouter;
