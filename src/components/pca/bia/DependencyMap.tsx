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
  Edit3
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Pos = { x: number; y: number };

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
    switch (criticality) {
      case "Critique": return "#ef4444";  // ROUGE
      case "Majeur": return "#f97316";    // ORANGE
      case "Modéré": return "#eab308";    // JAUNE
      default: return "#94a3b8";          // GRIS
    }
  };

  // ✅ COULEURS DES BULLES - C'est ici qu'on définit les vraies couleurs
  const getNodeBgColor = (criticality: Criticality) => {
    switch (criticality) {
      case "Critique": return "#ef4444";  // ROUGE
      case "Majeur": return "#f97316";    // ORANGE
      case "Modéré": return "#eab308";    // JAUNE
      default: return "#22c55e";          // VERT
    }
  };

  const getNodeShadowColor = (criticality: Criticality) => {
    switch (criticality) {
      case "Critique": return "rgba(239,68,68,0.5)";
      case "Majeur": return "rgba(249,115,22,0.5)";
      case "Modéré": return "rgba(234,179,8,0.5)";
      default: return "rgba(34,197,94,0.5)";
    }
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
      toast.success("Dépendances mises à jour");
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <GitBranch className="h-7 w-7 text-primary" />
            Carte des dépendances
          </h1>
          <p className="text-muted-foreground mt-1">
            Visualisation interactive des dépendances entre processus métier
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="flex items-center gap-1"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#ef4444" }} />Critique</Badge>
          <Badge variant="outline" className="flex items-center gap-1"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#f97316" }} />Majeur</Badge>
          <Badge variant="outline" className="flex items-center gap-1"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#eab308" }} />Modéré</Badge>
          <Badge variant="outline" className="flex items-center gap-1"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#22c55e" }} />Mineur</Badge>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid gap-3 md:grid-cols-4">
        <Card><CardContent className="p-3 flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Processus</p><p className="text-xl font-bold">{processes.length}</p></div><GitBranch className="h-5 w-5 text-primary opacity-70" /></CardContent></Card>
        <Card><CardContent className="p-3 flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Dépendances</p><p className="text-xl font-bold">{edges.length}</p></div><AlertTriangle className="h-5 w-5 text-orange-500 opacity-70" /></CardContent></Card>
        <Card><CardContent className="p-3 flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Processus critiques</p><p className="text-xl font-bold text-red-500">{processes.filter(p => computeMaxScore(p.impacts) >= 4).length}</p></div><ShieldAlert className="h-5 w-5 text-red-500 opacity-70" /></CardContent></Card>
        <Card><CardContent className="p-3 flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Sans dépendances</p><p className="text-xl font-bold">{processes.filter(p => !p.dependsOn || p.dependsOn.length === 0).length}</p></div><Eye className="h-5 w-5 text-green-500 opacity-70" /></CardContent></Card>
      </div>

      {/* Graphe principal */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-lg">Visualisation des dépendances</CardTitle></CardHeader>
        <CardContent>
          <div className="w-full overflow-auto bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 rounded-xl border">
            <svg viewBox="0 0 800 560" className="w-full h-[560px] cursor-pointer">
              <defs>
                <marker id="arrow-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" /></marker>
                <marker id="arrow-orange" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#f97316" /></marker>
                <marker id="arrow-yellow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#eab308" /></marker>
                <marker id="arrow-gray" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" /></marker>
              </defs>
              
              <rect x="0" y="0" width="800" height="560" fill="transparent" />
              
              {/* Lignes de dépendances colorées */}
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
                
                return (
                  <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke={edgeColor(criticality)} 
                    strokeWidth={criticality === "Critique" ? 3 : 2} 
                    strokeDasharray={criticality === "Critique" ? "none" : "4 2"}
                    markerEnd={marker} 
                    opacity={hoveredProcess === e.from || hoveredProcess === e.to ? 1 : 0.6}
                  />
                );
              })}
              
              {/* ✅ NŒUDS AVEC COULEURS */}
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
                
                // Déterminer la couleur de fond pour le cercle
                let circleColor = "#22c55e"; // vert par défaut (Mineur)
                if (criticality === "Critique") circleColor = "#ef4444";
                else if (criticality === "Majeur") circleColor = "#f97316";
                else if (criticality === "Modéré") circleColor = "#eab308";
                
                return (
                  <g key={p.id} onClick={() => handleNodeClick(p)} onMouseEnter={() => setHoveredProcess(p.id)} onMouseLeave={() => setHoveredProcess(null)} style={{ cursor: "pointer" }}>
                    {/* Glow extérieur */}
                    <circle cx={pos.x} cy={pos.y} r={isHovered ? 38 : 32} fill={circleColor} opacity={0.15} />
                    {/* Cercle principal COLORÉ */}
                    <circle cx={pos.x} cy={pos.y} r={isHovered ? 32 : 28} fill={circleColor} stroke="white" strokeWidth={isSelected ? 3 : 2} style={{ filter: isHovered ? `drop-shadow(0 0 8px ${shadowColor})` : "none" }} />
                    {/* Initiales */}
                    <text x={pos.x} y={pos.y + 4} textAnchor="middle" className="fill-white text-xs font-bold pointer-events-none">
                      {p.name.substring(0, 2).toUpperCase()}
                    </text>
                    
                    {/* Badge du nombre de dépendances */}
                    {totalDeps > 0 && (
                      <>
                        <circle cx={pos.x + 22} cy={pos.y - 22} r={10} fill="white" stroke={circleColor} strokeWidth={2} />
                        <text x={pos.x + 22} y={pos.y - 18} textAnchor="middle" className="fill-gray-800 text-[9px] font-bold pointer-events-none">
                          {totalDeps}
                        </text>
                      </>
                    )}
                    
                    {/* Nom du processus */}
                    <text x={pos.x} y={pos.y + 45} textAnchor="middle" className={`fill-foreground text-[10px] font-medium ${isHovered ? "opacity-100" : "opacity-80"}`}>
                      {p.name.length > 22 ? p.name.slice(0, 19) + "…" : p.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
          
          {/* Légende */}
          <div className="flex flex-wrap gap-4 mt-4 text-xs justify-center">
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#ef4444" }} />Critique (score ≥ 4)</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#f97316" }} />Majeur (score 3-4)</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#eab308" }} />Modéré (score 2-3)</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#22c55e" }} />Mineur (score {"<"} 2)</div>
            <div className="flex items-center gap-1 ml-4"><div className="w-6 h-0.5" style={{ backgroundColor: "#ef4444" }} />Dépendance critique</div>
            <div className="flex items-center gap-1"><div className="w-6 h-0.5 bg-gray-400 border-t-2 border-dashed border-gray-400" />Dépendance standard</div>
          </div>
          
          {/* Explication des badges */}
          <div className="text-center mt-3 text-xs text-muted-foreground">
            🔵 Le chiffre sur chaque bulle indique le nombre total de dépendances (entrantes + sortantes)
          </div>
        </CardContent>
      </Card>

      {/* Panel latéral pour MODIFIER les dépendances */}
      <Sheet open={!!selectedProcess} onOpenChange={() => setSelectedProcess(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selectedProcess && (
            <div className="space-y-4">
              <SheetHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center`} style={{ backgroundColor: getNodeBgColor(scoreToCriticality(computeMaxScore(selectedProcess.impacts))) }}>
                      <Building2 className="h-4 w-4 text-white" />
                    </div>
                    <SheetTitle>{selectedProcess.name}</SheetTitle>
                  </div>
                  {!isEditing ? (
                    <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                      <Edit3 className="h-3 w-3 mr-1" /> Modifier
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                        <X className="h-3 w-3 mr-1" /> Annuler
                      </Button>
                      <Button size="sm" onClick={saveDependencies}>
                        <Save className="h-3 w-3 mr-1" /> Sauvegarder
                      </Button>
                    </div>
                  )}
                </div>
                <SheetDescription>{selectedProcess.department} · {selectedProcess.owner}</SheetDescription>
              </SheetHeader>

              {/* Score de criticité */}
              <div className="bg-muted/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Niveau de criticité</span>
                  <Badge className={criticalityColor(scoreToCriticality(computeMaxScore(selectedProcess.impacts)))}>
                    {scoreToCriticality(computeMaxScore(selectedProcess.impacts))}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${(computeMaxScore(selectedProcess.impacts) / 5) * 100}%` }} />
                  </div>
                  <span className="text-sm font-medium">{computeMaxScore(selectedProcess.impacts)}/5</span>
                </div>
              </div>

              {/* Métriques BCM */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/20 rounded-lg p-2 text-center"><Clock className="h-4 w-4 mx-auto text-muted-foreground mb-1" /><p className="text-xs text-muted-foreground">RTO</p><p className="text-lg font-bold">{selectedProcess.rto}h</p></div>
                <div className="bg-muted/20 rounded-lg p-2 text-center"><Database className="h-4 w-4 mx-auto text-muted-foreground mb-1" /><p className="text-xs text-muted-foreground">RPO</p><p className="text-lg font-bold">{selectedProcess.rpo}h</p></div>
                <div className="bg-muted/20 rounded-lg p-2 text-center"><AlertTriangle className="h-4 w-4 mx-auto text-muted-foreground mb-1" /><p className="text-xs text-muted-foreground">MTPD</p><p className="text-lg font-bold">{selectedProcess.mtpd}h</p></div>
                <div className="bg-muted/20 rounded-lg p-2 text-center"><TrendingUp className="h-4 w-4 mx-auto text-muted-foreground mb-1" /><p className="text-xs text-muted-foreground">MBCO</p><p className="text-lg font-bold">{selectedProcess.mbco}%</p></div>
              </div>

              {/* Édition des dépendances */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <GitBranch className="h-4 w-4" />
                  Dépendances ({isEditing ? "cochez pour modifier" : selectedProcess.dependsOn?.length || 0})
                </h4>
                
                {isEditing ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-2">
                    {processes.filter(p => p.id !== selectedProcess.id).map((p) => {
                      const isChecked = editedDependsOn.includes(p.id);
                      const procCriticality = scoreToCriticality(computeMaxScore(p.impacts));
                      const critColor = procCriticality === "Critique" ? "text-red-600" : procCriticality === "Majeur" ? "text-orange-600" : procCriticality === "Modéré" ? "text-yellow-600" : "text-green-600";
                      
                      return (
                        <label key={p.id} className="flex items-center gap-3 p-2 rounded border border-border hover:bg-secondary/30 cursor-pointer">
                          <Checkbox checked={isChecked} onCheckedChange={(c) => {
                            if (c) setEditedDependsOn([...editedDependsOn, p.id]);
                            else setEditedDependsOn(editedDependsOn.filter(id => id !== p.id));
                          }} />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.department}</p>
                          </div>
                          <Badge variant="outline" className={cn("text-xs", critColor)}>{procCriticality}</Badge>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {selectedProcess.dependsOn && selectedProcess.dependsOn.length > 0 ? (
                      selectedProcess.dependsOn.map((depId: string) => {
                        const depProcess = processes.find(p => p.id === depId);
                        return depProcess ? (
                          <div key={depId} className="flex items-center justify-between p-2 bg-muted/20 rounded-lg">
                            <span className="text-sm">{depProcess.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {scoreToCriticality(computeMaxScore(depProcess.impacts))}
                            </Badge>
                          </div>
                        ) : null;
                      })
                    ) : (
                      <p className="text-sm text-muted-foreground italic">Aucune dépendance</p>
                    )}
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2 pt-2 border-t">
                <h4 className="text-sm font-semibold">Description</h4>
                <p className="text-sm text-muted-foreground">{selectedProcess.description || "Aucune description"}</p>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};