import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBia } from "@/contexts/BiaContext";
import { PERIODS, periodMaxScore, scoreCellColor, computeMaxScore, scoreToCriticality, criticalityColor } from "@/data/bia";

export const MatrixView = () => {
  const { processes } = useBia();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Vue matricielle</h1>
        <p className="text-muted-foreground mt-1">Score d'impact maximal par processus et par période d'indisponibilité.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-lg">Matrice processus × période</CardTitle></CardHeader>
        <CardContent className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[220px]">Processus</TableHead>
                {PERIODS.map((p) => <TableHead key={p.id} className="text-center">{p.label}</TableHead>)}
                <TableHead className="text-center">Criticité</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processes.map((proc) => {
                const c = scoreToCriticality(computeMaxScore(proc.impacts));
                return (
                  <TableRow key={proc.id}>
                    <TableCell>
                      <p className="font-medium">{proc.name}</p>
                      <p className="text-xs text-muted-foreground">{proc.department}</p>
                    </TableCell>
                    {PERIODS.map((p) => {
                      const score = periodMaxScore(proc.impacts, p.id);
                      return (
                        <TableCell key={p.id} className="text-center p-2">
                          <span className={`inline-block min-w-8 px-2 py-1 rounded text-xs font-semibold ${scoreCellColor(score)}`}>{score}</span>
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${criticalityColor(c)}`}>{c}</span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="flex flex-wrap gap-3 mt-6 text-xs">
            <Legend label="1-2 Faible" cls="bg-success/80 text-success-foreground" />
            <Legend label="3 Modéré" cls="bg-accent/80 text-accent-foreground" />
            <Legend label="4 Élevé" cls="bg-warning/90 text-warning-foreground" />
            <Legend label="5 Critique" cls="bg-destructive/90 text-destructive-foreground" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const Legend = ({ label, cls }: { label: string; cls: string }) => (
  <div className="flex items-center gap-2"><span className={`inline-block h-4 w-6 rounded ${cls}`} />{label}</div>
);
