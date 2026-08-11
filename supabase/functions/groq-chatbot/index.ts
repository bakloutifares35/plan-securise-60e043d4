// supabase/functions/groq-chatbot/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// Initialisation du client Supabase (avec les droits Admin pour lire TOUTES les tables)
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

// --- DÉFINITION DES OUTILS (TOOLS) ---
const tools = [
  {
    type: "function",
    function: {
      name: "search_processes",
      description: "Recherche des processus métier par nom ou criticité.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Terme de recherche (nom du processus)" },
          criticality: { type: "string", description: "Niveau de criticité (Critique, Majeur, Modéré)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_process_details",
      description: "Obtient les détails complets d'un processus (ressources, dépendances, stratégies).",
      parameters: {
        type: "object",
        properties: {
          process_id: { type: "string", description: "L'ID du processus" }
        },
        required: ["process_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_risks",
      description: "Recherche des risques par titre ou niveau de criticité.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Terme de recherche (titre du risque)" },
          niveau: { type: "string", description: "Niveau du risque (Critique, Élevé, Modéré, Faible)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_risk_details",
      description: "Obtient les détails d'un risque et ses actions de traitement.",
      parameters: {
        type: "object",
        properties: {
          risque_id: { type: "string", description: "L'ID du risque" }
        },
        required: ["risque_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_strategies_coverage",
      description: "Obtient un rapport sur la couverture des stratégies de continuité."
    }
  },
  {
    type: "function",
    function: {
      name: "search_cmdb_resources",
      description: "Recherche des ressources dans le CMDB par type et nom.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["hr", "equipment", "app", "supplier"], description: "Type de ressource" },
          query: { type: "string", description: "Nom de la ressource" }
        },
        required: ["type"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_dashboard_stats",
      description: "Obtient les statistiques globales du tableau de bord (KPIs)."
    }
  }
];

// --- FONCTIONS D'EXÉCUTION DES OUTILS ---
async function executeTool(name: string, args: any) {
  switch (name) {
    case "search_processes": {
      let query = supabase.from("processus_metier").select("id, name, direction, criticality_level, rto_hours, rpo_hours");
      if (args.query) query = query.ilike("name", `%${args.query}%`);
      if (args.criticality) query = query.eq("criticality_level", args.criticality);
      const { data, error } = await query.limit(10);
      if (error) throw error;
      return data;
    }
    case "get_process_details": {
      const { data, error } = await supabase
        .from("processus_metier")
        .select(`*, processus_ressources_humaines(ressource_humaine_id), processus_equipements(equipement_id), processus_applications(application_id), processus_fournisseurs(fournisseur_id)`)
        .eq("id", args.process_id)
        .single();
      if (error) throw error;
      return data;
    }
    case "search_risks": {
      let query = supabase.from("risques").select("id, title, category, niveau, score_residuel, status, owner");
      if (args.query) query = query.ilike("title", `%${args.query}%`);
      if (args.niveau) query = query.eq("niveau", args.niveau);
      const { data, error } = await query.limit(10);
      if (error) throw error;
      return data;
    }
    case "get_risk_details": {
      const { data, error } = await supabase
        .from("risques")
        .select(`*, plans_traitement(*)`)
        .eq("id", args.risque_id)
        .single();
      if (error) throw error;
      return data;
    }
    case "get_strategies_coverage": {
      // Logique identique à StrategyModule.tsx
      const { data: processus } = await supabase.from("processus_metier").select("id, criticality_level");
      const { data: associations } = await supabase.from("strategies_association").select("processus_id");
      
      const total = processus?.length || 0;
      const linkedIds = new Set(associations?.map(a => a.processus_id) || []);
      const covered = processus?.filter(p => linkedIds.has(p.id)).length || 0;
      const sansStrategie = total - covered;
      
      return { totalProcessus: total, couverts: covered, sansStrategie };
    }
    case "search_cmdb_resources": {
      let table = "";
      let query = supabase;
      switch(args.type) {
        case "hr": table = "ressources_humaines"; break;
        case "equipment": table = "ressources_equipements"; break;
        case "app": table = "applications_it"; break;
        case "supplier": table = "fournisseurs"; break;
      }
      query = supabase.from(table).select("*");
      if (args.query) query = query.ilike("name", `%${args.query}%`);
      const { data, error } = await query.limit(20);
      if (error) throw error;
      return data;
    }
    case "get_dashboard_stats": {
      // Logique simplifiée du Dashboard
      const { count: procCount } = await supabase.from("processus_metier").select("*", { count: "exact", head: true });
      return { totalProcessus: procCount };
    }
    default: return { error: "Outil inconnu" };
  }
}

// --- ROUTEUR PRINCIPAL ---
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    if (!GROQ_API_KEY) throw new Error("Clé API Groq non configurée");

    const { messages, history } = await req.json();
    
    // On envoie le prompt à Groq avec les outils
    const groqResponse = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [...(history || []), ...messages],
        tools: tools,
        tool_choice: "auto",
        temperature: 0.2
      })
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      throw new Error(`Erreur Groq: ${groqResponse.status} - ${errText}`);
    }

    const groqData = await groqResponse.json();
    const groqMessage = groqData.choices?.[0]?.message;

    // Si Groq veut utiliser un outil
    if (groqMessage.tool_calls && groqMessage.tool_calls.length > 0) {
      const toolResults = [];
      
      for (const call of groqMessage.tool_calls) {
        const args = JSON.parse(call.function.arguments);
        try {
          const result = await executeTool(call.function.name, args);
          toolResults.push({
            role: "tool",
            content: JSON.stringify(result),
            tool_call_id: call.id
          });
        } catch (error: any) {
          toolResults.push({
            role: "tool",
            content: `Erreur lors de l'exécution de l'outil: ${error.message}`,
            tool_call_id: call.id
          });
        }
      }

      // Second appel à Groq pour qu'il formule la réponse avec le résultat des outils
      const finalResponse = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [...(history || []), ...messages, groqMessage, ...toolResults],
          temperature: 0.2
        })
      });

      const finalData = await finalResponse.json();
      const finalContent = finalData.choices?.[0]?.message?.content || "Je n'ai pas pu traiter votre demande.";
      
      return new Response(JSON.stringify({ content: finalContent }), { headers: corsHeaders });
    }

    // Si Groq répond directement
    return new Response(JSON.stringify({ content: groqMessage.content }), { headers: corsHeaders });

  } catch (error: any) {
    console.error("Erreur:", error);
    return new Response(
      JSON.stringify({ error: "Le service d'assistance est temporairement indisponible." }),
      { status: 500, headers: corsHeaders }
    );
  }
});