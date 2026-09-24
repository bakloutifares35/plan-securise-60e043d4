// supabase/functions/groq-strategy-assist/index.ts
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

// ============================================================
// CONFIGURATION
// ============================================================
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 30000;

// ============================================================
// TYPES
// ============================================================
interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface GroqRequestOptions {
  messages: GroqMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "json_object" | "text";
  reasoningEffort?: "low" | "medium" | "high";
  timeoutMs?: number;
}

interface RecommendResponse {
  recommended_option_id: string;
  rationale: string;
  confidence: "haute" | "moyenne" | "basse";
}

interface JustifyResponse {
  justification: string;
}

interface SuggestRiskResponse {
  probabilite: number;
  impact: number;
  maitrise: number;
  mesures_existantes: string;
}

// ============================================================
// HELPERS
// ============================================================

async function callGroq(options: GroqRequestOptions): Promise<string> {
  const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
  const GROQ_MODEL = Deno.env.get("GROQ_MODEL") || "openai/gpt-oss-120b";
  const GROQ_FALLBACK_MODEL = Deno.env.get("GROQ_FALLBACK_MODEL") || "openai/gpt-oss-20b";

  const {
    messages,
    temperature = 0.2,
    maxTokens = 500,
    responseFormat = "json_object",
    reasoningEffort = "medium",
    timeoutMs = REQUEST_TIMEOUT_MS,
  } = options;

  const body: any = {
    model: GROQ_MODEL,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  // NOTE : Groq rejette response_format=json_object sur gpt-oss-*
  const supportsJsonMode =
    responseFormat === "json_object" && !GROQ_MODEL.includes("gpt-oss");

  if (supportsJsonMode) {
    body.response_format = { type: "json_object" };
  }

  if (GROQ_MODEL.includes("gpt-oss")) {
    if (reasoningEffort) body.reasoning_effort = reasoningEffort;
    body.reasoning_format = "parsed";
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let modelUsed = GROQ_MODEL;
    let response = await performFetch(body, controller, GROQ_API_KEY);

    if (!response.ok) {
      console.warn(
        `[groq-strategy-assist] Modèle principal ${GROQ_MODEL} a échoué (${response.status}), fallback vers ${GROQ_FALLBACK_MODEL}`
      );

      const fallbackBody = { ...body, model: GROQ_FALLBACK_MODEL };
      response = await performFetch(fallbackBody, controller, GROQ_API_KEY);
      modelUsed = GROQ_FALLBACK_MODEL;
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[groq-strategy-assist] Erreur Groq API (${modelUsed}):`,
        response.status,
        errorText
      );
      throw new GroqApiError(response.status, errorText);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const finishReason = choice?.finish_reason;

    let content: string | undefined = choice?.message?.content;
    if (!content || !content.trim()) {
      content = choice?.message?.reasoning;
    }

    if (!content || !content.trim()) {
      console.error(
        `[groq-strategy-assist] Réponse Groq vide (modèle=${modelUsed}, finish_reason=${finishReason}):`,
        JSON.stringify(data)
      );

      if (finishReason === "length") {
        console.warn(
          `[groq-strategy-assist] finish_reason=length détecté, nouvel essai avec max_tokens élargi`
        );
        const retryBody = { ...body, model: modelUsed, max_tokens: Math.max(maxTokens * 3, 2000) };
        const retryResponse = await performFetch(retryBody, controller, GROQ_API_KEY);
        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          const retryChoice = retryData.choices?.[0];
          const retryContent =
            retryChoice?.message?.content?.trim() || retryChoice?.message?.reasoning?.trim();
          if (retryContent) {
            console.log(
              `[groq-strategy-assist] Réussite après retry élargi avec ${modelUsed} (${retryData.usage?.total_tokens || 0} tokens)`
            );
            return retryContent;
          }
          console.error(
            `[groq-strategy-assist] Retry élargi toujours vide:`,
            JSON.stringify(retryData)
          );
        }
      }

      throw new Error("Réponse Groq vide ou mal formée");
    }

    console.log(
      `[groq-strategy-assist] Appel réussi avec ${modelUsed} (${data.usage?.total_tokens || 0} tokens)`
    );

    return content;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new GroqTimeoutError("Le service IA a mis trop de temps à répondre");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function performFetch(body: any, controller: AbortController, apiKey: string | undefined): Promise<Response> {
  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  });

  return response;
}

function parseGroqResponse<T>(content: string): T {
  let cleanContent = content
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();

  if (cleanContent.startsWith("{")) {
    return JSON.parse(cleanContent);
  }

  const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }

  throw new Error("Impossible d'extraire un JSON valide de la réponse");
}

function validateRiskScore(value: any, fallback: number = 3): number {
  const num = typeof value === "number" ? value : parseInt(String(value), 10);
  if (isNaN(num)) return fallback;
  return Math.min(5, Math.max(1, num));
}

function validateConfidence(value: any): "haute" | "moyenne" | "basse" {
  const valid = ["haute", "moyenne", "basse"];
  const cleaned = String(value).toLowerCase().trim();
  return valid.includes(cleaned) ? (cleaned as any) : "moyenne";
}

function validateInputSize(context: any): void {
  const maxLength = 10000;
  const jsonStr = JSON.stringify(context);
  if (jsonStr.length > maxLength) {
    throw new InputTooLargeError("Le contexte est trop volumineux");
  }
}

// ============================================================
// ERREURS PERSONNALISÉES
// ============================================================
class GroqApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "GroqApiError";
    this.status = status;
  }
}

class GroqTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GroqTimeoutError";
  }
}

class InputTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputTooLargeError";
  }
}

// ============================================================
// ACTIONS
// ============================================================

/**
 * ACTION 1 : Recommandation de stratégie
 */
async function handleRecommend(context: any): Promise<Response> {
  const {
    processName,
    criticality,
    rto,
    rpo,
    resources,
    scenarios,
    perimetre,
    hypotheses,
    options,
  } = context;

  if (!options || !Array.isArray(options) || options.length === 0) {
    return new Response(
      JSON.stringify({
        error: "Aucune option de stratégie disponible",
      }),
      { status: 400, headers: corsHeaders }
    );
  }

  const optionsList = options
    .map((o: any) => `- ID: ${o.id} | Nom: ${o.nom} | Description: ${o.description || "N/A"}`)
    .join("\n");

  const prompt = `Tu es un expert senior en Business Continuity Management certifié ISO 22301. 
Tu dois recommander LA MEILLEURE stratégie de continuité parmi les options proposées.

CONTEXTE MÉTIER :
- Processus: ${processName || "Non spécifié"}
- Criticité: ${criticality || "Non spécifiée"}
- RTO: ${rto || 0}h (objectif de reprise maximal)
- RPO: ${rpo || 0}h (perte de données maximale acceptable)
- Ressources critiques: ${resources || "Non spécifiées"}
- Scénarios de sinistre: ${scenarios || "Non spécifiés"}
- Périmètre couvert: ${perimetre || "Non spécifié"}
- Hypothèses et contraintes: ${hypotheses || "Non spécifiées"}

OPTIONS DISPONIBLES :
${optionsList}

RÈGLES DE DÉCISION :
1. Choisis UNIQUEMENT parmi les options listées ci-dessus
2. Utilise l'ID exact de l'option dans recommended_option_id
3. Justifie ta recommandation en français de manière concise et professionnelle
4. Si aucune option n'est parfaitement adaptée, choisis la moins mauvaise
5. Base-toi sur: criticité du processus, RTO, RPO, ressources disponibles, scénarios

Retourne UNIQUEMENT un JSON valide avec ce format exact:
{
  "recommended_option_id": "id_de_l_option",
  "rationale": "Justification concise en français",
  "confidence": "haute" // ou "moyenne" ou "basse"
}`;

  const content = await callGroq({
    messages: [
      {
        role: "system",
        content:
          "Tu es un expert BCM. Tu réponds toujours en JSON valide, sans texte hors JSON.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
    maxTokens: 800,
    responseFormat: "json_object",
    reasoningEffort: "medium",
  });

  let parsed: RecommendResponse;
  try {
    parsed = parseGroqResponse<RecommendResponse>(content);
  } catch (e) {
    console.error("[groq-strategy-assist] Parsing échoué:", e);
    return new Response(
      JSON.stringify({
        response: JSON.stringify({
          recommended_option_id: options[0]?.id || null,
          rationale: "Recommandation IA non disponible. Veuillez sélectionner manuellement.",
          confidence: "basse",
        }),
      }),
      { headers: corsHeaders }
    );
  }

  const result: RecommendResponse = {
    recommended_option_id:
      parsed.recommended_option_id ||
      options.find((o: any) => o.id === parsed.recommended_option_id)?.id ||
      options[0]?.id ||
      null,
    rationale: parsed.rationale || "Option recommandée par l'IA.",
    confidence: validateConfidence(parsed.confidence),
  };

  const exists = options.some((o: any) => o.id === result.recommended_option_id);
  if (!exists && options.length > 0) {
    result.recommended_option_id = options[0].id;
    result.rationale =
      "L'option recommandée n'était pas disponible. Sélection automatique de la première option.";
  }

  return new Response(
    JSON.stringify({
      response: JSON.stringify(result),
    }),
    { headers: corsHeaders }
  );
}

/**
 * ACTION 2 : Justification de stratégie
 */
async function handleJustify(context: any): Promise<Response> {
  const {
    processName,
    criticality,
    rto,
    rpo,
    selectedOptionName,
    selectedOptionDescription,
  } = context;

  const prompt = `Justifie en 2-3 phrases factuelles et professionnelles en français le choix de l'option "${selectedOptionName || 'Non spécifiée'}" pour le processus "${processName || 'Non spécifié'}" (criticité ${criticality || 'Non spécifiée'}, RTO ${rto || 0}h, RPO ${rpo || 0}h).

Description de l'option choisie: ${selectedOptionDescription || 'Non spécifiée'}

RÈGLES :
- Réponds UNIQUEMENT avec le texte de la justification
- Pas de JSON
- Pas de Markdown
- Pas de puces
- Style professionnel BCM
- 2 à 3 phrases maximum
- Ne pas inventer d'informations absentes du contexte

Justification:`;

  const content = await callGroq({
    messages: [
      {
        role: "system",
        content:
          "Tu es un expert en Business Continuity Management. Réponds en français, de manière concise et professionnelle. Ne retourne que le texte de la justification.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
    maxTokens: 600,
    responseFormat: "text",
    reasoningEffort: "low",
  });

  const justification = content.trim() || "Justification IA non disponible.";

  return new Response(
    JSON.stringify({ justification }),
    { headers: corsHeaders }
  );
}

/**
 * ACTION 3 : Suggestion Probabilité/Impact/Maîtrise + PROPOSITION de mesures
 * 
 * ⚠️ Correction majeure : le prompt demande au modèle de PROPOSER des mesures
 * de traitement concrètes, PAS de décrire des mesures existantes (qui sont
 * nécessairement vides au moment de la création du risque).
 */
async function handleSuggestRiskMeasures(context: any): Promise<Response> {
  const { title, description, category, probability, impact } = context;

  const prompt = `Tu es un expert en gestion des risques selon la norme ISO 31000.

MISSION : Évaluer ce risque ET PROPOSER des mesures de traitement concrètes.

═══════════════════════════════════════════════════
ÉTAPE 1 — ÉVALUER les scores (1 à 5)
═══════════════════════════════════════════════════

PROBABILITÉ (1 à 5) — fréquence estimée :
1 = très rare (moins d'une fois par an)
2 = rare (1-2 fois par an)
3 = possible (plusieurs fois par an)
4 = probable (mensuel)
5 = quasi certain (hebdomadaire)

IMPACT (1 à 5) — gravité des conséquences :
1 = négligeable
2 = mineur
3 = modéré (impact opérationnel gérable)
4 = majeur (impact financier/opérationnel significatif)
5 = critique (menace l'activité)

MAÎTRISE (1 à 5) — niveau de contrôle ACTUEL :
1 = aucune mesure en place
2 = mesures faibles ou ponctuelles
3 = mesures partielles
4 = mesures solides
5 = risque fortement maîtrisé

═══════════════════════════════════════════════════
ÉTAPE 2 — PROPOSER 3 À 5 MESURES DE TRAITEMENT
═══════════════════════════════════════════════════

Ce sont des SUGGESTIONS que l'utilisateur pourra accepter, modifier ou refuser.
Ce ne sont PAS des mesures existantes.
Les mesures doivent être :
- Concrètes et actionnables
- Adaptées au type de risque (cyber → EDR, MFA, sauvegardes isolées ; panne → redondance, PCA ; RH → plan de succession, polyvalence ; etc.)
- Priorisées : commence par les mesures préventives, puis les mesures de mitigation, puis les mesures de continuité
- Rédigées en français, sous forme de phrases complètes

RISQUE À ANALYSER :
- Titre : "${title || 'Non spécifié'}"
- Description : "${description || 'Non spécifiée'}"
- Catégorie : "${category || 'Non spécifiée'}"
${probability ? `- Probabilité initiale suggérée : ${probability}/5` : ""}
${impact ? `- Impact initial suggéré : ${impact}/5` : ""}

═══════════════════════════════════════════════════
RÈGLES STRICTES
═══════════════════════════════════════════════════

1. Ne SURÉVALUE PAS l'impact : si la description dit "impact limité", l'impact DOIT être ≤ 2
2. Ne SURÉVALUE PAS la maîtrise : si AUCUNE mesure n'est mentionnée dans le contexte, la maîtrise DOIT être 1 ou 2
3. Si une information manque, utilise 3 comme valeur neutre pour probabilité/impact
4. NE COMMENTE JAMAIS les "mesures existantes" — concentre-toi UNIQUEMENT sur les mesures PROPOSÉES
5. Ne dis JAMAIS "il n'y a pas assez d'information" — fais toujours une proposition réaliste

Retourne UNIQUEMENT un JSON valide au format exact :
{
  "probabilite": nombre entre 1 et 5,
  "impact": nombre entre 1 et 5,
  "maitrise": nombre entre 1 et 5,
  "mesures_existantes": "Paragraphe fluide en français décrivant 3 à 5 mesures PROPOSÉES que l'utilisateur peut ajouter pour traiter ce risque."
}`;

  const content = await callGroq({
    messages: [
      {
        role: "system",
        content:
          "Tu es un expert en gestion des risques ISO 31000. Tu réponds toujours en JSON valide. " +
          "Tu ne SURÉVALUES JAMAIS les scores sans preuve. " +
          "Tu proposes TOUJOURS des mesures concrètes de traitement, même si le contexte est pauvre.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.3,
    maxTokens: 1500,
    responseFormat: "json_object",
    reasoningEffort: "medium",
  });

  let parsed: SuggestRiskResponse;
  try {
    parsed = parseGroqResponse<SuggestRiskResponse>(content);
  } catch (e) {
    console.error("[groq-strategy-assist] Parsing suggestion risques échoué:", e, "contenu reçu:", content);
    return new Response(
      JSON.stringify({
        probabilite: 3,
        impact: 3,
        maitrise: 2,
        mesures_existantes:
          "Mettre en place des mesures préventives adaptées à ce risque. " +
          "Définir des procédures de mitigation et tester régulièrement leur efficacité. " +
          "Documenter un plan de continuité dédié.",
      }),
      { headers: corsHeaders }
    );
  }

  const result: SuggestRiskResponse = {
    probabilite: validateRiskScore(parsed.probabilite, 3),
    impact: validateRiskScore(parsed.impact, 3),
    maitrise: validateRiskScore(parsed.maitrise, 2),
    mesures_existantes:
      typeof parsed.mesures_existantes === "string" && parsed.mesures_existantes.trim().length > 0
        ? parsed.mesures_existantes.trim()
        : "Aucune mesure spécifique proposée par l'IA. Complétez manuellement ce champ.",
  };

  return new Response(
    JSON.stringify(result),
    { headers: corsHeaders }
  );
}

// ============================================================
// SERVEUR PRINCIPAL
// ============================================================
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) {
      console.error("[groq-strategy-assist] GROQ_API_KEY non configurée");
      return new Response(
        JSON.stringify({ error: "Service IA temporairement indisponible." }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Méthode non supportée. Utilisez POST." }),
        { status: 405, headers: corsHeaders }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Format JSON invalide" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { action, context } = body;

    if (!action) {
      return new Response(
        JSON.stringify({ error: "Action requise (recommend, justify, suggest_risk_measures)" }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!context || typeof context !== "object") {
      return new Response(
        JSON.stringify({ error: "Contexte invalide ou manquant" }),
        { status: 400, headers: corsHeaders }
      );
    }

    try {
      validateInputSize(context);
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Le contexte est trop volumineux" }),
        { status: 413, headers: corsHeaders }
      );
    }

    console.log(`[groq-strategy-assist] action=${action}`);

    switch (action) {
      case "recommend":
        return await handleRecommend(context);
      case "justify":
        return await handleJustify(context);
      case "suggest_risk_measures":
        return await handleSuggestRiskMeasures(context);
      default:
        return new Response(
          JSON.stringify({ error: "Action invalide. Utilisez 'recommend', 'justify' ou 'suggest_risk_measures'" }),
          { status: 400, headers: corsHeaders }
        );
    }
  } catch (error) {
    console.error("[groq-strategy-assist] Erreur générale:", error);

    if (error instanceof GroqTimeoutError) {
      return new Response(
        JSON.stringify({ error: "Le service IA a mis trop de temps à répondre. Veuillez réessayer." }),
        { status: 504, headers: corsHeaders }
      );
    }

    if (error instanceof GroqApiError) {
      let status = 500;
      let message = "Erreur du service IA";

      if (error.status === 401 || error.status === 403) {
        status = 500;
        message = "Service IA temporairement indisponible.";
        console.error("[groq-strategy-assist] Erreur d'authentification Groq");
      } else if (error.status === 429) {
        status = 503;
        message = "Le service IA est actuellement saturé. Veuillez réessayer dans quelques instants.";
      } else if (error.status === 400) {
        status = 400;
        message = "Requête invalide. Veuillez vérifier les données envoyées.";
      }

      return new Response(
        JSON.stringify({ error: message }),
        { status, headers: corsHeaders }
      );
    }

    if (error instanceof InputTooLargeError) {
      return new Response(
        JSON.stringify({ error: "Les données envoyées sont trop volumineuses" }),
        { status: 413, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        error: "Service IA temporairement indisponible. Veuillez réessayer.",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});