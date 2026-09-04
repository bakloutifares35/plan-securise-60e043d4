// Client dédié à l'appel des Edge Functions.
// Les données métier vivent sur le projet Resillia (ipbfddubgzypgfkfkvbb),
// mais les Edge Functions sont déployées sur le backend Lovable Cloud.
// Il faut donc les invoquer avec CE client, pas avec le client Resillia.
import { supabase as cloudClient } from "@/integrations/supabase/client";

export const functionsClient = cloudClient;
export default functionsClient;
