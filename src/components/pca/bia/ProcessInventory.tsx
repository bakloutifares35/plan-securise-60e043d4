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
  const [expandedEntities, setExpandedEntities] = useState<Set<string>>(new Set());
  const [expandedDirections, setExpandedDirections] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"hierarchy" | "table">("hierarchy");

  const entityName = (id: string) => entities.find((e) => e.id === id)?.name ?? "—";

  // 🔥 Récupérer les entités racines (parent_id = null)
  const rootEntities = useMemo(() => {
    return entities.filter(e => e.parentId === null);
  }, [entities]);

  // 🔥 Récupérer les directions (entités enfants) pour une entité donnée
  const getDirectionsForEntity = (entityId: string) => {
    return entities.filter(e => e.parentId === entityId);
  };

  // 🔥 Fonction pour filtrer les processus (centrale)
  const isProcessVisible = (p: any) => {
    // Recherche
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        p.name.toLowerCase().includes(query) ||
        p.department.toLowerCase().includes(query) ||
        p.owner.toLowerCase().includes(query) ||
        entityName(p.entityId).toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }
    
    // Filtre par criticité
    if (selectedCriticality !== "all") {
      const crit = scoreToCriticality(computeMaxScore(p.impacts));
      if (crit !== selectedCriticality) return false;
    }
    
    return true;
  };

  // 🔥 Récupérer les processus pour une direction donnée avec filtrage
  const getFilteredProcessesForDirection = (directionId: string, directionName: string) => {
    const allProcs = processes.filter(p => p.department === directionName || p.entityId === directionId);
    return allProcs.filter(p => isProcessVisible(p));
  };

  // 🔥 Statistiques basées sur les processus filtrés
  const filteredProcesses = useMemo(() => {
    return processes.filter(p => isProcessVisible(p));
  }, [processes, searchQuery, selectedCriticality, entities]);

  // Statistiques globales
  const stats = {
    total: processes.length,
    filtered: filteredProcesses.length,
    critiques: filteredProcesses.filter(p => computeMaxScore(p.impacts) >= 4).length,
    majeurs: filteredProcesses.filter(p => computeMaxScore(p.impacts) >= 3 && computeMaxScore(p.impacts) < 4).length,
    moderes: filteredProcesses.filter(p => computeMaxScore(p.impacts) >= 2 && computeMaxScore(p.impacts) < 3).length,
    mineurs: filteredProcesses.filter(p => computeMaxScore(p.impacts) < 2).length,
    avgScore: filteredProcesses.reduce((acc, p) => acc + computeMaxScore(p.impacts), 0) / filteredProcesses.length || 0
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Supprimer le processus "${name}" ?`)) {
      deleteProcess(id);
      toast({ title: "Processus supprimé", description: name });
    }
  };

  const toggleEntity = (entityId: string) => {
    const newSet = new Set(expandedEntities);
    if (newSet.has(entityId)) {
      newSet.delete(entityId);
    } else {
      newSet.add(entityId);
    }
    setExpandedEntities(newSet);
  };

  const toggleDirection = (directionId: string) => {
    const newSet = new Set(expandedDirections);
    if (newSet.has(directionId)) {
      newSet.delete(directionId);
    } else {
      newSet.add(directionId);
    }
    setExpandedDirections(newSet);
  };

  const expandAll = () => {
    const allEntities = new Set(rootEntities.map(e => e.id));
    const allDirections = new Set(entities.filter(e => e.parentId !== null).map(e => e.id));
    setExpandedEntities(allEntities);
    setExpandedDirections(allDirections);
  };

  const collapseAll = () => {
    setExpandedEntities(new Set());
    setExpandedDirections(new Set());
  };

  const exportToCSV = () => {
    const headers = ["Nom", "Direction", "Entité", "Responsable", "Criticité", "RTO", "RPO", "MTPD", "MBCO", "Statut"];
    const rows = filteredProcesses.map(p => [
      p.name,
      p.department,
      entityName(p.entityId),
      p.owner,
      scoreToCriticality(computeMaxScore(p.impacts)),
      p.rto,
      p.rpo,
      p.mtpd,
      p.mbco,
      p.status
    ]);
    
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

  // Calculer le score moyen pour une direction
  const getDirectionAvgScore = (procs: typeof processes) => {
    if (procs.length === 0) return 0;
    const sum = procs.reduce((acc, p) => acc + computeMaxScore(p.impacts), 0);
    return (sum / procs.length).toFixed(1);
  };

  // Vérifier si une direction a des processus visibles
  const hasVisibleProcesses = (directionId: string, directionName: string) => {
    return getFilteredProcessesForDirection(directionId, directionName).length > 0;
  };

  // Vérifier si une entreprise a des directions avec des processus visibles
  const hasVisibleContent = (entityId: string) => {
    const directions = getDirectionsForEntity(entityId);
    return directions.some(dir => hasVisibleProcesses(dir.id, dir.name));
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
          <p className="text-muted-foreground mt-1">
            Liste structurée des processus métiers par entreprise et direction
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCSV} className="gap-2">
            <Download className="h-4 w-4" />
            Exporter CSV
          </Button>
          {can("write") && (
            <Button onClick={onCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Nouveau processus
            </Button>
          )}
        </div>
      </div>

      {/* Cartes de statistiques */}
      <div className="grid gap-3 md:grid-cols-6">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-xl font-bold">{stats.filtered}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Critiques</p>
            <p className="text-xl font-bold text-red-600">{stats.critiques}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Majeurs</p>
            <p className="text-xl font-bold text-orange-600">{stats.majeurs}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Modérés</p>
            <p className="text-xl font-bold text-yellow-600">{stats.moderes}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Mineurs</p>
            <p className="text-xl font-bold text-green-600">{stats.mineurs}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Score moyen</p>
            <p className="text-xl font-bold">{stats.avgScore.toFixed(1)}/5</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, direction, responsable..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={selectedCriticality}
              onChange={(e) => setSelectedCriticality(e.target.value)}
              className="h-10 px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value="all">Toutes les criticités</option>
              <option value="Critique">Critique</option>
              <option value="Majeur">Majeur</option>
              <option value="Modéré">Modéré</option>
              <option value="Mineur">Mineur</option>
            </select>
            <div className="flex gap-1">
              <Button 
                variant={viewMode === "hierarchy" ? "default" : "outline"} 
                size="sm"
                onClick={() => setViewMode("hierarchy")}
              >
                Vue hiérarchique
              </Button>
              <Button 
                variant={viewMode === "table" ? "default" : "outline"} 
                size="sm"
                onClick={() => setViewMode("table")}
              >
                Vue tableau
              </Button>
              <Button variant="outline" size="sm" onClick={expandAll}>Tout développer</Button>
              <Button variant="outline" size="sm" onClick={collapseAll}>Tout réduire</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contenu principal */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">
            {viewMode === "hierarchy" ? "Hiérarchie des processus par entreprise" : "Inventaire détaillé des processus"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {viewMode === "hierarchy" ? (
            // Vue hiérarchique : ENTREPRISE → DIRECTION → PROCESSUS
            <div className="space-y-4">
              {rootEntities.map((entity) => {
                const isEntityExpanded = expandedEntities.has(entity.id);
                const directions = getDirectionsForEntity(entity.id);
                // Filtrer les directions qui ont des processus visibles
                const visibleDirections = directions.filter(dir => hasVisibleProcesses(dir.id, dir.name));
                
                // Si l'entreprise n'a aucun processus visible après filtrage, on ne l'affiche pas
                if (visibleDirections.length === 0 && searchQuery) return null;
                
                const totalProcessesForEntity = visibleDirections.reduce((acc, dir) => {
                  return acc + getFilteredProcessesForDirection(dir.id, dir.name).length;
                }, 0);
                const totalCritiquesForEntity = visibleDirections.reduce((acc, dir) => {
                  const procs = getFilteredProcessesForDirection(dir.id, dir.name);
                  return acc + procs.filter(p => computeMaxScore(p.impacts) >= 4).length;
                }, 0);
                
                return (
                  <div key={entity.id} className="border rounded-lg overflow-hidden">
                    {/* NIVEAU 1 : ENTREPRISE */}
                    <button
                      onClick={() => toggleEntity(entity.id)}
                      className="w-full flex items-center justify-between p-4 bg-primary/10 hover:bg-primary/15 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {isEntityExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                        <Building2 className="h-5 w-5 text-primary" />
                        <span className="font-bold text-lg">{entity.name}</span>
                        <Badge variant="outline" className="ml-2">{totalProcessesForEntity} processus</Badge>
                        {totalCritiquesForEntity > 0 && (
                          <Badge className="bg-red-100 text-red-700">⚠️ {totalCritiquesForEntity} critique(s)</Badge>
                        )}
                      </div>
                    </button>
                    
                    {/* NIVEAU 2 : DIRECTIONS (visible si entreprise expandée) */}
                    {isEntityExpanded && (
                      <div className="border-t">
                        {visibleDirections.length === 0 ? (
                          <div className="p-4 text-center text-muted-foreground">
                            Aucune direction dans cette entreprise
                          </div>
                        ) : (
                          visibleDirections.map((direction) => {
                            const isDirectionExpanded = expandedDirections.has(direction.id);
                            const processesForDir = getFilteredProcessesForDirection(direction.id, direction.name);
                            const critCount = processesForDir.filter(p => computeMaxScore(p.impacts) >= 4).length;
                            const avgScore = getDirectionAvgScore(processesForDir);
                            
                            return (
                              <div key={direction.id} className="border-b last:border-b-0">
                                {/* En-tête de direction */}
                                <button
                                  onClick={() => toggleDirection(direction.id)}
                                  className="w-full flex items-center justify-between p-3 bg-muted/20 hover:bg-muted/30 transition-colors pl-10"
                                >
                                  <div className="flex items-center gap-2">
                                    {isDirectionExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                    <span className="font-semibold">{direction.name}</span>
                                    <Badge variant="outline" className="text-xs">{processesForDir.length} processus</Badge>
                                    {critCount > 0 && (
                                      <Badge className="bg-red-100 text-red-700 text-xs">⚠️ {critCount} critique(s)</Badge>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Score moyen: {avgScore}/5
                                  </div>
                                </button>
                                
                                {/* NIVEAU 3 : PROCESSUS (visible si direction expandée) */}
                                {isDirectionExpanded && (
                                  <div className="overflow-auto pl-10">
                                    {processesForDir.length === 0 ? (
                                      <div className="p-4 text-center text-muted-foreground">
                                        Aucun processus dans cette direction
                                      </div>
                                    ) : (
                                      <Table>
                                        <TableHeader>
                                          <TableRow className="bg-muted/10">
                                            <TableHead>Processus</TableHead>
                                            <TableHead>Responsable</TableHead>
                                            <TableHead>RTO</TableHead>
                                            <TableHead>Criticité</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {processesForDir.map((p) => {
                                            const criticality = scoreToCriticality(computeMaxScore(p.impacts));
                                            return (
                                              <TableRow key={p.id} className="hover:bg-muted/30">
                                                <TableCell className="font-medium">{p.name}</TableCell>
                                                <TableCell>{p.owner}</TableCell>
                                                <TableCell>{p.rto}h</TableCell>
                                                <TableCell>
                                                  <Badge className={criticalityColor(criticality)}>{criticality}</Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                  <div className="flex justify-end gap-1">
                                                    <Button size="icon" variant="ghost" onClick={() => onEdit(p.id)}>
                                                      <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    {can("admin") && (
                                                      <Button size="icon" variant="ghost" onClick={() => handleDelete(p.id, p.name)}>
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                      </Button>
                                                    )}
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
              })}
              {rootEntities.length === 0 && (
                <p className="text-center text-muted-foreground py-8">Aucune entreprise trouvée</p>
              )}
            </div>
          ) : (
            // Vue tableau classique (plats) - aussi filtrée
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Processus</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Entreprise</TableHead>
                    <TableHead>Responsable</TableHead>
                    <TableHead className="text-center">RTO</TableHead>
                    <TableHead>Criticité</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProcesses.map((p) => {
                    const criticality = scoreToCriticality(computeMaxScore(p.impacts));
                    const parentEntity = entities.find(e => e.id === p.entityId);
                    const rootEntity = parentEntity ? entities.find(e => e.id === parentEntity.parentId) : null;
                    
                    return (
                      <TableRow key={p.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>{p.department}</TableCell>
                        <TableCell>{rootEntity?.name || parentEntity?.name || "—"}</TableCell>
                        <TableCell>{p.owner}</TableCell>
                        <TableCell className="text-center">{p.rto}h</TableCell>
                        <TableCell>
                          <Badge className={criticalityColor(criticality)}>{criticality}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => onEdit(p.id)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {can("admin") && (
                              <Button size="icon" variant="ghost" onClick={() => handleDelete(p.id, p.name)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredProcesses.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Aucun processus trouvé
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};