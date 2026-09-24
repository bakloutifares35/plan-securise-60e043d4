// Client Supabase dédié au projet Resillia de production (ipbfddubgzypgfkfkvbb).
// La clé publiable (anon) est publique par conception : la sécurité repose sur les policies RLS.
import { createClient } from "@supabase/supabase-js";

export const RESILLIA_SUPABASE_PROJECT_ID = "ipbfddubgzypgfkfkvbb";
export const RESILLIA_SUPABASE_URL = "https://ipbfddubgzypgfkfkvbb.supabase.co";
export const RESILLIA_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_DeaCFb2Z8zBaSl2B8guQIg_foy92Tdr";

// Le schéma de ce projet est géré hors de Lovable (dépôt Git de production),
// les types générés localement ne s'appliquent donc pas : client non typé volontairement.
export const supabase = createClient(RESILLIA_SUPABASE_URL, RESILLIA_SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
});