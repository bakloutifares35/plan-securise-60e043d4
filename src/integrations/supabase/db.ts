// Untyped Supabase client for production business tables (schema not covered by generated types).
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase as typedClient } from "@/integrations/resillia/client";

export const supabase = typedClient as unknown as SupabaseClient<any, "public", any>;
export default supabase;
