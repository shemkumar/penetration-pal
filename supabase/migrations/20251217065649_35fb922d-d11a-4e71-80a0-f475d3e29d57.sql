-- Create scan_results table
CREATE TABLE public.scan_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tool_name TEXT NOT NULL,
  tool_id TEXT NOT NULL,
  target TEXT NOT NULL,
  command TEXT NOT NULL,
  output TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'error', 'cancelled')),
  exit_code INTEGER,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security (public read/write for this pentest tool - no auth required)
ALTER TABLE public.scan_results ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read scan results
CREATE POLICY "Anyone can read scan results" 
ON public.scan_results 
FOR SELECT 
USING (true);

-- Allow anyone to insert scan results
CREATE POLICY "Anyone can insert scan results" 
ON public.scan_results 
FOR INSERT 
WITH CHECK (true);

-- Allow anyone to update scan results
CREATE POLICY "Anyone can update scan results" 
ON public.scan_results 
FOR UPDATE 
USING (true);

-- Allow anyone to delete scan results
CREATE POLICY "Anyone can delete scan results" 
ON public.scan_results 
FOR DELETE 
USING (true);

-- Enable realtime for scan_results table
ALTER PUBLICATION supabase_realtime ADD TABLE public.scan_results;