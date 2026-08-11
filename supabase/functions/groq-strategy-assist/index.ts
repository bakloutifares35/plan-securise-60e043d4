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

    return new Response(JSON.stringify({ error: "Action invalide." }), { status: 400, headers: corsHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});