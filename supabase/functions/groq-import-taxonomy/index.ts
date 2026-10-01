// supabase/functions/groq-import-taxonomy/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-120b";

const SYSTEM_PROMPT = `Tu es un expert en analyse d'organigrammes et de taxonomies d'entreprise pour un logiciel de continuité d'activité (PCA/BIA).

Ton rôle : analyser un fichier Excel brut (en-têtes + lignes) et reconstruire TOUTE la structure hiérarchique + les processus, quelle que soit la façon dont le fichier est organisé. Tu dois comprendre le fichier COMME UN HUMAIN qui le lirait.

═══════════════════════════════════════════════
⚠️ RÈGLE N°1 — LE PIÈGE LE PLUS FRÉQUENT À ÉVITER
═══════════════════════════════════════════════

Beaucoup de fichiers mélangent DEUX types de lignes :
  • Lignes ENTITÉ (Filiale, Direction, Service, Département)
  • Lignes PROCESSUS

Dans ces fichiers, la colonne qui indique le nom de l'entité CHANGE selon le type de ligne :
  • Sur une ligne ENTITÉ : le nom de l'entité est dans la colonne "Nom" (ou "Name"/"Libellé"/"Intitulé")
  • Sur une ligne PROCESSUS : la colonne "Nom" est souvent VIDE, et le nom de l'entité porteuse se trouve dans la colonne qui sert normalement à indiquer le parent ("Entité Parente", "Parent", "Rattaché à", "Direction", "Service", ...)

👉 EXEMPLE CONCRET À COMPRENDRE ABSOLUMENT :

| Nom | Type | Entité Parente | Référent PCA | Processus | RTO | RPO | Criticité |
|-----|------|-----------------|---------------|-----------|-----|-----|-----------|
| Service Infrastructure | SERVICE | Direction SI | Ahmed Ben Ali | | | | |
| | | Service Infrastructure | | R4 | 4 | 1 | Critique |
| | | Service Comptabilité | | R2 | 8 | 4 | Élevé |

Ligne 1 : ENTITÉ. Nom = "Service Infrastructure", parent = "Direction SI".
Ligne 2 : PROCESSUS. Nom vide, MAIS "Processus" = "R4" ET "Entité Parente" = "Service Infrastructure".
         → L'entité porteuse du processus "R4" est "Service Infrastructure".
Ligne 3 : PROCESSUS. Entité porteuse = "Service Comptabilité".

RÈGLE GÉNÉRALE : Pour chaque ligne, tu dois DÉDUIRE par toi-même où se trouve le nom de l'entité porteuse :
  1. La colonne "Nom" / "Name" / "Entité" / "Libellé" si elle est remplie sur cette ligne
  2. Sinon, la colonne "Entité Parente" / "Parent" / "Rattaché à" si elle contient un nom qui existe dans ton référentiel d'entités
  3. Sinon, la colonne qui contient la valeur la plus proche d'un nom d'entité déjà rencontré dans le fichier

═══════════════════════════════════════════════
RÈGLES MÉTIER
═══════════════════════════════════════════════

1. Hiérarchie cible : FILIALE → DIRECTION → SERVICE / DÉPARTEMENT (3 niveaux max)
2. Une FILIALE n'a pas de parent
3. Une DIRECTION a toujours une FILIALE comme parent
4. Un SERVICE ou DÉPARTEMENT a toujours une DIRECTION comme parent
5. Si le fichier ne respecte pas exactement cette hiérarchie (ex: 2 niveaux, 4 niveaux), adapte intelligemment
6. **Les processus peuvent être portés par une DIRECTION, un SERVICE ou un DÉPARTEMENT — JAMAIS par une FILIALE.** Si un processus semble rattaché à une Filiale, crée automatiquement une "Direction Générale" + "Service Général" sous cette Filiale, et rattache le processus au Service Général.
7. Un processus a : nom, entité porteuse, responsable (optionnel), RTO en heures (optionnel), RPO en heures (optionnel), criticité (optionnel)

═══════════════════════════════════════════════
INTERPRÉTATION DES VALEURS
═══════════════════════════════════════════════

- RTO/RPO : convertir en heures. "4h" → 4, "2 jours" → 48, "1 semaine" → 168, "30 min" → 0.5, "0,5" → 0.5
- Criticité : retourner OBLIGATOIREMENT une de ces 4 valeurs EXACTES, en MAJUSCULES et SANS ACCENT :
    * "CRITIQUE"  (pour : Critique, Élevé, Très élevé, High, Critical, Sévère, Très sévère)
    * "MAJEUR"    (pour : Majeur, Important)
    * "MODERE"    (pour : Modéré, Moyen, Medium)
    * "MINEUR"    (pour : Mineur, Faible, Bas, Low)
  Si la criticité n'est pas renseignée dans le fichier, mets null.
- Responsable : peut être "Responsable", "Owner", "Pilote", "Référent", "Process Owner", etc.
- Ignore les lignes vides, les totaux, les commentaires

═══════════════════════════════════════════════
FORMAT DE SORTIE (JSON STRICT, rien d'autre)
═══════════════════════════════════════════════

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

═══════════════════════════════════════════════
RÈGLES DE VALIDATION FINALE
═══════════════════════════════════════════════

1. ✅ Tous les processus ont un "entityName" NON VIDE
2. ✅ Chaque "entityName" de processus correspond EXACTEMENT à un "name" dans "entities"
3. ✅ Aucune entité n'est dupliquée dans "entities"
4. ✅ Tous les parents référencés existent dans "entities"
5. ✅ AUCUN processus n'est rattaché à une FILIALE (jamais)

IMPORTANT :
- Ne renvoie QUE le JSON, sans backticks ni texte autour
- Les noms d'entités dans "entities" et dans "processes[].entityName" doivent être EXACTEMENT identiques`;

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

