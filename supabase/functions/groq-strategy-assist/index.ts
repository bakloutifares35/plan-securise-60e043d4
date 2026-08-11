// supabase/functions/groq-strategy-assist/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    if (!GROQ_API_KEY) {
      return new Response(JSON.stringify({ error: "GROQ_API_KEY non configurée." }), { status: 500, headers: corsHeaders });
    }

    const { action, context } = await req.json();

    // ===== ACTION 1 : Recommandation de stratégie (Wizard) =====
    if (action === "recommend") {
      const { processName, criticality, rto, rpo, resources, scenarios, perimetre, hypotheses, options } = context;
      const prompt = `Tu es un expert en continuité d'activité. Contexte: Nom:${processName}, Criticité:${criticality}, RTO:${rto}h, RPO:${rpo}h, Ressources:${resources}. Scénarios:${scenarios}, Périmètre:${perimetre}, Hypothèses:${hypotheses}. Options disponibles (ID:Nom): ${options.map((o:any)=>`${o.id}:${o.nom}`).join(", ")}. Retourne UNIQUEMENT un JSON valide : {"recommended_option_id":"...", "rationale":"Courte phrase en français", "confidence":"haute/moyenne/basse"}.`;
      
      const groqResponse = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
          max_tokens: 500,
        }),
      });

      if (!groqResponse.ok) throw new Error(`Groq API Error: ${await groqResponse.text()}`);
      const groqData = await groqResponse.json();
      const content = groqData.choices?.[0]?.message?.content?.replace(/```json/g, "").replace(/```/g, "").trim();
      return new Response(JSON.stringify({ response: content }), { headers: corsHeaders });
    }

    // ===== ACTION 2 : Justification de stratégie (Wizard) =====
    if (action === "justify") {
      const { processName, criticality, rto, rpo, selectedOptionName, selectedOptionDescription } = context;
      const prompt = `Justifie en 2-3 phrases factuelles (français) le choix de l'option "${selectedOptionName}" pour le processus ${processName} (criticité ${criticality}, RTO ${rto}h). Description : ${selectedOptionDescription || "N/A"}. Pas de JSON, juste le texte.`;
      
      const groqResponse = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
          max_tokens: 300,
        }),
      });

      if (!groqResponse.ok) throw new Error(`Groq API Error: ${await groqResponse.text()}`);
      const groqData = await groqResponse.json();
      return new Response(JSON.stringify({ justification: groqData.choices?.[0]?.message?.content || "" }), { headers: corsHeaders });
    }

    // ==========================================================
    // ===== ACTION 3 : Suggestion Probabilité/Impact/Maîtrise/Mesures (REGISTRE RISQUES) =====
    // ==========================================================
    if (action === "suggest_risk_measures") {
      const { title, description, category } = context;
      
      const prompt = `Tu es un expert en gestion des risques selon la norme ISO 31000. 
Analyse le risque suivant et évalue-le selon cette grille stricte :

PROBABILITÉ (1 à 5) : 1=très rare, 2=rare, 3=possible, 4=probable, 5=quasi certain — base-toi sur la fréquence évoquée dans la description (mots comme 'jamais arrivé', 'déjà survenu plusieurs fois', etc.)

IMPACT (1 à 5) : 1=négligeable (aucune conséquence notable), 2=mineur (gêne limitée, pas d'impact financier/opérationnel notable), 3=modéré (impact opérationnel visible mais gérable), 4=majeur (impact financier ou opérationnel significatif), 5=critique (menace l'activité) — base-toi STRICTEMENT sur ce que décrit le texte : si la description dit explicitement qu'il n'y a eu aucune perte de productivité et aucun impact financier, l'impact DOIT être 1 ou 2, jamais plus.

MAÎTRISE (1 à 5) : 1=aucune mesure en place, 5=risque totalement maîtrisé par des mesures existantes robustes — base-toi sur les mesures déjà décrites ou déductibles du contexte.

Contexte : Titre: '${title}', Description: '${description}', Catégorie: '${category}'.

Réponds UNIQUEMENT avec un objet JSON valide, sans aucun texte avant ou après, au format exact :
{"probabilite": <entier 1-5>, "impact": <entier 1-5>, "maitrise": <entier 1-5>, "mesures_existantes": "<paragraphe fluide en français, sans puces ni tirets, décrivant les mesures déjà en place ou déductibles du contexte>"}`;

      const groqResponse = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
          max_tokens: 500,
          response_format: { type: "json_object" }
        }),
      });

      if (!groqResponse.ok) throw new Error(`Groq API Error: ${await groqResponse.text()}`);
      const groqData = await groqResponse.json();
      const content = groqData.choices?.[0]?.message?.content || "";

      // Parsing JSON strict
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (e) {
        return new Response(JSON.stringify({ error: "L'IA a mal formaté le JSON." }), { status: 500, headers: corsHeaders });
      }

      // Validation des champs avec clamp
      const probabilite = Math.min(5, Math.max(1, parseInt(parsed.probabilite, 10) || 3));
      const impact = Math.min(5, Math.max(1, parseInt(parsed.impact, 10) || 3));
      const maitrise = Math.min(5, Math.max(1, parseInt(parsed.maitrise, 10) || 3));
      const mesures_existantes = parsed.mesures_existantes || "Mesures non spécifiées par l'IA.";

      return new Response(JSON.stringify({ probabilite, impact, maitrise, mesures_existantes }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: "Action invalide." }), { status: 400, headers: corsHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});