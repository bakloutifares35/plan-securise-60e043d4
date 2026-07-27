// supabase/functions/groq-extract/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// Headers CORS
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

console.log("🚀 Groq Extract Function started");

serve(async (req) => {
  // Gestion du preflight OPTIONS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Vérifier la clé API
    if (!GROQ_API_KEY) {
      console.error("❌ GROQ_API_KEY non définie");
      return new Response(
        JSON.stringify({ 
          error: "GROQ_API_KEY non configurée. Veuillez configurer la clé dans Supabase Secrets." 
        }),
        { 
          status: 500, 
          headers: corsHeaders 
        }
      );
    }

    // Récupérer le texte de la requête
    const { text } = await req.json();

    if (!text || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Aucun texte fourni pour l'analyse" }),
        { 
          status: 400, 
          headers: corsHeaders 
        }
      );
    }

    console.log(`🔵 Texte reçu: ${text.length} caractères`);
    console.log(`🔵 Début du texte: ${text.substring(0, 300)}...`);

    // Construire le prompt d'extraction (identique à celui du frontend)
    const systemPrompt = `Tu es un assistant spécialisé dans l'extraction de données structurées à partir de textes. Tu retournes UNIQUEMENT du JSON valide, sans aucun texte supplémentaire.`;

    const userPrompt = `Analyse le texte suivant qui décrit un organigramme.

Texte: """${text.substring(0, 10000)}"""

Trouve TOUTES les entités mentionnées dans ce texte et détermine leur type et leur parent.

RÈGLES D'IDENTIFICATION :
1. Les FILIALES sont les entités de plus haut niveau (ex: "Filiale 1", "Filiale 2", "Filiale France", "Pôle", "Business Unit", "Agence")
   - Parent = null

2. Les DIRECTION sont les entités sous une Filiale (ex: "Direction Financière", "Direction Commerciale", "Direction IT", "Département" au niveau 2)
   - Parent = nom de la Filiale

3. Les SERVICE sont les entités sous une Direction (ex: "Service Comptabilité", "Service Client", "Service Infrastructure")
   - Parent = nom de la Direction

4. Les DÉPARTEMENT sont les entités sous une Direction (ex: "Département Audit", "Département Marketing", "Cellule")
   - Parent = nom de la Direction

EXTRACTION SPÉCIFIQUE :
- Le document peut utiliser des synonymes pour les types. Déduis le type le plus proche parmi FILIALE, DIRECTION, SERVICE, DÉPARTEMENT selon la position hiérarchique dans le texte.
- Les indentations, numérotations (1., 1.1, 1.1.1, tirets, tabulations) sont des indicateurs de niveau hiérarchique.
- Niveau 1 (sans indentation ou 1.) = FILIALE
- Niveau 2 (indenté ou 1.1) = DIRECTION
- Niveau 3 (plus indenté ou 1.1.1) = SERVICE ou DÉPARTEMENT

Retourne UNIQUEMENT un JSON valide avec toutes les entités trouvées:
{"entities":[
  {"name":"Filiale 1","type":"FILIALE","parent":null},
  {"name":"Direction Financière","type":"DIRECTION","parent":"Filiale 1"},
  {"name":"Service Comptabilité","type":"SERVICE","parent":"Direction Financière"},
  {"name":"Département Audit","type":"DÉPARTEMENT","parent":"Direction Financière"}
]}

Ne retourne AUCUN autre texte, seulement le JSON.`;

    console.log("🔵 Envoi à l'API Groq...");

    // Appel à l'API Groq
    const groqResponse = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userPrompt
          }
        ],
        temperature: 0.1,
        max_tokens: 4096,
        top_p: 0.9,
      }),
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error(`❌ Erreur Groq (${groqResponse.status}):`, errorText);
      
      let errorMessage = "Erreur lors de l'appel à l'API Groq";
      if (groqResponse.status === 401) {
        errorMessage = "Clé API Groq invalide ou manquante. Vérifiez la configuration GROQ_API_KEY dans Supabase Secrets.";
      } else if (groqResponse.status === 429) {
        errorMessage = "Trop de requêtes vers l'API Groq. Veuillez réessayer dans quelques instants.";
      } else if (groqResponse.status === 500) {
        errorMessage = "Erreur interne de l'API Groq. Veuillez réessayer plus tard.";
      }
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          details: errorText 
        }),
        { 
          status: groqResponse.status, 
          headers: corsHeaders 
        }
      );
    }

    const groqData = await groqResponse.json();
    const response = groqData.choices?.[0]?.message?.content || "";
    
    console.log(`✅ Réponse Groq reçue (${response.length} caractères)`);
    console.log(`🔵 Réponse (début): ${response.substring(0, 300)}...`);

    return new Response(
      JSON.stringify({ response }),
      { 
        status: 200,
        headers: corsHeaders 
      }
    );

  } catch (error) {
    console.error("❌ Erreur:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: corsHeaders 
      }
    );
  }
});