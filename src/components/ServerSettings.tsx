import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Settings, Server, AlertTriangle } from 'lucide-react';
import { ServerConfig } from '@/hooks/useTerminalServer';

interface ServerSettingsProps {
  config: ServerConfig;
  onConfigChange: (config: ServerConfig) => void;
}

export function ServerSettings({ config, onConfigChange }: ServerSettingsProps) {
  const [localConfig, setLocalConfig] = useState(config);
  const [open, setOpen] = useState(false);

  const handleSave = () => {
    onConfigChange(localConfig);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
          <Settings className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-card-foreground">
            <Server className="w-5 h-5 text-primary" />
            Terminal Server Settings
          </DialogTitle>
          <DialogDescription>
            Connect to a local terminal server to execute real pentest commands.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="server-enabled" className="text-card-foreground">
                Enable Terminal Server
              </Label>
              <p className="text-xs text-muted-foreground">
                Connect to execute real commands
              </p>
            </div>
            <Switch
              id="server-enabled"
              checked={localConfig.enabled}
              onCheckedChange={(checked) =>
                setLocalConfig((prev) => ({ ...prev, enabled: checked }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="server-url" className="text-card-foreground">
              Server URL
            </Label>
            <Input
              id="server-url"
              value={localConfig.url}
              onChange={(e) =>
                setLocalConfig((prev) => ({ ...prev, url: e.target.value }))
              }
              placeholder="ws://localhost:8080"
              className="bg-input border-border"
            />
            <p className="text-xs text-muted-foreground">
              WebSocket URL of your terminal server
            </p>
          </div>

          {localConfig.enabled && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-warning/10 border border-warning/30">
              <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
              <div className="text-xs text-warning">
                <p className="font-medium">Security Warning</p>
                <p className="mt-1 opacity-80">
                  The terminal server executes shell commands. Only connect to trusted servers on secure networks.
                </p>
              </div>
            </div>
          )}

          <div className="p-3 rounded-md bg-muted/30 border border-border">
            <p className="text-xs text-muted-foreground font-medium mb-2">Quick Start:</p>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Navigate to the <code className="text-primary">server/</code> folder</li>
              <li>Run <code className="text-primary">npm install</code></li>
              <li>Run <code className="text-primary">npm start</code></li>
              <li>Enable the connection above</li>
            </ol>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-primary text-primary-foreground">
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}