RAPPEL CRITIQUE : sur les lignes processus, la colonne "Nom" est souvent VIDE, et le nom de l'entité porteuse se trouve dans une AUTRE colonne (souvent "Entité Parente" ou "Parent"). Ne renvoie AUCUN processus avec entityName vide. JAMAIS un processus rattaché à une FILIALE.

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

    if (!parsed.entities || !Array.isArray(parsed.entities)) parsed.entities = [];
    if (!parsed.processes || !Array.isArray(parsed.processes)) parsed.processes = [];
    if (!parsed.summary) parsed.summary = "Analyse terminée.";
    if (!parsed.hierarchyDepth) parsed.hierarchyDepth = 3;
    if (!parsed.warnings) parsed.warnings = [];

    // Nettoyage
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

    // ============================================================
    // ✅ VALIDATION HIÉRARCHIQUE STRICTE
    // ============================================================
    const entityByName = new Map<string, any>();
    for (const e of parsed.entities) {
      entityByName.set(e.name.toLowerCase().trim(), e);
    }

    const ensureChild = (parentName: string, childName: string, childType: string) => {
      const key = childName.toLowerCase().trim();
      if (entityByName.has(key)) return entityByName.get(key);
      const created = {
        name: childName,
        type: childType,
        parentName,
        referent: null,
      };
      parsed.entities.push(created);
      entityByName.set(key, created);
      return created;
    };

    const processesToKeep: any[] = [];
    for (const p of parsed.processes) {
      const entityKey = (p.entityName || "").toLowerCase().trim();
      const linkedEntity = entityByName.get(entityKey);

      if (!linkedEntity) {
        parsed.warnings.push(`Processus "${p.name}" ignoré : entité "${p.entityName}" non trouvée.`);
        continue;
      }

      let targetEntity = linkedEntity;

      if (linkedEntity.type === "FILIALE") {
        const directionName = `Direction Générale`;
        const direction = ensureChild(linkedEntity.name, directionName, "DIRECTION");

        const serviceName = `Service Général`;
        const service = ensureChild(direction.name, serviceName, "SERVICE");

        targetEntity = service;

        parsed.warnings.push(
          `Processus "${p.name}" rattaché directement à la filiale "${linkedEntity.name}" → ` +
          `création automatique de "${directionName}" + "${serviceName}" pour respecter la hiérarchie.`
        );
      }

      processesToKeep.push({
        ...p,
        entityName: targetEntity.name,
      });
    }

    parsed.processes = processesToKeep;

    for (const e of parsed.entities) {
      if (e.type === "FILIALE") e.parentName = null;
    }

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