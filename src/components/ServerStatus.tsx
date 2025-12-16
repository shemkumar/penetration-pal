import { ConnectionStatus } from '@/hooks/useTerminalServer';
import { Wifi, WifiOff, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ServerStatusProps {
  status: ConnectionStatus;
  error: string | null;
  serverUrl: string;
}

export function ServerStatus({ status, error, serverUrl }: ServerStatusProps) {
  const statusConfig = {
    disconnected: {
      icon: WifiOff,
      label: 'Disconnected',
      color: 'text-muted-foreground',
      bgColor: 'bg-muted/50'
    },
    connecting: {
      icon: Loader2,
      label: 'Connecting...',
      color: 'text-warning',
      bgColor: 'bg-warning/10'
    },
    connected: {
      icon: Wifi,
      label: 'Connected',
      color: 'text-primary',
      bgColor: 'bg-primary/10'
    },
    error: {
      icon: AlertCircle,
      label: 'Error',
      color: 'text-destructive',
      bgColor: 'bg-destructive/10'
    }
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs",
      config.bgColor
    )}>
      <Icon className={cn(
        "w-3.5 h-3.5",
        config.color,
        status === 'connecting' && 'animate-spin'
      )} />
      <span className={config.color}>{config.label}</span>
      {status === 'connected' && (
        <span className="text-muted-foreground truncate max-w-[120px]" title={serverUrl}>
          {serverUrl.replace('ws://', '')}
        </span>
      )}
      {error && (
        <span className="text-destructive" title={error}>
          ({error})
        </span>
      )}
    </div>
  );
}