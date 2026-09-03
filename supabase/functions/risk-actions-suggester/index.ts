// supabase/functions/risk-actions-suggester/index.ts
// Suggère 3 à 5 actions de traitement pour un risque donné (GPT-oss via Groq, fallback Lovable AI).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = Deno.env.get("GROQ_MODEL") || "openai/gpt-oss-120b";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const LOVABLE_API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const LOVABLE_MODEL = "google/gemini-3.7-flash";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

type SuggestedAction = {
  mesure: string;
  description: string;
  type_mesure: string;
  responsable: string;
  echeance: string;
  cout_estime: number;
};

const SYSTEM_PROMPT = `Tu es un expert en gestion des risques (ISO 31000 / ISO 27005) et en continuité d'activité (BCM).
Tu proposes des actions de traitement concrètes, réalistes et mesurables pour un risque donné.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, au format exact :
{
  "actions": [
    {
      "mesure": "Titre court de l'action (max 90 caractères)",
      "description": "Description opérationnelle en 1 à 2 phrases",
      "type_mesure": "Préventive" | "Corrective" | "Détective",
      "responsable": "Fonction ou rôle responsable (ex: RSSI, DSI, Responsable Achats)",
      "echeance": "Date au format YYYY-MM-DD, entre 1 et 12 mois dans le futur",
      "cout_estime": nombre entier en euros (0 si non applicable)
    }
  ]
}
Contraintes : entre 3 et 5 actions, toutes en français, toutes distinctes, pas de doublon avec les mesures déjà existantes.`;

function buildUserPrompt(body: Record<string, unknown>): string {
  const today = new Date().toISOString().slice(0, 10);
  return `Date du jour : ${today}

RISQUE À TRAITER
- Titre : ${body.title || "—"}
- Catégorie : ${body.category || "—"}
- Description : ${body.description || "—"}
- Probabilité (1-5) : ${body.probabilite ?? "—"}
- Impact (1-5) : ${body.impact ?? "—"}
- Score résiduel : ${body.score_residuel ?? "—"}
- Niveau : ${body.niveau || "—"}
- Cause : ${body.cause || "—"}
- Conséquence : ${body.consequence || "—"}
- Mesures déjà existantes : ${body.mesures_existantes || "aucune"}
- Actions déjà planifiées : ${
    Array.isArray(body.existing_actions) && body.existing_actions.length
      ? (body.existing_actions as string[]).join(" ; ")
      : "aucune"
  }

Propose 3 à 5 nouvelles actions de traitement adaptées au niveau de criticité.`;
}

function extractJson(raw: string): unknown {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("Réponse IA non parsable");
  }
}

const ALLOWED_TYPES = ["Préventive", "Corrective", "Détective"];

function normalize(parsed: unknown): SuggestedAction[] {
  const list = (parsed as { actions?: unknown[] })?.actions;
  if (!Array.isArray(list)) throw new Error("Format de réponse inattendu (actions manquantes)");

  const inOneMonth = new Date();
  inOneMonth.setMonth(inOneMonth.getMonth() + 3);
  const fallbackDate = inOneMonth.toISOString().slice(0, 10);

  return list
    .slice(0, 5)
    .map((item) => {
      const a = item as Record<string, unknown>;
      const type = String(a.type_mesure || "Préventive");
      const echeance = String(a.echeance || "");
      const cout = Number(a.cout_estime);
      return {
        mesure: String(a.mesure || "").trim().slice(0, 200),
        description: String(a.description || "").trim(),
        type_mesure: ALLOWED_TYPES.includes(type) ? type : "Préventive",
        responsable: String(a.responsable || "").trim(),
        echeance: /^\d{4}-\d{2}-\d{2}$/.test(echeance) ? echeance : fallbackDate,
        cout_estime: Number.isFinite(cout) && cout >= 0 ? Math.round(cout) : 0,
      };
    })
    .filter((a) => a.mesure.length > 0);
}

async function callModel(userPrompt: string): Promise<{ actions: SuggestedAction[]; model: string }> {
  const payloadBase = {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.5,
    response_format: { type: "json_object" as const },
  };

  const attempts: Array<{ url: string; key: string | undefined; model: string }> = [
    { url: GROQ_API_URL, key: GROQ_API_KEY, model: GROQ_MODEL },
    { url: LOVABLE_API_URL, key: LOVABLE_API_KEY, model: LOVABLE_MODEL },
  ];

  let lastError = "Aucun fournisseur IA disponible";

  for (const attempt of attempts) {
    if (!attempt.key) continue;
    try {
      const res = await fetch(attempt.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${attempt.key}`,
        },
        body: JSON.stringify({ ...payloadBase, model: attempt.model }),
      });

      if (!res.ok) {
        lastError = `${attempt.model}: ${res.status} ${await res.text()}`;
        if (res.status === 429) throw new Error("RATE_LIMIT");
        if (res.status === 402) throw new Error("PAYMENT_REQUIRED");
        continue;
      }

      const json = await res.json();
      const content: string = json?.choices?.[0]?.message?.content ?? "";
      const actions = normalize(extractJson(content));
      if (actions.length >= 1) return { actions, model: attempt.model };
      lastError = `${attempt.model}: aucune action exploitable`;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "RATE_LIMIT" || msg === "PAYMENT_REQUIRED") throw e;
      lastError = `${attempt.model}: ${msg}`;
    }
  }

  throw new Error(lastError);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as Record<string, unknown>;
    if (!body || typeof body.title !== "string" || !body.title.trim()) {
      return new Response(JSON.stringify({ error: "Le titre du risque est requis" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const { actions, model } = await callModel(buildUserPrompt(body));
    return new Response(JSON.stringify({ actions, model }), { status: 200, headers: corsHeaders });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg === "RATE_LIMIT" ? 429 : msg === "PAYMENT_REQUIRED" ? 402 : 500;
    const message =
      status === 429
        ? "Limite de requêtes IA atteinte, réessayez dans quelques instants."
        : status === 402
        ? "Crédits IA épuisés. Ajoutez des crédits à votre espace de travail."
        : msg;
    console.error("risk-actions-suggester error:", msg);
    return new Response(JSON.stringify({ error: message }), { status, headers: corsHeaders });
  }
});
