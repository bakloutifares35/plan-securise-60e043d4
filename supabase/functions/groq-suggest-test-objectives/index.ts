// Suggestion d'objectifs de test PCA — même pattern que groq-warroom-assist
// (Groq gpt-oss-120b → gpt-oss-20b → Lovable AI), JSON strict, erreurs explicites.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: corsHeaders });

async function call(url: string, key: string, model: string, messages: unknown[]) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30000);
  try {
    const r = await fetch(url, {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, temperature: 0.4, response_format: { type: "json_object" } }),
    });
    if (!r.ok) throw new Error(`${model}: HTTP ${r.status}`);
    const d = await r.json();
    return String(d?.choices?.[0]?.message?.content ?? "");
  } finally {
    clearTimeout(t);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    let body: any;
    try { body = await req.json(); } catch { return json({ error: "JSON invalide" }, 400); }
    const { type, processus, scenario } = body ?? {};
    if (!type || !processus?.nom) return json({ error: "Type de test et processus requis" }, 400);

    const messages = [
      { role: "system", content: "Tu es expert BCM (ISO 22301, DORA). Réponds UNIQUEMENT en JSON: {\"objectifs\":[{\"libelle\":\"...\"}]}. 3 à 5 objectifs mesurables, spécifiques au contexte (cite le processus, le RTO en heures, le scénario), vérifiables pendant l'exercice. Français professionnel. N'invente aucune donnée absente." },
      { role: "user", content: `Type de test: ${type}\nProcessus: ${processus.nom}\nCriticité: ${processus.criticite ?? "inconnue"}\nRTO cible: ${processus.rto ?? "non renseigné"} h\nScénario de risque: ${scenario ?? "aucun"}` },
    ];

    const attempts: [string, string | undefined, string][] = [
      ["https://api.groq.com/openai/v1/chat/completions", Deno.env.get("GROQ_API_KEY"), Deno.env.get("GROQ_MODEL") ?? "openai/gpt-oss-120b"],
      ["https://api.groq.com/openai/v1/chat/completions", Deno.env.get("GROQ_API_KEY"), "openai/gpt-oss-20b"],
      ["https://ai.gateway.lovable.dev/v1/chat/completions", Deno.env.get("LOVABLE_API_KEY"), "google/gemini-2.5-flash"],
    ];
    const errors: string[] = [];
    for (const [url, key, model] of attempts) {
      if (!key) continue;
      try {
        const raw = (await call(url, key, model, messages)).replace(/```json|```/g, "");
        const m = raw.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(m ? m[0] : raw);
        const objectifs = (parsed.objectifs ?? [])
          .map((o: any) => ({ libelle: String(o?.libelle ?? o ?? "").trim() }))
          .filter((o: any) => o.libelle).slice(0, 5);
        if (objectifs.length) return json({ objectifs, model });
        errors.push(`${model}: réponse vide`);
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
    return json({ error: "Suggestions IA indisponibles", details: errors }, 502);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erreur interne" }, 500);
  }
});
