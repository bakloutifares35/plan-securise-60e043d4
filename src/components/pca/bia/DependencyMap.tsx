import { useMemo, useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useBia } from "@/contexts/BiaContext";
import { computeMaxScore, scoreToCriticality, criticalityColor, type Criticality } from "@/data/bia";
import {
  GitBranch,
  TrendingUp,
  Clock,
  Database,
  AlertTriangle,
  ShieldAlert,
  Building2,
  X,
  Save,
  Edit3,
  Network,
  Link2,
  Unlink,
  Activity,
  ArrowUpRight,
  ArrowDownLeft,
  List as ListIcon,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/resillia/client";
import { toast } from "sonner";

type Pos = { x: number; y: number };

// ============================================================
// CHARTE RESILLIA
// ============================================================
const COLORS = {
  navy: "#172030",
  cream: "#F8F6F2",
  forest: "#2A5141",
  forestSoft: "#4A6B5C",
  border: "#E8E4DC",
  text: "#172030",
  textMuted: "#6B7280",
  white: "#FFFFFF",
};

const CRITICALITY_COLORS: Record<Criticality, string> = {
  Critique: "#E24B4A",
  Majeur: "#EF9F27",
  Modéré: "#F5D061",
  Mineur: "#639922",
};

const CRITICALITY_SOFT: Record<Criticality, string> = {
  Critique: "#FBE9E7",
  Majeur: "#FFF3E0",
  Modéré: "#FFF8E1",
  Mineur: "#E8F5E9",
};

// ============================================================
// TYPES UTILITAIRES
// ============================================================
interface Edge {
  from: string;
  to: string;
  score: number;
  fromName: string;
  toName: string;
}

type SortKey = "name" | "criticality" | "incoming" | "outgoing" | "total";
type SortDir = "asc" | "desc";

const CRITICALITY_ORDER: Record<Criticality, number> = {
  Critique: 4,
  Majeur: 3,
  Modéré: 2,
  Mineur: 1,
};

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================
export const DependencyMap = () => {
  const { processes, setProcesses } = useBia();
  const [selectedProcess, setSelectedProcess] = useState<any | null>(null);
  const [hoveredProcess, setHoveredProcess] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedDependsOn, setEditedDependsOn] = useState<string[]>([]);

  const [viewMode, setViewMode] = useState<"graph" | "list">("graph");
  const [showAllProcesses, setShowAllProcesses] = useState(false);
  const [isolatedId, setIsolatedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [sortKey, setSortKey] = useState<SortKey>("criticality");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Zoom uniquement — pas de pan, pas de molette
  const [zoom, setZoom] = useState(1);
  const svgRef = useRef<SVGSVGElement>(null);

  // ============================================================
  // DÉPENDANCES : AMONT (incoming) et AVAL (outgoing)
  // ============================================================
  const { incomingEdges, outgoingEdges, allEdges } = useMemo(() => {
    const incoming: Edge[] = [];
    const outgoing: Edge[] = [];
    const all: (Edge & { type: "incoming" | "outgoing" })[] = [];

    for (const p of processes) {
      const deps = p.dependsOn || [];
      for (const depId of deps) {
        const target = processes.find((x) => x.id === depId);
        if (!target) continue;

        incoming.push({
          from: p.id,
          to: depId,
          score: computeMaxScore(target.impacts),
          fromName: p.name,
          toName: target.name,
        });

        all.push({
          from: p.id,
          to: depId,
          score: computeMaxScore(target.impacts),
          fromName: p.name,
          toName: target.name,
          type: "incoming",
        });
      }
    }

    for (const p of processes) {
      const dependents = processes.filter((x) => (x.dependsOn || []).includes(p.id));
      for (const dep of dependents) {
        outgoing.push({
          from: p.id,
          to: dep.id,
          score: computeMaxScore(dep.impacts),
          fromName: p.name,
          toName: dep.name,
        });

        const existing = all.find((e) => e.from === p.id && e.to === dep.id);
        if (!existing) {
          all.push({
            from: p.id,
            to: dep.id,
            score: computeMaxScore(dep.impacts),
            fromName: p.name,
            toName: dep.name,
            type: "outgoing",
          });
        }
      }
    }

    return { incomingEdges: incoming, outgoingEdges: outgoing, allEdges: all };
  }, [processes]);

  // ============================================================
  // STATISTIQUES DES DÉPENDANCES
  // ============================================================
  const dependencyStats = useMemo(() => {
    const incomingCount: Record<string, number> = {};
    const outgoingCount: Record<string, number> = {};

    for (const edge of incomingEdges) {
      incomingCount[edge.to] = (incomingCount[edge.to] || 0) + 1;
    }
    for (const edge of outgoingEdges) {
      outgoingCount[edge.from] = (outgoingCount[edge.from] || 0) + 1;
    }

    return { incomingCount, outgoingCount };
  }, [incomingEdges, outgoingEdges]);

  // ============================================================
  // VUES FILTRÉES
  // ============================================================
  const focusVisibleIds = useMemo(() => {
    if (showAllProcesses) return new Set(processes.map((p) => p.id));
    const ids = new Set<string>();
    for (const p of processes) {
      const score = computeMaxScore(p.impacts);
      if (score >= 3) ids.add(p.id);
    }
    return ids;
  }, [processes, showAllProcesses]);

  const renderedNodes = useMemo(() => {
    if (showAllProcesses) return processes;
    const visibleIds = new Set<string>(focusVisibleIds);
    for (const p of processes) {
      if (focusVisibleIds.has(p.id)) {
        for (const depId of p.dependsOn || []) visibleIds.add(depId);
        for (const dep of processes) {
          if ((dep.dependsOn || []).includes(p.id)) visibleIds.add(dep.id);
        }
      }
    }
    return processes.filter((p) => visibleIds.has(p.id));
  }, [processes, focusVisibleIds, showAllProcesses]);

  const renderedNodeIds = useMemo(() => new Set(renderedNodes.map((p) => p.id)), [renderedNodes]);

  const renderedIncomingEdges = useMemo(
    () => incomingEdges.filter((e) => renderedNodeIds.has(e.from) && renderedNodeIds.has(e.to)),
    [incomingEdges, renderedNodeIds]
  );

  const renderedOutgoingEdges = useMemo(
    () => outgoingEdges.filter((e) => renderedNodeIds.has(e.from) && renderedNodeIds.has(e.to)),
    [outgoingEdges, renderedNodeIds]
  );

  // ============================================================
  // RÉPARTITION SPATIALE EN ANNEAUX CONCENTRIQUES (resserrés)
  // ============================================================
  const positions = useMemo(() => {
    const map: Record<string, Pos> = {};
    const cx = 500;
    const cy = 340;

    const rings: Record<Criticality, any[]> = {
      Critique: [],
      Majeur: [],
      Modéré: [],
      Mineur: [],
    };
    for (const p of renderedNodes) {
      const c = scoreToCriticality(computeMaxScore(p.impacts));
      rings[c].push(p);
    }

    const ringConfig: { key: Criticality; radius: number }[] = [
      { key: "Critique", radius: 70 },
      { key: "Majeur", radius: 140 },
      { key: "Modéré", radius: 215 },
      { key: "Mineur", radius: 290 },
    ];

    for (const { key, radius } of ringConfig) {
      const items = rings[key];
      const n = items.length;
      if (n === 0) continue;

      if (n === 1) {
        map[items[0].id] = { x: cx, y: cy - radius };
        continue;
      }

      const startAngle =
        -Math.PI / 2 +
        (key === "Majeur" ? Math.PI / n : key === "Modéré" ? (2 * Math.PI) / (n * 2) : 0);

      items.forEach((p, i) => {
        const angle = startAngle + (i / n) * Math.PI * 2;
        map[p.id] = {
          x: cx + radius * Math.cos(angle),
          y: cy + radius * Math.sin(angle),
        };
      });
    }

    return map;
  }, [renderedNodes]);

  // ============================================================
  // MODE ISOLATION
  // ============================================================
  const isolationNeighbors = useMemo(() => {
    if (!isolatedId) return null;
    const neighbors = new Set<string>([isolatedId]);
    for (const p of processes) {
      if (p.id === isolatedId) {
        for (const depId of p.dependsOn || []) neighbors.add(depId);
      }
      if ((p.dependsOn || []).includes(isolatedId)) {
        neighbors.add(p.id);
      }
    }
    return neighbors;
  }, [isolatedId, processes]);

  const isNodeDimmed = (id: string) => {
    if (!isolationNeighbors) return false;
    return !isolationNeighbors.has(id);
  };

  const isEdgeDimmed = (from: string, to: string) => {
    if (!isolationNeighbors) return false;
    return !(isolationNeighbors.has(from) && isolationNeighbors.has(to));
  };

  // ============================================================
  // COULEURS
  // ============================================================
  const getNodeBgColor = (criticality: Criticality) => {
    return CRITICALITY_COLORS[criticality] || CRITICALITY_COLORS.Mineur;
  };

  const getEdgeColor = (criticality: Criticality) => {
    return CRITICALITY_COLORS[criticality] || CRITICALITY_COLORS.Mineur;
  };

  // ============================================================
  // RECHERCHE : auto-isolation
  // ============================================================
  useEffect(() => {
    if (!searchQuery.trim()) return;
    const q = searchQuery.trim().toLowerCase();
    const match = processes.find((p) => p.name?.toLowerCase().includes(q));
    if (match) {
      setIsolatedId(match.id);
    }
  }, [searchQuery, processes]);

  // ============================================================
  // ZOOM (boutons uniquement, centré sur le centre du viewBox)
  // ============================================================
  const handleZoomButton = (dir: "in" | "out" | "reset") => {
    if (dir === "reset") {
      setZoom(1);
      return;
    }
    const factor = dir === "in" ? 1.2 : 0.83;
    setZoom((z) => Math.min(3, Math.max(0.4, z * factor)));
  };

  // ============================================================
  // ACTIONS
  // ============================================================
  const handleNodeClick = (process: any) => {
    if (isolatedId && isolatedId !== process.id) {
      setIsolatedId(process.id);
      return;
    }
    if (!isolatedId) {
      setIsolatedId(process.id);
      return;
    }
    setSelectedProcess(process);
    setEditedDependsOn(process.dependsOn || []);
    setIsEditing(false);
  };

  const handleNodeDoubleClick = (process: any) => {
    setSelectedProcess(process);
    setEditedDependsOn(process.dependsOn || []);
    setIsEditing(false);
  };

  const resetView = () => {
    setIsolatedId(null);
    setZoom(1);
  };

  const saveDependencies = async () => {
    if (!selectedProcess) return;

    const { error } = await (supabase as any)
      .from("processus_metier")
      .update({ depends_on: editedDependsOn })
      .eq("id", selectedProcess.id);

    if (error) {
      toast.error("Erreur lors de la sauvegarde");
      console.error(error);
    } else {
      const updatedProcesses = processes.map((p) =>
        p.id === selectedProcess.id ? { ...p, dependsOn: editedDependsOn } : p
      );
      setProcesses(updatedProcesses);
      setSelectedProcess({ ...selectedProcess, dependsOn: editedDependsOn });
      toast.success("✅ Dépendances mises à jour");
      setIsEditing(false);
    }
  };

  // ============================================================
  // TRI VUE LISTE
  // ============================================================
  const sortedListRows = useMemo(() => {
    const rows = processes.map((p) => {
      const score = computeMaxScore(p.impacts);
      const crit = scoreToCriticality(score);
      const incoming = dependencyStats.incomingCount[p.id] || 0;
      const outgoing = dependencyStats.outgoingCount[p.id] || 0;
      return { p, score, crit, incoming, outgoing, total: incoming + outgoing };
    });

    rows.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = (a.p.name || "").localeCompare(b.p.name || "");
          break;
        case "criticality":
          cmp = CRITICALITY_ORDER[a.crit] - CRITICALITY_ORDER[b.crit];
          break;
        case "incoming":
          cmp = a.incoming - b.incoming;
          break;
        case "outgoing":
          cmp = a.outgoing - b.outgoing;
          break;
        case "total":
          cmp = a.total - b.total;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return rows;
  }, [processes, dependencyStats, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  // ============================================================
  // RENDU
  // ============================================================
  const totalProcesses = processes.length;
  const totalEdges = allEdges.length;
  const criticalCount = processes.filter((p) => computeMaxScore(p.impacts) >= 4).length;
  const noDepsCount = processes.filter((p) => !p.dependsOn || p.dependsOn.length === 0).length;

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  return (
    <div className="space-y-6">
      {/* ===== EN-TÊTE ===== */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1
            className="text-2xl md:text-3xl font-bold"
            style={{ color: COLORS.navy, fontFamily: "'Playfair Display', serif" }}
          >
            <Network className="h-7 w-7 inline-block mr-2" style={{ color: COLORS.forest }} />
            Carte des dépendances
          </h1>
          <p className="text-sm mt-1" style={{ color: COLORS.textMuted }}>
            Visualisation interactive des dépendances amont et aval entre processus métier
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(v) => v && setViewMode(v as "graph" | "list")}
            className="border rounded-lg"
            style={{ borderColor: COLORS.border }}
          >
            <ToggleGroupItem value="graph" className="px-3 h-8 text-xs gap-1.5">
              <Network className="h-3.5 w-3.5" />
              Graphe
            </ToggleGroupItem>
            <ToggleGroupItem value="list" className="px-3 h-8 text-xs gap-1.5">
              <ListIcon className="h-3.5 w-3.5" />
              Liste
            </ToggleGroupItem>
          </ToggleGroup>

          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ backgroundColor: `${COLORS.forest}10` }}
          >
            <ArrowUpRight className="h-3.5 w-3.5" style={{ color: COLORS.forest }} />
            <span className="text-xs font-medium" style={{ color: COLORS.forest }}>
              Amont
            </span>
          </div>
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ backgroundColor: `${COLORS.forestSoft}15` }}
          >
            <ArrowDownLeft className="h-3.5 w-3.5" style={{ color: COLORS.forestSoft }} />
            <span className="text-xs font-medium" style={{ color: COLORS.forest }}>
              Aval
            </span>
          </div>
        </div>
      </div>

      {/* ===== STATISTIQUES ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm" style={{ backgroundColor: COLORS.cream }}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: COLORS.textMuted }}
              >
                Processus
              </p>
              <p className="text-2xl font-bold" style={{ color: COLORS.navy }}>
                {totalProcesses}
              </p>
            </div>
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${COLORS.forest}15` }}
            >
              <GitBranch className="h-5 w-5" style={{ color: COLORS.forest }} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm" style={{ backgroundColor: COLORS.cream }}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: COLORS.textMuted }}
              >
                Dépendances
              </p>
              <p className="text-2xl font-bold" style={{ color: COLORS.navy }}>
                {totalEdges}
              </p>
            </div>
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "#FFF3E0" }}
            >
              <Link2 className="h-5 w-5" style={{ color: CRITICALITY_COLORS.Majeur }} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm" style={{ backgroundColor: COLORS.cream }}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: COLORS.textMuted }}
              >
                Critiques
              </p>
              <p className="text-2xl font-bold" style={{ color: CRITICALITY_COLORS.Critique }}>
                {criticalCount}
              </p>
            </div>
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: CRITICALITY_SOFT.Critique }}
            >
              <ShieldAlert className="h-5 w-5" style={{ color: CRITICALITY_COLORS.Critique }} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm" style={{ backgroundColor: COLORS.cream }}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: COLORS.textMuted }}
              >
                Sans dépendances
              </p>
              <p className="text-2xl font-bold" style={{ color: COLORS.forest }}>
                {noDepsCount}
              </p>
            </div>
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: CRITICALITY_SOFT.Mineur }}
            >
              <Unlink className="h-5 w-5" style={{ color: CRITICALITY_COLORS.Mineur }} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== BARRE OUTILS ===== */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
            style={{ color: COLORS.textMuted }}
          />
          <Input
            placeholder="Rechercher un processus (isolation automatique)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 border-[#E8E4DC]"
          />
        </div>

        {viewMode === "graph" && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAllProcesses((v) => !v)}
              className="h-9 border-[#E8E4DC] text-xs"
              style={{ color: COLORS.navy }}
            >
              {showAllProcesses ? "Mode focus (score ≥ 3)" : "Afficher tous les processus"}
            </Button>

            {isolatedId && (
              <Button
                variant="outline"
                size="sm"
                onClick={resetView}
                className="h-9 border-[#E8E4DC] text-xs gap-1.5"
                style={{ color: COLORS.navy }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Réinitialiser la vue
              </Button>
            )}
          </>
        )}
      </div>

      {/* ===== CONTENU ===== */}
      <Card className="border-0 shadow-sm overflow-hidden" style={{ backgroundColor: COLORS.cream }}>
        <CardHeader className="pb-2 border-b" style={{ borderColor: COLORS.border }}>
          <CardTitle
            className="text-base font-semibold flex items-center gap-2"
            style={{ color: COLORS.navy }}
          >
            <Activity className="h-5 w-5" style={{ color: COLORS.forest }} />
            {viewMode === "graph" ? "Visualisation des dépendances" : "Liste des processus"}
            <span className="text-xs font-normal ml-2" style={{ color: COLORS.textMuted }}>
              {viewMode === "graph"
                ? "— Clic : isoler · Double-clic : ouvrir le détail · Boutons +/− : zoom"
                : "— Cliquez sur une ligne pour ouvrir le détail"}
            </span>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {viewMode === "graph" ? (
            <div className="relative w-full overflow-hidden bg-gradient-to-br from-white to-[#FAFAF9] rounded-b-xl">
              <svg
                ref={svgRef}
                viewBox="0 0 1000 680"
                className="w-full h-[680px] select-none"
                style={{ cursor: "default", touchAction: "none" }}
              >
                <defs>
                  {(["Critique", "Majeur", "Modéré", "Mineur"] as Criticality[]).map((crit) => (
                    <marker
                      key={`arrow-${crit}`}
                      id={`arrow-upstream-${crit}`}
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill={CRITICALITY_COLORS[crit]} />
                    </marker>
                  ))}
                  {(["Critique", "Majeur", "Modéré", "Mineur"] as Criticality[]).map((crit) => (
                    <marker
                      key={`arrow-out-${crit}`}
                      id={`arrow-downstream-${crit}`}
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path
                        d="M 0 0 L 10 5 L 0 10 z"
                        fill={CRITICALITY_COLORS[crit]}
                        opacity={0.75}
                      />
                    </marker>
                  ))}
                </defs>

                {/* Fond */}
                <rect x="0" y="0" width="1000" height="680" fill="transparent" />

                {/* Groupe zoom — centré sur le centre du viewBox */}
                <g
                  transform={`translate(${500 * (1 - zoom)}, ${340 * (1 - zoom)}) scale(${zoom})`}
                  style={{ transition: "transform 0.2s ease-out" }}
                >
                  {/* ===== ARÊTES AMONT ===== */}
                  {renderedIncomingEdges.map((e, i) => {
                    const a = positions[e.from];
                    const b = positions[e.to];
                    if (!a || !b) return null;

                    const targetProcess = processes.find((p) => p.id === e.to);
                    const criticality: Criticality = targetProcess
                      ? scoreToCriticality(computeMaxScore(targetProcess.impacts))
                      : "Mineur";

                    const color = getEdgeColor(criticality);
                    const isHovered = hoveredProcess === e.from || hoveredProcess === e.to;
                    const dimmed = isEdgeDimmed(e.from, e.to);

                    return (
                      <line
                        key={`incoming-${i}`}
                        x1={a.x}
                        y1={a.y}
                        x2={b.x}
                        y2={b.y}
                        stroke={color}
                        strokeWidth={criticality === "Critique" ? 2.5 : 1.8}
                        opacity={dimmed ? 0.1 : isHovered ? 1 : 0.65}
                        strokeLinecap="round"
                        markerEnd={`url(#arrow-upstream-${criticality})`}
                        style={{ transition: "opacity 0.2s ease-in-out" }}
                      />
                    );
                  })}

                  {/* ===== ARÊTES AVAL (pointillés) ===== */}
                  {renderedOutgoingEdges.map((e, i) => {
                    const a = positions[e.from];
                    const b = positions[e.to];
                    if (!a || !b) return null;

                    const alreadyDisplayed = renderedIncomingEdges.some(
                      (inc) => inc.from === e.from && inc.to === e.to
                    );
                    if (alreadyDisplayed) return null;

                    const targetProcess = processes.find((p) => p.id === e.to);
                    const criticality: Criticality = targetProcess
                      ? scoreToCriticality(computeMaxScore(targetProcess.impacts))
                      : "Mineur";

                    const color = getEdgeColor(criticality);
                    const isHovered = hoveredProcess === e.from || hoveredProcess === e.to;
                    const dimmed = isEdgeDimmed(e.from, e.to);

                    return (
                      <line
                        key={`outgoing-${i}`}
                        x1={a.x}
                        y1={a.y}
                        x2={b.x}
                        y2={b.y}
                        stroke={color}
                        strokeWidth={criticality === "Critique" ? 2.2 : 1.5}
                        strokeDasharray="6 4"
                        opacity={dimmed ? 0.1 : isHovered ? 1 : 0.5}
                        strokeLinecap="round"
                        markerEnd={`url(#arrow-downstream-${criticality})`}
                        style={{ transition: "opacity 0.2s ease-in-out" }}
                      />
                    );
                  })}

                  {/* ===== NŒUDS ===== */}
                  {renderedNodes.map((p) => {
                    const pos = positions[p.id];
                    if (!pos) return null;

                    const score = computeMaxScore(p.impacts);
                    const criticality: Criticality = scoreToCriticality(score);
                    const isHovered = hoveredProcess === p.id;
                    const isSelected = selectedProcess?.id === p.id;
                    const isIsolated = isolatedId === p.id;
                    const incomingCount = dependencyStats.incomingCount[p.id] || 0;
                    const outgoingCount = dependencyStats.outgoingCount[p.id] || 0;
                    const totalDeps = incomingCount + outgoingCount;
                    const dimmed = isNodeDimmed(p.id);

                    const circleColor = getNodeBgColor(criticality);

                    return (
                      <g
                        key={p.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNodeClick(p);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          handleNodeDoubleClick(p);
                        }}
                        onMouseEnter={() => setHoveredProcess(p.id)}
                        onMouseLeave={() => setHoveredProcess(null)}
                        style={{
                          cursor: dimmed ? "default" : "pointer",
                          pointerEvents: dimmed ? "none" : "auto",
                          opacity: dimmed ? 0.12 : 1,
                          transition: "opacity 0.25s ease-in-out",
                        }}
                      >
                        {/* Halo discret au survol ou isolation */}
                        {(isHovered || isIsolated) && (
                          <circle cx={pos.x} cy={pos.y} r={44} fill={circleColor} opacity={0.18} />
                        )}

                        {/* Cercle principal */}
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r={isHovered || isIsolated ? 32 : 26}
                          fill={circleColor}
                          stroke="#FFFFFF"
                          strokeWidth={isSelected || isIsolated ? 4 : 2.5}
                          style={{ transition: "all 0.2s ease-in-out" }}
                        />

                        {/* Initiales */}
                        <text
                          x={pos.x}
                          y={pos.y + (isHovered || isIsolated ? 5 : 4)}
                          textAnchor="middle"
                          fill="#FFFFFF"
                          fontWeight="700"
                          pointerEvents="none"
                          style={{
                            fontSize: isHovered || isIsolated ? "13px" : "11px",
                            fontFamily: "'Inter', sans-serif",
                          }}
                        >
                          {p.name.substring(0, 2).toUpperCase()}
                        </text>

                        {/* Badge total dépendances */}
                        {totalDeps > 0 && (
                          <g>
                            <circle
                              cx={pos.x + 22}
                              cy={pos.y - 22}
                              r={isHovered || isIsolated ? 12 : 10}
                              fill="#FFFFFF"
                              stroke={circleColor}
                              strokeWidth={2}
                            />
                            <text
                              x={pos.x + 22}
                              y={pos.y - 18}
                              textAnchor="middle"
                              fill={COLORS.navy}
                              fontWeight="700"
                              pointerEvents="none"
                              style={{
                                fontSize: isHovered || isIsolated ? "10px" : "9px",
                                fontFamily: "'Inter', sans-serif",
                              }}
                            >
                              {totalDeps}
                            </text>
                          </g>
                        )}

                        {/* Indicateur amont */}
                        {incomingCount > 0 && (
                          <g>
                            <circle
                              cx={pos.x - 20}
                              cy={pos.y - 20}
                              r={isHovered || isIsolated ? 9 : 7}
                              fill={CRITICALITY_SOFT.Majeur}
                              stroke={CRITICALITY_COLORS.Majeur}
                              strokeWidth={1.5}
                            />
                            <text
                              x={pos.x - 20}
                              y={pos.y - 17}
                              textAnchor="middle"
                              fill={CRITICALITY_COLORS.Majeur}
                              fontWeight="700"
                              pointerEvents="none"
                              style={{ fontSize: "9px", fontFamily: "'Inter', sans-serif" }}
                            >
                              {incomingCount}
                            </text>
                          </g>
                        )}

                        {/* Indicateur aval */}
                        {outgoingCount > 0 && (
                          <g>
                            <circle
                              cx={pos.x + 20}
                              cy={pos.y + 20}
                              r={isHovered || isIsolated ? 9 : 7}
                              fill={`${COLORS.forest}20`}
                              stroke={COLORS.forestSoft}
                              strokeWidth={1.5}
                            />
                            <text
                              x={pos.x + 20}
                              y={pos.y + 23}
                              textAnchor="middle"
                              fill={COLORS.forest}
                              fontWeight="700"
                              pointerEvents="none"
                              style={{ fontSize: "9px", fontFamily: "'Inter', sans-serif" }}
                            >
                              {outgoingCount}
                            </text>
                          </g>
                        )}

                        {/* Nom */}
                        <text
                          x={pos.x}
                          y={pos.y + 48}
                          textAnchor="middle"
                          pointerEvents="none"
                          fontWeight="600"
                          style={{
                            fontSize: "11px",
                            fill: isHovered || isIsolated ? COLORS.navy : COLORS.textMuted,
                            fontFamily: "'Inter', sans-serif",
                          }}
                        >
                          {p.name.length > 20 ? p.name.slice(0, 17) + "…" : p.name}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>

              {/* ===== CONTRÔLES ZOOM ===== */}
              <div className="absolute bottom-4 right-4 flex flex-col gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleZoomButton("in")}
                  className="h-8 w-8 bg-white/90 border-[#E8E4DC] hover:bg-white"
                  aria-label="Zoom avant"
                >
                  <ZoomIn className="h-4 w-4" style={{ color: COLORS.navy }} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleZoomButton("out")}
                  className="h-8 w-8 bg-white/90 border-[#E8E4DC] hover:bg-white"
                  aria-label="Zoom arrière"
                >
                  <ZoomOut className="h-4 w-4" style={{ color: COLORS.navy }} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleZoomButton("reset")}
                  className="h-8 w-8 bg-white/90 border-[#E8E4DC] hover:bg-white"
                  aria-label="Réinitialiser le zoom"
                >
                  <RotateCcw className="h-4 w-4" style={{ color: COLORS.navy }} />
                </Button>
              </div>

              {/* ===== INDICATEUR MODE FOCUS ===== */}
              {!showAllProcesses && (
                <div
                  className="absolute top-3 left-3 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2"
                  style={{ backgroundColor: `${COLORS.forest}15`, color: COLORS.forest }}
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Mode focus : processus critiques &amp; majeurs uniquement
                </div>
              )}

              {/* ===== INDICATEUR ISOLATION ===== */}
              {isolatedId && (
                <div
                  className="absolute top-3 right-3 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2"
                  style={{ backgroundColor: `${CRITICALITY_COLORS.Majeur}15`, color: COLORS.navy }}
                >
                  <Activity className="h-3.5 w-3.5" style={{ color: CRITICALITY_COLORS.Majeur }} />
                  Isolation active —{" "}
                  {processes.find((p) => p.id === isolatedId)?.name || ""}
                  <button
                    onClick={resetView}
                    className="ml-1 p-0.5 rounded hover:bg-black/5"
                    aria-label="Réinitialiser l'isolation"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* ===== VUE LISTE ===== */
            <div className="w-full overflow-auto bg-white rounded-b-xl">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#F8F6F2]">
                    <TableHead
                      className="text-[10px] font-semibold uppercase tracking-wider cursor-pointer select-none"
                      style={{ color: COLORS.textMuted }}
                      onClick={() => toggleSort("name")}
                    >
                      <div className="flex items-center gap-1.5">
                        Processus
                        <SortIcon col="name" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="text-[10px] font-semibold uppercase tracking-wider cursor-pointer select-none text-center"
                      style={{ color: COLORS.textMuted }}
                      onClick={() => toggleSort("criticality")}
                    >
                      <div className="flex items-center gap-1.5 justify-center">
                        Criticité
                        <SortIcon col="criticality" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="text-[10px] font-semibold uppercase tracking-wider cursor-pointer select-none text-center"
                      style={{ color: COLORS.textMuted }}
                      onClick={() => toggleSort("incoming")}
                    >
                      <div className="flex items-center gap-1.5 justify-center">
                        Amont
                        <SortIcon col="incoming" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="text-[10px] font-semibold uppercase tracking-wider cursor-pointer select-none text-center"
                      style={{ color: COLORS.textMuted }}
                      onClick={() => toggleSort("outgoing")}
                    >
                      <div className="flex items-center gap-1.5 justify-center">
                        Aval
                        <SortIcon col="outgoing" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="text-[10px] font-semibold uppercase tracking-wider cursor-pointer select-none text-center"
                      style={{ color: COLORS.textMuted }}
                      onClick={() => toggleSort("total")}
                    >
                      <div className="flex items-center gap-1.5 justify-center">
                        Total
                        <SortIcon col="total" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="text-[10px] font-semibold uppercase tracking-wider text-right"
                      style={{ color: COLORS.textMuted }}
                    >
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedListRows.map(({ p, crit, incoming, outgoing, total }) => (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer hover:bg-[#FAFAF9]"
                      onClick={() => {
                        setSelectedProcess(p);
                        setEditedDependsOn(p.dependsOn || []);
                        setIsEditing(false);
                      }}
                    >
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: CRITICALITY_COLORS[crit] }}
                          />
                          <div className="min-w-0">
                            <p
                              className="text-sm font-medium truncate"
                              style={{ color: COLORS.navy }}
                            >
                              {p.name}
                            </p>
                            {p.department && (
                              <p
                                className="text-[10px] truncate"
                                style={{ color: COLORS.textMuted }}
                              >
                                {p.department}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 text-center">
                        <Badge
                          variant="outline"
                          className="text-[10px] border-0"
                          style={{
                            backgroundColor: CRITICALITY_SOFT[crit],
                            color: CRITICALITY_COLORS[crit],
                          }}
                        >
                          {crit}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2.5 text-center text-sm" style={{ color: COLORS.navy }}>
                        {incoming > 0 ? incoming : <span style={{ color: COLORS.textMuted }}>—</span>}
                      </TableCell>
                      <TableCell className="py-2.5 text-center text-sm" style={{ color: COLORS.navy }}>
                        {outgoing > 0 ? outgoing : <span style={{ color: COLORS.textMuted }}>—</span>}
                      </TableCell>
                      <TableCell className="py-2.5 text-center">
                        <span
                          className="text-sm font-semibold"
                          style={{ color: total > 0 ? COLORS.forest : COLORS.textMuted }}
                        >
                          {total}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[10px] gap-1"
                          style={{ color: COLORS.forest }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsolatedId(p.id);
                            setViewMode("graph");
                          }}
                        >
                          <Network className="h-3 w-3" />
                          Voir dans le graphe
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {sortedListRows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-8 text-center text-sm"
                        style={{ color: COLORS.textMuted }}
                      >
                        Aucun processus à afficher
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* ===== LÉGENDE ===== */}
          <div
            className="flex flex-wrap items-center gap-4 px-6 py-4 border-t"
            style={{ borderColor: COLORS.border }}
          >
            <div className="flex items-center gap-3 flex-wrap">
              {Object.entries(CRITICALITY_COLORS).map(([label, color]) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-xs" style={{ color: COLORS.textMuted }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>

            <div className="w-px h-5" style={{ backgroundColor: COLORS.border }} />

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-0.5" style={{ backgroundColor: CRITICALITY_COLORS.Majeur }} />
                <ArrowUpRight className="h-3 w-3" style={{ color: CRITICALITY_COLORS.Majeur }} />
                <span className="text-xs font-medium" style={{ color: COLORS.forest }}>
                  Amont
                </span>
                <span className="text-[9px]" style={{ color: COLORS.textMuted }}>
                  (dépend de)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div
                  className="w-5 h-0.5 border-t-2 border-dashed"
                  style={{ borderColor: COLORS.forestSoft }}
                />
                <ArrowDownLeft className="h-3 w-3" style={{ color: COLORS.forestSoft }} />
                <span className="text-xs font-medium" style={{ color: COLORS.forest }}>
                  Aval
                </span>
                <span className="text-[9px]" style={{ color: COLORS.textMuted }}>
                  (dépend de lui)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 ml-auto">
              <div
                className="h-5 w-5 rounded-full bg-white border-2 flex items-center justify-center"
                style={{ borderColor: COLORS.border }}
              >
                <span className="text-[9px] font-bold" style={{ color: COLORS.navy }}>
                  3
                </span>
              </div>
              <span className="text-xs" style={{ color: COLORS.textMuted }}>
                Nombre total de dépendances
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===== PANNEAU LATÉRAL ===== */}
      <Sheet open={!!selectedProcess} onOpenChange={() => setSelectedProcess(null)}>
        <SheetContent
          className="w-full sm:max-w-md overflow-y-auto"
          style={{ backgroundColor: "white" }}
        >
          {selectedProcess && (
            <div className="space-y-5">
              <SheetHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: getNodeBgColor(
                          scoreToCriticality(computeMaxScore(selectedProcess.impacts))
                        ),
                      }}
                    >
                      <Building2 className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <SheetTitle className="text-lg" style={{ color: COLORS.navy }}>
                        {selectedProcess.name}
                      </SheetTitle>
                      <SheetDescription className="text-xs" style={{ color: COLORS.textMuted }}>
                        {selectedProcess.department || "Sans département"} ·{" "}
                        {selectedProcess.owner || "Sans responsable"}
                      </SheetDescription>
                    </div>
                  </div>
                  {!isEditing ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditing(true)}
                      className="border-[#E8E4DC] hover:bg-[#F8F6F2]"
                    >
                      <Edit3 className="h-3.5 w-3.5 mr-1.5" style={{ color: COLORS.forest }} />
                      <span style={{ color: COLORS.text }}>Modifier</span>
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditing(false)}
                        className="border-[#E8E4DC] hover:bg-[#F8F6F2]"
                      >
                        <X className="h-3.5 w-3.5 mr-1.5" />
                        Annuler
                      </Button>
                      <Button
                        size="sm"
                        onClick={saveDependencies}
                        style={{ backgroundColor: COLORS.forest, color: "white" }}
                        className="hover:bg-[#1a3329]"
                      >
                        <Save className="h-3.5 w-3.5 mr-1.5" />
                        Sauvegarder
                      </Button>
                    </div>
                  )}
                </div>
              </SheetHeader>

              {/* Score */}
              <div className="rounded-lg p-4" style={{ backgroundColor: COLORS.cream }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium" style={{ color: COLORS.textMuted }}>
                    Niveau de criticité
                  </span>
                  <Badge
                    className={criticalityColor(
                      scoreToCriticality(computeMaxScore(selectedProcess.impacts))
                    )}
                  >
                    {scoreToCriticality(computeMaxScore(selectedProcess.impacts))}
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className="flex-1 h-2 rounded-full overflow-hidden"
                    style={{ backgroundColor: COLORS.border }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(computeMaxScore(selectedProcess.impacts) / 5) * 100}%`,
                        backgroundColor: COLORS.forest,
                      }}
                    />
                  </div>
                  <span className="text-sm font-bold" style={{ color: COLORS.navy }}>
                    {computeMaxScore(selectedProcess.impacts)}/5
                  </span>
                </div>
              </div>

              {/* Métriques BCM */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg p-3 text-center" style={{ backgroundColor: COLORS.cream }}>
                  <Clock className="h-4 w-4 mx-auto mb-1" style={{ color: COLORS.textMuted }} />
                  <p className="text-[10px] font-medium" style={{ color: COLORS.textMuted }}>
                    RTO
                  </p>
                  <p className="text-lg font-bold" style={{ color: COLORS.navy }}>
                    {selectedProcess.rto || 0}h
                  </p>
                </div>
                <div className="rounded-lg p-3 text-center" style={{ backgroundColor: COLORS.cream }}>
                  <Database className="h-4 w-4 mx-auto mb-1" style={{ color: COLORS.textMuted }} />
                  <p className="text-[10px] font-medium" style={{ color: COLORS.textMuted }}>
                    RPO
                  </p>
                  <p className="text-lg font-bold" style={{ color: COLORS.navy }}>
                    {selectedProcess.rpo || 0}h
                  </p>
                </div>
                <div className="rounded-lg p-3 text-center" style={{ backgroundColor: COLORS.cream }}>
                  <AlertTriangle className="h-4 w-4 mx-auto mb-1" style={{ color: COLORS.textMuted }} />
                  <p className="text-[10px] font-medium" style={{ color: COLORS.textMuted }}>
                    MTPD
                  </p>
                  <p className="text-lg font-bold" style={{ color: COLORS.navy }}>
                    {selectedProcess.mtpd || 0}h
                  </p>
                </div>
                <div className="rounded-lg p-3 text-center" style={{ backgroundColor: COLORS.cream }}>
                  <TrendingUp className="h-4 w-4 mx-auto mb-1" style={{ color: COLORS.textMuted }} />
                  <p className="text-[10px] font-medium" style={{ color: COLORS.textMuted }}>
                    MBCO
                  </p>
                  <p className="text-lg font-bold" style={{ color: COLORS.navy }}>
                    {selectedProcess.mbco || 0}%
                  </p>
                </div>
              </div>

              {/* Amont / Aval */}
              <div className="grid grid-cols-2 gap-3">
                <div
                  className="rounded-lg p-3 border"
                  style={{
                    borderColor: CRITICALITY_SOFT.Majeur,
                    backgroundColor: CRITICALITY_SOFT.Majeur,
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <ArrowUpRight className="h-4 w-4" style={{ color: CRITICALITY_COLORS.Majeur }} />
                    <span className="text-xs font-semibold" style={{ color: COLORS.navy }}>
                      Amont
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[9px] ml-auto"
                      style={{ borderColor: CRITICALITY_COLORS.Majeur, color: COLORS.navy }}
                    >
                      {dependencyStats.incomingCount[selectedProcess.id] || 0}
                    </Badge>
                  </div>
                  <p className="text-[10px]" style={{ color: COLORS.textMuted }}>
                    {dependencyStats.incomingCount[selectedProcess.id] > 0
                      ? `${dependencyStats.incomingCount[selectedProcess.id]} processus dont dépend ce processus`
                      : "Aucune dépendance amont"}
                  </p>
                </div>
                <div
                  className="rounded-lg p-3 border"
                  style={{ borderColor: COLORS.border, backgroundColor: `${COLORS.forest}10` }}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <ArrowDownLeft className="h-4 w-4" style={{ color: COLORS.forestSoft }} />
                    <span className="text-xs font-semibold" style={{ color: COLORS.navy }}>
                      Aval
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[9px] ml-auto"
                      style={{ borderColor: COLORS.forestSoft, color: COLORS.navy }}
                    >
                      {dependencyStats.outgoingCount[selectedProcess.id] || 0}
                    </Badge>
                  </div>
                  <p className="text-[10px]" style={{ color: COLORS.textMuted }}>
                    {dependencyStats.outgoingCount[selectedProcess.id] > 0
                      ? `${dependencyStats.outgoingCount[selectedProcess.id]} processus dépendent de celui-ci`
                      : "Aucune dépendance aval"}
                  </p>
                </div>
              </div>

              {/* Édition */}
              <div className="space-y-3">
                <h4
                  className="text-sm font-semibold flex items-center gap-2"
                  style={{ color: COLORS.navy }}
                >
                  <GitBranch className="h-4 w-4" style={{ color: COLORS.forest }} />
                  Dépendances (amont)
                  <Badge
                    variant="outline"
                    className="text-[10px]"
                    style={{ borderColor: COLORS.border }}
                  >
                    {selectedProcess.dependsOn?.length || 0}
                  </Badge>
                  {isEditing && (
                    <span className="text-[10px] font-normal" style={{ color: COLORS.textMuted }}>
                      (cochez pour modifier)
                    </span>
                  )}
                </h4>

                {isEditing ? (
                  <div
                    className="space-y-1.5 max-h-60 overflow-y-auto border rounded-lg p-2"
                    style={{ borderColor: COLORS.border }}
                  >
                    {processes
                      .filter((p) => p.id !== selectedProcess.id)
                      .map((p) => {
                        const isChecked = editedDependsOn.includes(p.id);
                        const procCriticality = scoreToCriticality(computeMaxScore(p.impacts));
                        const critColor = CRITICALITY_COLORS[procCriticality];

                        return (
                          <label
                            key={p.id}
                            className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors hover:bg-[#F8F6F2]"
                          >
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={(c) => {
                                if (c) setEditedDependsOn([...editedDependsOn, p.id]);
                                else
                                  setEditedDependsOn(editedDependsOn.filter((id) => id !== p.id));
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <p
                                className="text-sm font-medium truncate"
                                style={{ color: COLORS.navy }}
                              >
                                {p.name}
                              </p>
                              <p
                                className="text-xs truncate"
                                style={{ color: COLORS.textMuted }}
                              >
                                {p.department || "Sans département"}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: critColor }}
                              />
                              <span className="text-xs font-medium" style={{ color: critColor }}>
                                {procCriticality}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {selectedProcess.dependsOn && selectedProcess.dependsOn.length > 0 ? (
                      selectedProcess.dependsOn.map((depId: string) => {
                        const depProcess = processes.find((p) => p.id === depId);
                        return depProcess ? (
                          <div
                            key={depId}
                            className="flex items-center justify-between p-2.5 rounded-lg"
                            style={{ backgroundColor: COLORS.cream }}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{
                                  backgroundColor: getNodeBgColor(
                                    scoreToCriticality(computeMaxScore(depProcess.impacts))
                                  ),
                                }}
                              />
                              <span className="text-sm" style={{ color: COLORS.navy }}>
                                {depProcess.name}
                              </span>
                            </div>
                            <Badge
                              variant="outline"
                              className="text-[10px]"
                              style={{ borderColor: COLORS.border }}
                            >
                              {scoreToCriticality(computeMaxScore(depProcess.impacts))}
                            </Badge>
                          </div>
                        ) : null;
                      })
                    ) : (
                      <p
                        className="text-sm italic py-3 text-center"
                        style={{ color: COLORS.textMuted }}
                      >
                        Aucune dépendance amont
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2 pt-3 border-t" style={{ borderColor: COLORS.border }}>
                <h4 className="text-sm font-semibold" style={{ color: COLORS.navy }}>
                  Description
                </h4>
                <p className="text-sm" style={{ color: COLORS.textMuted }}>
                  {selectedProcess.description || "Aucune description renseignée"}
                </p>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default DependencyMap;