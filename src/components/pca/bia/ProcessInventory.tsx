import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Plus, Pencil, Trash2, Search, 
  ChevronDown, ChevronRight, Download, 
  Building2
} from "lucide-react";
import { useBia } from "@/contexts/BiaContext";
import { useGovernance } from "@/contexts/GovernanceContext";
import { useRole } from "@/contexts/RoleContext";
import { computeMaxScore, scoreToCriticality, criticalityColor } from "@/data/bia";
import { toast } from "@/hooks/use-toast";

export const ProcessInventory = ({ onEdit, onCreate }: { onEdit: (id: string) => void; onCreate: () => void }) => {
  const { processes, deleteProcess } = useBia();
  const { entities } = useGovernance();
  const { can } = useRole();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCriticality, setSelectedCriticality] = useState<string>("all");
  const [expandedRoots, setExpandedRoots] = useState<Set<string>>(new Set());
  const [expandedDirections, setExpandedDirections] = useState<Set<string>>(new Set());
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"hierarchy" | "table">("hierarchy");

  const entityName = (id: string) => entities.find((e) => e.id === id)?.name ?? "—";

  // Racines : entités sans parent
  const rootEntities = useMemo(() => entities.filter(e => e.parentId === null), [entities]);

  // Enfants directs (quel que soit le type)
  const getChildren = (parentId: string) => entities.filter(e => e.parentId === parentId);

  // Récupérer les processus d'un département (par nom ou ID) avec filtres
  const getProcessesForDept = (deptId: string, deptName: string) => {
    let procs = processes.filter(p => p.department === deptName || p.entityId === deptId);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      procs = procs.filter(p => 
        p.name.toLowerCase().includes(q) ||
        p.department.toLowerCase().includes(q) ||
        p.owner.toLowerCase().includes(q) ||
        entityName(p.entityId).toLowerCase().includes(q)
      );
    }
    if (selectedCriticality !== "all") {
      procs = procs.filter(p => {
        const crit = scoreToCriticality(computeMaxScore(p.impacts));
        return crit === selectedCriticality;
      });
    }
    return procs;
  };

  // Statistiques globales filtrées
  const filteredProcesses = useMemo(() => {
    let procs = [...processes];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      procs = procs.filter(p => 
        p.name.toLowerCase().includes(q) ||
        p.department.toLowerCase().includes(q) ||
        p.owner.toLowerCase().includes(q) ||
        entityName(p.entityId).toLowerCase().includes(q)
      );
    }
    if (selectedCriticality !== "all") {
      procs = procs.filter(p => {
        const crit = scoreToCriticality(computeMaxScore(p.impacts));
        return crit === selectedCriticality;
      });
    }
    return procs;
  }, [processes, searchQuery, selectedCriticality, entities]);

  const stats = {
    total: processes.length,
    filtered: filteredProcesses.length,
    critiques: filteredProcesses.filter(p => computeMaxScore(p.impacts) >= 4).length,
    majeurs: filteredProcesses.filter(p => computeMaxScore(p.impacts) >= 3 && computeMaxScore(p.impacts) < 4).length,
    moderes: filteredProcesses.filter(p => computeMaxScore(p.impacts) >= 2 && computeMaxScore(p.impacts) < 3).length,
    mineurs: filteredProcesses.filter(p => computeMaxScore(p.impacts) < 2).length,
    avgScore: filteredProcesses.length ? filteredProcesses.reduce((acc, p) => acc + computeMaxScore(p.impacts), 0) / filteredProcesses.length : 0
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Supprimer le processus "${name}" ?`)) {
      deleteProcess(id);
      toast({ title: "Processus supprimé", description: name });
    }
  };

  const toggleRoot = (id: string) => {
    const s = new Set(expandedRoots);
    s.has(id) ? s.delete(id) : s.add(id);
    setExpandedRoots(s);
  };
  const toggleDirection = (id: string) => {
    const s = new Set(expandedDirections);
    s.has(id) ? s.delete(id) : s.add(id);
    setExpandedDirections(s);
  };
  const toggleDept = (id: string) => {
    const s = new Set(expandedDepts);
    s.has(id) ? s.delete(id) : s.add(id);
    setExpandedDepts(s);
  };

  const expandAll = () => {
    setExpandedRoots(new Set(rootEntities.map(e => e.id)));
    const allDirections = new Set(entities.filter(e => e.parentId !== null && !getChildren(e.id).some(c => getChildren(c.id).length > 0) ? e.id : e.id)); // simplifié
    setExpandedDirections(new Set(entities.filter(e => e.parentId !== null).map(e => e.id)));
    setExpandedDepts(new Set(entities.filter(e => e.parentId !== null).map(e => e.id)));
  };
  const collapseAll = () => {
    setExpandedRoots(new Set());
    setExpandedDirections(new Set());
    setExpandedDepts(new Set());
  };

  const exportToCSV = () => {
    const headers = ["Nom", "Direction", "Département", "Responsable", "Criticité", "RTO", "RPO", "MTPD", "MBCO", "Statut"];
    const rows = filteredProcesses.map(p => {
      const dept = entities.find(e => e.id === p.entityId || e.name === p.department);
      const dir = dept ? entities.find(e => e.id === dept.parentId) : null;
      return [
        p.name,
        dir?.name || "—",
        p.department,
        p.owner,
        scoreToCriticality(computeMaxScore(p.impacts)),
        p.rto,
        p.rpo,
        p.mtpd,
        p.mbco,
        p.status
      ];
    });
    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventaire_processus.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export CSV", description: `${filteredProcesses.length} processus exportés` });
  };

  const getDeptAvgScore = (procs: typeof processes) => {
    if (!procs.length) return 0;
    const sum = procs.reduce((acc, p) => acc + computeMaxScore(p.impacts), 0);
    return (sum / procs.length).toFixed(1);
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-7 w-7 text-primary" />
            Inventaire des processus
          </h1>
          <p className="text-muted-foreground mt-1">Hiérarchie : Entreprise → Direction → Département → Processus</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCSV} className="gap-2"><Download className="h-4 w-4" /> Exporter CSV</Button>
          {can("write") && <Button onClick={onCreate} className="gap-2"><Plus className="h-4 w-4" /> Nouveau processus</Button>}
        </div>
      </div>

      {/* Cartes statistiques */}
      <div className="grid gap-3 md:grid-cols-6">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5"><CardContent className="p-3 text-center"><p className="text-xs">Total</p><p className="text-xl font-bold">{stats.filtered}</p></CardContent></Card>
        <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5"><CardContent className="p-3 text-center"><p className="text-xs">Critiques</p><p className="text-xl font-bold text-red-600">{stats.critiques}</p></CardContent></Card>
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5"><CardContent className="p-3 text-center"><p className="text-xs">Majeurs</p><p className="text-xl font-bold text-orange-600">{stats.majeurs}</p></CardContent></Card>
        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5"><CardContent className="p-3 text-center"><p className="text-xs">Modérés</p><p className="text-xl font-bold text-yellow-600">{stats.moderes}</p></CardContent></Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5"><CardContent className="p-3 text-center"><p className="text-xs">Mineurs</p><p className="text-xl font-bold text-green-600">{stats.mineurs}</p></CardContent></Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5"><CardContent className="p-3 text-center"><p className="text-xs">Score moyen</p><p className="text-xl font-bold">{stats.avgScore.toFixed(1)}/5</p></CardContent></Card>
      </div>

      {/* Filtres */}
      <Card><CardContent className="p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher par processus, département, responsable..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
          <select value={selectedCriticality} onChange={e => setSelectedCriticality(e.target.value)} className="h-10 px-3 rounded-md border">
            <option value="all">Toutes les criticités</option>
            <option value="Critique">Critique</option><option value="Majeur">Majeur</option><option value="Modéré">Modéré</option><option value="Mineur">Mineur</option>
          </select>
          <div className="flex gap-1">
            <Button variant={viewMode === "hierarchy" ? "default" : "outline"} size="sm" onClick={() => setViewMode("hierarchy")}>Vue hiérarchique</Button>
            <Button variant={viewMode === "table" ? "default" : "outline"} size="sm" onClick={() => setViewMode("table")}>Vue tableau</Button>
            <Button variant="outline" size="sm" onClick={expandAll}>Tout développer</Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>Tout réduire</Button>
          </div>
        </div>
      </CardContent></Card>

      {/* Contenu principal */}
      <Card>
        <CardHeader><CardTitle>{viewMode === "hierarchy" ? "Hiérarchie par Entreprise → Direction → Département → Processus" : "Inventaire détaillé des processus"}</CardTitle></CardHeader>
        <CardContent>
          {viewMode === "hierarchy" ? (
            <div className="space-y-4">
              {rootEntities.map(root => {
                const isRootExpanded = expandedRoots.has(root.id);
                const directions = getChildren(root.id);
                // On affiche toutes les directions, même sans processus (mais on peut les masquer si recherche)
                const visibleDirections = directions.filter(dir => {
                  if (!searchQuery && selectedCriticality === "all") return true;
                  const depts = getChildren(dir.id);
                  return depts.some(dept => getProcessesForDept(dept.id, dept.name).length > 0);
                });
                if (visibleDirections.length === 0 && (searchQuery || selectedCriticality !== "all")) return null;
                
                const totalProcesses = directions.reduce((acc, dir) => {
                  const depts = getChildren(dir.id);
                  return acc + depts.reduce((sum, dept) => sum + getProcessesForDept(dept.id, dept.name).length, 0);
                }, 0);
                const totalCritiques = directions.reduce((acc, dir) => {
                  const depts = getChildren(dir.id);
                  return acc + depts.reduce((sum, dept) => {
                    const procs = getProcessesForDept(dept.id, dept.name);
                    return sum + procs.filter(p => computeMaxScore(p.impacts) >= 4).length;
                  }, 0);
                }, 0);
                
                return (
                  <div key={root.id} className="border rounded-lg overflow-hidden">
                    <button onClick={() => toggleRoot(root.id)} className="w-full flex items-center justify-between p-4 bg-primary/10 hover:bg-primary/15">
                      <div className="flex items-center gap-3">
                        {isRootExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                        <Building2 className="h-5 w-5 text-primary" />
                        <span className="font-bold text-lg">{root.name}</span>
                        <Badge variant="outline">{totalProcesses} processus</Badge>
                        {totalCritiques > 0 && <Badge className="bg-red-100 text-red-700">⚠️ {totalCritiques} critique(s)</Badge>}
                      </div>
                    </button>
                    {isRootExpanded && (
                      <div className="border-t">
                        {visibleDirections.length === 0 ? (
                          <div className="p-4 text-center text-muted-foreground">Aucune direction</div>
                        ) : (
                          visibleDirections.map(dir => {
                            const isDirExpanded = expandedDirections.has(dir.id);
                            const departments = getChildren(dir.id);
                            const visibleDepts = departments.filter(dept => {
                              if (!searchQuery && selectedCriticality === "all") return true;
                              return getProcessesForDept(dept.id, dept.name).length > 0;
                            });
                            const dirTotalProcs = departments.reduce((acc, dept) => acc + getProcessesForDept(dept.id, dept.name).length, 0);
                            const dirCritiques = departments.reduce((acc, dept) => {
                              const procs = getProcessesForDept(dept.id, dept.name);
                              return acc + procs.filter(p => computeMaxScore(p.impacts) >= 4).length;
                            }, 0);
                            return (
                              <div key={dir.id} className="border-b last:border-b-0">
                                <button onClick={() => toggleDirection(dir.id)} className="w-full flex items-center justify-between p-3 bg-muted/20 pl-10">
                                  <div className="flex items-center gap-2">
                                    {isDirExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                    <span className="font-semibold">{dir.name}</span>
                                    <Badge variant="outline" className="text-xs">{dirTotalProcs} processus</Badge>
                                    {dirCritiques > 0 && <Badge className="bg-red-100 text-red-700 text-xs">⚠️ {dirCritiques}</Badge>}
                                  </div>
                                </button>
                                {isDirExpanded && (
                                  <div className="pl-10">
                                    {visibleDepts.length === 0 ? (
                                      <div className="p-4 text-center text-muted-foreground">Aucun département</div>
                                    ) : (
                                      visibleDepts.map(dept => {
                                        const isDeptExpanded = expandedDepts.has(dept.id);
                                        const procs = getProcessesForDept(dept.id, dept.name);
                                        const avgScore = getDeptAvgScore(procs);
                                        const critCount = procs.filter(p => computeMaxScore(p.impacts) >= 4).length;
                                        return (
                                          <div key={dept.id} className="border-b last:border-b-0">
                                            <button onClick={() => toggleDept(dept.id)} className="w-full flex items-center justify-between p-3 bg-muted/10">
                                              <div className="flex items-center gap-2">
                                                {isDeptExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                <span className="font-medium">{dept.name}</span>
                                                <Badge variant="outline" className="text-xs">{procs.length} processus</Badge>
                                                {critCount > 0 && <Badge className="bg-red-100 text-red-700 text-xs">⚠️ {critCount} critique(s)</Badge>}
                                              </div>
                                              <div className="text-xs text-muted-foreground">Score moyen: {avgScore}/5</div>
                                            </button>
                                            {isDeptExpanded && (
                                              <div className="overflow-auto pl-6 pb-2">
                                                {procs.length === 0 ? (
                                                  <div className="p-4 text-center text-muted-foreground">Aucun processus</div>
                                                ) : (
                                                  <Table>
                                                    <TableHeader><TableRow><TableHead>Processus</TableHead><TableHead>Responsable</TableHead><TableHead>RTO</TableHead><TableHead>Criticité</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                                                    <TableBody>
                                                      {procs.map(p => {
                                                        const crit = scoreToCriticality(computeMaxScore(p.impacts));
                                                        return (
                                                          <TableRow key={p.id}>
                                                            <TableCell className="font-medium">{p.name}</TableCell>
                                                            <TableCell>{p.owner}</TableCell>
                                                            <TableCell>{p.rto}h</TableCell>
                                                            <TableCell><Badge className={criticalityColor(crit)}>{crit}</Badge></TableCell>
                                                            <TableCell className="text-right">
                                                              <div className="flex justify-end gap-1">
                                                                <Button size="icon" variant="ghost" onClick={() => onEdit(p.id)}><Pencil className="h-4 w-4" /></Button>
                                                                {can("admin") && <Button size="icon" variant="ghost" onClick={() => handleDelete(p.id, p.name)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                                                              </div>
                                                            </TableCell>
                                                          </TableRow>
                                                        );
                                                      })}
                                                    </TableBody>
                                                  </Table>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {rootEntities.length === 0 && <p className="text-center text-muted-foreground py-8">Aucune entreprise racine trouvée (parentId = null)</p>}
            </div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Processus</TableHead><TableHead>Direction</TableHead><TableHead>Département</TableHead><TableHead>Responsable</TableHead><TableHead>RTO</TableHead><TableHead>Criticité</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredProcesses.map(p => {
                    const dept = entities.find(e => e.id === p.entityId || e.name === p.department);
                    const dir = dept ? entities.find(e => e.id === dept.parentId) : null;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>{dir?.name || "—"}</TableCell>
                        <TableCell>{p.department}</TableCell>
                        <TableCell>{p.owner}</TableCell>
                        <TableCell className="text-center">{p.rto}h</TableCell>
                        <TableCell><Badge className={criticalityColor(scoreToCriticality(computeMaxScore(p.impacts)))}>{scoreToCriticality(computeMaxScore(p.impacts))}</Badge></TableCell>
                        <TableCell className="text-right"><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" onClick={() => onEdit(p.id)}><Pencil className="h-4 w-4" /></Button>{can("admin") && <Button size="icon" variant="ghost" onClick={() => handleDelete(p.id, p.name)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</div></TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredProcesses.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8">Aucun processus trouvé</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};