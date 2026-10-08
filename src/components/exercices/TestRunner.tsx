// Mode exécution + Résultats & rapport imprimable d'un test PCA
import { useEffect, useState } from "react";
import { ArrowLeft, Eye, Play, Printer, Plus, Timer, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/db";
import { ExData, TestPca, useTestDetail, TYPE_LABELS, STATUT_LABELS, CRIT_COLORS, fmtDate } from "./useExercices";
import { useRole } from "@/contexts/RoleContext";

const card = "bg-white rounded-xl shadow-[0_1px_3px_rgba(23,32,48,0.08)] p-5";
const h = "font-['Playfair_Display'] text-lg text-[#172030] mb-3";

export const TestRunner = ({ test, data, onBack }: { test: TestPca; data: ExData; onBack: () => void }) => {
  const { detail, reload } = useTestDetail(test.id);
  const { can } = useRole();
  const [now, setNow] = useState(Date.now());
  const [rto, setRto] = useState<string>("");
  const [synthese, setSynthese] = useState("");
  const [lecons, setLecons] = useState("");
  const [newAction, setNewAction] = useState({ description: "", responsable: "", echeance: "", priorite: "MOYENNE", objectif_id: "" });
  const proc = data.processus.find((p) => p.id === test.processus_id);
  const running = test.statut === "EN_COURS";
  const closed = test.statut === "TERMINE" || test.statut === "OBJECTIFS_NON_ATTEINTS";

  useEffect(() => {
    if (detail.resultat) {
      setRto(detail.resultat.rto_reel_heures?.toString() ?? "");
      setSynthese(detail.resultat.synthese ?? "");
      setLecons(detail.resultat.lecons_apprises ?? "");
    }
  }, [detail.resultat]);
  useEffect(() => {
    if (!running) return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [running]);

  const t0 = test.date_debut_reelle ? new Date(test.date_debut_reelle).getTime() : null;
  const elapsed = t0 ? Math.max(0, (closed && test.date_fin_reelle ? new Date(test.date_fin_reelle).getTime() : now) - t0) : 0;
  const hms = new Date(elapsed).toISOString().substring(11, 19);

  const run = async (q: PromiseLike<any>) => {
    const { error } = await q;
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    return !error;
  };
  const start = async () => {
    if (await run(supabase.from("tests_pca").update({ statut: "EN_COURS", date_debut_reelle: new Date().toISOString() }).eq("id", test.id))) data.reload();
  };
  const reveal = async (id: string) => {
    if (await run(supabase.from("test_injectables").update({ revele: true, heure_revelation_reelle: new Date().toISOString() }).eq("id", id))) reload();
  };
  const setObj = async (id: string, patch: any) => {
    if (await run(supabase.from("test_objectifs").update(patch).eq("id", id))) reload();
  };
  const saveResult = async () => {
    const payload = { test_id: test.id, rto_reel_heures: rto === "" ? null : Number(rto), synthese, lecons_apprises: lecons };
    if (await run(supabase.from("test_resultats").upsert(payload, { onConflict: "test_id" }))) { toast({ title: "Résultats enregistrés" }); reload(); }
  };
  const addAction = async () => {
    if (!newAction.description.trim()) return;
    if (await run(supabase.from("test_actions_correctives").insert({
      test_id: test.id, description: newAction.description, responsable: newAction.responsable || null,
      echeance: newAction.echeance || null, priorite: newAction.priorite, objectif_id: newAction.objectif_id || null,
    }))) { setNewAction({ description: "", responsable: "", echeance: "", priorite: "MOYENNE", objectif_id: "" }); reload(); }
  };
  const setActionStatut = async (id: string, statut: string) => {
    if (await run(supabase.from("test_actions_correctives").update({ statut }).eq("id", id))) reload();
  };

  const unevaluated = detail.objectifs.filter((o) => o.atteint === null).length;
  const failed = detail.objectifs.filter((o) => o.atteint === false);
  const closeBlock = unevaluated > 0
    ? `${unevaluated} objectif(s) non évalué(s)`
    : failed.length && !detail.actions.length ? "Objectif non atteint sans action corrective" : null;
  const close = async () => {
    await saveResult();
    const statut = failed.length ? "OBJECTIFS_NON_ATTEINTS" : "TERMINE";
    if (await run(supabase.from("tests_pca").update({ statut, date_fin_reelle: new Date().toISOString() }).eq("id", test.id))) {
      toast({ title: `Test clôturé — ${STATUT_LABELS[statut]}` }); data.reload();
    }
  };

  const cible = detail.resultat?.rto_cible_heures ?? proc?.rto_hours ?? null;
  const atteignable = detail.resultat?.rto_atteignable_heures ?? null;
  const reel = rto === "" ? null : Number(rto);
  const max = Math.max(cible ?? 0, atteignable ?? 0, reel ?? 0, 1);
  const bars = [
    { l: "RTO cible (BIA)", v: cible, c: "#172030" },
    { l: "RTO atteignable (stratégie)", v: atteignable, c: "#3B4454" },
    { l: "RTO réel mesuré", v: reel, c: reel !== null && cible !== null && reel > cible ? "#C62828" : "#2A5141" },
  ];

  return (
    <div className="space-y-5 print:space-y-3">
      <style>{`@media print { aside, header, .no-print { display:none !important } body { background:white } }`}</style>
      <Button variant="ghost" className="no-print" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" />Retour</Button>

      <div className="rounded-xl bg-[#172030] text-white p-6 shadow-lg flex flex-wrap gap-6 items-center justify-between">
        <div>
          <p className="text-xs tracking-widest text-white/60">{test.reference} · {TYPE_LABELS[test.type]}{test.est_tlpt && " · TLPT"}</p>
          <h2 className="font-['Playfair_Display'] text-2xl mt-1">{test.titre}</h2>
          <p className="text-sm text-white/70 mt-1">
            {proc?.name ?? "—"}
            {proc && <span className="ml-2 px-2 py-0.5 rounded text-xs text-[#172030]" style={{ background: CRIT_COLORS[proc.criticite] }}>{proc.criticite}</span>}
            <span className="ml-3">Planifié le {fmtDate(test.date_planifiee)}</span>
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[11px] uppercase text-white/50">Chronomètre</p>
            <p className="font-mono text-3xl tabular-nums flex items-center gap-2"><Timer className="h-5 w-5 text-white/50" />{hms}</p>
          </div>
          {test.statut === "PLANIFIE" && (
            <Button className="bg-[#2A5141] hover:bg-[#21402F] no-print" disabled={!can("write")} onClick={start}><Play className="h-4 w-4 mr-1" />Démarrer (T0)</Button>
          )}
          {closed && <span className="px-3 py-1 rounded-full bg-white/10 text-sm">{STATUT_LABELS[test.statut]}</span>}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <section className={card}>
          <h3 className={h}>Injectables</h3>
          {!detail.injectables.length && <p className="text-sm text-[#3B4454]/60">Aucun injectable.</p>}
          <ol className="relative pl-5 space-y-3">
            <div className="absolute left-1.5 top-1 bottom-1 w-px bg-[#E5E2DD]" />
            {detail.injectables.map((inj) => {
              const due = t0 !== null && now >= t0 + inj.offset_minutes * 60000;
              return (
                <li key={inj.id} className="relative">
                  <span className={`absolute -left-[17px] top-1.5 h-2.5 w-2.5 rounded-full ${inj.revele ? "bg-[#2A5141]" : due ? "bg-[#EF6C00] animate-pulse" : "bg-[#E5E2DD]"}`} />
                  <div className="flex justify-between gap-2">
                    <div>
                      <p className="text-xs text-[#3B4454]/60">T0 + {inj.offset_minutes} min</p>
                      <p className="text-sm font-medium text-[#172030]">{inj.revele ? inj.titre : "Injectable masqué"}</p>
                      {inj.revele && <p className="text-sm text-[#3B4454]">{inj.description}</p>}
                    </div>
                    {!inj.revele && running && (
                      <Button size="sm" variant="ghost" className="no-print" disabled={!can("write")} onClick={() => reveal(inj.id)}><Eye className="h-4 w-4 mr-1" />Révéler</Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section className={card}>
          <h3 className={h}>Objectifs</h3>
          {!detail.objectifs.length && <p className="text-sm text-[#3B4454]/60">Aucun objectif défini.</p>}
          <div className="space-y-3">
            {detail.objectifs.map((o, k) => (
              <div key={o.id} className="border-l-[3px] pl-3" style={{ borderColor: o.atteint === null ? "#E5E2DD" : o.atteint ? "#2E7D32" : "#C62828" }}>
                <p className="text-sm text-[#172030]"><span className="font-semibold text-[#2A5141] mr-1">O{k + 1}</span>{o.libelle}</p>
                <div className="flex gap-2 mt-1 no-print">
                  {[true, false].map((v) => (
                    <button key={String(v)} disabled={!can("write") || closed || test.statut === "PLANIFIE"} onClick={() => setObj(o.id, { atteint: v })}
                      className={`text-xs px-3 py-1 rounded-full transition disabled:opacity-40 ${o.atteint === v ? (v ? "bg-[#E8F5E9] text-[#2E7D32] font-semibold" : "bg-[#FFEBEE] text-[#C62828] font-semibold") : "bg-[#F8F6F2] text-[#3B4454]"}`}>
                      {v ? "Atteint" : "Non atteint"}
                    </button>
                  ))}
                </div>
                <Input className="mt-1 h-8 text-sm" placeholder="Observation" defaultValue={o.observation ?? ""} disabled={!can("write") || closed}
                  onBlur={(e) => e.target.value !== (o.observation ?? "") && setObj(o.id, { observation: e.target.value })} />
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className={card}>
        <h3 className={h}>Comparatif RTO</h3>
        <div className="space-y-3">
          {bars.map((b) => (
            <div key={b.l} className="grid grid-cols-[200px_1fr_60px] items-center gap-3 text-sm">
              <span className="text-[#3B4454]">{b.l}</span>
              <div className="h-3 rounded-full bg-[#F8F6F2] overflow-hidden">
                {b.v !== null && <div className="h-full rounded-full" style={{ width: `${(b.v / max) * 100}%`, background: b.c }} />}
              </div>
              <span className="tabular-nums text-right font-medium">{b.v ?? "—"} h</span>
            </div>
          ))}
        </div>
        <div className="grid sm:grid-cols-3 gap-3 mt-4">
          <Input type="number" step="0.5" placeholder="RTO réel (heures)" value={rto} onChange={(e) => setRto(e.target.value)} disabled={!can("write") || closed} />
          <Textarea className="sm:col-span-2" placeholder="Synthèse" value={synthese} onChange={(e) => setSynthese(e.target.value)} disabled={closed} />
          <Textarea className="sm:col-span-3" placeholder="Leçons apprises" value={lecons} onChange={(e) => setLecons(e.target.value)} disabled={closed} />
        </div>
        {!closed && can("write") && <Button variant="outline" className="mt-3 no-print" onClick={saveResult}>Enregistrer les résultats</Button>}
      </section>

      <section className={card}>
        <h3 className={h}>Actions correctives</h3>
        <div className="space-y-2">
          {detail.actions.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-3 text-sm border-l-[3px] pl-3"
              style={{ borderColor: a.priorite === "HAUTE" ? "#C62828" : a.priorite === "MOYENNE" ? "#EF6C00" : "#2E7D32" }}>
              <span className="flex-1 min-w-[200px] text-[#172030]">{a.description}</span>
              <span className="text-[#3B4454]/70">{a.responsable ?? "—"} · {fmtDate(a.echeance)}</span>
              <Select value={a.statut} onValueChange={(v) => setActionStatut(a.id, v)} disabled={!can("write")}>
                <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="A_FAIRE">À faire</SelectItem><SelectItem value="EN_COURS">En cours</SelectItem><SelectItem value="FAIT">Fait</SelectItem></SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <div className="grid sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 mt-4 no-print">
          <Input placeholder="Action corrective" value={newAction.description} onChange={(e) => setNewAction({ ...newAction, description: e.target.value })} />
          <Input placeholder="Responsable" value={newAction.responsable} onChange={(e) => setNewAction({ ...newAction, responsable: e.target.value })} />
          <Input type="date" value={newAction.echeance} onChange={(e) => setNewAction({ ...newAction, echeance: e.target.value })} />
          <Select value={newAction.priorite} onValueChange={(v) => setNewAction({ ...newAction, priorite: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="FAIBLE">Faible</SelectItem><SelectItem value="MOYENNE">Moyenne</SelectItem><SelectItem value="HAUTE">Haute</SelectItem></SelectContent>
          </Select>
          <Select value={newAction.objectif_id || "none"} onValueChange={(v) => setNewAction({ ...newAction, objectif_id: v === "none" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="Objectif" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Aucun objectif</SelectItem>
              {detail.objectifs.map((o, k) => <SelectItem key={o.id} value={o.id}>O{k + 1}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={addAction} disabled={!can("write")}><Plus className="h-4 w-4" /></Button>
        </div>
      </section>

      <div className="flex flex-wrap justify-end gap-3 no-print">
        <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />Synthèse imprimable</Button>
        {running && (
          <Button className="bg-[#2A5141] hover:bg-[#21402F]" disabled={!!closeBlock || !can("write")} onClick={close} title={closeBlock ?? ""}>
            {closeBlock ? <><Lock className="h-4 w-4 mr-1" />{closeBlock}</> : "Clôturer le test"}
          </Button>
        )}
      </div>
    </div>
  );
};
