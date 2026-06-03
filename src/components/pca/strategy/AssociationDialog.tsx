import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { useStrategy } from "@/contexts/StrategyContext";
import { useBia } from "@/contexts/BiaContext";
import { useRisk } from "@/contexts/RiskContext";
import { StrategyAssociation, StrategyStatus } from "@/data/strategy";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultProcessId?: string;
  defaultStrategyId?: string;
  editing?: StrategyAssociation;
};

const STATUSES: StrategyStatus[] = ["Proposée", "Validée", "En test", "Opérationnelle", "Rejetée"];

export const AssociationDialog = ({ open, onOpenChange, defaultProcessId, defaultStrategyId, editing }: Props) => {
  const { strategies, addAssociation, updateAssociation } = useStrategy();
  const { processes } = useBia();
  const { scenarios } = useRisk();

  const [processId, setProcessId] = useState("");
  const [scenarioId, setScenarioId] = useState("");
  const [strategyId, setStrategyId] = useState("");
  const [justification, setJustification] = useState("");
  const [prerequis, setPrerequis] = useState("");
  const [coutEstime, setCoutEstime] = useState(0);
  const [delaiMiseEnOeuvre, setDelai] = useState(30);
  const [faisabilite, setFaisabilite] = useState(3);
  const [robustesse, setRobustesse] = useState(3);
  const [rtoAtteignable, setRtoAtteignable] = useState(24);
  const [status, setStatus] = useState<StrategyStatus>("Proposée");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setProcessId(editing.processId);
      setScenarioId(editing.scenarioId);
      setStrategyId(editing.strategyId);
      setJustification(editing.justification);
      setPrerequis(editing.prerequis);
      setCoutEstime(editing.coutEstime);
      setDelai(editing.delaiMiseEnOeuvre);
      setFaisabilite(editing.faisabilite);
      setRobustesse(editing.robustesse);
      setRtoAtteignable(editing.rtoAtteignable);
      setStatus(editing.status);
    } else {
      setProcessId(defaultProcessId ?? "");
      setScenarioId("");
      setStrategyId(defaultStrategyId ?? "");
      setJustification("");
      setPrerequis("");
      setCoutEstime(0);
      setDelai(30);
      setFaisabilite(3);
      setRobustesse(3);
      setRtoAtteignable(24);
      setStatus("Proposée");
    }
  }, [open, editing, defaultProcessId, defaultStrategyId]);

  const selectedProcess = processes.find((p) => p.id === processId);
  const rtoMismatch = selectedProcess && rtoAtteignable > selectedProcess.rto;

  const canSave = processId && scenarioId && strategyId && justification.trim();

  const handleSave = () => {
    const payload: StrategyAssociation = {
      id: editing?.id ?? `assoc_${Date.now()}`,
      processId,
      scenarioId,
      strategyId,
      justification,
      prerequis,
      coutEstime,
      delaiMiseEnOeuvre,
      faisabilite,
      robustesse,
      rtoAtteignable,
      status,
    };
    if (editing) updateAssociation(payload);
    else addAssociation(payload);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Modifier l'association" : "Nouvelle association stratégie / processus"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          <div className="md:col-span-2">
            <Label>Processus</Label>
            <Select value={processId} onValueChange={setProcessId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un processus BIA" /></SelectTrigger>
              <SelectContent>
                {processes.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} {p.department ? `— ${p.department}` : ""} (RTO {p.rto}h)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Scénario de crise</Label>
            <Select value={scenarioId} onValueChange={setScenarioId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un scénario" /></SelectTrigger>
              <SelectContent>
                {scenarios.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Stratégie</Label>
            <Select value={strategyId} onValueChange={setStrategyId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner une stratégie" /></SelectTrigger>
              <SelectContent>
                {strategies.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Label>Justification</Label>
            <Textarea value={justification} onChange={(e) => setJustification(e.target.value)} rows={2}
              placeholder="Pourquoi cette stratégie est-elle retenue ?" />
          </div>

          <div className="md:col-span-2">
            <Label>Prérequis</Label>
            <Textarea value={prerequis} onChange={(e) => setPrerequis(e.target.value)} rows={2}
              placeholder="Ressources, contrats, formations nécessaires..." />
          </div>

          <div>
            <Label>Coût estimé (€)</Label>
            <Input type="number" min={0} value={coutEstime} onChange={(e) => setCoutEstime(Number(e.target.value))} />
          </div>

          <div>
            <Label>Délai de mise en œuvre (jours)</Label>
            <Input type="number" min={0} value={delaiMiseEnOeuvre} onChange={(e) => setDelai(Number(e.target.value))} />
          </div>

          <div>
            <Label>Faisabilité (1-5)</Label>
            <Input type="number" min={1} max={5} value={faisabilite} onChange={(e) => setFaisabilite(Number(e.target.value))} />
          </div>

          <div>
            <Label>Robustesse (1-5)</Label>
            <Input type="number" min={1} max={5} value={robustesse} onChange={(e) => setRobustesse(Number(e.target.value))} />
          </div>

          <div>
            <Label>RTO atteignable (heures)</Label>
            <Input type="number" min={0} value={rtoAtteignable} onChange={(e) => setRtoAtteignable(Number(e.target.value))} />
          </div>

          <div>
            <Label>Statut</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as StrategyStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {rtoMismatch && (
            <div className="md:col-span-2">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  La stratégie sélectionnée ne permet pas d'atteindre le RTO cible défini dans le BIA
                  ({selectedProcess?.rto}h). RTO atteignable : {rtoAtteignable}h.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSave} disabled={!canSave}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
