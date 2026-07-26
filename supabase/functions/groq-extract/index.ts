// supabase/functions/groq-extract/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

console.log("🚀 Groq Extract Function started");

serve(async (req) => {
  try {
    if (!GROQ_API_KEY) {
      console.error("❌ GROQ_API_KEY non définie");
      return new Response(
        JSON.stringify({ error: "GROQ_API_KEY non configurée" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const { prompt, model = "llama3-8b-8192" } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt manquant" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`🔵 Appel à Groq avec modèle: ${model}`);
    console.log(`🔵 Prompt (début): ${prompt.substring(0, 200)}...`);

    const groqResponse = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "system",
            content: "Tu es un assistant spécialisé dans l'extraction de données structurées à partir de textes. Tu retournes UNIQUEMENT du JSON valide, sans aucun texte supplémentaire. Si le texte ne contient pas d'entités, retourne {\"entities\": []}."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 4096,
      }),
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error(`❌ Erreur Groq (${groqResponse.status}):`, errorText);
      return new Response(
        JSON.stringify({ 
          error: `Erreur Groq: ${groqResponse.status}`,
          details: errorText 
        }),
        { status: groqResponse.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const groqData = await groqResponse.json();
    const response = groqData.choices?.[0]?.message?.content || "";
    
    console.log(`✅ Réponse Groq reçue (${response.length} caractères)`);
    console.log(`🔵 Réponse (début): ${response.substring(0, 200)}...`);

    return new Response(
      JSON.stringify({ response }),
      { headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("❌ Erreur:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});