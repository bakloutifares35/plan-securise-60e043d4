// supabase/functions/strat-recommend/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ⭐ NOUVEAU : on reçoit TOUTES les options disponibles
    const { processName, rto, rpo, criticality, description, resources, options } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // ============================================================
    // CONSTRUIRE LA LISTE DES OPTIONS DYNAMIQUEMENT
    // ============================================================
    let optionsList = "";
    if (options && options.length > 0) {
      optionsList = options.map((opt: any, index: number) => {
        return `${index + 1}. ${opt.name} - ${opt.description || "Aucune description"}`;
      }).join("\n");
    } else {
      // Fallback : options par défaut
      optionsList = `1. Reprise sur backup IT - Restauration des données depuis les sauvegardes
2. Site de repli alternatif - Basculement vers un site secondaire en cas de sinistre
3. Sous-traitance - Externalisation vers un prestataire tiers
4. Télétravail généralisé - Permettre aux équipes de travailler à distance`;
    }

    // ============================================================
    // PROMPT SYSTÈME - DYNAMIQUE
    // ============================================================
    const systemPrompt = `Tu es un expert senior en Plan de Continuité d'Activité (BCM) et en gestion de crise.

Tu reçois une liste d'options de continuité. Tu dois ANALYSER CHAQUE OPTION et choisir LA MEILLEURE pour le processus donné.

RÈGLES D'ANALYSE POUR CHAQUE OPTION :
- Est-ce que cette option permet de respecter le RTO (délai de reprise) ?
- Est-ce que cette option permet de respecter le RPO (perte de données max) ?
- Est-ce que cette option est adaptée à la criticité du processus ?
- Est-ce que cette option est réaliste avec les ressources disponibles ?
- Est-ce que cette option couvre les scénarios de disruption ?

CRITÈRES DE DÉCISION GÉNÉRAUX :
- RTO ≤ 4h → privilégier les solutions techniques (load balancers, site de repli, backup IT)
- RTO entre 4h et 24h → solutions mixtes possibles
- RTO > 24h → solutions organisationnelles (télétravail, sous-traitance)
- Processus Critique → solution robuste et éprouvée
- Cyberattaque → solutions avec isolation (site de repli, sauvegarde hors ligne)

Pour CHAQUE option que tu analyses, demande-toi : "Est-ce que cette option est vraiment pertinente pour ce processus ?"

RÉPONDS UNIQUEMENT en JSON avec ce format :
{
  "option": "Nom exact de l'option choisie",
  "justification": "Paragraphe de 3-5 phrases expliquant pourquoi cette option est la meilleure. Mentionne aussi pourquoi les autres options sont moins adaptées."
}

La justification doit être concrète, professionnelle et en français.`;

    // ============================================================
    // CONSTRUCTION DU MESSAGE UTILISATEUR
    // ============================================================
    let userPrompt = `PROCESSUS À ANALYSER :\n`;
    userPrompt += `- Nom : ${processName}\n`;
    userPrompt += `- RTO : ${rto}h\n`;
    userPrompt += `- RPO : ${rpo}h\n`;
    userPrompt += `- Criticité : ${criticality || "Non définie"}\n`;
    if (description) userPrompt += `- Description : ${description}\n`;
    if (resources && resources.length > 0) {
      userPrompt += `- Ressources disponibles : ${resources.join(", ")}\n`;
    }
    userPrompt += `\nOPTIONS DE CONTINUITÉ DISPONIBLES :\n${optionsList}`;
    userPrompt += `\n\nAnalyse chaque option et choisis LA MEILLEURE. Explique pourquoi.`;

    // ============================================================
    // APPEL À L'IA
    // ============================================================
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
        temperature: 0.3,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requêtes atteinte. Veuillez réessayer dans quelques minutes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Crédits IA épuisés." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "Erreur du service IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // ============================================================
    // PARSER LA RÉPONSE JSON
    // ============================================================
    let recommendation;
    try {
      let cleanContent = content.trim();
      if (cleanContent.startsWith("```json")) {
        cleanContent = cleanContent.replace(/```json\n?/, "").replace(/\n?```$/, "");
      }
      if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent.replace(/```\n?/, "").replace(/\n?```$/, "");
      }
      recommendation = JSON.parse(cleanContent);
    } catch {
      // Fallback : extraire l'option et la justification du texte
      const optionMatch = content.match(/(Reprise sur backup IT|Site de repli alternatif|Sous-traitance|Télétravail généralisé|Load balancers|Redondance|Backup|Mettre en place des load balancers)/);
      const option = optionMatch ? optionMatch[1] : "Site de repli alternatif";
      
      let justification = content
        .replace(option, "")
        .replace(/["{}]/g, "")
        .replace(/justification:/i, "")
        .replace(/option:/i, "")
        .trim();
      
      justification = justification.replace(/^["']|["']$/g, "").trim();
      
      recommendation = {
        option: option,
        justification: justification || `La solution "${option}" est la plus adaptée pour ce processus car elle permet de répondre aux exigences de RTO ≤ ${rto}h et RPO ≤ ${rpo}h, tout en étant cohérente avec la criticité du processus.`,
      };
    }

    // ============================================================
    // FORMER LA RÉPONSE FINALE AVEC TOUTES LES OPTIONS
    // ============================================================
    const allOptions = (options || [
      { name: "Reprise sur backup IT", description: "Restauration des données depuis les sauvegardes" },
      { name: "Site de repli alternatif", description: "Basculement vers un site secondaire en cas de sinistre" },
      { name: "Sous-traitance", description: "Externalisation vers un prestataire tiers" },
      { name: "Télétravail généralisé", description: "Permettre aux équipes de travailler à distance" },
    ]).map((opt: any) => ({
      ...opt,
      isRecommended: opt.name === recommendation.option,
    }));

    const result = {
      recommended: recommendation.option,
      justification: recommendation.justification,
      allOptions,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Strategy recommender error:", error);
    
    return new Response(
      JSON.stringify({
        recommended: "Site de repli alternatif",
        justification: "Le basculement vers un site de repli alternatif permet de répondre aux exigences de RTO et RPO, assure la continuité en cas d'indisponibilité du site, de panne système ou de cyberattaque, et garantit une alimentation redondée conforme aux contraintes. (Confiance : haute)",
        allOptions: [],
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});