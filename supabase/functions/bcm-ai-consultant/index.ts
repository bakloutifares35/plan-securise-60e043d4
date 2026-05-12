import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { sector, size, country, subsidiaries, description } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `Tu es un consultant senior expert en Plan de Continuité d'Activité (PCA / BCM).
À partir des informations sur l'entreprise fournies par l'utilisateur, tu dois générer une suggestion structurée comprenant:
1. Un organigramme des départements clés adaptés au secteur et à la taille
2. Une liste de 6 à 10 processus métiers critiques avec RTO, RPO, MTPD et niveau de criticité
3. Les 5 à 8 risques principaux avec probabilité (1-5), impact (1-5), score (probabilité*impact) et mesures recommandées

Réponds UNIQUEMENT via l'appel à l'outil generate_bcm_plan. Tout le contenu doit être en français.`;

    const userPrompt = `Secteur: ${sector}
Taille: ${size}
Pays: ${country}
Nombre de filiales: ${subsidiaries}
Description: ${description || "(non précisée)"}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_bcm_plan",
              description: "Génère une suggestion de PCA structurée",
              parameters: {
                type: "object",
                properties: {
                  org_chart: {
                    type: "array",
                    description: "Arbre des départements (racine = entreprise)",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        children: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              name: { type: "string" },
                              children: {
                                type: "array",
                                items: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
                              },
                            },
                            required: ["name"],
                          },
                        },
                      },
                      required: ["name"],
                    },
                  },
                  processes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        department: { type: "string" },
                        rto: { type: "string", description: "ex: 4h, 24h, 72h" },
                        rpo: { type: "string" },
                        mtpd: { type: "string" },
                        mbco: { type: "string", description: "Niveau minimal d'activité acceptable" },
                        criticality: { type: "string", enum: ["Critique", "Majeur", "Modéré", "Mineur"] },
                      },
                      required: ["name", "department", "rto", "rpo", "mtpd", "mbco", "criticality"],
                    },
                  },
                  risks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        category: { type: "string" },
                        probability: { type: "integer", minimum: 1, maximum: 5 },
                        impact: { type: "integer", minimum: 1, maximum: 5 },
                        measures: { type: "array", items: { type: "string" } },
                      },
                      required: ["name", "category", "probability", "impact", "measures"],
                    },
                  },
                },
                required: ["org_chart", "processes", "risks"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_bcm_plan" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429)
        return new Response(JSON.stringify({ error: "Limite de requêtes atteinte. Réessayez plus tard." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402)
        return new Response(JSON.stringify({ error: "Crédits IA épuisés. Ajoutez du crédit dans votre espace Lovable." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erreur du service IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("Réponse IA invalide");
    const args = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("bcm-ai-consultant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
