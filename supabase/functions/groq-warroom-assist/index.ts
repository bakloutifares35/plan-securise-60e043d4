// supabase/functions/groq-warroom-assist/index.ts
// Recommandations IA pour la fiche crise War Room.
// Même pattern que groq-strategy-assist : appel Groq, fallback modèle, JSON strict.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ============================================================
// CORS — défini AVANT tout accès à Deno.env.get()
// ============================================================
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const LOVABLE_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const LOVABLE_MODEL = "google/gemini-2.5-flash";
const REQUEST_TIMEOUT_MS = 30000;

interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface WarRoomSuggestion {
  actions: { titre: string; description: string }[];
  plans_suggeres: { nom: string; raison: string }[];
}

class AiApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AiApiError";
    this.status = status;
  }
}

class AiTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiTimeoutError";
  }
}

async function performFetch(
  url: string,
  apiKey: string,
  body: unknown,
  controller: AbortController
): Promise<Response> {
  return await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
}

async function callModel(messages: GroqMessage[]): Promise<{ content: string; model: string }> {
  const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
  const GROQ_MODEL = Deno.env.get("GROQ_MODEL") || "openai/gpt-oss-120b";
  const GROQ_FALLBACK_MODEL = Deno.env.get("GROQ_FALLBACK_MODEL") || "openai/gpt-oss-20b";
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const baseBody: Record<string, unknown> = {
    messages,
    temperature: 0.2,
    max_tokens: 900,
    response_format: { type: "json_object" },
  };

  try {
    // 1) Groq — modèle principal puis fallback
    if (GROQ_API_KEY) {
      let modelUsed = GROQ_MODEL;
      let response = await performFetch(
        GROQ_API_URL,
        GROQ_API_KEY,
        { ...baseBody, model: GROQ_MODEL, reasoning_effort: GROQ_MODEL.includes("gpt-oss") ? "medium" : undefined },
        controller
      );

      if (!response.ok) {
        console.warn(`[groq-warroom-assist] ${GROQ_MODEL} a échoué (${response.status}), fallback ${GROQ_FALLBACK_MODEL}`);
        response = await performFetch(
          GROQ_API_URL,
          GROQ_API_KEY,
          { ...baseBody, model: GROQ_FALLBACK_MODEL },
          controller
        );
        modelUsed = GROQ_FALLBACK_MODEL;
      }

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) return { content, model: modelUsed };
      } else {
        const errorText = await response.text();
        console.error(`[groq-warroom-assist] Erreur Groq (${modelUsed}):`, response.status, errorText);
        if (!LOVABLE_API_KEY) throw new AiApiError(response.status, errorText);
      }
    }

    // 2) Fallback Lovable AI
    if (LOVABLE_API_KEY) {
      const response = await performFetch(
        LOVABLE_URL,
        LOVABLE_API_KEY,
        { ...baseBody, model: LOVABLE_MODEL },
        controller
      );
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[groq-warroom-assist] Erreur fallback IA:", response.status, errorText);
        throw new AiApiError(response.status, errorText);
      }
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) return { content, model: LOVABLE_MODEL };
    }

    throw new AiApiError(500, "Aucun fournisseur IA disponible");
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new AiTimeoutError("Le service IA a mis trop de temps à répondre");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseJson<T>(content: string): T {
  const clean = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  if (clean.startsWith("{")) return JSON.parse(clean);
  const match = clean.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);
  throw new Error("Impossible d'extraire un JSON valide de la réponse");
}

function normalize(parsed: Partial<WarRoomSuggestion>): WarRoomSuggestion {
  const actions = Array.isArray(parsed.actions) ? parsed.actions : [];
  const plans = Array.isArray(parsed.plans_suggeres) ? parsed.plans_suggeres : [];
  return {
    actions: actions
      .filter((a) => a && typeof a === "object")
      .map((a) => ({
        titre: String((a as any).titre || "").trim(),
        description: String((a as any).description || "").trim(),
      }))
      .filter((a) => a.titre.length > 0)
      .slice(0, 5),
    plans_suggeres: plans
      .filter((p) => p && typeof p === "object")
      .map((p) => ({
        nom: String((p as any).nom || "").trim(),
        raison: String((p as any).raison || "").trim(),
      }))
      .filter((p) => p.nom.length > 0)
      .slice(0, 5),
  };
}

