import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sparkles } from "lucide-react";
import { useStrategy } from "@/contexts/StrategyContext";
import { useBia } from "@/contexts/BiaContext";

export const StrategyCostBenefit = () => {
  const { associations, strategies } = useStrategy();
  const { processes } = useBia();

  const processesWithAssoc = useMemo(() => {
    const ids = Array.from(new Set(associations.map((a) => a.processId)));
    return processes.filter((p) => ids.includes(p.id));
  }, [associations, processes]);

  const [processId, setProcessId] = useState<string>("");

  const currentProcessId = processId || processesWithAssoc[0]?.id || "";
  const currentProcess = processes.find((p) => p.id === currentProcessId);

  const rows = useMemo(() => {
    const list = associations.filter((a) => a.processId === currentProcessId);
    return list.map((a) => {
      const st = strategies.find((s) => s.id === a.strategyId);
      const score = a.faisabilite + a.robustesse;
      return { a, st, score };
    });
  }, [associations, strategies, currentProcessId]);

  const bestScore = rows.reduce((m, r) => Math.max(m, r.score), 0);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Analyse coût-bénéfice</h2>
        <p className="text-sm text-muted-foreground">
          Comparez les stratégies associées à un même processus pour identifier la meilleure option.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Processus :</span>
        <Select value={currentProcessId} onValueChange={setProcessId}>
          <SelectTrigger className="w-[320px]">
            <SelectValue placeholder="Sélectionner un processus" />
          </SelectTrigger>
          <SelectContent>
            {processesWithAssoc.length === 0 && (
              <div className="p-2 text-sm text-muted-foreground">Aucun processus avec stratégie</div>
            )}
            {processesWithAssoc.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {currentProcess && (
          <span className="text-xs text-muted-foreground">RTO cible BIA : {currentProcess.rto}h</span>
        )}
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Stratégie</TableHead>
              <TableHead className="text-right">Coût de mise en œuvre</TableHead>
              <TableHead className="text-right">Délai de mise en œuvre</TableHead>
              <TableHead className="text-center">Score faisabilité</TableHead>
              <TableHead className="text-center">Score robustesse</TableHead>
              <TableHead className="text-right">RTO atteignable</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Aucune stratégie à comparer pour ce processus.
                </TableCell>
              </TableRow>
            )}
            {rows.map(({ a, st, score }) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{st?.name ?? "—"}</TableCell>
                <TableCell className="text-right">{a.coutEstime.toLocaleString("fr-FR")} €</TableCell>
                <TableCell className="text-right">{a.delaiMiseEnOeuvre} j</TableCell>
                <TableCell className="text-center">{a.faisabilite}/5</TableCell>
                <TableCell className="text-center">{a.robustesse}/5</TableCell>
                <TableCell className="text-right">{a.rtoAtteignable}h</TableCell>
                <TableCell>
                  {score === bestScore && rows.length > 1 && (
                    <Badge className="gap-1"><Sparkles className="h-3 w-3" /> Recommandée</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
