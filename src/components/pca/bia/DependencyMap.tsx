import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
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
  Eye,
  X,
  Save,
  Edit3,
  ChevronRight,
  Network,
  Link2,
  Unlink,
  Activity,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Pos = { x: number; y: number };

// Couleurs Resillia
const COLORS = {
  navy: "#172030",
  cream: "#F8F6F2",
  forest: "#2A5141",
  border: "#E8E4DC",
  text: "#172030",
  textMuted: "#6B7280",
};

const CRITICALITY_COLORS = {
  Critique: "#DC2626",
  Majeur: "#F97316",
  Modéré: "#EAB308",
  Mineur: "#22C55E",
};

export const DependencyMap = () => {
  const { processes, setProcesses } = useBia();
  const [selectedProcess, setSelectedProcess] = useState<any | null>(null);
  const [hoveredProcess, setHoveredProcess] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedDependsOn, setEditedDependsOn] = useState<string[]>([]);

  // Calcul des positions des nœuds
  const positions = useMemo(() => {
    const map: Record<string, Pos> = {};
    const n = processes.length;
    const cx = 400, cy = 280, r = 220;
    
    const sortedProcesses = [...processes].sort((a, b) => {
      const scoreA = computeMaxScore(a.impacts);
      const scoreB = computeMaxScore(b.impacts);
      return scoreB - scoreA;
    });
    
    sortedProcesses.forEach((p, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const score = computeMaxScore(p.impacts);
      const radiusOffset = score >= 4 ? -40 : score >= 3 ? -20 : score >= 2 ? 0 : 20;
      map[p.id] = { 
        x: cx + (r + radiusOffset) * Math.cos(angle), 
        y: cy + (r + radiusOffset) * Math.sin(angle) 
      };
    });
    return map;
  }, [processes]);

  // Calcul des arêtes (dépendances)
  const edges = useMemo(() => {
    const list: { from: string; to: string; score: number; fromName: string; toName: string }[] = [];
    for (const p of processes) {
      for (const dep of p.dependsOn) {
        const target = processes.find((x) => x.id === dep);
        if (!target) continue;
        list.push({ 
          from: p.id, 
          to: dep, 
          score: computeMaxScore(target.impacts),
          fromName: p.name,
          toName: target.name
        });
      }
    }
    return list;
  }, [processes]);

  const edgeColor = (criticality: Criticality) => {
    return CRITICALITY_COLORS[criticality] || "#94A3B8";
  };

  const getNodeBgColor = (criticality: Criticality) => {
    return CRITICALITY_COLORS[criticality] || "#22C55E";
  };

  const getNodeShadowColor = (criticality: Criticality) => {
    const colors = {
      Critique: "rgba(220,38,38,0.4)",
      Majeur: "rgba(249,115,22,0.4)",
      Modéré: "rgba(234,179,8,0.4)",
      Mineur: "rgba(34,197,94,0.4)",
    };
    return colors[criticality] || "rgba(34,197,94,0.3)";
  };

  const handleNodeClick = (process: any) => {
    setSelectedProcess(process);
    setEditedDependsOn(process.dependsOn || []);
    setIsEditing(false);
  };

  const saveDependencies = async () => {
    if (!selectedProcess) return;
    
    const { error } = await (supabase as any)
      .from('processus_metier')
      .update({ depends_on: editedDependsOn })
      .eq('id', selectedProcess.id);
    
    if (error) {
      toast.error("Erreur lors de la sauvegarde");
      console.error(error);
    } else {
      const updatedProcesses = processes.map(p => 
        p.id === selectedProcess.id ? { ...p, dependsOn: editedDependsOn } : p
      );
      setProcesses(updatedProcesses);
      setSelectedProcess({ ...selectedProcess, dependsOn: editedDependsOn });
      toast.success("✅ Dépendances mises à jour");
      setIsEditing(false);
    }
  };

  const getDependencyStats = () => {
    const incoming: Record<string, number> = {};
    const outgoing: Record<string, number> = {};
    for (const edge of edges) {
      outgoing[edge.from] = (outgoing[edge.from] || 0) + 1;
      incoming[edge.to] = (incoming[edge.to] || 0) + 1;
    }
    return { incoming, outgoing };
  };
  
  const stats = getDependencyStats();

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: COLORS.navy, fontFamily: "'Playfair Display', serif" }}>
            <Network className="h-7 w-7 inline-block mr-2" style={{ color: COLORS.forest }} />
            Carte des dépendances
          </h1>
          <p className="text-sm mt-1" style={{ color: COLORS.textMuted }}>
            Visualisation interactive des dépendances entre processus métier
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(CRITICALITY_COLORS).map(([label, color]) => (
            <Badge key={label} variant="outline" className="flex items-center gap-1.5 border-0" style={{ backgroundColor: `${color}15`, color: color }}>
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              {label}
            </Badge>
          ))}
        </div>
      </div>

      {/* Statistiques - Style Resillia */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm" style={{ backgroundColor: COLORS.cream }}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: COLORS.textMuted }}>Processus</p>
              <p className="text-2xl font-bold" style={{ color: COLORS.navy }}>{processes.length}</p>
            </div>
            <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${COLORS.forest}15` }}>
              <GitBranch className="h-5 w-5" style={{ color: COLORS.forest }} />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-sm" style={{ backgroundColor: COLORS.cream }}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: COLORS.textMuted }}>Dépendances</p>
              <p className="text-2xl font-bold" style={{ color: COLORS.navy }}>{edges.length}</p>
            </div>
            <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#FEF3C7" }}>
              <Link2 className="h-5 w-5" style={{ color: "#D97706" }} />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-sm" style={{ backgroundColor: COLORS.cream }}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: COLORS.textMuted }}>Critiques</p>
              <p className="text-2xl font-bold" style={{ color: "#DC2626" }}>
                {processes.filter(p => computeMaxScore(p.impacts) >= 4).length}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
              <ShieldAlert className="h-5 w-5" style={{ color: "#DC2626" }} />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-sm" style={{ backgroundColor: COLORS.cream }}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: COLORS.textMuted }}>Sans dépendances</p>
              <p className="text-2xl font-bold" style={{ color: COLORS.forest }}>
                {processes.filter(p => !p.dependsOn || p.dependsOn.length === 0).length}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#D1FAE5" }}>
              <Unlink className="h-5 w-5" style={{ color: "#059669" }} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Graphe principal */}
      <Card className="border-0 shadow-sm overflow-hidden" style={{ backgroundColor: COLORS.cream }}>
        <CardHeader className="pb-2 border-b" style={{ borderColor: COLORS.border }}>
          <CardTitle className="text-base font-semibold flex items-center gap-2" style={{ color: COLORS.navy }}>
            <Activity className="h-5 w-5" style={{ color: COLORS.forest }} />
            Visualisation des dépendances
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full overflow-auto bg-gradient-to-br from-white to-[#FAFAF9] rounded-b-xl">
            <svg viewBox="0 0 800 560" className="w-full h-[560px] cursor-pointer">
              <defs>
                <marker id="arrow-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#DC2626" />
                </marker>
                <marker id="arrow-orange" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#F97316" />
                </marker>
                <marker id="arrow-yellow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#EAB308" />
                </marker>
                <marker id="arrow-gray" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#94A3B8" />
                </marker>
                
                {/* Glow filter */}
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              
              <rect x="0" y="0" width="800" height="560" fill="transparent" />
              
              {/* Lignes de dépendances */}
              {edges.map((e, i) => {
                const a = positions[e.from];
                const b = positions[e.to];
                if (!a || !b) return null;
                const targetProcess = processes.find(p => p.id === e.to);
                const criticality = targetProcess ? scoreToCriticality(computeMaxScore(targetProcess.impacts)) : "Mineur";
                
                let marker = "url(#arrow-gray)";
                if (criticality === "Critique") marker = "url(#arrow-red)";
                else if (criticality === "Majeur") marker = "url(#arrow-orange)";
                else if (criticality === "Modéré") marker = "url(#arrow-yellow)";
                
                const color = edgeColor(criticality);
                
                return (
                  <g key={i}>
                    {/* Ombre portée pour la ligne */}
                    <line 
                      x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                      stroke={color} 
                      strokeWidth={criticality === "Critique" ? 3.5 : 2.5} 
                      strokeDasharray={criticality === "Critique" ? "none" : "6 3"}
                      opacity={0.15}
                      strokeLinecap="round"
                    />
                    <line 
                      x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                      stroke={color} 
                      strokeWidth={criticality === "Critique" ? 3 : 2} 
                      strokeDasharray={criticality === "Critique" ? "none" : "6 3"}
                      markerEnd={marker} 
                      opacity={hoveredProcess === e.from || hoveredProcess === e.to ? 1 : 0.7}
                      strokeLinecap="round"
                    />
                  </g>
                );
              })}
              
              {/* Nœuds */}
              {processes.map((p) => {
                const pos = positions[p.id];
                if (!pos) return null;
                const score = computeMaxScore(p.impacts);
                const criticality: Criticality = scoreToCriticality(score);
                const isHovered = hoveredProcess === p.id;
                const isSelected = selectedProcess?.id === p.id;
                const incomingCount = stats.incoming[p.id] || 0;
                const outgoingCount = stats.outgoing[p.id] || 0;
                const totalDeps = incomingCount + outgoingCount;
                const bgColor = getNodeBgColor(criticality);
                const shadowColor = getNodeShadowColor(criticality);
                
                const circleColor = CRITICALITY_COLORS[criticality] || "#22C55E";
                
                return (
                  <g 
                    key={p.id} 
                    onClick={() => handleNodeClick(p)} 
                    onMouseEnter={() => setHoveredProcess(p.id)} 
                    onMouseLeave={() => setHoveredProcess(null)} 
                    style={{ cursor: "pointer" }}
                  >
                    {/* Glow extérieur */}
                    <circle 
                      cx={pos.x} cy={pos.y} 
                      r={isHovered ? 42 : 36} 
                      fill={circleColor} 
                      opacity={isHovered ? 0.2 : 0.1} 
                      filter={isHovered ? "url(#glow)" : "none"}
                    />
                    
                    {/* Cercle principal */}
                    <circle 
                      cx={pos.x} cy={pos.y} 
                      r={isHovered ? 34 : 28} 
                      fill={circleColor} 
                      stroke="white" 
                      strokeWidth={isSelected ? 3.5 : 2.5}
                      style={{ 
                        filter: isHovered ? `drop-shadow(0 0 12px ${shadowColor})` : "none",
                        transition: "all 0.2s ease-in-out"
                      }} 
                    />
                    
                    {/* Initiales */}
                    <text 
                      x={pos.x} y={pos.y + (isHovered ? 5 : 4)} 
                      textAnchor="middle" 
                      className="fill-white font-bold pointer-events-none"
                      style={{ fontSize: isHovered ? "13px" : "11px", fontFamily: "'Inter', sans-serif" }}
                    >
                      {p.name.substring(0, 2).toUpperCase()}
                    </text>
                    
                    {/* Badge de dépendances */}
                    {totalDeps > 0 && (
                      <g>
                        <circle 
                          cx={pos.x + 24} cy={pos.y - 24} 
                          r={isHovered ? 12 : 10} 
                          fill="white" 
                          stroke={circleColor} 
                          strokeWidth={2.5}
                          style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.1))" }}
                        />
                        <text 
                          x={pos.x + 24} y={pos.y - 20} 
                          textAnchor="middle" 
                          className="fill-current font-bold pointer-events-none"
                          style={{ 
                            fontSize: isHovered ? "10px" : "9px", 
                            color: COLORS.navy,
                            fontFamily: "'Inter', sans-serif"
                          }}
                        >
                          {totalDeps}
                        </text>
                      </g>
                    )}
                    
                    {/* Nom du processus */}
                    <text 
                      x={pos.x} y={pos.y + (isHovered ? 52 : 45)} 
                      textAnchor="middle" 
                      className="pointer-events-none font-medium"
                      style={{ 
                        fontSize: isHovered ? "11px" : "10px", 
                        color: isHovered ? COLORS.navy : COLORS.textMuted,
                        fontFamily: "'Inter', sans-serif",
                        transition: "all 0.2s ease-in-out",
                        maxWidth: "120px",
                        overflow: "hidden",
                        textOverflow: "ellipsis"
                      }}
                    >
                      {p.name.length > 22 ? p.name.slice(0, 19) + "…" : p.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
          
          {/* Légende améliorée */}
          <div className="flex flex-wrap items-center gap-4 px-6 py-4 border-t" style={{ borderColor: COLORS.border }}>
            <div className="flex items-center gap-3 flex-wrap">
              {Object.entries(CRITICALITY_COLORS).map(([label, color]) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-xs" style={{ color: COLORS.textMuted }}>{label}</span>
                </div>
              ))}
            </div>
            <div className="w-px h-5" style={{ backgroundColor: COLORS.border }} />
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-0.5" style={{ backgroundColor: "#DC2626" }} />
                <span className="text-xs" style={{ color: COLORS.textMuted }}>Critique</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-0.5 border-t-2 border-dashed" style={{ borderColor: "#94A3B8" }} />
                <span className="text-xs" style={{ color: COLORS.textMuted }}>Standard</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              <div className="h-5 w-5 rounded-full bg-white border-2 flex items-center justify-center" style={{ borderColor: COLORS.border }}>
                <span className="text-[9px] font-bold" style={{ color: COLORS.navy }}>3</span>
              </div>
              <span className="text-xs" style={{ color: COLORS.textMuted }}>Nombre de dépendances</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Panel latéral pour MODIFIER les dépendances - Style Resillia */}
      <Sheet open={!!selectedProcess} onOpenChange={() => setSelectedProcess(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto" style={{ backgroundColor: "white" }}>
          {selectedProcess && (
            <div className="space-y-5">
              <SheetHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="h-10 w-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: getNodeBgColor(scoreToCriticality(computeMaxScore(selectedProcess.impacts))) }}
                    >
                      <Building2 className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <SheetTitle className="text-lg" style={{ color: COLORS.navy }}>{selectedProcess.name}</SheetTitle>
                      <SheetDescription className="text-xs" style={{ color: COLORS.textMuted }}>
                        {selectedProcess.department} · {selectedProcess.owner}
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

              {/* Score de criticité */}
              <div className="rounded-lg p-4" style={{ backgroundColor: COLORS.cream }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium" style={{ color: COLORS.textMuted }}>Niveau de criticité</span>
                  <Badge className={criticalityColor(scoreToCriticality(computeMaxScore(selectedProcess.impacts)))}>
                    {scoreToCriticality(computeMaxScore(selectedProcess.impacts))}
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: COLORS.border }}>
                    <div 
                      className="h-full rounded-full transition-all" 
                      style={{ 
                        width: `${(computeMaxScore(selectedProcess.impacts) / 5) * 100}%`,
                        backgroundColor: COLORS.forest
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
                  <p className="text-[10px] font-medium" style={{ color: COLORS.textMuted }}>RTO</p>
                  <p className="text-lg font-bold" style={{ color: COLORS.navy }}>{selectedProcess.rto}h</p>
                </div>
                <div className="rounded-lg p-3 text-center" style={{ backgroundColor: COLORS.cream }}>
                  <Database className="h-4 w-4 mx-auto mb-1" style={{ color: COLORS.textMuted }} />
                  <p className="text-[10px] font-medium" style={{ color: COLORS.textMuted }}>RPO</p>
                  <p className="text-lg font-bold" style={{ color: COLORS.navy }}>{selectedProcess.rpo}h</p>
                </div>
                <div className="rounded-lg p-3 text-center" style={{ backgroundColor: COLORS.cream }}>
                  <AlertTriangle className="h-4 w-4 mx-auto mb-1" style={{ color: COLORS.textMuted }} />
                  <p className="text-[10px] font-medium" style={{ color: COLORS.textMuted }}>MTPD</p>
                  <p className="text-lg font-bold" style={{ color: COLORS.navy }}>{selectedProcess.mtpd}h</p>
                </div>
                <div className="rounded-lg p-3 text-center" style={{ backgroundColor: COLORS.cream }}>
                  <TrendingUp className="h-4 w-4 mx-auto mb-1" style={{ color: COLORS.textMuted }} />
                  <p className="text-[10px] font-medium" style={{ color: COLORS.textMuted }}>MBCO</p>
                  <p className="text-lg font-bold" style={{ color: COLORS.navy }}>{selectedProcess.mbco}%</p>
                </div>
              </div>

              {/* Édition des dépendances */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2" style={{ color: COLORS.navy }}>
                  <GitBranch className="h-4 w-4" style={{ color: COLORS.forest }} />
                  Dépendances 
                  <Badge variant="outline" className="text-[10px]" style={{ borderColor: COLORS.border }}>
                    {selectedProcess.dependsOn?.length || 0}
                  </Badge>
                  {isEditing && (
                    <span className="text-[10px] font-normal" style={{ color: COLORS.textMuted }}>(cochez pour modifier)</span>
                  )}
                </h4>
                
                {isEditing ? (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto border rounded-lg p-2" style={{ borderColor: COLORS.border }}>
                    {processes.filter(p => p.id !== selectedProcess.id).map((p) => {
                      const isChecked = editedDependsOn.includes(p.id);
                      const procCriticality = scoreToCriticality(computeMaxScore(p.impacts));
                      const critColor = procCriticality === "Critique" ? "#DC2626" : procCriticality === "Majeur" ? "#F97316" : procCriticality === "Modéré" ? "#EAB308" : "#22C55E";
                      
                      return (
                        <label 
                          key={p.id} 
                          className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors hover:bg-[#F8F6F2]"
                        >
                          <Checkbox 
                            checked={isChecked} 
                            onCheckedChange={(c) => {
                              if (c) setEditedDependsOn([...editedDependsOn, p.id]);
                              else setEditedDependsOn(editedDependsOn.filter(id => id !== p.id));
                            }} 
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: COLORS.navy }}>{p.name}</p>
                            <p className="text-xs truncate" style={{ color: COLORS.textMuted }}>{p.department}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: critColor }} />
                            <span className="text-xs font-medium" style={{ color: critColor }}>{procCriticality}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {selectedProcess.dependsOn && selectedProcess.dependsOn.length > 0 ? (
                      selectedProcess.dependsOn.map((depId: string) => {
                        const depProcess = processes.find(p => p.id === depId);
                        return depProcess ? (
                          <div 
                            key={depId} 
                            className="flex items-center justify-between p-2.5 rounded-lg"
                            style={{ backgroundColor: COLORS.cream }}
                          >
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: getNodeBgColor(scoreToCriticality(computeMaxScore(depProcess.impacts))) }}
                              />
                              <span className="text-sm" style={{ color: COLORS.navy }}>{depProcess.name}</span>
                            </div>
                            <Badge variant="outline" className="text-[10px]" style={{ borderColor: COLORS.border }}>
                              {scoreToCriticality(computeMaxScore(depProcess.impacts))}
                            </Badge>
                          </div>
                        ) : null;
                      })
                    ) : (
                      <p className="text-sm italic py-3 text-center" style={{ color: COLORS.textMuted }}>
                        Aucune dépendance
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2 pt-3 border-t" style={{ borderColor: COLORS.border }}>
                <h4 className="text-sm font-semibold" style={{ color: COLORS.navy }}>Description</h4>
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