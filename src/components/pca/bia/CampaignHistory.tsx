import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBia } from "@/contexts/BiaContext";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export const CampaignHistory = () => {
  const { campaigns } = useBia();
  const sorted = [...campaigns].sort((a, b) => b.year - a.year);

  const compare = (i: number) => {
    if (i >= sorted.length - 1) return null;
    const cur = sorted[i].averageScore;
    const prev = sorted[i + 1].averageScore;
    const diff = +(cur - prev).toFixed(2);
    return diff;
  };

  const statusColor = (s: string) =>
    s === "En cours" ? "bg-accent text-accent-foreground" : s === "Terminée" ? "bg-success text-success-foreground" : "bg-secondary text-secondary-foreground";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Historique des campagnes BIA</h1>
        <p className="text-muted-foreground mt-1">Comparaison des campagnes annuelles d'analyse d'impact.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Campagnes</CardTitle></CardHeader>
        <CardContent className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Année</TableHead>
                <TableHead>Campagne</TableHead>
                <TableHead>Période</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-center">Couverture</TableHead>
                <TableHead className="text-center">Score moyen</TableHead>
                <TableHead className="text-center">Évolution</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((c, i) => {
                const diff = compare(i);
                const cov = Math.round((c.processesCovered / c.totalProcesses) * 100);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-bold text-foreground">{c.year}</TableCell>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.startDate} → {c.endDate}</TableCell>
                    <TableCell><span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor(c.status)}`}>{c.status}</span></TableCell>
                    <TableCell className="text-center">{c.processesCovered}/{c.totalProcesses} ({cov}%)</TableCell>
                    <TableCell className="text-center font-semibold">{c.averageScore.toFixed(2)}</TableCell>
                    <TableCell className="text-center">
                      {diff === null ? (
                        <span className="text-muted-foreground text-xs">—</span>
                      ) : diff > 0 ? (
                        <Badge className="bg-warning text-warning-foreground"><TrendingUp className="h-3 w-3 mr-1" />+{diff}</Badge>
                      ) : diff < 0 ? (
                        <Badge className="bg-success text-success-foreground"><TrendingDown className="h-3 w-3 mr-1" />{diff}</Badge>
                      ) : (
                        <Badge variant="outline"><Minus className="h-3 w-3 mr-1" />stable</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
