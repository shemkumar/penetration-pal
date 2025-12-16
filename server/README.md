# PenTest Terminal Server

A WebSocket server that executes penetration testing commands and streams output in real-time.

## Prerequisites

- Node.js 18+ installed
- Pentest tools installed (nmap, sqlmap, nikto, etc.)

## Installation

```bash
cd server
npm install
```

## Running the Server

```bash
npm start
```

Or with auto-reload during development:

```bash
npm run dev
```

## Configuration

The server runs on port 8080 by default. You can change this with the `PORT` environment variable:

```bash
PORT=9000 npm start
```

## Security Warning

⚠️ **This server executes shell commands!** Only run it on trusted networks and never expose it to the internet.

## Connecting from the Web UI

1. Start this server locally
2. Open the PenTest Command Center in your browser
3. Enable "Connect to Terminal Server" in the settings
4. Execute scans - they will run on your local machine

## API

### WebSocket Messages

**Execute Command:**
```json
{
  "type": "execute",
  "scanId": "scan-123",
  "toolName": "nmap",
  "target": "192.168.1.1",
  "command": "nmap -sS -p 1-1000 192.168.1.1"
}
```

**Cancel Command:**
```json
{
  "type": "cancel",
  "scanId": "scan-123"
}
```

### Server Responses

**Output:**
```json
{
  "type": "output",
  "scanId": "scan-123",
  "stream": "stdout",
  "data": "Starting Nmap 7.94..."
}
```

**Completed:**
```json
{
  "type": "scan_completed",
  "scanId": "scan-123",
  "exitCode": 0,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```
