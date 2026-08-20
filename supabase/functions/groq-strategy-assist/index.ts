// supabase/functions/groq-strategy-assist/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ============================================================
// CONFIGURATION
// ============================================================
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// Modèle principal - configurable via variable d'environnement
const GROQ_MODEL = Deno.env.get("GROQ_MODEL") || "openai/gpt-oss-120b";
const GROQ_FALLBACK_MODEL = Deno.env.get("GROQ_FALLBACK_MODEL") || "openai/gpt-oss-20b";

// Timeout global pour les appels Groq (30 secondes)
const REQUEST_TIMEOUT_MS = 30000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

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

/**
 * Appel générique à l'API Groq avec gestion d'erreurs, timeout et fallback
 */
async function callGroq(options: GroqRequestOptions): Promise<string> {
  const {
    messages,
    temperature = 0.2,
    maxTokens = 500,
    responseFormat = "json_object",
    reasoningEffort = "medium",
    timeoutMs = REQUEST_TIMEOUT_MS,
  } = options;

  // Construire le body de la requête
  const body: any = {
    model: GROQ_MODEL,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  // Utiliser le format JSON si demandé (uniquement si le modèle le supporte)
  if (responseFormat === "json_object") {
    body.response_format = { type: "json_object" };
  }

  // Reasoning effort pour GPT-OSS
  if (reasoningEffort && GROQ_MODEL.includes("gpt-oss")) {
    body.reasoning_effort = reasoningEffort;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let lastError: Error | null = null;
    let modelUsed = GROQ_MODEL;

    // Tentative avec le modèle principal
    let response = await performFetch(body, controller);

    // Si le modèle principal échoue avec une erreur 4xx ou 5xx, tenter le fallback
    if (!response.ok && (response.status >= 400 || response.status >= 500)) {
      console.warn(
        `[groq-strategy-assist] Modèle principal ${GROQ_MODEL} a échoué (${response.status}), fallback vers ${GROQ_FALLBACK_MODEL}`
      );

      // Réessayer avec le modèle de fallback
      const fallbackBody = { ...body, model: GROQ_FALLBACK_MODEL };
      response = await performFetch(fallbackBody, controller);
      modelUsed = GROQ_FALLBACK_MODEL;
    }

    // Vérifier la réponse
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
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
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

/**
 * Exécute un fetch avec gestion d'erreur réseau
 */
async function performFetch(body: any, controller: AbortController): Promise<Response> {
  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  });

  return response;
}

/**
 * Nettoie et parse une réponse JSON en gérant les backticks et le texte supplémentaire
 */
function parseGroqResponse<T>(content: string): T {
  let cleanContent = content
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();

  // Si le contenu commence par "{" on parse directement
  if (cleanContent.startsWith("{")) {
    return JSON.parse(cleanContent);
  }

  // Sinon, essayer de trouver un objet JSON dans le texte
  const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }

  throw new Error("Impossible d'extraire un JSON valide de la réponse");
}

/**
 * Validation et clamp des scores de risque
 */
function validateRiskScore(value: any, fallback: number = 3): number {
  const num = typeof value === "number" ? value : parseInt(String(value), 10);
  if (isNaN(num)) return fallback;
  return Math.min(5, Math.max(1, num));
}

/**
 * Validation du champ confidence
 */
function validateConfidence(value: any): "haute" | "moyenne" | "basse" {
  const valid = ["haute", "moyenne", "basse"];
  const cleaned = String(value).toLowerCase().trim();
  return valid.includes(cleaned) ? (cleaned as any) : "moyenne";
}

