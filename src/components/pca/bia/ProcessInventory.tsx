import { useMemo, useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, Pencil, Trash2, Search, 
  ChevronDown, ChevronRight, Download, ArrowLeft,
  Building2, Server, Clock, Shield, Users, Package, Handshake, Building, Layers,
  User, Monitor, Truck, CheckCircle, AlertCircle, AlertTriangle, FileText,
  Calendar, ChevronRight as ChevronRightIcon, X, Edit, Save, Eye, EyeOff,
  Activity, Briefcase, Wrench, Link, HelpCircle,
  GitBranch, TrendingUp, Database, AlertTriangle as AlertTriangleIcon,
  ShieldAlert, Edit3, Link as LinkIcon, Unlink, ListChecks, Network,
  RefreshCw, MoreHorizontal, MoreVertical, Filter, 
  Link2, Eye as EyeIcon, Edit as EditIcon, Trash as TrashIcon,
  CalendarDays, Phone, Mail, UserCircle, ChevronLeft, ChevronRight as ChevronRightIcon2,
  Cpu, Cloud, Wifi, Zap, HardDrive, Layers as LayersIcon,
  ExternalLink, FolderOpen, GripVertical, Grid2X2, List, 
  BarChart3, TrendingUp as TrendingUpIcon, AlertOctagon, Check, Minus,
  Circle, CircleCheck, CircleDot, CircleDashed, CircleOff,
  Square, SquareCheck, SquareDot, SquareDashed, PlusCircle, FolderTree,
  MoreHorizontal as MoreHoriz, Loader2
} from "lucide-react";
import { useBia } from "@/contexts/BiaContext";
import { useGovernance } from "@/contexts/GovernanceContext";
import { useRole } from "@/contexts/RoleContext";
import { computeMaxScore, scoreToCriticality, criticalityColor, TimePeriod, type Criticality } from "@/data/bia";
type ImpactAxis = "Financier" | "Conformité / Légal" | "Opérationnel" | "Réputationnel";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/db";
import { BiaWizard } from "./BiaWizard";
import { TableauDeMonteeEnCharge } from "./TableauDeMonteeEnCharge";
import ContournementsDeCriseIA from './ContournementsDeCriseIA';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const AVAILABILITY_PERIODS = [
  { id: "P0_4H", label: "0-4h", short: "0-4", color: "bg-emerald-100" },
  { id: "P4_8H", label: "4-8h", short: "4-8", color: "bg-teal-100" },
  { id: "P1D",  label: "1j", short: "1j", color: "bg-cyan-100" },
  { id: "P2D",  label: "2j", short: "2j", color: "bg-sky-100" },
  { id: "P1W",  label: "1sem", short: "1s", color: "bg-blue-100" },
  { id: "P2W",  label: "2sem", short: "2s", color: "bg-indigo-100" },
  { id: "P1M",  label: "1mois", short: "1m", color: "bg-violet-100" },
];

type BIAStatus = "critique" | "a_completer" | "a_reviser" | "complet" | "non_demarre";

interface ServiceBIA {
  id: string;
  name: string;
  owner: string;
  coordinator: string;
  processCount: number;
  criticalCount: number;
  resources: number;
  completionRate: number;
  status: BIAStatus;
  lastReviewed?: string;
  description?: string;
}

const IMPACT_AXES: ImpactAxis[] = ["Financier", "Conformité / Légal", "Opérationnel", "Réputationnel"];
const TIME_PERIODS: TimePeriod[] = ["P0_4H", "P4_8H", "P1D", "P2D", "P1W"];

const AXIS_SAVE: Record<ImpactAxis, string> = {
  "Financier": "financial",
  "Conformité / Légal": "regulatory",
  "Opérationnel": "operational",
  "Réputationnel": "reputation",
};

const SEVERITY_LEVELS = [
  { value: "Mineur", bg: "bg-green-100", text: "text-green-800", border: "border-green-300", dotColor: "#22c55e", icon: <CircleCheck className="h-4 w-4 text-green-600" /> },
  { value: "Modéré", bg: "bg-yellow-100", text: "text-yellow-800", border: "border-yellow-300", dotColor: "#eab308", icon: <CircleDot className="h-4 w-4 text-yellow-600" /> },
  { value: "Majeur", bg: "bg-orange-100", text: "text-orange-800", border: "border-orange-300", dotColor: "#f97316", icon: <Circle className="h-4 w-4 text-orange-600" /> },
  { value: "Sévère", bg: "bg-red-100", text: "text-red-800", border: "border-red-300", dotColor: "#ef4444", icon: <AlertTriangleIcon className="h-4 w-4 text-red-600" /> },
  { value: "Très sévère", bg: "bg-red-200", text: "text-red-900", border: "border-red-400", dotColor: "#dc2626", icon: <AlertOctagon className="h-4 w-4 text-red-700" /> },
];

const SEVERITY_FROM_NUMBER: Record<number, string> = {
  0: "",
  1: "Mineur",
  2: "Modéré",
  3: "Majeur",
  4: "Sévère",
  5: "Très sévère",
};

const generateProcessCode = (department: string, index: number): string => {
  const prefix = department.substring(0, 2).toUpperCase() || "DE";
  return `${prefix}_${String(index + 1).padStart(6, '0')}`;
};

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

