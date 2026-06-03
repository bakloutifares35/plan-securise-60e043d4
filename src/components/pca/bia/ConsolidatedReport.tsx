import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, FileSpreadsheet, FileText, AlertTriangle, Search, TrendingUp, Calendar, Users, Server, Building2, Clock } from "lucide-react";
import { useBia } from "@/contexts/BiaContext";
import { useGovernance } from "@/contexts/GovernanceContext";
import { computeMaxScore, scoreToCriticality, criticalityColor } from "@/data/bia";
import { toast } from "@/hooks/use-toast";

// Composant de détail modal
const ProcessDetailModal = ({ process, entityName, onClose }: { process: any; entityName: string; onClose: () => void }) => {
  const score = computeMaxScore(process.impacts);
  const criticality = scoreToCriticality(score);
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {process.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="font-semibold">Entité :</span> {entityName}</div>
            <div><span className="font-semibold">Département :</span> {process.department || "—"}</div>
            <div><span className="font-semibold">Responsable :</span> {process.owner || "—"}</div>
            <div><span className="font-semibold">Dernière mise à jour :</span> {process.lastUpdated || "—"}</div>
          </div>
          <div className="border-t pt-2">
            <span className="font-semibold">Description :</span>
            <p className="text-muted-foreground text-sm mt-1">{process.description || "Aucune description"}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/30 p-3 rounded-lg text-center">
              <div className="text-xs text-muted-foreground">Criticité globale</div>
              <Badge className={`mt-1 ${criticalityColor(criticality)}`}>{criticality}</Badge>
              <div className="text-2xl font-bold mt-1">{score}/5</div>
            </div>
            <div className="bg-muted/30 p-3 rounded-lg text-center">
              <div className="text-xs text-muted-foreground">RTO / RPO</div>
              <div className="text-lg font-bold">{process.rto}h / {process.rpo}h</div>
            </div>
          </div>
          <div>
            <span className="font-semibold">Objectifs de continuité</span>
            <div className="grid grid-cols-2 gap-2 mt-1 text-sm">
              <div>MTPD : {process.mtpd}h</div>
              <div>MBCO : {process.mbco}%</div>
            </div>
          </div>
          {process.resources && process.resources.length > 0 && (
            <div>
              <span className="font-semibold flex items-center gap-1"><Users className="h-3 w-3" /> Ressources critiques</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {process.resources.slice(0, 5).map((r: any, idx: number) => (
                  <Badge key={idx} variant="outline" className="text-xs">{r.name || r.type}</Badge>
                ))}
                {process.resources.length > 5 && <Badge variant="outline">+{process.resources.length-5}</Badge>}
              </div>
            </div>
          )}
          {(process as any).appsCritiques && (process as any).appsCritiques.length > 0 && (
            <div>
              <span className="font-semibold flex items-center gap-1"><Server className="h-3 w-3" /> Applications IT critiques</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {(process as any).appsCritiques.map((app: any) => (
                  <Badge key={app.id} variant="secondary" className="text-xs">{app.name} (RTO:{app.rto_hours}h)</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const ConsolidatedReport = () => {
  const { processes } = useBia();
  const { entities } = useGovernance();
  
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [criticalityFilter, setCriticalityFilter] = useState<string>("all");
  const [selectedProcess, setSelectedProcess] = useState<any>(null);

  // Enrichissement des données
  const enriched = useMemo(() => {
    return processes.map(p => {
      const entity = entities.find(e => e.id === p.entityId);
      const score = computeMaxScore(p.impacts);
      const criticality = scoreToCriticality(score);
      const rtoIssue = p.rto > p.mtpd;
      const stale = (Date.now() - new Date(p.lastUpdated).getTime()) / (1000 * 60 * 60 * 24) > 365;
      const needPca = score >= 3;
      return { ...p, entityName: entity?.name || "—", score, criticality, rtoIssue, stale, needPca };
    });
  }, [processes, entities]);

  // Filtrage
  const filtered = useMemo(() => {
    let list = enriched;
    if (search) {
      list = list.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.entityName.toLowerCase().includes(search.toLowerCase()));
    }
    if (entityFilter !== "all") {
      list = list.filter(p => p.entityId === entityFilter);
    }
    if (criticalityFilter !== "all") {
      list = list.filter(p => p.criticality === criticalityFilter);
    }
    return list;
  }, [enriched, search, entityFilter, criticalityFilter]);

  // Statistiques
  const stats = useMemo(() => {
    const total = enriched.length;
    const criticalCount = enriched.filter(p => p.score >= 4).length;
    const majorCount = enriched.filter(p => p.score >= 3 && p.score < 4).length;
    const moderateCount = enriched.filter(p => p.score >= 2 && p.score < 3).length;
    const minorCount = enriched.filter(p => p.score < 2).length;
    const avgRto = total > 0 ? Math.round(enriched.reduce((acc, p) => acc + p.rto, 0) / total) : 0;
    const avgRpo = total > 0 ? Math.round(enriched.reduce((acc, p) => acc + p.rpo, 0) / total) : 0;
    const pcaRequired = enriched.filter(p => p.needPca).length;
    return { total, criticalCount, majorCount, moderateCount, minorCount, avgRto, avgRpo, pcaRequired };
  }, [enriched]);

  const uniqueEntities = useMemo(() => {
    const map = new Map();
    enriched.forEach(p => { if (p.entityId) map.set(p.entityId, { id: p.entityId, name: p.entityName }); });
    return Array.from(map.values());
  }, [enriched]);

  const exportCSV = () => {
    const rows = [
      ["ID", "Processus", "Entité", "Département", "RTO (h)", "RPO (h)", "MTPD (h)", "MBCO (%)", "Criticité", "Score", "Dernière MAJ", "PCA requis"],
      ...enriched.map((p) => [p.id, p.name, p.entityName, p.department, p.rto, p.rpo, p.mtpd, p.mbco, p.criticality, p.score, p.lastUpdated, p.needPca ? "Oui" : "Non"]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "rapport-bia.csv"; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export CSV", description: "Le rapport BIA a été téléchargé." });
  };

  const exportPDF = () => {
    window.print();
    toast({ title: "Export PDF", description: "Utilisez la boîte de dialogue d'impression pour enregistrer en PDF." });
  };

  const getMbcoColor = (mbco: number) => {
    if (mbco >= 80) return "bg-green-500";
    if (mbco >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Rapport BIA consolidé</h1>
          <p className="text-muted-foreground mt-1">Vue synthétique de l'ensemble des analyses d'impact métier</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportPDF}><FileText className="h-4 w-4 mr-2" />PDF</Button>
          <Button onClick={exportCSV}><FileSpreadsheet className="h-4 w-4 mr-2" />Excel (CSV)</Button>
        </div>
      </div>

      {/* Cartes statistiques */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processus analysés</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="flex gap-2 mt-2 text-xs">
              <Badge variant="destructive" className="text-[10px]">Critique {stats.criticalCount}</Badge>
              <Badge className="bg-orange-500 text-[10px]">Majeur {stats.majorCount}</Badge>
              <Badge variant="secondary" className="text-[10px]">Modéré {stats.moderateCount}</Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">RTO moyen</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgRto} h</div>
            <p className="text-xs text-muted-foreground">Délai de reprise visé</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">RPO moyen</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgRpo} h</div>
            <p className="text-xs text-muted-foreground">Perte de données max</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">PCA requis</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pcaRequired}</div>
            <p className="text-xs text-muted-foreground">Processus nécessitant un plan de continuité</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher processus ou entité..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 w-[220px]"
            />
          </div>
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Toutes entités" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes entités</SelectItem>
              {uniqueEntities.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={criticalityFilter} onValueChange={setCriticalityFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Toutes criticités" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes criticités</SelectItem>
              <SelectItem value="Critique">Critique</SelectItem>
              <SelectItem value="Majeur">Majeur</SelectItem>
              <SelectItem value="Modéré">Modéré</SelectItem>
              <SelectItem value="Mineur">Mineur</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm text-muted-foreground">
          {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
        </div>
      </div>

      {/* Tableau principal */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Synthèse des objectifs et criticités</CardTitle></CardHeader>
        <CardContent className="overflow-auto p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Processus</TableHead>
                <TableHead>Entité</TableHead>
                <TableHead className="text-center">RTO</TableHead>
                <TableHead className="text-center">RPO</TableHead>
                <TableHead className="text-center">MTPD</TableHead>
                <TableHead className="text-center w-32">MBCO</TableHead>
                <TableHead className="text-center">Criticité</TableHead>
                <TableHead>Alertes</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelectedProcess(p)}>
                  <TableCell>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.id} — {p.department}</p>
                  </TableCell>
                  <TableCell>{p.entityName}</TableCell>
                  <TableCell className="text-center">{p.rto}h</TableCell>
                  <TableCell className="text-center">{p.rpo}h</TableCell>
                  <TableCell className="text-center">{p.mtpd}h</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{p.mbco}%</span>
                      <Progress value={p.mbco} className="h-2 flex-1" />
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={criticalityColor(p.criticality)}>{p.criticality}</Badge>
                  </TableCell>
                  <TableCell className="text-xs space-y-1">
                    {p.rtoIssue && <span className="flex items-center gap-1 text-destructive"><AlertTriangle className="h-3 w-3" />RTO &gt; MTPD</span>}
                    {p.needPca && <span className="flex items-center gap-1 text-amber-600"><AlertTriangle className="h-3 w-3" />PCA requis</span>}
                    {p.stale && <span className="flex items-center gap-1 text-amber-600"><AlertTriangle className="h-3 w-3" />BIA &gt; 12 mois</span>}
                    {!p.rtoIssue && !p.needPca && !p.stale && <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedProcess(p); }}>
                      Détail
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Aucun processus trouvé.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de détail */}
      {selectedProcess && (
        <ProcessDetailModal
          process={selectedProcess}
          entityName={selectedProcess.entityName}
          onClose={() => setSelectedProcess(null)}
        />
      )}
    </div>
  );
};