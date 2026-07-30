import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertTriangle, CalendarClock, Pencil, Plus, Search, Trash2 } from "lucide-react";
import type { RiskData } from "../useRiskData";
import {
  OPTIONS_TRAITEMENT, OptionTraitement, PlanTraitement, STATUTS_MESURE, StatutMesure, fmtDate,
} from "../riskModel";

const STATUT_STYLE: Record<StatutMesure, string> = {
  "À faire": "bg-[#172030]/5 text-[#172030]/70 border-[#172030]/15",
  "En cours": "bg-amber-50 text-amber-700 border-amber-200",
  "Terminé": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Acceptée": "bg-sky-50 text-sky-700 border-sky-200",
};

const OPTION_STYLE: Record<OptionTraitement, string> = {
  "Réduire": "bg-[#2A5141]/10 text-[#2A5141] border-[#2A5141]/20",
  "Transférer": "bg-sky-50 text-sky-700 border-sky-200",
  "Accepter": "bg-amber-50 text-amber-700 border-amber-200",
  "Éviter": "bg-rose-50 text-rose-700 border-rose-200",
};

const isLate = (p: PlanTraitement) =>
  !!p.echeance && p.statut !== "Terminé" && p.statut !== "Acceptée" && new Date(p.echeance) < new Date();

const emptyPlan = (risqueId = ""): Partial<PlanTraitement> => ({
  risque_id: risqueId,
  option_traitement: "Réduire",
  mesure: "",
  description: "",
  type_mesure: "Préventive",
  responsable: "",
  echeance: "",
  cout_estime: 0,
  charge_jh: 0,
  efficacite_attendue: 3,
  avancement: 0,
  statut: "À faire",
  commentaire: "",
});

