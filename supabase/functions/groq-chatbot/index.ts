// supabase/functions/groq-chatbot/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

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

const SYSTEM_PROMPT = `Tu es l'Assistant Resillia, un expert en continuité d'activité (BCM/BIA/PCA/Risk Management) intégré à la plateforme Resillia, un logiciel professionnel utilisé par des entreprises clientes.

RÈGLES DE FOND :
- Réponds toujours en français, de façon claire, précise et professionnelle. Tu t'adresses à des décideurs et responsables métier, pas à des développeurs.
- Utilise SYSTÉMATIQUEMENT les outils disponibles pour aller chercher les données réelles de l'utilisateur avant de répondre à toute question sur ses processus, risques, ressources ou stratégies. Ne réponds jamais de mémoire ou par supposition sur ses données.
- Si un outil renvoie une liste vide ou aucun résultat, dis-le simplement et clairement (ex. "Aucun processus n'est actuellement marqué comme critique.").
- Quand on te demande "la solution" à un problème (un risque ou un processus non couvert), utilise get_risk_solution ou get_process_strategy_solution. Si l'outil indique qu'aucun plan/stratégie n'existe en base, propose alors une suggestion réaliste toi-même, en la présentant clairement comme "Aucune solution n'est encore enregistrée. Voici une suggestion :" pour ne jamais la confondre avec une donnée réelle de l'utilisateur.
- Si une question est ambiguë (ex: plusieurs risques possibles), demande une précision avant d'exécuter un outil coûteux.

RÈGLES DE FORME (TRÈS IMPORTANT, à respecter à chaque réponse) :
- N'utilise JAMAIS de symboles Markdown bruts : pas d'astérisques **, pas de tirets - en début de ligne, pas de dièses #. Ton texte doit être lisible tel quel dans une bulle de chat simple, sans mise en forme.
- Pour énumérer plusieurs éléments, utilise des phrases numérotées ("1. ... 2. ...") ou des phrases séparées, jamais de puces avec tiret.
- N'affiche JAMAIS les identifiants techniques (UUID, ID de base de données) dans tes réponses. Utilise uniquement les noms lisibles (nom du processus, nom de l'équipement, titre du risque). Si un outil te renvoie un ID, ignore-le dans ta réponse.
- Reste concis : 2 à 5 phrases pour une réponse simple, un peu plus pour une liste ou une suggestion de plan d'action, mais jamais un essai.
- Adopte un ton professionnel et confiant, adapté à un logiciel destiné à des clients d'entreprise.`;

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
      name: "get_risk_solution",
      description: "Obtient le plan de traitement existant pour un risque donné, si disponible. Renvoie un indicateur has_solution=false si aucune solution n'est enregistrée en base.",
      parameters: {
        type: "object",
        properties: {
          risque_id: { type: "string", description: "L'ID du risque" },
          query: { type: "string", description: "Nom/titre du risque si l'ID n'est pas connu" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_process_strategy_solution",
      description: "Obtient la stratégie de continuité existante liée à un processus, si disponible. Renvoie has_solution=false si aucune stratégie n'est enregistrée en base.",
      parameters: {
        type: "object",
        properties: {
          process_id: { type: "string", description: "L'ID du processus" },
          query: { type: "string", description: "Nom du processus si l'ID n'est pas connu" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_strategies_coverage",
      description: "Obtient un rapport sur la couverture des stratégies de continuité (nombre de processus couverts / non couverts)."
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
      name: "get_unlinked_resources",
      description: "Liste les ressources (personnel, équipements, applications, fournisseurs) qui ne sont liées à AUCUN processus métier. Utilise cet outil pour toute question du type 'combien de ressources ne sont pas liées à un processus'."
    }
  },
  {
    type: "function",
    function: {
      name: "get_dashboard_stats",
      description: "Obtient les statistiques globales du tableau de bord (KPIs : nombre de processus, risques, complétude)."
    }
  }
];

// --- UTILITAIRES DE CRITICITÉ (cohérents avec la logique du module BIA) ---
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
  } catch {
    return 0;
  }
  return max;
}

function scoreToLabel(score: number): string {
  if (score >= 4) return "Critique";
  if (score === 3) return "Majeur";
  if (score === 2) return "Modéré";
  if (score >= 1) return "Mineur";
  return "Non évalué";
}

// --- FONCTIONS D'EXÉCUTION DES OUTILS ---
async function executeTool(name: string, args: any) {
  switch (name) {
    case "search_processes": {
      let query = supabase.from("processus_metier").select("id, name, direction, impacts, rto_hours, rpo_hours");
      if (args.query) query = query.ilike("name", `%${args.query}%`);
      const { data, error } = await query.limit(50);
      if (error) throw error;

      let results = data || [];

      // IMPORTANT : le champ criticality_level en base n'est pas fiable (bug connu :
      // toujours "MINEUR" par défaut, jamais recalculé). On calcule donc systématiquement
      // la criticité réelle depuis le champ impacts, comme le fait le module BIA.
      const withComputedCriticality = results.map((p: any) => ({
        ...p,
        computedCriticality: scoreToLabel(computeMaxScoreFromImpacts(p.impacts)),
      }));

      let filtered = withComputedCriticality;
      if (args.criticality) {
        const target = String(args.criticality).toLowerCase();
        filtered = withComputedCriticality.filter((p: any) => p.computedCriticality.toLowerCase() === target);
      }

      return filtered.slice(0, 10).map((p: any) => ({
        id: p.id,
        name: p.name,
        direction: p.direction,
        criticality: p.computedCriticality,
        rto_hours: p.rto_hours,
        rpo_hours: p.rpo_hours,
      }));
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

    case "get_risk_solution": {
      let riskId = args.risque_id;

      // Si on n'a pas d'ID, on cherche le risque par titre d'abord
      if (!riskId && args.query) {
        const { data: found, error: searchError } = await supabase
          .from("risques")
          .select("id, title")
          .ilike("title", `%${args.query}%`)
          .limit(1)
          .maybeSingle();
        if (searchError) throw searchError;
        if (!found) return { has_solution: false, reason: "Aucun risque correspondant trouvé en base." };
        riskId = found.id;
      }

      if (!riskId) return { has_solution: false, reason: "Aucun identifiant ou titre de risque fourni." };

      const { data: risk, error } = await supabase
        .from("risques")
        .select(`id, title, category, niveau, score_residuel, plans_traitement(*)`)
        .eq("id", riskId)
        .maybeSingle();
      if (error) throw error;
      if (!risk) return { has_solution: false, reason: "Risque introuvable." };

      const plans = (risk as any).plans_traitement || [];
      if (plans.length === 0) {
        return {
          has_solution: false,
          risk_title: risk.title,
          risk_category: risk.category,
          risk_niveau: risk.niveau,
          reason: "Aucun plan de traitement n'est enregistré pour ce risque. Propose une suggestion réaliste à l'utilisateur en le précisant clairement."
        };
      }

      return { has_solution: true, risk_title: risk.title, plans };
    }

    case "get_process_strategy_solution": {
      let processId = args.process_id;

      if (!processId && args.query) {
        const { data: found, error: searchError } = await supabase
          .from("processus_metier")
          .select("id, name")
          .ilike("name", `%${args.query}%`)
          .limit(1)
          .maybeSingle();
        if (searchError) throw searchError;
        if (!found) return { has_solution: false, reason: "Aucun processus correspondant trouvé en base." };
        processId = found.id;
      }

      if (!processId) return { has_solution: false, reason: "Aucun identifiant ou nom de processus fourni." };

      const { data: process, error: processError } = await supabase
        .from("processus_metier")
        .select("id, name, criticality_level")
        .eq("id", processId)
        .maybeSingle();
      if (processError) throw processError;
      if (!process) return { has_solution: false, reason: "Processus introuvable." };

      const { data: associations, error: assocError } = await supabase
        .from("strategies_association")
        .select("*, strategies_continuite(*)")
        .eq("processus_id", processId);
      if (assocError) throw assocError;

      if (!associations || associations.length === 0) {
        return {
          has_solution: false,
          process_name: process.name,
          criticality: process.criticality_level,
          reason: "Aucune stratégie de continuité n'est associée à ce processus. Propose une suggestion réaliste à l'utilisateur en le précisant clairement."
        };
      }

      return { has_solution: true, process_name: process.name, strategies: associations };
    }

    case "get_strategies_coverage": {
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
      switch (args.type) {
        case "hr": table = "ressources_humaines"; break;
        case "equipment": table = "ressources_equipements"; break;
        case "app": table = "applications_it"; break;
        case "supplier": table = "fournisseurs"; break;
      }
      let query = supabase.from(table).select("*");
      if (args.query) query = query.ilike("name", `%${args.query}%`);
      const { data, error } = await query.limit(20);
      if (error) throw error;

      // On met le nom en avant et on garde le reste des champs utiles,
      // pour éviter que le modèle ne mette en avant l'ID technique.
      return (data || []).map((r: any) => {
        const { id, ...rest } = r;
        return { name: r.name, ...rest };
      });
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
        const { data: allResources, error: resError } = await supabase.from(cfg.table).select("id, name");
        if (resError) throw resError;

        const { data: links, error: linkError } = await supabase.from(cfg.linkTable).select(cfg.linkColumn);
        if (linkError) throw linkError;

        const linkedIds = new Set((links || []).map((l: any) => l[cfg.linkColumn]));
        const unlinked = (allResources || []).filter((r: any) => !linkedIds.has(r.id));

        results[cfg.label] = { count: unlinked.length, items: unlinked.map((r: any) => r.name) };
        totalUnlinked += unlinked.length;
      }

      return { totalUnlinked, detail: results };
    }

    case "get_dashboard_stats": {
      const { count: procCount } = await supabase.from("processus_metier").select("*", { count: "exact", head: true });
      const { count: riskCount } = await supabase.from("risques").select("*", { count: "exact", head: true });
      return { totalProcessus: procCount, totalRisques: riskCount };
    }

    default:
      return { error: "Outil inconnu" };
  }
}

// --- ROUTEUR PRINCIPAL ---
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    if (!GROQ_API_KEY) throw new Error("Clé API Groq non configurée");

    const { messages, history } = await req.json();

    const fullMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(history || []),
      ...messages,
    ];

    const groqResponse = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: fullMessages,
        tools: tools,
        tool_choice: "auto",
        temperature: 0.3
      })
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      console.error(`Erreur Groq (${groqResponse.status}):`, errText);
      throw new Error(`Erreur Groq: ${groqResponse.status} - ${errText}`);
    }

    const groqData = await groqResponse.json();
    const groqMessage = groqData.choices?.[0]?.message;

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
          toolResults.push({
            role: "tool",
            content: JSON.stringify(result),
            tool_call_id: call.id
          });
        } catch (error: any) {
          console.error(`Erreur exécution outil ${call.function.name}:`, error.message);
          toolResults.push({
            role: "tool",
            content: JSON.stringify({ error: `Erreur lors de l'exécution de l'outil: ${error.message}` }),
            tool_call_id: call.id
          });
        }
      }

      const finalResponse = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          messages: [...fullMessages, groqMessage, ...toolResults],
          temperature: 0.3
        })
      });

      if (!finalResponse.ok) {
        const errText = await finalResponse.text();
        console.error(`Erreur Groq second appel (${finalResponse.status}):`, errText);
        throw new Error(`Erreur Groq (second appel): ${finalResponse.status}`);
      }

      const finalData = await finalResponse.json();
      const finalContent = finalData.choices?.[0]?.message?.content || "Je n'ai pas pu traiter votre demande.";

      return new Response(JSON.stringify({ content: finalContent }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ content: groqMessage?.content || "Je n'ai pas pu générer de réponse." }), { headers: corsHeaders });

  } catch (error: any) {
    console.error("Erreur groq-chatbot:", error?.message || error);
    return new Response(
      JSON.stringify({ error: "Le service d'assistance est temporairement indisponible.", debug: error?.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});