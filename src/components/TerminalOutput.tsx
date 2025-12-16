import { useEffect, useRef } from 'react';
import { ScanResult } from '@/lib/pentestTools';
import { Loader2 } from 'lucide-react';

interface TerminalOutputProps {
  result: ScanResult | null;
}

export function TerminalOutput({ result }: TerminalOutputProps) {
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [result?.output]);

  if (!result) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center space-y-4">
          <div className="text-6xl opacity-30">⌨️</div>
          <p className="font-mono text-sm">Select a tool and execute a scan to see output</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={terminalRef}
      className="h-full bg-terminal-bg rounded-lg overflow-auto font-mono text-sm relative"
    >
      {/* Scan line effect when running */}
      {result.status === 'running' && (
        <div className="scan-line absolute inset-0 pointer-events-none" />
      )}
      
      <div className="p-4 space-y-2">
        {/* Header */}
        <div className="flex items-center gap-2 pb-2 border-b border-border/50">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-destructive" />
            <div className="w-3 h-3 rounded-full bg-warning" />
            <div className="w-3 h-3 rounded-full bg-primary" />
          </div>
          <span className="text-muted-foreground text-xs ml-2">
            {result.toolName} — {result.target}
          </span>
          {result.status === 'running' && (
            <Loader2 className="w-3 h-3 ml-auto text-primary animate-spin" />
          )}
          {result.status === 'completed' && (
            <span className="ml-auto text-xs text-primary">✓ Completed</span>
          )}
          {result.status === 'error' && (
            <span className="ml-auto text-xs text-destructive">✗ Error</span>
          )}
        </div>

        {/* Command */}
        <div className="text-muted-foreground">
          <span className="text-primary">$</span> {result.command}
        </div>

        {/* Output */}
        <div className="whitespace-pre-wrap text-terminal">
          {result.output}
          {result.status === 'running' && (
            <span className="terminal-cursor inline-block w-2 h-4 bg-primary ml-1" />
          )}
        </div>

        {/* Footer */}
        {result.status === 'completed' && result.duration && (
          <div className="pt-2 border-t border-border/50 text-xs text-muted-foreground">
            Scan completed in {(result.duration / 1000).toFixed(2)}s
          </div>
        )}
      </div>
    </div>
  );
}