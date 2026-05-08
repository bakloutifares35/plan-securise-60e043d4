import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileSpreadsheet, FileText, AlertTriangle } from "lucide-react";
import { useBia } from "@/contexts/BiaContext";
import { useGovernance } from "@/contexts/GovernanceContext";
import { computeMaxScore, scoreToCriticality, criticalityColor } from "@/data/bia";
import { toast } from "@/hooks/use-toast";

export const ConsolidatedReport = () => {
  const { processes } = useBia();
  const { entities } = useGovernance();
  const entityName = (id: string) => entities.find((e) => e.id === id)?.name ?? "—";

  const exportCSV = () => {
    const rows = [
      ["ID", "Processus", "Entité", "Département", "RTO (h)", "RPO (h)", "MTPD (h)", "MBCO (%)", "Criticité", "Score", "Dernière MAJ"],
      ...processes.map((p) => {
        const score = computeMaxScore(p.impacts);
        return [p.id, p.name, entityName(p.entityId), p.department, p.rto, p.rpo, p.mtpd, p.mbco, scoreToCriticality(score), score, p.lastUpdated];
      }),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "rapport-bia.csv"; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export Excel/CSV", description: "Le rapport BIA a été téléchargé." });
  };

  const exportPDF = () => {
    window.print();
    toast({ title: "Export PDF", description: "Utilisez la boîte de dialogue d'impression pour enregistrer en PDF." });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Rapport BIA consolidé</h1>
          <p className="text-muted-foreground mt-1">Vue synthétique de l'ensemble des analyses d'impact.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportPDF}><FileText className="h-4 w-4 mr-2" />Exporter PDF</Button>
          <Button onClick={exportCSV}><FileSpreadsheet className="h-4 w-4 mr-2" />Exporter Excel</Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Synthèse des objectifs et criticités</CardTitle></CardHeader>
        <CardContent className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Processus</TableHead>
                <TableHead>Entité</TableHead>
                <TableHead className="text-center">RTO</TableHead>
                <TableHead className="text-center">RPO</TableHead>
                <TableHead className="text-center">MTPD</TableHead>
                <TableHead className="text-center">MBCO</TableHead>
                <TableHead>Criticité</TableHead>
                <TableHead>Alertes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processes.map((p) => {
                const score = computeMaxScore(p.impacts);
                const c = scoreToCriticality(score);
                const rtoIssue = p.rto > p.mtpd;
                const stale = (Date.now() - new Date(p.lastUpdated).getTime()) / (1000 * 60 * 60 * 24) > 365;
                const needPca = score >= 3;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.id} — {p.department}</p>
                    </TableCell>
                    <TableCell>{entityName(p.entityId)}</TableCell>
                    <TableCell className="text-center">{p.rto}h</TableCell>
                    <TableCell className="text-center">{p.rpo}h</TableCell>
                    <TableCell className="text-center">{p.mtpd}h</TableCell>
                    <TableCell className="text-center">{p.mbco}%</TableCell>
                    <TableCell>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${criticalityColor(c)}`}>{c}</span>
                    </TableCell>
                    <TableCell className="text-xs space-y-1">
                      {rtoIssue && <span className="flex items-center gap-1 text-destructive"><AlertTriangle className="h-3 w-3" />RTO &gt; MTPD</span>}
                      {needPca && <span className="flex items-center gap-1 text-warning"><AlertTriangle className="h-3 w-3" />PCA requis</span>}
                      {stale && <span className="flex items-center gap-1 text-warning"><AlertTriangle className="h-3 w-3" />BIA &gt; 12 mois</span>}
                      {!rtoIssue && !needPca && !stale && <span className="text-muted-foreground">—</span>}
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
