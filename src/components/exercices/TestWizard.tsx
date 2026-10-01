// Wizard de création d'un test PCA — refonte design (stepper pastilles + cards icônées)
import { useMemo, useState } from "react";
import {
  Loader2, Plus, Sparkles, Trash2, ChevronLeft, ChevronRight, Check,
  FileText, Users, Radio, Target as TargetIcon, ClipboardCheck,
  ShieldAlert, Activity, Server, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/db";
import { functionsClient } from "@/integrations/supabase/functionsClient";
import { cn } from "@/lib/utils";
import { ExData, TestType, TYPE_LABELS, CRIT_COLORS, CRIT_ACCENT } from "./useExercices";

const STEPS = [
  { id: "cadrage", label: "Cadrage", icon: FileText },
  { id: "participants", label: "Participants", icon: Users },
  { id: "injectables", label: "Injectables", icon: Radio },
  { id: "objectifs", label: "Objectifs", icon: TargetIcon },
  { id: "recap", label: "Récapitulatif", icon: ClipboardCheck },
];

const TYPE_META: Record<TestType, { icon: any; desc: string }> = {
  TEST_PROCEDURE: { icon: FileText, desc: "Vérification documentaire d'une procédure" },
  EXERCICE_TABLE: { icon: Users, desc: "Discussion guidée en salle, sans activation réelle" },
  TEST_IT: { icon: Server, desc: "Bascule technique, restauration, PRA" },
  SIMULATION_COMPLETE: { icon: Activity, desc: "Crise scénarisée de bout en bout" },
};

type Part = { nom: string; email: string; role: string };
type Inj = { offset_minutes: number; titre: string; description: string };

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-[11px] uppercase tracking-wider text-[#3B4454]/70 mb-1.5 font-medium">{children}</label>
);

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
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto bg-[#F8F6F2] p-0 gap-0">
        {/* Header sombre */}
        <div className="relative bg-[#172030] text-white px-7 pt-6 pb-5 overflow-hidden">
          <span className="absolute right-3 -top-4 font-['Playfair_Display'] italic text-[100px] leading-none text-white/[0.05] select-none pointer-events-none">
            M7
          </span>
          <DialogHeader className="relative">
            <DialogTitle className="font-['Playfair_Display'] text-2xl text-white">Planifier un exercice</DialogTitle>
            <DialogDescription className="text-white/60 text-sm">
              Étape {step + 1} sur {STEPS.length} · {STEPS[step].label}
            </DialogDescription>
          </DialogHeader>

          {/* Stepper pastilles */}
          <div className="relative flex items-center gap-1 mt-5">
            {STEPS.map((s, k) => {
              const done = k < step;
              const active = k === step;
              const Icon = s.icon;
              return (
                <div key={s.id} className="flex items-center gap-1 flex-1">
                  <div className={cn(
                    "flex items-center justify-center h-7 w-7 rounded-full transition-all",
                    done ? "bg-[#2A5141] text-white" : active ? "bg-white text-[#172030] ring-2 ring-[#2A5141]" : "bg-white/10 text-white/40"
                  )}>
                    {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  </div>
                  <span className={cn("text-[10px] uppercase tracking-wider hidden sm:block",
                    active ? "text-white font-semibold" : "text-white/40")}>{s.label}</span>
                  {k < STEPS.length - 1 && (
                    <div className={cn("flex-1 h-px mx-1", done ? "bg-[#2A5141]" : "bg-white/15")} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Contenu */}
        <div className="p-6 space-y-4 min-h-[320px]">
          {step === 0 && (
            <>
              <div>
                <FieldLabel>Type d'exercice</FieldLabel>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {(Object.keys(TYPE_LABELS) as TestType[]).map((k) => {
                    const Meta = TYPE_META[k];
                    const Icon = Meta.icon;
                    const active = type === k;
                    return (
                      <button key={k} onClick={() => setType(k)} type="button"
                        className={cn(
                          "group rounded-xl p-3 text-left transition-all border",
                          active
                            ? "bg-[#172030] text-white border-[#172030] shadow-[0_4px_16px_rgba(23,32,48,0.20)]"
                            : "bg-white text-[#3B4454] border-transparent hover:border-[#E8E4DC] hover:shadow-sm"
                        )}>
                        <Icon className={cn("h-5 w-5 mb-2", active ? "text-[#2A5141] brightness-200" : "text-[#2A5141]")} />
                        <p className={cn("text-xs font-semibold leading-tight", active && "text-white")}>{TYPE_LABELS[k]}</p>
                        <p className={cn("text-[10px] mt-1 leading-snug", active ? "text-white/60" : "text-[#3B4454]/60")}>{Meta.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <FieldLabel>Titre de l'exercice</FieldLabel>
                <Input placeholder="Ex : Test de bascule PRA — Datacenter principal" value={titre} onChange={(e) => setTitre(e.target.value)} />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Processus testé</FieldLabel>
                  <Select value={procId} onValueChange={(v) => { setProcId(v); setStratId(""); }}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      {data.processus.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ background: CRIT_ACCENT[p.criticite] }} />
                            {p.name} <span className="text-[#3B4454]/50">· {p.criticite}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <FieldLabel>Date & heure prévues</FieldLabel>
                  <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="bg-white" />
                </div>
                <div>
                  <FieldLabel>Scénario de risque</FieldLabel>
                  <Select value={risqueId || "none"} onValueChange={(v) => setRisqueId(v === "none" ? "" : v)}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Optionnel" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun scénario lié</SelectItem>
                      {risques.map((r) => <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <FieldLabel>Stratégie de continuité</FieldLabel>
                  <Select value={stratId || "none"} onValueChange={(v) => setStratId(v === "none" ? "" : v)} disabled={!strats.length}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder={strats.length ? "Sélectionner" : "Aucune associée"} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune</SelectItem>
                      {strats.map((s) => <SelectItem key={s.id} value={s.id}>RTO {s.rto_atteignable ?? "?"} h · {s.statut}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <FieldLabel>Description / périmètre</FieldLabel>
                <Textarea placeholder="Objectif global, périmètre inclus/exclus, contraintes…" value={description} onChange={(e) => setDescription(e.target.value)} className="bg-white min-h-[70px]" />
              </div>

              <label className="flex items-start gap-3 rounded-xl bg-white border border-[#E8E4DC] p-3.5 cursor-pointer hover:border-[#2A5141]/30 transition">
                <Switch checked={tlpt} onCheckedChange={setTlpt} className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-[#172030] flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5 text-[#C62828]" />
                    Test de pénétration fondé sur la menace (TLPT)
                  </p>
                  <p className="text-xs text-[#3B4454]/70 mt-0.5">Requis par DORA Art. 26 pour les entités assujetties — cycle de 3 ans minimum.</p>
                </div>
              </label>
            </>
          )}

          {step === 1 && (
            <>
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="text-sm font-medium text-[#172030]">Participants</p>
                  <p className="text-xs text-[#3B4454]/60">Cellule de crise, parties prenantes, observateurs</p>
                </div>
              </div>
              <div className="space-y-2">
                {parts.map((p, k) => (
                  <div key={k} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center bg-white rounded-lg p-2 border border-[#E8E4DC]">
                    {(["nom", "email", "role"] as const).map((f) => (
                      <Input key={f} placeholder={f === "nom" ? "Nom" : f === "email" ? "Email" : "Rôle"} value={p[f]}
                        className="border-0 shadow-none focus-visible:ring-0 bg-transparent"
                        onChange={(e) => setParts(parts.map((x, j) => (j === k ? { ...x, [f]: e.target.value } : x)))} />
                    ))}
                    <Button variant="ghost" size="icon" onClick={() => setParts(parts.filter((_, j) => j !== k))}><Trash2 className="h-4 w-4 text-[#3B4454]/50" /></Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="border-dashed" onClick={() => setParts([...parts, { nom: "", email: "", role: "" }])}>
                <Plus className="h-4 w-4 mr-1" />Ajouter un participant
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <p className="text-sm font-medium text-[#172030]">Injectables — timeline T0</p>
                <p className="text-xs text-[#3B4454]/60">Événements révélés progressivement pendant l'exercice</p>
              </div>
              <div className="relative pl-6">
                <div className="absolute left-2 top-1 bottom-1 w-px bg-[#E5E2DD]" />
                {injs.map((inj, k) => (
                  <div key={k} className="relative mb-3">
                    <span className="absolute -left-[21px] top-3.5 h-3 w-3 rounded-full bg-[#2A5141] ring-4 ring-[#F8F6F2]" />
                    <div className="rounded-lg bg-white border border-[#E8E4DC] p-3 space-y-2">
                      <div className="grid grid-cols-[100px_1fr_auto] gap-2">
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[#3B4454]/50 pointer-events-none">T0+</span>
                          <Input type="number" value={inj.offset_minutes}
                            className="pl-9 pr-6"
                            onChange={(e) => setInjs(injs.map((x, j) => (j === k ? { ...x, offset_minutes: Number(e.target.value) } : x)))} />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#3B4454]/50 pointer-events-none">min</span>
                        </div>
                        <Input placeholder="Événement injecté" value={inj.titre}
                          onChange={(e) => setInjs(injs.map((x, j) => (j === k ? { ...x, titre: e.target.value } : x)))} />
                        <Button variant="ghost" size="icon" onClick={() => setInjs(injs.filter((_, j) => j !== k))}><Trash2 className="h-4 w-4 text-[#3B4454]/50" /></Button>
                      </div>
                      <Textarea className="min-h-[44px] text-sm" placeholder="Détail (optionnel)" value={inj.description}
                        onChange={(e) => setInjs(injs.map((x, j) => (j === k ? { ...x, description: e.target.value } : x)))} />
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="border-dashed"
                onClick={() => setInjs([...injs, { offset_minutes: (injs.at(-1)?.offset_minutes ?? -15) + 15, titre: "", description: "" }].sort((a, b) => a.offset_minutes - b.offset_minutes))}>
                <Plus className="h-4 w-4 mr-1" />Ajouter un injectable
              </Button>
            </>
          )}

          {step === 3 && (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[#172030]">Objectifs mesurables</p>
                  <p className="text-xs text-[#3B4454]/60">Évalués à la clôture — chaque échec doit déclencher une action corrective</p>
                </div>
                <Button variant="outline" className="border-[#2A5141] text-[#2A5141] shrink-0 hover:bg-[#2A5141] hover:text-white transition"
                  onClick={askAi} disabled={aiLoading || !proc}>
                  {aiLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                  Suggérer via IA
                </Button>
              </div>

              {suggest.length > 0 && (
                <div className="rounded-xl bg-[#172030] text-white p-3.5 space-y-2 relative overflow-hidden">
                  <p className="text-[10px] uppercase tracking-wider text-[#2A5141] brightness-200 font-semibold flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3" /> Suggestions IA
                  </p>
                  {suggest.map((s, k) => (
                    <div key={k} className="flex gap-2 items-start text-sm group">
                      <span className="flex-1 text-white/90 text-[13px] leading-snug">{s}</span>
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="ghost" className="h-7 text-white hover:bg-[#2A5141] hover:text-white"
                          onClick={() => { setObjs([...objs, s]); setSuggest(suggest.filter((_, j) => j !== k)); }}>
                          Accepter
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-white/50 hover:text-white"
                          onClick={() => setSuggest(suggest.filter((_, j) => j !== k))}>
                          Ignorer
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                {objs.map((o, k) => (
                  <div key={k} className="flex gap-2 items-start bg-white rounded-lg border border-[#E8E4DC] p-2">
                    <span className="text-xs font-bold text-[#2A5141] w-7 pt-2.5 text-center">O{k + 1}</span>
                    <Textarea value={o} className="min-h-[44px] text-sm border-0 shadow-none focus-visible:ring-0 bg-transparent flex-1"
                      onChange={(e) => setObjs(objs.map((x, j) => (j === k ? e.target.value : x)))} />
                    <Button variant="ghost" size="icon" onClick={() => setObjs(objs.filter((_, j) => j !== k))}><Trash2 className="h-4 w-4 text-[#3B4454]/50" /></Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="border-dashed" onClick={() => setObjs([...objs, ""])}>
                <Plus className="h-4 w-4 mr-1" />Ajouter un objectif
              </Button>
            </>
          )}

          {step === 4 && (
            <>
              <div className="rounded-xl bg-white border border-[#E8E4DC] p-5">
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 text-sm">
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-[#3B4454]/60">Type</dt>
                    <dd className="text-[#172030] font-medium mt-0.5">{TYPE_LABELS[type]}{tlpt && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-[#172030] text-white">TLPT</span>}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-[#3B4454]/60">Titre</dt>
                    <dd className="text-[#172030] font-medium mt-0.5">{titre}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-[#3B4454]/60">Processus</dt>
                    <dd className="mt-0.5 flex items-center gap-2">
                      <span>{proc?.name}</span>
                      {proc && <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: CRIT_COLORS[proc.criticite], color: CRIT_ACCENT[proc.criticite] }}>{proc.criticite}</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-[#3B4454]/60">Date</dt>
                    <dd className="text-[#172030] mt-0.5">{date && new Date(date).toLocaleString("fr-FR")}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-[#3B4454]/60">RTO cible</dt>
                    <dd className="text-[#172030] font-medium mt-0.5 tabular-nums">{proc?.rto_hours ?? "—"} h</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-[#3B4454]/60">Contenu</dt>
                    <dd className="text-[#172030] mt-0.5 tabular-nums">{parts.length} participant(s) · {injs.length} injectable(s) · {objs.filter(Boolean).length} objectif(s)</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-xl bg-[#FCFBF8] border-l-[3px] border-[#2A5141] p-3.5">
                <p className="text-xs text-[#3B4454] flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-[#2A5141] shrink-0 mt-0.5" />
                  Le test sera créé en statut <strong className="text-[#172030]">PLANIFIÉ</strong>. La clôture sera bloquée tant que tous les objectifs n'auront pas été évalués — et toute évaluation négative exigera une action corrective.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#E8E4DC] bg-[#FCFBF8]">
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
            <ChevronLeft className="h-4 w-4 mr-1" />Précédent
          </Button>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-[#3B4454]/50 tabular-nums hidden sm:block">{step + 1} / {STEPS.length}</span>
            {step < 4 ? (
              <Button className="bg-[#2A5141] hover:bg-[#21402F] px-6" disabled={!canNext} onClick={() => setStep(step + 1)}>
                Suivant<ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button className="bg-[#2A5141] hover:bg-[#21402F] px-6 shadow-[0_2px_8px_rgba(42,81,65,0.30)]" disabled={saving} onClick={create}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}Créer le test
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};