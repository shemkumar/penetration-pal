import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';
import { createServer } from 'http';

const PORT = process.env.PORT || 8080;

// Create HTTP server
const server = createServer((req, res) => {
  // CORS headers for health check
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', message: 'PenTest Server Running' }));
    return;
  }
  
  res.writeHead(404);
  res.end('Not Found');
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🛡️  PENTEST COMMAND CENTER - TERMINAL SERVER              ║
║                                                              ║
║   WebSocket server starting on port ${PORT}                    ║
║   Connect your web UI to: ws://localhost:${PORT}               ║
║                                                              ║
║   ⚠️  WARNING: This server executes shell commands!          ║
║   Only run this on trusted networks.                         ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

// Track active processes
const activeProcesses = new Map();

wss.on('connection', (ws, req) => {
  const clientId = `client-${Date.now()}`;
  console.log(`[${clientId}] Client connected from ${req.socket.remoteAddress}`);
  
  // Send connection confirmation
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Connected to PenTest Terminal Server',
    clientId
  }));

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log(`[${clientId}] Received:`, message.type);
      
      switch (message.type) {
        case 'execute':
          executeCommand(ws, clientId, message);
          break;
        case 'cancel':
          cancelCommand(clientId, message.scanId);
          break;
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
        default:
          ws.send(JSON.stringify({
            type: 'error',
            message: `Unknown message type: ${message.type}`
          }));
      }
    } catch (error) {
      console.error(`[${clientId}] Error parsing message:`, error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format'
      }));
    }
  });

  ws.on('close', () => {
    console.log(`[${clientId}] Client disconnected`);
    // Kill any active processes for this client
    for (const [scanId, proc] of activeProcesses.entries()) {
      if (scanId.startsWith(clientId)) {
        proc.kill('SIGTERM');
        activeProcesses.delete(scanId);
      }
    }
  });

  ws.on('error', (error) => {
    console.error(`[${clientId}] WebSocket error:`, error);
  });
});

function executeCommand(ws, clientId, message) {
  const { command, scanId, toolName, target } = message;
  const processId = `${clientId}-${scanId}`;
  
  console.log(`[${clientId}] Executing: ${command}`);
  
  // Send start event
  ws.send(JSON.stringify({
    type: 'scan_started',
    scanId,
    toolName,
    target,
    command,
    timestamp: new Date().toISOString()
  }));

  // Parse command into parts
  const parts = parseCommand(command);
  const cmd = parts[0];
  const args = parts.slice(1);

  // Spawn the process
  const proc = spawn(cmd, args, {
    shell: true,
    env: { ...process.env, TERM: 'xterm-256color' }
  });

  activeProcesses.set(processId, proc);

  // Stream stdout
  proc.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`[${clientId}] stdout:`, output.substring(0, 100));
    ws.send(JSON.stringify({
      type: 'output',
      scanId,
      stream: 'stdout',
      data: output
    }));
  });

  // Stream stderr
  proc.stderr.on('data', (data) => {
    const output = data.toString();
    console.log(`[${clientId}] stderr:`, output.substring(0, 100));
    ws.send(JSON.stringify({
      type: 'output',
      scanId,
      stream: 'stderr',
      data: output
    }));
  });

  // Handle process completion
  proc.on('close', (code) => {
    console.log(`[${clientId}] Process exited with code: ${code}`);
    activeProcesses.delete(processId);
    ws.send(JSON.stringify({
      type: 'scan_completed',
      scanId,
      exitCode: code,
      timestamp: new Date().toISOString()
    }));
  });

  // Handle process errors
  proc.on('error', (error) => {
    console.error(`[${clientId}] Process error:`, error);
    activeProcesses.delete(processId);
    ws.send(JSON.stringify({
      type: 'scan_error',
      scanId,
      error: error.message,
      timestamp: new Date().toISOString()
    }));
  });
}

function cancelCommand(clientId, scanId) {
  const processId = `${clientId}-${scanId}`;
  const proc = activeProcesses.get(processId);
  
  if (proc) {
    console.log(`[${clientId}] Cancelling scan: ${scanId}`);
    proc.kill('SIGTERM');
    activeProcesses.delete(processId);
  }
}

function parseCommand(command) {
  // Simple command parser that handles quoted strings
  const parts = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (let i = 0; i < command.length; i++) {
    const char = command[i];

    if ((char === '"' || char === "'") && !inQuote) {
      inQuote = true;
      quoteChar = char;
    } else if (char === quoteChar && inQuote) {
      inQuote = false;
      quoteChar = '';
    } else if (char === ' ' && !inQuote) {
      if (current) {
        parts.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

// Start the server
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});