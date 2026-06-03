import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStrategy } from "@/contexts/StrategyContext";
import { STRATEGY_ICONS } from "@/data/strategy";
import { AssociationDialog } from "./AssociationDialog";

export const StrategyCatalog = () => {
  const { strategies, associations } = useStrategy();
  const [openFor, setOpenFor] = useState<string | null>(null);

  const counts = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    associations.forEach((a) => {
      if (!m[a.strategyId]) m[a.strategyId] = new Set();
      m[a.strategyId].add(a.processId);
    });
    return m;
  }, [associations]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Catalogue de stratégies</h2>
        <p className="text-sm text-muted-foreground">
          Stratégies de continuité disponibles pour vos processus critiques.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {strategies.map((s) => {
          const Icon = STRATEGY_ICONS[s.iconName];
          const count = counts[s.id]?.size ?? 0;
          return (
            <Card key={s.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base">{s.name}</CardTitle>
                  </div>
                  <Badge variant="secondary">{count} processus</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between gap-4">
                <p className="text-sm text-muted-foreground">{s.description}</p>
                <Button size="sm" onClick={() => setOpenFor(s.id)}>
                  Associer à un processus
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AssociationDialog
        open={openFor !== null}
        onOpenChange={(o) => !o && setOpenFor(null)}
        defaultStrategyId={openFor ?? undefined}
      />
    </div>
  );
};
