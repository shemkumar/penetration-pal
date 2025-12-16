import { useState, useEffect } from 'react';
import { PentestTool, buildCommand } from '@/lib/pentestTools';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Play, Copy, Terminal } from 'lucide-react';
import { toast } from 'sonner';

interface ConfigPanelProps {
  tool: PentestTool;
  onExecute: (command: string, values: Record<string, any>) => void;
  isRunning: boolean;
}

export function ConfigPanel({ tool, onExecute, isRunning }: ConfigPanelProps) {
  const [values, setValues] = useState<Record<string, any>>({});
  const [command, setCommand] = useState('');

  useEffect(() => {
    const initialValues: Record<string, any> = {};
    tool.fields.forEach((field) => {
      if (field.default !== undefined) {
        initialValues[field.name] = field.default;
      }
    });
    setValues(initialValues);
  }, [tool]);

  useEffect(() => {
    const cmd = buildCommand(tool, values);
    setCommand(cmd);
  }, [tool, values]);

  const handleChange = (name: string, value: any) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleExecute = () => {
    const requiredFields = tool.fields.filter((f) => f.required);
    const missingFields = requiredFields.filter((f) => !values[f.name]);
    
    if (missingFields.length > 0) {
      toast.error(`Missing required fields: ${missingFields.map((f) => f.label).join(', ')}`);
      return;
    }
    
    onExecute(command, values);
  };

  const copyCommand = () => {
    navigator.clipboard.writeText(command);
    toast.success('Command copied to clipboard');
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <span className="text-4xl">{tool.icon}</span>
        <div>
          <h2 className="font-display text-2xl text-primary neon-text">{tool.name}</h2>
          <p className="text-sm text-muted-foreground">{tool.description}</p>
        </div>
      </div>

      <div className="grid gap-4">
        {tool.fields.map((field) => (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name} className="text-card-foreground">
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>

            {field.type === 'text' && (
              <Input
                id={field.name}
                placeholder={field.placeholder}
                value={values[field.name] || ''}
                onChange={(e) => handleChange(field.name, e.target.value)}
                className="bg-input border-border focus:border-primary focus:ring-primary/20"
              />
            )}

            {field.type === 'number' && (
              <Input
                id={field.name}
                type="number"
                placeholder={field.placeholder}
                value={values[field.name] || ''}
                onChange={(e) => handleChange(field.name, parseInt(e.target.value) || '')}
                className="bg-input border-border focus:border-primary focus:ring-primary/20"
              />
            )}

            {field.type === 'select' && (
              <Select
                value={values[field.name]?.toString() || ''}
                onValueChange={(value) => handleChange(field.name, value)}
              >
                <SelectTrigger className="bg-input border-border">
                  <SelectValue placeholder="Select option" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {field.options?.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {field.type === 'checkbox' && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id={field.name}
                  checked={values[field.name] || false}
                  onCheckedChange={(checked) => handleChange(field.name, checked)}
                  className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <Label htmlFor={field.name} className="text-sm text-muted-foreground cursor-pointer">
                  Enable {field.label.toLowerCase()}
                </Label>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <Label className="text-card-foreground flex items-center gap-2">
          <Terminal className="w-4 h-4 text-primary" />
          Generated Command
        </Label>
        <div className="relative">
          <pre className="bg-terminal-bg border border-border rounded-md p-4 text-sm font-mono text-terminal overflow-x-auto">
            <code>{command}</code>
          </pre>
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:text-primary"
            onClick={copyCommand}
          >
            <Copy className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Button
        onClick={handleExecute}
        disabled={isRunning}
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-display tracking-wider neon-border disabled:opacity-50"
      >
        {isRunning ? (
          <>
            <span className="animate-pulse">SCANNING...</span>
          </>
        ) : (
          <>
            <Play className="w-4 h-4 mr-2" />
            EXECUTE SCAN
          </>
        )}
      </Button>
    </div>
  );
}