import { useState, useEffect, useCallback } from 'react';
import { ToolSidebar } from '@/components/ToolSidebar';
import { ConfigPanel } from '@/components/ConfigPanel';
import { TerminalOutput } from '@/components/TerminalOutput';
import { ScanHistory } from '@/components/ScanHistory';
import { ServerStatus } from '@/components/ServerStatus';
import { ServerSettings } from '@/components/ServerSettings';
import { PentestTool, ScanResult } from '@/lib/pentestTools';
import { simulateScan } from '@/lib/scanSimulator';
import { exportToPDF } from '@/lib/pdfExport';
import { useTerminalServer, ServerConfig } from '@/hooks/useTerminalServer';
import { toast } from 'sonner';
import { Shield, Terminal, History, Zap } from 'lucide-react';

const STORAGE_KEY = 'pentest-scan-history';
const SERVER_CONFIG_KEY = 'pentest-server-config';

const defaultServerConfig: ServerConfig = {
  url: 'ws://localhost:8080',
  enabled: false
};

export default function Index() {
  const [selectedTool, setSelectedTool] = useState<PentestTool | null>(null);
  const [currentScan, setCurrentScan] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'history'>('config');
  const [serverConfig, setServerConfig] = useState<ServerConfig>(() => {
    const saved = localStorage.getItem(SERVER_CONFIG_KEY);
    return saved ? JSON.parse(saved) : defaultServerConfig;
  });

  // Terminal server hook
  const terminalServer = useTerminalServer(serverConfig, {
    onOutput: (scanId, data) => {
      setCurrentScan((prev) => {
        if (prev && prev.id === scanId) {
          return { ...prev, output: prev.output + data };
        }
        return prev;
      });
    },
    onScanCompleted: (scanId, exitCode) => {
      setCurrentScan((prev) => {
        if (prev && prev.id === scanId) {
          const completed: ScanResult = {
            ...prev,
            status: exitCode === 0 ? 'completed' : 'error',
            duration: Date.now() - new Date(prev.timestamp).getTime()
          };
          setHistory((h) => [completed, ...h]);
          toast.success(`${prev.toolName} scan completed`);
          return completed;
        }
        return prev;
      });
      setIsRunning(false);
    },
    onScanError: (scanId, error) => {
      setCurrentScan((prev) => {
        if (prev && prev.id === scanId) {
          const failed: ScanResult = {
            ...prev,
            output: prev.output + `\n[ERROR] ${error}`,
            status: 'error',
            duration: Date.now() - new Date(prev.timestamp).getTime()
          };
          setHistory((h) => [failed, ...h]);
          toast.error('Scan failed');
          return failed;
        }
        return prev;
      });
      setIsRunning(false);
    }
  });

  // Load history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load scan history');
      }
    }
  }, []);

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  // Save server config
  useEffect(() => {
    localStorage.setItem(SERVER_CONFIG_KEY, JSON.stringify(serverConfig));
  }, [serverConfig]);

  const handleExecute = useCallback(async (command: string, values: Record<string, any>) => {
    if (!selectedTool) return;

    const target = values.target || values.url || values.host || values.domain || 'unknown';
    const scanId = `scan-${Date.now()}`;
    
    const newScan: ScanResult = {
      id: scanId,
      toolId: selectedTool.id,
      toolName: selectedTool.name,
      target,
      command,
      output: '',
      timestamp: new Date(),
      status: 'running',
    };

    setCurrentScan(newScan);
    setIsRunning(true);

    // Use real terminal server if connected
    if (terminalServer.isConnected) {
      try {
        terminalServer.executeCommand(scanId, command, selectedTool.name, target);
      } catch (error) {
        toast.error('Failed to execute command: ' + (error as Error).message);
        setIsRunning(false);
      }
      return;
    }
    
    // Fallback to simulation
    const startTime = Date.now();
    let output = '';

    try {
      await simulateScan(selectedTool, values, (line) => {
        output += line + '\n';
        setCurrentScan((prev) => prev ? { ...prev, output } : null);
      });

      const completedScan: ScanResult = {
        ...newScan,
        output,
        status: 'completed',
        duration: Date.now() - startTime,
      };

      setCurrentScan(completedScan);
      setHistory((prev) => [completedScan, ...prev]);
      toast.success(`${selectedTool.name} scan completed (simulated)`);
    } catch (error) {
      const errorScan: ScanResult = {
        ...newScan,
        output: output + '\n[ERROR] Scan failed: ' + (error as Error).message,
        status: 'error',
        duration: Date.now() - startTime,
      };

      setCurrentScan(errorScan);
      setHistory((prev) => [errorScan, ...prev]);
      toast.error('Scan failed');
    } finally {
      setIsRunning(false);
    }
  }, [selectedTool, terminalServer]);

  const handleCancelScan = useCallback(() => {
    if (currentScan && isRunning) {
      terminalServer.cancelCommand(currentScan.id);
      setCurrentScan((prev) => prev ? { ...prev, status: 'error', output: prev.output + '\n[CANCELLED] Scan cancelled by user' } : null);
      setIsRunning(false);
      toast.info('Scan cancelled');
    }
  }, [currentScan, isRunning, terminalServer]);

  const handleSelectFromHistory = (scan: ScanResult) => {
    setCurrentScan(scan);
  };

  const handleDeleteScan = (id: string) => {
    setHistory((prev) => prev.filter((s) => s.id !== id));
    if (currentScan?.id === id) {
      setCurrentScan(null);
    }
    toast.success('Scan deleted');
  };

  const handleExportPDF = (scan: ScanResult) => {
    exportToPDF(scan);
    toast.success('PDF report exported');
  };

  const handleClearAll = () => {
    setHistory([]);
    setCurrentScan(null);
    toast.success('History cleared');
  };

  return (
    <div className="min-h-screen bg-background cyber-grid">
      {/* Header */}
      <header className="h-16 border-b border-border bg-card/80 backdrop-blur-sm flex items-center px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5" />
        <div className="flex items-center gap-3 relative z-10">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/30 neon-border">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-xl tracking-wider text-primary neon-text">
              PENTEST COMMAND CENTER
            </h1>
            <p className="text-xs text-muted-foreground">
              Professional Penetration Testing Suite
            </p>
          </div>
        </div>
        
        <div className="ml-auto flex items-center gap-3 relative z-10">
          <ServerStatus 
            status={terminalServer.status} 
            error={terminalServer.error}
            serverUrl={serverConfig.url}
          />
          <ServerSettings 
            config={serverConfig} 
            onConfigChange={setServerConfig} 
          />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Zap className="w-4 h-4 text-primary animate-pulse" />
            <span>15 Tools Ready</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Tool Sidebar */}
        <ToolSidebar
          selectedTool={selectedTool}
          onSelectTool={setSelectedTool}
        />

        {/* Center Panel */}
        <div className="flex-1 flex flex-col border-r border-border">
          {/* Config/History Tabs */}
          <div className="flex border-b border-border bg-card/50">
            <button
              onClick={() => setActiveTab('config')}
              className={`flex items-center gap-2 px-6 py-3 text-sm transition-all ${
                activeTab === 'config'
                  ? 'text-primary border-b-2 border-primary bg-primary/5'
                  : 'text-muted-foreground hover:text-card-foreground'
              }`}
            >
              <Terminal className="w-4 h-4" />
              Configuration
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-6 py-3 text-sm transition-all ${
                activeTab === 'history'
                  ? 'text-primary border-b-2 border-primary bg-primary/5'
                  : 'text-muted-foreground hover:text-card-foreground'
              }`}
            >
              <History className="w-4 h-4" />
              History
              {history.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs rounded bg-primary/20 text-primary">
                  {history.length}
                </span>
              )}
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-auto bg-card/30">
            {activeTab === 'config' ? (
              selectedTool ? (
                <ConfigPanel
                  tool={selectedTool}
                  onExecute={handleExecute}
                  isRunning={isRunning}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
                  <div className="text-8xl mb-6 opacity-30">🛡️</div>
                  <h2 className="font-display text-xl mb-2 text-card-foreground">
                    Select a Tool
                  </h2>
                  <p className="text-sm text-center max-w-md">
                    Choose a penetration testing tool from the sidebar to configure and execute scans
                  </p>
                </div>
              )
            ) : (
              <ScanHistory
                history={history}
                onSelect={handleSelectFromHistory}
                onDelete={handleDeleteScan}
                onExport={handleExportPDF}
                onClearAll={handleClearAll}
                selectedId={currentScan?.id}
              />
            )}
          </div>
        </div>

        {/* Terminal Output Panel */}
        <div className="w-[500px] flex flex-col bg-terminal-bg">
          <div className="h-12 border-b border-border flex items-center px-4 bg-card/50">
            <Terminal className="w-4 h-4 text-primary mr-2" />
            <span className="font-display text-sm text-primary">OUTPUT</span>
            {currentScan?.status === 'running' && (
              <span className="ml-auto flex items-center gap-2 text-xs text-warning">
                <span className="w-2 h-2 rounded-full bg-warning animate-pulse" />
                Scanning...
              </span>
            )}
          </div>
          <div className="flex-1 overflow-hidden p-4">
            <TerminalOutput result={currentScan} />
          </div>
        </div>
      </div>
    </div>
  );
}