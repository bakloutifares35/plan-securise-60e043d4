import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBia } from "@/contexts/BiaContext";
import { computeMaxScore, scoreToCriticality, criticalityColor } from "@/data/bia";

type Pos = { x: number; y: number };

export const DependencyMap = () => {
  const { processes } = useBia();

  const positions = useMemo(() => {
    const map: Record<string, Pos> = {};
    const n = processes.length;
    const cx = 380, cy = 260, r = 200;
    processes.forEach((p, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      map[p.id] = { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    });
    return map;
  }, [processes]);

  const edges = useMemo(() => {
    const list: { from: string; to: string; score: number }[] = [];
    for (const p of processes) {
      for (const dep of p.dependsOn) {
        const target = processes.find((x) => x.id === dep);
        if (!target) continue;
        list.push({ from: p.id, to: dep, score: computeMaxScore(target.impacts) });
      }
    }
    return list;
  }, [processes]);

  const edgeColor = (s: number) => s >= 5 ? "hsl(var(--destructive))" : s >= 4 ? "hsl(var(--warning))" : s >= 3 ? "hsl(var(--accent))" : "hsl(var(--muted-foreground))";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Carte des dépendances</h1>
        <p className="text-muted-foreground mt-1">Graphe interactif des dépendances entre processus métier.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-lg">Graphe des dépendances</CardTitle></CardHeader>
        <CardContent>
          <div className="w-full overflow-auto">
            <svg viewBox="0 0 760 520" className="w-full h-[520px]">
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--muted-foreground))" />
                </marker>
                <marker id="arrow-d" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--destructive))" />
                </marker>
                <marker id="arrow-w" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--warning))" />
                </marker>
              </defs>
              {edges.map((e, i) => {
                const a = positions[e.from], b = positions[e.to];
                if (!a || !b) return null;
                const marker = e.score >= 5 ? "url(#arrow-d)" : e.score >= 4 ? "url(#arrow-w)" : "url(#arrow)";
                return (
                  <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke={edgeColor(e.score)} strokeWidth={e.score >= 4 ? 2.5 : 1.5} markerEnd={marker} opacity={0.8} />
                );
              })}
              {processes.map((p) => {
                const pos = positions[p.id];
                const c = scoreToCriticality(computeMaxScore(p.impacts));
                const fill = c === "Critique" ? "hsl(var(--destructive))" : c === "Majeur" ? "hsl(var(--warning))" : c === "Modéré" ? "hsl(var(--accent))" : "hsl(var(--success))";
                return (
                  <g key={p.id}>
                    <circle cx={pos.x} cy={pos.y} r={28} fill={fill} opacity={0.9} stroke="hsl(var(--card))" strokeWidth={3} />
                    <text x={pos.x} y={pos.y + 4} textAnchor="middle" className="fill-white text-[10px] font-semibold pointer-events-none">{p.id}</text>
                    <text x={pos.x} y={pos.y + 50} textAnchor="middle" className="fill-foreground text-[11px] font-medium" style={{ fill: "hsl(var(--foreground))" }}>{p.name.length > 22 ? p.name.slice(0, 22) + "…" : p.name}</text>
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="flex flex-wrap gap-2 mt-4 text-xs">
            {(["Critique", "Majeur", "Modéré", "Mineur"] as const).map((c) => (
              <span key={c} className={`px-2 py-0.5 rounded font-medium ${criticalityColor(c)}`}>{c}</span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
