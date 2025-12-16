import { useState, useEffect, useCallback, useRef } from 'react';

export interface ServerConfig {
  url: string;
  enabled: boolean;
}

export interface ServerMessage {
  type: string;
  scanId?: string;
  data?: string;
  stream?: 'stdout' | 'stderr';
  error?: string;
  exitCode?: number;
  timestamp?: string;
  message?: string;
  clientId?: string;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface UseTerminalServerOptions {
  onOutput?: (scanId: string, data: string, stream: 'stdout' | 'stderr') => void;
  onScanStarted?: (scanId: string) => void;
  onScanCompleted?: (scanId: string, exitCode: number) => void;
  onScanError?: (scanId: string, error: string) => void;
}

export function useTerminalServer(
  config: ServerConfig,
  options: UseTerminalServerOptions = {}
) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { onOutput, onScanStarted, onScanCompleted, onScanError } = options;

  const connect = useCallback(() => {
    if (!config.enabled || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setStatus('connecting');
    setError(null);

    try {
      const ws = new WebSocket(config.url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[TerminalServer] Connected');
        setStatus('connected');
        setError(null);

        // Start ping interval
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const message: ServerMessage = JSON.parse(event.data);
          console.log('[TerminalServer] Message:', message.type);

          switch (message.type) {
            case 'connected':
              console.log('[TerminalServer] Server confirmed connection:', message.clientId);
              break;
            case 'output':
              if (message.scanId && message.data) {
                onOutput?.(message.scanId, message.data, message.stream || 'stdout');
              }
              break;
            case 'scan_started':
              if (message.scanId) {
                onScanStarted?.(message.scanId);
              }
              break;
            case 'scan_completed':
              if (message.scanId) {
                onScanCompleted?.(message.scanId, message.exitCode || 0);
              }
              break;
            case 'scan_error':
              if (message.scanId && message.error) {
                onScanError?.(message.scanId, message.error);
              }
              break;
            case 'pong':
              // Heartbeat response
              break;
            case 'error':
              console.error('[TerminalServer] Server error:', message.message);
              break;
          }
        } catch (e) {
          console.error('[TerminalServer] Failed to parse message:', e);
        }
      };

      ws.onerror = (event) => {
        console.error('[TerminalServer] WebSocket error:', event);
        setStatus('error');
        setError('Connection error');
      };

      ws.onclose = (event) => {
        console.log('[TerminalServer] Disconnected:', event.code, event.reason);
        setStatus('disconnected');
        wsRef.current = null;

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Auto-reconnect if enabled
        if (config.enabled && event.code !== 1000) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('[TerminalServer] Attempting reconnect...');
            connect();
          }, 3000);
        }
      };
    } catch (e) {
      console.error('[TerminalServer] Failed to create WebSocket:', e);
      setStatus('error');
      setError('Failed to connect');
    }
  }, [config.url, config.enabled, onOutput, onScanStarted, onScanCompleted, onScanError]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnect');
      wsRef.current = null;
    }

    setStatus('disconnected');
  }, []);

  const executeCommand = useCallback((
    scanId: string,
    command: string,
    toolName: string,
    target: string
  ) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to terminal server');
    }

    wsRef.current.send(JSON.stringify({
      type: 'execute',
      scanId,
      command,
      toolName,
      target
    }));
  }, []);

  const cancelCommand = useCallback((scanId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'cancel',
        scanId
      }));
    }
  }, []);

  // Connect/disconnect based on config
  useEffect(() => {
    if (config.enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [config.enabled, connect, disconnect]);

  return {
    status,
    error,
    connect,
    disconnect,
    executeCommand,
    cancelCommand,
    isConnected: status === 'connected'
  };
}