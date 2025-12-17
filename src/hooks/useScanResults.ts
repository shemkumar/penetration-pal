import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ScanResult } from '@/lib/pentestTools';

export function useScanResults() {
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all scan results
  const fetchScans = useCallback(async () => {
    const { data, error } = await supabase
      .from('scan_results')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching scans:', error);
      setLoading(false);
      return;
    }

    const results: ScanResult[] = (data || []).map(row => ({
      id: row.id,
      toolId: row.tool_id,
      toolName: row.tool_name,
      target: row.target,
      command: row.command,
      output: row.output,
      status: row.status as 'running' | 'completed' | 'error',
      timestamp: new Date(row.started_at),
      duration: row.completed_at 
        ? new Date(row.completed_at).getTime() - new Date(row.started_at).getTime() 
        : undefined,
    }));

    setScanHistory(results);
    setLoading(false);
  }, []);

  // Create a new scan
  const createScan = useCallback(async (scan: Omit<ScanResult, 'id'>) => {
    const { data, error } = await supabase
      .from('scan_results')
      .insert({
        tool_id: scan.toolId,
        tool_name: scan.toolName,
        target: scan.target,
        command: scan.command,
        output: scan.output,
        status: scan.status,
        started_at: scan.timestamp.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating scan:', error);
      return null;
    }

    return data.id;
  }, []);

  // Update scan output (append)
  const appendOutput = useCallback(async (scanId: string, newOutput: string) => {
    // First get current output
    const { data: current } = await supabase
      .from('scan_results')
      .select('output')
      .eq('id', scanId)
      .maybeSingle();

    const updatedOutput = (current?.output || '') + newOutput;

    const { error } = await supabase
      .from('scan_results')
      .update({ output: updatedOutput })
      .eq('id', scanId);

    if (error) {
      console.error('Error updating scan output:', error);
    }
  }, []);

  // Complete a scan
  const completeScan = useCallback(async (scanId: string, status: 'completed' | 'error', exitCode?: number) => {
    const { error } = await supabase
      .from('scan_results')
      .update({
        status,
        exit_code: exitCode,
        completed_at: new Date().toISOString(),
      })
      .eq('id', scanId);

    if (error) {
      console.error('Error completing scan:', error);
    }
  }, []);

  // Delete a scan
  const deleteScan = useCallback(async (scanId: string) => {
    const { error } = await supabase
      .from('scan_results')
      .delete()
      .eq('id', scanId);

    if (error) {
      console.error('Error deleting scan:', error);
    }
  }, []);

  // Delete all scans
  const deleteAllScans = useCallback(async () => {
    const { error } = await supabase
      .from('scan_results')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      console.error('Error deleting all scans:', error);
    }
  }, []);

  // Set up real-time subscription
  useEffect(() => {
    fetchScans();

    const channel = supabase
      .channel('scan-results-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scan_results',
        },
        (payload) => {
          console.log('Realtime update:', payload);
          
          if (payload.eventType === 'INSERT') {
            const row = payload.new as any;
            const newScan: ScanResult = {
              id: row.id,
              toolId: row.tool_id,
              toolName: row.tool_name,
              target: row.target,
              command: row.command,
              output: row.output,
              status: row.status as 'running' | 'completed' | 'error',
              timestamp: new Date(row.started_at),
              duration: row.completed_at 
                ? new Date(row.completed_at).getTime() - new Date(row.started_at).getTime() 
                : undefined,
            };
            setScanHistory(prev => {
              // Avoid duplicates
              if (prev.some(s => s.id === newScan.id)) return prev;
              return [newScan, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as any;
            setScanHistory(prev => prev.map(scan => 
              scan.id === row.id 
                ? {
                    ...scan,
                    output: row.output,
                    status: row.status as 'running' | 'completed' | 'error',
                    duration: row.completed_at 
                      ? new Date(row.completed_at).getTime() - new Date(row.started_at).getTime() 
                      : scan.duration,
                  }
                : scan
            ));
          } else if (payload.eventType === 'DELETE') {
            const row = payload.old as any;
            setScanHistory(prev => prev.filter(scan => scan.id !== row.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchScans]);

  return {
    scanHistory,
    loading,
    createScan,
    appendOutput,
    completeScan,
    deleteScan,
    deleteAllScans,
    refetch: fetchScans,
  };
}
