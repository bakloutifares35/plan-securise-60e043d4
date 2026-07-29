import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, 
  Filter, 
  Download, 
  TrendingUp, 
  AlertTriangle, 
  ShieldAlert,
  Eye,
  ChevronDown,
  ChevronRight,
  BarChart3,
  Sparkles,
  ChevronUp,
  Layers
} from "lucide-react";
import { useBia } from "@/contexts/BiaContext";
import { PERIODS, periodMaxScore, computeMaxScore, scoreToCriticality, criticalityColor } from "@/data/bia";
import { cn } from "@/lib/utils";

// ============================================================
// CONSTANTES
// ============================================================

type ImpactAxis = "Financier" | "Conformité / Légal" | "Opérationnel" | "Réputationnel";

const IMPACT_AXES: { id: ImpactAxis; label: string; icon: string }[] = [
  { id: "Financier", label: "Financier", icon: "💰" },
  { id: "Conformité / Légal", label: "Conformité / Légal", icon: "⚖️" },
  { id: "Opérationnel", label: "Opérationnel", icon: "⚙️" },
  { id: "Réputationnel", label: "Réputationnel", icon: "📢" },
];

// Styles pastel pour les scores (identiques à la matrice d'impact)
const SEVERITY_PASTEL_STYLES: Record<number, { bg: string; text: string; border: string; label: string }> = {
  0: { bg: "#F5F5F5", text: "#9E9E9E", border: "#E0E0E0", label: "Aucun" },
  1: { bg: "#E8F5E9", text: "#2E7D32", border: "#A5D6A7", label: "Mineur" },
  2: { bg: "#FFF8E1", text: "#F57F17", border: "#FFE082", label: "Modéré" },
  3: { bg: "#FFF3E0", text: "#E65100", border: "#FFCC80", label: "Majeur" },
  4: { bg: "#FBE9E7", text: "#D84315", border: "#FFAB91", label: "Sévère" },
  5: { bg: "#FFEBEE", text: "#C62828", border: "#EF9A9A", label: "Très sévère" },
};

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================