/**
 * Vérifie que les inputs ne sont pas trop volumineux
 */
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
    maxTokens: 500,
    responseFormat: "json_object",
    reasoningEffort: "medium",
  });

  let parsed: RecommendResponse;
  try {
    parsed = parseGroqResponse<RecommendResponse>(content);
  } catch (e) {
    console.error("[groq-strategy-assist] Parsing échoué:", e);
    // Fallback: choisir la première option
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

  // Validation des champs
  const result: RecommendResponse = {
    recommended_option_id:
      parsed.recommended_option_id ||
      options.find((o: any) => o.id === parsed.recommended_option_id)?.id ||
      options[0]?.id ||
      null,
    rationale: parsed.rationale || "Option recommandée par l'IA.",
    confidence: validateConfidence(parsed.confidence),
  };

  // Vérifier que l'ID existe bien dans les options
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
    maxTokens: 300,
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
 * ACTION 3 : Suggestion Probabilité/Impact/Maîtrise/Mesures
 */
async function handleSuggestRiskMeasures(context: any): Promise<Response> {
  const { title, description, category } = context;

  const prompt = `Tu es un expert en gestion des risques selon la norme ISO 31000.

Analyse le risque suivant et évalue-le selon cette grille stricte:

PROBABILITÉ (1 à 5):
1 = très rare (moins d'une fois par an)
2 = rare (1-2 fois par an)
3 = possible (plusieurs fois par an)
4 = probable (mensuel)
5 = quasi certain (hebdomadaire ou quotidien)
➡️ Base-toi sur la fréquence mentionnée dans la description

IMPACT (1 à 5):
1 = négligeable (aucune conséquence notable)
2 = mineur (gêne limitée)
3 = modéré (impact opérationnel visible mais gérable)
4 = majeur (impact financier ou opérationnel significatif)
5 = critique (menace l'activité)
➡️ Base-toi STRICTEMENT sur les conséquences décrites

MAÎTRISE (1 à 5):
1 = aucune mesure en place
2 = mesures faibles ou ponctuelles
3 = mesures partielles
4 = mesures solides
5 = risque fortement maîtrisé
➡️ Base-toi sur les mesures décrites ou déductibles du contexte

RISQUE À ANALYSER :
Titre: "${title || 'Non spécifié'}"
Description: "${description || 'Non spécifiée'}"
Catégorie: "${category || 'Non spécifiée'}"

IMPORTANT - RÈGLES STRICTES :
1. Ne SURÉVALUE PAS l'impact: si la description dit "aucune perte" ou "impact limité", l'impact DOIT être 1 ou 2
2. Ne SURÉVALUE PAS la maîtrise: si aucune mesure n'est mentionnée, la maîtrise DOIT être 1 ou 2
3. Si une information n'est pas disponible, utilise 3 comme valeur neutre
4. La description des mesures existantes doit être factuelle et fluide

Retourne UNIQUEMENT un JSON valide avec ce format exact:
{
  "probabilite": nombre,
  "impact": nombre,
  "maitrise": nombre,
  "mesures_existantes": "paragraphe fluide en français, sans puces ni tirets"
}`;

  const content = await callGroq({
    messages: [
      {
        role: "system",
        content:
          "Tu es un expert en gestion des risques ISO 31000. Tu réponds toujours en JSON valide. Tu ne SURÉVALUES JAMAIS les scores sans preuve.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.1,
    maxTokens: 500,
    responseFormat: "json_object",
    reasoningEffort: "medium",
  });

  let parsed: SuggestRiskResponse;
  try {
    parsed = parseGroqResponse<SuggestRiskResponse>(content);
  } catch (e) {
    console.error("[groq-strategy-assist] Parsing suggestion risques échoué:", e);
    // Fallback: valeurs neutres
    return new Response(
      JSON.stringify({
        probabilite: 3,
        impact: 3,
        maitrise: 3,
        mesures_existantes: "Aucune mesure spécifique identifiée pour ce risque.",
      }),
      { headers: corsHeaders }
    );
  }

  // Validation et clamp des valeurs
  const result: SuggestRiskResponse = {
    probabilite: validateRiskScore(parsed.probabilite, 3),
    impact: validateRiskScore(parsed.impact, 3),
    maitrise: validateRiskScore(parsed.maitrise, 3),
    mesures_existantes:
      typeof parsed.mesures_existantes === "string" && parsed.mesures_existantes.trim().length > 0
        ? parsed.mesures_existantes.trim()
        : "Mesures non spécifiées par l'IA.",
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
  // CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Vérification de la méthode
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Méthode non supportée. Utilisez POST." }),
      { status: 405, headers: corsHeaders }
    );
  }

  // Vérification de la clé API
  if (!GROQ_API_KEY) {
    console.error("[groq-strategy-assist] GROQ_API_KEY non configurée");
    return new Response(
      JSON.stringify({ error: "Service IA temporairement indisponible." }),
      { status: 500, headers: corsHeaders }
    );
  }

  try {
    // Parsing du body
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

    // Validation de la taille des inputs
    try {
      validateInputSize(context);
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Le contexte est trop volumineux" }),
        { status: 413, headers: corsHeaders }
      );
    }

    console.log(`[groq-strategy-assist] action=${action}, model=${GROQ_MODEL}`);

    // Routage des actions
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

    // Gestion des erreurs spécifiques
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

    // Erreur générique
    return new Response(
      JSON.stringify({
        error: "Service IA temporairement indisponible. Veuillez réessayer.",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});