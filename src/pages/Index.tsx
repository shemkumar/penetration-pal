import { useState, useEffect, useCallback } from 'react';
import { ToolSidebar } from '@/components/ToolSidebar';
import { ConfigPanel } from '@/components/ConfigPanel';
import { TerminalOutput } from '@/components/TerminalOutput';
import { ScanHistory } from '@/components/ScanHistory';
import { ServerStatus } from '@/components/ServerStatus';
import { ServerSettings } from '@/components/ServerSettings';
import { PentestTool, ScanResult, pentestTools } from '@/lib/pentestTools';
import { simulateScan } from '@/lib/scanSimulator';
import { exportToPDF } from '@/lib/pdfExport';
import { useTerminalServer, ServerConfig } from '@/hooks/useTerminalServer';
import { useScanResults } from '@/hooks/useScanResults';
import { toast } from 'sonner';
import { Shield, Terminal, History, Zap, Database } from 'lucide-react';

const SERVER_CONFIG_KEY = 'pentest-server-config';

const defaultServerConfig: ServerConfig = {
  url: 'ws://localhost:8080',
  enabled: false
};

export default function Index() {
  const [selectedTool, setSelectedTool] = useState<PentestTool | null>(null);
  const [currentScan, setCurrentScan] = useState<ScanResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'history'>('config');
  const [serverConfig, setServerConfig] = useState<ServerConfig>(() => {
    const saved = localStorage.getItem(SERVER_CONFIG_KEY);
    return saved ? JSON.parse(saved) : defaultServerConfig;
  });

  // Database hook for scan results
  const { 
    scanHistory, 
    loading: historyLoading, 
    createScan, 
    appendOutput, 
    completeScan, 
    deleteScan, 
    deleteAllScans 
  } = useScanResults();

  // Map to track database scan IDs
  const [scanIdMap, setScanIdMap] = useState<Record<string, string>>({});

  // Terminal server hook
  const terminalServer = useTerminalServer(serverConfig, {
    onOutput: async (scanId, data) => {
      setCurrentScan((prev) => {
        if (prev && prev.id === scanId) {
          return { ...prev, output: prev.output + data };
        }
        return prev;
      });
      // Update database
      const dbId = scanIdMap[scanId];
      if (dbId) {
        await appendOutput(dbId, data);
      }
    },
    onScanCompleted: async (scanId, exitCode) => {
      const status = exitCode === 0 ? 'completed' : 'error';
      setCurrentScan((prev) => {
        if (prev && prev.id === scanId) {
          return {
            ...prev,
            status,
            duration: Date.now() - new Date(prev.timestamp).getTime()
          };
        }
        return prev;
      });
      // Update database
      const dbId = scanIdMap[scanId];
      if (dbId) {
        await completeScan(dbId, status, exitCode);
      }
      toast.success('Scan completed');
      setIsRunning(false);
    },
    onScanError: async (scanId, error) => {
      setCurrentScan((prev) => {
        if (prev && prev.id === scanId) {
          return {
            ...prev,
            output: prev.output + `\n[ERROR] ${error}`,
            status: 'error',
            duration: Date.now() - new Date(prev.timestamp).getTime()
          };
        }
        return prev;
      });
      // Update database
      const dbId = scanIdMap[scanId];
      if (dbId) {
        await appendOutput(dbId, `\n[ERROR] ${error}`);
        await completeScan(dbId, 'error');
      }
      toast.error('Scan failed');
      setIsRunning(false);
    }
  });

  // Save server config
  useEffect(() => {
    localStorage.setItem(SERVER_CONFIG_KEY, JSON.stringify(serverConfig));
  }, [serverConfig]);

  const handleExecute = useCallback(async (command: string, values: Record<string, any>) => {
    if (!selectedTool) return;

    const target = values.target || values.url || values.host || values.domain || values.endpoint || 'unknown';
    const localScanId = `scan-${Date.now()}`;
    
    const newScan: ScanResult = {
      id: localScanId,
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

    // Create scan in database
    const dbScanId = await createScan(newScan);
    if (dbScanId) {
      setScanIdMap(prev => ({ ...prev, [localScanId]: dbScanId }));
      // Update local scan with DB id for consistency
      setCurrentScan(prev => prev ? { ...prev, id: dbScanId } : null);
    }

    // Use real terminal server if connected
    if (terminalServer.isConnected) {
      try {
        terminalServer.executeCommand(localScanId, command, selectedTool.name, target);
      } catch (error) {
        toast.error('Failed to execute command: ' + (error as Error).message);
        if (dbScanId) {
          await completeScan(dbScanId, 'error');
        }
        setIsRunning(false);
      }
      return;
    }
    
    // Fallback to simulation
    const startTime = Date.now();
    let output = '';

    try {
      await simulateScan(selectedTool, values, async (line) => {
        output += line + '\n';
        setCurrentScan((prev) => prev ? { ...prev, output } : null);
      });

      const completedScan: ScanResult = {
        ...newScan,
        id: dbScanId || localScanId,
        output,
        status: 'completed',
        duration: Date.now() - startTime,
      };

      setCurrentScan(completedScan);
      
      if (dbScanId) {
        await appendOutput(dbScanId, output);
        await completeScan(dbScanId, 'completed');
      }
      
      toast.success(`${selectedTool.name} scan completed (simulated)`);
    } catch (error) {
      const errorOutput = output + '\n[ERROR] Scan failed: ' + (error as Error).message;
      const errorScan: ScanResult = {
        ...newScan,
        id: dbScanId || localScanId,
        output: errorOutput,
        status: 'error',
        duration: Date.now() - startTime,
      };

      setCurrentScan(errorScan);
      
      if (dbScanId) {
        await appendOutput(dbScanId, `\n[ERROR] Scan failed: ${(error as Error).message}`);
        await completeScan(dbScanId, 'error');
      }
      
      toast.error('Scan failed');
    } finally {
      setIsRunning(false);
    }
  }, [selectedTool, terminalServer, createScan, appendOutput, completeScan]);

  const handleCancelScan = useCallback(async () => {
    if (currentScan && isRunning) {
      terminalServer.cancelCommand(currentScan.id);
      setCurrentScan((prev) => prev ? { ...prev, status: 'error', output: prev.output + '\n[CANCELLED] Scan cancelled by user' } : null);
      
      const dbId = scanIdMap[currentScan.id] || currentScan.id;
      await appendOutput(dbId, '\n[CANCELLED] Scan cancelled by user');
      await completeScan(dbId, 'error');
      
      setIsRunning(false);
      toast.info('Scan cancelled');
    }
  }, [currentScan, isRunning, terminalServer, scanIdMap, appendOutput, completeScan]);

  const handleSelectFromHistory = (scan: ScanResult) => {
    setCurrentScan(scan);
  };

  const handleDeleteScan = async (id: string) => {
    await deleteScan(id);
    if (currentScan?.id === id) {
      setCurrentScan(null);
    }
    toast.success('Scan deleted');
  };

  const handleExportPDF = (scan: ScanResult) => {
    exportToPDF(scan);
    toast.success('PDF report exported');
  };

  const handleClearAll = async () => {
    await deleteAllScans();
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
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Database className="w-4 h-4 text-green-500" />
            <span>Cloud Synced</span>
          </div>
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
            <span>{pentestTools.length} Tools Ready</span>
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
              {scanHistory.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs rounded bg-primary/20 text-primary">
                  {scanHistory.length}
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
                history={scanHistory}
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
