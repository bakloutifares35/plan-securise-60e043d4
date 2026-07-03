import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, Pencil, Trash2, Search, 
  ChevronDown, ChevronRight, Download, ArrowLeft,
  Building2, Server, Clock, Shield, Users, Package, Handshake, Building, Layers,
  User, Monitor, Truck, CheckCircle, AlertCircle, AlertTriangle, FileText,
  Calendar, ChevronRight as ChevronRightIcon, X, Edit, Save, Eye, EyeOff,
  Activity, Briefcase, Wrench, Link, HelpCircle,
  GitBranch, TrendingUp, Database, AlertTriangle as AlertTriangleIcon,
  ShieldAlert, Edit3
} from "lucide-react";
import { useBia } from "@/contexts/BiaContext";
import { useGovernance } from "@/contexts/GovernanceContext";
import { useRole } from "@/contexts/RoleContext";
import { computeMaxScore, scoreToCriticality, criticalityColor, ImpactAxis, TimePeriod, type Criticality } from "@/data/bia";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const AVAILABILITY_PERIODS = [
  { id: "P0_4H", label: "0-4h" },
  { id: "P4_8H", label: "4-8h" },
  { id: "P1D",  label: "1j" },
  { id: "P2D",  label: "2j" },
  { id: "P1W",  label: "1sem" },
  { id: "P2W",  label: "2sem" },
  { id: "P1M",  label: "1mois" },
];

// ── Types ──────────────────────────────────────────────────────────────────────
type BIAStatus = "critique" | "a_completer" | "a_reviser" | "complet";

interface ServiceBIA {
  id: string;
  name: string;
  owner: string;
  coordinator: string;
  processCount: number;
  criticalCount: number;
  appsIT: number;
  suppliers: number;
  completionRate: number;
  status: BIAStatus;
  lastReviewed?: string;
  description?: string;
}

// ── Constantes pour la matrice d'impact ──────────────────────────────────────
const IMPACT_AXES: ImpactAxis[] = ["Financier", "Conformité / Légal", "Opérationnel", "Réputationnel"];
const TIME_PERIODS: TimePeriod[] = ["P0_4H", "P4_8H", "P1D", "P2D", "P1W"];

// Mapping des axes pour l'affichage
const AXIS_DISPLAY: Record<string, ImpactAxis> = {
  financial: "Financier",
  regulatory: "Conformité / Légal",
  operational: "Opérationnel",
  reputation: "Réputationnel",
};

// Mapping inverse pour la sauvegarde
const AXIS_SAVE: Record<ImpactAxis, string> = {
  "Financier": "financial",
  "Conformité / Légal": "regulatory",
  "Opérationnel": "operational",
  "Réputationnel": "reputation",
};

const SEVERITY_LEVELS = [
  { value: "Mineur", color: "bg-green-50 text-green-700 border-green-200", bg: "#F0FDF4", text: "#15803D" },
  { value: "Modéré", color: "bg-yellow-50 text-yellow-700 border-yellow-200", bg: "#FEF9E7", text: "#A16207" },
  { value: "Majeur", color: "bg-orange-50 text-orange-700 border-orange-200", bg: "#FEF3C7", text: "#B45309" },
  { value: "Sévère", color: "bg-orange-100 text-orange-800 border-orange-300", bg: "#FFEDD5", text: "#C2410C" },
  { value: "Très sévère", color: "bg-red-100 text-red-700 border-red-300", bg: "#FEE2E2", text: "#B91C1C" },
];

// Mapping des valeurs numériques vers les labels de sévérité
const SEVERITY_FROM_NUMBER: Record<number, string> = {
  0: "",
  1: "Mineur",
  2: "Modéré",
  3: "Majeur",
  4: "Sévère",
  5: "Très sévère",
};

// ── Helper pour générer le code processus ────────────────────────────────────
const generateProcessCode = (department: string, index: number): string => {
  const prefix = department.substring(0, 2).toUpperCase() || "DE";
  return `${prefix}_${String(index + 1).padStart(6, '0')}`;
};

// ── Helper pour récupérer les ressources ─────────────────────────────────────
const getDepartmentResources = (processes: any[], deptId: string, deptName: string) => {
  const deptProcesses = processes.filter(p => p.department === deptName || p.entityId === deptId);
  
  const resources = {
    hr: [] as any[],
    equipment: [] as any[],
    suppliers: [] as any[],
    apps: [] as any[]
  };

  const seen = {
    hr: new Set<string>(),
    equipment: new Set<string>(),
    suppliers: new Set<string>(),
    apps: new Set<string>()
  };

  for (const proc of deptProcesses) {
    const appsFromProc = (proc as any).appsCritiques || [];
    for (const app of appsFromProc) {
      if (!seen.apps.has(app.name)) {
        seen.apps.add(app.name);
        resources.apps.push(app);
      }
    }

    const procResources = proc.resources || [];
    for (const r of procResources) {
      if (r.type === "HR") {
        if ((r as any).hrPeople) {
          for (const p of (r as any).hrPeople) {
            if (!seen.hr.has(p.name)) {
              seen.hr.add(p.name);
              resources.hr.push({ ...p, id: p.id || `hr_${Date.now()}` });
            }
          }
        } else if (r.name && !seen.hr.has(r.name)) {
          seen.hr.add(r.name);
          resources.hr.push({
            id: r.id || `hr_${Date.now()}`,
            name: r.name,
            role: (r as any).role || "—",
            phone: (r as any).phone || "",
            email: (r as any).email || "",
            availability: (r as any).availability || {}
          });
        }
      } else if (r.type === "Equipement" && !seen.equipment.has(r.name)) {
        seen.equipment.add(r.name);
        resources.equipment.push(r);
      } else if (r.type === "Fournisseur" && !seen.suppliers.has(r.name)) {
        seen.suppliers.add(r.name);
        resources.suppliers.push(r);
      }
    }
  }

  return resources;
};

// ── Helper pour calculer le taux de complétude ──────────────────────────────
const calculateCompletionRate = (processes: any[]): number => {
  if (processes.length === 0) return 0;
  let completed = 0;
  for (const p of processes) {
    const hasImpacts = p.impacts && Object.keys(p.impacts).length > 0;
    const hasResources = p.resources && p.resources.length > 0;
    if (hasImpacts && hasResources) completed++;
  }
  return Math.round((completed / processes.length) * 100);
};

// ── Helper pour déterminer le statut BIA ────────────────────────────────────
const getBIAStatus = (processes: any[], lastReviewed?: string): BIAStatus => {
  const criticalCount = processes.filter(p => {
    const score = computeMaxScoreFromImpacts(p.impacts);
    return score >= 4;
  }).length;
  
  if (criticalCount > 0) return "critique";
  
  const rate = calculateCompletionRate(processes);
  if (rate < 100) return "a_completer";
  
  if (lastReviewed) {
    const lastDate = new Date(lastReviewed);
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    if (lastDate < twoYearsAgo) return "a_reviser";
  }
  
  return "complet";
};

// ── Helper pour déterminer si un processus est critique ─────────────────────
const isProcessCritical = (impacts: any): boolean => {
  if (!impacts) return false;
  
  for (const [periodId, axes] of Object.entries(impacts)) {
    if (typeof axes === 'object' && axes !== null) {
      for (const [axisKey, value] of Object.entries(axes)) {
        const numValue = typeof value === 'number' ? value : parseInt(String(value));
        if (numValue >= 4) return true;
      }
    }
  }
  return false;
};

// ── Helper pour extraire les valeurs d'impact d'un processus ────────────────
const getImpactValue = (impacts: any, axis: ImpactAxis, period: TimePeriod): number => {
  if (!impacts) return 0;
  
  const periodData = impacts[period];
  if (!periodData || typeof periodData !== 'object') return 0;
  
  const axisKey = AXIS_SAVE[axis];
  if (!axisKey) return 0;
  
  const value = periodData[axisKey];
  if (value === undefined || value === null) return 0;
  
  return typeof value === 'number' ? value : parseInt(String(value));
};

// ── Helper pour calculer le score max des impacts ──────────────────────────
const computeMaxScoreFromImpacts = (impacts: any): number => {
  if (!impacts) return 0;
  let maxScore = 0;
  for (const [periodId, axes] of Object.entries(impacts)) {
    if (typeof axes === 'object' && axes !== null) {
      for (const [axisKey, value] of Object.entries(axes)) {
        const numValue = typeof value === 'number' ? value : parseInt(String(value));
        if (numValue > maxScore) maxScore = numValue;
      }
    }
  }
  return maxScore;
};

// ── Helper pour la carte des dépendances ────────────────────────────────────
type Pos = { x: number; y: number };

