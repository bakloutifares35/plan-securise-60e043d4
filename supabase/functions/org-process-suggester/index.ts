// supabase/functions/groq-import-taxonomy/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
// ⭐ Modèle mis à jour (remplace llama-3.3-70b-versatile décommissionné)
const GROQ_MODEL = "openai/gpt-oss-120b";

const SYSTEM_PROMPT = `Tu es un expert en analyse d'organigrammes et de taxonomies d'entreprise pour un logiciel de continuité d'activité (PCA/BIA).

Ton rôle : analyser un fichier Excel brut (en-têtes + lignes) et reconstruire TOUTE la structure hiérarchique, quelle que soit la façon dont elle est encodée :
- Hiérarchie en colonne "Parent" (référence au nom)
- Hiérarchie en plusieurs colonnes de niveaux (ex: "Niveau 1", "Niveau 2", "Niveau 3", ou "Filiale", "Direction", "Service")
- Hiérarchie par indentation (colonnes vides qui propagent la valeur précédente)
- Hiérarchie mixte ou ambiguë
- Colonnes dans n'importe quel ordre, avec n'importe quel nom (FR/EN, accents, majuscules)
- Lignes entités ET lignes processus mélangées dans le même fichier

RÈGLES MÉTIER :
1. Hiérarchie cible : FILIALE → DIRECTION → SERVICE / DÉPARTEMENT (3 niveaux max)
2. Une FILIALE n'a pas de parent
3. Une DIRECTION a toujours une FILIALE comme parent
4. Un SERVICE ou DÉPARTEMENT a toujours une DIRECTION comme parent
5. Si le fichier ne respecte pas exactement cette hiérarchie (ex: 2 niveaux, 4 niveaux), adapte intelligemment :
   - 2 niveaux → les niveaux hauts deviennent FILIALE, les bas deviennent DIRECTION
   - 4 niveaux → fusionne les 2 niveaux les plus bas en SERVICE/DÉPARTEMENT
6. Les processus peuvent être portés par n'importe quel niveau (Filiale, Direction, Service, Département)
7. Un processus a : nom, entité porteuse (= entité de la ligne ou dernière entité rencontrée), responsable (optionnel), RTO en heures (optionnel), RPO en heures (optionnel), criticité (optionnel : Critique/Majeur/Modéré/Mineur ou variantes)

INTERPRÉTATION DES VALEURS :
- RTO/RPO : convertir en heures. "4h" → 4, "2 jours" → 48, "1 semaine" → 168, "30 min" → 0.5, "0,5" → 0.5
- Criticité : normaliser vers "Critique" | "Majeur" | "Modéré" | "Mineur". Variantes : "Élevé"/"High"/"Critical" → "Critique", "Medium"/"Moyen" → "Modéré", "Low"/"Faible" → "Mineur"
- Responsable : peut être "Responsable", "Owner", "Pilote", "Référent", "Process Owner", etc.
- Ignore les lignes vides, les totaux, les commentaires

FORMAT DE SORTIE (JSON STRICT, rien d'autre) :
{
  "summary": "Description courte de ce que tu as compris (1-2 phrases)",
  "hierarchyDepth": 3,
  "entities": [
    { "name": "string", "type": "FILIALE|DIRECTION|SERVICE|DÉPARTEMENT", "parentName": "string|null", "referent": "string|null" }
  ],
  "processes": [
    { "name": "string", "entityName": "string", "owner": "string|null", "rto": number|null, "rpo": number|null, "criticality": "string|null" }
  ],
  "warnings": ["string"]
}

IMPORTANT :
- Ne renvoie QUE le JSON, sans backticks ni texte autour
- Tous les noms d'entités doivent être EXACTEMENT les mêmes dans "entities" et dans "processes[].entityName"
- Si une entité est référencée comme parent mais n'a pas de ligne propre, crée-la avec un type déduit
- Ne mets pas de doublons dans "entities" (même name → une seule entrée)`;

