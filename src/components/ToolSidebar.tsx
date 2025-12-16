import { pentestTools, categoryLabels, categoryColors, PentestTool } from '@/lib/pentestTools';
import { cn } from '@/lib/utils';

interface ToolSidebarProps {
  selectedTool: PentestTool | null;
  onSelectTool: (tool: PentestTool) => void;
}

export function ToolSidebar({ selectedTool, onSelectTool }: ToolSidebarProps) {
  const groupedTools = pentestTools.reduce((acc, tool) => {
    if (!acc[tool.category]) {
      acc[tool.category] = [];
    }
    acc[tool.category].push(tool);
    return acc;
  }, {} as Record<string, PentestTool[]>);

  return (
    <aside className="w-72 bg-card border-r border-border flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h2 className="font-display text-lg text-primary neon-text">TOOLS</h2>
        <p className="text-xs text-muted-foreground mt-1">Select a tool to configure</p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {Object.entries(groupedTools).map(([category, tools], categoryIndex) => (
          <div 
            key={category} 
            className="animate-fade-in"
            style={{ animationDelay: `${categoryIndex * 100}ms` }}
          >
            <h3 className={cn(
              "text-xs uppercase tracking-wider mb-2 px-2",
              categoryColors[category] || 'text-muted-foreground'
            )}>
              {categoryLabels[category] || category}
            </h3>
            
            <div className="space-y-1">
              {tools.map((tool, toolIndex) => (
                <button
                  key={tool.id}
                  onClick={() => onSelectTool(tool)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200",
                    "hover:bg-muted/50 hover:pl-4",
                    "group relative overflow-hidden",
                    selectedTool?.id === tool.id 
                      ? "bg-primary/10 border border-primary/30 neon-border" 
                      : "border border-transparent"
                  )}
                  style={{ animationDelay: `${(categoryIndex * 100) + (toolIndex * 50)}ms` }}
                >
                  <span className="text-xl group-hover:scale-110 transition-transform">
                    {tool.icon}
                  </span>
                  <div className="flex-1 text-left">
                    <div className={cn(
                      "font-medium text-sm",
                      selectedTool?.id === tool.id ? "text-primary" : "text-card-foreground"
                    )}>
                      {tool.name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                      {tool.description}
                    </div>
                  </div>
                  
                  {selectedTool?.id === tool.id && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      <div className="p-4 border-t border-border">
        <div className="text-xs text-muted-foreground text-center">
          <span className="text-primary">{pentestTools.length}</span> tools available
        </div>
      </div>
    </aside>
  );
}