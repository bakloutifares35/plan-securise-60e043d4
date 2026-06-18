import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Pencil, Plus, Trash2 } from "lucide-react";
import { useStrategy } from "@/contexts/StrategyContext";
import { useBia } from "@/contexts/BiaContext";
import { useRisk } from "@/contexts/RiskContext";
import { StrategyAssociation } from "@/data/strategy";
import { AssociationDialog } from "./AssociationDialog";

const statusVariant = (s: StrategyAssociation["status"]) => {
  switch (s) {
    case "Opérationnelle": return "default";
    case "Validée": return "secondary";
    case "En test": return "outline";
    case "Rejetée": return "destructive";
    default: return "outline";
  }
};

export const StrategyAssociations = () => {
  const { associations, strategies, deleteAssociation } = useStrategy();
  const { processes } = useBia();
  const { scenarios } = useRisk();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StrategyAssociation | undefined>();

  const rows = useMemo(() => {
    return associations.map((a) => {
      const p = processes.find((x) => x.id === a.processId);
      const s = scenarios.find((x) => x.id === a.scenarioId);
      const st = strategies.find((x) => x.id === a.strategyId);
      const rtoTarget = p?.rto ?? 0;
      return { a, p, s, st, rtoTarget, rtoMismatch: p && a.rtoAtteignable > p.rto };
    });
  }, [associations, processes, scenarios, strategies]);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Association processus / stratégie</h2>
          <p className="text-sm text-muted-foreground">
            Stratégies de continuité retenues par processus critique et scénario.
          </p>
        </div>
        <Button onClick={() => { setEditing(undefined); setOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Nouvelle association
        </Button>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Processus</TableHead>
              <TableHead>Scénario de crise</TableHead>
              <TableHead>Stratégie retenue</TableHead>
              <TableHead className="text-right">RTO cible</TableHead>
              <TableHead className="text-center">Faisabilité</TableHead>
              <TableHead className="text-right">Coût estimé</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Aucune association définie. Créez-en une pour commencer.
                </TableCell>
              </TableRow>
            )}
            {rows.map(({ a, p, s, st, rtoTarget, rtoMismatch }) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{p?.name ?? "—"}</TableCell>
                <TableCell>{s?.name ?? "—"}</TableCell>
                <TableCell>{st?.name ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <span>{rtoTarget}h</span>
                    {rtoMismatch && (
                      <span title={`RTO atteignable ${a.rtoAtteignable}h > cible ${rtoTarget}h`}>
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-center">{a.faisabilite}/5</TableCell>
                <TableCell className="text-right">{a.coutEstime.toLocaleString("fr-FR")} €</TableCell>
                <TableCell><Badge variant={statusVariant(a.status) as any}>{a.status}</Badge></TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(a); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteAssociation(a.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AssociationDialog open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  );
};
