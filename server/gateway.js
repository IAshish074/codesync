import http from 'http';
import httpProxy from 'http-proxy';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const proxy = httpProxy.createProxyServer({});

// Microservices Ports configurations
const AUTH_PORT = process.env.AUTH_PORT || 5001;
const SNIPPET_PORT = process.env.SNIPPET_PORT || 5002;
const COLLAB_PORT = process.env.COLLAB_PORT || 5003;

// Start child microservice nodes
console.log('[Gateway] Spawning Auth Microservice...');
const authProc = spawn('node', ['services/auth-service/index.js'], { 
  stdio: 'inherit', 
  cwd: __dirname,
  env: { ...process.env, AUTH_PORT }
});

console.log('[Gateway] Spawning Snippet Microservice...');
const snippetProc = spawn('node', ['services/snippet-service/index.js'], { 
  stdio: 'inherit', 
  cwd: __dirname,
  env: { ...process.env, SNIPPET_PORT }
});

console.log('[Gateway] Spawning Collab Microservice...');
const collabProc = spawn('node', ['services/collab-service/index.js'], { 
  stdio: 'inherit', 
  cwd: __dirname,
  env: { ...process.env, COLLAB_PORT }
});

// Clean up child processes on exit
const cleanup = () => {
  console.log('[Gateway] Shutting down child services...');
  authProc.kill();
  snippetProc.kill();
  collabProc.kill();
  process.exit();
};
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Expose public reverse proxy
const server = http.createServer((req, res) => {
  // CORS Configuration
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health Check Endpoint
  if (req.url === '/health' || req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        auth: authProc.exitCode === null ? 'up' : `down (exitCode: ${authProc.exitCode})`,
        snippet: snippetProc.exitCode === null ? 'up' : `down (exitCode: ${snippetProc.exitCode})`,
        collab: collabProc.exitCode === null ? 'up' : `down (exitCode: ${collabProc.exitCode})`
      }
    }));
    return;
  }

  // Root Path (Railway Health Check fallback)
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'active',
      message: 'CodeSync Distributed API Gateway is operational'
    }));
    return;
  }

  // Routing conditions
  if (req.url.startsWith('/api/auth')) {
    proxy.web(req, res, { target: `http://127.0.0.1:${AUTH_PORT}` });
  } else if (req.url.startsWith('/api/snippets')) {
    proxy.web(req, res, { target: `http://127.0.0.1:${SNIPPET_PORT}` });
  } else {
    // Default HTTP fallback
    proxy.web(req, res, { target: `http://127.0.0.1:${COLLAB_PORT}` });
  }
});

// Proxy WebSocket connections for Socket.io
server.on('upgrade', (req, socket, head) => {
  proxy.ws(req, socket, head, { target: `http://127.0.0.1:${COLLAB_PORT}` });
});

// Error handling
proxy.on('error', (err, req, res) => {
  console.error('[Gateway Proxy Error]:', err.message);
  if (res && !res.headersSent && typeof res.writeHead === 'function') {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Bad Gateway');
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`[Gateway Server] Routing public routes on http://localhost:${PORT}`);
});