export const MatrixView = () => {
  const { processes } = useBia();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "criticality">("criticality");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [filterCriticality, setFilterCriticality] = useState<string>("all");
  
  // NOUVEAU: Sélecteur d'axe pour la vue
  const [selectedAxis, setSelectedAxis] = useState<ImpactAxis | "global">("global");
  
  // NOUVEAU: État pour les lignes dépliées (drill-down par processus)
  const [expandedProcesses, setExpandedProcesses] = useState<Set<string>>(new Set());

  // ============================================================
  // FONCTIONS DE CALCUL
  // ============================================================

  // Récupérer la valeur d'un axe spécifique pour une période donnée
  const getAxisValue = (impacts: any, periodId: string, axis: ImpactAxis): number => {
    if (!impacts) return 0;
    const periodData = impacts[periodId];
    if (!periodData || typeof periodData !== 'object') return 0;
    // Les axes sont stockés avec des clés en anglais dans les données
    const axisMap: Record<string, string> = {
      "Financier": "financial",
      "Conformité / Légal": "regulatory",
      "Opérationnel": "operational",
      "Réputationnel": "reputation",
    };
    const key = axisMap[axis] || axis;
    const value = periodData[key];
    return typeof value === 'number' ? value : parseInt(String(value)) || 0;
  };

  // Calcul du score pour une cellule selon la vue sélectionnée
  const getCellScore = (impacts: any, periodId: string, axis: ImpactAxis | "global"): number => {
    if (axis === "global") {
      return periodMaxScore(impacts, periodId as any);
    }
    return getAxisValue(impacts, periodId, axis);
  };

  // Calcul du score max pour un processus selon la vue sélectionnée
  const getProcessMaxScore = (impacts: any, axis: ImpactAxis | "global"): number => {
    if (axis === "global") {
      return computeMaxScore(impacts);
    }
    let maxScore = 0;
    for (const period of PERIODS) {
      const value = getAxisValue(impacts, period.id, axis);
      if (value > maxScore) maxScore = value;
    }
    return maxScore;
  };

  // ============================================================
  // FILTRAGE ET TRI
  // ============================================================

  const filteredProcesses = processes
    .filter(proc => {
      const matchesSearch = proc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           proc.department.toLowerCase().includes(searchTerm.toLowerCase());
      const maxScore = getProcessMaxScore(proc.impacts, selectedAxis);
      const criticality = scoreToCriticality(maxScore);
      const matchesCriticality = filterCriticality === "all" || criticality === filterCriticality;
      return matchesSearch && matchesCriticality;
    })
    .sort((a, b) => {
      if (sortBy === "name") {
        return sortOrder === "asc" 
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      } else {
        const scoreA = getProcessMaxScore(a.impacts, selectedAxis);
        const scoreB = getProcessMaxScore(b.impacts, selectedAxis);
        return sortOrder === "asc" ? scoreA - scoreB : scoreB - scoreA;
      }
    });

  // ============================================================
  // STATISTIQUES
  // ============================================================

  const stats = {
    total: processes.length,
    critiques: processes.filter(p => getProcessMaxScore(p.impacts, selectedAxis) >= 4).length,
    majeurs: processes.filter(p => getProcessMaxScore(p.impacts, selectedAxis) >= 3 && getProcessMaxScore(p.impacts, selectedAxis) < 4).length,
    moderes: processes.filter(p => getProcessMaxScore(p.impacts, selectedAxis) >= 2 && getProcessMaxScore(p.impacts, selectedAxis) < 3).length,
    mineurs: processes.filter(p => getProcessMaxScore(p.impacts, selectedAxis) < 2).length,
    avgScore: processes.reduce((acc, p) => acc + getProcessMaxScore(p.impacts, selectedAxis), 0) / processes.length || 0
  };

  // ============================================================
  // EXPORT CSV - TOUJOURS AVEC LES 4 AXES EN DÉTAIL
  // ============================================================

  const exportToCSV = () => {
    const axesLabels = ["Financier", "Conformité/Légal", "Opérationnel", "Réputationnel"];
    
    // En-têtes avec tous les axes pour chaque période
    let headers = ["Processus", "Direction"];
    for (const period of PERIODS) {
      for (const axis of axesLabels) {
        headers.push(`${period.label} - ${axis}`);
      }
    }
    headers.push("Criticité globale", "Score global");

    const rows = processes.map(proc => {
      const row = [proc.name, proc.department];
      for (const period of PERIODS) {
        for (const axis of axesLabels) {
          const value = getAxisValue(proc.impacts, period.id, axis as ImpactAxis);
          row.push(value.toString());
        }
      }
      const maxScore = computeMaxScore(proc.impacts);
      row.push(scoreToCriticality(maxScore));
      row.push(maxScore.toString());
      return row;
    });
    
    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "matrice_impact_bia_complete.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ============================================================
  // TOGGLE D'EXPANSION
  // ============================================================

  const toggleProcessExpand = (processId: string) => {
    setExpandedProcesses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(processId)) {
        newSet.delete(processId);
      } else {
        newSet.add(processId);
      }
      return newSet;
    });
  };

  // ============================================================
  // RENDU
  // ============================================================

  const getCellStyle = (score: number) => {
    const style = SEVERITY_PASTEL_STYLES[score] || SEVERITY_PASTEL_STYLES[0];
    return {
      backgroundColor: style.bg,
      color: style.text,
      borderColor: style.border,
    };
  };

  // Vérifier si on est en vue "global"
  const isGlobalView = selectedAxis === "global";

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#172030] flex items-center gap-2" style={{ fontFamily: "Playfair Display, serif" }}>
            <BarChart3 className="h-7 w-7 text-[#2A5141]" />
            Vue matricielle
          </h1>
          <p className="text-[#172030]/50 mt-1 text-sm">
            Analyse des impacts par processus et période d'indisponibilité
            {!isGlobalView && ` — Vue par axe : ${IMPACT_AXES.find(a => a.id === selectedAxis)?.label}`}
          </p>
        </div>
        <Button variant="outline" onClick={exportToCSV} className="gap-2 border-[#E8E4DC] text-[#172030]/60 hover:text-[#172030]">
          <Download className="h-4 w-4" />
          Exporter CSV (4 axes)
        </Button>
      </div>

      {/* Cartes de synthèse */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        <Card className="bg-white border-[#E8E4DC] shadow-sm">
          <CardContent className="p-3">
            <p className="text-[10px] font-semibold text-[#172030]/40 uppercase tracking-wider">Total processus</p>
            <p className="text-2xl font-bold text-[#172030]" style={{ fontFamily: "Playfair Display, serif" }}>{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E8E4DC] shadow-sm">
          <CardContent className="p-3">
            <p className="text-[10px] font-semibold text-[#172030]/40 uppercase tracking-wider">Critiques</p>
            <p className="text-2xl font-bold text-[#C62828]" style={{ fontFamily: "Playfair Display, serif" }}>{stats.critiques}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E8E4DC] shadow-sm">
          <CardContent className="p-3">
            <p className="text-[10px] font-semibold text-[#172030]/40 uppercase tracking-wider">Majeurs</p>
            <p className="text-2xl font-bold text-[#E65100]" style={{ fontFamily: "Playfair Display, serif" }}>{stats.majeurs}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E8E4DC] shadow-sm">
          <CardContent className="p-3">
            <p className="text-[10px] font-semibold text-[#172030]/40 uppercase tracking-wider">Modérés</p>
            <p className="text-2xl font-bold text-[#F57F17]" style={{ fontFamily: "Playfair Display, serif" }}>{stats.moderes}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E8E4DC] shadow-sm">
          <CardContent className="p-3">
            <p className="text-[10px] font-semibold text-[#172030]/40 uppercase tracking-wider">Score moyen</p>
            <p className="text-2xl font-bold text-[#2A5141]" style={{ fontFamily: "Playfair Display, serif" }}>{stats.avgScore.toFixed(1)}/5</p>
          </CardContent>
        </Card>
      </div>

      {/* ============================================================
          SÉLECTEUR DE VUE (AXE)
          ============================================================ */}
      <Card className="border-[#E8E4DC] shadow-sm bg-white">
        <CardContent className="p-3">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#172030]/40" />
              <span className="text-xs font-medium text-[#172030]/50 uppercase tracking-wider">Vue :</span>
            </div>
            <Tabs 
              value={selectedAxis} 
              onValueChange={(v) => setSelectedAxis(v as ImpactAxis | "global")}
              className="flex-1"
            >
              <TabsList className="bg-[#F8F6F2] border border-[#E8E4DC] p-0.5 h-auto flex-wrap">
                <TabsTrigger 
                  value="global" 
                  className="text-xs px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#2A5141]"
                >
                  🌐 Global
                </TabsTrigger>
                {IMPACT_AXES.map((axis) => (
                  <TabsTrigger 
                    key={axis.id} 
                    value={axis.id}
                    className="text-xs px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#2A5141]"
                  >
                    {axis.icon} {axis.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Filtres et recherche */}
      <Card className="border-[#E8E4DC] shadow-sm bg-white">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#172030]/40" />
              <Input
                placeholder="Rechercher un processus ou une direction..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 border-[#E8E4DC] focus:border-[#2A5141] focus:ring-[#2A5141]/20"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <select
                value={filterCriticality}
                onChange={(e) => setFilterCriticality(e.target.value)}
                className="h-10 px-3 rounded-md border border-[#E8E4DC] bg-white text-sm text-[#172030] focus:border-[#2A5141] focus:ring-[#2A5141]/20"
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
                className={cn(
                  "border-[#E8E4DC] hover:border-[#2A5141]",
                  sortBy === "criticality" ? "bg-[#2A5141]/10 border-[#2A5141]" : ""
                )}
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
                className={cn(
                  "border-[#E8E4DC] hover:border-[#2A5141]",
                  sortBy === "name" ? "bg-[#2A5141]/10 border-[#2A5141]" : ""
                )}
              >
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ============================================================
          MATRICE PRINCIPALE AVEC DRILL-DOWN
          ============================================================ */}
      <Card className="border-[#E8E4DC] shadow-sm bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center justify-between text-[#172030]" style={{ fontFamily: "Playfair Display, serif" }}>
            <span>Matrice des impacts</span>
            <span className="text-xs font-normal text-[#172030]/40">
              {filteredProcesses.length} / {processes.length} processus affichés
              {!isGlobalView && ` · Axe: ${IMPACT_AXES.find(a => a.id === selectedAxis)?.label}`}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto p-0 px-4 pb-4">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#F8F6F2] border-b border-[#E8E4DC]">
                <TableHead className="min-w-[220px] sticky left-0 bg-[#F8F6F2]">
                  <span className="text-[10px] font-semibold text-[#172030]/40 uppercase tracking-wider">Processus / Direction</span>
                </TableHead>
                {PERIODS.map((p) => (
                  <TableHead key={p.id} className="text-center min-w-[60px]">
                    <div className="text-xs font-medium text-[#172030]">{p.label}</div>
                    <div className="text-[9px] text-[#172030]/40 font-normal">
                      {p.hours <= 24 ? `${p.hours}h` : `${Math.round(p.hours/24)}j`}
                    </div>
                  </TableHead>
                ))}
                <TableHead className="text-center min-w-[80px]">
                  <span className="text-[10px] font-semibold text-[#172030]/40 uppercase tracking-wider">Criticité</span>
                </TableHead>
                <TableHead className="text-center min-w-[40px]">
                  <span className="text-[10px] font-semibold text-[#172030]/40 uppercase tracking-wider">Détail</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProcesses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={PERIODS.length + 3} className="text-center py-8 text-[#172030]/30">
                    Aucun processus trouvé
                  </TableCell>
                </TableRow>
              ) : (
                filteredProcesses.map((proc) => {
                  const maxScore = getProcessMaxScore(proc.impacts, selectedAxis);
                  const criticality = scoreToCriticality(maxScore);
                  const isExpanded = expandedProcesses.has(proc.id);
                  const canExpand = isGlobalView; // Drill-down disponible uniquement en vue globale

                  return (
                    <>
                      {/* Ligne principale */}
                      <TableRow 
                        key={proc.id} 
                        className={cn(
                          "hover:bg-[#FAFAF9] transition-colors border-b border-[#E8E4DC]",
                          isExpanded && "bg-[#F8F6F2]"
                        )}
                      >
                        <TableCell className="font-medium sticky left-0 bg-inherit">
                          <div className="flex items-center gap-2">
                            {canExpand && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-[#172030]/40 hover:text-[#172030]"
                                onClick={() => toggleProcessExpand(proc.id)}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                            <div>
                              <p className="text-sm font-semibold text-[#172030]">{proc.name}</p>
                              <p className="text-xs text-[#172030]/50">{proc.department}</p>
                            </div>
                          </div>
                        </TableCell>
                        {PERIODS.map((p) => {
                          const score = getCellScore(proc.impacts, p.id, selectedAxis);
                          const style = getCellStyle(score);
                          return (
                            <TableCell key={p.id} className="text-center p-1">
                              <div 
                                className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-sm font-bold border transition-all"
                                style={{
                                  backgroundColor: style.backgroundColor,
                                  color: style.color,
                                  borderColor: style.borderColor,
                                }}
                              >
                                {score}
                              </div>
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center">
                          <Badge className={cn("text-[10px] px-2 py-0.5 h-5 border", criticalityColor(criticality))}>
                            {criticality}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-[#172030]/30 hover:text-[#172030]"
                            onClick={() => {
                              // Action pour voir les détails du processus
                              window.dispatchEvent(new CustomEvent('openProcessDetail', { 
                                detail: { processId: proc.id } 
                              }));
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>

                      {/* Sous-lignes dépliées (axes) - UNIQUEMENT en vue globale */}
                      {isExpanded && isGlobalView && (
                        IMPACT_AXES.map((axis) => {
                          const axisMaxScore = getProcessMaxScore(proc.impacts, axis.id);
                          return (
                            <TableRow 
                              key={`${proc.id}-${axis.id}`} 
                              className="bg-[#FAFAF9] border-b border-[#E8E4DC]/50 hover:bg-[#F5F5F3] transition-colors"
                            >
                              <TableCell className="sticky left-0 bg-inherit pl-10">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-[#172030]/50">{axis.icon}</span>
                                  <span className="text-xs text-[#172030]/60">{axis.label}</span>
                                  <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-4 border-[#E8E4DC] text-[#172030]/40">
                                    {axisMaxScore}/5
                                  </Badge>
                                </div>
                              </TableCell>
                              {PERIODS.map((p) => {
                                const score = getAxisValue(proc.impacts, p.id, axis.id);
                                const style = getCellStyle(score);
                                return (
                                  <TableCell key={p.id} className="text-center p-1">
                                    <div 
                                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-medium border"
                                      style={{
                                        backgroundColor: style.backgroundColor,
                                        color: style.text,
                                        borderColor: style.borderColor,
                                      }}
                                    >
                                      {score}
                                    </div>
                                  </TableCell>
                                );
                              })}
                              <TableCell className="text-center">
                                <span className="text-xs text-[#172030]/30">—</span>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="text-xs text-[#172030]/30">—</span>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </>
                  );
                })
              )}
            </TableBody>
          </Table>

          {/* Légende */}
          <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-[#E8E4DC] justify-center">
            {Object.entries(SEVERITY_PASTEL_STYLES).map(([score, style]) => (
              <div key={score} className="flex items-center gap-1.5">
                <div 
                  className="w-4 h-4 rounded border"
                  style={{ backgroundColor: style.bg, borderColor: style.border }}
                />
                <span className="text-[10px] text-[#172030]/50">
                  {score} — {style.label}
                </span>
              </div>
            ))}
          </div>

          {/* Légende pour le drill-down */}
          {isGlobalView && (
            <div className="flex items-center gap-4 mt-3 text-[10px] text-[#172030]/40 border-t border-[#E8E4DC] pt-3">
              <span className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3" />
                Cliquez sur l'icône pour déplier les 4 axes d'impact
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-[#FAFAF9] border border-[#E8E4DC]" />
                Lignes d'axes détaillées
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Insights */}
      <Card className="bg-gradient-to-r from-[#2A5141]/5 to-[#2A5141]/10 border-[#2A5141]/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-[#2A5141] mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[#172030]">Analyse rapide</p>
              <p className="text-xs text-[#172030]/60 mt-1">
                {stats.critiques > 0 
                  ? `⚠️ ${stats.critiques} processus critique${stats.critiques > 1 ? 's' : ''} nécessitent un PCA prioritaire. Les impacts les plus élevés se concentrent sur les premières heures (0-4h).`
                  : `✅ Aucun processus critique. Le niveau de maturité BCM est satisfaisant.`}
                {!isGlobalView && ` — Vue actuelle : ${IMPACT_AXES.find(a => a.id === selectedAxis)?.label}`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};