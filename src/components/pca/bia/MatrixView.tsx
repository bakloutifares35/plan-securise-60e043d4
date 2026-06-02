import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  Filter, 
  Download, 
  TrendingUp, 
  AlertTriangle, 
  ShieldAlert,
  Eye,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Sparkles
} from "lucide-react";
import { useBia } from "@/contexts/BiaContext";
import { PERIODS, periodMaxScore, scoreCellColor, computeMaxScore, scoreToCriticality, criticalityColor } from "@/data/bia";

export const MatrixView = () => {
  const { processes } = useBia();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "criticality">("criticality");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [filterCriticality, setFilterCriticality] = useState<string>("all");

  // Filtrer et trier les processus
  const filteredProcesses = processes
    .filter(proc => {
      const matchesSearch = proc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           proc.department.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCriticality = filterCriticality === "all" || 
                                 scoreToCriticality(computeMaxScore(proc.impacts)) === filterCriticality;
      return matchesSearch && matchesCriticality;
    })
    .sort((a, b) => {
      if (sortBy === "name") {
        return sortOrder === "asc" 
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      } else {
        const scoreA = computeMaxScore(a.impacts);
        const scoreB = computeMaxScore(b.impacts);
        return sortOrder === "asc" ? scoreA - scoreB : scoreB - scoreA;
      }
    });

  // Statistiques globales
  const stats = {
    total: processes.length,
    critiques: processes.filter(p => computeMaxScore(p.impacts) >= 4).length,
    majeurs: processes.filter(p => computeMaxScore(p.impacts) >= 3 && computeMaxScore(p.impacts) < 4).length,
    moderes: processes.filter(p => computeMaxScore(p.impacts) >= 2 && computeMaxScore(p.impacts) < 3).length,
    mineurs: processes.filter(p => computeMaxScore(p.impacts) < 2).length,
    avgScore: processes.reduce((acc, p) => acc + computeMaxScore(p.impacts), 0) / processes.length || 0
  };

  const exportToCSV = () => {
    const headers = ["Processus", "Direction", ...PERIODS.map(p => p.label), "Criticité", "Score"];
    const rows = processes.map(proc => [
      proc.name,
      proc.department,
      ...PERIODS.map(p => periodMaxScore(proc.impacts, p.id).toString()),
      scoreToCriticality(computeMaxScore(proc.impacts)),
      computeMaxScore(proc.impacts).toString()
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "matrice_impact_bia.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-primary" />
            Vue matricielle
          </h1>
          <p className="text-muted-foreground mt-1">
            Analyse des impacts par processus et période d'indisponibilité
          </p>
        </div>
        <Button variant="outline" onClick={exportToCSV} className="gap-2">
          <Download className="h-4 w-4" />
          Exporter CSV
        </Button>
      </div>

      {/* Cartes de synthèse */}
      <div className="grid gap-3 md:grid-cols-5">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-200">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Total processus</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-200">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Critiques</p>
            <p className="text-2xl font-bold text-red-600">{stats.critiques}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-200">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Majeurs</p>
            <p className="text-2xl font-bold text-orange-600">{stats.majeurs}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 border-yellow-200">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Modérés</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.moderes}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-200">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Score moyen</p>
            <p className="text-2xl font-bold text-green-600">{stats.avgScore.toFixed(1)}/5</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtres et recherche */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un processus ou une direction..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={filterCriticality}
                onChange={(e) => setFilterCriticality(e.target.value)}
                className="h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="all">Toutes les criticités</option>
                <option value="Critique">Critique</option>
                <option value="Majeur">Majeur</option>
                <option value="Modéré">Modéré</option>
                <option value="Mineur">Mineur</option>
              </select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  if (sortBy === "criticality") {
                    setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                  } else {
                    setSortBy("criticality");
                    setSortOrder("desc");
                  }
                }}
                className={sortBy === "criticality" ? "bg-primary/10" : ""}
              >
                <TrendingUp className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  if (sortBy === "name") {
                    setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                  } else {
                    setSortBy("name");
                    setSortOrder("asc");
                  }
                }}
                className={sortBy === "name" ? "bg-primary/10" : ""}
              >
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Matrice principale */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Matrice des impacts</span>
            <span className="text-xs font-normal text-muted-foreground">
              {filteredProcesses.length} / {processes.length} processus affichés
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="min-w-[200px] sticky left-0 bg-muted/50">
                  Processus / Direction
                </TableHead>
                {PERIODS.map((p) => (
                  <TableHead key={p.id} className="text-center min-w-[60px]">
                    <div className="text-xs">{p.label}</div>
                    <div className="text-[10px] text-muted-foreground font-normal">
                      {p.hours <= 24 ? `${p.hours}h` : `${Math.round(p.hours/24)}j`}
                    </div>
                  </TableHead>
                ))}
                <TableHead className="text-center min-w-[80px]">Criticité</TableHead>
                <TableHead className="text-center min-w-[60px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProcesses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={PERIODS.length + 3} className="text-center py-8 text-muted-foreground">
                    Aucun processus trouvé
                  </TableCell>
                </TableRow>
              ) : (
                filteredProcesses.map((proc) => {
                  const criticality = scoreToCriticality(computeMaxScore(proc.impacts));
                  const maxScore = computeMaxScore(proc.impacts);
                  
                  return (
                    <TableRow key={proc.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium sticky left-0 bg-background">
                        <p className="text-sm font-semibold">{proc.name}</p>
                        <p className="text-xs text-muted-foreground">{proc.department}</p>
                      </TableCell>
                      {PERIODS.map((p) => {
                        const score = periodMaxScore(proc.impacts, p.id);
                        return (
                          <TableCell key={p.id} className="text-center p-1">
                            <div className={cn(
                              "inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold transition-all",
                              score >= 5 ? "bg-red-500 text-white shadow-md" :
                              score >= 4 ? "bg-orange-500 text-white" :
                              score >= 3 ? "bg-yellow-500 text-black" :
                              score >= 2 ? "bg-green-500 text-white" :
                              "bg-gray-200 text-gray-600"
                            )}>
                              {score}
                            </div>
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center">
                        <Badge className={criticalityColor(criticality)}>
                          {criticality}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {/* Légende */}
          <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t justify-center">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-500" />
              <span className="text-xs">5 - Catastrophique</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-orange-500" />
              <span className="text-xs">4 - Majeur</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-yellow-500" />
              <span className="text-xs">3 - Modéré</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500" />
              <span className="text-xs">2 - Mineur</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-gray-300" />
              <span className="text-xs">1 - Négligeable</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Insights pour le consultant */}
      <Card className="bg-gradient-to-r from-primary/5 to-accent/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-semibold">Analyse rapide</p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.critiques > 0 
                  ? `⚠️ ${stats.critiques} processus critique(s) nécessitent un PCA prioritaire. Les impacts les plus élevés se concentrent sur les premières heures (0-4h).`
                  : `✅ Aucun processus critique. Le niveau de maturité BCM est satisfaisant.`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Helper pour les classes conditionnelles
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}