export const PlansTab = ({ data }: { data: RiskData }) => {
  const [q, setQ] = useState("");
  const [filtreStatut, setFiltreStatut] = useState<string>("Tous");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<PlanTraitement>>(emptyPlan());

  const riskById = useMemo(
    () => Object.fromEntries(data.risques.map((r) => [r.id, r])),
    [data.risques]
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.plans.filter((p) => {
      const r = riskById[p.risque_id];
      const okQ =
        !s ||
        p.mesure?.toLowerCase().includes(s) ||
        p.responsable?.toLowerCase().includes(s) ||
        r?.title?.toLowerCase().includes(s) ||
        r?.reference?.toLowerCase().includes(s);
      const okS = filtreStatut === "Tous" || p.statut === filtreStatut;
      return okQ && okS;
    });
  }, [data.plans, q, filtreStatut, riskById]);

  const retards = data.plans.filter(isLate);
  const totalCout = data.plans.reduce((s, p) => s + (p.cout_estime ?? 0), 0);
  const avgAvancement = data.plans.length
    ? Math.round(data.plans.reduce((s, p) => s + (p.avancement ?? 0), 0) / data.plans.length)
    : 0;

  const openNew = () => { setDraft(emptyPlan(data.risques[0]?.id ?? "")); setOpen(true); };
  const openEdit = (p: PlanTraitement) => { setDraft({ ...p, echeance: p.echeance ?? "" }); setOpen(true); };

  const submit = async () => {
    const payload: Partial<PlanTraitement> = {
      ...draft,
      echeance: draft.echeance ? draft.echeance : null,
      cout_estime: Number(draft.cout_estime ?? 0),
      charge_jh: Number(draft.charge_jh ?? 0),
      avancement: Number(draft.avancement ?? 0),
    };
    await data.savePlan(payload);
    setOpen(false);
  };

  const Kpi = ({ label, value, tone }: { label: string; value: string; tone?: string }) => (
    <Card className="border-[#172030]/10">
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-[#172030]/50">{label}</p>
        <p className={`font-serif text-2xl mt-1 ${tone ?? "text-[#172030]"}`}>{value}</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Mesures" value={String(data.plans.length)} />
        <Kpi label="En retard" value={String(retards.length)} tone={retards.length ? "text-rose-600" : "text-[#172030]"} />
        <Kpi label="Avancement moyen" value={`${avgAvancement} %`} tone="text-[#2A5141]" />
        <Kpi label="Coût total estimé" value={`${totalCout.toLocaleString("fr-FR")} €`} />
      </div>

      {retards.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4">
          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-rose-800">
              {retards.length} mesure{retards.length > 1 ? "s" : ""} en retard
            </p>
            <p className="text-sm text-rose-700">
              L'échéance est dépassée et le plan n'est ni terminé ni accepté.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#172030]/40" />
          <Input className="pl-9" placeholder="Rechercher une mesure, un risque, un responsable…"
            value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={filtreStatut} onValueChange={setFiltreStatut}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Tous">Tous les statuts</SelectItem>
            {STATUTS_MESURE.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button className="bg-[#2A5141] hover:bg-[#2A5141]/90" onClick={openNew} disabled={!data.risques.length}>
          <Plus className="h-4 w-4 mr-1.5" /> Nouvelle mesure
        </Button>
      </div>

      <div className="space-y-3">
        {filtered.map((p) => {
          const r = riskById[p.risque_id];
          const late = isLate(p);
          return (
            <Card key={p.id} className={`border ${late ? "border-rose-300 bg-rose-50/40" : "border-[#172030]/10"}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={OPTION_STYLE[p.option_traitement]}>{p.option_traitement}</Badge>
                      <Badge variant="outline" className={STATUT_STYLE[p.statut]}>{p.statut}</Badge>
                      {late && (
                        <Badge variant="outline" className="bg-rose-100 text-rose-700 border-rose-300">
                          <AlertTriangle className="h-3 w-3 mr-1" /> En retard
                        </Badge>
                      )}
                    </div>
                    <p className="font-serif text-[#172030] text-lg mt-2">{p.mesure}</p>
                    <p className="text-xs text-[#172030]/55 mt-0.5">
                      {r ? `${r.reference ?? ""} ${r.title}`.trim() : "Risque supprimé"}
                    </p>
                    {p.description && <p className="text-sm text-[#172030]/70 mt-2">{p.description}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => data.deleteRow("plans_traitement", p.id)}>
                      <Trash2 className="h-4 w-4 text-rose-600" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-4 text-sm">
                  <div>
                    <p className="text-xs text-[#172030]/50">Responsable</p>
                    <p className="text-[#172030]">{p.responsable || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#172030]/50">Échéance</p>
                    <p className={`flex items-center gap-1 ${late ? "text-rose-700 font-medium" : "text-[#172030]"}`}>
                      <CalendarClock className="h-3.5 w-3.5" /> {fmtDate(p.echeance)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#172030]/50">Coût estimé</p>
                    <p className="text-[#172030]">{(p.cout_estime ?? 0).toLocaleString("fr-FR")} €</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#172030]/50">Charge</p>
                    <p className="text-[#172030]">{p.charge_jh ?? 0} j/h</p>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-[#172030]/60 mb-1">
                    <span>Avancement</span><span>{p.avancement ?? 0} %</span>
                  </div>
                  <Progress
                    value={p.avancement ?? 0}
                    indicatorClassName={late ? "bg-rose-500" : "bg-[#2A5141]"}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <Card className="border-dashed border-[#172030]/15">
            <CardContent className="p-10 text-center text-[#172030]/50">
              Aucune mesure de traitement pour l'instant.
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-[#172030]">
              {draft.id ? "Modifier la mesure" : "Nouvelle mesure de traitement"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Risque concerné</Label>
              <Select value={draft.risque_id ?? ""} onValueChange={(v) => setDraft({ ...draft, risque_id: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un risque" /></SelectTrigger>
                <SelectContent>
                  {data.risques.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {(r.reference ? r.reference + " — " : "") + r.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Mesure</Label>
                <Input value={draft.mesure ?? ""} onChange={(e) => setDraft({ ...draft, mesure: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Description</Label>
                <Textarea rows={3} value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </div>
              <div>
                <Label>Option de traitement</Label>
                <Select value={draft.option_traitement ?? "Réduire"}
                  onValueChange={(v) => setDraft({ ...draft, option_traitement: v as OptionTraitement })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{OPTIONS_TRAITEMENT.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Type de mesure</Label>
                <Select value={draft.type_mesure ?? "Préventive"} onValueChange={(v) => setDraft({ ...draft, type_mesure: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Préventive", "Détective", "Corrective", "Organisationnelle", "Technique"].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Responsable</Label>
                <Input value={draft.responsable ?? ""} onChange={(e) => setDraft({ ...draft, responsable: e.target.value })} />
              </div>
              <div>
                <Label>Échéance</Label>
                <Input type="date" value={(draft.echeance ?? "").slice(0, 10)}
                  onChange={(e) => setDraft({ ...draft, echeance: e.target.value })} />
              </div>
              <div>
                <Label>Coût estimé (€)</Label>
                <Input type="number" value={draft.cout_estime ?? 0}
                  onChange={(e) => setDraft({ ...draft, cout_estime: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Charge (j/h)</Label>
                <Input type="number" value={draft.charge_jh ?? 0}
                  onChange={(e) => setDraft({ ...draft, charge_jh: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Statut</Label>
                <Select value={draft.statut ?? "À faire"} onValueChange={(v) => setDraft({ ...draft, statut: v as StatutMesure })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUTS_MESURE.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Avancement : {draft.avancement ?? 0} %</Label>
                <input type="range" min={0} max={100} step={5} className="w-full accent-[#2A5141] mt-3"
                  value={draft.avancement ?? 0}
                  onChange={(e) => setDraft({ ...draft, avancement: Number(e.target.value) })} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button className="bg-[#2A5141] hover:bg-[#2A5141]/90"
              disabled={!draft.mesure || !draft.risque_id} onClick={submit}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
