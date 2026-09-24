// supabase/functions/groq-chatbot/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

let GROQ_API_KEY: string | undefined;
let supabase: ReturnType<typeof createClient> | null = null;

function initClients() {
  if (supabase) return;
  GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? undefined;
  supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
}

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// ✅ The ONLY viable model for tool calling on Groq right now
const GROQ_MODEL = "openai/gpt-oss-120b";

const SYSTEM_PROMPT = `Tu es l'Assistant Resillia, un expert en continuité d'activité (BCM/BIA/PCA/Risk Management) intégré à la plateforme Resillia.

RÈGLES DE FOND :
- Réponds toujours en français, de façon claire, précise et professionnelle.
- Utilise SYSTÉMATIQUEMENT les outils disponibles pour aller chercher les données réelles de l'utilisateur.
- Si un outil renvoie une liste vide, dis-le simplement et clairement.
- Quand on te demande "la solution", utilise get_risk_solution ou get_process_strategy_solution. Si aucun plan n'existe, propose une suggestion réaliste en la présentant clairement comme telle.
- Si une question est ambiguë, demande une précision avant d'exécuter un outil.

RÈGLES DE FORME :
- N'utilise JAMAIS de symboles Markdown bruts (**, -, #).
- Pour énumérer, utilise des phrases numérotées ("1. ... 2. ...").
- N'affiche JAMAIS les identifiants techniques (UUID).
- Reste concis : 2 à 5 phrases.
- Ton professionnel et confiant.`;

