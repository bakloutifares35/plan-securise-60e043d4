
CREATE TABLE IF NOT EXISTS public.risques (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'À analyser',
  severity TEXT DEFAULT 'Moyen',
  category TEXT,
  owner TEXT,
  method_used TEXT,
  analysis_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.risques TO anon, authenticated;
GRANT ALL ON public.risques TO service_role;

ALTER TABLE public.risques ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read risques" ON public.risques FOR SELECT USING (true);
CREATE POLICY "Public insert risques" ON public.risques FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update risques" ON public.risques FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete risques" ON public.risques FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_risques_updated_at
BEFORE UPDATE ON public.risques
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
