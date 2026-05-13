import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { entities } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const orgSummary = (entities as any[])
      .map((e) => `- ${e.name} (${e.type || "—"}, ${e.sector}, ${e.country})`)
      .join("\n");

    const systemPrompt = `Tu es un consultant senior expert en Plan de Continuité d'Activité (PCA / BCM).
À partir de l'organigramme fourni, propose pour CHAQUE entité (notamment directions et services) une liste de 3 à 6 processus métiers critiques typiques.
Pour chaque processus, indique un niveau de criticité (Critique / Majeur / Modéré / Mineur).
Réponds UNIQUEMENT via l'outil suggest_processes. Tout en français.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Organigramme:\n${orgSummary}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "suggest_processes",
            description: "Suggère les processus métiers par entité",
            parameters: {
              type: "object",
              properties: {
                groups: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      entityId: { type: "string", description: "id de l'entité (ex: e2)" },
                      entityName: { type: "string" },
                      processes: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            name: { type: "string" },
                            criticality: { type: "string", enum: ["Critique", "Majeur", "Modéré", "Mineur"] },
                          },
                          required: ["name", "criticality"],
                        },
                      },
                    },
                    required: ["entityId", "entityName", "processes"],
                  },
                },
              },
              required: ["groups"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "suggest_processes" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Limite de requêtes atteinte." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Crédits IA épuisés." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erreur du service IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("Réponse IA invalide");
    const args = JSON.parse(toolCall.function.arguments);

    // Pass through entityIds as provided; client will reconcile by name if id mismatch.
    const userEntities = entities as any[];
    for (const g of args.groups) {
      if (!userEntities.find((e) => e.id === g.entityId)) {
        const match = userEntities.find((e) => e.name.toLowerCase() === g.entityName.toLowerCase());
        if (match) g.entityId = match.id;
      }
    }

    return new Response(JSON.stringify(args), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("org-process-suggester error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