serve(async (req) => {
  // 1) Preflight CORS — AVANT TOUT
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Méthode non supportée. Utilisez POST." }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Format JSON invalide" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const context = body?.context && typeof body.context === "object" ? body.context : body;
    const {
      type_incident,
      severite,
      titre,
      description,
      processus = [],
      plans_disponibles = [],
    } = context || {};

    if (JSON.stringify(context || {}).length > 12000) {
      return new Response(JSON.stringify({ error: "Le contexte est trop volumineux" }), {
        status: 413,
        headers: corsHeaders,
      });
    }

    const processusList = Array.isArray(processus) && processus.length
      ? processus
          .map(
            (p: any) =>
              `- ${p.nom || p.name || "Processus"}${p.criticite ? ` | criticité: ${p.criticite}` : ""}${
                p.rto ? ` | RTO: ${p.rto}` : ""
              }`
          )
          .join("\n")
      : "- Aucun processus impacté renseigné";

    const plansList = Array.isArray(plans_disponibles) && plans_disponibles.length
      ? plans_disponibles.map((p: any) => `- ${p.titre || p.nom || p}`).join("\n")
      : "- Aucun plan référencé dans la plateforme";

    const prompt = `Tu es un directeur de crise expert en continuité d'activité (ISO 22301) qui assiste une cellule de crise bancaire en temps réel.

CONTEXTE DE LA CRISE :
- Type d'incident : ${type_incident || "Non spécifié"}
- Sévérité : ${severite || "Non spécifiée"} (P1 = critique, P4 = mineur)
- Intitulé : ${titre || "Non spécifié"}
- Description : ${description || "Non spécifiée"}

PROCESSUS IMPACTÉS :
${processusList}

PLANS PCA DISPONIBLES DANS LA PLATEFORME :
${plansList}

CONSIGNES :
1. Propose 3 à 5 actions initiales prioritaires, concrètes et immédiatement exécutables, adaptées à CE contexte précis (type, sévérité, processus, RTO).
2. Classe-les de la plus urgente à la moins urgente.
3. Propose les plans PCA pertinents à activer. Choisis EN PRIORITÉ parmi les plans disponibles listés (reprends leur intitulé exact). Si aucun ne convient, propose un plan générique adapté.
4. Ne jamais inventer d'informations absentes du contexte.
5. Rédige en français, style professionnel et opérationnel, phrases courtes.

Retourne UNIQUEMENT un JSON valide, sans texte hors JSON, avec exactement ce format :
{
  "actions": [{"titre": "...", "description": "..."}],
  "plans_suggeres": [{"nom": "...", "raison": "..."}]
}`;

    const { content, model } = await callModel([
      {
        role: "system",
        content:
          "Tu es un expert en gestion de crise et continuité d'activité. Tu réponds toujours en JSON valide strict, sans texte hors JSON.",
      },
      { role: "user", content: prompt },
    ]);

    let parsed: WarRoomSuggestion;
    try {
      parsed = normalize(parseJson<WarRoomSuggestion>(content));
    } catch (e) {
      console.error("[groq-warroom-assist] Parsing échoué:", e);
      return new Response(
        JSON.stringify({ error: "Réponse IA illisible. Veuillez réessayer." }),
        { status: 502, headers: corsHeaders }
      );
    }

    if (parsed.actions.length === 0 && parsed.plans_suggeres.length === 0) {
      return new Response(
        JSON.stringify({ error: "Aucune recommandation générée. Veuillez réessayer." }),
        { status: 502, headers: corsHeaders }
      );
    }

    console.log(`[groq-warroom-assist] OK model=${model} actions=${parsed.actions.length}`);

    return new Response(JSON.stringify({ ...parsed, model }), { headers: corsHeaders });
  } catch (error) {
    console.error("[groq-warroom-assist] Erreur générale:", error);

    if (error instanceof AiTimeoutError) {
      return new Response(
        JSON.stringify({ error: "Le service IA a mis trop de temps à répondre. Veuillez réessayer." }),
        { status: 504, headers: corsHeaders }
      );
    }

    if (error instanceof AiApiError) {
      const status = error.status === 429 ? 503 : 502;
      const message =
        error.status === 429
          ? "Le service IA est actuellement saturé. Veuillez réessayer dans quelques instants."
          : "Service IA temporairement indisponible.";
      return new Response(JSON.stringify({ error: message }), { status, headers: corsHeaders });
    }

    return new Response(
      JSON.stringify({ error: "Service IA temporairement indisponible. Veuillez réessayer." }),
      { status: 500, headers: corsHeaders }
    );
  }
});