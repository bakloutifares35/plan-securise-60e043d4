import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ChevronRight, AlertTriangle, Shield, TrendingDown, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useRisk } from "@/contexts/RiskContext";
import { CATEGORY_LABELS, RiskCategory, categoryColor, rawScore, residualScore, scoreLevel, levelLabel } from "@/data/risk";

export const ScenarioLibrary = ({ onOpen }: { onOpen: (id: string) => void }) => {
  const { scenarios } = useRisk();
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<"all" | RiskCategory>("all");
  const [pcaStatus, setPcaStatus] = useState<"all" | "missing" | "present">("all");
  const [levelFilter, setLevelFilter] = useState<"all" | "critical" | "high" | "medium" | "low">("all");

  const filtered = useMemo(() => {
    let filteredScenarios = scenarios;
    if (cat !== "all") {
      filteredScenarios = filteredScenarios.filter((s) => s.category === cat);
    }
    if (search !== "") {
      filteredScenarios = filteredScenarios.filter((s) =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.description.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (pcaStatus !== "all") {
      filteredScenarios = filteredScenarios.filter((s) => {
        const res = residualScore(s);
        const needsPca = res >= 12;
        if (pcaStatus === "missing") return needsPca && !s.associatedPca;
        if (pcaStatus === "present") return s.associatedPca !== undefined && s.associatedPca !== "";
        return true;
      });
    }
    if (levelFilter !== "all") {
      filteredScenarios = filteredScenarios.filter((s) => {
        const lvl = scoreLevel(residualScore(s));
        return lvl === levelFilter;
      });
    }
    return filteredScenarios;
  }, [scenarios, search, cat, pcaStatus, levelFilter]);

  const grouped = useMemo(() => {
    const g: Record<string, typeof scenarios> = {};
    for (const s of filtered) {
      const key = s.category;
      if (!g[key]) g[key] = [];
      g[key].push(s);
    }
    return g;
  }, [filtered]);

  const getProgressColor = (score: number) => {
    if (score >= 20) return "bg-red-600";
    if (score >= 15) return "bg-red-500";
    if (score >= 12) return "bg-orange-500";
    if (score >= 8) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Bibliothèque de scénarios</h1>
        <p className="text-muted-foreground mt-1">Scénarios de risques classés par catégorie</p>
      </div>

      {/* Barre de filtres */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un scénario (nom, description)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={cat} onValueChange={(v) => setCat(v as any)}>
          <SelectTrigger className="md:w-44"><SelectValue placeholder="Catégorie" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            {Object.keys(CATEGORY_LABELS).map((c) => (
              <SelectItem key={c} value={c}>{CATEGORY_LABELS[c as RiskCategory]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={levelFilter} onValueChange={(v) => setLevelFilter(v as any)}>
          <SelectTrigger className="md:w-40"><SelectValue placeholder="Niveau résiduel" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous niveaux</SelectItem>
            <SelectItem value="critical">Critique</SelectItem>
            <SelectItem value="high">Élevé</SelectItem>
            <SelectItem value="medium">Modéré</SelectItem>
            <SelectItem value="low">Faible</SelectItem>
          </SelectContent>
        </Select>
        <Select value={pcaStatus} onValueChange={(v) => setPcaStatus(v as any)}>
          <SelectTrigger className="md:w-44"><SelectValue placeholder="Statut PCA" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="missing">PCA manquant (risque élevé)</SelectItem>
            <SelectItem value="present">Avec PCA</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Affichage des scénarios */}
      <div className="space-y-8">
        {Object.keys(grouped).length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Aucun scénario ne correspond aux filtres.</p>
          </div>
        ) : (
          Object.entries(grouped).map(([category, scs]) => (
            <div key={category}>
              <div className="flex items-center gap-3 mb-3">
                <Badge className={`${categoryColor(category as RiskCategory)} text-xs px-2 py-1`}>
                  {CATEGORY_LABELS[category as RiskCategory] || category}
                </Badge>
                <span className="text-xs text-muted-foreground">{scs.length} scénario(s)</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
                {scs.map((s) => {
                  const raw = rawScore(s);
                  const residual = residualScore(s);
                  const lvl = scoreLevel(residual);
                  const reduction = raw - residual;
                  const reductionPercent = raw > 0 ? Math.round((reduction / raw) * 100) : 0;
                  const needsPca = residual >= 12 && !s.associatedPca;

                  return (
                    <Card
                      key={s.id}
                      className="group cursor-pointer hover:shadow-lg hover:border-primary/40 transition-all duration-200 overflow-hidden"
                      onClick={() => onOpen(s.id)}
                    >
                      <CardContent className="p-0">
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold text-foreground truncate">{s.name}</h3>
                                {needsPca && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                                      </TooltipTrigger>
                                      <TooltipContent>PCA requis non défini</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{s.description}</p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
                          </div>

                          {/* Scores visuels */}
                          <div className="mt-3 space-y-2">
                            <div>
                              <div className="flex justify-between text-[11px] mb-0.5">
                                <span className="text-muted-foreground">Risque brut</span>
                                <span className="font-medium">{raw}/25</span>
                              </div>
                              <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                                <div className={`h-full ${getProgressColor(raw)} transition-all`} style={{ width: `${(raw / 25) * 100}%` }} />
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between text-[11px] mb-0.5">
                                <span className="text-muted-foreground flex items-center gap-1">
                                  Risque résiduel
                                  {reduction > 0 && (
                                    <span className="text-success text-[10px] flex items-center">
                                      <TrendingDown className="h-2.5 w-2.5" /> -{reductionPercent}%
                                    </span>
                                  )}
                                </span>
                                <span className="font-medium">{residual}/25</span>
                              </div>
                              <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                                <div className={`h-full ${getProgressColor(residual)} transition-all`} style={{ width: `${(residual / 25) * 100}%` }} />
                              </div>
                            </div>
                          </div>

                          {/* Badges */}
                          <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
                            <div className="flex gap-2">
                              <Badge variant="outline" className="text-[10px]">
                                Propagation: {s.propagationSpeed || "—"}
                              </Badge>
                              <Badge className={`text-[10px] ${
                                lvl === "critical" ? "bg-destructive/15 text-destructive" :
                                lvl === "high" ? "bg-warning/15 text-warning" :
                                lvl === "medium" ? "bg-accent/15 text-accent" : "bg-success/15 text-success"
                              }`}>
                                {levelLabel(lvl)}
                              </Badge>
                            </div>
                            {s.associatedPca ? (
                              <Badge variant="secondary" className="text-[10px] gap-1">
                                <Shield className="h-2.5 w-2.5" /> {s.associatedPca}
                              </Badge>
                            ) : (
                              residual >= 12 && (
                                <Badge variant="destructive" className="text-[10px] gap-1">
                                  <AlertTriangle className="h-2.5 w-2.5" /> PCA obligatoire
                                </Badge>
                              )
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};