const tools = [
  {
    type: "function",
    function: {
      name: "search_processes",
      description: "Recherche des processus métier par nom ou criticité. Utilise null pour ignorer un filtre.",
      parameters: {
        type: "object",
        properties: {
          query: { type: ["string", "null"], description: "Terme de recherche, ou null." },
          criticality: { type: ["string", "null"], enum: ["Critique", "Majeur", "Modéré", "Mineur", null], description: "Niveau de criticité, ou null." }
        },
        required: [],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_process_details",
      description: "Obtient les détails complets d'un processus.",
      parameters: {
        type: "object",
        properties: { process_id: { type: "string", description: "L'ID du processus" } },
        required: ["process_id"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_risks",
      description: "Recherche des risques par titre ou niveau.",
      parameters: {
        type: "object",
        properties: {
          query: { type: ["string", "null"], description: "Terme de recherche, ou null." },
          niveau: { type: ["string", "null"], enum: ["Critique", "Élevé", "Modéré", "Faible", null], description: "Niveau du risque, ou null." }
        },
        required: [],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_risk_details",
      description: "Obtient les détails d'un risque et ses actions.",
      parameters: {
        type: "object",
        properties: { risque_id: { type: "string", description: "L'ID du risque" } },
        required: ["risque_id"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_risk_solution",
      description: "Obtient le plan de traitement d'un risque.",
      parameters: {
        type: "object",
        properties: {
          risque_id: { type: ["string", "null"], description: "L'ID du risque, ou null." },
          query: { type: ["string", "null"], description: "Nom du risque, ou null." }
        },
        required: [],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_process_strategy_solution",
      description: "Obtient la stratégie de continuité d'un processus.",
      parameters: {
        type: "object",
        properties: {
          process_id: { type: ["string", "null"], description: "L'ID du processus, ou null." },
          query: { type: ["string", "null"], description: "Nom du processus, ou null." }
        },
        required: [],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_strategies_coverage",
      description: "Rapport sur la couverture des stratégies de continuité.",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false }
    }
  },
  {
    type: "function",
    function: {
      name: "search_cmdb_resources",
      description: "Recherche des ressources dans le CMDB.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["hr", "equipment", "app", "supplier"], description: "Type de ressource" },
          query: { type: ["string", "null"], description: "Nom de la ressource, ou null." }
        },
        required: ["type"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_unlinked_resources",
      description: "Liste les ressources non liées à un processus.",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false }
    }
  },
  {
    type: "function",
    function: {
      name: "get_dashboard_stats",
      description: "Statistiques globales du tableau de bord.",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false }
    }
  }
];

function computeMaxScoreFromImpacts(impacts: any): number {
  if (!impacts) return 0;
  let max = 0;
  try {
    const parsed = typeof impacts === "string" ? JSON.parse(impacts) : impacts;
    for (const period of Object.values(parsed || {})) {
      if (typeof period === "object" && period !== null) {
        for (const val of Object.values(period as any)) {
          const num = typeof val === "number" ? val : parseInt(String(val));
          if (!isNaN(num) && num > max) max = num;
        }
      }
    }
  } catch { return 0; }
  return max;
}

function scoreToLabel(score: number): string {
  if (score >= 4) return "Critique";
  if (score === 3) return "Majeur";
  if (score === 2) return "Modéré";
  if (score >= 1) return "Mineur";
  return "Non évalué";
}

function normalizeToolArgs(args: any): any {
  if (!args || typeof args !== "object") return {};
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(args)) {
    if (value === null || value === undefined || value === "") continue;
    cleaned[key] = value;
  }
  return cleaned;
}

async function executeTool(name: string, rawArgs: any) {
  const sb = supabase!;
  const args = normalizeToolArgs(rawArgs);

  switch (name) {
    case "search_processes": {
      let query = sb.from("processus_metier").select("id, name, direction, impacts, rto_hours, rpo_hours");
      if (args.query) query = query.ilike("name", `%${args.query}%`);
      const { data, error } = await query.limit(50);
      if (error) throw error;
      const withComputed = (data || []).map((p: any) => ({ ...p, computedCriticality: scoreToLabel(computeMaxScoreFromImpacts(p.impacts)) }));
      let filtered = withComputed;
      if (args.criticality) {
        const target = String(args.criticality).toLowerCase();
        filtered = withComputed.filter((p: any) => p.computedCriticality.toLowerCase() === target);
      }
      return filtered.slice(0, 10).map((p: any) => ({ id: p.id, name: p.name, direction: p.direction, criticality: p.computedCriticality, rto_hours: p.rto_hours, rpo_hours: p.rpo_hours }));
    }
    case "get_process_details": {
      const { data, error } = await sb.from("processus_metier").select(`*, processus_ressources_humaines(ressource_humaine_id), processus_equipements(equipement_id), processus_applications(application_id), processus_fournisseurs(fournisseur_id)`).eq("id", args.process_id).single();
      if (error) throw error;
      return data;
    }
    case "search_risks": {
      let query = sb.from("risques").select("id, title, category, niveau, score_residuel, status, owner");
      if (args.query) query = query.ilike("title", `%${args.query}%`);
      if (args.niveau) query = query.eq("niveau", args.niveau);
      const { data, error } = await query.limit(10);
      if (error) throw error;
      return data;
    }
    case "get_risk_details": {
      const { data, error } = await sb.from("risques").select(`*, plans_traitement(*)`).eq("id", args.risque_id).single();
      if (error) throw error;
      return data;
    }
    case "get_risk_solution": {
      let riskId = args.risque_id;
      if (!riskId && args.query) {
        const { data: found, error: searchError } = await sb.from("risques").select("id, title").ilike("title", `%${args.query}%`).limit(1).maybeSingle();
        if (searchError) throw searchError;
        if (!found) return { has_solution: false, reason: "Aucun risque correspondant trouvé en base." };
        riskId = found.id;
      }
      if (!riskId) return { has_solution: false, reason: "Aucun identifiant ou titre de risque fourni." };
      const { data: risk, error } = await sb.from("risques").select(`id, title, category, niveau, score_residuel, plans_traitement(*)`).eq("id", riskId).maybeSingle();
      if (error) throw error;
      if (!risk) return { has_solution: false, reason: "Risque introuvable." };
      const plans = (risk as any).plans_traitement || [];
      if (plans.length === 0) return { has_solution: false, risk_title: risk.title, risk_category: risk.category, risk_niveau: risk.niveau, reason: "Aucun plan de traitement n'est enregistré." };
      return { has_solution: true, risk_title: risk.title, plans };
    }
    case "get_process_strategy_solution": {
      let processId = args.process_id;
      if (!processId && args.query) {
        const { data: found, error: searchError } = await sb.from("processus_metier").select("id, name").ilike("name", `%${args.query}%`).limit(1).maybeSingle();
        if (searchError) throw searchError;
        if (!found) return { has_solution: false, reason: "Aucun processus correspondant trouvé en base." };
        processId = found.id;
      }
      if (!processId) return { has_solution: false, reason: "Aucun identifiant ou nom de processus fourni." };
      const { data: process, error: processError } = await sb.from("processus_metier").select("id, name, criticality_level").eq("id", processId).maybeSingle();
      if (processError) throw processError;
      if (!process) return { has_solution: false, reason: "Processus introuvable." };
      const { data: associations, error: assocError } = await sb.from("strategies_association").select("*, strategies_continuite(*)").eq("processus_id", processId);
      if (assocError) throw assocError;
      if (!associations || associations.length === 0) return { has_solution: false, process_name: process.name, criticality: process.criticality_level, reason: "Aucune stratégie de continuité n'est associée à ce processus." };
      return { has_solution: true, process_name: process.name, strategies: associations };
    }
    case "get_strategies_coverage": {
      const { data: processus } = await sb.from("processus_metier").select("id, criticality_level");
      const { data: associations } = await sb.from("strategies_association").select("processus_id");
      const total = processus?.length || 0;
      const linkedIds = new Set(associations?.map(a => a.processus_id) || []);
      const covered = processus?.filter(p => linkedIds.has(p.id)).length || 0;
      return { totalProcessus: total, couverts: covered, sansStrategie: total - covered };
    }
    case "search_cmdb_resources": {
      let table = "";
      switch (args.type) {
        case "hr": table = "ressources_humaines"; break;
        case "equipment": table = "ressources_equipements"; break;
        case "app": table = "applications_it"; break;
        case "supplier": table = "fournisseurs"; break;
      }
      let query = sb.from(table).select("*");
      if (args.query) query = query.ilike("name", `%${args.query}%`);
      const { data, error } = await query.limit(20);
      if (error) throw error;
      return (data || []).map((r: any) => { const { id, ...rest } = r; return { name: r.name, ...rest }; });
    }
    case "get_unlinked_resources": {
      const resourceConfigs = [
        { table: "ressources_humaines", linkTable: "processus_ressources_humaines", linkColumn: "ressource_humaine_id", label: "Personnel" },
        { table: "ressources_equipements", linkTable: "processus_equipements", linkColumn: "equipement_id", label: "Équipements" },
        { table: "applications_it", linkTable: "processus_applications", linkColumn: "application_id", label: "Applications IT" },
        { table: "fournisseurs", linkTable: "processus_fournisseurs", linkColumn: "fournisseur_id", label: "Fournisseurs" },
      ];
      const results: Record<string, any> = {};
      let totalUnlinked = 0;
      for (const cfg of resourceConfigs) {
        const { data: allResources, error: resError } = await sb.from(cfg.table).select("id, name");
        if (resError) throw resError;
        const { data: links, error: linkError } = await sb.from(cfg.linkTable).select(cfg.linkColumn);
        if (linkError) throw linkError;
        const linkedIds = new Set((links || []).map((l: any) => l[cfg.linkColumn]));
        const unlinked = (allResources || []).filter((r: any) => !linkedIds.has(r.id));
        results[cfg.label] = { count: unlinked.length, items: unlinked.map((r: any) => r.name) };
        totalUnlinked += unlinked.length;
      }
      return { totalUnlinked, detail: results };
    }
    case "get_dashboard_stats": {
      const { count: procCount } = await sb.from("processus_metier").select("*", { count: "exact", head: true });
      const { count: riskCount } = await sb.from("risques").select("*", { count: "exact", head: true });
      return { totalProcessus: procCount, totalRisques: riskCount };
    }
    default: return { error: "Outil inconnu" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    initClients();
    if (!GROQ_API_KEY) throw new Error("Clé API Groq non configurée");

    const { messages, history } = await req.json();
    const fullMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(history || []),
      ...messages,
    ];

    // ============ FIRST CALL — with tools ============
    const groqResponse = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: fullMessages,
        tools: tools,
        tool_choice: "auto",
        temperature: 0.3,
        parallel_tool_calls: false,
      })
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      console.error(`Erreur Groq (${groqResponse.status}):`, errText);
      throw new Error(`Erreur Groq: ${groqResponse.status} - ${errText}`);
    }

    const groqData = await groqResponse.json();
    const groqMessage = groqData.choices?.[0]?.message;

    // ============ CASE 1: tool calls ============
    if (groqMessage?.tool_calls && groqMessage.tool_calls.length > 0) {
      const toolResults = [];
      for (const call of groqMessage.tool_calls) {
        let args: any = {};
        try {
          args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        } catch (parseErr) {
          console.error("Erreur parsing arguments outil:", call.function.arguments);
        }
        try {
          const result = await executeTool(call.function.name, args);
          toolResults.push({ role: "tool", content: JSON.stringify(result), tool_call_id: call.id });
        } catch (error: any) {
          console.error(`Erreur exécution outil ${call.function.name}:`, error.message);
          toolResults.push({ role: "tool", content: JSON.stringify({ error: `Erreur: ${error.message}` }), tool_call_id: call.id });
        }
      }

      // ============ SECOND CALL — WITHOUT tools ============
      // ✅ CHANGED: The instruction is now "synthesize these results" instead of "don't call tools"
      const finalMessages = [
        ...fullMessages,
        { role: "assistant", content: groqMessage.content || null, tool_calls: groqMessage.tool_calls },
        ...toolResults,
        {
          role: "user",
          content: "Les résultats des outils sont ci-dessus. Synthétise-les maintenant en une réponse claire et concise pour l'utilisateur. Ne fais aucun nouvel appel d'outil."
        }
      ];

      const finalResponse = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: finalMessages,
          temperature: 0.3,
        })
      });

      if (!finalResponse.ok) {
        const errText = await finalResponse.text();
        console.error(`Erreur Groq second appel (${finalResponse.status}):`, errText);
        throw new Error(`Erreur Groq (second appel): ${finalResponse.status}`);
      }

      const finalData = await finalResponse.json();
      const finalMessage = finalData.choices?.[0]?.message;
      let finalContent = finalMessage?.content;

      // ✅ FALLBACK: If the model STILL hallucinated a tool call, retry once with a stricter prompt
      if (!finalContent && finalMessage?.tool_calls?.length > 0) {
        console.warn("⚠️ Tool call halluciné détecté au 2ème appel, retry forcé en texte");
        const retryResponse = await fetch(GROQ_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
          body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [
              ...finalMessages,
              { role: "assistant", content: null, tool_calls: finalMessage.tool_calls },
              { role: "user", content: "Réponds en texte pur uniquement. Pas d'appel d'outil. Pas de JSON. Juste une réponse en français." }
            ],
            temperature: 0.1,
          })
        });
        const retryData = await retryResponse.json();
        finalContent = retryData.choices?.[0]?.message?.content;
      }

      finalContent = finalContent || "Je n'ai pas pu traiter votre demande.";

      return new Response(JSON.stringify({ content: finalContent }), { headers: corsHeaders });
    }

    // ============ CASE 2: direct text answer ============
    return new Response(JSON.stringify({ content: groqMessage?.content || "Je n'ai pas pu générer de réponse." }), { headers: corsHeaders });

  } catch (error: any) {
    console.error("Erreur groq-chatbot:", error?.message || error);
    return new Response(
      JSON.stringify({ error: "Le service d'assistance est temporairement indisponible.", debug: error?.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});