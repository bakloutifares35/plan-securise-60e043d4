import { useMemo, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
  MoreHorizontal as MoreHoriz
} from "lucide-react";
import { useBia } from "@/contexts/BiaContext";
import { useGovernance } from "@/contexts/GovernanceContext";
import { useRole } from "@/contexts/RoleContext";
import { computeMaxScore, scoreToCriticality, criticalityColor, ImpactAxis, TimePeriod, type Criticality } from "@/data/bia";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { BiaWizard } from "./BiaWizard";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerClose,
  DrawerFooter,
} from "@/components/ui/drawer";

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
  appsIT: number;
  suppliers: number;
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
// COMPOSANT - Dialogue de liaison de ressources
// ============================================================
const LinkResourceDialog = ({ 
  open, 
  onOpenChange, 
  process, 
  allResources,
  onLink,
  resourceType,
  setResourceType
}: { 
  open: boolean;
  onOpenChange: (open: boolean) => void;
  process: any;
  allResources: {
    hr: any[];
    equipment: any[];
    apps: any[];
    suppliers: any[];
  };
  onLink: (type: string, resourceId: string) => void;
  resourceType: string;
  setResourceType: (type: string) => void;
}) => {
  const [selectedResourceId, setSelectedResourceId] = useState<string>("");

  const getResourcesForType = () => {
    switch(resourceType) {
      case 'HR': return allResources.hr;
      case 'Equipement': return allResources.equipment;
      case 'App': return allResources.apps;
      case 'Fournisseur': return allResources.suppliers;
      default: return [];
    }
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

  const resources = getResourcesForType();

  const handleLink = () => {
    if (!selectedResourceId) {
      toast({ title: "Erreur", description: "Veuillez sélectionner une ressource", variant: "destructive" });
      return;
    }
    onLink(resourceType, selectedResourceId);
    setSelectedResourceId("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-indigo-600" />
            Lier une ressource à "{process?.name || ''}"
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Type de ressource</Label>
            <div className="grid grid-cols-4 gap-2 mt-1">
              <Button 
                variant={resourceType === 'HR' ? 'default' : 'outline'} 
                size="sm"
                className={resourceType === 'HR' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                onClick={() => { setResourceType('HR'); setSelectedResourceId(''); }}
              >
                <Users className="h-4 w-4 mr-1" /> RH
              </Button>
              <Button 
                variant={resourceType === 'Equipement' ? 'default' : 'outline'} 
                size="sm"
                className={resourceType === 'Equipement' ? 'bg-yellow-600 hover:bg-yellow-700' : ''}
                onClick={() => { setResourceType('Equipement'); setSelectedResourceId(''); }}
              >
                <Monitor className="h-4 w-4 mr-1" /> Équip.
              </Button>
              <Button 
                variant={resourceType === 'App' ? 'default' : 'outline'} 
                size="sm"
                className={resourceType === 'App' ? 'bg-purple-600 hover:bg-purple-700' : ''}
                onClick={() => { setResourceType('App'); setSelectedResourceId(''); }}
              >
                <Server className="h-4 w-4 mr-1" /> App
              </Button>
              <Button 
                variant={resourceType === 'Fournisseur' ? 'default' : 'outline'} 
                size="sm"
                className={resourceType === 'Fournisseur' ? 'bg-orange-600 hover:bg-orange-700' : ''}
                onClick={() => { setResourceType('Fournisseur'); setSelectedResourceId(''); }}
              >
                <Handshake className="h-4 w-4 mr-1" /> Prest.
              </Button>
            </div>
          </div>

          <div>
            <Label>{getResourceLabel()}</Label>
            <select
              value={selectedResourceId}
              onChange={(e) => setSelectedResourceId(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg bg-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Sélectionner...</option>
              {resources.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name} {r.role ? `(${r.role})` : ''} {r.service ? `(${r.service})` : ''}
                </option>
              ))}
            </select>
            {resources.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">Aucune {getResourceLabel().toLowerCase()} disponible</p>
            )}
          </div>

          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
            {getResourceIcon()}
            <span className="text-sm text-gray-600">
              Vous allez lier cette ressource au processus "{process?.name || ''}"
            </span>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleLink} className="bg-indigo-600 hover:bg-indigo-700">
            <LinkIcon className="h-4 w-4 mr-1" /> Lier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================
// COMPOSANT - ProcessDetailView
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

  const loadLinkedResources = async () => {
    setIsLoading(true);
    try {
      const { data: hrLinks } = await supabase
        .from('processus_ressources_humaines')
        .select('ressource_humaine_id')
        .eq('processus_id', process.id);

      if (hrLinks && hrLinks.length > 0) {
        const hrIds = hrLinks.map((l: any) => l.ressource_humaine_id);
        const { data: hrData } = await supabase
          .from('ressources_humaines')
          .select('*')
          .in('id', hrIds)
          .eq('department_id', serviceId);
        setLinkedHR(hrData || []);
      } else {
        setLinkedHR([]);
      }

      const { data: equipLinks } = await supabase
        .from('processus_equipements')
        .select('equipement_id')
        .eq('processus_id', process.id);

      if (equipLinks && equipLinks.length > 0) {
        const equipIds = equipLinks.map((l: any) => l.equipement_id);
        const { data: equipData } = await supabase
          .from('ressources_equipements')
          .select('*')
          .in('id', equipIds)
          .eq('department_id', serviceId);
        setLinkedEquipment(equipData || []);
      } else {
        setLinkedEquipment([]);
      }

      const { data: appLinks } = await supabase
        .from('processus_applications')
        .select('application_id')
        .eq('processus_id', process.id);

      if (appLinks && appLinks.length > 0) {
        const appIds = appLinks.map((l: any) => l.application_id);
        const { data: appData } = await supabase
          .from('applications_it')
          .select('*')
          .in('id', appIds)
          .eq('department_id', serviceId);
        setLinkedApps(appData || []);
      } else {
        setLinkedApps([]);
      }

      const { data: suppLinks } = await supabase
        .from('processus_fournisseurs')
        .select('fournisseur_id')
        .eq('processus_id', process.id);

      if (suppLinks && suppLinks.length > 0) {
        const suppIds = suppLinks.map((l: any) => l.fournisseur_id);
        const { data: suppData } = await supabase
          .from('fournisseurs')
          .select('*')
          .in('id', suppIds)
          .eq('department_id', serviceId);
        setLinkedSuppliers(suppData || []);
      } else {
        setLinkedSuppliers([]);
      }

    } catch (error) {
      console.error('Erreur chargement ressources liées:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (process && process.id) {
      loadLinkedResources();
    }
  }, [process.id]);

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

  const getMergedResources = (type: string) => {
    const oldResources = process.resources?.filter((r: any) => r.type === type) || [];
    let newResources: any[] = [];
    
    switch(type) {
      case 'HR': newResources = linkedHR; break;
      case 'Equipement': newResources = linkedEquipment; break;
      case 'Fournisseur': newResources = linkedSuppliers; break;
      default: return oldResources;
    }

    const merged = [...oldResources];
    for (const newRes of newResources) {
      if (!merged.some((r: any) => r.id === newRes.id || r.name === newRes.name)) {
        merged.push({ ...newRes, _isLinked: true });
      }
    }
    return merged.map((r: any) => ({ ...r, _isLinked: r._isLinked || false }));
  };

  const totalResources = 
    getMergedResources('HR').length + 
    getMergedResources('Equipement').length + 
    (process.appsCritiques?.length || 0) + 
    linkedApps.length + 
    getMergedResources('Fournisseur').length;

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
            <div className="grid grid-cols-4 gap-3">
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
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400">RPO</p>
                <p className="font-medium text-sm">{process.rpo || 0}h</p>
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
              <div className="p-4 grid grid-cols-2 gap-4">
                <div className="border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-sm">RH</span>
                    <Badge variant="outline" className="text-xs">
                      {getMergedResources('HR').length}
                    </Badge>
                  </div>
                  {getMergedResources('HR').length > 0 ? (
                    getMergedResources('HR').map((r: any, i: number) => (
                      <div key={i} className="text-sm border-b border-gray-100 py-1 flex justify-between items-center">
                        <span>{r.name}</span>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-[10px]">{r.role || "—"}</Badge>
                          {r._isLinked && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                              onClick={() => unlinkResource('HR', r.id, r.name)}
                              title="Dissocier"
                            >
                              <Unlink className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-400">Aucun RH associé</p>
                  )}
                </div>

                <div className="border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Monitor className="h-4 w-4 text-yellow-600" />
                    <span className="font-medium text-sm">Équipements</span>
                    <Badge variant="outline" className="text-xs">
                      {getMergedResources('Equipement').length}
                    </Badge>
                  </div>
                  {getMergedResources('Equipement').length > 0 ? (
                    getMergedResources('Equipement').map((r: any, i: number) => (
                      <div key={i} className="text-sm border-b border-gray-100 py-1 flex justify-between items-center">
                        <span>{r.name}</span>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-[10px]">{r.type || "—"}</Badge>
                          {r._isLinked && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                              onClick={() => unlinkResource('Equipement', r.id, r.name)}
                              title="Dissocier"
                            >
                              <Unlink className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-400">Aucun équipement associé</p>
                  )}
                </div>

                <div className="border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Server className="h-4 w-4 text-purple-600" />
                    <span className="font-medium text-sm">Apps IT</span>
                    <Badge variant="outline" className="text-xs">
                      {(process.appsCritiques?.length || 0) + linkedApps.length}
                    </Badge>
                  </div>
                  {[...(process.appsCritiques || []), ...linkedApps].length > 0 ? (
                    [...(process.appsCritiques || []), ...linkedApps].map((a: any, i: number) => {
                      const isLinked = linkedApps.some((la: any) => la.id === a.id);
                      return (
                        <div key={i} className="text-sm border-b border-gray-100 py-1 flex justify-between items-center">
                          <span>{a.name}</span>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-[10px]">{a.rto_hours || a.rto || 0}h</Badge>
                            {isLinked && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                                onClick={() => unlinkResource('App', a.id, a.name)}
                                title="Dissocier"
                              >
                                <Unlink className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-gray-400">Aucune app associée</p>
                  )}
                </div>

                <div className="border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Handshake className="h-4 w-4 text-orange-600" />
                    <span className="font-medium text-sm">Prestataires</span>
                    <Badge variant="outline" className="text-xs">
                      {getMergedResources('Fournisseur').length}
                    </Badge>
                  </div>
                  {getMergedResources('Fournisseur').length > 0 ? (
                    getMergedResources('Fournisseur').map((r: any, i: number) => (
                      <div key={i} className="text-sm border-b border-gray-100 py-1 flex justify-between items-center">
                        <span>{r.name}</span>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-[10px]">{r.service || "—"}</Badge>
                          {r._isLinked && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                              onClick={() => unlinkResource('Fournisseur', r.id, r.name)}
                              title="Dissocier"
                            >
                              <Unlink className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-400">Aucun prestataire associé</p>
                  )}
                </div>
              </div>
            </div>

            {process.depends_on && process.depends_on.length > 0 && (
              <div className="border rounded-lg p-3">
                <p className="text-xs text-gray-400 font-semibold mb-2">Dépendances</p>
                <div className="flex flex-wrap gap-2">
                  {process.depends_on.map((depId: string) => {
                    const dep = allProcesses.find(p => p.id === depId);
                    return dep ? (
                      <Badge key={depId} variant="outline" className="bg-indigo-50">
                        {dep.name}
                      </Badge>
                    ) : null;
                  })}
                </div>
              </div>
            )}
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

// ============================================================
// COMPOSANT - BIAServiceCard - REDESIGN AVEC ÉTAT VIDE
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

  const handleAddProcess = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (departmentId) {
      window.dispatchEvent(new CustomEvent('openBiaWizard', { 
        detail: { departmentId } 
      }));
    }
  };

  return (
    <div 
      className="bg-white border border-[#E8E4DC] rounded-xl p-5 cursor-pointer hover:shadow-[0_8px_24px_rgba(23,32,48,0.08)] hover:border-[#2A5141]/30 transition-all duration-200"
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-[#172030] text-base">{service.name}</h3>
          <p className="text-xs text-[#172030]/50 mt-0.5">
            👤 {service.owner} · Coord. {service.coordinator}
          </p>
        </div>
        <Badge className={statusConfig.className}>
          {statusConfig.label}
        </Badge>
      </div>

      <div className="grid grid-cols-4 gap-2 py-3 border-t border-b border-[#E8E4DC] mb-3">
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
            {service.appsIT}
          </div>
          <div className="text-[10px] text-[#172030]/40 uppercase tracking-wide">Applis IT</div>
        </div>
        <div className="text-center">
          <div className={cn(
            "text-lg font-bold font-mono",
            isNonDemarre ? "text-[#172030]/30" : "text-[#172030]"
          )}>
            {service.suppliers}
          </div>
          <div className="text-[10px] text-[#172030]/40 uppercase tracking-wide">Prestataires</div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2 flex-1">
          <div className="flex-1 max-w-28 h-1.5 bg-[#E8E4DC] rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full rounded-full transition-all",
                isNonDemarre ? "bg-[#E8E4DC]" : "bg-[#2A5141]"
              )}
              style={{ width: `${isNonDemarre ? 0 : service.completionRate}%` }}
            />
          </div>
          <span className={cn(
            "text-xs font-mono font-medium",
            isNonDemarre ? "text-[#172030]/30" : "text-[#172030]/60"
          )}>
            {isNonDemarre ? "0" : service.completionRate}%
          </span>
        </div>
        {isNonDemarre ? (
          <Button 
            size="sm" 
            className="gap-1 text-xs bg-[#2A5141] hover:bg-[#1a3329] text-white shadow-sm"
            onClick={handleAddProcess}
          >
            <Plus className="h-3.5 w-3.5" /> Ajouter un processus
          </Button>
        ) : (
          <span className="text-xs text-[#2A5141] font-medium flex items-center gap-1">
            Ouvrir <ChevronRightIcon className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
      
      {isNonDemarre && (
        <p className="text-xs text-[#172030]/40 mt-2 italic">
          Aucun processus recensé pour ce service. Lancez l'analyse d'impact.
        </p>
      )}
    </div>
  );
};

// ============================================================
// COMPOSANT - DirectionSection - REDESIGN
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
// IMPACT MATRIX - AVEC BADGES ENTIÈREMENT COLORÉS (PASTEL)
// ============================================================
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
  // Définition des styles pastel pour chaque niveau de sévérité
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
      <div className="grid grid-cols-3 gap-3">
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
        <div className="bg-white rounded-lg p-3 border border-[#E8E4DC] shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider">MTPD</p>
              <p className="text-xl font-bold text-[#172030]">{mtpd || 0}<span className="text-xs font-normal text-[#172030]/40 ml-0.5">h</span></p>
            </div>
            <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center">
              <AlertTriangle className="h-3.5 w-3.5 text-blue-500" />
            </div>
          </div>
          <p className="text-[10px] text-[#172030]/40">Indisponibilité max</p>
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
// PROCESS ACCORDION - AVEC SECTION RESSOURCES ASSOCIÉES
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

  // Récupérer les ressources liées à ce processus
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
            mtpd={process.mtpd}
          />

          {/* ============================================================
              SECTION RESSOURCES ASSOCIÉES À CE PROCESSUS
              ============================================================ */}
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
                {/* RH */}
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

                {/* Équipements */}
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
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Applications IT */}
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
                          {app.name} {app.rto_hours && `(RTO: ${app.rto_hours}h)`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Prestataires */}
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
// COMPOSANT - PersonnelTableau - UNIQUEMENT DU TEXTE/CHIFFRES (CORRIGÉ)
// ============================================================
const PersonnelTableau = ({ people }: { people: any[] }) => {
  const getAvailabilityRate = (availability: any) => {
    if (!availability) return 0;
    const periods = Object.values(availability);
    const available = periods.filter(v => v === true).length;
    return Math.round((available / periods.length) * 100);
  };

  // Calcul des totaux par période
  const periodTotals = AVAILABILITY_PERIODS.map(period => {
    return people.filter(p => p.availability?.[period.id] === true).length;
  });

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-[#F8F6F2] border-b border-[#E8E4DC]">
            <TableHead className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider py-2">Personne / Rôle</TableHead>
            <TableHead className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider py-2 text-center">Processus liés</TableHead>
            {AVAILABILITY_PERIODS.map((period) => (
              <TableHead key={period.id} className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider py-2 text-center">
                {period.label}
              </TableHead>
            ))}
            <TableHead className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider py-2 text-right">Taux</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {people.map((person, idx) => {
            const rate = getAvailabilityRate(person.availability);
            const displayProcesses = person.linkedProcesses || [];
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
                  <div>
                    <p className="text-sm font-medium text-[#172030]">{person.name}</p>
                    <p className="text-xs text-[#172030]/40">{person.role || "—"}</p>
                  </div>
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
                        <Badge variant="outline" className="text-[9px] bg-[#FAFAF9] border-[#E8E4DC] text-[#2A5141] font-medium">
                          +{remainingCount}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-[#172030]/30">—</span>
                  )}
                </TableCell>
                {AVAILABILITY_PERIODS.map((period) => {
                  const isAvailable = person.availability?.[period.id] === true;
                  return (
                    <TableCell key={period.id} className="py-2 text-center font-mono text-sm text-[#172030]">
                      {isAvailable ? "1" : "0"}
                    </TableCell>
                  );
                })}
                <TableCell className="py-2 text-right font-semibold text-sm text-[#172030]">
                  {rate}%
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        {/* Ligne Total FTE - Utilisation de <tfoot> HTML standard (pas TableFooter de shadcn) */}
        <tfoot>
          <tr className="bg-[#F8F6F2] border-t border-[#E8E4DC]">
            <td className="py-2 font-semibold text-sm text-[#172030]">Total FTE</td>
            <td className="py-2 text-center text-sm text-[#172030]/50">—</td>
            {periodTotals.map((total, index) => (
              <td key={index} className="py-2 text-center font-mono font-semibold text-sm text-[#2A5141]">
                {total}
              </td>
            ))}
            <td className="py-2 text-right text-sm text-[#172030]/50">—</td>
          </tr>
        </tfoot>
      </Table>
    </div>
  );
};

// ============================================================
// COMPOSANT - EquipmentTableau - UNIQUEMENT DU TEXTE/CHIFFRES
// ============================================================
const EquipmentTableau = ({ equipment, onDeleteEquipment }: { equipment: any[], onDeleteEquipment?: (id: string, name: string) => void }) => {
  const periods = [
    { key: "P0_4H", label: "0-4h" },
    { key: "P4_8H", label: "4-8h" },
    { key: "P1D", label: "1j" },
    { key: "P2D", label: "2j" },
  ];

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`⚠️ Supprimer définitivement l'équipement "${name}" ?\n\nCette action est irréversible et supprimera également toutes ses liaisons avec des processus.`)) return;
    if (onDeleteEquipment) onDeleteEquipment(id, name);
  };

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
            const linkedProcesses = eq.linkedProcesses || [];
            const visibleProcesses = linkedProcesses.slice(0, 2);
            const remainingCount = linkedProcesses.length - 2;

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
                  {linkedProcesses.length > 0 ? (
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
                              {linkedProcesses.map((p: any) => (
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
                  {onDeleteEquipment && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-[#172030]/30 hover:text-red-600 hover:bg-red-50 rounded-md"
                      onClick={() => handleDelete(eq.id, eq.name)}
                      title="Supprimer cet équipement"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
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
// COMPOSANT PRINCIPAL - BIAFicheDetail
// ============================================================
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

  const [filterCriticality, setFilterCriticality] = useState<string>("all");
  const [filterResponsible, setFilterResponsible] = useState<string>("all");

  const [showAddHRModal, setShowAddHRModal] = useState(false);
  const [showAddEquipmentModal, setShowAddEquipmentModal] = useState(false);
  const [showAddAppModal, setShowAddAppModal] = useState(false);
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  
  const [loadedHR, setLoadedHR] = useState<any[]>([]);
  const [loadedEquipment, setLoadedEquipment] = useState<any[]>([]);
  const [loadedApps, setLoadedApps] = useState<any[]>([]);
  const [loadedSuppliers, setLoadedSuppliers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [processResourcesCache, setProcessResourcesCache] = useState<Record<string, {
    hr: any[];
    equipment: any[];
    apps: any[];
    suppliers: any[];
  }>>({});

  const [selectedProcessForLink, setSelectedProcessForLink] = useState<string>(
    processes.length > 0 ? processes[0].id : ''
  );

  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkProcess, setLinkProcess] = useState<any>(null);
  const [linkResourceType, setLinkResourceType] = useState<string>("HR");
  const [allResources, setAllResources] = useState<{
    hr: any[];
    equipment: any[];
    apps: any[];
    suppliers: any[];
  }>({ hr: [], equipment: [], apps: [], suppliers: [] });

  const [selectedProcessDetail, setSelectedProcessDetail] = useState<any>(null);

  const [enrichedHR, setEnrichedHR] = useState<any[]>([]);
  const [enrichedEquipment, setEnrichedEquipment] = useState<any[]>([]);
  const [enrichedApps, setEnrichedApps] = useState<any[]>([]);
  const [enrichedSuppliers, setEnrichedSuppliers] = useState<any[]>([]);

  const [newHR, setNewHR] = useState({
    name: "",
    role: "",
    phone: "",
    email: "",
    availability: {
      P0_4H: false,
      P4_8H: false,
      P1D: false,
      P2D: false,
      P1W: false,
      P2W: false,
      P1M: false
    }
  });

  const [newEquipment, setNewEquipment] = useState({
    name: "",
    type: "",
    quantity: 1,
    quantities: { P0_4H: 2, P4_8H: 3, P1D: 3, P2D: 4 }
  });

  const [newApp, setNewApp] = useState({
    name: "",
    rto_hours: 4,
    rpo_hours: 2,
    remplacablePar: "",
    department_id: service.id
  });

  const [newSupplier, setNewSupplier] = useState({
    name: "",
    service: "",
    contact: "",
    rpo_hours: 4,
    department_id: service.id
  });

  const enrichResourcesWithProcesses = async (resources: any[], type: string) => {
    if (!resources || resources.length === 0) return resources;

    let table = '';
    let idColumn = '';
    let idColumnInResource = '';

    switch(type) {
      case 'hr':
        table = 'processus_ressources_humaines';
        idColumn = 'ressource_humaine_id';
        idColumnInResource = 'id';
        break;
      case 'equipment':
        table = 'processus_equipements';
        idColumn = 'equipement_id';
        idColumnInResource = 'id';
        break;
      case 'app':
        table = 'processus_applications';
        idColumn = 'application_id';
        idColumnInResource = 'id';
        break;
      case 'supplier':
        table = 'processus_fournisseurs';
        idColumn = 'fournisseur_id';
        idColumnInResource = 'id';
        break;
      default:
        return resources;
    }

    const resourceIds = resources.map(r => r.id);

    if (resourceIds.length === 0) return resources;

    const { data: links, error } = await supabase
      .from(table)
      .select(`${idColumn}, processus_id`)
      .in(idColumn, resourceIds);

    if (error) {
      console.error(`Erreur chargement liens ${type}:`, error);
      return enrichResourcesWithProcessesFallback(resources, type);
    }

    const processIds = links ? links.map(l => l.processus_id) : [];
    let processMap: Record<string, string> = {};

    if (processIds.length > 0) {
      const { data: processData } = await supabase
        .from('processus_metier')
        .select('id, name')
        .in('id', processIds);
      
      if (processData) {
        processMap = processData.reduce((acc, p) => ({ ...acc, [p.id]: p.name }), {});
      }
    }

    const linksByResource: Record<string, any[]> = {};
    if (links) {
      for (const link of links) {
        const resourceId = link[idColumn];
        if (!linksByResource[resourceId]) {
          linksByResource[resourceId] = [];
        }
        linksByResource[resourceId].push(link);
      }
    }

    return resources.map(resource => {
      const resourceLinks = linksByResource[resource.id] || [];
      const linkedProcesses = resourceLinks.map(link => ({
        id: link.processus_id,
        name: processMap[link.processus_id] || link.processus_id
      }));

      let oldLinkedProcesses: any[] = [];
      
      if (type === 'app') {
        for (const p of processes) {
          const apps = (p as any).appsCritiques || [];
          if (apps.some((a: any) => a.id === resource.id || a.name === resource.name)) {
            oldLinkedProcesses.push({ id: p.id, name: p.name });
          }
        }
      } else {
        for (const p of processes) {
          const resourcesList = p.resources || [];
          const found = resourcesList.some((r: any) => {
            if (type === 'hr') {
              if ((r as any).hrPeople) {
                return (r as any).hrPeople.some((person: any) => person.id === resource.id || person.name === resource.name);
              }
              return r.id === resource.id || r.name === resource.name;
            }
            return r.type === (type === 'equipment' ? 'Equipement' : 'Fournisseur') && 
                   (r.id === resource.id || r.name === resource.name);
          });
          if (found) {
            oldLinkedProcesses.push({ id: p.id, name: p.name });
          }
        }
      }

      const allLinked = [...linkedProcesses];
      for (const oldP of oldLinkedProcesses) {
        if (!allLinked.some(p => p.id === oldP.id)) {
          allLinked.push(oldP);
        }
      }

      return {
        ...resource,
        linkedProcesses: allLinked,
        linkedProcessNames: allLinked.map(p => p.name).join(', ')
      };
    });
  };

  const enrichResourcesWithProcessesFallback = (resources: any[], type: string) => {
    return resources.map(resource => {
      const linked: any[] = [];
      
      for (const p of processes) {
        let isLinked = false;
        
        if (type === 'app') {
          const apps = (p as any).appsCritiques || [];
          isLinked = apps.some((a: any) => a.id === resource.id || a.name === resource.name);
        } else if (type === 'supplier') {
          const resourcesList = p.resources || [];
          isLinked = resourcesList.some((r: any) => r.type === "Fournisseur" && (r.id === resource.id || r.name === resource.name));
        } else if (type === 'equipment') {
          const resourcesList = p.resources || [];
          isLinked = resourcesList.some((r: any) => r.type === "Equipement" && (r.id === resource.id || r.name === resource.name));
        } else if (type === 'hr') {
          const resourcesList = p.resources || [];
          for (const r of resourcesList) {
            if (r.type === "HR") {
              if ((r as any).hrPeople && (r as any).hrPeople.some((person: any) => person.id === resource.id || person.name === resource.name)) {
                isLinked = true;
                break;
              } else if (r.id === resource.id || r.name === resource.name) {
                isLinked = true;
                break;
              }
            }
          }
        }
        
        if (isLinked) {
          linked.push({ id: p.id, name: p.name });
        }
      }
      
      return {
        ...resource,
        linkedProcesses: linked,
        linkedProcessNames: linked.map(p => p.name).join(', ')
      };
    });
  };

  const loadLinkedResourcesForProcess = async (processId: string) => {
    try {
      if (processResourcesCache[processId]) {
        return processResourcesCache[processId];
      }

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
        const hrIds = hrLinks.map((l: any) => l.ressource_humaine_id);
        const { data: hrData } = await supabase
          .from('ressources_humaines')
          .select('*')
          .in('id', hrIds)
          .eq('department_id', service.id);
        result.hr = hrData || [];
      }

      const { data: equipLinks } = await supabase
        .from('processus_equipements')
        .select('equipement_id')
        .eq('processus_id', processId);

      if (equipLinks && equipLinks.length > 0) {
        const equipIds = equipLinks.map((l: any) => l.equipement_id);
        const { data: equipData } = await supabase
          .from('ressources_equipements')
          .select('*')
          .in('id', equipIds)
          .eq('department_id', service.id);
        result.equipment = equipData || [];
      }

      const { data: appLinks } = await supabase
        .from('processus_applications')
        .select('application_id')
        .eq('processus_id', processId);

      if (appLinks && appLinks.length > 0) {
        const appIds = appLinks.map((l: any) => l.application_id);
        const { data: appData } = await supabase
          .from('applications_it')
          .select('*')
          .in('id', appIds)
          .eq('department_id', service.id);
        result.apps = appData || [];
      }

      const { data: suppLinks } = await supabase
        .from('processus_fournisseurs')
        .select('fournisseur_id')
        .eq('processus_id', processId);

      if (suppLinks && suppLinks.length > 0) {
        const suppIds = suppLinks.map((l: any) => l.fournisseur_id);
        const { data: suppData } = await supabase
          .from('fournisseurs')
          .select('*')
          .in('id', suppIds)
          .eq('department_id', service.id);
        result.suppliers = suppData || [];
      }

      setProcessResourcesCache(prev => ({
        ...prev,
        [processId]: result
      }));

      return result;
    } catch (error) {
      console.error('Erreur chargement ressources liées:', error);
      return { hr: [], equipment: [], apps: [], suppliers: [] };
    }
  };

  const getTotalResourceCount = (process: any) => {
    const cached = processResourcesCache[process.id];
    if (!cached) {
      return (process.resources?.length || 0) + ((process as any).appsCritiques?.length || 0);
    }
    return cached.hr.length + cached.equipment.length + cached.apps.length + cached.suppliers.length;
  };

  const loadResourcesAndAssociations = async () => {
    setIsLoading(true);
    try {
      const { data: hrData, error: hrError } = await supabase
        .from('ressources_humaines')
        .select('*')
        .eq('department_id', service.id);
      
      if (!hrError && hrData) {
        setLoadedHR(hrData);
        setEnrichedHR(await enrichResourcesWithProcesses(hrData, 'hr'));
      }

      const { data: equipData, error: equipError } = await supabase
        .from('ressources_equipements')
        .select('*')
        .eq('department_id', service.id);
      
      if (!equipError && equipData) {
        setLoadedEquipment(equipData);
        setEnrichedEquipment(await enrichResourcesWithProcesses(equipData, 'equipment'));
      }

      const { data: appData, error: appError } = await supabase
        .from('applications_it')
        .select('*')
        .eq('department_id', service.id);
      
      if (!appError && appData) {
        setLoadedApps(appData);
        setEnrichedApps(await enrichResourcesWithProcesses(appData, 'app'));
      }

      const { data: suppData, error: suppError } = await supabase
        .from('fournisseurs')
        .select('*')
        .eq('department_id', service.id);
      
      if (!suppError && suppData) {
        setLoadedSuppliers(suppData);
        setEnrichedSuppliers(await enrichResourcesWithProcesses(suppData, 'supplier'));
      }

      setAllResources({
        hr: hrData || [],
        equipment: equipData || [],
        apps: appData || [],
        suppliers: suppData || []
      });

      for (const p of processes) {
        await loadLinkedResourcesForProcess(p.id);
      }

    } catch (error) {
      console.error('Erreur chargement ressources:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedProcessForLink) {
      loadResourcesAndAssociations();
    }
  }, [selectedProcessForLink]);

  useEffect(() => {
    loadResourcesAndAssociations();
  }, [service.id]);

  const refreshLinkedResources = async () => {
    setProcessResourcesCache({});
    await loadResourcesAndAssociations();
  };

  const linkResourceToProcess = async (type: string, resourceId: string) => {
    if (!linkProcess) return;

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

      const { data: existing } = await supabase
        .from(table)
        .select('*')
        .eq('processus_id', linkProcess.id)
        .eq(idColumn, resourceId);

      if (existing && existing.length > 0) {
        toast({ title: "Info", description: "Cette ressource est déjà liée à ce processus" });
        return;
      }

      const { error } = await supabase
        .from(table)
        .insert({
          processus_id: linkProcess.id,
          [idColumn]: resourceId
        });

      if (error) throw error;

      toast({ 
        title: "Succès", 
        description: `Ressource liée au processus "${linkProcess.name}"` 
      });
      
      await refreshLinkedResources();
      
    } catch (error: any) {
      console.error('Erreur liaison:', error);
      toast({ 
        title: "Erreur", 
        description: error.message || "Erreur lors de la liaison", 
        variant: "destructive" 
      });
    }
  };

  // Fonction pour supprimer un RH avec gestion des liaisons
  const handleDeletePerson = async (id: string, name: string) => {
    try {
      const { error: linkError } = await supabase
        .from('processus_ressources_humaines')
        .delete()
        .eq('ressource_humaine_id', id);

      if (linkError) console.error('Erreur suppression liaisons RH:', linkError);

      const { error } = await supabase
        .from('ressources_humaines')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({ title: "Succès", description: `"${name}" supprimé avec succès` });
      await refreshLinkedResources();
    } catch (error: any) {
      console.error('Erreur suppression RH:', error);
      toast({ title: "Erreur", description: error.message || "Erreur lors de la suppression", variant: "destructive" });
    }
  };

  // Fonction pour supprimer un équipement avec gestion des liaisons (CORRIGÉE)
  const handleDeleteEquipment = async (id: string, name: string) => {
    try {
      const { data: links, error: linkCheckError } = await supabase
        .from('processus_equipements')
        .select('processus_id')
        .eq('equipement_id', id);

      if (linkCheckError) throw linkCheckError;

      if (links && links.length > 0) {
        const { error: deleteLinksError } = await supabase
          .from('processus_equipements')
          .delete()
          .eq('equipement_id', id);

        if (deleteLinksError) throw deleteLinksError;
        toast({ description: `${links.length} liaison(s) supprimée(s)` });
      }

      const { error } = await supabase
        .from('ressources_equipements')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({ title: "Succès", description: `Équipement "${name}" supprimé avec succès` });
      await refreshLinkedResources();
    } catch (error: any) {
      console.error('Erreur suppression équipement:', error);
      toast({ title: "Erreur", description: error.message || "Erreur lors de la suppression", variant: "destructive" });
    }
  };

  const addHR = async () => {
    if (!newHR.name.trim()) {
      toast({ title: "Champ requis", description: "Veuillez saisir un nom" });
      return;
    }
    const hasAvailability = Object.values(newHR.availability).some(v => v === true);
    if (!hasAvailability) {
      toast({ title: "Attention", description: "Veuillez sélectionner au moins une période de disponibilité" });
      return;
    }

    try {
      const { error } = await supabase
        .from('ressources_humaines')
        .insert({
          name: newHR.name,
          role: newHR.role || "—",
          phone: newHR.phone || "",
          email: newHR.email || "",
          availability: newHR.availability,
          department_id: service.id
        });

      if (error) throw error;
      
      toast({ title: "Succès", description: `RH "${newHR.name}" ajouté avec succès` });
      setShowAddHRModal(false);
      setNewHR({
        name: "",
        role: "",
        phone: "",
        email: "",
        availability: { P0_4H: false, P4_8H: false, P1D: false, P2D: false, P1W: false, P2W: false, P1M: false }
      });
      await refreshLinkedResources();
    } catch (error: any) {
      console.error('Erreur ajout RH:', error);
      toast({ title: "Erreur", description: error.message || "Erreur lors de l'ajout du RH", variant: "destructive" });
    }
  };

  const addEquipment = async () => {
    if (!newEquipment.name.trim()) {
      toast({ title: "Champ requis", description: "Veuillez saisir un nom d'équipement" });
      return;
    }

    try {
      const { error } = await supabase
        .from('ressources_equipements')
        .insert({
          name: newEquipment.name,
          type: newEquipment.type || "—",
          quantity: newEquipment.quantity || 1,
          quantities: newEquipment.quantities,
          department_id: service.id
        });

      if (error) throw error;
      
      toast({ title: "Succès", description: `Équipement "${newEquipment.name}" ajouté avec succès` });
      setShowAddEquipmentModal(false);
      setNewEquipment({
        name: "",
        type: "",
        quantity: 1,
        quantities: { P0_4H: 2, P4_8H: 3, P1D: 3, P2D: 4 }
      });
      await refreshLinkedResources();
    } catch (error: any) {
      console.error('Erreur ajout équipement:', error);
      toast({ title: "Erreur", description: error.message || "Erreur lors de l'ajout de l'équipement", variant: "destructive" });
    }
  };

  const addApp = async () => {
    if (!newApp.name.trim()) {
      toast({ title: "Champ requis", description: "Veuillez saisir un nom d'application" });
      return;
    }

    try {
      const { error } = await supabase
        .from('applications_it')
        .insert({
          name: newApp.name,
          rto_hours: newApp.rto_hours || 4,
          rpo_hours: newApp.rpo_hours || 2,
          remplacablepar: newApp.remplacablePar || "",
          department_id: service.id
        });

      if (error) throw error;
      
      toast({ title: "Succès", description: `Application "${newApp.name}" ajoutée avec succès` });
      setShowAddAppModal(false);
      setNewApp({
        name: "",
        rto_hours: 4,
        rpo_hours: 2,
        remplacablePar: "",
        department_id: service.id
      });
      await refreshLinkedResources();
    } catch (error: any) {
      console.error('Erreur ajout application:', error);
      toast({ title: "Erreur", description: error.message || "Erreur lors de l'ajout de l'application", variant: "destructive" });
    }
  };

  const addSupplier = async () => {
    if (!newSupplier.name.trim()) {
      toast({ title: "Champ requis", description: "Veuillez saisir un nom de prestataire" });
      return;
    }

    try {
      const { error } = await supabase
        .from('fournisseurs')
        .insert({
          name: newSupplier.name,
          service: newSupplier.service || "—",
          contact: newSupplier.contact || "",
          rpo_hours: newSupplier.rpo_hours || 4,
          department_id: service.id
        });

      if (error) throw error;
      
      toast({ title: "Succès", description: `Prestataire "${newSupplier.name}" ajouté avec succès` });
      setShowAddSupplierModal(false);
      setNewSupplier({
        name: "",
        service: "",
        contact: "",
        rpo_hours: 4,
        department_id: service.id
      });
      await refreshLinkedResources();
    } catch (error: any) {
      console.error('Erreur ajout prestataire:', error);
      toast({ title: "Erreur", description: error.message || "Erreur lors de l'ajout du prestataire", variant: "destructive" });
    }
  };

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

  // États de recherche pour Applications IT et Prestataires
  const [appSearchQuery, setAppSearchQuery] = useState<string>("");
  const [supplierSearchQuery, setSupplierSearchQuery] = useState<string>("");

  // États pour l'édition inline des RTO/RPO
  const [editingAppField, setEditingAppField] = useState<{ id: string; field: 'rto' | 'rpo' } | null>(null);
  const [editingSupplierField, setEditingSupplierField] = useState<{ id: string; field: 'rto' } | null>(null);

  const handleProcessClick = (process: any) => {
    loadLinkedResourcesForProcess(process.id).then(() => {
      setSelectedProcessDetail(process);
    });
  };

  const handleLinkClick = (process: any) => {
    setLinkProcess(process);
    setLinkResourceType("HR");
    setLinkDialogOpen(true);
  };

  const refreshDetail = () => {
    if (selectedProcessDetail) {
      loadLinkedResourcesForProcess(selectedProcessDetail.id).then(() => {
        setSelectedProcessDetail({ ...selectedProcessDetail });
      });
    }
  };

  const handleDeleteProcess = (id: string, name: string) => {
    if (confirm(`⚠️ Voulez-vous vraiment supprimer le processus "${name}" ?\n\nCette action supprimera également toutes les liaisons avec des ressources.`)) {
      onDelete(id, name);
      setTimeout(() => {
        refreshLinkedResources();
      }, 500);
    }
  };

  const filteredProcesses = useMemo(() => {
    return processes.filter(p => {
      if (filterCriticality !== "all") {
        const score = computeMaxScoreFromImpacts(p.impacts);
        const crit = scoreToCriticality(score);
        if (crit !== filterCriticality) return false;
      }
      if (filterResponsible !== "all") {
        if (p.owner !== filterResponsible) return false;
      }
      return true;
    });
  }, [processes, filterCriticality, filterResponsible]);

  const responsibleOptions = useMemo(() => {
    const owners = new Set<string>();
    processes.forEach(p => {
      if (p.owner) owners.add(p.owner);
    });
    return Array.from(owners);
  }, [processes]);

  // Filtrer les applications
  const filteredApps = useMemo(() => {
    let apps = [...enrichedApps];
    if (appSearchQuery.trim()) {
      const q = appSearchQuery.toLowerCase().trim();
      apps = apps.filter(app => 
        app.name?.toLowerCase().includes(q) ||
        app.remplacablepar?.toLowerCase().includes(q)
      );
    }
    return apps;
  }, [enrichedApps, appSearchQuery]);

  // Filtrer les prestataires
  const filteredSuppliers = useMemo(() => {
    let suppliers = [...enrichedSuppliers];
    if (supplierSearchQuery.trim()) {
      const q = supplierSearchQuery.toLowerCase().trim();
      suppliers = suppliers.filter(sup => 
        sup.name?.toLowerCase().includes(q) ||
        sup.service?.toLowerCase().includes(q) ||
        sup.contact?.toLowerCase().includes(q)
      );
    }
    return suppliers;
  }, [enrichedSuppliers, supplierSearchQuery]);

  // Mise à jour RTO App
  const updateAppRTO = async (appId: string, value: number) => {
    try {
      const { error } = await supabase
        .from('applications_it')
        .update({ rto_hours: value })
        .eq('id', appId);
      if (error) throw error;
      toast({ title: "Succès", description: "RTO mis à jour" });
      refreshLinkedResources();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
    setEditingAppField(null);
  };

  // Mise à jour RPO App
  const updateAppRPO = async (appId: string, value: number) => {
    try {
      const { error } = await supabase
        .from('applications_it')
        .update({ rpo_hours: value })
        .eq('id', appId);
      if (error) throw error;
      toast({ title: "Succès", description: "RPO mis à jour" });
      refreshLinkedResources();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
    setEditingAppField(null);
  };

  // Mise à jour RTO Prestataire
  const updateSupplierRTO = async (supplierId: string, value: number) => {
    try {
      const { error } = await supabase
        .from('fournisseurs')
        .update({ rpo_hours: value })
        .eq('id', supplierId);
      if (error) throw error;
      toast({ title: "Succès", description: "RTO mis à jour" });
      refreshLinkedResources();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
    setEditingSupplierField(null);
  };

  // Supprimer une application
  const deleteApp = async (appId: string, appName: string) => {
    if (!confirm(`⚠️ Supprimer l'application "${appName}" ?\n\nCette action est irréversible et supprimera également toutes ses liaisons avec des processus.`)) return;
    try {
      const { error } = await supabase
        .from('applications_it')
        .delete()
        .eq('id', appId);
      if (error) throw error;
      toast({ title: "Succès", description: `"${appName}" supprimée` });
      refreshLinkedResources();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  // Supprimer un prestataire
  const deleteSupplier = async (supplierId: string, supplierName: string) => {
    if (!confirm(`⚠️ Supprimer le prestataire "${supplierName}" ?\n\nCette action est irréversible et supprimera également toutes ses liaisons avec des processus.`)) return;
    try {
      const { error } = await supabase
        .from('fournisseurs')
        .delete()
        .eq('id', supplierId);
      if (error) throw error;
      toast({ title: "Succès", description: `"${supplierName}" supprimé` });
      refreshLinkedResources();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <LinkResourceDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        process={linkProcess}
        allResources={allResources}
        onLink={linkResourceToProcess}
        resourceType={linkResourceType}
        setResourceType={setLinkResourceType}
      />

      <Dialog open={showAddHRModal} onOpenChange={setShowAddHRModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-600" />
              Ajouter une ressource humaine
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nom *</Label>
                <Input value={newHR.name} onChange={(e) => setNewHR({ ...newHR, name: e.target.value })} placeholder="Nom complet" />
              </div>
              <div>
                <Label>Rôle</Label>
                <Input value={newHR.role} onChange={(e) => setNewHR({ ...newHR, role: e.target.value })} placeholder="ex: Chef de projet" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input type="email" value={newHR.email} onChange={(e) => setNewHR({ ...newHR, email: e.target.value })} placeholder="nom@email.com" />
              </div>
              <div>
                <Label>Téléphone</Label>
                <Input value={newHR.phone} onChange={(e) => setNewHR({ ...newHR, phone: e.target.value })} placeholder="+33 6..." />
              </div>
            </div>
            <div>
              <Label className="font-medium">Périodes de disponibilité</Label>
              <div className="flex flex-wrap gap-3 mt-2">
                {AVAILABILITY_PERIODS.map((period) => (
                  <label key={period.id} className="flex items-center gap-1 text-sm">
                    <input 
                      type="checkbox" 
                      checked={newHR.availability[period.id]} 
                      onChange={(e) => setNewHR({ 
                        ...newHR, 
                        availability: { ...newHR.availability, [period.id]: e.target.checked } 
                      })} 
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    /> 
                    {period.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddHRModal(false)}>Annuler</Button>
            <Button onClick={addHR} className="bg-indigo-600 hover:bg-indigo-700">Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddEquipmentModal} onOpenChange={setShowAddEquipmentModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Monitor className="h-5 w-5 text-indigo-600" />
              Ajouter un équipement
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nom *</Label>
                <Input value={newEquipment.name} onChange={(e) => setNewEquipment({ ...newEquipment, name: e.target.value })} placeholder="ex: Serveur Dell R740" />
              </div>
              <div>
                <Label>Type</Label>
                <Input value={newEquipment.type} onChange={(e) => setNewEquipment({ ...newEquipment, type: e.target.value })} placeholder="ex: Serveur, Poste, Switch" />
              </div>
            </div>
            <div>
              <Label>Quantité</Label>
              <Input type="number" min={1} value={newEquipment.quantity} onChange={(e) => setNewEquipment({ ...newEquipment, quantity: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="font-medium">Quantités par période</Label>
              <div className="grid grid-cols-5 gap-2 mt-2">
                {Object.entries({ P0_4H: "0-4h", P4_8H: "4-8h", P1D: "1j", P2D: "2j", P1W: "1sem" }).map(([key, label]) => (
                  <div key={key} className="flex flex-col items-center">
                    <span className="text-xs text-gray-500">{label}</span>
                    <Input 
                      type="number"
                      className="w-14 h-8 text-center text-sm"
                      value={newEquipment.quantities[key as keyof typeof newEquipment.quantities]}
                      onChange={(e) => 
                        setNewEquipment({ 
                          ...newEquipment, 
                          quantities: { ...newEquipment.quantities, [key]: Number(e.target.value) }
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddEquipmentModal(false)}>Annuler</Button>
            <Button onClick={addEquipment} className="bg-indigo-600 hover:bg-indigo-700">Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddAppModal} onOpenChange={setShowAddAppModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Server className="h-5 w-5 text-indigo-600" />
              Ajouter une application IT
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nom *</Label>
              <Input value={newApp.name} onChange={(e) => setNewApp({ ...newApp, name: e.target.value })} placeholder="ex: SAP S/4HANA" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>RTO (heures)</Label>
                <Input type="number" min={0} value={newApp.rto_hours} onChange={(e) => setNewApp({ ...newApp, rto_hours: Number(e.target.value) })} />
              </div>
              <div>
                <Label>RPO (heures)</Label>
                <Input type="number" min={0} value={newApp.rpo_hours} onChange={(e) => setNewApp({ ...newApp, rpo_hours: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label>Application alternative</Label>
              <Input value={newApp.remplacablePar} onChange={(e) => setNewApp({ ...newApp, remplacablePar: e.target.value })} placeholder="ex: Backup manuel..." />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddAppModal(false)}>Annuler</Button>
            <Button onClick={addApp} className="bg-indigo-600 hover:bg-indigo-700">Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddSupplierModal} onOpenChange={setShowAddSupplierModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Handshake className="h-5 w-5 text-indigo-600" />
              Ajouter un prestataire
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nom *</Label>
              <Input value={newSupplier.name} onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })} placeholder="ex: AWS, OVH..." />
            </div>
            <div>
              <Label>Service</Label>
              <Input value={newSupplier.service} onChange={(e) => setNewSupplier({ ...newSupplier, service: e.target.value })} placeholder="ex: Hébergement cloud" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Contact</Label>
                <Input value={newSupplier.contact} onChange={(e) => setNewSupplier({ ...newSupplier, contact: e.target.value })} placeholder="Nom du contact" />
              </div>
              <div>
                <Label>RTO (heures)</Label>
                <Input type="number" min={0} value={newSupplier.rpo_hours} onChange={(e) => setNewSupplier({ ...newSupplier, rpo_hours: Number(e.target.value) })} />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddSupplierModal(false)}>Annuler</Button>
            <Button onClick={addSupplier} className="bg-indigo-600 hover:bg-indigo-700">Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedProcessDetail && (
        <ProcessDetailView
          process={selectedProcessDetail}
          allProcesses={processes}
          onClose={() => setSelectedProcessDetail(null)}
          onEditProcess={onEdit}
          serviceId={service.id}
          onResourceUnlinked={refreshLinkedResources}
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
          <Button className="gap-2 bg-green-600 hover:bg-green-700">
            <CheckCircle className="h-4 w-4" /> Soumettre pour validation
          </Button>
        </div>
      </div>

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

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-[#172030]/40" />
              <span className="text-xs font-medium text-[#172030]/60">Filtres</span>
            </div>
            <select
              value={filterCriticality}
              onChange={(e) => setFilterCriticality(e.target.value)}
              className="h-8 px-2.5 text-xs border border-[#E8E4DC] rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[#2A5141] text-[#172030]"
            >
              <option value="all">Toutes les criticités</option>
              <option value="Critique">Critique</option>
              <option value="Majeur">Majeur</option>
              <option value="Modéré">Modéré</option>
              <option value="Mineur">Mineur</option>
            </select>
            <select
              value={filterResponsible}
              onChange={(e) => setFilterResponsible(e.target.value)}
              className="h-8 px-2.5 text-xs border border-[#E8E4DC] rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[#2A5141] text-[#172030]"
            >
              <option value="all">Tous les responsables</option>
              {responsibleOptions.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            {(filterCriticality !== "all" || filterResponsible !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-[#172030]/40 hover:text-[#172030]"
                onClick={() => {
                  setFilterCriticality("all");
                  setFilterResponsible("all");
                }}
              >
                <X className="h-3 w-3 mr-1" /> Réinitialiser
              </Button>
            )}
            <span className="text-xs text-[#172030]/40 ml-auto">
              {filteredProcesses.length} processus
            </span>
          </div>

          <div className="space-y-3">
            {filteredProcesses.map((p, idx) => {
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

        {/* ============================================================
            ONGLET RESSOURCES REQUISES - AVEC TABLEAUX SANS GRAPHIQUES
            ============================================================ */}
        <TabsContent value="resources" className="pt-4">
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm text-indigo-800 mb-4 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>Ressources minimales pour maintenir les processus critiques dans la première semaine après un sinistre.</div>
          </div>

          <div className="flex gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={() => setShowAddHRModal(true)} className="gap-1">
              <Users className="h-4 w-4" /> Ajouter un RH
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowAddEquipmentModal(true)} className="gap-1">
              <Monitor className="h-4 w-4" /> Ajouter un équipement
            </Button>
          </div>

          {/* PERSONNEL NÉCESSAIRE - TABLEAU UNIQUEMENT TEXTE/CHIFFRES */}
          <div className="border rounded-xl overflow-hidden bg-white mb-4">
            <div className="flex items-center gap-3 px-4 py-3 bg-[#F8F6F2] border-b border-[#E8E4DC]">
              <Users className="h-4 w-4 text-[#2A5141]" />
              <h4 className="font-medium text-[#172030] flex-1 text-sm">Personnel nécessaire</h4>
              <span className="text-xs text-[#172030]/40">{enrichedHR.length} personne{enrichedHR.length > 1 ? 's' : ''}</span>
            </div>
            <div className="p-4">
              {enrichedHR.length > 0 ? (
                <PersonnelTableau people={enrichedHR} />
              ) : (
                <div className="text-center py-6 text-[#172030]/40 text-sm">
                  Aucune ressource humaine déclarée.
                </div>
              )}
            </div>
          </div>

          {/* POSTES DE TRAVAIL */}
          <div className="border rounded-xl overflow-hidden bg-white mb-4">
            <div className="flex items-center gap-3 px-4 py-3 bg-[#F8F6F2] border-b border-[#E8E4DC]">
              <Monitor className="h-4 w-4 text-[#2A5141]" />
              <h4 className="font-medium text-[#172030] flex-1 text-sm">Postes de travail nécessaires</h4>
              <span className="text-xs text-[#172030]/40">1 poste par personne disponible</span>
            </div>
            <div className="p-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#FAFAF9] border-b border-[#E8E4DC]">
                      <TableHead className="font-semibold text-[11px] text-[#172030]/50 uppercase tracking-wider py-3">Type de poste</TableHead>
                      {AVAILABILITY_PERIODS.map(p => (
                        <TableHead key={p.id} className="text-center font-semibold text-[11px] text-[#172030]/50 uppercase tracking-wider py-3">
                          {p.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="bg-white">
                      <TableCell className="font-medium text-sm text-[#172030] py-3">Postes de travail</TableCell>
                      {AVAILABILITY_PERIODS.map(period => (
                        <TableCell key={period.id} className="text-center font-mono font-semibold text-[#2A5141] py-3">
                          {workstationCounts[period.id] || 0}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          {/* ÉQUIPEMENTS - TABLEAU UNIQUEMENT TEXTE/CHIFFRES */}
          <div className="border rounded-xl overflow-hidden bg-white mb-4">
            <div className="flex items-center gap-3 px-4 py-3 bg-[#F8F6F2] border-b border-[#E8E4DC]">
              <Package className="h-4 w-4 text-[#2A5141]" />
              <h4 className="font-medium text-[#172030] flex-1 text-sm">Équipements & infrastructure</h4>
              <span className="text-xs text-[#172030]/40">{enrichedEquipment.length} équipement{enrichedEquipment.length > 1 ? 's' : ''}</span>
            </div>
            <div className="p-4">
              {enrichedEquipment.length > 0 ? (
                <EquipmentTableau equipment={enrichedEquipment} onDeleteEquipment={handleDeleteEquipment} />
              ) : (
                <div className="text-center py-6 text-[#172030]/40 text-sm">
                  Aucun équipement déclaré.
                </div>
              )}
            </div>
          </div>

          {/* DOCUMENTS */}
          <div className="border rounded-xl overflow-hidden bg-white">
            <div className="flex items-center gap-3 px-4 py-3 bg-[#F8F6F2] border-b border-[#E8E4DC]">
              <FileText className="h-4 w-4 text-[#2A5141]" />
              <h4 className="font-medium text-[#172030] flex-1 text-sm">Documents & supports critiques</h4>
              <span className="text-xs text-[#172030]/40">
                {processes.reduce((acc, p) => acc + ((p.documents || []).length), 0)} élément{processes.reduce((acc, p) => acc + ((p.documents || []).length), 0) > 1 ? 's' : ''}
              </span>
            </div>
            <div className="p-4">
              {processes.some(p => p.documents && p.documents.length > 0) ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-[#FAFAF9] border-b border-[#E8E4DC]">
                        <TableHead className="font-semibold text-[11px] text-[#172030]/50 uppercase tracking-wider py-3">Document / support</TableHead>
                        <TableHead className="font-semibold text-[11px] text-[#172030]/50 uppercase tracking-wider py-3">Processus</TableHead>
                        <TableHead className="font-semibold text-[11px] text-[#172030]/50 uppercase tracking-wider py-3">Disponible sous</TableHead>
                        <TableHead className="font-semibold text-[11px] text-[#172030]/50 uppercase tracking-wider py-3">Classification</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {processes.flatMap(p => 
                        (p.documents || []).map((doc: any) => ({ ...doc, processName: p.name }))
                      ).map((doc, idx) => (
                        <TableRow key={doc.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFAF9]'}>
                          <TableCell className="font-medium text-sm text-[#172030] py-3">{doc.name}</TableCell>
                          <TableCell className="text-sm text-[#172030]/60 py-3">{doc.processName}</TableCell>
                          <TableCell className="py-3">
                            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2A5141]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#2A5141]" />
                              {doc.availableUnder || "≤ 2h"}
                            </span>
                          </TableCell>
                          <TableCell className="py-3">
                            <span className={cn(
                              "inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded border",
                              doc.confidential 
                                ? "text-[#ef4444] border-red-200 bg-red-50" 
                                : "text-[#172030]/60 border-[#E8E4DC] bg-[#F8F6F2]"
                            )}>
                              {doc.confidential ? "Confidentiel" : "Interne"}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-6 text-[#172030]/40 text-sm">
                  Aucun document critique déclaré.
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ═══════ SECTION APPLICATIONS IT - REDESIGN ═══════ */}
        <TabsContent value="apps" className="pt-4">
          <div className="bg-[#F8F6F2] border border-[#E8E4DC] rounded-lg p-3 text-sm text-[#172030] mb-4 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-[#2A5141]" />
            <div>
              <span className="font-medium">RTO</span> = délai de reprise acceptable · 
              <span className="font-medium ml-1">RPO</span> = perte de données maximale acceptable.
              <span className="block text-xs text-[#172030]/40 mt-1">
                Cliquez sur une valeur RTO/RPO pour la modifier.
              </span>
            </div>
          </div>

          {/* Header avec recherche et bouton ajout */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <Server className="h-5 w-5 text-[#172030]" />
              <span className="text-sm font-medium text-[#172030]">Applications IT</span>
              <Badge variant="outline" className="bg-white border-[#E8E4DC] text-[#172030]/60">
                {filteredApps.length} / {enrichedApps.length}
              </Badge>
            </div>
            <div className="flex items-center gap-3 flex-1 sm:flex-none">
              <div className="relative flex-1 sm:w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#172030]/40" />
                <Input
                  placeholder="Rechercher..."
                  value={appSearchQuery}
                  onChange={(e) => setAppSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-sm border-[#E8E4DC] focus:border-[#2A5141] focus:ring-[#2A5141]/20"
                />
              </div>
              <Button 
                onClick={() => setShowAddAppModal(true)} 
                className="gap-1.5 bg-[#2A5141] hover:bg-[#1a3329] text-white shadow-sm h-8 text-sm"
              >
                <Plus className="h-3.5 w-3.5" /> Ajouter
              </Button>
            </div>
          </div>

          {filteredApps.length > 0 ? (
            <div className="space-y-3">
              {filteredApps.map((app) => {
                const displayProcesses = app.linkedProcesses || [];
                const visibleProcesses = displayProcesses.slice(0, 2);
                const remainingCount = displayProcesses.length - 2;

                return (
                  <div 
                    key={app.id}
                    className="border border-[#E8E4DC] rounded-xl p-4 bg-white hover:border-[#2A5141]/40 hover:shadow-sm transition-all duration-200"
                  >
                    <div className="flex flex-col md:flex-row md:items-start gap-3">
                      {/* Icône et nom */}
                      <div className="flex items-start gap-3 min-w-[160px]">
                        <div className="w-9 h-9 rounded-lg bg-[#F8F6F2] flex items-center justify-center flex-shrink-0">
                          <Server className="h-4 w-4 text-[#172030]" />
                        </div>
                        <div>
                          <p className="font-medium text-sm text-[#172030]">{app.name}</p>
                          <p className="text-xs text-[#172030]/40">
                            {app.remplacablepar || "Aucune alternative"}
                          </p>
                          {displayProcesses.length > 0 && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#2A5141]" />
                              <span className="text-[10px] text-[#2A5141]">Lié</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Processus associés */}
                      <div className="flex-1 min-w-[80px]">
                        {displayProcesses.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="text-[10px] text-[#172030]/40 mr-1">Processus :</span>
                            {visibleProcesses.map((p: any) => (
                              <Badge key={p.id} variant="outline" className="text-[10px] bg-[#FAFAF9] border-[#E8E4DC] text-[#172030] font-normal">
                                {p.name}
                              </Badge>
                            ))}
                            {remainingCount > 0 && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Badge variant="outline" className="text-[10px] bg-[#FAFAF9] border-[#E8E4DC] text-[#2A5141] font-medium cursor-pointer hover:bg-[#F0EDE8]">
                                    +{remainingCount}
                                  </Badge>
                                </PopoverTrigger>
                                <PopoverContent className="w-56 p-3 border-[#E8E4DC] bg-white shadow-lg">
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
                          <span className="text-xs text-[#172030]/30">Aucun processus associé</span>
                        )}
                      </div>

                      {/* RTO / RPO stats */}
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <div>
                          <p className="text-[9px] font-medium text-[#172030]/40 uppercase tracking-wider">RTO</p>
                          {editingAppField?.id === app.id && editingAppField?.field === 'rto' ? (
                            <Input
                              type="number"
                              min={0}
                              defaultValue={app.rto_hours ?? app.rto ?? 0}
                              className="w-14 h-7 text-center text-sm font-mono border-[#2A5141] focus:ring-[#2A5141]/20"
                              onBlur={(e) => updateAppRTO(app.id, Number(e.target.value))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  updateAppRTO(app.id, Number((e.target as HTMLInputElement).value));
                                }
                                if (e.key === 'Escape') setEditingAppField(null);
                              }}
                              autoFocus
                            />
                          ) : (
                            <button
                              onClick={() => setEditingAppField({ id: app.id, field: 'rto' })}
                              className="text-sm font-bold text-[#172030] hover:text-[#2A5141] transition-colors"
                            >
                              {app.rto_hours ?? app.rto ?? 0}<span className="text-xs font-normal text-[#172030]/40 ml-0.5">h</span>
                            </button>
                          )}
                        </div>
                        <div>
                          <p className="text-[9px] font-medium text-[#172030]/40 uppercase tracking-wider">RPO</p>
                          {editingAppField?.id === app.id && editingAppField?.field === 'rpo' ? (
                            <Input
                              type="number"
                              min={0}
                              defaultValue={app.rpo_hours ?? app.rpo ?? 0}
                              className="w-14 h-7 text-center text-sm font-mono border-[#2A5141] focus:ring-[#2A5141]/20"
                              onBlur={(e) => updateAppRPO(app.id, Number(e.target.value))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  updateAppRPO(app.id, Number((e.target as HTMLInputElement).value));
                                }
                                if (e.key === 'Escape') setEditingAppField(null);
                              }}
                              autoFocus
                            />
                          ) : (
                            <button
                              onClick={() => setEditingAppField({ id: app.id, field: 'rpo' })}
                              className="text-sm font-bold text-[#172030] hover:text-[#2A5141] transition-colors"
                            >
                              {app.rpo_hours ?? app.rpo ?? 0}<span className="text-xs font-normal text-[#172030]/40 ml-0.5">h</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-[#172030]/30 hover:text-[#172030] hover:bg-[#F8F6F2] rounded-md">
                              <MoreHoriz className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44 border-[#E8E4DC] shadow-lg bg-white">
                            <DropdownMenuItem className="text-sm text-[#172030] cursor-pointer hover:bg-[#F8F6F2] gap-2">
                              <EditIcon className="h-3.5 w-3.5 text-[#172030]/40" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-sm text-[#172030] cursor-pointer hover:bg-[#F8F6F2] gap-2">
                              <Link2 className="h-3.5 w-3.5 text-[#172030]/40" />
                              Voir les liaisons
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-sm text-red-600 cursor-pointer hover:bg-red-50 gap-2"
                              onClick={() => deleteApp(app.id, app.name)}
                            >
                              <TrashIcon className="h-3.5 w-3.5" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 border border-dashed border-[#E8E4DC] rounded-xl bg-[#FAFAF9]">
              <Server className="h-10 w-10 mx-auto text-[#172030]/20" />
              <p className="text-sm text-[#172030]/40 mt-3">
                {appSearchQuery ? 'Aucune application ne correspond à votre recherche.' : 'Aucune application IT déclarée.'}
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3 border-[#E8E4DC] text-[#172030]/60 hover:text-[#2A5141]"
                onClick={() => setShowAddAppModal(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter une application
              </Button>
            </div>
          )}
        </TabsContent>

        {/* ═══════ SECTION PRESTATAIRES - REDESIGN ═══════ */}
        <TabsContent value="suppliers" className="pt-4">
          <div className="bg-[#F8F6F2] border border-[#E8E4DC] rounded-lg p-3 text-sm text-[#172030] mb-4 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-[#2A5141]" />
            <div>
              Prestataires externes ou intra-groupe nécessaires pour l'exploitation de secours.
              <span className="block text-xs text-[#172030]/40 mt-1">
                Cliquez sur la valeur RTO pour la modifier.
              </span>
            </div>
          </div>

          {/* Header avec recherche et bouton ajout */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <Handshake className="h-5 w-5 text-[#172030]" />
              <span className="text-sm font-medium text-[#172030]">Prestataires</span>
              <Badge variant="outline" className="bg-white border-[#E8E4DC] text-[#172030]/60">
                {filteredSuppliers.length} / {enrichedSuppliers.length}
              </Badge>
            </div>
            <div className="flex items-center gap-3 flex-1 sm:flex-none">
              <div className="relative flex-1 sm:w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#172030]/40" />
                <Input
                  placeholder="Rechercher..."
                  value={supplierSearchQuery}
                  onChange={(e) => setSupplierSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-sm border-[#E8E4DC] focus:border-[#2A5141] focus:ring-[#2A5141]/20"
                />
              </div>
              <Button 
                onClick={() => setShowAddSupplierModal(true)} 
                className="gap-1.5 bg-[#2A5141] hover:bg-[#1a3329] text-white shadow-sm h-8 text-sm"
              >
                <Plus className="h-3.5 w-3.5" /> Ajouter
              </Button>
            </div>
          </div>

          {filteredSuppliers.length > 0 ? (
            <div className="space-y-3">
              {filteredSuppliers.map((sup) => {
                const displayProcesses = sup.linkedProcesses || [];
                const visibleProcesses = displayProcesses.slice(0, 2);
                const remainingCount = displayProcesses.length - 2;

                return (
                  <div 
                    key={sup.id}
                    className="border border-[#E8E4DC] rounded-xl p-4 bg-white hover:border-[#2A5141]/40 hover:shadow-sm transition-all duration-200"
                  >
                    <div className="flex flex-col md:flex-row md:items-start gap-3">
                      {/* Icône et nom */}
                      <div className="flex items-start gap-3 min-w-[160px]">
                        <div className="w-9 h-9 rounded-lg bg-[#F8F6F2] flex items-center justify-center flex-shrink-0">
                          <Truck className="h-4 w-4 text-[#172030]" />
                        </div>
                        <div>
                          <p className="font-medium text-sm text-[#172030]">{sup.name}</p>
                          <p className="text-xs text-[#172030]/40">{sup.service || "—"}</p>
                          {displayProcesses.length > 0 && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#2A5141]" />
                              <span className="text-[10px] text-[#2A5141]">Lié</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Processus associés */}
                      <div className="flex-1 min-w-[80px]">
                        {displayProcesses.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="text-[10px] text-[#172030]/40 mr-1">Processus :</span>
                            {visibleProcesses.map((p: any) => (
                              <Badge key={p.id} variant="outline" className="text-[10px] bg-[#FAFAF9] border-[#E8E4DC] text-[#172030] font-normal">
                                {p.name}
                              </Badge>
                            ))}
                            {remainingCount > 0 && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Badge variant="outline" className="text-[10px] bg-[#FAFAF9] border-[#E8E4DC] text-[#2A5141] font-medium cursor-pointer hover:bg-[#F0EDE8]">
                                    +{remainingCount}
                                  </Badge>
                                </PopoverTrigger>
                                <PopoverContent className="w-56 p-3 border-[#E8E4DC] bg-white shadow-lg">
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
                          <span className="text-xs text-[#172030]/30">Aucun processus associé</span>
                        )}
                      </div>

                      {/* RTO et Contact */}
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <div>
                          <p className="text-[9px] font-medium text-[#172030]/40 uppercase tracking-wider">RTO</p>
                          {editingSupplierField?.id === sup.id ? (
                            <Input
                              type="number"
                              min={0}
                              defaultValue={sup.rpo_hours ?? sup.rpo ?? sup.rto_hours ?? 0}
                              className="w-14 h-7 text-center text-sm font-mono border-[#2A5141] focus:ring-[#2A5141]/20"
                              onBlur={(e) => updateSupplierRTO(sup.id, Number(e.target.value))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  updateSupplierRTO(sup.id, Number((e.target as HTMLInputElement).value));
                                }
                                if (e.key === 'Escape') setEditingSupplierField(null);
                              }}
                              autoFocus
                            />
                          ) : (
                            <button
                              onClick={() => setEditingSupplierField({ id: sup.id, field: 'rto' })}
                              className="text-sm font-bold text-[#172030] hover:text-[#2A5141] transition-colors"
                            >
                              {sup.rpo_hours ?? sup.rpo ?? sup.rto_hours ?? 0}<span className="text-xs font-normal text-[#172030]/40 ml-0.5">h</span>
                            </button>
                          )}
                        </div>
                        <div>
                          <p className="text-[9px] font-medium text-[#172030]/40 uppercase tracking-wider">Contact</p>
                          <p className="text-sm font-medium text-[#172030]">{sup.contact || "—"}</p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-[#172030]/30 hover:text-[#172030] hover:bg-[#F8F6F2] rounded-md">
                              <MoreHoriz className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44 border-[#E8E4DC] shadow-lg bg-white">
                            <DropdownMenuItem className="text-sm text-[#172030] cursor-pointer hover:bg-[#F8F6F2] gap-2">
                              <EditIcon className="h-3.5 w-3.5 text-[#172030]/40" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-sm text-[#172030] cursor-pointer hover:bg-[#F8F6F2] gap-2">
                              <Link2 className="h-3.5 w-3.5 text-[#172030]/40" />
                              Voir les liaisons
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-sm text-red-600 cursor-pointer hover:bg-red-50 gap-2"
                              onClick={() => deleteSupplier(sup.id, sup.name)}
                            >
                              <TrashIcon className="h-3.5 w-3.5" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 border border-dashed border-[#E8E4DC] rounded-xl bg-[#FAFAF9]">
              <Handshake className="h-10 w-10 mx-auto text-[#172030]/20" />
              <p className="text-sm text-[#172030]/40 mt-3">
                {supplierSearchQuery ? 'Aucun prestataire ne correspond à votre recherche.' : 'Aucun prestataire déclaré.'}
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3 border-[#E8E4DC] text-[#172030]/60 hover:text-[#2A5141]"
                onClick={() => setShowAddSupplierModal(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter un prestataire
              </Button>
            </div>
          )}
        </TabsContent>

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
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ============================================================
// COMPOSANT PRINCIPAL - ProcessInventory
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
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  const [selectedProcess, setSelectedProcess] = useState<any>(null);
  const [selectedProcessDeptProcs, setSelectedProcessDeptProcs] = useState<any[]>([]);

  const [selectedService, setSelectedService] = useState<ServiceBIA | null>(null);
  const [showBIADetail, setShowBIADetail] = useState(false);

  const [showWizard, setShowWizard] = useState(false);
  const [wizardProcessId, setWizardProcessId] = useState<string | undefined>(undefined);
  const [wizardDepartmentId, setWizardDepartmentId] = useState<string | undefined>(undefined);

  const entityName = (id: string) => entities.find((e) => e.id === id)?.name ?? "—";
  const rootEntities = useMemo(() => entities.filter(e => e.parentId === null), [entities]);
  const getChildren = (parentId: string) => entities.filter(e => e.parentId === parentId);

  const getDepartmentCount = (entityId: string) => getChildren(entityId).length;

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

  // buildBIAServices MODIFIÉ - inclut TOUS les départements, même sans processus
  const buildBIAServices = (entityId: string): ServiceBIA[] => {
    const directions = getChildren(entityId);
    const services: ServiceBIA[] = [];

    for (const dir of directions) {
      const depts = getChildren(dir.id);
      for (const dept of depts) {
        const deptProcesses = processes.filter(p => p.department === dept.name || p.entityId === dept.id);
        
        // PLUS DE CONTINUE - on garde le département même sans processus

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

        const rate = deptProcesses.length > 0 ? calculateCompletionRate(deptProcesses) : 0;
        const status = getBIAStatus(deptProcesses, dept.lastUpdated);

        services.push({
          id: dept.id,
          name: dept.name,
          owner: deptProcesses.length > 0 ? deptProcesses[0]?.owner || "—" : "—",
          coordinator: "L. Benali",
          processCount: deptProcesses.length,
          criticalCount,
          appsIT: appsIT.size,
          suppliers: suppliers.size,
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
    const nonDemarre = services.filter(s => s.status === "non_demarre").length;

    return {
      totalServices,
      totalProcesses,
      totalCritical,
      completed,
      toComplete,
      toReview,
      nonDemarre,
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
    if (confirm(`⚠️ Voulez-vous vraiment supprimer le processus "${name}" ?\n\nCette action supprimera également toutes les liaisons avec des ressources.`)) {
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

  const openWizard = (processId?: string, departmentId?: string) => {
    setWizardProcessId(processId);
    setWizardDepartmentId(departmentId);
    setShowWizard(true);
  };

  const closeWizard = () => {
    setShowWizard(false);
    setWizardProcessId(undefined);
    setWizardDepartmentId(undefined);
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
            onDone={() => {
              closeWizard();
              window.location.reload();
            }} 
          />
        </DialogContent>
      </Dialog>
    );
  }

  // VUE DIRECTIONS - REDESIGN
  if (viewLevel === "directions" && selectedRoot && !showBIADetail) {
    const services = buildBIAServices(selectedRoot);
    const filteredServices = getFilteredServices(services);
    const stats = getBIAStats(services);

    const directions = getChildren(selectedRoot);
    const servicesByDirection: Record<string, ServiceBIA[]> = {};
    const departmentIds: Record<string, string> = {};
    
    for (const dir of directions) {
      const depts = getChildren(dir.id);
      const dirServices = services.filter(s => depts.some(d => d.id === s.id));
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
          <div className="flex gap-2">
            <Button variant="outline" onClick={goToRoot} className="gap-1 border-[#E8E4DC] text-[#172030]/60 hover:text-[#172030]">
              <ArrowLeft className="h-4 w-4" /> Retour
            </Button>
            <Button 
              className="gap-2 bg-[#2A5141] hover:bg-[#1a3329] text-white shadow-sm"
              onClick={() => openWizard(undefined, selectedRoot)}
            >
              <Plus className="h-4 w-4" /> Nouvelle fiche BIA
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-white border-[#E8E4DC] shadow-sm">
            <CardContent className="p-4">
              <p className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider">Fiches BIA</p>
              <p className="text-3xl font-bold text-[#172030]" style={{ fontFamily: "Playfair Display, serif" }}>{stats.totalServices}</p>
              <p className="text-xs text-[#172030]/40">sur {stats.scoped} services scopés</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-[#E8E4DC] shadow-sm">
            <CardContent className="p-4">
              <p className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider">Processus critiques</p>
              <p className="text-3xl font-bold text-red-600" style={{ fontFamily: "Playfair Display, serif" }}>{stats.totalCritical}</p>
              <p className="text-xs text-[#172030]/40">sur {stats.totalProcesses} processus</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-[#E8E4DC] shadow-sm">
            <CardContent className="p-4">
              <p className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider">Fiches complètes</p>
              <p className="text-3xl font-bold text-[#2A5141]" style={{ fontFamily: "Playfair Display, serif" }}>{stats.completed}</p>
              <p className="text-xs text-[#172030]/40">{stats.toComplete} à compléter</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-[#E8E4DC] shadow-sm">
            <CardContent className="p-4">
              <p className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider">Non démarrés</p>
              <p className="text-3xl font-bold text-[#172030]/50" style={{ fontFamily: "Playfair Display, serif" }}>{stats.nonDemarre}</p>
              <p className="text-xs text-[#172030]/40">{stats.toReview} à réviser</p>
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
          <div className="flex gap-1.5 flex-wrap">
            <Button 
              variant={selectedStatus === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedStatus("all")}
              className={selectedStatus === "all" ? "bg-[#2A5141] hover:bg-[#1a3329] text-white" : "border-[#E8E4DC] text-[#172030]/60"}
            >
              Tous
            </Button>
            <Button 
              variant={selectedStatus === "critique" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedStatus("critique")}
              className={selectedStatus === "critique" ? "bg-[#2A5141] hover:bg-[#1a3329] text-white" : "border-[#E8E4DC] text-[#172030]/60"}
            >
              Critiques
            </Button>
            <Button 
              variant={selectedStatus === "a_completer" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedStatus("a_completer")}
              className={selectedStatus === "a_completer" ? "bg-[#2A5141] hover:bg-[#1a3329] text-white" : "border-[#E8E4DC] text-[#172030]/60"}
            >
              À compléter
            </Button>
            <Button 
              variant={selectedStatus === "a_reviser" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedStatus("a_reviser")}
              className={selectedStatus === "a_reviser" ? "bg-[#2A5141] hover:bg-[#1a3329] text-white" : "border-[#E8E4DC] text-[#172030]/60"}
            >
              À réviser
            </Button>
            <Button 
              variant={selectedStatus === "non_demarre" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedStatus("non_demarre")}
              className={selectedStatus === "non_demarre" ? "bg-[#2A5141] hover:bg-[#1a3329] text-white" : "border-[#E8E4DC] text-[#172030]/60"}
            >
              Non démarrés
            </Button>
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

  // VUE DÉPARTEMENTS - avec les cartes redesign
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
          <div className="flex gap-2">
            <Button variant="outline" onClick={goToRoot} className="gap-1 border-[#E8E4DC] text-[#172030]/60 hover:text-[#172030]">
              <ArrowLeft className="h-4 w-4" /> Retour
            </Button>
            <Button 
              className="gap-2 bg-[#2A5141] hover:bg-[#1a3329] text-white shadow-sm"
              onClick={() => openWizard(undefined, selectedRoot || undefined)}
            >
              <Plus className="h-4 w-4" /> Nouvelle fiche BIA
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-white border-[#E8E4DC] shadow-sm">
            <CardContent className="p-4">
              <p className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider">Fiches BIA</p>
              <p className="text-3xl font-bold text-[#172030]" style={{ fontFamily: "Playfair Display, serif" }}>{stats.totalServices}</p>
              <p className="text-xs text-[#172030]/40">sur {stats.scoped} services scopés</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-[#E8E4DC] shadow-sm">
            <CardContent className="p-4">
              <p className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider">Processus critiques</p>
              <p className="text-3xl font-bold text-red-600" style={{ fontFamily: "Playfair Display, serif" }}>{stats.totalCritical}</p>
              <p className="text-xs text-[#172030]/40">sur {stats.totalProcesses} processus</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-[#E8E4DC] shadow-sm">
            <CardContent className="p-4">
              <p className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider">Fiches complètes</p>
              <p className="text-3xl font-bold text-[#2A5141]" style={{ fontFamily: "Playfair Display, serif" }}>{stats.completed}</p>
              <p className="text-xs text-[#172030]/40">{stats.toComplete} à compléter</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-[#E8E4DC] shadow-sm">
            <CardContent className="p-4">
              <p className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider">Non démarrés</p>
              <p className="text-3xl font-bold text-[#172030]/50" style={{ fontFamily: "Playfair Display, serif" }}>{stats.nonDemarre}</p>
              <p className="text-xs text-[#172030]/40">{stats.toReview} à réviser</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-[#172030]/40" />
            <span className="text-xs font-medium text-[#172030]/60">Filtres</span>
          </div>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="h-8 px-2.5 text-xs border border-[#E8E4DC] rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[#2A5141] text-[#172030]"
          >
            <option value="all">Tous les statuts</option>
            <option value="critique">Critique</option>
            <option value="a_completer">À compléter</option>
            <option value="a_reviser">À réviser</option>
            <option value="non_demarre">Non démarré</option>
          </select>
          {(selectedStatus !== "all" || searchQuery) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-[#172030]/40 hover:text-[#172030]"
              onClick={() => {
                setSelectedStatus("all");
                setSearchQuery("");
              }}
            >
              <X className="h-3 w-3 mr-1" /> Réinitialiser
            </Button>
          )}
          <span className="text-xs text-[#172030]/40 ml-auto">
            {departments.filter(dept => {
              const deptProcesses = processes.filter(p => p.department === dept.name || p.entityId === dept.id);
              if (selectedStatus === "all") return true;
              const status = getBIAStatus(deptProcesses, dept.lastUpdated);
              return status === selectedStatus;
            }).length} services
          </span>
        </div>

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
                        {deptProcesses.length > 0 ? calculateCompletionRate(deptProcesses) : 0}%
                      </div>
                      <div className="text-[10px] text-[#172030]/40 uppercase tracking-wide">Complétion</div>
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
        onEdit={onEdit}
        onDelete={handleDelete}
        canDelete={can("admin")}
        entities={entities}
      />
    );
  }

  // VUE ENTREPRISES - redesigned
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
        <div className="flex gap-2">
          {viewLevel !== "enterprises" && (
            <Button variant="outline" onClick={goToRoot} className="gap-1 border-[#E8E4DC] text-[#172030]/60 hover:text-[#172030]">
              <ArrowLeft className="h-4 w-4" /> Retour
            </Button>
          )}
          {can("write") && viewLevel === "processes" && (
            <Button 
              onClick={() => openWizard(undefined, selectedDepartment || undefined)} 
              className="gap-2 bg-[#2A5141] hover:bg-[#1a3329] text-white shadow-sm"
            >
              <Plus className="h-4 w-4" /> Nouveau processus
            </Button>
          )}
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