interface RawRow {
  [key: string]: any;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { rows, headers, fileName } = await req.json();

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return new Response(
        JSON.stringify({ error: "Aucune donnée à analyser" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Clé API Groq manquante côté serveur" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Échantillon : max 200 lignes, max 15 colonnes
    const sampleRows = rows.slice(0, 200);
    const truncatedHeaders = (headers || Object.keys(sampleRows[0] || {})).slice(0, 15);

    const compactRows = sampleRows.map((row: RawRow) => {
      const out: RawRow = {};
      for (const h of truncatedHeaders) {
        const v = row[h];
        if (v !== undefined && v !== null && String(v).trim() !== "") {
          out[h] = typeof v === "string" ? v.trim().substring(0, 120) : v;
        }
      }
      return out;
    });

    const userPrompt = `Fichier : "${fileName || "import.xlsx"}"

En-têtes détectés : ${JSON.stringify(truncatedHeaders)}

Données (${compactRows.length} lignes sur ${rows.length} au total${rows.length > 200 ? " — échantillon" : ""}) :
${JSON.stringify(compactRows, null, 1)}

Analyse ce fichier et reconstruis TOUTE la structure hiérarchique + les processus.
Réponds UNIQUEMENT avec le JSON demandé.`;

    const groqResponse = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 8000,
        response_format: { type: "json_object" },
      }),
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      console.error("Groq API error:", groqResponse.status, errText);
      return new Response(
        JSON.stringify({ error: `Erreur Groq (${groqResponse.status})`, details: errText.substring(0, 500) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const groqData = await groqResponse.json();
    const content = groqData?.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ error: "Réponse Groq vide" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let parsed: any;
    try {
      const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error("JSON parse error:", e, "Content:", content.substring(0, 500));
      return new Response(
        JSON.stringify({ error: "JSON invalide renvoyé par l'IA", raw: content.substring(0, 800) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validation minimale
    if (!parsed.entities || !Array.isArray(parsed.entities)) parsed.entities = [];
    if (!parsed.processes || !Array.isArray(parsed.processes)) parsed.processes = [];
    if (!parsed.summary) parsed.summary = "Analyse terminée.";
    if (!parsed.hierarchyDepth) parsed.hierarchyDepth = 3;
    if (!parsed.warnings) parsed.warnings = [];

    // Nettoyage / normalisation
    const validTypes = ["FILIALE", "DIRECTION", "SERVICE", "DÉPARTEMENT", "DEPARTEMENT"];
    parsed.entities = parsed.entities
      .filter((e: any) => e && e.name && String(e.name).trim() !== "")
      .map((e: any) => {
        let t = String(e.type || "").toUpperCase().trim();
        if (t === "DEPARTEMENT") t = "DÉPARTEMENT";
        if (!validTypes.includes(t)) t = "SERVICE";
        return {
          name: String(e.name).trim(),
          type: t,
          parentName: e.parentName ? String(e.parentName).trim() : null,
          referent: e.referent ? String(e.referent).trim() : null,
        };
      });

    const entityNameSet = new Set(parsed.entities.map((e: any) => e.name));

    parsed.processes = parsed.processes
      .filter((p: any) => p && p.name && String(p.name).trim() !== "")
      .map((p: any) => ({
        name: String(p.name).trim(),
        entityName: p.entityName ? String(p.entityName).trim() : "",
        owner: p.owner ? String(p.owner).trim() : null,
        rto: typeof p.rto === "number" && !isNaN(p.rto) ? p.rto : null,
        rpo: typeof p.rpo === "number" && !isNaN(p.rpo) ? p.rpo : null,
        criticality: p.criticality ? String(p.criticality).trim() : null,
      }))
      .filter((p: any) => entityNameSet.has(p.entityName));

    return new Response(
      JSON.stringify({
        success: true,
        summary: parsed.summary,
        hierarchyDepth: parsed.hierarchyDepth,
        entities: parsed.entities,
        processes: parsed.processes,
        warnings: parsed.warnings,
        model: GROQ_MODEL,
        rowsAnalyzed: compactRows.length,
        rowsTotal: rows.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Erreur globale:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});