const getNodeBgColor = (criticality: Criticality) => {
  switch (criticality) {
    case "Critique": return "#ef4444";
    case "Majeur": return "#f97316";
    case "Modéré": return "#eab308";
    default: return "#22c55e";
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

const edgeColor = (criticality: Criticality) => {
  switch (criticality) {
    case "Critique": return "#ef4444";
    case "Majeur": return "#f97316";
    case "Modéré": return "#eab308";
    default: return "#94a3b8";
  }
};

// ── Composant : Carte des dépendances ──────────────────────────────────────
const DependencyMapView = ({ processes, serviceName, onProcessesUpdate }: { processes: any[]; serviceName: string; onProcessesUpdate?: () => void }) => {
  const [hoveredProcess, setHoveredProcess] = useState<string | null>(null);
  const [selectedProcess, setSelectedProcess] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedDependsOn, setEditedDependsOn] = useState<string[]>([]);

  const positions = useMemo(() => {
    const map: Record<string, Pos> = {};
    const n = processes.length;
    const cx = 400, cy = 280, r = 240;
    
    const sortedProcesses = [...processes].sort((a, b) => {
      const scoreA = computeMaxScoreFromImpacts(a.impacts);
      const scoreB = computeMaxScoreFromImpacts(b.impacts);
      return scoreB - scoreA;
    });
    
    sortedProcesses.forEach((p, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const score = computeMaxScoreFromImpacts(p.impacts);
      const radiusOffset = score >= 4 ? -50 : score >= 3 ? -30 : score >= 2 ? 0 : 30;
      map[p.id] = { 
        x: cx + (r + radiusOffset) * Math.cos(angle), 
        y: cy + (r + radiusOffset) * Math.sin(angle) 
      };
    });
    return map;
  }, [processes]);

  const edges = useMemo(() => {
    const list: { from: string; to: string; score: number; fromName: string; toName: string }[] = [];
    for (const p of processes) {
      const deps = p.depends_on || p.dependsOn || [];
      for (const dep of deps) {
        const target = processes.find((x) => x.id === dep);
        if (!target) continue;
        list.push({ 
          from: p.id, 
          to: dep, 
          score: computeMaxScoreFromImpacts(target.impacts),
          fromName: p.name,
          toName: target.name
        });
      }
    }
    return list;
  }, [processes]);

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

  const handleNodeClick = (process: any) => {
    setSelectedProcess(process);
    setEditedDependsOn(process.depends_on || process.dependsOn || []);
    setIsEditing(false);
  };

  const saveDependencies = async () => {
    if (!selectedProcess) return;
    
    const { error } = await (supabase as any)
      .from('processus_metier')
      .update({ depends_on: editedDependsOn })
      .eq('id', selectedProcess.id);
    
    if (error) {
      toast({
        title: "Erreur",
        description: "Erreur lors de la sauvegarde des dépendances",
        variant: "destructive"
      });
      console.error(error);
    } else {
      const updatedProcess = { ...selectedProcess, depends_on: editedDependsOn, dependsOn: editedDependsOn };
      setSelectedProcess(updatedProcess);
      
      if (onProcessesUpdate) {
        onProcessesUpdate();
      }
      toast({
        title: "Succès",
        description: "Dépendances mises à jour avec succès"
      });
      setIsEditing(false);
    }
  };

  if (processes.length === 0) {
    return <div className="text-center py-8 text-gray-400">Aucun processus dans ce service.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h4 className="font-medium text-gray-800 flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-indigo-600" />
          Carte des dépendances
        </h4>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline" className="flex items-center gap-1 text-xs">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#ef4444" }} />Critique
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1 text-xs">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#f97316" }} />Majeur
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1 text-xs">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#eab308" }} />Modéré
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1 text-xs">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#22c55e" }} />Mineur
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-gray-50/80 border-gray-200">
          <CardContent className="p-3 flex items-center justify-between">
            <div><p className="text-[10px] text-gray-400 font-medium">Processus</p><p className="text-lg font-bold">{processes.length}</p></div>
            <GitBranch className="h-4 w-4 text-primary opacity-70" />
          </CardContent>
        </Card>
        <Card className="bg-gray-50/80 border-gray-200">
          <CardContent className="p-3 flex items-center justify-between">
            <div><p className="text-[10px] text-gray-400 font-medium">Dépendances</p><p className="text-lg font-bold">{edges.length}</p></div>
            <AlertTriangle className="h-4 w-4 text-orange-500 opacity-70" />
          </CardContent>
        </Card>
        <Card className="bg-gray-50/80 border-gray-200">
          <CardContent className="p-3 flex items-center justify-between">
            <div><p className="text-[10px] text-gray-400 font-medium">Critiques</p><p className="text-lg font-bold text-red-500">{processes.filter(p => computeMaxScoreFromImpacts(p.impacts) >= 4).length}</p></div>
            <ShieldAlert className="h-4 w-4 text-red-500 opacity-70" />
          </CardContent>
        </Card>
        <Card className="bg-gray-50/80 border-gray-200">
          <CardContent className="p-3 flex items-center justify-between">
            <div><p className="text-[10px] text-gray-400 font-medium">Sans dépendances</p><p className="text-lg font-bold">{processes.filter(p => !p.depends_on || p.depends_on.length === 0).length}</p></div>
            <Eye className="h-4 w-4 text-green-500 opacity-70" />
          </CardContent>
        </Card>
      </div>

      <div className="w-full overflow-auto bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 rounded-xl border">
        <svg viewBox="0 0 800 560" className="w-full h-[480px] cursor-pointer">
          <defs>
            <marker id="arrow-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" /></marker>
            <marker id="arrow-orange" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#f97316" /></marker>
            <marker id="arrow-yellow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#eab308" /></marker>
            <marker id="arrow-gray" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" /></marker>
          </defs>
          
          <rect x="0" y="0" width="800" height="560" fill="transparent" />
          
          {edges.map((e, i) => {
            const a = positions[e.from];
            const b = positions[e.to];
            if (!a || !b) return null;
            const targetProcess = processes.find(p => p.id === e.to);
            const criticality: Criticality = targetProcess ? scoreToCriticality(computeMaxScoreFromImpacts(targetProcess.impacts)) : "Mineur";
            
            let marker = "url(#arrow-gray)";
            if (criticality === "Critique") marker = "url(#arrow-red)";
            else if (criticality === "Majeur") marker = "url(#arrow-orange)";
            else if (criticality === "Modéré") marker = "url(#arrow-yellow)";
            
            return (
              <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={edgeColor(criticality)} 
                strokeWidth={criticality === "Critique" ? 3.5 : 2.5} 
                strokeDasharray={criticality === "Critique" ? "none" : "6 3"}
                markerEnd={marker} 
                opacity={hoveredProcess === e.from || hoveredProcess === e.to ? 1 : 0.7}
              />
            );
          })}
          
          {processes.map((p) => {
            const pos = positions[p.id];
            if (!pos) return null;
            const score = computeMaxScoreFromImpacts(p.impacts);
            const criticality: Criticality = scoreToCriticality(score);
            const isHovered = hoveredProcess === p.id;
            const isSelected = selectedProcess?.id === p.id;
            const incomingCount = stats.incoming[p.id] || 0;
            const outgoingCount = stats.outgoing[p.id] || 0;
            const totalDeps = incomingCount + outgoingCount;
            
            let circleColor = "#22c55e";
            if (criticality === "Critique") circleColor = "#ef4444";
            else if (criticality === "Majeur") circleColor = "#f97316";
            else if (criticality === "Modéré") circleColor = "#eab308";
            
            const shadowColor = getNodeShadowColor(criticality);
            const radius = isHovered ? 44 : 38;
            
            return (
              <g key={p.id} onClick={() => handleNodeClick(p)} onMouseEnter={() => setHoveredProcess(p.id)} onMouseLeave={() => setHoveredProcess(null)} style={{ cursor: "pointer" }}>
                <circle cx={pos.x} cy={pos.y} r={isHovered ? 55 : 46} fill={circleColor} opacity={0.12} />
                <circle cx={pos.x} cy={pos.y} r={radius} fill={circleColor} stroke="white" strokeWidth={isSelected ? 4 : 2.5} style={{ filter: isHovered ? `drop-shadow(0 0 14px ${shadowColor})` : "none" }} />
                <text x={pos.x} y={pos.y + 6} textAnchor="middle" className="fill-white text-base font-bold pointer-events-none">
                  {p.name.substring(0, 2).toUpperCase()}
                </text>
                
                {totalDeps > 0 && (
                  <>
                    <circle cx={pos.x + 30} cy={pos.y - 30} r={14} fill="white" stroke={circleColor} strokeWidth={2.5} />
                    <text x={pos.x + 30} y={pos.y - 25} textAnchor="middle" className="fill-gray-800 text-sm font-bold pointer-events-none">
                      {totalDeps}
                    </text>
                  </>
                )}
                
                <text x={pos.x} y={pos.y + radius + 24} textAnchor="middle" className={`fill-foreground text-sm font-semibold ${isHovered ? "opacity-100" : "opacity-90"}`}>
                  {p.name.length > 22 ? p.name.slice(0, 19) + "…" : p.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      
      <div className="flex flex-wrap gap-4 text-xs justify-center">
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#ef4444" }} />Critique (score ≥ 4)</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#f97316" }} />Majeur (score 3-4)</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#eab308" }} />Modéré (score 2-3)</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#22c55e" }} />Mineur (score {"<"} 2)</div>
        <div className="flex items-center gap-1 ml-4"><div className="w-6 h-0.5" style={{ backgroundColor: "#ef4444" }} />Dépendance critique</div>
        <div className="flex items-center gap-1"><div className="w-6 h-0.5 bg-gray-400 border-t-2 border-dashed border-gray-400" />Dépendance standard</div>
      </div>
      
      <div className="text-center text-xs text-muted-foreground">
        🔵 Le chiffre sur chaque bulle indique le nombre total de dépendances (entrantes + sortantes) — Cliquez sur une bulle pour modifier
      </div>

      {selectedProcess && (
        <Dialog open={!!selectedProcess} onOpenChange={() => setSelectedProcess(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center`} style={{ backgroundColor: getNodeBgColor(scoreToCriticality(computeMaxScoreFromImpacts(selectedProcess.impacts))) }}>
                    <Building2 className="h-4 w-4 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold">{selectedProcess.name}</h3>
                </div>
                {!isEditing ? (
                  <Button variant="outline" size="sm" onClick={() => { setIsEditing(true); setEditedDependsOn(selectedProcess.depends_on || selectedProcess.dependsOn || []); }}>
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

              <p className="text-sm text-muted-foreground">{selectedProcess.department} · {selectedProcess.owner}</p>

              <div className="bg-muted/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Niveau de criticité</span>
                  <Badge className={criticalityColor(scoreToCriticality(computeMaxScoreFromImpacts(selectedProcess.impacts)))}>
                    {scoreToCriticality(computeMaxScoreFromImpacts(selectedProcess.impacts))}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${(computeMaxScoreFromImpacts(selectedProcess.impacts) / 5) * 100}%` }} />
                  </div>
                  <span className="text-sm font-medium">{computeMaxScoreFromImpacts(selectedProcess.impacts)}/5</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/20 rounded-lg p-2 text-center"><Clock className="h-4 w-4 mx-auto text-muted-foreground mb-1" /><p className="text-xs text-muted-foreground">RTO</p><p className="text-lg font-bold">{selectedProcess.rto}h</p></div>
                <div className="bg-muted/20 rounded-lg p-2 text-center"><Database className="h-4 w-4 mx-auto text-muted-foreground mb-1" /><p className="text-xs text-muted-foreground">RPO</p><p className="text-lg font-bold">{selectedProcess.rpo}h</p></div>
                <div className="bg-muted/20 rounded-lg p-2 text-center"><AlertTriangle className="h-4 w-4 mx-auto text-muted-foreground mb-1" /><p className="text-xs text-muted-foreground">MTPD</p><p className="text-lg font-bold">{selectedProcess.mtpd}h</p></div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <GitBranch className="h-4 w-4" />
                  Dépendances {isEditing ? "(cochez pour modifier)" : `(${(selectedProcess.depends_on || selectedProcess.dependsOn || []).length || 0})`}
                </h4>
                
                {isEditing ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-2">
                    {processes.filter(p => p.id !== selectedProcess.id).map((p) => {
                      const isChecked = editedDependsOn.includes(p.id);
                      const procCriticality = scoreToCriticality(computeMaxScoreFromImpacts(p.impacts));
                      const critColor = procCriticality === "Critique" ? "text-red-600" : procCriticality === "Majeur" ? "text-orange-600" : procCriticality === "Modéré" ? "text-yellow-600" : "text-green-600";
                      
                      return (
                        <label key={p.id} className="flex items-center gap-3 p-2 rounded border border-border hover:bg-secondary/30 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={isChecked} 
                            onChange={(e) => {
                              if (e.target.checked) setEditedDependsOn([...editedDependsOn, p.id]);
                              else setEditedDependsOn(editedDependsOn.filter(id => id !== p.id));
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
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
                    {(selectedProcess.depends_on || selectedProcess.dependsOn || []).length > 0 ? (
                      (selectedProcess.depends_on || selectedProcess.dependsOn || []).map((depId: string) => {
                        const depProcess = processes.find(p => p.id === depId);
                        return depProcess ? (
                          <div key={depId} className="flex items-center justify-between p-2 bg-muted/20 rounded-lg">
                            <span className="text-sm">{depProcess.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {scoreToCriticality(computeMaxScoreFromImpacts(depProcess.impacts))}
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

              <div className="space-y-2 pt-2 border-t">
                <h4 className="text-sm font-semibold">Description</h4>
                <p className="text-sm text-muted-foreground">{selectedProcess.description || "Aucune description"}</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

// ── Composant : Carte Service BIA ──────────────────────────────────────────
const BIAServiceCard = ({ 
  service,
  onClick,
}: { 
  service: ServiceBIA;
  onClick: () => void;
}) => {
  const statusColors = {
    critique: "border-l-4 border-l-red-500",
    a_completer: "border-l-4 border-l-amber-500",
    a_reviser: "border-l-4 border-l-orange-500",
    complet: "border-l-4 border-l-green-500"
  };

  const statusBadges = {
    critique: { label: "Critique", className: "bg-red-100 text-red-700 border-red-200" },
    a_completer: { label: "À compléter", className: "bg-amber-100 text-amber-700 border-amber-200" },
    a_reviser: { label: "À réviser", className: "bg-orange-100 text-orange-700 border-orange-200" },
    complet: { label: "Complet", className: "bg-green-100 text-green-700 border-green-200" }
  };

  const barColor = service.completionRate === 100 ? "bg-green-500" : "bg-amber-500";

  return (
    <div 
      className={`bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:shadow-md transition-all duration-200 hover:border-indigo-300 ${statusColors[service.status]}`}
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">{service.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            👤 {service.owner} · Coord. {service.coordinator}
          </p>
        </div>
        <Badge className={statusBadges[service.status].className}>
          {statusBadges[service.status].label}
        </Badge>
      </div>

      <div className="grid grid-cols-4 gap-2 py-3 border-t border-b border-gray-100 mb-3">
        <div className="text-center">
          <div className="text-lg font-bold font-mono">{service.processCount}</div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wide">Processus</div>
        </div>
        <div className="text-center">
          <div className={`text-lg font-bold font-mono ${service.criticalCount > 0 ? 'text-red-600' : 'text-gray-600'}`}>
            {service.criticalCount}
          </div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wide">Critiques</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold font-mono">{service.appsIT}</div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wide">Applis IT</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold font-mono">{service.suppliers}</div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wide">Prestataires</div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2 flex-1">
          <div className="flex-1 max-w-28 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full ${barColor}`} 
              style={{ width: `${service.completionRate}%` }}
            />
          </div>
          <span className="text-xs font-mono font-medium text-gray-500">
            {service.completionRate}%
          </span>
        </div>
        <span className="text-xs text-indigo-600 font-medium flex items-center gap-1">
          Ouvrir <ChevronRightIcon className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  );
};

// ── Composant : Section Direction ──────────────────────────────────────────
const DirectionSection = ({ 
  name, 
  icon,
  services,
  onServiceClick,
}: {
  name: string;
  icon: React.ReactNode;
  services: ServiceBIA[];
  onServiceClick: (service: ServiceBIA) => void;
}) => {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center">
          {icon}
        </div>
        <h3 className="font-semibold text-gray-800">{name}</h3>
        <span className="text-xs text-gray-400">{services.length} service{services.length > 1 ? 's' : ''}</span>
        <div className="flex-1 h-px bg-gray-200"></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {services.map(service => (
          <BIAServiceCard
            key={service.id}
            service={service}
            onClick={() => onServiceClick(service)}
          />
        ))}
      </div>
    </div>
  );
};

// ── Composant : Matrice d'impact (LECTURE SEULE) ────────────────────────────
const ImpactMatrix = ({ 
  impacts, 
  isCritical,
  rto,
  rpo,
  mtpd
}: { 
  impacts: any;
  isCritical: boolean;
  rto?: number;
  rpo?: number;
  mtpd?: number;
}) => {
  const getSeverityColor = (value: number) => {
    if (value === 0) return "bg-gray-50 text-gray-400 border-gray-200";
    const label = SEVERITY_FROM_NUMBER[value];
    const found = SEVERITY_LEVELS.find(s => s.value === label);
    return found ? found.color : "bg-gray-50 border-gray-200";
  };

  const getSeverityText = (value: number): string => {
    return SEVERITY_FROM_NUMBER[value] || "—";
  };

  return (
    <div className="space-y-4">
      {/* Objectifs de continuité */}
      <div className="grid grid-cols-3 gap-3 bg-gray-50 rounded-lg p-3 border border-gray-200">
        <div className="text-center">
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">RTO</p>
          <p className="text-xl font-bold text-red-600">{rto || 0}h</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">RPO</p>
          <p className="text-xl font-bold text-orange-600">{rpo || 0}h</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">MTPD</p>
          <p className="text-xl font-bold text-blue-600">{mtpd || 0}h</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm min-w-[600px]">
          <thead>
            <tr>
              <th className="text-left text-xs font-semibold text-gray-400 bg-gray-50 p-2 border-b border-gray-200 w-40">
                Type d'impact
              </th>
              {TIME_PERIODS.map(period => {
                const label = AVAILABILITY_PERIODS.find(p => p.id === period)?.label || period;
                return (
                  <th key={period} className="text-center text-xs font-semibold text-gray-400 bg-gray-50 p-2 border-b border-gray-200">
                    ≤ {label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {IMPACT_AXES.map(axis => {
              return (
                <tr key={axis}>
                  <td className="text-left p-2 border-b border-gray-100 font-medium text-sm">
                    {axis}
                    <div className="text-[10px] font-normal text-gray-400">
                      {axis === "Financier" && "Perte financière"}
                      {axis === "Conformité / Légal" && "Sanctions, litiges"}
                      {axis === "Opérationnel" && "Perturbation des activités"}
                      {axis === "Réputationnel" && "Confiance clients / partenaires"}
                    </div>
                  </td>
                  {TIME_PERIODS.map(period => {
                    const value = getImpactValue(impacts, axis, period);
                    const color = getSeverityColor(value);
                    const text = getSeverityText(value);
                    return (
                      <td key={period} className="p-1 border-b border-gray-100 text-center">
                        <div
                          className={`w-full py-1.5 px-2 rounded-md text-xs font-medium border ${color}`}
                        >
                          {text}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Légende */}
      <div className="flex flex-wrap gap-3 p-3 bg-gray-50 rounded-lg">
        {SEVERITY_LEVELS.map(sev => (
          <div key={sev.value} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: sev.bg, border: `1px solid ${sev.text}` }} />
            <span className="text-[10px] text-gray-500">{sev.value}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-gray-50 border border-gray-300" />
          <span className="text-[10px] text-gray-500">— Non renseigné</span>
        </div>
      </div>

      {/* Résultat automatique */}
      <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
        <span className="text-sm font-medium text-gray-700">Résultat automatique :</span>
        {isCritical ? (
          <Badge className="bg-red-100 text-red-700 border-red-200">
            <AlertCircle className="h-3 w-3 mr-1" />
            Business critical — YES
          </Badge>
        ) : (
          <Badge className="bg-gray-100 text-gray-600 border-gray-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            Non critique
          </Badge>
        )}
      </div>
    </div>
  );
};

// ── Composant : Processus Accordion ─────────────────────────────────────────
const ProcessAccordion = ({ 
  process, 
  index,
  department,
}: { 
  process: any;
  index: number;
  department: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const score = computeMaxScoreFromImpacts(process.impacts);
  const criticality = scoreToCriticality(score);
  const code = generateProcessCode(department, index);
  const isCritical = isProcessCritical(process.impacts);

  return (
    <div className={`border rounded-xl overflow-hidden bg-white ${isCritical ? 'border-l-4 border-l-red-500' : ''}`}>
      <div 
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
          {code}
        </span>
        <span className="font-medium text-sm flex-1">{process.name}</span>
        <Badge className={criticalityColor(criticality)}>{criticality}</Badge>
        <span className="text-xs text-gray-400">Resp. : {process.owner || "—"}</span>
        <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </div>
      
      {isOpen && (
        <div className="p-4 border-t border-gray-100">
          <ImpactMatrix
            impacts={process.impacts}
            isCritical={isCritical}
            rto={process.rto}
            rpo={process.rpo}
            mtpd={process.mtpd}
          />
        </div>
      )}
    </div>
  );
};

// ── Composant : BIA Fiche Détail ────────────────────────────────────────────
const BIAFicheDetail = ({
  service,
  processes,
  onBack,
  onEdit,
  onDelete,
  canDelete,
  entities,
}: {
  service: ServiceBIA;
  processes: any[];
  onBack: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  canDelete: boolean;
  entities: any[];
}) => {
  const [activeTab, setActiveTab] = useState("impact");
  const [editedFields, setEditedFields] = useState({
    evaluationDate: service.lastReviewed || new Date().toLocaleDateString('fr-FR'),
    validatedBy: "— En attente",
  });

  const allApps = processes.flatMap(p => (p as any).appsCritiques || []);
  const uniqueApps = allApps.filter((app, index, self) => 
    index === self.findIndex(a => a.name === app.name)
  );

  const allSuppliers = processes.flatMap(p => 
    (p.resources || []).filter((r: any) => r.type === "Fournisseur")
  );
  const uniqueSuppliers = allSuppliers.filter((sup, index, self) => 
    index === self.findIndex(s => s.name === sup.name)
  );

  const allHR = processes.flatMap(p => {
    const hrResources = (p.resources || []).filter((r: any) => r.type === "HR");
    const people: any[] = [];
    for (const r of hrResources) {
      if ((r as any).hrPeople) {
        for (const ppl of (r as any).hrPeople) {
          people.push({ ...ppl, processName: p.name });
        }
      } else if (r.name) {
        people.push({ ...r, processName: p.name });
      }
    }
    return people;
  });

  const allEquipment = processes.flatMap(p => 
    (p.resources || [])
      .filter((r: any) => r.type === "Equipement")
      .map((eq: any) => ({ ...eq, processName: p.name }))
  );

  // Calcul des postes de travail nécessaires depuis les RH
  const calculateWorkstations = () => {
    const periods = AVAILABILITY_PERIODS;
    const result: Record<string, number> = {};
    for (const period of periods) {
      const count = allHR.filter(person => person.availability?.[period.id] === true).length;
      result[period.id] = count;
    }
    return result;
  };

  const workstationCounts = calculateWorkstations();

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="h-7 w-7 text-indigo-600" />
            {service.name} — Fiche BIA
          </h1>
          {service.description && (
            <p className="text-sm text-gray-500 mt-1">{service.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Retour
          </Button>
          <Button className="gap-2 bg-green-600 hover:bg-green-700">
            <CheckCircle className="h-4 w-4" /> Soumettre pour validation
          </Button>
        </div>
      </div>

      {/* Meta-bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 grid grid-cols-2 md:grid-cols-5 gap-4">
        <div>
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Domaine métier</p>
          <p className="font-medium">{entities.find(e => e.id === service.id)?.name || "—"}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Responsable domaine</p>
          <p className="font-medium">{service.owner}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Coordinateur BCM</p>
          <p className="font-medium">{service.coordinator}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Date d'évaluation</p>
          <div className="flex items-center gap-1">
            <p className="font-medium">{editedFields.evaluationDate}</p>
            <button className="text-indigo-500 hover:text-indigo-700">
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Validé par</p>
          <div className="flex items-center gap-1">
            <p className="font-medium">{editedFields.validatedBy}</p>
            <button className="text-indigo-500 hover:text-indigo-700">
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Onglets */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-transparent border-b border-gray-200 rounded-none p-0 h-auto gap-0 flex flex-wrap">
          <TabsTrigger 
            value="impact" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent px-4 py-2.5 text-sm font-medium text-gray-500 data-[state=active]:text-indigo-600"
          >
            1. Évaluation d'impact
          </TabsTrigger>
          <TabsTrigger 
            value="resources"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent px-4 py-2.5 text-sm font-medium text-gray-500 data-[state=active]:text-indigo-600"
          >
            2. Ressources requises
          </TabsTrigger>
          <TabsTrigger 
            value="apps"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent px-4 py-2.5 text-sm font-medium text-gray-500 data-[state=active]:text-indigo-600"
          >
            3. Applications IT
          </TabsTrigger>
          <TabsTrigger 
            value="suppliers"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent px-4 py-2.5 text-sm font-medium text-gray-500 data-[state=active]:text-indigo-600"
          >
            4. Prestataires
          </TabsTrigger>
          <TabsTrigger 
            value="dependencies"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent px-4 py-2.5 text-sm font-medium text-gray-500 data-[state=active]:text-indigo-600"
          >
            5. Dépendances
          </TabsTrigger>
          <TabsTrigger 
            value="workarounds"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent px-4 py-2.5 text-sm font-medium text-gray-500 data-[state=active]:text-indigo-600"
          >
            6. Contournements de crise
          </TabsTrigger>
        </TabsList>

        {/* Onglet 1 — Évaluation d'impact */}
        <TabsContent value="impact" className="pt-4">
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm text-indigo-800 mb-4 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              Pour chaque type d'impact, indiquez la gravité selon le délai écoulé depuis l'incident. Un processus est <strong>critique</strong> dès qu'un impact « sévère » ou « très sévère » apparaît dans les 120 premières heures.
            </div>
          </div>

          <div className="space-y-3">
            {processes.map((p, idx) => (
              <ProcessAccordion
                key={p.id}
                process={p}
                index={idx}
                department={service.name}
              />
            ))}
          </div>

          <Button variant="outline" className="w-full mt-4 border-dashed text-gray-400 hover:text-gray-600">
            <Plus className="h-4 w-4 mr-2" /> Ajouter un processus
          </Button>
        </TabsContent>

        {/* Onglet 2 — Ressources requises */}
        <TabsContent value="resources" className="pt-4">
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm text-indigo-800 mb-4 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>Ressources minimales pour maintenir les processus critiques dans la première semaine après un sinistre.</div>
          </div>

          {/* Bloc 1 — Personnel nécessaire */}
          <div className="border rounded-xl overflow-hidden bg-white mb-4">
            <div 
              className="flex items-center gap-3 p-3 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={(e) => {
                const body = e.currentTarget.nextElementSibling;
                if (body) {
                  body.style.display = body.style.display === 'none' ? 'block' : 'none';
                }
              }}
            >
              <div className="w-7 h-7 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Users className="h-4 w-4" />
              </div>
              <h4 className="font-medium text-gray-800 flex-1">Personnel nécessaire</h4>
              <span className="text-xs text-gray-400">{allHR.length} personne{allHR.length > 1 ? 's' : ''}</span>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </div>
            <div className="p-4">
              {allHR.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-medium">Personne / Rôle</TableHead>
                        <TableHead className="font-medium">Processus</TableHead>
                        <TableHead className="font-medium">Contact</TableHead>
                        {AVAILABILITY_PERIODS.map(p => (
                          <TableHead key={p.id} className="text-center font-mono text-xs font-medium">
                            {p.label}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allHR.map((person, idx) => (
                        <TableRow key={person.id || idx} className="hover:bg-indigo-50/30 transition-colors">
                          <TableCell>
                            <div className="font-medium text-sm">{person.name}</div>
                            <div className="text-xs text-gray-400">{person.role || "—"}</div>
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">{person.processName}</TableCell>
                          <TableCell>
                            {person.phone && <div className="text-xs">📞 {person.phone}</div>}
                            {person.email && <div className="text-xs">✉️ {person.email}</div>}
                            {!person.phone && !person.email && <span className="text-xs text-gray-400">—</span>}
                          </TableCell>
                          {AVAILABILITY_PERIODS.map(period => {
                            const isAvailable = person.availability?.[period.id] || false;
                            return (
                              <TableCell key={period.id} className="text-center">
                                <span className={`text-lg font-bold ${isAvailable ? "text-green-600" : "text-red-400"}`}>
                                  {isAvailable ? "✓" : "✗"}
                                </span>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                      <TableRow className="bg-gray-50 font-semibold">
                        <TableCell colSpan={3} className="font-medium">Total FTE</TableCell>
                        {AVAILABILITY_PERIODS.map((period) => {
                          const total = allHR.filter(p => p.availability?.[period.id] === true).length;
                          return (
                            <TableCell key={period.id} className="text-center font-mono">
                              {total}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-400 text-sm">
                  Aucune ressource humaine déclarée.
                </div>
              )}
            </div>
          </div>

          {/* Bloc 2 — Postes de travail nécessaires */}
          <div className="border rounded-xl overflow-hidden bg-white mb-4">
            <div 
              className="flex items-center gap-3 p-3 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={(e) => {
                const body = e.currentTarget.nextElementSibling;
                if (body) {
                  body.style.display = body.style.display === 'none' ? 'block' : 'none';
                }
              }}
            >
              <div className="w-7 h-7 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Monitor className="h-4 w-4" />
              </div>
              <h4 className="font-medium text-gray-800 flex-1">Postes de travail nécessaires</h4>
              <span className="text-xs text-gray-400">1 poste par personne disponible</span>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </div>
            <div className="p-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="font-medium">Type de poste</TableHead>
                      {AVAILABILITY_PERIODS.map(p => (
                        <TableHead key={p.id} className="text-center font-mono text-xs font-medium">
                          {p.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium text-sm">Postes de travail</TableCell>
                      {AVAILABILITY_PERIODS.map(period => (
                        <TableCell key={period.id} className="text-center font-mono">
                          {workstationCounts[period.id] || 0}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          {/* Bloc 3 — Équipements & infrastructure */}
          <div className="border rounded-xl overflow-hidden bg-white mb-4">
            <div 
              className="flex items-center gap-3 p-3 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={(e) => {
                const body = e.currentTarget.nextElementSibling;
                if (body) {
                  body.style.display = body.style.display === 'none' ? 'block' : 'none';
                }
              }}
            >
              <div className="w-7 h-7 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Package className="h-4 w-4" />
              </div>
              <h4 className="font-medium text-gray-800 flex-1">Équipements & infrastructure</h4>
              <span className="text-xs text-gray-400">{allEquipment.length} équipement{allEquipment.length > 1 ? 's' : ''}</span>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </div>
            <div className="p-4">
              {allEquipment.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-medium">Équipement</TableHead>
                        <TableHead className="text-center font-mono text-xs font-medium">≤ 2H</TableHead>
                        <TableHead className="text-center font-mono text-xs font-medium">≤ 24H</TableHead>
                        <TableHead className="text-center font-mono text-xs font-medium">≤ 48H</TableHead>
                        <TableHead className="text-center font-mono text-xs font-medium">≤ 120H</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allEquipment.map((eq, idx) => {
                        const quantities = eq.quantities || {};
                        return (
                          <TableRow key={eq.id || idx} className="hover:bg-indigo-50/30 transition-colors">
                            <TableCell className="font-medium text-sm">{eq.name}</TableCell>
                            <TableCell className="text-center font-mono">{quantities.P0_4H || eq.quantity || 2}</TableCell>
                            <TableCell className="text-center font-mono">{quantities.P4_8H || eq.quantity || 3}</TableCell>
                            <TableCell className="text-center font-mono">{quantities.P1D || eq.quantity || 3}</TableCell>
                            <TableCell className="text-center font-mono">{quantities.P2D || eq.quantity || 4}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-400 text-sm">
                  Aucun équipement déclaré.
                </div>
              )}
            </div>
          </div>

          {/* Bloc 4 — Documents & supports critiques */}
          <div className="border rounded-xl overflow-hidden bg-white">
            <div 
              className="flex items-center gap-3 p-3 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={(e) => {
                const body = e.currentTarget.nextElementSibling;
                if (body) {
                  body.style.display = body.style.display === 'none' ? 'block' : 'none';
                }
              }}
            >
              <div className="w-7 h-7 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <FileText className="h-4 w-4" />
              </div>
              <h4 className="font-medium text-gray-800 flex-1">Documents & supports critiques</h4>
              <span className="text-xs text-gray-400">
                {processes.reduce((acc, p) => acc + ((p.documents || []).length), 0)} élément{processes.reduce((acc, p) => acc + ((p.documents || []).length), 0) > 1 ? 's' : ''}
              </span>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </div>
            <div className="p-4">
              {processes.some(p => p.documents && p.documents.length > 0) ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-medium">Document / support</TableHead>
                        <TableHead className="font-medium">Processus</TableHead>
                        <TableHead className="font-medium">Disponible sous</TableHead>
                        <TableHead className="font-medium">Classification</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {processes.flatMap(p => 
                        (p.documents || []).map((doc: any) => ({ ...doc, processName: p.name }))
                      ).map((doc, idx) => (
                        <TableRow key={doc.id || idx} className="hover:bg-indigo-50/30 transition-colors">
                          <TableCell className="font-medium text-sm">{doc.name}</TableCell>
                          <TableCell className="text-sm text-gray-500">{doc.processName}</TableCell>
                          <TableCell>
                            <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 font-mono">
                              {doc.availableUnder || "≤ 2h"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={doc.confidential ? "bg-red-100 text-red-700 border-red-200" : "bg-amber-100 text-amber-700 border-amber-200"}>
                              {doc.confidential ? "Confidentiel" : "Interne"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-400 text-sm">
                  Aucun document critique déclaré.
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Onglet 3 — Applications IT */}
        <TabsContent value="apps" className="pt-4">
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm text-indigo-800 mb-4 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div><strong>RTO</strong> = délai de reprise acceptable · <strong>RPO</strong> = perte de données maximale acceptable.</div>
          </div>

          <div className="border rounded-xl overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-medium">Application / service</TableHead>
                    <TableHead className="font-medium">Processus</TableHead>
                    <TableHead className="text-center font-mono text-xs font-medium">RTO</TableHead>
                    <TableHead className="text-center font-mono text-xs font-medium">RPO</TableHead>
                    <TableHead className="font-medium">Alternatif</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uniqueApps.length > 0 ? (
                    uniqueApps.map((app, idx) => {
                      const parentProcess = processes.find(p => 
                        (p as any).appsCritiques?.some((a: any) => a.name === app.name)
                      );
                      return (
                        <TableRow key={app.id || idx} className="hover:bg-indigo-50/30 transition-colors">
                          <TableCell className="font-medium text-sm flex items-center gap-2">
                            <Server className="h-3.5 w-3.5 text-purple-500" />
                            {app.name}
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">{parentProcess?.name || "—"}</TableCell>
                          <TableCell className="text-center font-mono">{app.rto_hours || app.rto || 0}h</TableCell>
                          <TableCell className="text-center font-mono">{app.rpo_hours || app.rpo || 0}h</TableCell>
                          <TableCell className="text-sm text-gray-500">{app.remplacablePar || app.remplacable_par || "—"}</TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-400 py-4">
                        Aucune application IT déclarée.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <Button variant="outline" className="w-full mt-4 border-dashed text-gray-400 hover:text-gray-600">
            <Plus className="h-4 w-4 mr-2" /> Ajouter une application
          </Button>
        </TabsContent>

        {/* Onglet 4 — Prestataires */}
        <TabsContent value="suppliers" className="pt-4">
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm text-indigo-800 mb-4 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>Prestataires externes ou intra-groupe nécessaires pour l'exploitation de secours.</div>
          </div>

          <div className="border rounded-xl overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-medium">Prestataire / service</TableHead>
                    <TableHead className="font-medium">Processus</TableHead>
                    <TableHead className="text-center font-mono text-xs font-medium">RTO</TableHead>
                    <TableHead className="font-medium">Alternatif</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uniqueSuppliers.length > 0 ? (
                    uniqueSuppliers.map((sup, idx) => {
                      const parentProcess = processes.find(p => 
                        (p.resources || []).some((r: any) => r.type === "Fournisseur" && r.name === sup.name)
                      );
                      // Le RTO du prestataire est stocké dans rpo_hours ou rpo
                      const rtoValue = sup.rpo_hours || sup.rpo || sup.rto_hours || sup.rto || "—";
                      return (
                        <TableRow key={sup.id || idx} className="hover:bg-indigo-50/30 transition-colors">
                          <TableCell className="font-medium text-sm">{sup.name}</TableCell>
                          <TableCell className="text-sm text-gray-500">{parentProcess?.name || "—"}</TableCell>
                          <TableCell className="text-center font-mono">
                            {rtoValue !== "—" ? `${rtoValue}h` : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">{sup.substitutability || "—"}</TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-gray-400 py-4">
                        Aucun prestataire déclaré.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <Button variant="outline" className="w-full mt-4 border-dashed text-gray-400 hover:text-gray-600">
            <Plus className="h-4 w-4 mr-2" /> Ajouter un prestataire
          </Button>
        </TabsContent>

        {/* Onglet 5 — Dépendances */}
        <TabsContent value="dependencies" className="pt-4">
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm text-indigo-800 mb-4 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>Quels processus amont / aval sont requis pour soutenir ce processus critique ?</div>
          </div>

          <DependencyMapView 
            processes={processes} 
            serviceName={service.name}
            onProcessesUpdate={() => {}}
          />
        </TabsContent>

        {/* Onglet 6 — Contournements de crise */}
        <TabsContent value="workarounds" className="pt-4">
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm text-indigo-800 mb-4 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>Contournements manuels à préparer <strong>avant</strong> l'incident. Concentrez-vous sur les 24 premières heures.</div>
          </div>

          <div className="border rounded-xl overflow-hidden bg-white">
            <div className="flex items-center gap-3 p-3 bg-red-50 border-b border-red-200">
              <div className="w-7 h-7 rounded bg-red-100 text-red-600 flex items-center justify-center">
                <AlertCircle className="h-4 w-4" />
              </div>
              <h4 className="font-medium text-gray-800 flex-1">Scénario — Panne IT totale</h4>
              <span className="text-xs text-gray-400">
                {processes.reduce((acc, p) => acc + ((p as any).workarounds || []).length, 0)} tâche{processes.reduce((acc, p) => acc + ((p as any).workarounds || []).length, 0) > 1 ? 's' : ''} critique{processes.reduce((acc, p) => acc + ((p as any).workarounds || []).length, 0) > 1 ? 's' : ''}
              </span>
            </div>
            <div className="p-4">
              {(() => {
                const allWorkarounds = processes.flatMap(p => 
                  ((p as any).workarounds || []).map((wa: any) => ({ ...wa, sourceProcess: p.name }))
                );
                if (allWorkarounds.length === 0) {
                  return (
                    <div className="text-center py-4 text-gray-400 text-sm">
                      Aucun contournement déclaré.
                    </div>
                  );
                }
                return (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="w-10">#</TableHead>
                          <TableHead className="font-medium">Tâche critique</TableHead>
                          <TableHead className="font-medium">Processus</TableHead>
                          <TableHead className="font-medium">Contournement</TableHead>
                          <TableHead className="font-medium">Personnes clés</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allWorkarounds.map((wa, idx) => (
                          <TableRow key={wa.id || idx} className="hover:bg-indigo-50/30 transition-colors">
                            <TableCell className="text-center font-mono text-sm">{idx + 1}</TableCell>
                            <TableCell className="font-medium text-sm">{wa.task}</TableCell>
                            <TableCell className="text-sm text-gray-500">{wa.sourceProcess}</TableCell>
                            <TableCell className="text-sm text-gray-500">{wa.description}</TableCell>
                            <TableCell className="text-sm">
                              {wa.people && wa.people.map((p: string) => (
                                <div key={p}>{p}</div>
                              ))}
                              {!wa.people && <span className="text-gray-400">—</span>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                );
              })()}
            </div>
          </div>

          <Button variant="outline" className="w-full mt-4 border-dashed text-gray-400 hover:text-gray-600">
            <Plus className="h-4 w-4 mr-2" /> Ajouter un contournement
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ── Composant principal ───────────────────────────────────────────────────────
export const ProcessInventory = ({ onEdit, onCreate }: { onEdit: (id: string) => void; onCreate: () => void }) => {
  const { processes, deleteProcess } = useBia();
  const { entities } = useGovernance();
  const { can } = useRole();

  const [selectedRoot, setSelectedRoot] = useState<string | null>(null);
  const [selectedDirection, setSelectedDirection] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [viewLevel, setViewLevel] = useState<"enterprises" | "directions" | "departments" | "processes">("enterprises");
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCriticality, setSelectedCriticality] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  const [selectedProcess, setSelectedProcess] = useState<any>(null);
  const [selectedProcessDeptProcs, setSelectedProcessDeptProcs] = useState<any[]>([]);

  const [selectedService, setSelectedService] = useState<ServiceBIA | null>(null);
  const [showBIADetail, setShowBIADetail] = useState(false);

  const entityName = (id: string) => entities.find((e) => e.id === id)?.name ?? "—";
  const rootEntities = useMemo(() => entities.filter(e => e.parentId === null), [entities]);
  const getChildren = (parentId: string) => entities.filter(e => e.parentId === parentId);

  const getDepartmentCount = (entityId: string) => getChildren(entityId).length;

  const buildBIAServices = (entityId: string): ServiceBIA[] => {
    const directions = getChildren(entityId);
    const services: ServiceBIA[] = [];

    for (const dir of directions) {
      const depts = getChildren(dir.id);
      for (const dept of depts) {
        const deptProcesses = processes.filter(p => p.department === dept.name || p.entityId === dept.id);
        if (deptProcesses.length === 0) continue;

        const criticalCount = deptProcesses.filter(p => {
          const score = computeMaxScoreFromImpacts(p.impacts);
          return score >= 4;
        }).length;
        
        const appsIT = new Set<string>();
        const suppliers = new Set<string>();
        
        for (const p of deptProcesses) {
          const apps = (p as any).appsCritiques || [];
          for (const app of apps) appsIT.add(app.name);
          const resources = p.resources || [];
          for (const r of resources) {
            if (r.type === "Fournisseur") suppliers.add(r.name);
          }
        }

        const rate = calculateCompletionRate(deptProcesses);
        const status = getBIAStatus(deptProcesses, dept.lastUpdated);

        services.push({
          id: dept.id,
          name: dept.name,
          owner: deptProcesses[0]?.owner || "—",
          coordinator: "L. Benali",
          processCount: deptProcesses.length,
          criticalCount,
          appsIT: appsIT.size,
          suppliers: suppliers.size,
          completionRate: rate,
          status,
          lastReviewed: dept.lastUpdated,
          description: dept.description || "",
        });
      }
    }

    return services;
  };

  const getFilteredServices = (services: ServiceBIA[]): ServiceBIA[] => {
    let filtered = [...services];
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(q) ||
        s.owner.toLowerCase().includes(q) ||
        s.coordinator.toLowerCase().includes(q)
      );
    }

    if (selectedStatus !== "all") {
      filtered = filtered.filter(s => s.status === selectedStatus);
    }

    return filtered;
  };

  const getBIAStats = (services: ServiceBIA[]) => {
    const totalServices = services.length;
    const totalProcesses = services.reduce((acc, s) => acc + s.processCount, 0);
    const totalCritical = services.reduce((acc, s) => acc + s.criticalCount, 0);
    const completed = services.filter(s => s.completionRate === 100).length;
    const toComplete = services.filter(s => s.status === "a_completer").length;
    const toReview = services.filter(s => s.status === "a_reviser").length;

    return {
      totalServices,
      totalProcesses,
      totalCritical,
      completed,
      toComplete,
      toReview,
      scoped: 9,
    };
  };

  const getProcessesForDept = (deptId: string, deptName: string) => {
    let procs = processes.filter(p => p.department === deptName || p.entityId === deptId);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      procs = procs.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.department.toLowerCase().includes(q) ||
        p.owner.toLowerCase().includes(q) ||
        entityName(p.entityId).toLowerCase().includes(q)
      );
    }
    if (selectedCriticality !== "all") {
      procs = procs.filter(p => {
        const score = computeMaxScoreFromImpacts(p.impacts);
        return scoreToCriticality(score) === selectedCriticality;
      });
    }
    return procs;
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Supprimer le processus "${name}" ?`)) {
      deleteProcess(id);
      toast({ title: "Processus supprimé", description: name });
    }
  };

  const openProcessModal = (proc: any) => {
    const deptProcs = processes.filter(p => p.department === proc.department || p.entityId === proc.entityId);
    setSelectedProcessDeptProcs(deptProcs);
    setSelectedProcess(proc);
  };

  const getProcessCount = (entityId: string) => {
    let count = 0;
    for (const dept of getChildren(entityId)) {
      count += processes.filter(p => p.department === dept.name || p.entityId === dept.id).length;
    }
    count += processes.filter(p => p.entityId === entityId).length;
    return count;
  };

  const getCritCount = (entityId: string) => {
    let count = 0;
    for (const dept of getChildren(entityId)) {
      count += processes.filter(p => 
        (p.department === dept.name || p.entityId === dept.id) && 
        computeMaxScoreFromImpacts(p.impacts) >= 4
      ).length;
    }
    count += processes.filter(p => p.entityId === entityId && computeMaxScoreFromImpacts(p.impacts) >= 4).length;
    return count;
  };

  const goToRoot = () => {
    setViewLevel("enterprises");
    setSelectedRoot(null);
    setSelectedDirection(null);
    setSelectedDepartment(null);
    setSearchQuery("");
    setSelectedCriticality("all");
    setSelectedStatus("all");
    setShowBIADetail(false);
    setSelectedService(null);
  };

  const selectRoot = (id: string) => {
    setSelectedRoot(id);
    setViewLevel("directions");
    setSelectedDirection(null);
    setSelectedDepartment(null);
    setShowBIADetail(false);
    setSelectedService(null);
  };

  const selectDirection = (id: string) => {
    setSelectedDirection(id);
    setViewLevel("departments");
    setSelectedDepartment(null);
    setShowBIADetail(false);
    setSelectedService(null);
  };

  const selectDepartment = (id: string) => {
    setSelectedDepartment(id);
    setViewLevel("processes");
    setShowBIADetail(false);
    setSelectedService(null);
  };

  const handleServiceClick = (service: ServiceBIA) => {
    setSelectedService(service);
    setShowBIADetail(true);
  };

  if (viewLevel === "directions" && selectedRoot && !showBIADetail) {
    const services = buildBIAServices(selectedRoot);
    const filteredServices = getFilteredServices(services);
    const stats = getBIAStats(services);

    const directions = getChildren(selectedRoot);
    const servicesByDirection: Record<string, ServiceBIA[]> = {};
    for (const dir of directions) {
      const depts = getChildren(dir.id);
      const dirServices = services.filter(s => depts.some(d => d.id === s.id));
      if (dirServices.length > 0) {
        servicesByDirection[dir.name] = dirServices;
      }
    }

    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
              <Building2 className="h-7 w-7 text-primary" /> Processus & BIA
            </h1>
            <p className="text-muted-foreground mt-1">
              Sélectionnez un service pour ouvrir sa fiche d'analyse d'impact. Chaque fiche recense les processus critiques, leurs ressources et leurs objectifs de reprise.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={goToRoot} className="gap-1">
              <ArrowLeft className="h-4 w-4" /> Retour
            </Button>
            <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700">
              <Plus className="h-4 w-4" /> Nouvelle fiche BIA
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-gray-50/80 border-gray-200">
            <CardContent className="p-4">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Fiches BIA</p>
              <p className="text-2xl font-bold">{stats.totalServices}</p>
              <p className="text-xs text-gray-400">sur {stats.scoped} services scopés</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-50/80 border-gray-200">
            <CardContent className="p-4">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Processus critiques</p>
              <p className="text-2xl font-bold text-red-600">{stats.totalCritical}</p>
              <p className="text-xs text-gray-400">sur {stats.totalProcesses} processus</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-50/80 border-gray-200">
            <CardContent className="p-4">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Fiches complètes</p>
              <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
              <p className="text-xs text-gray-400">{stats.toComplete} à compléter</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-50/80 border-gray-200">
            <CardContent className="p-4">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">À réviser</p>
              <p className="text-2xl font-bold text-amber-600">{stats.toReview}</p>
              <p className="text-xs text-gray-400">cycle de 2 ans dépassé</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Rechercher un service, un responsable..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              className="pl-9" 
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <Button 
              variant={selectedStatus === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedStatus("all")}
              className={selectedStatus === "all" ? "bg-indigo-600 hover:bg-indigo-700" : ""}
            >
              Tous
            </Button>
            <Button 
              variant={selectedStatus === "critique" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedStatus("critique")}
              className={selectedStatus === "critique" ? "bg-indigo-600 hover:bg-indigo-700" : ""}
            >
              Critiques
            </Button>
            <Button 
              variant={selectedStatus === "a_completer" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedStatus("a_completer")}
              className={selectedStatus === "a_completer" ? "bg-indigo-600 hover:bg-indigo-700" : ""}
            >
              À compléter
            </Button>
            <Button 
              variant={selectedStatus === "a_reviser" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedStatus("a_reviser")}
              className={selectedStatus === "a_reviser" ? "bg-indigo-600 hover:bg-indigo-700" : ""}
            >
              À réviser
            </Button>
          </div>
        </div>

        {Object.keys(servicesByDirection).length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Building className="h-12 w-12 mx-auto text-gray-300" />
            <p className="mt-4">Aucun service trouvé dans cette entreprise.</p>
          </div>
        ) : (
          <div>
            {Object.entries(servicesByDirection).map(([dirName, dirServices]) => (
              <DirectionSection
                key={dirName}
                name={dirName}
                icon={<Building className="h-4 w-4" />}
                services={dirServices}
                onServiceClick={handleServiceClick}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (showBIADetail && selectedService) {
    const deptProcesses = processes.filter(p => p.entityId === selectedService.id || p.department === selectedService.name);
    
    return (
      <BIAFicheDetail
        service={selectedService}
        processes={deptProcesses}
        onBack={() => setShowBIADetail(false)}
        onEdit={onEdit}
        onDelete={handleDelete}
        canDelete={can("admin")}
        entities={entities}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-7 w-7 text-primary" /> Inventaire des processus
          </h1>
          <p className="text-muted-foreground mt-1">
            {viewLevel === "enterprises" && "Sélectionnez une entreprise pour voir ses directions"}
            {viewLevel === "directions" && "Sélectionnez une direction pour voir ses départements"}
            {viewLevel === "departments" && "Sélectionnez un département pour voir ses processus"}
            {viewLevel === "processes" && `Processus de "${entities.find(e => e.id === selectedDepartment)?.name || ""}"`}
          </p>
        </div>
        <div className="flex gap-2">
          {viewLevel !== "enterprises" && (
            <Button variant="outline" onClick={goToRoot} className="gap-1">
              <ArrowLeft className="h-4 w-4" /> Retour
            </Button>
          )}
          {can("write") && viewLevel === "processes" && (
            <Button onClick={onCreate} className="gap-2">
              <Plus className="h-4 w-4" /> Nouveau processus
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-6">
        <Card className="bg-gray-100/60 border-gray-200/50 shadow-sm"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Total</p><p className="text-xl font-bold">{processes.length}</p></CardContent></Card>
        <Card className="bg-gray-100/60 border-gray-200/50 shadow-sm"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Critiques</p><p className="text-xl font-bold text-red-600">{processes.filter(p => computeMaxScoreFromImpacts(p.impacts) >= 4).length}</p></CardContent></Card>
        <Card className="bg-gray-100/60 border-gray-200/50 shadow-sm"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Majeurs</p><p className="text-xl font-bold text-orange-600">{processes.filter(p => computeMaxScoreFromImpacts(p.impacts) >= 3 && computeMaxScoreFromImpacts(p.impacts) < 4).length}</p></CardContent></Card>
        <Card className="bg-gray-100/60 border-gray-200/50 shadow-sm"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Modérés</p><p className="text-xl font-bold text-yellow-600">{processes.filter(p => computeMaxScoreFromImpacts(p.impacts) >= 2 && computeMaxScoreFromImpacts(p.impacts) < 3).length}</p></CardContent></Card>
        <Card className="bg-gray-100/60 border-gray-200/50 shadow-sm"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Mineurs</p><p className="text-xl font-bold text-green-600">{processes.filter(p => computeMaxScoreFromImpacts(p.impacts) < 2).length}</p></CardContent></Card>
        <Card className="bg-gray-100/60 border-gray-200/50 shadow-sm"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Score moyen</p><p className="text-xl font-bold">{processes.length ? (processes.reduce((acc, p) => acc + computeMaxScoreFromImpacts(p.impacts), 0) / processes.length).toFixed(1) : "0"}/5</p></CardContent></Card>
      </div>

      <Card className="border-gray-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.05)]">
        <CardContent className="p-6">
          {viewLevel === "enterprises" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">🏢 Entreprises</h2>
                <span className="text-sm text-muted-foreground">{rootEntities.length} entreprise(s)</span>
              </div>
              {rootEntities.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto text-muted-foreground/30" />
                  <p className="mt-4">Aucune entreprise trouvée.</p>
                  <p className="text-sm">Créez une entité racine dans Gouvernance M1.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {rootEntities.map(root => {
                    const services = buildBIAServices(root.id);
                    const totalProcesses = services.reduce((acc, s) => acc + s.processCount, 0);
                    const totalCritical = services.reduce((acc, s) => acc + s.criticalCount, 0);
                    
                    return (
                      <div
                        key={root.id}
                        className="bg-gradient-to-br from-[#e8ecf1] to-[#d5dbe3] hover:from-[#eef1f6] hover:to-[#dce1ea] rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:shadow-[0_16px_40px_rgb(0,0,0,0.10)] transition-all duration-300 cursor-pointer transform hover:scale-[1.02] hover:-translate-y-1 p-6 text-[#1e293b] flex flex-col items-center justify-center min-h-[140px] border border-white/40 backdrop-blur-sm"
                        onClick={() => selectRoot(root.id)}
                      >
                        <div className="mb-2 text-[#475569]">
                          <Building2 className="h-8 w-8" />
                        </div>
                        <h3 className="text-lg font-bold text-center text-[#0f172a]">{root.name}</h3>
                        <p className="text-xs text-[#64748b] mt-1">Entreprise</p>
                        <div className="flex flex-wrap gap-2 mt-3 justify-center">
                          <span className="bg-white/60 px-3 py-0.5 rounded-full text-xs font-medium text-[#334155] shadow-sm border border-white/40">
                            {getDepartmentCount(root.id)} direction(s)
                          </span>
                          <span className="bg-white/60 px-3 py-0.5 rounded-full text-xs font-medium text-[#334155] shadow-sm border border-white/40">
                            {totalProcesses} processus
                          </span>
                          {totalCritical > 0 && (
                            <span className="bg-red-200/60 px-3 py-0.5 rounded-full text-xs font-medium text-red-700 shadow-sm border border-red-200/40">
                              ⚠️ {totalCritical} critique(s)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {viewLevel === "directions" && selectedRoot && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">📊 Directions de {entityName(selectedRoot)}</h2>
                  <Badge variant="outline">{getChildren(selectedRoot).length} direction(s)</Badge>
                </div>
                <Button variant="ghost" size="sm" onClick={() => {
                  setViewLevel("directions");
                  setShowBIADetail(false);
                }}>
                  Voir en mode BIA
                </Button>
              </div>
              {getChildren(selectedRoot).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Building className="h-12 w-12 mx-auto text-muted-foreground/30" />
                  <p className="mt-4">Aucune direction trouvée.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {getChildren(selectedRoot).map(dir => {
                    const services = buildBIAServices(selectedRoot);
                    const dirServices = services.filter(s => {
                      const depts = getChildren(dir.id);
                      return depts.some(d => d.id === s.id);
                    });
                    const totalProcesses = dirServices.reduce((acc, s) => acc + s.processCount, 0);
                    const totalCritical = dirServices.reduce((acc, s) => acc + s.criticalCount, 0);
                    
                    return (
                      <div
                        key={dir.id}
                        className="bg-gradient-to-br from-[#e2e7ef] to-[#d0d7e2] hover:from-[#e8ecf4] hover:to-[#d6dde8] rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:shadow-[0_16px_40px_rgb(0,0,0,0.10)] transition-all duration-300 cursor-pointer transform hover:scale-[1.02] hover:-translate-y-1 p-6 text-[#1e293b] flex flex-col items-center justify-center min-h-[140px] border border-white/40 backdrop-blur-sm"
                        onClick={() => selectDirection(dir.id)}
                      >
                        <div className="mb-2 text-[#475569]">
                          <Building className="h-8 w-8" />
                        </div>
                        <h3 className="text-lg font-bold text-center text-[#0f172a]">{dir.name}</h3>
                        <p className="text-xs text-[#64748b] mt-1">Direction</p>
                        <div className="flex flex-wrap gap-2 mt-3 justify-center">
                          <span className="bg-white/60 px-3 py-0.5 rounded-full text-xs font-medium text-[#334155] shadow-sm border border-white/40">
                            {getDepartmentCount(dir.id)} département(s)
                          </span>
                          <span className="bg-white/60 px-3 py-0.5 rounded-full text-xs font-medium text-[#334155] shadow-sm border border-white/40">
                            {totalProcesses} processus
                          </span>
                          {totalCritical > 0 && (
                            <span className="bg-red-200/60 px-3 py-0.5 rounded-full text-xs font-medium text-red-700 shadow-sm border border-red-200/40">
                              ⚠️ {totalCritical} critique(s)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {viewLevel === "departments" && selectedDirection && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">📋 Départements de {entityName(selectedDirection)}</h2>
                  <Badge variant="outline">{getChildren(selectedDirection).length} département(s)</Badge>
                </div>
              </div>
              {getChildren(selectedDirection).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Layers className="h-12 w-12 mx-auto text-muted-foreground/30" />
                  <p className="mt-4">Aucun département trouvé.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {getChildren(selectedDirection).map(dept => {
                    const deptResources = getDepartmentResources(processes, dept.id, dept.name);
                    const procs = getProcessesForDept(dept.id, dept.name);
                    return (
                      <div
                        key={dept.id}
                        className="bg-gradient-to-br from-[#dce2ec] to-[#c9d1dd] hover:from-[#e2e8f2] hover:to-[#cfd7e3] rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:shadow-[0_16px_40px_rgb(0,0,0,0.10)] transition-all duration-300 cursor-pointer transform hover:scale-[1.02] hover:-translate-y-1 p-6 text-[#1e293b] flex flex-col border border-white/40 backdrop-blur-sm"
                        onClick={() => selectDepartment(dept.id)}
                      >
                        <div className="mb-2 text-[#475569]">
                          <Layers className="h-8 w-8" />
                        </div>
                        <h3 className="text-lg font-bold text-[#0f172a]">{dept.name}</h3>
                        <p className="text-xs text-[#64748b] mt-1">Département</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <span className="bg-white/60 px-3 py-0.5 rounded-full text-xs font-medium text-[#334155] shadow-sm border border-white/40">
                            {procs.length} processus
                          </span>
                          {procs.filter(p => computeMaxScoreFromImpacts(p.impacts) >= 4).length > 0 && (
                            <span className="bg-red-200/60 px-3 py-0.5 rounded-full text-xs font-medium text-red-700 shadow-sm border border-red-200/40">
                              ⚠️ {procs.filter(p => computeMaxScoreFromImpacts(p.impacts) >= 4).length}
                            </span>
                          )}
                        </div>
                        <div className="mt-3 text-xs text-[#475569] space-y-0.5">
                          {deptResources.hr.length > 0 && (
                            <div className="bg-white/30 px-2 py-0.5 rounded-full inline-block">👥 {deptResources.hr.map(h => h.name).join(", ")}</div>
                          )}
                          {deptResources.equipment.length > 0 && (
                            <div className="bg-white/30 px-2 py-0.5 rounded-full inline-block ml-1">🖥️ {deptResources.equipment.map(e => e.name).join(", ")}</div>
                          )}
                          {deptResources.suppliers.length > 0 && (
                            <div className="bg-white/30 px-2 py-0.5 rounded-full inline-block ml-1">🤝 {deptResources.suppliers.map(s => s.name).join(", ")}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {viewLevel === "processes" && selectedDepartment && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => {
                  setViewLevel("departments");
                  setSelectedDepartment(null);
                }} className="gap-1">
                  <ArrowLeft className="h-4 w-4" />
                  Retour
                </Button>
                <h2 className="text-xl font-bold">{entities.find(e => e.id === selectedDepartment)?.name || "Département"}</h2>
                <Badge variant="outline">{getProcessesForDept(selectedDepartment, entities.find(e => e.id === selectedDepartment)?.name || "").length} processus</Badge>
              </div>

              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Rechercher un processus..." 
                    value={searchQuery} 
                    onChange={e => setSearchQuery(e.target.value)} 
                    className="pl-9" 
                  />
                </div>
                <select 
                  value={selectedCriticality} 
                  onChange={e => setSelectedCriticality(e.target.value)} 
                  className="h-10 px-3 rounded-md border bg-background text-sm"
                >
                  <option value="all">Toutes les criticités</option>
                  <option value="Critique">Critique</option>
                  <option value="Majeur">Majeur</option>
                  <option value="Modéré">Modéré</option>
                  <option value="Mineur">Mineur</option>
                </select>
              </div>

              {getProcessesForDept(selectedDepartment, entities.find(e => e.id === selectedDepartment)?.name || "").length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>Aucun processus dans ce département.</p>
                </div>
              ) : (
                <div className="border rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/10">
                          <TableHead>Processus</TableHead>
                          <TableHead>Responsable</TableHead>
                          <TableHead className="text-center">RTO</TableHead>
                          <TableHead className="text-center">RPO</TableHead>
                          <TableHead>Criticité</TableHead>
                          <TableHead>Apps IT</TableHead>
                          <TableHead>Prestataires</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getProcessesForDept(selectedDepartment, entities.find(e => e.id === selectedDepartment)?.name || "").map(p => {
                          const score = computeMaxScoreFromImpacts(p.impacts);
                          const crit = scoreToCriticality(score);
                          const apps = (p as any).appsCritiques || [];
                          const prestataires = (p.resources || []).filter((r: any) => r.type === "Fournisseur");
                          return (
                            <TableRow
                              key={p.id}
                              className="cursor-pointer hover:bg-indigo-50/30 transition-colors"
                              onClick={() => openProcessModal(p)}
                            >
                              <TableCell className="font-medium text-indigo-600 hover:underline">{p.name}</TableCell>
                              <TableCell className="text-sm">{p.owner}</TableCell>
                              <TableCell className="text-center"><Badge className="bg-red-50 text-red-700 border-red-200 text-xs">{p.rto}h</Badge></TableCell>
                              <TableCell className="text-center"><Badge className="bg-orange-50 text-orange-700 border-orange-200 text-xs">{p.rpo}h</Badge></TableCell>
                              <TableCell><Badge className={criticalityColor(crit)}>{crit}</Badge></TableCell>
                              <TableCell>
                                {apps.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {apps.slice(0, 2).map((app: any) => (
                                      <Badge key={app.id} className="bg-purple-50 text-purple-700 border-purple-200 text-xs gap-1">
                                        <Server className="h-3 w-3" /> {app.name}
                                      </Badge>
                                    ))}
                                    {apps.length > 2 && <Badge variant="outline" className="text-xs">+{apps.length - 2}</Badge>}
                                  </div>
                                ) : <span className="text-muted-foreground text-xs">—</span>}
                              </TableCell>
                              <TableCell>
                                {prestataires.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {prestataires.slice(0, 2).map((p: any) => (
                                      <Badge key={p.id} className="bg-orange-50 text-orange-700 border-orange-200 text-xs gap-1">
                                        <Truck className="h-3 w-3" /> {p.name}
                                      </Badge>
                                    ))}
                                    {prestataires.length > 2 && <Badge variant="outline" className="text-xs">+{prestataires.length - 2}</Badge>}
                                  </div>
                                ) : <span className="text-muted-foreground text-xs">—</span>}
                              </TableCell>
                              <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                                <div className="flex justify-end gap-1">
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(p.id)}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  {can("admin") && (
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(p.id, p.name)}>
                                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedProcess && (
        <Dialog open onOpenChange={() => setSelectedProcess(null)}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                {selectedProcess.name}
                <Badge className={criticalityColor(scoreToCriticality(computeMaxScoreFromImpacts(selectedProcess.impacts)))}>
                  {scoreToCriticality(computeMaxScoreFromImpacts(selectedProcess.impacts))}
                </Badge>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Responsable</p>
                  <p className="font-medium">{selectedProcess.owner || "—"}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Dernière MAJ</p>
                  <p className="font-medium">{selectedProcess.lastUpdated || "—"}</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" /> Objectifs de continuité
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "RTO", value: selectedProcess.rto, unit: "h", color: "bg-red-50 border-red-200 text-red-700" },
                    { label: "RPO", value: selectedProcess.rpo, unit: "h", color: "bg-orange-50 border-orange-200 text-orange-700" },
                    { label: "MTPD", value: selectedProcess.mtpd, unit: "h", color: "bg-blue-50 border-blue-200 text-blue-700" },
                  ].map(({ label, value, unit, color }) => (
                    <div key={label} className={`rounded-xl border p-3 text-center ${color}`}>
                      <p className="text-xs font-semibold opacity-70">{label}</p>
                      <p className="text-2xl font-bold">{value}<span className="text-sm">{unit}</span></p>
                    </div>
                  ))}
                </div>
              </div>

              {selectedProcess.description && (
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1 font-semibold">Description</p>
                  <p className="text-sm">{selectedProcess.description}</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};