const getBIAStatus = (processes: any[], lastReviewed?: string): BIAStatus => {
  if (processes.length === 0) return "non_demarre";
  
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

// ============================================================
// COMPOSANT - Dialogue de sélection de processus pour liaison AVEC RTO/RPO (CORRIGÉ)
// ============================================================
const LinkProcessDialog = ({
  open,
  onOpenChange,
  resourceType,
  resourceId,
  resourceName,
  onLink,
  onUnlink,
  linkedProcesses: initialLinkedProcesses,
  departmentProcesses,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceType: string;
  resourceId: string;
  resourceName: string;
  onLink: (processId: string, rtoHours?: number, rpoHours?: number) => void;
  onUnlink: (processId: string) => void;
  linkedProcesses?: any[];
  departmentProcesses?: any[];
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);

  // États pour RTO/RPO dans le dialogue de liaison
  const [linkRtoHours, setLinkRtoHours] = useState<number>(4);
  const [linkRpoHours, setLinkRpoHours] = useState<number>(2);

  const rtoOptions = [1, 2, 4, 6, 8, 12, 24, 48, 72];
  const rpoOptions = [0.5, 1, 2, 4, 6, 8, 12, 24];

  // Déterminer si on doit afficher les champs RTO/RPO
  const showRtoField = resourceType === 'Equipement' || resourceType === 'App' || resourceType === 'Fournisseur';
  const showRpoField = resourceType === 'App';
  const showNoRtoField = resourceType === 'HR';

  // Réinitialiser la sélection quand on ouvre
  useEffect(() => {
    if (open) {
      setSelectedProcessId(null);
      setSearchQuery("");
      setLinkRtoHours(4);
      setLinkRpoHours(2);
    }
  }, [open]);

  // 🔥 CORRECTION : On utilise directement les props passées, plus besoin de les mettre dans des states locaux !
  const linkedProcesses = initialLinkedProcesses || [];
  const allProcesses = departmentProcesses || [];

  // Filtrer les processus disponibles pour la liaison (ceux qui ne sont PAS déjà liés)
  const filteredProcesses = allProcesses.filter(p => {
    const isLinked = linkedProcesses.some(lp => lp.id === p.id);
    if (isLinked) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return p.name?.toLowerCase().includes(q) || p.owner?.toLowerCase().includes(q);
    }
    return true;
  });

  const handleLink = async () => {
    if (selectedProcessId) {
      setIsLinking(true);
      await onLink(selectedProcessId, linkRtoHours, linkRpoHours);
      setSelectedProcessId(null);
      setLinkRtoHours(4);
      setLinkRpoHours(2);
      setIsLinking(false);
    }
  };

  const handleUnlink = async (processId: string) => {
    if (confirm(`Voulez-vous dissocier cette ressource du processus ?`)) {
      await onUnlink(processId);
    }
  };

  const getResourceIcon = () => {
    switch(resourceType) {
      case 'HR': return <Users className="h-5 w-5 text-blue-600" />;
      case 'Equipement': return <Monitor className="h-5 w-5 text-yellow-600" />;
      case 'App': return <Server className="h-5 w-5 text-purple-600" />;
      case 'Fournisseur': return <Handshake className="h-5 w-5 text-orange-600" />;
      default: return <LinkIcon className="h-5 w-5 text-gray-600" />;
    }
  };

  const getResourceLabel = () => {
    switch(resourceType) {
      case 'HR': return 'collaborateur';
      case 'Equipement': return 'équipement';
      case 'App': return 'application';
      case 'Fournisseur': return 'prestataire';
      default: return 'ressource';
    }
  };

  const getResourceColor = () => {
    switch(resourceType) {
      case 'HR': return 'bg-blue-50 border-blue-200';
      case 'Equipement': return 'bg-amber-50 border-amber-200';
      case 'App': return 'bg-purple-50 border-purple-200';
      case 'Fournisseur': return 'bg-orange-50 border-orange-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#172030] text-xl">
            {getResourceIcon()}
            Gérer les processus liés à "{resourceName}"
          </DialogTitle>
          <DialogDescription className="text-[#172030]/60">
            Associez ou dissociez ce {getResourceLabel()} à des processus du département
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Section des processus déjà liés */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-[#172030] flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-[#2A5141]" />
                Processus liés ({linkedProcesses.length})
              </h4>
              {linkedProcesses.length > 0 && !showNoRtoField && (
                <span className="text-xs text-[#172030]/40">
                  RTO/RPO spécifiques à chaque liaison
                </span>
              )}
              {linkedProcesses.length > 0 && showNoRtoField && (
                <span className="text-xs text-[#172030]/40">
                  Liaisons sans RTO/RPO
                </span>
              )}
            </div>
            {linkedProcesses.length === 0 ? (
              <p className="text-sm text-[#172030]/40 italic p-4 text-center bg-[#F8F6F2] rounded-lg border border-dashed border-[#E8E4DC]">
                Aucun processus lié pour le moment
              </p>
            ) : (
              <div className="space-y-2">
                {linkedProcesses.map(p => (
                  <div 
                    key={p.id} 
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border transition-all",
                      getResourceColor()
                    )}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-[#2A5141]/10 flex items-center justify-center flex-shrink-0">
                        <Building2 className="h-4 w-4 text-[#2A5141]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-[#172030]">{p.name}</span>
                          <Badge variant="outline" className="text-[10px] bg-white">
                            {p.owner || "—"}
                          </Badge>
                        </div>
                        {!showNoRtoField && (
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            {/* Affichage RTO si disponible */}
                            {p._linkRto !== undefined && showRtoField && (
                              <span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                                <Clock className="h-3 w-3" />
                                RTO {p._linkRto}h
                              </span>
                            )}
                            {/* Affichage RPO si disponible */}
                            {p._linkRpo !== undefined && showRpoField && (
                              <span className="inline-flex items-center gap-1 text-[10px] bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full border border-orange-200">
                                <Database className="h-3 w-3" />
                                RPO {p._linkRpo}h
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full flex-shrink-0"
                      onClick={() => handleUnlink(p.id)}
                      title="Dissocier"
                    >
                      <Unlink className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-[#E8E4DC] pt-4">
            <h4 className="text-sm font-medium text-[#172030] mb-3 flex items-center gap-2">
              <Plus className="h-4 w-4 text-[#2A5141]" />
              Associer à un autre processus
            </h4>

            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher un processus..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 border-[#E8E4DC]"
              />
            </div>

            {/* Sélecteur de RTO/RPO avant la sélection du processus (sauf pour RH) */}
            {!showNoRtoField && (
              <div className="mb-3 p-3 bg-[#F8F6F2] rounded-lg border border-[#E8E4DC]">
                <Label className="text-sm font-medium text-[#172030] flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#2A5141]" />
                  Objectifs de reprise pour cette liaison
                </Label>
                <div className={cn("grid gap-3 mt-2", showRpoField ? "grid-cols-2" : "grid-cols-1")}>
                  <div>
                    <Label className="text-xs text-slate-500">RTO (heures)</Label>
                    <select
                      value={linkRtoHours}
                      onChange={(e) => setLinkRtoHours(Number(e.target.value))}
                      className="w-full mt-1 px-3 py-2 border rounded-lg bg-white text-sm focus:ring-2 focus:ring-[#2A5141] focus:border-[#2A5141]"
                    >
                      {rtoOptions.map((val) => (
                        <option key={val} value={val}>{val}h</option>
                      ))}
                    </select>
                  </div>
                  {showRpoField && (
                    <div>
                      <Label className="text-xs text-slate-500">RPO (heures)</Label>
                      <select
                        value={linkRpoHours}
                        onChange={(e) => setLinkRpoHours(Number(e.target.value))}
                        className="w-full mt-1 px-3 py-2 border rounded-lg bg-white text-sm focus:ring-2 focus:ring-[#2A5141] focus:border-[#2A5141]"
                      >
                        {rpoOptions.map((val) => (
                          <option key={val} value={val}>{val}h</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {showRpoField 
                    ? "Ces valeurs seront appliquées à la liaison de cette application avec le processus sélectionné."
                    : "Cette valeur sera appliquée à la liaison de cette ressource avec le processus sélectionné."
                  }
                </p>
              </div>
            )}

            {showNoRtoField && (
              <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-700 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Les collaborateurs n'ont pas de RTO/RPO spécifique
                </p>
              </div>
            )}

            {/* 🔥 CORRECTION ICI : On affiche directement filteredProcesses, plus besoin de isLoading */}
            <div className="max-h-48 overflow-y-auto border rounded-lg divide-y divide-[#E8E4DC]">
              {filteredProcesses.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-400">
                  {searchQuery ? "Aucun processus trouvé" : "Tous les processus sont déjà liés"}
                </div>
              ) : (
                filteredProcesses.map((p) => (
                  <div
                    key={p.id}
                    className={cn(
                      "flex items-center justify-between p-3 cursor-pointer hover:bg-[#F8F6F2] transition-colors",
                      selectedProcessId === p.id && "bg-[#F0F5F0] border-l-4 border-l-[#2A5141]"
                    )}
                    onClick={() => setSelectedProcessId(p.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Building2 className="h-4 w-4 text-gray-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#172030] truncate">{p.name}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {p.owner || "—"} • {p.department || "Sans département"}
                        </p>
                      </div>
                    </div>
                    {selectedProcessId === p.id && (
                      <Badge className="bg-[#2A5141] text-white text-[10px] flex-shrink-0">
                        Sélectionné
                      </Badge>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
          <Button
            onClick={handleLink}
            disabled={!selectedProcessId || isLinking}
            className="bg-[#2A5141] hover:bg-[#1a3329] text-white"
          >
            {isLinking ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Liaison en cours...
              </>
            ) : (
              <>
                <LinkIcon className="h-4 w-4 mr-1" />
                Associer ce processus
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================
// COMPOSANT - Dialogue de sélection depuis le référentiel
// ============================================================
const SelectFromCMDBDialog = ({
  open,
  onOpenChange,
  resourceType,
  allResources,
  addedResourceIds,
  onSelect,
  onAddToCMDB,
  title,
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceType: string;
  allResources: any[];
  addedResourceIds: string[];
  onSelect: (resourceId: string[]) => void;
  onAddToCMDB: () => void;
  title: string;
  description: string;
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const availableResources = allResources.filter(r => !addedResourceIds.includes(r.id));

  const filteredResources = availableResources.filter(r =>
    r.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.role?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.service?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (open) {
      setSelectedIds([]);
    }
  }, [open]);

  const getResourceIcon = () => {
    switch(resourceType) {
      case 'HR': return <Users className="h-5 w-5 text-blue-600" />;
      case 'Equipement': return <Monitor className="h-5 w-5 text-yellow-600" />;
      case 'App': return <Server className="h-5 w-5 text-purple-600" />;
      case 'Fournisseur': return <Handshake className="h-5 w-5 text-orange-600" />;
      default: return <LinkIcon className="h-5 w-5 text-gray-600" />;
    }
  };

  const getResourceLabel = () => {
    switch(resourceType) {
      case 'HR': return 'collaborateur';
      case 'Equipement': return 'équipement';
      case 'App': return 'application';
      case 'Fournisseur': return 'prestataire';
      default: return 'ressource';
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredResources.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredResources.map(r => r.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelect = () => {
    if (selectedIds.length === 0) {
      toast({ title: "Erreur", description: "Veuillez sélectionner au moins une ressource", variant: "destructive" });
      return;
    }
    onSelect(selectedIds);
    setSelectedIds([]);
    setSearchQuery("");
    onOpenChange(false);
  };

  const getResourceDetails = (r: any) => {
    switch(resourceType) {
      case 'HR': return r.role || "—";
      case 'Equipement': return r.type || "—";
      case 'App': return r.service || r.type || "—";
      case 'Fournisseur': return r.service || "—";
      default: return "—";
    }
  };

  const getResourceExtra = (r: any) => {
    switch(resourceType) {
      case 'HR': return r.email || "—";
      case 'Equipement': return `Qté: ${r.quantity || 1}`;
      case 'App': return r.remplacablepar || "—";
      case 'Fournisseur': return r.contact || "—";
      default: return "—";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#172030] text-xl">
            {getResourceIcon()}
            {title}
          </DialogTitle>
          <DialogDescription className="text-[#172030]/60">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder={`Rechercher un(e) ${getResourceLabel()}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 border-[#E8E4DC]"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-[#172030]/50">
            <div className="flex items-center gap-3">
              <span>{filteredResources.length} {getResourceLabel()}{filteredResources.length > 1 ? 's' : ''} disponible{filteredResources.length > 1 ? 's' : ''}</span>
              {allResources.length - availableResources.length > 0 && (
                <span className="text-[#172030]/30">
                  ({allResources.length - availableResources.length} déjà ajouté{allResources.length - availableResources.length > 1 ? 's' : ''})
                </span>
              )}
              {selectedIds.length > 0 && (
                <Badge className="bg-[#2A5141] text-white text-[10px]">
                  {selectedIds.length} sélectionné{selectedIds.length > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            {filteredResources.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[10px] text-[#2A5141] hover:bg-[#F8F6F2]"
                onClick={toggleSelectAll}
              >
                {selectedIds.length === filteredResources.length ? "Désélectionner tout" : "Tout sélectionner"}
              </Button>
            )}
          </div>

          <div className="border rounded-lg overflow-hidden max-h-[320px] overflow-y-auto">
            {filteredResources.length === 0 ? (
              <div className="p-6 text-center space-y-3">
                {availableResources.length === 0 ? (
                  <>
                    <p className="text-sm text-[#172030]/60">
                      Tous les {getResourceLabel()}s du référentiel sont déjà ajoutés à la fiche BIA
                    </p>
                    <p className="text-xs text-[#172030]/40">
                      Vous pouvez en créer un(e) nouveau(nouvelle) dans le référentiel
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-[#172030]/60">
                    Aucun(e) {getResourceLabel()} trouvé(e)
                  </p>
                )}
                <Button                  variant="outline"
                  size="sm"
                  className="text-[#2A5141] border-[#2A5141] hover:bg-[#F8F6F2]"
                  onClick={() => {
                    onOpenChange(false);
                    onAddToCMDB();
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Créer un(e) {getResourceLabel()} dans le référentiel
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#F8F6F2] border-b border-[#E8E4DC]">
                    <TableHead className="w-10 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === filteredResources.length && filteredResources.length > 0}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-gray-300 text-[#2A5141] focus:ring-[#2A5141] cursor-pointer"
                      />
                    </TableHead>
                    <TableHead className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider py-2">Nom</TableHead>
                    <TableHead className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider py-2">Détail</TableHead>
                    <TableHead className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider py-2">Informations</TableHead>
                    <TableHead className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider py-2 text-center">Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResources.map((r) => {
                    const isSelected = selectedIds.includes(r.id);
                    const isAlreadyAdded = addedResourceIds.includes(r.id);
                    
                    return (
                      <TableRow
                        key={r.id}
                        className={cn(
                          "cursor-pointer hover:bg-[#F8F6F2] transition-colors",
                          isSelected && "bg-[#F0F5F0]",
                          isAlreadyAdded && "opacity-50"
                        )}
                        onClick={() => !isAlreadyAdded && toggleSelect(r.id)}
                      >
                        <TableCell className="py-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => !isAlreadyAdded && toggleSelect(r.id)}
                            disabled={isAlreadyAdded}
                            className={cn(
                              "h-4 w-4 rounded border-gray-300 text-[#2A5141] focus:ring-[#2A5141] cursor-pointer",
                              isAlreadyAdded && "opacity-30 cursor-not-allowed"
                            )}
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="flex items-center gap-2">
                            {getResourceIcon()}
                            <span className="font-medium text-sm text-[#172030]">{r.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2 text-sm text-[#172030]/60">
                          {getResourceDetails(r)}
                        </TableCell>
                        <TableCell className="py-2 text-sm text-[#172030]/50">
                          {getResourceExtra(r)}
                        </TableCell>
                        <TableCell className="py-2 text-center">
                          {isAlreadyAdded ? (
                            <Badge className="bg-gray-100 text-gray-500 border-gray-200 text-[10px]">
                              Déjà ajouté
                            </Badge>
                          ) : isSelected ? (
                            <Badge className="bg-[#2A5141] text-white text-[10px]">
                              Sélectionné
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-[#172030]/30">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          {filteredResources.length > 0 && (
            <div className="flex justify-between items-center pt-2 border-t border-[#E8E4DC]">
              <Button
                variant="link"
                size="sm"
                className="text-[#2A5141]"
                onClick={() => {
                  onOpenChange(false);
                  onAddToCMDB();
                }}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Créer un(e) {getResourceLabel()} dans le référentiel
              </Button>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#172030]/40">
                  {selectedIds.length} ressource{selectedIds.length > 1 ? 's' : ''} sélectionnée{selectedIds.length > 1 ? 's' : ''}
                </span>
                <Button
                  onClick={handleSelect}
                  disabled={selectedIds.length === 0}
                  className="bg-[#2A5141] hover:bg-[#1a3329] text-white"
                >
                  Ajouter {selectedIds.length} {getResourceLabel()}{selectedIds.length > 1 ? 's' : ''} à la fiche BIA
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================
// COMPOSANT - Dialogue d'ajout au référentiel - CORRIGÉ
// ============================================================
const AddToCMDBDialog = ({
  open,
  onOpenChange,
  resourceType,
  onAdd,
  departmentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceType: string;
  onAdd: (data: any) => void;
  departmentId?: string;
}) => {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState("");
  const [service, setService] = useState("");
  const [contact, setContact] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getResourceLabel = () => {
    switch(resourceType) {
      case 'HR': return 'Collaborateur';
      case 'Equipement': return 'Équipement';
      case 'App': return 'Application IT';
      case 'Fournisseur': return 'Prestataire';
      default: return 'Ressource';
    }
  };

  const getResourceIcon = () => {
    switch(resourceType) {
      case 'HR': return <Users className="h-5 w-5 text-blue-600" />;
      case 'Equipement': return <Monitor className="h-5 w-5 text-yellow-600" />;
      case 'App': return <Server className="h-5 w-5 text-purple-600" />;
      case 'Fournisseur': return <Handshake className="h-5 w-5 text-orange-600" />;
      default: return <Plus className="h-5 w-5 text-gray-600" />;
    }
  };

  const resetForm = () => {
    setName("");
    setRole("");
    setEmail("");
    setPhone("");
    setType("");
    setService("");
    setContact("");
    setQuantity(1);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({ title: "Erreur", description: "Veuillez saisir un nom", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      let table = '';
      let data: any = { name: name.trim() };

      switch(resourceType) {
        case 'HR':
          table = 'ressources_humaines';
          if (role) data.role = role;
          if (email) data.email = email;
          if (phone) data.phone = phone;
          if (departmentId) data.department_id = departmentId;
          break;
        case 'Equipement':
          table = 'ressources_equipements';
          if (type) data.type = type;
          if (quantity) data.quantity = quantity;
          if (departmentId) data.department_id = departmentId;
          break;
        case 'App':
          table = 'applications_it';
          // ⚠️ CORRECTION : 'service' n'existe pas dans la table
          // On ne garde que 'type' qui existe
          if (type) data.type = type;
          if (departmentId) data.department_id = departmentId;
          break;
        case 'Fournisseur':
          table = 'fournisseurs';
          if (service) data.service = service;
          if (contact) data.contact = contact;
          if (departmentId) data.department_id = departmentId;
          break;
        default: return;
      }

      const { data: inserted, error } = await supabase
        .from(table)
        .insert(data)
        .select()
        .single();

      if (error) throw error;

      toast({ 
        title: "Succès", 
        description: `${getResourceLabel()} "${name}" ajouté(e) au référentiel` 
      });

      onAdd({ ...inserted, _resourceType: resourceType });
      resetForm();
      onOpenChange(false);

    } catch (error: any) {
      console.error('Erreur ajout ressource:', error);
      toast({ 
        title: "Erreur", 
        description: error.message || "Erreur lors de l'ajout", 
        variant: "destructive" 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) resetForm();
      onOpenChange(newOpen);
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getResourceIcon()}
            Ajouter un(e) {getResourceLabel().toLowerCase()} au référentiel
          </DialogTitle>
          <DialogDescription>
            La ressource sera ajoutée au référentiel puis vous pourrez l'ajouter à la fiche BIA
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-sm font-medium">Nom *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`Nom du/de la ${getResourceLabel().toLowerCase()}`}
              className="mt-1 border-[#E8E4DC]"
            />
          </div>

          {resourceType === 'HR' && (
            <>
              <div>
                <Label className="text-sm font-medium">Rôle</Label>
                <Input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="Ex: Responsable, Chef de projet..."
                  className="mt-1 border-[#E8E4DC]"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Email</Label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@entreprise.com"
                  type="email"
                  className="mt-1 border-[#E8E4DC]"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Téléphone</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+33 6 12 34 56 78"
                  className="mt-1 border-[#E8E4DC]"
                />
              </div>
            </>
          )}

          {resourceType === 'Equipement' && (
            <>
              <div>
                <Label className="text-sm font-medium">Type</Label>
                <Input
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  placeholder="Ex: PC, Serveur, Imprimante..."
                  className="mt-1 border-[#E8E4DC]"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Quantité</Label>
                <Input
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value) || 1)}
                  type="number"
                  min="1"
                  className="mt-1 border-[#E8E4DC]"
                />
              </div>
            </>
          )}

          {resourceType === 'App' && (
            <>
              <div>
                <Label className="text-sm font-medium">Type</Label>
                <Input
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  placeholder="Ex: SaaS, On-premise, Mobile..."
                  className="mt-1 border-[#E8E4DC]"
                />
              </div>
              {/* ⚠️ SUPPRESSION du champ 'Service' car la colonne n'existe pas dans la base */}
            </>
          )}

          {resourceType === 'Fournisseur' && (
            <>
              <div>
                <Label className="text-sm font-medium">Service</Label>
                <Input
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  placeholder="Ex: Télécom, Nettoyage, Maintenance..."
                  className="mt-1 border-[#E8E4DC]"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Contact</Label>
                <Input
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="Nom du contact principal"
                  className="mt-1 border-[#E8E4DC]"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !name.trim()}
            className="bg-[#2A5141] hover:bg-[#1a3329] text-white"
          >
            {isSubmitting ? "Ajout en cours..." : "Ajouter au référentiel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================
// COMPOSANT - Dialogue de liaison de ressources
// ============================================================
const LinkResourceDialog = ({
  open,
  onOpenChange,
  process,
  addedResources,
  onLink,
  resourceType,
  setResourceType,
  onNavigateToCMDB
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  process: any;
  addedResources: {
    hr: any[];
    equipment: any[];
    apps: any[];
    suppliers: any[];
  };
  onLink: (type: string, resourceId: string, rtoHours?: number, rpoHours?: number) => void;
  resourceType: string;
  setResourceType: (type: string) => void;
  onNavigateToCMDB?: () => void;
}) => {
  const [selectedResourceId, setSelectedResourceId] = useState<string>("");
  const [linkRtoHours, setLinkRtoHours] = useState<number>(4);
  const [linkRpoHours, setLinkRpoHours] = useState<number>(2);
  const [searchQuery, setSearchQuery] = useState("");

  const rtoOptions = [1, 2, 4, 6, 8, 12, 24, 48, 72];
  const rpoOptions = [0.5, 1, 2, 4, 6, 8, 12, 24];

  useEffect(() => {
    setLinkRtoHours(4);
    setLinkRpoHours(2);
    setSelectedResourceId("");
    setSearchQuery("");
  }, [resourceType]);

  const getResourcesForType = () => {
    let resources: any[] = [];
    switch(resourceType) {
      case 'HR': resources = addedResources.hr; break;
      case 'Equipement': resources = addedResources.equipment; break;
      case 'App': resources = addedResources.apps; break;
      case 'Fournisseur': resources = addedResources.suppliers; break;
      default: return [];
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      resources = resources.filter(r => 
        r.name?.toLowerCase().includes(q) ||
        r.role?.toLowerCase().includes(q) ||
        r.type?.toLowerCase().includes(q) ||
        r.service?.toLowerCase().includes(q)
      );
    }

    return resources;
  };

  const getResourceLabel = () => {
    switch(resourceType) {
      case 'HR': return 'Ressource humaine';
      case 'Equipement': return 'Équipement';
      case 'App': return 'Application IT';
      case 'Fournisseur': return 'Prestataire';
      default: return 'Ressource';
    }
  };

  const getResourceIcon = () => {
    switch(resourceType) {
      case 'HR': return <Users className="h-5 w-5 text-blue-600" />;
      case 'Equipement': return <Monitor className="h-5 w-5 text-yellow-600" />;
      case 'App': return <Server className="h-5 w-5 text-purple-600" />;
      case 'Fournisseur': return <Handshake className="h-5 w-5 text-orange-600" />;
      default: return <LinkIcon className="h-5 w-5 text-gray-600" />;
    }
  };

  const showRtoFields = resourceType === 'App' || resourceType === 'Equipement' || resourceType === 'Fournisseur';
  const showRpoFields = resourceType === 'App';

  const resources = getResourcesForType();

  const handleLink = () => {
    if (!selectedResourceId) {
      toast({ title: "Erreur", description: "Veuillez sélectionner une ressource", variant: "destructive" });
      return;
    }
    if (resourceType === 'App') {
      onLink(resourceType, selectedResourceId, linkRtoHours, linkRpoHours);
    } else if (resourceType === 'Equipement' || resourceType === 'Fournisseur') {
      onLink(resourceType, selectedResourceId, linkRtoHours);
    } else {
      onLink(resourceType, selectedResourceId);
    }
    setSelectedResourceId("");
    setLinkRtoHours(4);
    setLinkRpoHours(2);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-[#2A5141]" />
            Lier une ressource à "{process?.name || ''}"
          </DialogTitle>
          <DialogDescription>
            Sélectionnez une ressource parmi celles ajoutées à la fiche BIA
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Type de ressource</Label>
            <div className="grid grid-cols-4 gap-2 mt-1">
              <Button 
                variant={resourceType === 'HR' ? 'default' : 'outline'} 
                size="sm"
                className={resourceType === 'HR' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                onClick={() => { setResourceType('HR'); setSelectedResourceId(''); setSearchQuery(''); }}
              >
                <Users className="h-4 w-4 mr-1" /> RH
              </Button>
              <Button 
                variant={resourceType === 'Equipement' ? 'default' : 'outline'} 
                size="sm"
                className={resourceType === 'Equipement' ? 'bg-yellow-600 hover:bg-yellow-700' : ''}
                onClick={() => { setResourceType('Equipement'); setSelectedResourceId(''); setSearchQuery(''); }}
              >
                <Monitor className="h-4 w-4 mr-1" /> Équip.
              </Button>
              <Button 
                variant={resourceType === 'App' ? 'default' : 'outline'} 
                size="sm"
                className={resourceType === 'App' ? 'bg-purple-600 hover:bg-purple-700' : ''}
                onClick={() => { setResourceType('App'); setSelectedResourceId(''); setSearchQuery(''); }}
              >
                <Server className="h-4 w-4 mr-1" /> App
              </Button>
              <Button 
                variant={resourceType === 'Fournisseur' ? 'default' : 'outline'} 
                size="sm"
                className={resourceType === 'Fournisseur' ? 'bg-orange-600 hover:bg-orange-700' : ''}
                onClick={() => { setResourceType('Fournisseur'); setSelectedResourceId(''); setSearchQuery(''); }}
              >
                <Handshake className="h-4 w-4 mr-1" /> Prest.
              </Button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Rechercher une ressource..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 border-[#E8E4DC]"
            />
          </div>

          <div>
            <Label className="flex items-center justify-between">
              <span>{getResourceLabel()}</span>
              <span className="text-xs text-gray-400">{resources.length} disponible{resources.length > 1 ? 's' : ''}</span>
            </Label>
            <div className="mt-1 max-h-48 overflow-y-auto border rounded-lg divide-y divide-[#E8E4DC]">
              {resources.length === 0 ? (
                <div className="p-4 text-center space-y-2">
                  <p className="text-sm text-gray-400">
                    Aucune {getResourceLabel().toLowerCase()} disponible dans la fiche BIA
                  </p>
                  <p className="text-xs text-gray-400">
                    Ajoutez d'abord des ressources via l'onglet "Ressources requises"
                  </p>
                  {onNavigateToCMDB && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-[#2A5141] border-[#2A5141]"
                      onClick={() => {
                        onOpenChange(false);
                        onNavigateToCMDB();
                      }}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Gérer le référentiel
                    </Button>
                  )}
                </div>
              ) : (
                resources.map((r) => (
                  <div
                    key={r.id}
                    className={cn(
                      "flex items-center justify-between p-2 cursor-pointer hover:bg-[#F8F6F2] transition-colors",
                      selectedResourceId === r.id && "bg-[#F8F6F2] border-l-2 border-[#2A5141]"
                    )}
                    onClick={() => setSelectedResourceId(r.id)}
                  >
                    <div className="flex items-center gap-2">
                      {getResourceIcon()}
                      <div>
                        <p className="text-sm font-medium">{r.name}</p>
                        <p className="text-xs text-gray-400">
                          {r.role || r.type || r.service || "—"}
                        </p>
                      </div>
                    </div>
                    {selectedResourceId === r.id && (
                      <Badge className="bg-[#2A5141] text-white text-[10px]">
                        Sélectionné
                      </Badge>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {showRtoFields && selectedResourceId && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-[#172030]">
                Objectifs de reprise pour cette liaison
              </Label>
              <div className={cn("grid gap-3", showRpoFields ? "grid-cols-2" : "grid-cols-1")}>
                <div>
                  <Label className="text-xs text-slate-500">RTO (heures) *</Label>
                  <select
                    value={linkRtoHours}
                    onChange={(e) => setLinkRtoHours(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 border rounded-lg bg-white text-sm focus:ring-2 focus:ring-[#2A5141] focus:border-[#2A5141]"
                  >
                    {rtoOptions.map((val) => (
                      <option key={val} value={val}>{val}h</option>
                    ))}
                  </select>
                </div>
                {showRpoFields && (
                  <div>
                    <Label className="text-xs text-slate-500">RPO (heures) *</Label>
                    <select
                      value={linkRpoHours}
                      onChange={(e) => setLinkRpoHours(Number(e.target.value))}
                      className="w-full mt-1 px-3 py-2 border rounded-lg bg-white text-sm focus:ring-2 focus:ring-[#2A5141] focus:border-[#2A5141]"
                    >
                      {rpoOptions.map((val) => (
                        <option key={val} value={val}>{val}h</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-slate-400">
                {showRpoFields 
                  ? "Ces valeurs sont spécifiques à la liaison de cette application avec ce processus."
                  : "Cette valeur est spécifique à la liaison de cette ressource avec ce processus."
                }
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
            {getResourceIcon()}
            <span className="text-sm text-gray-600">
              Vous allez lier cette ressource au processus "{process?.name || ''}"
            </span>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button 
            onClick={handleLink} 
            disabled={!selectedResourceId}
            className="bg-[#2A5141] hover:bg-[#1a3329] text-white"
          >
            <LinkIcon className="h-4 w-4 mr-1" /> Lier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================
// COMPOSANT - PersonnelTableau AVEC GESTION DES LIENS
// ============================================================
const PersonnelTableau = ({ 
  people, 
  onDelete,
  linkedProcessesMap,
  onManageLinks
}: { 
  people: any[];
  onDelete?: (id: string, name: string) => void;
  linkedProcessesMap?: Record<string, any[]>;
  onManageLinks?: (id: string, name: string) => void;
}) => {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-[#F8F6F2] border-b border-[#E8E4DC]">
            <TableHead className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider py-2">Collaborateur clé</TableHead>
            <TableHead className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider py-2">Rôle</TableHead>
            <TableHead className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider py-2">Email</TableHead>
            <TableHead className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider py-2">Téléphone</TableHead>
            <TableHead className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider py-2 text-center">Processus liés</TableHead>
            <TableHead className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider py-2 text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {people.map((person, idx) => {
            const displayProcesses = linkedProcessesMap?.[person.id] || [];
            const visibleProcesses = displayProcesses.slice(0, 2);
            const remainingCount = displayProcesses.length - 2;

            return (
              <TableRow 
                key={person.id || idx}
                className={cn(
                  "border-b border-[#E8E4DC]",
                  idx % 2 === 0 ? "bg-white" : "bg-[#FAFAF9]"
                )}
              >
                <TableCell className="py-2">
                  <span className="text-sm font-medium text-[#172030]">{person.name}</span>
                </TableCell>
                <TableCell className="py-2">
                  <span className="text-sm text-[#172030]/60">{person.role || "—"}</span>
                </TableCell>
                <TableCell className="py-2">
                  <span className="text-sm text-[#172030]/60">{person.email || "—"}</span>
                </TableCell>
                <TableCell className="py-2">
                  <span className="text-sm text-[#172030]/60">{person.phone || "—"}</span>
                </TableCell>
                <TableCell className="py-2 text-center">
                  {displayProcesses.length > 0 ? (
                    <div className="flex flex-wrap items-center justify-center gap-1">
                      {visibleProcesses.map((p: any) => (
                        <Badge key={p.id} variant="outline" className="text-[9px] bg-[#FAFAF9] border-[#E8E4DC] text-[#172030] font-normal">
                          {p.name}
                        </Badge>
                      ))}
                      {remainingCount > 0 && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Badge variant="outline" className="text-[9px] bg-[#FAFAF9] border-[#E8E4DC] text-[#2A5141] font-medium cursor-pointer hover:bg-[#F0EDE8]">
                              +{remainingCount}
                            </Badge>
                          </PopoverTrigger>
                          <PopoverContent className="w-48 p-3 border-[#E8E4DC] bg-white shadow-lg">
                            <div className="space-y-1.5">
                              <p className="text-xs font-medium text-[#172030]/60 uppercase tracking-wider mb-1">Tous les processus</p>
                              {displayProcesses.map((p: any) => (
                                <div key={p.id} className="text-sm text-[#172030] py-0.5 border-b border-[#E8E4DC]/30 last:border-0">
                                  {p.name}
                                </div>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-[#172030]/30">—</span>
                  )}
                </TableCell>
                <TableCell className="py-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    {onManageLinks && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[10px] text-[#2A5141] hover:bg-[#F0F5F0] rounded gap-1"
                        onClick={() => onManageLinks(person.id, person.name)}
                        title="Gérer les processus liés"
                      >
                        <LinkIcon className="h-3 w-3" />
                        Liens
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-[#172030]/30 hover:text-red-600 hover:bg-red-50 rounded-md"
                        onClick={() => onDelete(person.id, person.name)}
                        title="Retirer de la fiche BIA"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        <tfoot>
          <TableRow className="bg-[#F8F6F2] border-t-2 border-[#E8E4DC]">
            <TableCell colSpan={6} className="py-3 px-3 font-semibold text-sm text-[#172030]">
              Total collaborateurs clés : <span className="text-[#2A5141]">{people.length}</span>
            </TableCell>
          </TableRow>
        </tfoot>
      </Table>
    </div>
  );
};

// ============================================================
// COMPOSANT - EquipmentTableau AVEC GESTION DES LIENS
// ============================================================
const EquipmentTableau = ({ 
  equipment, 
  onDelete,
  linkedProcessesMap,
  onManageLinks
}: { 
  equipment: any[];
  onDelete?: (id: string, name: string) => void;
  linkedProcessesMap?: Record<string, any[]>;
  onManageLinks?: (id: string, name: string) => void;
}) => {
  const periods = [
    { key: "P0_4H", label: "0-4h" },
    { key: "P4_8H", label: "4-8h" },
    { key: "P1D", label: "1j" },
    { key: "P2D", label: "2j" },
  ];

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-[#F8F6F2] border-b border-[#E8E4DC]">
            <TableHead className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider py-2">Équipement</TableHead>
            <TableHead className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider py-2">Type</TableHead>
            <TableHead className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider py-2 text-center">Unités</TableHead>
            {periods.map((p) => (
              <TableHead key={p.key} className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider py-2 text-center">
                {p.label}
              </TableHead>
            ))}
            <TableHead className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider py-2">Processus liés</TableHead>
            <TableHead className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider py-2 text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {equipment.map((eq, idx) => {
            const quantities = eq.quantities || {};
            const displayProcesses = linkedProcessesMap?.[eq.id] || [];
            const visibleProcesses = displayProcesses.slice(0, 2);
            const remainingCount = displayProcesses.length - 2;

            return (
              <TableRow 
                key={eq.id || idx}
                className={cn(
                  "border-b border-[#E8E4DC]",
                  idx % 2 === 0 ? "bg-white" : "bg-[#FAFAF9]"
                )}
              >
                <TableCell className="py-2">
                  <span className="text-sm font-medium text-[#172030]">{eq.name}</span>
                </TableCell>
                <TableCell className="py-2 text-sm text-[#172030]/60">{eq.type || "—"}</TableCell>
                <TableCell className="py-2 text-center font-mono text-sm text-[#172030]">
                  {eq.quantity || 1}
                </TableCell>
                {periods.map((p) => (
                  <TableCell key={p.key} className="py-2 text-center font-mono text-sm text-[#172030]">
                    {quantities[p.key] || 0}
                  </TableCell>
                ))}
                <TableCell className="py-2">
                  {displayProcesses.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1">
                      {visibleProcesses.map((p: any) => (
                        <Badge key={p.id} variant="outline" className="text-[9px] bg-[#FAFAF9] border-[#E8E4DC] text-[#172030] font-normal">
                          {p.name}
                        </Badge>
                      ))}
                      {remainingCount > 0 && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Badge variant="outline" className="text-[9px] bg-[#FAFAF9] border-[#E8E4DC] text-[#2A5141] font-medium cursor-pointer hover:bg-[#F0EDE8]">
                              +{remainingCount}
                            </Badge>
                          </PopoverTrigger>
                          <PopoverContent className="w-48 p-3 border-[#E8E4DC] bg-white shadow-lg">
                            <div className="space-y-1.5">
                              <p className="text-xs font-medium text-[#172030]/60 uppercase tracking-wider mb-1">Tous les processus</p>
                              {displayProcesses.map((p: any) => (
                                <div key={p.id} className="text-sm text-[#172030] py-0.5 border-b border-[#E8E4DC]/30 last:border-0">
                                  {p.name}
                                </div>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-[#172030]/30">Aucun</span>
                  )}
                </TableCell>
                <TableCell className="py-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    {onManageLinks && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[10px] text-[#2A5141] hover:bg-[#F0F5F0] rounded gap-1"
                        onClick={() => onManageLinks(eq.id, eq.name)}
                        title="Gérer les processus liés"
                      >
                        <LinkIcon className="h-3 w-3" />
                        Liens
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-[#172030]/30 hover:text-red-600 hover:bg-red-50 rounded-md"
                        onClick={() => onDelete(eq.id, eq.name)}
                        title="Retirer de la fiche BIA"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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
  );
};

// ============================================================
// COMPOSANT - AppTableau AVEC GESTION DES LIENS
// ============================================================
const AppTableau = ({ 
  apps, 
  onDelete,
  linkedProcessesMap,
  onManageLinks
}: { 
  apps: any[];
  onDelete?: (id: string, name: string) => void;
  linkedProcessesMap?: Record<string, any[]>;
  onManageLinks?: (id: string, name: string) => void;
}) => {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-[#F8F6F2] border-b border-[#E8E4DC]">
            <TableHead className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider py-2">Application</TableHead>
            <TableHead className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider py-2">Type</TableHead>
            {/* ❌ SUPPRESSION de la colonne "Service" car elle n'existe pas dans la table */}
            <TableHead className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider py-2">Alternative</TableHead>
            <TableHead className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider py-2">Processus liés</TableHead>
            <TableHead className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider py-2 text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {apps.map((app, idx) => {
            const displayProcesses = linkedProcessesMap?.[app.id] || [];
            const visibleProcesses = displayProcesses.slice(0, 2);
            const remainingCount = displayProcesses.length - 2;

            return (
              <TableRow 
                key={app.id || idx}
                className={cn(
                  "border-b border-[#E8E4DC]",
                  idx % 2 === 0 ? "bg-white" : "bg-[#FAFAF9]"
                )}
              >
                <TableCell className="py-2">
                  <span className="text-sm font-medium text-[#172030]">{app.name}</span>
                </TableCell>
                <TableCell className="py-2 text-sm text-[#172030]/60">{app.type || "—"}</TableCell>
                {/* ❌ SUPPRESSION de la cellule "Service" */}
                <TableCell className="py-2 text-sm text-[#172030]/60">{app.remplacablepar || "—"}</TableCell>
                <TableCell className="py-2">
                  {displayProcesses.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1">
                      {visibleProcesses.map((p: any) => (
                        <Badge key={p.id} variant="outline" className="text-[9px] bg-[#FAFAF9] border-[#E8E4DC] text-[#172030] font-normal">
                          {p.name}
                        </Badge>
                      ))}
                      {remainingCount > 0 && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Badge variant="outline" className="text-[9px] bg-[#FAFAF9] border-[#E8E4DC] text-[#2A5141] font-medium cursor-pointer hover:bg-[#F0EDE8]">
                              +{remainingCount}
                            </Badge>
                          </PopoverTrigger>
                          <PopoverContent className="w-48 p-3 border-[#E8E4DC] bg-white shadow-lg">
                            <div className="space-y-1.5">
                              <p className="text-xs font-medium text-[#172030]/60 uppercase tracking-wider mb-1">Tous les processus</p>
                              {displayProcesses.map((p: any) => (
                                <div key={p.id} className="text-sm text-[#172030] py-0.5 border-b border-[#E8E4DC]/30 last:border-0">
                                  {p.name}
                                </div>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-[#172030]/30">Aucun</span>
                  )}
                </TableCell>
                <TableCell className="py-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    {onManageLinks && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[10px] text-[#2A5141] hover:bg-[#F0F5F0] rounded gap-1"
                        onClick={() => onManageLinks(app.id, app.name)}
                        title="Gérer les processus liés"
                      >
                        <LinkIcon className="h-3 w-3" />
                        Liens
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-[#172030]/30 hover:text-red-600 hover:bg-red-50 rounded-md"
                        onClick={() => onDelete(app.id, app.name)}
                        title="Retirer de la fiche BIA"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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
  );
};

// ============================================================
// COMPOSANT - SupplierTableau AVEC GESTION DES LIENS
// ============================================================
const SupplierTableau = ({ 
  suppliers, 
  onDelete,
  linkedProcessesMap,
  onManageLinks
}: { 
  suppliers: any[];
  onDelete?: (id: string, name: string) => void;
  linkedProcessesMap?: Record<string, any[]>;
  onManageLinks?: (id: string, name: string) => void;
}) => {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-[#F8F6F2] border-b border-[#E8E4DC]">
            <TableHead className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider py-2">Prestataire</TableHead>
            <TableHead className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider py-2">Service</TableHead>
            <TableHead className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider py-2">Contact</TableHead>
            <TableHead className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider py-2">Processus liés</TableHead>
            <TableHead className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider py-2 text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {suppliers.map((sup, idx) => {
            const displayProcesses = linkedProcessesMap?.[sup.id] || [];
            const visibleProcesses = displayProcesses.slice(0, 2);
            const remainingCount = displayProcesses.length - 2;

            return (
              <TableRow 
                key={sup.id || idx}
                className={cn(
                  "border-b border-[#E8E4DC]",
                  idx % 2 === 0 ? "bg-white" : "bg-[#FAFAF9]"
                )}
              >
                <TableCell className="py-2">
                  <span className="text-sm font-medium text-[#172030]">{sup.name}</span>
                </TableCell>
                <TableCell className="py-2 text-sm text-[#172030]/60">{sup.service || "—"}</TableCell>
                <TableCell className="py-2 text-sm text-[#172030]/60">{sup.contact || "—"}</TableCell>
                <TableCell className="py-2">
                  {displayProcesses.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1">
                      {visibleProcesses.map((p: any) => (
                        <Badge key={p.id} variant="outline" className="text-[9px] bg-[#FAFAF9] border-[#E8E4DC] text-[#172030] font-normal">
                          {p.name}
                        </Badge>
                      ))}
                      {remainingCount > 0 && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Badge variant="outline" className="text-[9px] bg-[#FAFAF9] border-[#E8E4DC] text-[#2A5141] font-medium cursor-pointer hover:bg-[#F0EDE8]">
                              +{remainingCount}
                            </Badge>
                          </PopoverTrigger>
                          <PopoverContent className="w-48 p-3 border-[#E8E4DC] bg-white shadow-lg">
                            <div className="space-y-1.5">
                              <p className="text-xs font-medium text-[#172030]/60 uppercase tracking-wider mb-1">Tous les processus</p>
                              {displayProcesses.map((p: any) => (
                                <div key={p.id} className="text-sm text-[#172030] py-0.5 border-b border-[#E8E4DC]/30 last:border-0">
                                  {p.name}
                                </div>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-[#172030]/30">Aucun</span>
                  )}
                </TableCell>
                <TableCell className="py-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    {onManageLinks && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[10px] text-[#2A5141] hover:bg-[#F0F5F0] rounded gap-1"
                        onClick={() => onManageLinks(sup.id, sup.name)}
                        title="Gérer les processus liés"
                      >
                        <LinkIcon className="h-3 w-3" />
                        Liens
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-[#172030]/30 hover:text-red-600 hover:bg-red-50 rounded-md"
                        onClick={() => onDelete(sup.id, sup.name)}
                        title="Retirer de la fiche BIA"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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
  );
};

// ============================================================
// COMPOSANT - ProcessDetailView (SANS MTPD)
// ============================================================
const ProcessDetailView = ({ 
  process, 
  allProcesses,
  onClose,
  onEditProcess,
  serviceId,
  onResourceUnlinked,
}: { 
  process: any;
  allProcesses: any[];
  onClose: () => void;
  onEditProcess: (id: string) => void;
  serviceId: string;
  onResourceUnlinked?: () => void;
}) => {
  const [linkedHR, setLinkedHR] = useState<any[]>([]);
  const [linkedEquipment, setLinkedEquipment] = useState<any[]>([]);
  const [linkedApps, setLinkedApps] = useState<any[]>([]);
  const [linkedSuppliers, setLinkedSuppliers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const score = computeMaxScoreFromImpacts(process.impacts);
  const crit = scoreToCriticality(score);

  const loadLinkedResources = useCallback(async () => {
    console.log('🔄 ProcessDetailView - Chargement des ressources liées pour:', process.id, process.name);
    setIsLoading(true);
    try {
      const { data: hrLinks, error: hrError } = await supabase
        .from('processus_ressources_humaines')
        .select('ressource_humaine_id')
        .eq('processus_id', process.id);

      if (hrError) {
        console.error('❌ Erreur RH:', hrError);
      }

      if (hrLinks && hrLinks.length > 0) {
        const hrIds = hrLinks.map((l: any) => l.ressource_humaine_id);
        const { data: hrData } = await supabase
          .from('ressources_humaines')
          .select('*')
          .in('id', hrIds);
        setLinkedHR(hrData || []);
        console.log('✅ RH chargés:', hrData?.length || 0);
      } else {
        setLinkedHR([]);
        console.log('ℹ️ Aucun RH lié');
      }

      const { data: equipLinks, error: equipError } = await supabase
        .from('processus_equipements')
        .select('equipement_id, rto_hours')
        .eq('processus_id', process.id);

      if (equipError) {
        console.error('❌ Erreur équipements:', equipError);
      }

      if (equipLinks && equipLinks.length > 0) {
        const equipIds = equipLinks.map((l: any) => l.equipement_id);
        const { data: equipData } = await supabase
          .from('ressources_equipements')
          .select('*')
          .in('id', equipIds);
        
        const enrichedEquip = equipData?.map(eq => {
          const link = equipLinks.find((l: any) => l.equipement_id === eq.id);
          return { ...eq, _linkRto: link?.rto_hours || 4 };
        });
        setLinkedEquipment(enrichedEquip || []);
        console.log('✅ Équipements chargés:', enrichedEquip?.length || 0);
      } else {
        setLinkedEquipment([]);
        console.log('ℹ️ Aucun équipement lié');
      }

      const { data: appLinks, error: appError } = await supabase
        .from('processus_applications')
        .select('application_id, rto_hours, rpo_hours')
        .eq('processus_id', process.id);

      if (appError) {
        console.error('❌ Erreur applications:', appError);
      }

      if (appLinks && appLinks.length > 0) {
        const appIds = appLinks.map((l: any) => l.application_id);
        const { data: appData } = await supabase
          .from('applications_it')
          .select('*')
          .in('id', appIds);
        
        const enrichedApps = appData?.map(app => {
          const link = appLinks.find((l: any) => l.application_id === app.id);
          return { ...app, _linkRto: link?.rto_hours || 4, _linkRpo: link?.rpo_hours || 2 };
        });
        setLinkedApps(enrichedApps || []);
        console.log('✅ Applications chargées:', enrichedApps?.length || 0);
      } else {
        setLinkedApps([]);
        console.log('ℹ️ Aucune application liée');
      }

      const { data: suppLinks, error: suppError } = await supabase
        .from('processus_fournisseurs')
        .select('fournisseur_id, rto_hours')
        .eq('processus_id', process.id);

      if (suppError) {
        console.error('❌ Erreur fournisseurs:', suppError);
      }

      if (suppLinks && suppLinks.length > 0) {
        const suppIds = suppLinks.map((l: any) => l.fournisseur_id);
        const { data: suppData } = await supabase
          .from('fournisseurs')
          .select('*')
          .in('id', suppIds);
        
        const enrichedSuppliers = suppData?.map(sup => {
          const link = suppLinks.find((l: any) => l.fournisseur_id === sup.id);
          return { ...sup, _linkRto: link?.rto_hours || 4 };
        });
        setLinkedSuppliers(enrichedSuppliers || []);
        console.log('✅ Fournisseurs chargés:', enrichedSuppliers?.length || 0);
      } else {
        setLinkedSuppliers([]);
        console.log('ℹ️ Aucun fournisseur lié');
      }

      console.log('✅ ProcessDetailView - Chargement terminé pour:', process.id);

    } catch (error) {
      console.error('❌ Erreur générale chargement ressources liées:', error);
    } finally {
      setIsLoading(false);
    }
  }, [process.id]);

  useEffect(() => {
    if (process && process.id) {
      console.log('🚀 ProcessDetailView - Ouverture du dialogue, chargement:', process.id, process.name);
      loadLinkedResources();
    }
  }, [process.id, loadLinkedResources]);

  const unlinkResource = async (type: string, resourceId: string, resourceName: string) => {
    if (!confirm(`Voulez-vous dissocier "${resourceName}" de ce processus ?`)) return;

    try {
      let table = '';
      let idColumn = '';
      
      switch(type) {
        case 'HR':
          table = 'processus_ressources_humaines';
          idColumn = 'ressource_humaine_id';
          break;
        case 'Equipement':
          table = 'processus_equipements';
          idColumn = 'equipement_id';
          break;
        case 'App':
          table = 'processus_applications';
          idColumn = 'application_id';
          break;
        case 'Fournisseur':
          table = 'processus_fournisseurs';
          idColumn = 'fournisseur_id';
          break;
        default: return;
      }

      const { error } = await supabase
        .from(table)
        .delete()
        .eq('processus_id', process.id)
        .eq(idColumn, resourceId);

      if (error) throw error;

      toast({ title: "Succès", description: `Ressource dissociée du processus` });
      
      await loadLinkedResources();
      if (onResourceUnlinked) onResourceUnlinked();

    } catch (error: any) {
      console.error('Erreur dissociation:', error);
      toast({ title: "Erreur", description: error.message || "Erreur lors de la dissociation", variant: "destructive" });
    }
  };

  const totalResources = linkedHR.length + linkedEquipment.length + linkedApps.length + linkedSuppliers.length;

  return (
    <Dialog open={!!process} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-indigo-600" />
              <DialogTitle className="text-xl">{process.name}</DialogTitle>
              <Badge className={criticalityColor(crit)}>{crit}</Badge>
              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                <LinkIcon className="h-3 w-3 mr-1" />
                {totalResources} ressources
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadLinkedResources}>
                <RefreshCw className="h-4 w-4 mr-1" /> Rafraîchir
              </Button>
              <Button variant="outline" size="sm" onClick={() => onEditProcess(process.id)}>
                <Pencil className="h-4 w-4 mr-1" /> Modifier
              </Button>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400">Code</p>
                <p className="font-mono text-sm">{process.code || process.id?.slice(0, 8)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400">Responsable</p>
                <p className="font-medium text-sm">{process.owner || "—"}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400">RTO</p>
                <p className="font-medium text-sm">{process.rto || 0}h</p>
              </div>
            </div>

            {process.description && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 font-semibold">Description</p>
                <p className="text-sm">{process.description}</p>
              </div>
            )}

            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 font-medium text-sm flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-indigo-600" />
                Ressources associées
                <Badge className="bg-indigo-100 text-indigo-700 text-xs ml-2">
                  {totalResources} total
                </Badge>
              </div>
              
              {totalResources === 0 ? (
                <div className="p-6 text-center text-gray-400">
                  <p className="text-sm">Aucune ressource associée à ce processus</p>
                  <p className="text-xs mt-1">Utilisez le bouton "Associer" pour lier des ressources</p>
                </div>
              ) : (
                <div className="p-4 grid grid-cols-2 gap-4">
                  {/* RH */}
                  <div className="border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-sm">RH</span>
                      <Badge variant="outline" className="text-xs">
                        {linkedHR.length}
                      </Badge>
                    </div>
                    {linkedHR.length > 0 ? (
                      linkedHR.map((r: any, i: number) => (
                        <div key={r.id || i} className="text-sm border-b border-gray-100 py-1 flex justify-between items-center">
                          <span className="truncate">{r.name}</span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Badge variant="outline" className="text-[10px]">{r.role || "—"}</Badge>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                              onClick={() => unlinkResource('HR', r.id, r.name)}
                              title="Dissocier"
                            >
                              <Unlink className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-400">Aucun RH associé</p>
                    )}
                  </div>

                  {/* Équipements */}
                  <div className="border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Monitor className="h-4 w-4 text-yellow-600" />
                      <span className="font-medium text-sm">Équipements</span>
                      <Badge variant="outline" className="text-xs">
                        {linkedEquipment.length}
                      </Badge>
                    </div>
                    {linkedEquipment.length > 0 ? (
                      linkedEquipment.map((r: any, i: number) => (
                        <div key={r.id || i} className="text-sm border-b border-gray-100 py-1 flex justify-between items-center">
                          <span className="truncate">{r.name}</span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge variant="outline" className="text-[10px]">{r.type || "—"}</Badge>
                            {r._linkRto !== undefined && (
                              <Badge variant="outline" className="text-[10px] bg-blue-50 border-blue-200 text-blue-700">
                                RTO {r._linkRto}h
                              </Badge>
                            )}
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                              onClick={() => unlinkResource('Equipement', r.id, r.name)}
                              title="Dissocier"
                            >
                              <Unlink className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-400">Aucun équipement associé</p>
                    )}
                  </div>

                  {/* Apps */}
                  <div className="border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Server className="h-4 w-4 text-purple-600" />
                      <span className="font-medium text-sm">Apps IT</span>
                      <Badge variant="outline" className="text-xs">
                        {linkedApps.length}
                      </Badge>
                    </div>
                    {linkedApps.length > 0 ? (
                      linkedApps.map((a: any, i: number) => (
                        <div key={a.id || i} className="text-sm border-b border-gray-100 py-1 flex justify-between items-center">
                          <span className="truncate">{a.name}</span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {a._linkRto !== undefined && (
                              <Badge variant="outline" className="text-[10px] bg-blue-50 border-blue-200 text-blue-700">
                                RTO {a._linkRto}h
                              </Badge>
                            )}
                            {a._linkRpo !== undefined && (
                              <Badge variant="outline" className="text-[10px] bg-orange-50 border-orange-200 text-orange-700">
                                RPO {a._linkRpo}h
                              </Badge>
                            )}
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                              onClick={() => unlinkResource('App', a.id, a.name)}
                              title="Dissocier"
                            >
                              <Unlink className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-400">Aucune app associée</p>
                    )}
                  </div>

                  {/* Prestataires */}
                  <div className="border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Handshake className="h-4 w-4 text-orange-600" />
                      <span className="font-medium text-sm">Prestataires</span>
                      <Badge variant="outline" className="text-xs">
                        {linkedSuppliers.length}
                      </Badge>
                    </div>
                    {linkedSuppliers.length > 0 ? (
                      linkedSuppliers.map((r: any, i: number) => (
                        <div key={r.id || i} className="text-sm border-b border-gray-100 py-1 flex justify-between items-center">
                          <span className="truncate">{r.name}</span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge variant="outline" className="text-[10px]">{r.service || "—"}</Badge>
                            {r._linkRto !== undefined && (
                              <Badge variant="outline" className="text-[10px] bg-blue-50 border-blue-200 text-blue-700">
                                RTO {r._linkRto}h
                              </Badge>
                            )}
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                              onClick={() => unlinkResource('Fournisseur', r.id, r.name)}
                              title="Dissocier"
                            >
                              <Unlink className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-400">Aucun prestataire associé</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ============================================================
// COMPOSANT - DependencyMapView
// ============================================================
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

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/20 rounded-lg p-2 text-center"><Clock className="h-4 w-4 mx-auto text-muted-foreground mb-1" /><p className="text-xs text-muted-foreground">RTO</p><p className="text-lg font-bold">{selectedProcess.rto}h</p></div>
                <div className="bg-muted/20 rounded-lg p-2 text-center"><Database className="h-4 w-4 mx-auto text-muted-foreground mb-1" /><p className="text-xs text-muted-foreground">RPO</p><p className="text-lg font-bold">{selectedProcess.rpo}h</p></div>
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

// ============================================================
// COMPOSANT - BIAServiceCard (SANS COMPLÉTION)
// ============================================================
const BIAServiceCard = ({ 
  service,
  onClick,
  departmentId,
}: { 
  service: ServiceBIA;
  onClick: () => void;
  departmentId?: string;
}) => {
  const isNonDemarre = service.status === "non_demarre";
  
  const statusConfigs = {
    critique: { label: "Critique", className: "bg-red-100 text-red-700 border-red-200" },
    a_completer: { label: "À compléter", className: "bg-amber-100 text-amber-700 border-amber-200" },
    a_reviser: { label: "À réviser", className: "bg-orange-100 text-orange-700 border-orange-200" },
    complet: { label: "Complet", className: "bg-green-100 text-green-700 border-green-200" },
    non_demarre: { label: "Non démarré", className: "bg-gray-100 text-gray-500 border-gray-200" }
  };

  const statusConfig = statusConfigs[service.status] || statusConfigs.a_completer;

  return (
    <div 
      className="bg-white border border-[#E8E4DC] rounded-xl p-5 cursor-pointer hover:shadow-[0_8px_24px_rgba(23,32,48,0.08)] hover:border-[#2A5141]/30 transition-all duration-200"
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-[#172030] text-base">{service.name}</h3>
          <p className="text-xs text-[#172030]/50 mt-0.5">
            👤 {service.owner}
          </p>
        </div>
        <Badge className={statusConfig.className}>
          {statusConfig.label}
        </Badge>
      </div>

      {/* Grid 3 colonnes sans Complétion */}
      <div className="grid grid-cols-3 gap-2 py-3 border-t border-b border-[#E8E4DC] mb-3">
        <div className="text-center">
          <div className={cn(
            "text-lg font-bold font-mono",
            isNonDemarre ? "text-[#172030]/30" : "text-[#172030]"
          )}>
            {service.processCount}
          </div>
          <div className="text-[10px] text-[#172030]/40 uppercase tracking-wide">Processus</div>
        </div>
        <div className="text-center">
          <div className={cn(
            "text-lg font-bold font-mono",
            service.criticalCount > 0 ? "text-red-600" : isNonDemarre ? "text-[#172030]/30" : "text-[#172030]"
          )}>
            {service.criticalCount}
          </div>
          <div className="text-[10px] text-[#172030]/40 uppercase tracking-wide">Critiques</div>
        </div>
        <div className="text-center">
          <div className={cn(
            "text-lg font-bold font-mono",
            isNonDemarre ? "text-[#172030]/30" : "text-[#172030]"
          )}>
            {service.resources}
          </div>
          <div className="text-[10px] text-[#172030]/40 uppercase tracking-wide">Ressources</div>
        </div>
      </div>

      <div className="flex items-center justify-end">
        <span className="text-xs text-[#2A5141] font-medium flex items-center gap-1">
          Ouvrir <ChevronRightIcon className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  );
};

// ============================================================
// COMPOSANT - DirectionSection
// ============================================================
const DirectionSection = ({ 
  name, 
  icon,
  services,
  onServiceClick,
  departmentIds,
}: {
  name: string;
  icon: React.ReactNode;
  services: ServiceBIA[];
  onServiceClick: (service: ServiceBIA) => void;
  departmentIds?: Record<string, string>;
}) => {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 rounded-lg bg-[#F8F6F2] text-[#172030] flex items-center justify-center">
          {icon}
        </div>
        <h3 className="font-semibold text-[#172030]">{name}</h3>
        <span className="text-xs text-[#172030]/40">{services.length} service{services.length > 1 ? 's' : ''}</span>
        <div className="flex-1 h-px bg-[#E8E4DC]"></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {services.map(service => (
          <BIAServiceCard
            key={service.id}
            service={service}
            onClick={() => onServiceClick(service)}
            departmentId={departmentIds?.[service.id]}
          />
        ))}
      </div>
    </div>
  );
};

// ============================================================
// IMPACT MATRIX (SANS MTPD)
// ============================================================
const ImpactMatrix = ({ 
  impacts, 
  isCritical,
  rto,
  rpo,
}: { 
  impacts: any;
  isCritical: boolean;
  rto?: number;
  rpo?: number;
}) => {
  const getSeverityPastelStyle = (value: number) => {
    if (value === 0) {
      return {
        bg: "#F5F5F5",
        text: "#9E9E9E",
        border: "#E0E0E0",
        icon: <CircleOff className="h-3.5 w-3.5" style={{ color: "#9E9E9E" }} />
      };
    }
    const label = SEVERITY_FROM_NUMBER[value];
    const styles: Record<string, { bg: string; text: string; border: string; icon: JSX.Element }> = {
      "Mineur": {
        bg: "#E8F5E9",
        text: "#2E7D32",
        border: "#A5D6A7",
        icon: <CircleCheck className="h-3.5 w-3.5" style={{ color: "#2E7D32" }} />
      },
      "Modéré": {
        bg: "#FFF8E1",
        text: "#F57F17",
        border: "#FFE082",
        icon: <CircleDot className="h-3.5 w-3.5" style={{ color: "#F57F17" }} />
      },
      "Majeur": {
        bg: "#FFF3E0",
        text: "#E65100",
        border: "#FFCC80",
        icon: <Circle className="h-3.5 w-3.5" style={{ color: "#E65100" }} />
      },
      "Sévère": {
        bg: "#FBE9E7",
        text: "#D84315",
        border: "#FFAB91",
        icon: <AlertTriangleIcon className="h-3.5 w-3.5" style={{ color: "#D84315" }} />
      },
      "Très sévère": {
        bg: "#FFEBEE",
        text: "#C62828",
        border: "#EF9A9A",
        icon: <AlertOctagon className="h-3.5 w-3.5" style={{ color: "#C62828" }} />
      },
    };
    return styles[label] || styles["Mineur"];
  };

  const getSeverityText = (value: number): string => {
    return SEVERITY_FROM_NUMBER[value] || "—";
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-lg p-3 border border-[#E8E4DC] shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider">RTO</p>
              <p className="text-xl font-bold text-[#172030]">{rto || 0}<span className="text-xs font-normal text-[#172030]/40 ml-0.5">h</span></p>
            </div>
            <div className="w-7 h-7 rounded-full bg-red-50 flex items-center justify-center">
              <Clock className="h-3.5 w-3.5 text-red-500" />
            </div>
          </div>
          <p className="text-[10px] text-[#172030]/40">Délai de reprise max</p>
        </div>
        <div className="bg-white rounded-lg p-3 border border-[#E8E4DC] shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider">RPO</p>
              <p className="text-xl font-bold text-[#172030]">{rpo || 0}<span className="text-xs font-normal text-[#172030]/40 ml-0.5">h</span></p>
            </div>
            <div className="w-7 h-7 rounded-full bg-orange-50 flex items-center justify-center">
              <Database className="h-3.5 w-3.5 text-orange-500" />
            </div>
          </div>
          <p className="text-[10px] text-[#172030]/40">Perte de données max</p>
        </div>
      </div>

      <div className="border border-[#E8E4DC] rounded-lg overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="text-left text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider bg-[#F8F6F2] p-2 border-b border-[#E8E4DC] w-36">
                  Type d'impact
                </th>
                {TIME_PERIODS.map(period => {
                  const label = AVAILABILITY_PERIODS.find(p => p.id === period)?.label || period;
                  return (
                    <th key={period} className="text-center text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider bg-[#F8F6F2] p-2 border-b border-[#E8E4DC] min-w-[60px]">
                      ≤ {label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {IMPACT_AXES.map((axis, rowIdx) => {
                return (
                  <tr key={axis} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-[#FAFAF9]'}>
                    <td className="p-2 border-b border-[#E8E4DC] font-medium text-sm text-[#172030]">
                      {axis}
                      <div className="text-[9px] font-normal text-[#172030]/40">
                        {axis === "Financier" && "Perte financière"}
                        {axis === "Conformité / Légal" && "Sanctions, litiges"}
                        {axis === "Opérationnel" && "Perturbation des activités"}
                        {axis === "Réputationnel" && "Confiance clients / partenaires"}
                      </div>
                    </td>
                    {TIME_PERIODS.map(period => {
                      const value = getImpactValue(impacts, axis, period);
                      const text = getSeverityText(value);
                      const isFilled = value > 0;
                      const style = getSeverityPastelStyle(value);
                      return (
                        <td key={period} className="p-1.5 border-b border-[#E8E4DC] text-center">
                          <div 
                            className={cn(
                              "inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium transition-all",
                              !isFilled && "opacity-60"
                            )}
                            style={{
                              backgroundColor: style.bg,
                              color: style.text,
                              borderColor: style.border,
                              minWidth: "70px",
                              justifyContent: "center"
                            }}
                          >
                            {style.icon}
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
      </div>

      <div className="flex flex-wrap items-center gap-3 p-2.5 bg-[#F8F6F2] rounded-lg border border-[#E8E4DC]">
        <span className="text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider mr-0.5">Légende</span>
        {SEVERITY_LEVELS.map(sev => (
          <div key={sev.value} className="flex items-center gap-1">
            <div className={cn("w-3 h-3 rounded-full", sev.bg, "border", sev.border)} />
            <span className="text-[10px] text-[#172030]/60">{sev.value}</span>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-gray-200 border border-gray-300" />
          <span className="text-[10px] text-[#172030]/40">Non renseigné</span>
        </div>
      </div>

      <div className="flex items-center gap-2 p-2.5 bg-white rounded-lg border border-[#E8E4DC] shadow-sm">
        <span className="text-xs font-medium text-[#172030]/70">Résultat automatique :</span>
        {isCritical ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600">
            <AlertOctagon className="h-4 w-4" />
            Business critical — YES
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#172030]/50">
            <Check className="h-4 w-4 text-[#2A5141]" />
            Non critique
          </span>
        )}
      </div>
    </div>
  );
};

// ============================================================
// PROCESS ACCORDION (SANS MTPD)
// ============================================================
const ProcessAccordion = ({ 
  process, 
  index,
  department,
  onProcessClick,
  onLinkClick,
  onEditProcess,
  onDeleteProcess,
  resourceCount,
  canDelete,
  processResources,
}: { 
  process: any;
  index: number;
  department: string;
  onProcessClick: (process: any) => void;
  onLinkClick: (process: any) => void;
  onEditProcess: (id: string) => void;
  onDeleteProcess: (id: string, name: string) => void;
  resourceCount: number;
  canDelete: boolean;
  processResources?: {
    hr: any[];
    equipment: any[];
    apps: any[];
    suppliers: any[];
  };
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const score = computeMaxScoreFromImpacts(process.impacts);
  const criticality = scoreToCriticality(score);
  const code = generateProcessCode(department, index);
  const isCritical = isProcessCritical(process.impacts);

  const criticalityDotColor = {
    "Critique": "bg-[#ef4444]",
    "Majeur": "bg-[#f97316]",
    "Modéré": "bg-[#eab308]",
    "Mineur": "bg-[#22c55e]",
  }[criticality] || "bg-gray-300";

  const hrResources = processResources?.hr || [];
  const equipmentResources = processResources?.equipment || [];
  const appsResources = processResources?.apps || [];
  const suppliersResources = processResources?.suppliers || [];
  
  const hasAnyResource = hrResources.length > 0 || equipmentResources.length > 0 || appsResources.length > 0 || suppliersResources.length > 0;

  return (
    <div className={cn(
      "border rounded-lg overflow-hidden bg-white transition-all shadow-sm hover:shadow-md",
      isCritical ? "border-l-4 border-l-[#ef4444]" : "border-[#E8E4DC]"
    )}>
      <div 
        className="flex items-center gap-2 p-2.5 cursor-pointer hover:bg-[#FAFAF9] transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-[10px] font-mono text-[#172030]/40 bg-[#F8F6F2] px-2 py-0.5 rounded border border-[#E8E4DC] whitespace-nowrap">
            {code}
          </span>
          <span className="font-medium text-sm text-[#172030] truncate">{process.name}</span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="inline-flex items-center gap-1.5 text-xs">
            <span className={cn("w-1.5 h-1.5 rounded-full", criticalityDotColor)} />
            <span className="font-medium text-[#172030]">{criticality}</span>
          </span>
          <span className="text-[10px] text-[#172030]/40 hidden sm:inline">Resp. {process.owner || "—"}</span>
          <span className="text-[10px] text-[#172030]/40 hidden md:inline">RTO {process.rto || 0}h</span>
          <span className="text-[10px] text-[#172030]/40 hidden md:inline">RPO {process.rpo || 0}h</span>
          {resourceCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] bg-[#F8F6F2] px-1.5 py-0.5 rounded border border-[#E8E4DC] text-[#172030]/60">
              <LinkIcon className="h-2.5 w-2.5" />
              {resourceCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-[#172030]/40 hover:text-[#172030] hover:bg-[#F8F6F2] rounded"
            onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
          >
            <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-90")} />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-[10px] text-[#172030]/50 hover:text-[#2A5141] hover:bg-[#F0F5F0] rounded gap-1 transition-colors"
            onClick={(e) => { e.stopPropagation(); onLinkClick(process); }}
            title="Associer une ressource (RH, équipement, app IT, prestataire)"
          >
            <Link2 className="h-3 w-3" />
            <span className="hidden sm:inline">Associer</span>
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-[10px] text-[#172030]/50 hover:text-[#2A5141] hover:bg-[#F0F5F0] rounded gap-1 transition-colors"
            onClick={(e) => { e.stopPropagation(); onProcessClick(process); }}
            title="Voir toutes les ressources associées à ce processus"
          >
            <FolderOpen className="h-3 w-3" />
            <span className="hidden sm:inline">Liaisons</span>
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-[10px] text-[#172030]/50 hover:text-[#2A5141] hover:bg-[#F0F5F0] rounded gap-1 transition-colors"
            onClick={(e) => { e.stopPropagation(); onEditProcess(process.id); }}
            title="Modifier le processus"
          >
            <EditIcon className="h-3 w-3" />
            <span className="hidden sm:inline">Modifier</span>
          </Button>
          
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[10px] text-[#172030]/30 hover:text-red-600 hover:bg-red-50 rounded gap-1 transition-colors"
              onClick={(e) => { e.stopPropagation(); onDeleteProcess(process.id, process.name); }}
              title="Supprimer le processus"
            >
              <TrashIcon className="h-3 w-3" />
              <span className="hidden sm:inline">Supprimer</span>
            </Button>
          )}
        </div>
      </div>
      
      {isOpen && (
        <div className="p-3 border-t border-[#E8E4DC] bg-[#FAFAF9]">
          <ImpactMatrix
            impacts={process.impacts}
            isCritical={isCritical}
            rto={process.rto}
            rpo={process.rpo}
          />

          <div className="mt-4 pt-4 border-t border-[#E8E4DC]">
            <div className="flex items-center gap-2 mb-3">
              <LinkIcon className="h-4 w-4 text-[#2A5141]" />
              <span className="text-sm font-medium text-[#172030]">Ressources associées à ce processus</span>
              <Badge variant="outline" className="text-[10px] bg-[#F8F6F2] border-[#E8E4DC] text-[#172030]/60">
                {hrResources.length + equipmentResources.length + appsResources.length + suppliersResources.length} total
              </Badge>
            </div>

            {!hasAnyResource ? (
              <p className="text-sm text-[#172030]/40 italic">Aucune ressource associée à ce processus</p>
            ) : (
              <div className="space-y-3">
                {hrResources.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Users className="h-3.5 w-3.5 text-blue-600" />
                      <span className="text-xs font-medium text-[#172030]">Ressources humaines</span>
                      <Badge variant="outline" className="text-[9px] bg-[#F8F6F2] border-[#E8E4DC]">
                        {hrResources.length}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {hrResources.map((r, i) => (
                        <Badge key={r.id || i} className="bg-gray-50 border-[#E8E4DC] text-[#172030] font-normal text-xs hover:bg-gray-100">
                          {r.name} {r.role && `(${r.role})`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {equipmentResources.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Monitor className="h-3.5 w-3.5 text-yellow-600" />
                      <span className="text-xs font-medium text-[#172030]">Équipements</span>
                      <Badge variant="outline" className="text-[9px] bg-[#F8F6F2] border-[#E8E4DC]">
                        {equipmentResources.length}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {equipmentResources.map((eq, i) => (
                        <Badge key={eq.id || i} className="bg-gray-50 border-[#E8E4DC] text-[#172030] font-normal text-xs hover:bg-gray-100">
                          {eq.name} {eq.type && `(${eq.type})`}
                          {eq._linkRto !== undefined && (
                            <span className="ml-1 text-[10px] text-blue-600">RTO {eq._linkRto}h</span>
                          )}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {appsResources.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Server className="h-3.5 w-3.5 text-purple-600" />
                      <span className="text-xs font-medium text-[#172030]">Applications IT</span>
                      <Badge variant="outline" className="text-[9px] bg-[#F8F6F2] border-[#E8E4DC]">
                        {appsResources.length}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {appsResources.map((app, i) => (
                        <Badge key={app.id || i} className="bg-gray-50 border-[#E8E4DC] text-[#172030] font-normal text-xs hover:bg-gray-100">
                          {app.name}
                          {app._linkRto !== undefined && (
                            <span className="ml-1 text-[10px] text-blue-600">RTO {app._linkRto}h</span>
                          )}
                          {app._linkRpo !== undefined && (
                            <span className="ml-1 text-[10px] text-orange-600">RPO {app._linkRpo}h</span>
                          )}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {suppliersResources.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Handshake className="h-3.5 w-3.5 text-orange-600" />
                      <span className="text-xs font-medium text-[#172030]">Prestataires</span>
                      <Badge variant="outline" className="text-[9px] bg-[#F8F6F2] border-[#E8E4DC]">
                        {suppliersResources.length}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {suppliersResources.map((sup, i) => (
                        <Badge key={sup.id || i} className="bg-gray-50 border-[#E8E4DC] text-[#172030] font-normal text-xs hover:bg-gray-100">
                          {sup.name} {sup.service && `(${sup.service})`}
                          {sup._linkRto !== undefined && (
                            <span className="ml-1 text-[10px] text-blue-600">RTO {sup._linkRto}h</span>
                          )}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// COMPOSANT - BIAFicheDetail (SANS MTPD) AVEC GESTION DES LIENS ET MISE À JOUR EN TEMPS RÉEL
// ============================================================
const BIAFicheDetail = ({
  service,
  processes,
  onBack,
  onEdit,
  onDelete,
  canDelete,
  entities,
  onNavigateToCMDB,
}: {
  service: ServiceBIA;
  processes: any[];
  onBack: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  canDelete: boolean;
  entities: any[];
  onNavigateToCMDB?: () => void;
}) => {
  const [activeTab, setActiveTab] = useState("impact");

  const [addedHR, setAddedHR] = useState<any[]>([]);
  const [addedEquipment, setAddedEquipment] = useState<any[]>([]);
  const [addedApps, setAddedApps] = useState<any[]>([]);
  const [addedSuppliers, setAddedSuppliers] = useState<any[]>([]);

  const [linkedProcessesMap, setLinkedProcessesMap] = useState<{
    hr: Record<string, any[]>;
    equipment: Record<string, any[]>;
    apps: Record<string, any[]>;
    suppliers: Record<string, any[]>;
  }>({
    hr: {},
    equipment: {},
    apps: {},
    suppliers: {}
  });

  const [showSelectHR, setShowSelectHR] = useState(false);
  const [showSelectEquipment, setShowSelectEquipment] = useState(false);
  const [showSelectApp, setShowSelectApp] = useState(false);
  const [showSelectSupplier, setShowSelectSupplier] = useState(false);
  
  const [showAddHR, setShowAddHR] = useState(false);
  const [showAddEquipment, setShowAddEquipment] = useState(false);
  const [showAddApp, setShowAddApp] = useState(false);
  const [showAddSupplier, setShowAddSupplier] = useState(false);

  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkProcess, setLinkProcess] = useState<any>(null);
  const [linkResourceType, setLinkResourceType] = useState<string>("HR");

  const [allHR, setAllHR] = useState<any[]>([]);
  const [allEquipment, setAllEquipment] = useState<any[]>([]);
  const [allApps, setAllApps] = useState<any[]>([]);
  const [allSuppliers, setAllSuppliers] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [selectedProcessDetail, setSelectedProcessDetail] = useState<any>(null);
  const [processResourcesCache, setProcessResourcesCache] = useState<Record<string, any>>({});

  // États pour le dialogue de gestion des liens
  const [linkManagementOpen, setLinkManagementOpen] = useState(false);
  const [linkManagementResourceId, setLinkManagementResourceId] = useState<string>("");
  const [linkManagementResourceName, setLinkManagementResourceName] = useState<string>("");
  const [linkManagementResourceType, setLinkManagementResourceType] = useState<string>("HR");
  const [linkManagementLinkedProcesses, setLinkManagementLinkedProcesses] = useState<any[]>([]);
  
  // Récupérer les processus du département
  const departmentProcesses = useMemo(() => {
    return processes.filter(p => p.entityId === service.id || p.department === service.name);
  }, [processes, service]);

  const loadBIAResources = useCallback(async () => {
    try {
      const { data: hrBiaLinks } = await supabase
        .from('bia_ressources_humaines')
        .select('ressource_humaine_id')
        .eq('service_id', service.id);

      if (hrBiaLinks && hrBiaLinks.length > 0) {
        const hrIds = hrBiaLinks.map((l: any) => l.ressource_humaine_id);
        const { data: hrData } = await supabase
          .from('ressources_humaines')
          .select('*')
          .in('id', hrIds);
        if (hrData) setAddedHR(hrData);
      } else {
        setAddedHR([]);
      }

      const { data: equipBiaLinks } = await supabase
        .from('bia_equipements')
        .select('equipement_id')
        .eq('service_id', service.id);

      if (equipBiaLinks && equipBiaLinks.length > 0) {
        const equipIds = equipBiaLinks.map((l: any) => l.equipement_id);
        const { data: equipData } = await supabase
          .from('ressources_equipements')
          .select('*')
          .in('id', equipIds);
        if (equipData) setAddedEquipment(equipData);
      } else {
        setAddedEquipment([]);
      }

      const { data: appBiaLinks } = await supabase
        .from('bia_applications')
        .select('application_id')
        .eq('service_id', service.id);

      if (appBiaLinks && appBiaLinks.length > 0) {
        const appIds = appBiaLinks.map((l: any) => l.application_id);
        const { data: appData } = await supabase
          .from('applications_it')
          .select('*')
          .in('id', appIds);
        if (appData) setAddedApps(appData);
      } else {
        setAddedApps([]);
      }

      const { data: suppBiaLinks } = await supabase
        .from('bia_fournisseurs')
        .select('fournisseur_id')
        .eq('service_id', service.id);

      if (suppBiaLinks && suppBiaLinks.length > 0) {
        const suppIds = suppBiaLinks.map((l: any) => l.fournisseur_id);
        const { data: suppData } = await supabase
          .from('fournisseurs')
          .select('*')
          .in('id', suppIds);
        if (suppData) setAddedSuppliers(suppData);
      } else {
        setAddedSuppliers([]);
      }

    } catch (error) {
      console.error('Erreur chargement ressources BIA:', error);
    }
  }, [service.id]);

  const addResourceToBIA = async (type: string, resourceId: string) => {
    try {
      let table = '';
      let idColumn = '';
      let data: any = { service_id: service.id };

      switch(type) {
        case 'HR':
          table = 'bia_ressources_humaines';
          idColumn = 'ressource_humaine_id';
          data[idColumn] = resourceId;
          if (addedHR.some(r => r.id === resourceId)) {
            toast({ title: "Info", description: "Cette ressource est déjà dans la fiche BIA" });
            return;
          }
          break;
        case 'Equipement':
          table = 'bia_equipements';
          idColumn = 'equipement_id';
          data[idColumn] = resourceId;
          if (addedEquipment.some(r => r.id === resourceId)) {
            toast({ title: "Info", description: "Cette ressource est déjà dans la fiche BIA" });
            return;
          }
          break;
        case 'App':
          table = 'bia_applications';
          idColumn = 'application_id';
          data[idColumn] = resourceId;
          if (addedApps.some(r => r.id === resourceId)) {
            toast({ title: "Info", description: "Cette ressource est déjà dans la fiche BIA" });
            return;
          }
          break;
        case 'Fournisseur':
          table = 'bia_fournisseurs';
          idColumn = 'fournisseur_id';
          data[idColumn] = resourceId;
          if (addedSuppliers.some(r => r.id === resourceId)) {
            toast({ title: "Info", description: "Cette ressource est déjà dans la fiche BIA" });
            return;
          }
          break;
        default: return;
      }

      const { error } = await supabase.from(table).insert(data);
      if (error) throw error;

      await loadBIAResources();
      
      const resource = allHR.find(r => r.id === resourceId) || 
                       allEquipment.find(r => r.id === resourceId) ||
                       allApps.find(r => r.id === resourceId) ||
                       allSuppliers.find(r => r.id === resourceId);
      
      toast({ 
        title: "Succès", 
        description: `"${resource?.name || 'Ressource'}" ajouté à la fiche BIA` 
      });

    } catch (error: any) {
      console.error('Erreur ajout ressource BIA:', error);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  const addMultipleResourcesToBIA = async (type: string, resourceIds: string[]) => {
    let successCount = 0;
    let errorCount = 0;
    
    for (const id of resourceIds) {
      try {
        await addResourceToBIA(type, id);
        successCount++;
      } catch (error) {
        errorCount++;
      }
    }
    
    if (successCount > 0) {
      toast({ 
        title: "Succès", 
        description: `${successCount} ressource${successCount > 1 ? 's' : ''} ajoutée${successCount > 1 ? 's' : ''} à la fiche BIA` 
      });
    }
    if (errorCount > 0) {
      toast({ 
        title: "Attention", 
        description: `${errorCount} ressource${errorCount > 1 ? 's' : ''} n'a${errorCount > 1 ? 'ont' : ''} pas pu être ajoutée`, 
        variant: "destructive" 
      });
    }
  };

  const removeResourceFromBIA = async (type: string, resourceId: string, resourceName: string) => {
    if (!confirm(`Retirer "${resourceName}" de la fiche BIA ?`)) return;

    try {
      let table = '';
      let idColumn = '';

      switch(type) {
        case 'HR':
          table = 'bia_ressources_humaines';
          idColumn = 'ressource_humaine_id';
          break;
        case 'Equipement':
          table = 'bia_equipements';
          idColumn = 'equipement_id';
          break;
        case 'App':
          table = 'bia_applications';
          idColumn = 'application_id';
          break;
        case 'Fournisseur':
          table = 'bia_fournisseurs';
          idColumn = 'fournisseur_id';
          break;
        default: return;
      }

      const { error } = await supabase
        .from(table)
        .delete()
        .eq('service_id', service.id)
        .eq(idColumn, resourceId);

      if (error) throw error;

      await loadBIAResources();
      toast({ title: "Succès", description: `"${resourceName}" retiré de la fiche BIA` });

    } catch (error: any) {
      console.error('Erreur retrait ressource:', error);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  const loadCMDBResources = useCallback(async () => {
    try {
      const { data: hrData } = await supabase.from('ressources_humaines').select('*');
      if (hrData) setAllHR(hrData);

      const { data: equipData } = await supabase.from('ressources_equipements').select('*');
      if (equipData) setAllEquipment(equipData);

      const { data: appData } = await supabase.from('applications_it').select('*');
      if (appData) setAllApps(appData);

      const { data: suppData } = await supabase.from('fournisseurs').select('*');
      if (suppData) setAllSuppliers(suppData);

    } catch (error) {
      console.error('Erreur chargement CMDB:', error);
    }
  }, []);

  const loadLinkedProcessesForResources = useCallback(async () => {
    try {
      const newLinkedMap = {
        hr: {} as Record<string, any[]>,
        equipment: {} as Record<string, any[]>,
        apps: {} as Record<string, any[]>,
        suppliers: {} as Record<string, any[]>
      };

      for (const p of departmentProcesses) {
        const { data: hrLinks } = await supabase
          .from('processus_ressources_humaines')
          .select('ressource_humaine_id')
          .eq('processus_id', p.id);
        
        if (hrLinks) {
          for (const link of hrLinks) {
            const id = link.ressource_humaine_id;
            if (!newLinkedMap.hr[id]) newLinkedMap.hr[id] = [];
            if (!newLinkedMap.hr[id].some((x: any) => x.id === p.id)) {
              newLinkedMap.hr[id].push({ id: p.id, name: p.name });
            }
          }
        }

        const { data: equipLinks } = await supabase
          .from('processus_equipements')
          .select('equipement_id')
          .eq('processus_id', p.id);
        
        if (equipLinks) {
          for (const link of equipLinks) {
            const id = link.equipement_id;
            if (!newLinkedMap.equipment[id]) newLinkedMap.equipment[id] = [];
            if (!newLinkedMap.equipment[id].some((x: any) => x.id === p.id)) {
              newLinkedMap.equipment[id].push({ id: p.id, name: p.name });
            }
          }
        }

        const { data: appLinks } = await supabase
          .from('processus_applications')
          .select('application_id')
          .eq('processus_id', p.id);
        
        if (appLinks) {
          for (const link of appLinks) {
            const id = link.application_id;
            if (!newLinkedMap.apps[id]) newLinkedMap.apps[id] = [];
            if (!newLinkedMap.apps[id].some((x: any) => x.id === p.id)) {
              newLinkedMap.apps[id].push({ id: p.id, name: p.name });
            }
          }
        }

        const { data: suppLinks } = await supabase
          .from('processus_fournisseurs')
          .select('fournisseur_id')
          .eq('processus_id', p.id);
        
        if (suppLinks) {
          for (const link of suppLinks) {
            const id = link.fournisseur_id;
            if (!newLinkedMap.suppliers[id]) newLinkedMap.suppliers[id] = [];
            if (!newLinkedMap.suppliers[id].some((x: any) => x.id === p.id)) {
              newLinkedMap.suppliers[id].push({ id: p.id, name: p.name });
            }
          }
        }
      }

      setLinkedProcessesMap(newLinkedMap);
    } catch (error) {
      console.error('Erreur chargement liens:', error);
    }
  }, [departmentProcesses]);

  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true);
      await loadCMDBResources();
      await loadBIAResources();
      await loadLinkedProcessesForResources();
      setIsLoading(false);
    };
    loadAll();
  }, [loadCMDBResources, loadBIAResources, loadLinkedProcessesForResources]);

  const handleAddToCMDB = async (type: string, newResource: any) => {
    await loadCMDBResources();
    await addResourceToBIA(type, newResource.id);
  };

  // ============================================================
  // FONCTIONS DE GESTION DES LIENS AVEC RTO/RPO ET MISE À JOUR EN TEMPS RÉEL
  // ============================================================
  const handleLinkProcessToResource = async (
    resourceType: string, 
    resourceId: string, 
    processId: string,
    rtoHours?: number,
    rpoHours?: number
  ) => {
    try {
      let table = '';
      let idColumn = '';
      let data: any = { processus_id: processId };

      switch(resourceType) {
        case 'HR':
          table = 'processus_ressources_humaines';
          idColumn = 'ressource_humaine_id';
          data[idColumn] = resourceId;
          break;
        case 'Equipement':
          table = 'processus_equipements';
          idColumn = 'equipement_id';
          data[idColumn] = resourceId;
          if (rtoHours !== undefined) data.rto_hours = rtoHours;
          break;
        case 'App':
          table = 'processus_applications';
          idColumn = 'application_id';
          data[idColumn] = resourceId;
          if (rtoHours !== undefined) data.rto_hours = rtoHours;
          if (rpoHours !== undefined) data.rpo_hours = rpoHours;
          break;
        case 'Fournisseur':
          table = 'processus_fournisseurs';
          idColumn = 'fournisseur_id';
          data[idColumn] = resourceId;
          if (rtoHours !== undefined) data.rto_hours = rtoHours;
          break;
        default: return;
      }

      const { error } = await supabase.from(table).insert(data);
      if (error) throw error;

      toast({ 
        title: "Succès", 
        description: `Ressource liée au processus avec RTO${rtoHours ? ` ${rtoHours}h` : ''}${rpoHours ? ` et RPO ${rpoHours}h` : ''}` 
      });
      
      // 🔄 MISE À JOUR EN TEMPS RÉEL
      await loadLinkedProcessesForResources();
      
      // 🔄 Recharger les ressources du processus concerné
      await getProcessResources(processId);
      
      // 🔄 Précharger tous les processus pour mettre à jour le cache
      await preloadAllProcesses();
      
    } catch (error: any) {
      console.error('Erreur liaison:', error);
      toast({ title: "Erreur", description: error.message || "Erreur lors de la liaison", variant: "destructive" });
    }
  };

  const handleUnlinkProcessFromResource = async (resourceType: string, resourceId: string, processId: string) => {
    try {
      let table = '';
      let idColumn = '';

      switch(resourceType) {
        case 'HR':
          table = 'processus_ressources_humaines';
          idColumn = 'ressource_humaine_id';
          break;
        case 'Equipement':
          table = 'processus_equipements';
          idColumn = 'equipement_id';
          break;
        case 'App':
          table = 'processus_applications';
          idColumn = 'application_id';
          break;
        case 'Fournisseur':
          table = 'processus_fournisseurs';
          idColumn = 'fournisseur_id';
          break;
        default: return;
      }

      const { error } = await supabase
        .from(table)
        .delete()
        .eq('processus_id', processId)
        .eq(idColumn, resourceId);

      if (error) throw error;

      toast({ title: "Succès", description: "Ressource dissociée du processus" });
      
      // 🔄 MISE À JOUR EN TEMPS RÉEL
      await loadLinkedProcessesForResources();
      
      // 🔄 Recharger les ressources du processus concerné
      await getProcessResources(processId);
      
      // 🔄 Précharger tous les processus pour mettre à jour le cache
      await preloadAllProcesses();
      
    } catch (error: any) {
      console.error('Erreur dissociation:', error);
      toast({ title: "Erreur", description: error.message || "Erreur lors de la dissociation", variant: "destructive" });
    }
  };

  const openLinkManagement = (resourceType: string, resourceId: string, resourceName: string) => {
    setLinkManagementResourceType(resourceType);
    setLinkManagementResourceId(resourceId);
    setLinkManagementResourceName(resourceName);
    
    // Précharger les processus liés pour le dialogue
    const loadLinkedForDialog = async () => {
      let table = '';
      let idColumn = '';
      let selectFields = 'processus_id';
      if (resourceType !== 'HR') {
        selectFields = 'processus_id, rto_hours, rpo_hours';
      }

      switch(resourceType) {
        case 'HR':
          table = 'processus_ressources_humaines';
          idColumn = 'ressource_humaine_id';
          break;
        case 'Equipement':
          table = 'processus_equipements';
          idColumn = 'equipement_id';
          break;
        case 'App':
          table = 'processus_applications';
          idColumn = 'application_id';
          break;
        case 'Fournisseur':
          table = 'processus_fournisseurs';
          idColumn = 'fournisseur_id';
          break;
        default: return;
      }

      const { data } = await supabase
        .from(table)
        .select(selectFields)
        .eq(idColumn, resourceId);

      if (data) {
        const linkedIds = data.map((d: any) => d.processus_id);
        const linked = departmentProcesses
          .filter(p => linkedIds.includes(p.id))
          .map(p => {
            const linkData = (data as any[]).find((d: any) => d.processus_id === p.id);
            return {
              ...p,
              _linkRto: linkData?.rto_hours || 4,
              _linkRpo: linkData?.rpo_hours || 2,
            };
          });
        setLinkManagementLinkedProcesses(linked);
      }
    };
    
    loadLinkedForDialog();
    setLinkManagementOpen(true);
  };

  const getProcessResources = useCallback(async (processId: string) => {
    console.log('🔍 getProcessResources pour:', processId);
    
    const result = {
      hr: [] as any[],
      equipment: [] as any[],
      apps: [] as any[],
      suppliers: [] as any[]
    };

    const { data: hrLinks } = await supabase
      .from('processus_ressources_humaines')
      .select('ressource_humaine_id')
      .eq('processus_id', processId);
    
    if (hrLinks && hrLinks.length > 0) {
      const ids = hrLinks.map((l: any) => l.ressource_humaine_id);
      const filteredIds = ids.filter(id => addedHR.some(r => r.id === id));
      if (filteredIds.length > 0) {
        const { data } = await supabase.from('ressources_humaines').select('*').in('id', filteredIds);
        if (data) result.hr = data;
      }
    }

    const { data: equipLinks } = await supabase
      .from('processus_equipements')
      .select('equipement_id, rto_hours')
      .eq('processus_id', processId);
    
    if (equipLinks && equipLinks.length > 0) {
      const ids = equipLinks.map((l: any) => l.equipement_id);
      const filteredIds = ids.filter(id => addedEquipment.some(r => r.id === id));
      if (filteredIds.length > 0) {
        const { data } = await supabase.from('ressources_equipements').select('*').in('id', filteredIds);
        if (data) {
          result.equipment = data.map(eq => {
            const link = equipLinks.find((l: any) => l.equipement_id === eq.id);
            return { ...eq, _linkRto: link?.rto_hours || 4 };
          });
        }
      }
    }

    const { data: appLinks } = await supabase
      .from('processus_applications')
      .select('application_id, rto_hours, rpo_hours')
      .eq('processus_id', processId);
    
    if (appLinks && appLinks.length > 0) {
      const ids = appLinks.map((l: any) => l.application_id);
      const filteredIds = ids.filter(id => addedApps.some(r => r.id === id));
      if (filteredIds.length > 0) {
        const { data } = await supabase.from('applications_it').select('*').in('id', filteredIds);
        if (data) {
          result.apps = data.map(app => {
            const link = appLinks.find((l: any) => l.application_id === app.id);
            return { ...app, _linkRto: link?.rto_hours || 4, _linkRpo: link?.rpo_hours || 2 };
          });
        }
      }
    }

    const { data: suppLinks } = await supabase
      .from('processus_fournisseurs')
      .select('fournisseur_id, rto_hours')
      .eq('processus_id', processId);
    
    if (suppLinks && suppLinks.length > 0) {
      const ids = suppLinks.map((l: any) => l.fournisseur_id);
      const filteredIds = ids.filter(id => addedSuppliers.some(r => r.id === id));
      if (filteredIds.length > 0) {
        const { data } = await supabase.from('fournisseurs').select('*').in('id', filteredIds);
        if (data) {
          result.suppliers = data.map(sup => {
            const link = suppLinks.find((l: any) => l.fournisseur_id === sup.id);
            return { ...sup, _linkRto: link?.rto_hours || 4 };
          });
        }
      }
    }

    setProcessResourcesCache(prev => ({ ...prev, [processId]: result }));
    return result;
  }, [addedHR, addedEquipment, addedApps, addedSuppliers]);

  const preloadAllProcesses = useCallback(async () => {
    if (departmentProcesses.length === 0) return;
    console.log('🔄 Préchargement de tous les processus...');
    const promises = departmentProcesses.map(p => getProcessResources(p.id));
    await Promise.all(promises);
    console.log('✅ Préchargement terminé');
  }, [departmentProcesses, getProcessResources]);

  useEffect(() => {
    if (!isLoading) {
      preloadAllProcesses();
    }
  }, [isLoading, preloadAllProcesses]);

  const linkResourceToProcess = async (type: string, resourceId: string, rtoHours?: number, rpoHours?: number) => {
    if (!linkProcess) return;

    let isInBIA = false;
    switch(type) {
      case 'HR': isInBIA = addedHR.some(r => r.id === resourceId); break;
      case 'Equipement': isInBIA = addedEquipment.some(r => r.id === resourceId); break;
      case 'App': isInBIA = addedApps.some(r => r.id === resourceId); break;
      case 'Fournisseur': isInBIA = addedSuppliers.some(r => r.id === resourceId); break;
    }

    if (!isInBIA) {
      toast({ 
        title: "Erreur", 
        description: "Cette ressource n'est pas dans la fiche BIA. Ajoutez-la d'abord via l'onglet 'Ressources requises'.",
        variant: "destructive" 
      });
      return;
    }

    try {
      let table = '';
      let idColumn = '';
      let data: any = { processus_id: linkProcess.id };
      
      switch(type) {
        case 'HR':
          table = 'processus_ressources_humaines';
          idColumn = 'ressource_humaine_id';
          data[idColumn] = resourceId;
          break;
        case 'Equipement':
          table = 'processus_equipements';
          idColumn = 'equipement_id';
          data[idColumn] = resourceId;
          if (rtoHours !== undefined) data.rto_hours = rtoHours;
          break;
        case 'App':
          table = 'processus_applications';
          idColumn = 'application_id';
          data[idColumn] = resourceId;
          if (rtoHours !== undefined) data.rto_hours = rtoHours;
          if (rpoHours !== undefined) data.rpo_hours = rpoHours;
          break;
        case 'Fournisseur':
          table = 'processus_fournisseurs';
          idColumn = 'fournisseur_id';
          data[idColumn] = resourceId;
          if (rtoHours !== undefined) data.rto_hours = rtoHours;
          break;
        default: return;
      }

      const { data: existing } = await supabase
        .from(table)
        .select('*')
        .eq('processus_id', linkProcess.id)
        .eq(idColumn, resourceId);

      if (existing && existing.length > 0) {
        toast({ title: "Info", description: "Cette ressource est déjà liée à ce processus" });
        return;
      }

      const { error } = await supabase.from(table).insert(data);
      if (error) throw error;

      toast({ title: "Succès", description: `Ressource liée au processus "${linkProcess.name}"` });
      
      // 🔄 MISE À JOUR EN TEMPS RÉEL
      await loadLinkedProcessesForResources();
      await getProcessResources(linkProcess.id);
      await preloadAllProcesses();

    } catch (error: any) {
      console.error('Erreur liaison:', error);
      toast({ title: "Erreur", description: error.message || "Erreur lors de la liaison", variant: "destructive" });
    }
  };

  const handleProcessClick = (process: any) => {
    getProcessResources(process.id).then(() => {
      setSelectedProcessDetail(process);
    });
  };

  const handleLinkClick = (process: any) => {
    setLinkProcess(process);
    setLinkResourceType("HR");
    setLinkDialogOpen(true);
  };

  const handleDeleteProcess = (id: string, name: string) => {
    if (confirm(`⚠️ Voulez-vous vraiment supprimer le processus "${name}" ?`)) {
      onDelete(id, name);
    }
  };

  const getTotalResourceCount = (process: any) => {
    const cached = processResourcesCache[process.id];
    if (!cached) return 0;
    return cached.hr.length + cached.equipment.length + cached.apps.length + cached.suppliers.length;
  };

  return (
    <div className="space-y-4">
      <SelectFromCMDBDialog
        open={showSelectHR}
        onOpenChange={setShowSelectHR}
        resourceType="HR"
        allResources={allHR}
        addedResourceIds={addedHR.map(r => r.id)}
        onSelect={(ids) => addMultipleResourcesToBIA('HR', ids)}
        onAddToCMDB={() => { setShowSelectHR(false); setShowAddHR(true); }}
        title="Ajouter des collaborateurs"
        description="Sélectionnez un ou plusieurs collaborateurs depuis le référentiel pour les ajouter à la fiche BIA"
      />

      <SelectFromCMDBDialog
        open={showSelectEquipment}
        onOpenChange={setShowSelectEquipment}
        resourceType="Equipement"
        allResources={allEquipment}
        addedResourceIds={addedEquipment.map(r => r.id)}
        onSelect={(ids) => addMultipleResourcesToBIA('Equipement', ids)}
        onAddToCMDB={() => { setShowSelectEquipment(false); setShowAddEquipment(true); }}
        title="Ajouter des équipements"
        description="Sélectionnez un ou plusieurs équipements depuis le référentiel pour les ajouter à la fiche BIA"
      />

      <SelectFromCMDBDialog
        open={showSelectApp}
        onOpenChange={setShowSelectApp}
        resourceType="App"
        allResources={allApps}
        addedResourceIds={addedApps.map(r => r.id)}
        onSelect={(ids) => addMultipleResourcesToBIA('App', ids)}
        onAddToCMDB={() => { setShowSelectApp(false); setShowAddApp(true); }}
        title="Ajouter des applications"
        description="Sélectionnez une ou plusieurs applications depuis le référentiel pour les ajouter à la fiche BIA"
      />

      <SelectFromCMDBDialog
        open={showSelectSupplier}
        onOpenChange={setShowSelectSupplier}
        resourceType="Fournisseur"
        allResources={allSuppliers}
        addedResourceIds={addedSuppliers.map(r => r.id)}
        onSelect={(ids) => addMultipleResourcesToBIA('Fournisseur', ids)}
        onAddToCMDB={() => { setShowSelectSupplier(false); setShowAddSupplier(true); }}
        title="Ajouter des prestataires"
        description="Sélectionnez un ou plusieurs prestataires depuis le référentiel pour les ajouter à la fiche BIA"
      />

      <AddToCMDBDialog
        open={showAddHR}
        onOpenChange={setShowAddHR}
        resourceType="HR"
        onAdd={(data) => handleAddToCMDB('HR', data)}
        departmentId={service.id}
      />

      <AddToCMDBDialog
        open={showAddEquipment}
        onOpenChange={setShowAddEquipment}
        resourceType="Equipement"
        onAdd={(data) => handleAddToCMDB('Equipement', data)}
        departmentId={service.id}
      />

      <AddToCMDBDialog
        open={showAddApp}
        onOpenChange={setShowAddApp}
        resourceType="App"
        onAdd={(data) => handleAddToCMDB('App', data)}
        departmentId={service.id}
      />

      <AddToCMDBDialog
        open={showAddSupplier}
        onOpenChange={setShowAddSupplier}
        resourceType="Fournisseur"
        onAdd={(data) => handleAddToCMDB('Fournisseur', data)}
        departmentId={service.id}
      />

      {/* Dialogue de gestion des liens avec RTO/RPO */}
      <LinkProcessDialog
        open={linkManagementOpen}
        onOpenChange={setLinkManagementOpen}
        resourceType={linkManagementResourceType}
        resourceId={linkManagementResourceId}
        resourceName={linkManagementResourceName}
        linkedProcesses={linkManagementLinkedProcesses}
        departmentProcesses={departmentProcesses}
        onLink={(processId, rtoHours, rpoHours) => 
          handleLinkProcessToResource(linkManagementResourceType, linkManagementResourceId, processId, rtoHours, rpoHours)
        }
        onUnlink={(processId) => 
          handleUnlinkProcessFromResource(linkManagementResourceType, linkManagementResourceId, processId)
        }
      />

      <LinkResourceDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        process={linkProcess}
        addedResources={{
          hr: addedHR,
          equipment: addedEquipment,
          apps: addedApps,
          suppliers: addedSuppliers
        }}
        onLink={linkResourceToProcess}
        resourceType={linkResourceType}
        setResourceType={setLinkResourceType}
        onNavigateToCMDB={onNavigateToCMDB}
      />

      {selectedProcessDetail && (
        <ProcessDetailView
          process={selectedProcessDetail}
          allProcesses={processes}
          onClose={() => setSelectedProcessDetail(null)}
          onEditProcess={onEdit}
          serviceId={service.id}
          onResourceUnlinked={() => {
            getProcessResources(selectedProcessDetail.id);
            preloadAllProcesses();
          }}
        />
      )}

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
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Domaine métier</p>
          <p className="font-medium">{entities.find(e => e.id === service.id)?.name || "—"}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Responsable domaine</p>
          <p className="font-medium">{service.owner}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Date d'évaluation</p>
          <p className="font-medium">{new Date().toLocaleDateString('fr-FR')}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Statut</p>
          <p className="font-medium text-green-600">✅ En cours</p>
        </div>
      </div>

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

        <TabsContent value="impact" className="pt-4">
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm text-indigo-800 mb-4 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              Pour chaque type d'impact, indiquez la gravité selon le délai écoulé depuis l'incident. Un processus est <strong>critique</strong> dès qu'un impact « sévère » ou « très sévère » apparaît dans les 120 premières heures.
              <span className="block text-xs text-indigo-600 mt-1">
                🔗 Cliquez sur l'icône lien pour associer une ressource à un processus.
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {departmentProcesses.map((p, idx) => {
              const count = getTotalResourceCount(p);
              const resources = processResourcesCache[p.id];
              return (
                <ProcessAccordion
                  key={p.id}
                  process={p}
                  index={idx}
                  department={service.name}
                  onProcessClick={handleProcessClick}
                  onLinkClick={handleLinkClick}
                  onEditProcess={onEdit}
                  onDeleteProcess={handleDeleteProcess}
                  resourceCount={count}
                  canDelete={canDelete}
                  processResources={resources}
                />
              );
            })}
          </div>

          <Button 
            variant="outline" 
            className="w-full mt-4 border-dashed text-gray-400 hover:text-gray-600"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('openBiaWizard', { detail: { departmentId: service.id } }));
            }}
          >
            <Plus className="h-4 w-4 mr-2" /> Ajouter un processus
          </Button>
        </TabsContent>

        <TabsContent value="resources" className="pt-4">
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm text-indigo-800 mb-4 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>Ressources minimales pour maintenir les processus critiques dans la première semaine après un sinistre.</div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-1.5 border-[#2A5141] text-[#2A5141] hover:bg-[#F8F6F2]"
              onClick={() => setShowSelectHR(true)}
            >
              <Users className="h-3.5 w-3.5" />
              Ajouter un collaborateur
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-1.5 border-[#2A5141] text-[#2A5141] hover:bg-[#F8F6F2]"
              onClick={() => setShowSelectEquipment(true)}
            >
              <Monitor className="h-3.5 w-3.5" />
              Ajouter un équipement
            </Button>
          </div>

          <div className="border rounded-xl overflow-hidden bg-white mb-4">
            <div className="flex items-center gap-3 px-4 py-3 bg-[#F8F6F2] border-b border-[#E8E4DC]">
              <Users className="h-4 w-4 text-[#2A5141]" />
              <h4 className="font-medium text-[#172030] flex-1 text-sm">Collaborateurs clés</h4>
              <span className="text-xs text-[#172030]/40">{addedHR.length} collaborateur{addedHR.length > 1 ? 's' : ''}</span>
            </div>
            <div className="p-4">
              {addedHR.length > 0 ? (
                <PersonnelTableau 
                  people={addedHR} 
                  onDelete={(id, name) => removeResourceFromBIA('HR', id, name)}
                  linkedProcessesMap={linkedProcessesMap.hr}
                  onManageLinks={(id, name) => openLinkManagement('HR', id, name)}
                />
              ) : (
                <div className="text-center py-6 text-[#172030]/40 text-sm">
                  Aucun collaborateur ajouté. Cliquez sur "Ajouter un collaborateur" pour en sélectionner depuis le référentiel.
                </div>
              )}
            </div>
          </div>

          <div className="border rounded-xl overflow-hidden bg-white mb-4">
            <div className="flex items-center gap-3 px-4 py-3 bg-[#F8F6F2] border-b border-[#E8E4DC]">
              <Package className="h-4 w-4 text-[#2A5141]" />
              <h4 className="font-medium text-[#172030] flex-1 text-sm">Équipements & infrastructure</h4>
              <span className="text-xs text-[#172030]/40">{addedEquipment.length} équipement{addedEquipment.length > 1 ? 's' : ''}</span>
            </div>
            <div className="p-4">
              {addedEquipment.length > 0 ? (
                <EquipmentTableau 
                  equipment={addedEquipment} 
                  onDelete={(id, name) => removeResourceFromBIA('Equipement', id, name)}
                  linkedProcessesMap={linkedProcessesMap.equipment}
                  onManageLinks={(id, name) => openLinkManagement('Equipement', id, name)}
                />
              ) : (
                <div className="text-center py-6 text-[#172030]/40 text-sm">
                  Aucun équipement ajouté. Cliquez sur "Ajouter un équipement" pour en sélectionner depuis le référentiel.
                </div>
              )}
            </div>
          </div>

          <div className="mt-6">
            <TableauDeMonteeEnCharge processes={departmentProcesses} serviceName={service.name} />
          </div>
        </TabsContent>

        <TabsContent value="apps" className="pt-4">
          <div className="bg-[#F8F6F2] border border-[#E8E4DC] rounded-lg p-3 text-sm text-[#172030] mb-4 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-[#2A5141]" />
            <div>
              <span className="font-medium">Applications IT</span> ajoutées à la fiche BIA.
            </div>
          </div>

          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <Server className="h-5 w-5 text-[#172030]" />
              <span className="text-sm font-medium text-[#172030]">Applications IT</span>
              <Badge variant="outline" className="bg-white border-[#E8E4DC] text-[#172030]/60">
                {addedApps.length}
              </Badge>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="text-[#2A5141] border-[#2A5141] hover:bg-[#F8F6F2]"
              onClick={() => setShowSelectApp(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Ajouter une application
            </Button>
          </div>

          {addedApps.length > 0 ? (
            <AppTableau 
              apps={addedApps}
              onDelete={(id, name) => removeResourceFromBIA('App', id, name)}
              linkedProcessesMap={linkedProcessesMap.apps}
              onManageLinks={(id, name) => openLinkManagement('App', id, name)}
            />
          ) : (
            <div className="text-center py-8 text-[#172030]/40">
              <Server className="h-10 w-10 mx-auto text-[#172030]/20" />
              <p className="mt-2">Aucune application ajoutée.</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3 text-[#2A5141] border-[#2A5141]"
                onClick={() => setShowSelectApp(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Ajouter une application
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="suppliers" className="pt-4">
          <div className="bg-[#F8F6F2] border border-[#E8E4DC] rounded-lg p-3 text-sm text-[#172030] mb-4 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-[#2A5141]" />
            <div>
              <span className="font-medium">Prestataires</span> ajoutés à la fiche BIA.
            </div>
          </div>

          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <Handshake className="h-5 w-5 text-[#172030]" />
              <span className="text-sm font-medium text-[#172030]">Prestataires</span>
              <Badge variant="outline" className="bg-white border-[#E8E4DC] text-[#172030]/60">
                {addedSuppliers.length}
              </Badge>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="text-[#2A5141] border-[#2A5141] hover:bg-[#F8F6F2]"
              onClick={() => setShowSelectSupplier(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Ajouter un prestataire
            </Button>
          </div>

          {addedSuppliers.length > 0 ? (
            <SupplierTableau 
              suppliers={addedSuppliers}
              onDelete={(id, name) => removeResourceFromBIA('Fournisseur', id, name)}
              linkedProcessesMap={linkedProcessesMap.suppliers}
              onManageLinks={(id, name) => openLinkManagement('Fournisseur', id, name)}
            />
          ) : (
            <div className="text-center py-8 text-[#172030]/40">
              <Handshake className="h-10 w-10 mx-auto text-[#172030]/20" />
              <p className="mt-2">Aucun prestataire ajouté.</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3 text-[#2A5141] border-[#2A5141]"
                onClick={() => setShowSelectSupplier(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Ajouter un prestataire
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="dependencies" className="pt-4">
          <DependencyMapView 
            processes={departmentProcesses} 
            serviceName={service.name}
            onProcessesUpdate={() => {}}
          />
        </TabsContent>

        <TabsContent value="workarounds" className="pt-4">
          <div className="bg-[#F8F6F2] border border-[#E8E4DC] rounded-lg p-3 text-sm text-[#172030] mb-4 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-[#2A5141]" />
            <div>
              <span className="font-medium">Contournements de crise</span> générés par IA à partir des données du processus.
              Concentrez-vous sur les 24 premières heures. Sélectionnez un processus pour générer des recommandations.
            </div>
          </div>

          <ContournementsDeCriseIA 
            serviceId={service.id} 
            onSave={() => {}} 
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ============================================================
// COMPOSANT PRINCIPAL - ProcessInventory (inchangé)
// ============================================================
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

  const [selectedService, setSelectedService] = useState<ServiceBIA | null>(null);
  const [showBIADetail, setShowBIADetail] = useState(false);

  const [showWizard, setShowWizard] = useState(false);
  const [wizardProcessId, setWizardProcessId] = useState<string | undefined>(undefined);
  const [wizardDepartmentId, setWizardDepartmentId] = useState<string | undefined>(undefined);

  // ============================================================
  // ÉTAT POUR LE COMPTAGE DES RESSOURCES PAR PROCESSUS
  // ============================================================
  const [resourceCountByProcess, setResourceCountByProcess] = useState<Record<string, number>>({});
  const [isLoadingResources, setIsLoadingResources] = useState(true);

  const entityName = (id: string) => entities.find((e) => e.id === id)?.name ?? "—";
  const rootEntities = useMemo(() => entities.filter(e => e.parentId === null), [entities]);
  const getChildren = (parentId: string) => entities.filter(e => e.parentId === parentId);

  const getDepartmentCount = (entityId: string) => getChildren(entityId).length;

  // ============================================================
  // CHARGEMENT DU COMPTE DE RESSOURCES PAR PROCESSUS
  // ============================================================
  useEffect(() => {
    const loadResourceCounts = async () => {
      if (processes.length === 0) {
        setResourceCountByProcess({});
        setIsLoadingResources(false);
        return;
      }

      setIsLoadingResources(true);
      const processIds = processes.map(p => p.id);
      
      try {
        const [
          { data: hrData, error: hrError },
          { data: equipData, error: equipError },
          { data: appData, error: appError },
          { data: suppData, error: suppError }
        ] = await Promise.all([
          supabase.from('processus_ressources_humaines').select('processus_id').in('processus_id', processIds),
          supabase.from('processus_equipements').select('processus_id').in('processus_id', processIds),
          supabase.from('processus_applications').select('processus_id').in('processus_id', processIds),
          supabase.from('processus_fournisseurs').select('processus_id').in('processus_id', processIds)
        ]);

        if (hrError) console.error('Erreur chargement RH:', hrError);
        if (equipError) console.error('Erreur chargement Équipements:', equipError);
        if (appError) console.error('Erreur chargement Applications:', appError);
        if (suppError) console.error('Erreur chargement Prestataires:', suppError);

        const counts: Record<string, number> = {};
        for (const pid of processIds) {
          counts[pid] = 0;
        }

        if (hrData) {
          for (const item of hrData) {
            counts[item.processus_id] = (counts[item.processus_id] || 0) + 1;
          }
        }

        if (equipData) {
          for (const item of equipData) {
            counts[item.processus_id] = (counts[item.processus_id] || 0) + 1;
          }
        }

        if (appData) {
          for (const item of appData) {
            counts[item.processus_id] = (counts[item.processus_id] || 0) + 1;
          }
        }

        if (suppData) {
          for (const item of suppData) {
            counts[item.processus_id] = (counts[item.processus_id] || 0) + 1;
          }
        }

        setResourceCountByProcess(counts);

      } catch (error) {
        console.error('Erreur chargement ressources:', error);
      } finally {
        setIsLoadingResources(false);
      }
    };

    loadResourceCounts();
  }, [processes]);

  const navigateToCMDB = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/cmdb';
    }
  };

  useEffect(() => {
    const handleOpenWizard = (event: CustomEvent) => {
      const { departmentId } = event.detail || {};
      setWizardDepartmentId(departmentId);
      setWizardProcessId(undefined);
      setShowWizard(true);
    };

    window.addEventListener('openBiaWizard', handleOpenWizard as EventListener);
    return () => {
      window.removeEventListener('openBiaWizard', handleOpenWizard as EventListener);
    };
  }, []);

  const buildBIAServices = (entityId: string): ServiceBIA[] => {
    const directions = getChildren(entityId);
    const services: ServiceBIA[] = [];

    for (const dir of directions) {
      const depts = getChildren(dir.id);
      for (const dept of depts) {
        const deptProcesses = processes.filter(p => p.department === dept.name || p.entityId === dept.id);
        
        const criticalCount = deptProcesses.filter(p => {
          const score = computeMaxScoreFromImpacts(p.impacts);
          return score >= 4;
        }).length;
        
        let totalResources = 0;
        for (const p of deptProcesses) {
          totalResources += resourceCountByProcess[p.id] || 0;
        }

        const rate = deptProcesses.length > 0 ? calculateCompletionRate(deptProcesses) : 0;
        const status = getBIAStatus(deptProcesses, dept.lastUpdated);

        services.push({
          id: dept.id,
          name: dept.name,
          owner: deptProcesses.length > 0 ? deptProcesses[0]?.owner || "—" : "—",
          coordinator: "—",
          processCount: deptProcesses.length,
          criticalCount,
          resources: totalResources,
          completionRate: rate,
          status: status as BIAStatus,
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
        s.owner.toLowerCase().includes(q)
      );
    }

    return filtered;
  };

  const getBIAStats = (services: ServiceBIA[]) => {
    const totalServices = services.length;
    const totalProcesses = services.reduce((acc, s) => acc + s.processCount, 0);
    const totalCritical = services.reduce((acc, s) => acc + s.criticalCount, 0);
    const totalResources = services.reduce((acc, s) => acc + s.resources, 0);

    return {
      totalServices,
      totalProcesses,
      totalCritical,
      totalResources,
    };
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`⚠️ Voulez-vous vraiment supprimer le processus "${name}" ?`)) {
      deleteProcess(id);
      toast({ title: "Processus supprimé", description: name });
    }
  };

  const goToRoot = () => {
    setViewLevel("enterprises");
    setSelectedRoot(null);
    setSelectedDirection(null);
    setSelectedDepartment(null);
    setSearchQuery("");
    setSelectedCriticality("all");
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

  const openWizard = (processId?: string, departmentId?: string) => {
    setWizardProcessId(processId);
    setWizardDepartmentId(departmentId);
    setShowWizard(true);
  };

  const handleEditProcess = (id: string) => {
    openWizard(id, selectedDepartment || selectedService?.id || undefined);
  };

  const closeWizard = () => {
    setShowWizard(false);
    setWizardProcessId(undefined);
    setWizardDepartmentId(undefined);
  };

  const handleWizardDone = () => {
    closeWizard();
  };

  if (showWizard) {
    return (
      <Dialog open={showWizard} onOpenChange={closeWizard}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              {wizardProcessId ? "Modifier l'analyse d'impact" : "Nouvelle analyse d'impact métier"}
            </DialogTitle>
          </DialogHeader>
          <BiaWizard
            processId={wizardProcessId}
            initialEntityId={wizardDepartmentId}
            onDone={handleWizardDone}
          />
        </DialogContent>
      </Dialog>
    );
  }

  if (viewLevel === "directions" && selectedRoot && !showBIADetail) {
    const services = buildBIAServices(selectedRoot);
    const filteredServices = getFilteredServices(services);
    const stats = getBIAStats(services);

    const directions = getChildren(selectedRoot);
    const servicesByDirection: Record<string, ServiceBIA[]> = {};
    const departmentIds: Record<string, string> = {};
    
    for (const dir of directions) {
      const depts = getChildren(dir.id);
      const dirServices = filteredServices.filter(s => depts.some(d => d.id === s.id));
      if (dirServices.length > 0) {
        servicesByDirection[dir.name] = dirServices;
        for (const s of dirServices) {
          departmentIds[s.id] = s.id;
        }
      }
    }

    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#172030] flex items-center gap-2" style={{ fontFamily: "Playfair Display, serif" }}>
              <Building2 className="h-7 w-7 text-[#2A5141]" /> Processus &amp; BIA
            </h1>
            <p className="text-[#172030]/60 mt-1 text-sm">
              Sélectionnez un service pour ouvrir sa fiche d'analyse d'impact. Chaque fiche recense les processus critiques, leurs ressources et leurs objectifs de reprise.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-white border-[#E8E4DC] shadow-sm">
            <CardContent className="p-4">
              <p className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider">Services BIA</p>
              <p className="text-3xl font-bold text-[#172030]" style={{ fontFamily: "Playfair Display, serif" }}>
                {stats.totalServices}
              </p>
              <p className="text-xs text-[#172030]/40">services analysés</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-[#E8E4DC] shadow-sm">
            <CardContent className="p-4">
              <p className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider">Processus critiques</p>
              <p className="text-3xl font-bold text-red-600" style={{ fontFamily: "Playfair Display, serif" }}>
                {stats.totalCritical}
              </p>
              <p className="text-xs text-[#172030]/40">sur {stats.totalProcesses} processus</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-[#E8E4DC] shadow-sm">
            <CardContent className="p-4">
              <p className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider">Processus totaux</p>
              <p className="text-3xl font-bold text-[#2A5141]" style={{ fontFamily: "Playfair Display, serif" }}>
                {stats.totalProcesses}
              </p>
              <p className="text-xs text-[#172030]/40">processus identifiés</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-[#E8E4DC] shadow-sm">
            <CardContent className="p-4">
              <p className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider">Ressources totales</p>
              <p className="text-3xl font-bold text-[#172030]" style={{ fontFamily: "Playfair Display, serif" }}>
                {isLoadingResources ? "…" : stats.totalResources}
              </p>
              <p className="text-xs text-[#172030]/40">ressources liées</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#172030]/40" />
            <Input 
              placeholder="Rechercher un service, un responsable..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              className="pl-9 border-[#E8E4DC] focus:border-[#2A5141] focus:ring-[#2A5141]/20" 
            />
          </div>
        </div>

        {Object.keys(servicesByDirection).length === 0 ? (
          <div className="text-center py-12 text-[#172030]/40">
            <Building className="h-12 w-12 mx-auto text-[#172030]/20" />
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
                departmentIds={departmentIds}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (viewLevel === "departments" && selectedDirection && !showBIADetail) {
    const departments = getChildren(selectedDirection);
    const services = buildBIAServices(selectedRoot || "");
    const filteredServices = getFilteredServices(services);
    const stats = getBIAStats(services);

    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#172030] flex items-center gap-2" style={{ fontFamily: "Playfair Display, serif" }}>
              <Building2 className="h-7 w-7 text-[#2A5141]" /> Processus &amp; BIA
            </h1>
            <p className="text-[#172030]/60 mt-1 text-sm">
              Sélectionnez un service pour ouvrir sa fiche d'analyse d'impact.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-white border-[#E8E4DC] shadow-sm">
            <CardContent className="p-4">
              <p className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider">Services BIA</p>
              <p className="text-3xl font-bold text-[#172030]" style={{ fontFamily: "Playfair Display, serif" }}>
                {stats.totalServices}
              </p>
              <p className="text-xs text-[#172030]/40">services analysés</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-[#E8E4DC] shadow-sm">
            <CardContent className="p-4">
              <p className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider">Processus critiques</p>
              <p className="text-3xl font-bold text-red-600" style={{ fontFamily: "Playfair Display, serif" }}>
                {stats.totalCritical}
              </p>
              <p className="text-xs text-[#172030]/40">sur {stats.totalProcesses} processus</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-[#E8E4DC] shadow-sm">
            <CardContent className="p-4">
              <p className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider">Processus totaux</p>
              <p className="text-3xl font-bold text-[#2A5141]" style={{ fontFamily: "Playfair Display, serif" }}>
                {stats.totalProcesses}
              </p>
              <p className="text-xs text-[#172030]/40">processus identifiés</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-[#E8E4DC] shadow-sm">
            <CardContent className="p-4">
              <p className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider">Ressources totales</p>
              <p className="text-3xl font-bold text-[#172030]" style={{ fontFamily: "Playfair Display, serif" }}>
                {isLoadingResources ? "…" : stats.totalResources}
              </p>
              <p className="text-xs text-[#172030]/40">ressources liées</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#172030]/40" />
            <Input 
              placeholder="Rechercher un service, un responsable..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              className="pl-9 border-[#E8E4DC] focus:border-[#2A5141] focus:ring-[#2A5141]/20" 
            />
          </div>
        </div>

        <span className="text-xs text-[#172030]/40 block mb-2">
          {departments.length} services
        </span>

        {departments.length === 0 ? (
          <div className="text-center py-12 text-[#172030]/40">
            <Layers className="h-12 w-12 mx-auto text-[#172030]/20" />
            <p className="mt-4">Aucun département trouvé dans cette direction.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map(dept => {
              const deptProcesses = processes.filter(p => p.department === dept.name || p.entityId === dept.id);
              const status = getBIAStatus(deptProcesses, dept.lastUpdated);
              const isNonDemarre = status === "non_demarre";
              const criticalCount = deptProcesses.filter(p => {
                const score = computeMaxScoreFromImpacts(p.impacts);
                return score >= 4;
              }).length;
              
              let totalResources = 0;
              for (const p of deptProcesses) {
                totalResources += resourceCountByProcess[p.id] || 0;
              }

              const statusConfigs = {
                critique: { label: "Critique", className: "bg-red-100 text-red-700 border-red-200" },
                a_completer: { label: "À compléter", className: "bg-amber-100 text-amber-700 border-amber-200" },
                a_reviser: { label: "À réviser", className: "bg-orange-100 text-orange-700 border-orange-200" },
                complet: { label: "Complet", className: "bg-green-100 text-green-700 border-green-200" },
                non_demarre: { label: "Non démarré", className: "bg-gray-100 text-gray-500 border-gray-200" }
              };
              const statusConfig = statusConfigs[status] || statusConfigs.a_completer;

              return (
                <div
                  key={dept.id}
                  className="bg-white border border-[#E8E4DC] rounded-xl p-5 cursor-pointer hover:shadow-[0_8px_24px_rgba(23,32,48,0.08)] hover:border-[#2A5141]/30 transition-all duration-200"
                  onClick={() => selectDepartment(dept.id)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-[#172030] text-base">{dept.name}</h3>
                      <p className="text-xs text-[#172030]/50 mt-0.5">
                        {deptProcesses.length > 0 ? `👤 ${deptProcesses[0]?.owner || "—"}` : "Aucun responsable défini"}
                      </p>
                    </div>
                    <Badge className={statusConfig.className}>
                      {statusConfig.label}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-3 border-t border-b border-[#E8E4DC] mb-3">
                    <div className="text-center">
                      <div className={cn(
                        "text-lg font-bold font-mono",
                        isNonDemarre ? "text-[#172030]/30" : "text-[#172030]"
                      )}>
                        {deptProcesses.length}
                      </div>
                      <div className="text-[10px] text-[#172030]/40 uppercase tracking-wide">Processus</div>
                    </div>
                    <div className="text-center">
                      <div className={cn(
                        "text-lg font-bold font-mono",
                        criticalCount > 0 ? "text-red-600" : isNonDemarre ? "text-[#172030]/30" : "text-[#172030]"
                      )}>
                        {criticalCount}
                      </div>
                      <div className="text-[10px] text-[#172030]/40 uppercase tracking-wide">Critiques</div>
                    </div>
                    <div className="text-center">
                      <div className={cn(
                        "text-lg font-bold font-mono",
                        isNonDemarre ? "text-[#172030]/30" : "text-[#172030]"
                      )}>
                        {isLoadingResources ? "…" : totalResources}
                      </div>
                      <div className="text-[10px] text-[#172030]/40 uppercase tracking-wide">Ressources</div>
                    </div>
                  </div>

                  {isNonDemarre ? (
                    <Button 
                      size="sm" 
                      className="w-full gap-1 text-xs bg-[#2A5141] hover:bg-[#1a3329] text-white shadow-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.dispatchEvent(new CustomEvent('openBiaWizard', { 
                          detail: { departmentId: dept.id } 
                        }));
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" /> Ajouter un processus
                    </Button>
                  ) : (
                    <span className="text-xs text-[#2A5141] font-medium flex items-center justify-center gap-1">
                      Ouvrir <ChevronRightIcon className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
              );
            })}
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
        onEdit={handleEditProcess}
        onDelete={handleDelete}
        canDelete={can("admin")}
        entities={entities}
        onNavigateToCMDB={navigateToCMDB}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#172030] flex items-center gap-2" style={{ fontFamily: "Playfair Display, serif" }}>
            <Building2 className="h-7 w-7 text-[#2A5141]" /> Inventaire des processus
          </h1>
          <p className="text-[#172030]/60 mt-1 text-sm">
            {viewLevel === "enterprises" && "Sélectionnez une entreprise pour voir ses directions"}
            {viewLevel === "directions" && "Sélectionnez une direction pour voir ses départements"}
            {viewLevel === "departments" && "Sélectionnez un département pour voir ses processus"}
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-6">
        <Card className="bg-white border-[#E8E4DC] shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider">Total</p>
            <p className="text-2xl font-bold text-[#172030]" style={{ fontFamily: "Playfair Display, serif" }}>{processes.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E8E4DC] shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider">Critiques</p>
            <p className="text-2xl font-bold text-red-600" style={{ fontFamily: "Playfair Display, serif" }}>{processes.filter(p => computeMaxScoreFromImpacts(p.impacts) >= 4).length}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E8E4DC] shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider">Majeurs</p>
            <p className="text-2xl font-bold text-orange-600" style={{ fontFamily: "Playfair Display, serif" }}>{processes.filter(p => computeMaxScoreFromImpacts(p.impacts) >= 3 && computeMaxScoreFromImpacts(p.impacts) < 4).length}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E8E4DC] shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider">Modérés</p>
            <p className="text-2xl font-bold text-yellow-600" style={{ fontFamily: "Playfair Display, serif" }}>{processes.filter(p => computeMaxScoreFromImpacts(p.impacts) >= 2 && computeMaxScoreFromImpacts(p.impacts) < 3).length}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E8E4DC] shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider">Mineurs</p>
            <p className="text-2xl font-bold text-green-600" style={{ fontFamily: "Playfair Display, serif" }}>{processes.filter(p => computeMaxScoreFromImpacts(p.impacts) < 2).length}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E8E4DC] shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider">Score moyen</p>
            <p className="text-2xl font-bold text-[#172030]" style={{ fontFamily: "Playfair Display, serif" }}>{processes.length ? (processes.reduce((acc, p) => acc + computeMaxScoreFromImpacts(p.impacts), 0) / processes.length).toFixed(1) : "0"}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-[#E8E4DC] shadow-[0_8px_30px_rgb(0,0,0,0.05)]">
        <CardContent className="p-6">
          {viewLevel === "enterprises" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-[#172030]">🏢 Entreprises</h2>
                <span className="text-sm text-[#172030]/40">{rootEntities.length} entreprise(s)</span>
              </div>
              {rootEntities.length === 0 ? (
                <div className="text-center py-12 text-[#172030]/40">
                  <Building2 className="h-12 w-12 mx-auto text-[#172030]/20" />
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
                        className="bg-white border border-[#E8E4DC] rounded-xl p-6 cursor-pointer hover:shadow-[0_8px_24px_rgba(23,32,48,0.08)] hover:border-[#2A5141]/30 transition-all duration-200 flex flex-col items-center justify-center min-h-[140px]"
                        onClick={() => selectRoot(root.id)}
                      >
                        <div className="mb-3 w-10 h-10 rounded-lg bg-[#F8F6F2] text-[#172030] flex items-center justify-center">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <h3 className="text-lg font-semibold text-center text-[#172030]">{root.name}</h3>
                        <p className="text-xs text-[#172030]/40 mt-1">Entreprise</p>
                        <div className="flex flex-wrap gap-2 mt-3 justify-center">
                          <span className="text-xs text-[#172030]/50">
                            {getDepartmentCount(root.id)} direction{getDepartmentCount(root.id) > 1 ? 's' : ''}
                          </span>
                          <span className="text-xs text-[#172030]/30">•</span>
                          <span className="text-xs text-[#172030]/50">
                            {totalProcesses} processus
                          </span>
                          {totalCritical > 0 && (
                            <span className="text-xs text-red-600 ml-1">
                              ⚠️ {totalCritical} critique{totalCritical > 1 ? 's' : ''}
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
        </CardContent>
      </Card>
    </div>
  );
};