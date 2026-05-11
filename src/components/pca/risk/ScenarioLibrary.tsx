import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ChevronRight, AlertTriangle } from "lucide-react";
import { useRisk } from "@/contexts/RiskContext";
import { CATEGORY_LABELS, RiskCategory, categoryColor, rawScore, residualScore, scoreLevel, levelLabel } from "@/data/risk";

export const ScenarioLibrary = ({ onOpen }: { onOpen: (id: string) => void }) => {
  const { scenarios } = useRisk();
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<"all" | RiskCategory>("all");

  const filtered = useMemo(
    () =>
      scenarios.filter(
        (s) =>
          (cat === "all" || s.category === cat) &&
          (search === "" || s.name.toLowerCase().includes(search.toLowerCase()))
      ),
    [scenarios, search, cat]
  );

  const grouped = useMemo(() => {
    const g: Record<string, typeof scenarios> = {};
    for (const s of filtered) (g[s.category] = g[s.category] || []).push(s);
    return g;
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Bibliothèque de scénarios</h1>
        <p className="text-muted-foreground mt-1">Scénarios de risques classés par catégorie.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher un scénario..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={cat} onValueChange={(v) => setCat(v as any)}>
          <SelectTrigger className="md:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les catégories</SelectItem>
            {(Object.keys(CATEGORY_LABELS) as RiskCategory[]).map((c) => (
              <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-6">
        {(Object.keys(grouped) as RiskCategory[]).map((c) => (
          <div key={c}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${categoryColor(c)}`}>{CATEGORY_LABELS[c]}</span>
              <span className="text-xs text-muted-foreground">{grouped[c].length} scénario(s)</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {grouped[c].map((s) => {
                const raw = rawScore(s);
                const res = residualScore(s);
                const lvl = scoreLevel(res);
                const noPca = res >= 12 && !s.associatedPca;
                return (
                  <Card key={s.id} className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => onOpen(s.id)}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground truncate">{s.name}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{s.description}</p>
                          <div className="flex flex-wrap gap-3 mt-3 text-xs">
                            <span>Brut : <span className="font-semibold">{raw}/25</span></span>
                            <span>Résiduel : <span className="font-semibold">{res}/25</span></span>
                            <span className="text-muted-foreground">Propagation : {s.propagationSpeed}</span>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                          lvl === "critical" ? "bg-destructive/15 text-destructive" :
                          lvl === "high" ? "bg-warning/15 text-warning" :
                          lvl === "medium" ? "bg-accent/15 text-accent" : "bg-success/15 text-success"
                        }`}>{levelLabel(lvl)}</span>
                        {noPca ? (
                          <span className="flex items-center gap-1 text-xs text-destructive">
                            <AlertTriangle className="h-3.5 w-3.5" /> PCA manquant
                          </span>
                        ) : s.associatedPca ? (
                          <span className="text-xs text-muted-foreground">{s.associatedPca}</span>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-12">Aucun scénario trouvé.</p>
        )}
      </div>
    </div>
  );
};
