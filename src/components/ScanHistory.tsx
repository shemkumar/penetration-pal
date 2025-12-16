import { ScanResult } from '@/lib/pentestTools';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Trash2, Download, Clock, Target } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ScanHistoryProps {
  history: ScanResult[];
  onSelect: (scan: ScanResult) => void;
  onDelete: (id: string) => void;
  onExport: (scan: ScanResult) => void;
  onClearAll: () => void;
  selectedId?: string;
}

export function ScanHistory({
  history,
  onSelect,
  onDelete,
  onExport,
  onClearAll,
  selectedId,
}: ScanHistoryProps) {
  if (history.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-4">
        <FileText className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-sm text-center">No scan history yet</p>
        <p className="text-xs text-center mt-1 opacity-70">
          Your completed scans will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="font-display text-sm text-primary">HISTORY</h3>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-muted-foreground hover:text-destructive"
          onClick={onClearAll}
        >
          <Trash2 className="w-3 h-3 mr-1" />
          Clear All
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {history.map((scan, index) => (
            <div
              key={scan.id}
              className={cn(
                "p-3 rounded-lg border transition-all cursor-pointer animate-fade-in",
                "hover:border-primary/50 hover:bg-muted/30",
                selectedId === scan.id
                  ? "border-primary bg-primary/5"
                  : "border-border/50 bg-card/50"
              )}
              style={{ animationDelay: `${index * 50}ms` }}
              onClick={() => onSelect(scan)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-card-foreground">
                      {scan.toolName}
                    </span>
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider",
                        scan.status === 'completed' && "bg-primary/20 text-primary",
                        scan.status === 'running' && "bg-warning/20 text-warning",
                        scan.status === 'error' && "bg-destructive/20 text-destructive"
                      )}
                    >
                      {scan.status}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <Target className="w-3 h-3" />
                    <span className="truncate">{scan.target}</span>
                  </div>
                  
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>{format(new Date(scan.timestamp), 'MMM d, HH:mm')}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      onExport(scan);
                    }}
                    title="Export PDF"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(scan.id);
                    }}
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}