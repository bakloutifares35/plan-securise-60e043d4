import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, ArrowRight, Check, AlertTriangle, Plus, Trash2, ShieldAlert } from "lucide-react";
import { useBia } from "@/contexts/BiaContext";
import { useGovernance } from "@/contexts/GovernanceContext";
import {
  PERIODS, AXIS_LABELS, RESOURCE_LABELS, emptyImpacts, computeMaxScore, periodMaxScore,
  scoreToCriticality, criticalityColor, scoreCellColor,
  type Process, type ImpactAxis, type TimePeriod, type Resource, type ResourceType,
} from "@/data/bia";
import { toast } from "@/hooks/use-toast";

const STEPS = ["Identification", "Évaluation", "Objectifs", "Ressources", "Validation"];

const newProcess = (): Process => ({
  id: `pr_${Date.now()}`,
  name: "",
  entityId: "",
  department: "",
  owner: "",
  description: "",
  status: "Actif",
  impacts: emptyImpacts(),
  rto: 24,
  rpo: 4,
  mtpd: 72,
  mbco: 80,
  resources: [],
  dependsOn: [],
  lastUpdated: new Date().toISOString().slice(0, 10),
});

export const BiaWizard = ({ processId, onDone }: { processId?: string; onDone: () => void }) => {
  const { processes, upsertProcess } = useBia();
  const { entities } = useGovernance();
  const initial = useMemo(
    () => processes.find((p) => p.id === processId) ?? newProcess(),
    [processId, processes]
  );
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Process>(initial);

  const update = <K extends keyof Process>(key: K, value: Process[K]) => setData((d) => ({ ...d, [key]: value }));

  const setImpact = (period: TimePeriod, axis: ImpactAxis, value: number) =>
    setData((d) => ({ ...d, impacts: { ...d.impacts, [period]: { ...d.impacts[period], [axis]: value } } }));

  const globalScore = computeMaxScore(data.impacts);
  const criticality = scoreToCriticality(globalScore);
  const rtoExceedsMtpd = data.rto > data.mtpd;
  const requiresPca = globalScore >= 3;

  const canNext = () => {
    if (step === 0) return data.name && data.entityId && data.department && data.owner;
    if (step === 2) return !rtoExceedsMtpd;
    return true;
  };

  const submit = () => {
    upsertProcess({ ...data, lastUpdated: new Date().toISOString().slice(0, 10) });
    toast({ title: "BIA enregistré", description: `${data.name} — Criticité: ${criticality}` });
    onDone();
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Formulaire BIA</h1>
          <p className="text-muted-foreground mt-1">{processId ? "Modifier l'analyse d'impact" : "Nouvelle analyse d'impact métier"}</p>
        </div>
        <Button variant="outline" onClick={onDone}><ArrowLeft className="h-4 w-4 mr-2" />Retour</Button>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2 shrink-0">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
              i < step ? "bg-success text-success-foreground" : i === step ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
            }`}>{i < step ? <Check className="h-4 w-4" /> : i + 1}</div>
            <span className={`text-sm ${i === step ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{s}</span>
            {i < STEPS.length - 1 && <div className="w-6 h-px bg-border" />}
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          {step === 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Nom du processus *</Label>
                <Input value={data.name} onChange={(e) => update("name", e.target.value)} placeholder="Ex: Paiements interbancaires" />
              </div>
              <div>
                <Label>Entité *</Label>
                <Select value={data.entityId} onValueChange={(v) => update("entityId", v)}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner une entité" /></SelectTrigger>
                  <SelectContent>
                    {entities.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Département *</Label>
                <Input value={data.department} onChange={(e) => update("department", e.target.value)} />
              </div>
              <div>
                <Label>Responsable *</Label>
                <Input value={data.owner} onChange={(e) => update("owner", e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label>Description</Label>
                <Textarea value={data.description} onChange={(e) => update("description", e.target.value)} rows={3} />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <p className="text-sm text-muted-foreground">Évaluez l'impact (1 = négligeable, 5 = catastrophique) pour chaque axe et chaque période d'indisponibilité.</p>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Criticité globale:</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${criticalityColor(criticality)}`}>{criticality} ({globalScore}/5)</span>
                </div>
              </div>
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Axe / Période</TableHead>
                      {PERIODS.map((p) => <TableHead key={p.id} className="text-center">{p.label}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(Object.keys(AXIS_LABELS) as ImpactAxis[]).map((axis) => (
                      <TableRow key={axis}>
                        <TableCell className="font-medium">{AXIS_LABELS[axis]}</TableCell>
                        {PERIODS.map((p) => (
                          <TableCell key={p.id} className="text-center p-1">
                            <Select value={String(data.impacts[p.id][axis])} onValueChange={(v) => setImpact(p.id, axis, Number(v))}>
                              <SelectTrigger className="h-9 w-16 mx-auto"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {[0, 1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {requiresPca && (
                <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                  <ShieldAlert className="h-4 w-4 text-warning mt-0.5" />
                  <p>Score ≥ 3 : ce processus nécessite la mise en place d'un PCA dédié.</p>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>RTO — Recovery Time Objective (heures)</Label>
                  <Input type="number" min={0} value={data.rto} onChange={(e) => update("rto", Number(e.target.value))} />
                  <p className="text-xs text-muted-foreground mt-1">Délai maximal de reprise visé.</p>
                </div>
                <div>
                  <Label>RPO — Recovery Point Objective (heures)</Label>
                  <Input type="number" min={0} value={data.rpo} onChange={(e) => update("rpo", Number(e.target.value))} />
                  <p className="text-xs text-muted-foreground mt-1">Perte de données maximale acceptée.</p>
                </div>
                <div>
                  <Label>MTPD — Maximum Tolerable Period of Disruption (heures)</Label>
                  <Input type="number" min={0} value={data.mtpd} onChange={(e) => update("mtpd", Number(e.target.value))} />
                </div>
                <div>
                  <Label>MBCO — Minimum Business Continuity Objective (%)</Label>
                  <Input type="number" min={0} max={100} value={data.mbco} onChange={(e) => update("mbco", Number(e.target.value))} />
                </div>
              </div>
              {rtoExceedsMtpd && (
                <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                  <p className="text-foreground">Erreur : le RTO ({data.rto}h) ne peut pas être supérieur au MTPD ({data.mtpd}h).</p>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <ResourcesEditor resources={data.resources} onChange={(r) => update("resources", r)} />
          )}

          {step === 4 && (
            <SummaryView data={data} entityName={entities.find((e) => e.id === data.entityId)?.name ?? "—"} criticality={criticality} score={globalScore} />
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />Précédent
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext()}>
            Suivant <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={submit}><Check className="h-4 w-4 mr-2" />Enregistrer le BIA</Button>
        )}
      </div>
    </div>
  );
};

const ResourcesEditor = ({ resources, onChange }: { resources: Resource[]; onChange: (r: Resource[]) => void }) => {
  const [draft, setDraft] = useState<Resource>({
    id: "", type: "IT", name: "", quantity: 1, substitutability: "Moyenne",
  });
  const add = () => {
    if (!draft.name) return;
    onChange([...resources, { ...draft, id: `r_${Date.now()}` }]);
    setDraft({ id: "", type: "IT", name: "", quantity: 1, substitutability: "Moyenne" });
  };
  const remove = (id: string) => onChange(resources.filter((r) => r.id !== id));
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-5">
        <div>
          <Label className="text-xs">Type</Label>
          <Select value={draft.type} onValueChange={(v) => setDraft({ ...draft, type: v as ResourceType })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(RESOURCE_LABELS) as ResourceType[]).map((t) => (
                <SelectItem key={t} value={t}>{RESOURCE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2">
          <Label className="text-xs">Nom</Label>
          <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Quantité</Label>
          <Input type="number" min={1} value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: Number(e.target.value) })} />
        </div>
        <div>
          <Label className="text-xs">Substituabilité</Label>
          <Select value={draft.substitutability} onValueChange={(v) => setDraft({ ...draft, substitutability: v as Resource["substitutability"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["Aucune", "Faible", "Moyenne", "Forte"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button onClick={add} variant="secondary" size="sm"><Plus className="h-4 w-4 mr-2" />Ajouter une ressource</Button>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead><TableHead>Nom</TableHead><TableHead>Quantité</TableHead>
            <TableHead>Substituabilité</TableHead><TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {resources.map((r) => (
            <TableRow key={r.id}>
              <TableCell><Badge variant="outline">{RESOURCE_LABELS[r.type]}</Badge></TableCell>
              <TableCell>{r.name}</TableCell>
              <TableCell>{r.quantity}</TableCell>
              <TableCell>{r.substitutability}</TableCell>
              <TableCell className="text-right">
                <Button size="icon" variant="ghost" onClick={() => remove(r.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {resources.length === 0 && (
            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Aucune ressource ajoutée.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

const SummaryView = ({ data, entityName, criticality, score }: { data: Process; entityName: string; criticality: ReturnType<typeof scoreToCriticality>; score: number }) => (
  <div className="space-y-6">
    <Card>
      <CardHeader><CardTitle className="text-base">Identification</CardTitle></CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 text-sm">
        <Field label="Nom" value={data.name} />
        <Field label="Entité" value={entityName} />
        <Field label="Département" value={data.department} />
        <Field label="Responsable" value={data.owner} />
        <Field label="Description" value={data.description || "—"} className="md:col-span-2" />
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Évaluation</CardTitle>
          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${criticalityColor(criticality)}`}>{criticality} ({score}/5)</span>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Période</TableHead>
              {(Object.keys(AXIS_LABELS) as ImpactAxis[]).map((a) => <TableHead key={a} className="text-center">{AXIS_LABELS[a]}</TableHead>)}
              <TableHead className="text-center">Max</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {PERIODS.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.label}</TableCell>
                {(Object.keys(AXIS_LABELS) as ImpactAxis[]).map((a) => (
                  <TableCell key={a} className="text-center">
                    <span className={`inline-block min-w-8 px-2 py-1 rounded text-xs ${scoreCellColor(data.impacts[p.id][a])}`}>{data.impacts[p.id][a]}</span>
                  </TableCell>
                ))}
                <TableCell className="text-center font-semibold">{periodMaxScore(data.impacts, p.id)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle className="text-base">Objectifs</CardTitle></CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-4 text-sm">
        <Field label="RTO" value={`${data.rto} h`} />
        <Field label="RPO" value={`${data.rpo} h`} />
        <Field label="MTPD" value={`${data.mtpd} h`} />
        <Field label="MBCO" value={`${data.mbco}%`} />
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle className="text-base">Ressources critiques ({data.resources.length})</CardTitle></CardHeader>
      <CardContent>
        {data.resources.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Aucune ressource déclarée.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {data.resources.map((r) => (
              <li key={r.id}>• <Badge variant="outline" className="mr-2">{RESOURCE_LABELS[r.type]}</Badge>{r.name} — {r.quantity} unité(s), substituabilité {r.substitutability}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  </div>
);

const Field = ({ label, value, className = "" }: { label: string; value: string; className?: string }) => (
  <div className={className}>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="font-medium text-foreground">{value}</p>
  </div>
);
