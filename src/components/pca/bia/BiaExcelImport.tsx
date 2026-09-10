// ============================================================
// Import global Excel (format BPCE) au niveau d'une fiche BIA de service
// Crée tous les processus détectés + leurs ressources liées
// ============================================================
import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  FileSpreadsheet, ScanLine, Users, Server, Handshake, CheckCircle2, Loader2,
  AlertTriangle, Clock, XCircle, Sparkles,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/db";
import { computeMaxScore, scoreToCriticality, criticalityColor } from "@/data/bia";
import { getSuggestedRTO } from "@/components/pca/bia/BiaWizard";
import { parseBpceWorkbook, type ParsedActivity } from "./biaExcelParser";

type Phase = "idle" | "analyzing" | "review" | "creating" | "done";
type RowStatus = "pending" | "running" | "success" | "error";

type CreationRow = { key: string; name: string; status: RowStatus; message?: string; processId?: string };

const eq = (a: any, b: any) => String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();

export const BiaExcelImport = ({
  service,
  onImported,
}: {
  service: { id: string; name: string };
  onImported?: (processIds: string[]) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState({ label: "", done: 0, total: 5 });
  const [activities, setActivities] = useState<ParsedActivity[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [rows, setRows] = useState<CreationRow[]>([]);
  const [createdIds, setCreatedIds] = useState<string[]>([]);
  const [resourceTotals, setResourceTotals] = useState({ hr: 0, apps: 0, suppliers: 0 });

  const reset = () => {
    setPhase("idle");
    setActivities([]);
    setSelected({});
    setRows([]);
    setCreatedIds([]);
    setProgress({ label: "", done: 0, total: 5 });
  };

  // ---------------- PHASE 1 : analyse ----------------
  const handleFile = async (file: File) => {
    reset();
    setOpen(true);
    setPhase("analyzing");
    try {
      const buffer = await file.arrayBuffer();
      // Laisse le temps au loader de s'afficher proprement
      await new Promise((r) => setTimeout(r, 300));
      const parsed = parseBpceWorkbook(buffer, (label, done, total) => {
        setProgress({ label, done, total });
      });
      await new Promise((r) => setTimeout(r, 400));

      if (parsed.length === 0) {
        setActivities([]);
        setPhase("review");
        return;
      }
      setActivities(parsed);
      setSelected(Object.fromEntries(parsed.map((a) => [a.key, true])));
      setPhase("review");
    } catch (e: any) {
      console.error("Erreur lecture fichier BIA:", e);
      setOpen(false);
      setPhase("idle");
      toast({
        title: "Fichier illisible",
        description: "Ce fichier n'a pas pu être lu. Vérifiez qu'il s'agit bien d'un fichier .xlsx non corrompu.",
        variant: "destructive",
      });
    }
  };

  const chosen = activities.filter((a) => selected[a.key]);
  const totals = {
    hr: chosen.reduce((s, a) => s + a.collaborators.length, 0),
    apps: chosen.reduce((s, a) => s + a.applications.length, 0),
    suppliers: chosen.reduce((s, a) => s + a.suppliers.length, 0),
  };

  // ---------------- Référentiel : réutilise ou crée ----------------
  const ensureResource = async (table: string, name: string, payload: Record<string, any>) => {
    const { data: existing } = await supabase.from(table).select("id, name").ilike("name", name);
    const hit = (existing || []).find((r: any) => eq(r.name, name));
    if (hit) return hit.id as string;
    const { data, error } = await supabase.from(table).insert({ name, ...payload }).select("id").single();
    if (error) throw error;
    return data.id as string;
  };

  const link = async (table: string, payload: Record<string, any>) => {
    const { error } = await supabase.from(table).insert(payload);
    if (error && !String(error.message || "").toLowerCase().includes("duplicate")) {
      console.warn(`Liaison ${table} ignorée:`, error.message);
    }
  };

  const insertProcess = async (act: ParsedActivity, rto: number) => {
    const base: Record<string, any> = {
      entity_id: service.id,
      name: act.name,
      direction: service.name,
      owner: act.owner || "",
      description: act.description || "",
      status: "ACTIF",
      impacts: act.impacts,
      rto_hours: rto,
      last_bia_date: new Date().toISOString().slice(0, 10),
    };

    let res = await supabase.from("processus_metier").insert({ ...base, periode_critique: act.periodeCritique || null }).select("id").single();
    if (res.error && /periode_critique/i.test(res.error.message || "")) {
      // Colonne absente côté base : import sans la période critique
      res = await supabase.from("processus_metier").insert(base).select("id").single();
    }
    if (res.error) throw res.error;
    return res.data.id as string;
  };

  // ---------------- PHASE 3 : création ----------------
  const confirmImport = async () => {
    if (chosen.length === 0) return;
    setResourceTotals(totals);
    setRows(chosen.map((a) => ({ key: a.key, name: a.name, status: "pending" })));
    setPhase("creating");

    const ids: string[] = [];
    for (const act of chosen) {
      setRows((prev) => prev.map((r) => (r.key === act.key ? { ...r, status: "running" } : r)));
      try {
        const suggestion = getSuggestedRTO(act.impacts);
        const rto = act.rtoDeclared ?? suggestion.rto;
        const processId = await insertProcess(act, rto);
        ids.push(processId);

        // Collaborateurs
        for (const c of act.collaborators) {
          const full = [c.nom, c.prenom].filter(Boolean).join(" ").trim();
          if (!full) continue;
          try {
            const id = await ensureResource("ressources_humaines", full, { role: c.fonction || "" });
            await link("processus_ressources_humaines", { processus_id: processId, ressource_humaine_id: id });
            await link("bia_ressources_humaines", { service_id: service.id, ressource_humaine_id: id });
          } catch (e: any) { console.warn("Collaborateur ignoré:", full, e?.message); }
        }

        // Applications
        for (const a of act.applications) {
          try {
            const id = await ensureResource("applications_it", a.name, {
              ...(a.rto_hours !== null ? { rto_hours: a.rto_hours } : {}),
              ...(a.rpo_hours !== null ? { rpo_hours: a.rpo_hours } : {}),
            });
            await link("processus_applications", {
              processus_id: processId,
              application_id: id,
              ...(a.rto_hours !== null ? { rto_hours: a.rto_hours } : {}),
              ...(a.rpo_hours !== null ? { rpo_hours: a.rpo_hours } : {}),
            });
            await link("bia_applications", { service_id: service.id, application_id: id });
          } catch (e: any) { console.warn("Application ignorée:", a.name, e?.message); }
        }

        // Prestataires
        for (const s of act.suppliers) {
          try {
            const id = await ensureResource("fournisseurs", s.name, {
              ...(s.detail ? { service: s.detail } : {}),
              ...(s.rto_hours !== null ? { rto_hours: s.rto_hours } : {}),
            });
            await link("processus_fournisseurs", {
              processus_id: processId,
              fournisseur_id: id,
              ...(s.rto_hours !== null ? { rto_hours: s.rto_hours } : {}),
            });
            await link("bia_fournisseurs", { service_id: service.id, fournisseur_id: id });
          } catch (e: any) { console.warn("Prestataire ignoré:", s.name, e?.message); }
        }

        setRows((prev) => prev.map((r) => (r.key === act.key ? { ...r, status: "success", processId } : r)));
      } catch (e: any) {
        console.error("Échec import processus", act.name, e);
        setRows((prev) => prev.map((r) => (r.key === act.key ? { ...r, status: "error", message: e?.message || "Erreur inconnue" } : r)));
      }
    }

    setCreatedIds(ids);
    setPhase("done");
  };

  const finish = () => {
    setOpen(false);
    const ids = [...createdIds];
    reset();
    onImported?.(ids);
  };

  // ---------------- Rendu ----------------
  const okCount = rows.filter((r) => r.status === "success").length;
  const koRows = rows.filter((r) => r.status === "error");

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) handleFile(f);
        }}
      />

      <Button
        variant="outline"
        className="w-full bg-white border-[#2A5141] text-[#2A5141] hover:bg-[#F8F6F2] font-medium"
        onClick={() => inputRef.current?.click()}
      >
        <FileSpreadsheet className="h-4 w-4 mr-2" /> Importer depuis Excel
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!o && phase !== "creating") { setOpen(false); reset(); } }}>
        <DialogContent className="max-w-3xl bg-white p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#E8E4DC] bg-[#F8F6F2]">
            <DialogTitle className="font-[Playfair_Display] text-xl text-[#172030] flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-[#2A5141]" />
              Import BIA — {service.name}
            </DialogTitle>
            <DialogDescription className="text-[#172030]/60">
              Création automatique des processus, matrices d'impact et ressources depuis un fichier au format BPCE.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-6 max-h-[65vh] overflow-y-auto">
            {/* PHASE 1 */}
            {phase === "analyzing" && (
              <div className="py-14 flex flex-col items-center gap-5 animate-in fade-in duration-300">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-[#2A5141]/10 animate-ping" />
                  <div className="relative h-16 w-16 rounded-full bg-[#2A5141]/10 flex items-center justify-center">
                    <ScanLine className="h-7 w-7 text-[#2A5141] animate-pulse" />
                  </div>
                </div>
                <p className="text-sm font-medium text-[#172030] transition-all">{progress.label || "Analyse en cours…"}</p>
                <div className="w-full max-w-sm">
                  <Progress value={(progress.done / progress.total) * 100} className="h-1.5" />
                  <p className="text-[11px] text-[#172030]/40 mt-2 text-center">Étape {progress.done}/{progress.total}</p>
                </div>
              </div>
            )}

            {/* PHASE 2 */}
            {phase === "review" && activities.length === 0 && (
              <div className="py-14 text-center animate-in fade-in duration-300">
                <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-4" />
                <p className="font-medium text-[#172030]">Aucune activité trouvée dans ce fichier</p>
                <p className="text-sm text-[#172030]/60 mt-1">
                  Vérifiez qu'il suit bien le format attendu (onglet « Identification Activité », activités à partir de la ligne 14).
                </p>
                <Button variant="outline" className="mt-5" onClick={() => { setOpen(false); reset(); }}>Fermer</Button>
              </div>
            )}

            {phase === "review" && activities.length > 0 && (
              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {activities.map((act) => {
                  const score = computeMaxScore(act.impacts);
                  const crit = scoreToCriticality(score);
                  const suggestion = getSuggestedRTO(act.impacts);
                  const declared = act.rtoDeclared;
                  const diverges = declared !== null && suggestion.rto > 0 &&
                    Math.abs(declared - suggestion.rto) / Math.max(declared, suggestion.rto) > 0.2;
                  return (
                    <div
                      key={act.key}
                      className={cn(
                        "rounded-xl border p-4 transition-all",
                        selected[act.key] ? "border-[#2A5141]/40 bg-white shadow-sm" : "border-[#E8E4DC] bg-[#F8F6F2]/60 opacity-70"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={!!selected[act.key]}
                          onCheckedChange={(v) => setSelected((p) => ({ ...p, [act.key]: !!v }))}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-[#172030] truncate">{act.name}</span>
                            <Badge className={cn("text-[10px]", criticalityColor(crit))}>{crit}</Badge>
                            {act.warnings.map((w) => (
                              <span key={w} className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                                ⚠ {w}
                              </span>
                            ))}
                          </div>

                          <div className="flex items-center gap-2 flex-wrap mt-2.5 text-[11px]">
                            <span className="inline-flex items-center gap-1 bg-[#F8F6F2] border border-[#E8E4DC] rounded px-2 py-1 text-[#172030]/70">
                              Impacts {act.filledCells}/28
                            </span>
                            <span className="inline-flex items-center gap-1 bg-[#F8F6F2] border border-[#E8E4DC] rounded px-2 py-1 text-[#172030]/70">
                              <Clock className="h-3 w-3 text-[#2A5141]" />
                              RTO {declared !== null ? `${declared}h` : "—"} · calculé {suggestion.rto}h
                            </span>
                            <span className="inline-flex items-center gap-1 bg-[#F8F6F2] border border-[#E8E4DC] rounded px-2 py-1 text-[#172030]/70">
                              <Users className="h-3 w-3 text-[#2A5141]" /> {act.collaborators.length}
                            </span>
                            <span className="inline-flex items-center gap-1 bg-[#F8F6F2] border border-[#E8E4DC] rounded px-2 py-1 text-[#172030]/70">
                              <Server className="h-3 w-3 text-[#2A5141]" /> {act.applications.length}
                            </span>
                            <span className="inline-flex items-center gap-1 bg-[#F8F6F2] border border-[#E8E4DC] rounded px-2 py-1 text-[#172030]/70">
                              <Handshake className="h-3 w-3 text-[#2A5141]" /> {act.suppliers.length}
                            </span>
                            {act.periodeCritique && (
                              <span className="inline-flex items-center gap-1 bg-[#F8F6F2] border border-[#E8E4DC] rounded px-2 py-1 text-[#172030]/70">
                                Période critique : {act.periodeCritique}
                              </span>
                            )}
                          </div>

                          {diverges && (
                            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mt-2">
                              Le RTO déclaré dans l'Excel ({declared}h) diffère du RTO calculé automatiquement à partir de la matrice d'impact ({suggestion.rto}h) — à vérifier.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* PHASE 3 */}
            {(phase === "creating" || phase === "done") && (
              <div className="space-y-2 animate-in fade-in duration-300">
                {rows.map((r) => (
                  <div key={r.key} className="flex items-center gap-3 rounded-lg border border-[#E8E4DC] bg-white px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#172030] truncate">{r.name}</p>
                      {r.status === "error" && <p className="text-[11px] text-red-600 mt-0.5">{r.message}</p>}
                    </div>
                    {r.status === "pending" && <span className="text-xs text-[#172030]/40">En attente</span>}
                    {r.status === "running" && (
                      <span className="text-xs text-[#2A5141] inline-flex items-center gap-1.5">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Création…
                      </span>
                    )}
                    {r.status === "success" && (
                      <span className="text-xs text-[#2A5141] inline-flex items-center gap-1.5 animate-in zoom-in duration-300">
                        <CheckCircle2 className="h-4 w-4" /> Créé
                      </span>
                    )}
                    {r.status === "error" && (
                      <span className="text-xs text-red-600 inline-flex items-center gap-1.5">
                        <XCircle className="h-4 w-4" /> Échec
                      </span>
                    )}
                  </div>
                ))}

                {phase === "done" && (
                  <div className="mt-5 rounded-xl border border-[#2A5141]/30 bg-[#F8F6F2] p-5 text-center animate-in fade-in zoom-in duration-300">
                    <CheckCircle2 className="h-10 w-10 text-[#2A5141] mx-auto mb-3" />
                    <p className="font-[Playfair_Display] text-lg text-[#172030]">Import terminé</p>
                    <p className="text-sm text-[#172030]/70 mt-1">
                      {okCount} processus créé{okCount > 1 ? "s" : ""} · {resourceTotals.hr} collaborateur{resourceTotals.hr > 1 ? "s" : ""} ·{" "}
                      {resourceTotals.apps} application{resourceTotals.apps > 1 ? "s" : ""} · {resourceTotals.suppliers} prestataire{resourceTotals.suppliers > 1 ? "s" : ""}
                    </p>
                    {koRows.length > 0 && (
                      <p className="text-xs text-red-600 mt-2">
                        {koRows.length} échec(s) : {koRows.map((r) => `${r.name} (${r.message})`).join(" · ")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Barre d'action */}
          {phase === "review" && activities.length > 0 && (
            <div className="px-6 py-4 border-t border-[#E8E4DC] bg-[#F8F6F2] flex items-center gap-3">
              <p className="text-xs text-[#172030]/70 flex-1">
                <Sparkles className="h-3.5 w-3.5 inline mr-1 text-[#2A5141]" />
                {chosen.length} processus, {totals.hr} collaborateurs, {totals.apps} applications, {totals.suppliers} prestataires seront créés
              </p>
              <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>Annuler</Button>
              <Button
                disabled={chosen.length === 0}
                className="bg-[#2A5141] hover:bg-[#2A5141]/90 text-white"
                onClick={confirmImport}
              >
                Confirmer l'import
              </Button>
            </div>
          )}

          {phase === "done" && (
            <div className="px-6 py-4 border-t border-[#E8E4DC] bg-[#F8F6F2] flex justify-end">
              <Button className="bg-[#2A5141] hover:bg-[#2A5141]/90 text-white" onClick={finish}>
                Voir les processus importés
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BiaExcelImport;
