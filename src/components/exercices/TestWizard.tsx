// Wizard de création d'un test PCA — tout en mémoire jusqu'à la création finale
import { useMemo, useState } from "react";
import { Loader2, Plus, Sparkles, Trash2, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/db";
import { functionsClient } from "@/integrations/supabase/functionsClient";
import { ExData, TestType, TYPE_LABELS, CRIT_COLORS } from "./useExercices";

const STEPS = ["Cadrage", "Participants", "Injectables", "Objectifs", "Récapitulatif"];
type Part = { nom: string; email: string; role: string };
type Inj = { offset_minutes: number; titre: string; description: string };

export const TestWizard = ({ open, onClose, data, onCreated }: { open: boolean; onClose: () => void; data: ExData; onCreated: () => void }) => {
  const [step, setStep] = useState(0);
  const [type, setType] = useState<TestType>("EXERCICE_TABLE");
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [procId, setProcId] = useState("");
  const [risqueId, setRisqueId] = useState("");
  const [stratId, setStratId] = useState("");
  const [tlpt, setTlpt] = useState(false);
  const [parts, setParts] = useState<Part[]>([]);
  const [injs, setInjs] = useState<Inj[]>([]);
  const [objs, setObjs] = useState<string[]>([]);
  const [suggest, setSuggest] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const proc = data.processus.find((p) => p.id === procId);
  const risques = useMemo(() => data.risques.filter((r) => !procId || r.processus_id === procId || !r.processus_id), [data.risques, procId]);
  const strats = data.strategies.filter((s) => s.processus_id === procId);

  const reset = () => {
    setStep(0); setTitre(""); setDescription(""); setDate(""); setProcId(""); setRisqueId(""); setStratId("");
    setTlpt(false); setParts([]); setInjs([]); setObjs([]); setSuggest([]);
  };

  const canNext = step !== 0 || (titre.trim() && procId && date);

  const askAi = async () => {
    if (!proc) return;
    setAiLoading(true);
    try {
      const { data: res, error } = await functionsClient.functions.invoke("groq-suggest-test-objectives", {
        body: {
          type: TYPE_LABELS[type],
          processus: { nom: proc.name, criticite: proc.criticite, rto: proc.rto_hours },
          scenario: data.risques.find((r) => r.id === risqueId)?.title ?? null,
        },
      });
      if (error || !res?.objectifs?.length) throw new Error(res?.error ?? error?.message);
      setSuggest(res.objectifs.map((o: any) => o.libelle));
    } catch {
      toast({ title: "Suggestions IA indisponibles pour le moment", description: "Vous pouvez saisir vos objectifs manuellement." });
    } finally {
      setAiLoading(false);
    }
  };

  const create = async () => {
    setSaving(true);
    try {
      const { data: t, error } = await supabase.from("tests_pca").insert({
        type, titre: titre.trim(), description: description || null, date_planifiee: new Date(date).toISOString(),
        processus_id: procId, scenario_risque_id: risqueId || null, strategie_id: stratId || null, est_tlpt: tlpt,
      }).select().single();
      if (error) throw error;
      const id = (t as any).id;
      const ops: PromiseLike<any>[] = [];
      const p = parts.filter((x) => x.nom.trim());
      if (p.length) ops.push(supabase.from("test_participants").insert(p.map((x) => ({ ...x, test_id: id }))));
      const i = injs.filter((x) => x.titre.trim());
      if (i.length) ops.push(supabase.from("test_injectables").insert(i.map((x, k) => ({ ...x, ordre: k, test_id: id }))));
      const o = objs.filter((x) => x.trim());
      if (o.length) ops.push(supabase.from("test_objectifs").insert(o.map((libelle, k) => ({ libelle, ordre: k, test_id: id }))));
      const s = data.strategies.find((x) => x.id === stratId);
      ops.push(supabase.from("test_resultats").insert({ test_id: id, rto_cible_heures: proc?.rto_hours ?? null, rto_atteignable_heures: s?.rto_atteignable ?? null }));
      const results = await Promise.all(ops);
      const err = results.find((r) => r?.error);
      if (err) throw err.error;
      toast({ title: `Test ${(t as any).reference ?? ""} créé` });
      reset(); onCreated(); onClose();
    } catch (e: any) {
      toast({ title: "Erreur de création", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-[#F8F6F2]">
        <DialogHeader>
          <DialogTitle className="font-['Playfair_Display'] text-2xl text-[#172030]">Planifier un exercice</DialogTitle>
        </DialogHeader>
        <ol className="flex gap-1 mb-2">
          {STEPS.map((s, k) => (
            <li key={s} className="flex-1">
              <div className={`h-1 rounded-full ${k <= step ? "bg-[#2A5141]" : "bg-[#E8E4DC]"}`} />
              <span className={`text-[11px] uppercase tracking-wide ${k === step ? "text-[#172030] font-semibold" : "text-[#3B4454]/60"}`}>{s}</span>
            </li>
          ))}
        </ol>

        <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(23,32,48,0.08)] p-5 space-y-4 min-h-[280px]">
          {step === 0 && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(Object.keys(TYPE_LABELS) as TestType[]).map((k) => (
                  <button key={k} onClick={() => setType(k)}
                    className={`rounded-lg px-3 py-3 text-sm text-left transition ${type === k ? "bg-[#172030] text-white shadow" : "bg-[#F8F6F2] text-[#3B4454] hover:bg-[#EFEBE4]"}`}>
                    {TYPE_LABELS[k]}
                  </button>
                ))}
              </div>
              <Input placeholder="Titre de l'exercice" value={titre} onChange={(e) => setTitre(e.target.value)} />
              <div className="grid sm:grid-cols-2 gap-3">
                <Select value={procId} onValueChange={(v) => { setProcId(v); setStratId(""); }}>
                  <SelectTrigger><SelectValue placeholder="Processus testé" /></SelectTrigger>
                  <SelectContent>
                    {data.processus.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name} · {p.criticite}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
                <Select value={risqueId || "none"} onValueChange={(v) => setRisqueId(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Scénario de risque (optionnel)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun scénario</SelectItem>
                    {risques.map((r) => <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={stratId || "none"} onValueChange={(v) => setStratId(v === "none" ? "" : v)} disabled={!strats.length}>
                  <SelectTrigger><SelectValue placeholder={strats.length ? "Stratégie testée" : "Aucune stratégie associée"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune</SelectItem>
                    {strats.map((s) => <SelectItem key={s.id} value={s.id}>RTO atteignable {s.rto_atteignable ?? "?"} h · {s.statut}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Textarea placeholder="Description / périmètre" value={description} onChange={(e) => setDescription(e.target.value)} />
              <label className="flex items-center gap-3 text-sm text-[#3B4454]">
                <Switch checked={tlpt} onCheckedChange={setTlpt} /> Test de pénétration fondé sur la menace (TLPT — DORA)
              </label>
            </>
          )}

          {step === 1 && (
            <>
              {parts.map((p, k) => (
                <div key={k} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                  {(["nom", "email", "role"] as const).map((f) => (
                    <Input key={f} placeholder={f === "nom" ? "Nom" : f === "email" ? "Email" : "Rôle"} value={p[f]}
                      onChange={(e) => setParts(parts.map((x, j) => (j === k ? { ...x, [f]: e.target.value } : x)))} />
                  ))}
                  <Button variant="ghost" size="icon" onClick={() => setParts(parts.filter((_, j) => j !== k))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button variant="outline" onClick={() => setParts([...parts, { nom: "", email: "", role: "" }])}><Plus className="h-4 w-4 mr-1" />Participant</Button>
            </>
          )}

          {step === 2 && (
            <div className="relative pl-6">
              <div className="absolute left-2 top-1 bottom-1 w-px bg-[#E5E2DD]" />
              {[...injs].map((inj, k) => (
                <div key={k} className="relative mb-3">
                  <span className="absolute -left-[21px] top-3 h-3 w-3 rounded-full bg-[#2A5141]" />
                  <div className="grid grid-cols-[90px_1fr_auto] gap-2">
                    <Input type="number" value={inj.offset_minutes} title="T0 + minutes"
                      onChange={(e) => setInjs(injs.map((x, j) => (j === k ? { ...x, offset_minutes: Number(e.target.value) } : x)))} />
                    <Input placeholder="Événement injecté" value={inj.titre}
                      onChange={(e) => setInjs(injs.map((x, j) => (j === k ? { ...x, titre: e.target.value } : x)))} />
                    <Button variant="ghost" size="icon" onClick={() => setInjs(injs.filter((_, j) => j !== k))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <Textarea className="mt-1 min-h-[50px]" placeholder="Détail" value={inj.description}
                    onChange={(e) => setInjs(injs.map((x, j) => (j === k ? { ...x, description: e.target.value } : x)))} />
                </div>
              ))}
              <Button variant="outline" onClick={() => setInjs([...injs, { offset_minutes: (injs.at(-1)?.offset_minutes ?? -15) + 15, titre: "", description: "" }].sort((a, b) => a.offset_minutes - b.offset_minutes))}>
                <Plus className="h-4 w-4 mr-1" />Injectable (T0 + min)
              </Button>
            </div>
          )}

          {step === 3 && (
            <>
              <div className="flex justify-between items-center">
                <p className="text-sm text-[#3B4454]">Objectifs mesurables évalués à la clôture.</p>
                <Button variant="outline" className="border-[#2A5141] text-[#2A5141]" onClick={askAi} disabled={aiLoading}>
                  {aiLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}Suggérer des objectifs
                </Button>
              </div>
              {suggest.length > 0 && (
                <div className="rounded-lg bg-[#FCFBF8] border-l-[3px] border-[#2A5141] p-3 space-y-2 shadow-sm">
                  {suggest.map((s, k) => (
                    <div key={k} className="flex gap-2 items-start text-sm">
                      <span className="flex-1 text-[#172030]">{s}</span>
                      <Button size="sm" variant="ghost" onClick={() => { setObjs([...objs, s]); setSuggest(suggest.filter((_, j) => j !== k)); }}>Accepter</Button>
                      <Button size="sm" variant="ghost" onClick={() => setSuggest(suggest.filter((_, j) => j !== k))}>Ignorer</Button>
                    </div>
                  ))}
                </div>
              )}
              {objs.map((o, k) => (
                <div key={k} className="flex gap-2">
                  <span className="text-xs font-semibold text-[#2A5141] w-6 pt-2">O{k + 1}</span>
                  <Input value={o} onChange={(e) => setObjs(objs.map((x, j) => (j === k ? e.target.value : x)))} />
                  <Button variant="ghost" size="icon" onClick={() => setObjs(objs.filter((_, j) => j !== k))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button variant="outline" onClick={() => setObjs([...objs, ""])}><Plus className="h-4 w-4 mr-1" />Objectif</Button>
            </>
          )}

          {step === 4 && (
            <dl className="grid grid-cols-2 gap-y-3 text-sm">
              <dt className="text-[#3B4454]/70">Type</dt><dd>{TYPE_LABELS[type]}{tlpt && " · TLPT"}</dd>
              <dt className="text-[#3B4454]/70">Titre</dt><dd className="font-medium">{titre}</dd>
              <dt className="text-[#3B4454]/70">Processus</dt>
              <dd>{proc?.name} <span className="ml-1 px-2 py-0.5 rounded text-xs" style={{ background: CRIT_COLORS[proc?.criticite ?? "Mineur"] }}>{proc?.criticite}</span></dd>
              <dt className="text-[#3B4454]/70">Date</dt><dd>{date && new Date(date).toLocaleString("fr-FR")}</dd>
              <dt className="text-[#3B4454]/70">RTO cible</dt><dd>{proc?.rto_hours ?? "—"} h</dd>
              <dt className="text-[#3B4454]/70">Participants / Injectables / Objectifs</dt>
              <dd>{parts.length} / {injs.length} / {objs.filter(Boolean).length}</dd>
            </dl>
          )}
        </div>

        <div className="flex justify-between">
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}><ChevronLeft className="h-4 w-4 mr-1" />Précédent</Button>
          {step < 4 ? (
            <Button className="bg-[#2A5141] hover:bg-[#21402F]" disabled={!canNext} onClick={() => setStep(step + 1)}>Suivant<ChevronRight className="h-4 w-4 ml-1" /></Button>
          ) : (
            <Button className="bg-[#2A5141] hover:bg-[#21402F]" disabled={saving} onClick={create}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}Créer le test
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
