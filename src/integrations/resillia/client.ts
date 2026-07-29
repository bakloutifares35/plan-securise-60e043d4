// Client Supabase dédié au projet Resillia de production (ipbfddubgzypgfkfkvbb).
// La clé publiable (anon) est publique par conception : la sécurité repose sur les policies RLS.
import { createClient } from "@supabase/supabase-js";

export const RESILLIA_SUPABASE_PROJECT_ID = "ipbfddubgzypgfkfkvbb";
export const RESILLIA_SUPABASE_URL = "https://ipbfddubgzypgfkfkvbb.supabase.co";
export const RESILLIA_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwYmZkZHViZ3p5cGdma2ZrdmJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NDUzMTMsImV4cCI6MjA5NDMyMTMxM30.rs7nGHUnX_F-kRymZQ00FkuNsDCCLT5tB0DHb53jCAQ";

// Le schéma de ce projet est géré hors de Lovable (dépôt Git de production),
// les types générés localement ne s'appliquent donc pas : client non typé volontairement.
export const supabase = createClient(RESILLIA_SUPABASE_URL, RESILLIA_SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
});
