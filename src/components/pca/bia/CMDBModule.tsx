// src/components/pca/bia/CMDBModule.tsx
import { useState, useEffect, useCallback, useRef } from "react";
import { 
  Users, Monitor, Server, Handshake, Search, Plus, 
  Pencil, Trash2, Link, ExternalLink, Filter,
  X, Save, Loader2, Building2, ChevronDown, ChevronRight,
  Upload, FileSpreadsheet, AlertCircle, CheckCircle, 
  Eye, MoreVertical, Copy, Square, SquareDot, CircleDot,
  ListChecks, Database, RefreshCw, ChevronLeft, ChevronRight as ChevronRightIcon,
  Download, FileUp, AlertTriangle, Grid3X3, LayoutGrid, List,
  Calendar, Clock, Info, Shield, AlertOctagon, Edit,
  Check, AlertCircle as AlertCircleIcon, Boxes, Users2, Laptop,
  Cloud, Package, Code, Globe, Wifi, HardDrive, Cpu,
  HelpCircle, MapPin, Building, Mail, Phone, Tag, Hash,
  UserCircle
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { supabase } from "@/integrations/resillia/client";
import { useGovernance } from "@/contexts/GovernanceContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import * as XLSX from 'xlsx';

// ============================================================
// TYPES
// ============================================================
export type Criticality = "Critique" | "Majeur" | "Modéré" | "Mineur";

interface ResourceCount {
  id: string;
  name: string;
  type: string;
  department_id: string | null;
  department_name?: string;
  used_by_count: number;
  process_ids?: string[];
  process_names?: string[];
  process_criticalities?: Record<string, Criticality>;
  max_criticality?: Criticality | null;
  created_at?: string;
  updated_at?: string;
}

type ResourceType = 'hr' | 'equipment' | 'app' | 'supplier';
type ViewMode = 'list' | 'grid';
type UsageFilter = 'all' | 'used' | 'unused';

const TABS = [
  { id: 'hr', label: 'Collaborateurs', icon: Users, color: 'blue' },
  { id: 'equipment', label: 'Équipements', icon: Monitor, color: 'amber' },
  { id: 'app', label: 'Applications IT', icon: Server, color: 'purple' },
  { id: 'supplier', label: 'Prestataires', icon: Handshake, color: 'orange' },
];

// ============================================================
// FONCTIONS DE CRITICITÉ
// ============================================================
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

const scoreToCriticality = (score: number): Criticality => {
  if (score >= 4) return "Critique";
  if (score >= 3) return "Majeur";
  if (score >= 2) return "Modéré";
  return "Mineur";
};

const criticalityColors = {
  'Critique': 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800',
  'Majeur': 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800',
  'Modéré': 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-300 dark:border-yellow-800',
  'Mineur': 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800',
};

// ============================================================
// COMPOSANT - KpiCard
// ============================================================
const KpiCard = ({
  label,
  value,
  icon,
  color,
  onClick,
  isActive,
  alertThreshold,
  isClickable = true,
  subtitle,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color?: string;
  onClick?: () => void;
  isActive?: boolean;
  alertThreshold?: { value: number; message: string };
  isClickable?: boolean;
  subtitle?: string;
}) => {
  const isAlert = alertThreshold && value > alertThreshold.value;

  return (
    <div 
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-white p-4 transition-all duration-300",
        isClickable && "cursor-pointer hover:shadow-md hover:-translate-y-0.5",
        isActive ? "border-[#2A5141] shadow-md" : "border-gray-200",
        isAlert && "border-orange-300 bg-orange-50/30"
      )}
      onClick={isClickable ? onClick : undefined}
    >
      <div 
        className="absolute top-0 left-0 right-0 h-1 transition-all duration-300"
        style={{ 
          backgroundColor: isActive ? '#2A5141' : (color || '#2A5141'),
          opacity: isActive ? 1 : 0.3
        }}
      />
      
      <div className="flex items-start justify-between pt-1">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</p>
          <p 
            className={cn(
              "text-2xl font-bold mt-1",
              isAlert ? "text-orange-600" : "text-gray-900"
            )}
          >
            {value}
          </p>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className={cn(
          "p-2 rounded-lg transition-colors",
          isActive ? "bg-[#2A5141]/10 text-[#2A5141]" : "bg-gray-100 text-gray-400"
        )}>
          {icon}
        </div>
      </div>
      
      {isAlert && (
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-orange-200">
          <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
          <p className="text-xs text-orange-600">{alertThreshold.message}</p>
        </div>
      )}
    </div>
  );
};

// ============================================================
// COMPOSANT - SkeletonLoader
// ============================================================
const SkeletonLoader = ({ rows = 5 }: { rows?: number }) => {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 animate-pulse">
          <div className="h-8 w-8 rounded-full bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 bg-gray-200 rounded" />
            <div className="h-3 w-24 bg-gray-200 rounded" />
          </div>
          <div className="h-6 w-20 bg-gray-200 rounded" />
          <div className="h-6 w-16 bg-gray-200 rounded" />
          <div className="h-8 w-8 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  );
};

// ============================================================
// COMPOSANT - SkeletonGrid
// ============================================================
const SkeletonGrid = ({ count = 6 }: { count?: number }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border border-gray-200 rounded-xl p-4 bg-white animate-pulse">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-200" />
              <div className="space-y-2">
                <div className="h-4 w-24 bg-gray-200 rounded" />
                <div className="h-3 w-16 bg-gray-200 rounded" />
              </div>
            </div>
            <div className="h-6 w-16 bg-gray-200 rounded" />
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-3 w-32 bg-gray-200 rounded" />
            <div className="h-3 w-24 bg-gray-200 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================================
// COMPOSANT - ResourceRow
// ============================================================
const ResourceRow = ({ 
  resource, 
  type, 
  index, 
  onEdit, 
  onDelete, 
  onViewProcesses,
  onClick,
}: { 
  resource: any;
  type: ResourceType;
  index: number;
  onEdit: (resource: any) => void;
  onDelete: (resource: any) => void;
  onViewProcesses: (resource: any) => void;
  onClick: (resource: any) => void;
}) => {
  const [showProcesses, setShowProcesses] = useState(false);

  const getInitials = (name: string) => {
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  };

  const getIcon = () => {
    switch(type) {
      case 'hr': return <Users className="h-4 w-4 text-blue-600" />;
      case 'equipment': return <Monitor className="h-4 w-4 text-amber-600" />;
      case 'app': return <Server className="h-4 w-4 text-purple-600" />;
      case 'supplier': return <Handshake className="h-4 w-4 text-orange-600" />;
      default: return <Building2 className="h-4 w-4 text-gray-600" />;
    }
  };

  const isUsed = resource.used_by_count > 0;
  const hasCriticalImpact = resource.max_criticality === 'Critique';

  const getProcessNames = () => {
    return resource.process_names || [];
  };

  return (
    <TableRow 
      className={cn(
        "border-b border-gray-100 transition-all duration-200 cursor-pointer",
        index % 2 === 0 ? "bg-white" : "bg-gray-50/50",
        "hover:bg-[#F8FAF8] hover:shadow-[0_0_18px_rgba(42,81,65,0.10)] hover:relative hover:z-10"
      )}
      onClick={() => onClick(resource)}
    >
      <TableCell className="py-3">
        <div className="flex items-center gap-3">
          {type === 'hr' ? (
            <div className="w-8 h-8 rounded-full bg-[#2A5141]/10 flex items-center justify-center text-xs font-semibold text-[#2A5141] flex-shrink-0">
              {getInitials(resource.name)}
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center border border-gray-200 flex-shrink-0">
              {getIcon()}
            </div>
          )}
          <div>
            <span className="font-medium text-gray-900">{resource.name}</span>
            {hasCriticalImpact && (
              <Badge className="ml-2 bg-red-100 text-red-700 border-red-200 text-[10px]">
                <AlertOctagon className="h-2.5 w-2.5 mr-1" />
                Critique
              </Badge>
            )}
          </div>
        </div>
      </TableCell>

      {type === 'hr' && (
        <>
          <TableCell className="py-3 text-sm text-gray-500">{resource.role || "—"}</TableCell>
          <TableCell className="py-3 text-sm text-gray-500">{resource.email || "—"}</TableCell>
        </>
      )}
      {type === 'equipment' && (
        <>
          <TableCell className="py-3 text-sm text-gray-500">{resource.type || "—"}</TableCell>
          <TableCell className="py-3 text-sm text-gray-500">{resource.quantity || 1}</TableCell>
        </>
      )}
      {type === 'app' && (
        <TableCell className="py-3 text-sm text-gray-500">{resource.remplacablepar || "—"}</TableCell>
      )}
      {type === 'supplier' && (
        <>
          <TableCell className="py-3 text-sm text-gray-500">{resource.service || "—"}</TableCell>
          <TableCell className="py-3 text-sm text-gray-500">{resource.contact || "—"}</TableCell>
        </>
      )}

      <TableCell className="py-3">
        <Popover open={showProcesses} onOpenChange={setShowProcesses}>
          <PopoverTrigger asChild>
            <div className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setShowProcesses(true); }}>
              <Badge 
                variant="outline"
                className={cn(
                  "text-xs",
                  isUsed 
                    ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-50" 
                    : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-50"
                )}
              >
                {isUsed ? `${resource.used_by_count} processus` : "Non utilisé"}
              </Badge>
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3 border-gray-200 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Processus liés ({getProcessNames().length})
              </p>
              {getProcessNames().length > 0 ? (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {getProcessNames().map((name: string, i: number) => (
                    <div key={i} className="text-sm text-gray-700 py-1 border-b border-gray-100 last:border-0">
                      {name}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Aucun processus lié</p>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </TableCell>

      <TableCell className="py-3 text-center" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreVertical className="h-4 w-4 text-gray-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="border-gray-200 shadow-lg">
            <DropdownMenuItem onClick={() => onClick(resource)} className="cursor-pointer">
              <Eye className="h-4 w-4 mr-2 text-gray-500" />
              Voir le détail
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(resource)} className="cursor-pointer">
              <Pencil className="h-4 w-4 mr-2 text-gray-500" />
              Modifier
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onViewProcesses(resource)} className="cursor-pointer">
              <Link className="h-4 w-4 mr-2 text-gray-500" />
              Voir les processus liés
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => onDelete(resource)}
              className="cursor-pointer text-red-600 hover:text-red-700 focus:text-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
};

// ============================================================
// COMPOSANT - ResourceTable
// ============================================================
const ResourceTable = ({
  data,
  type,
  onEdit,
  onDelete,
  onViewProcesses,
  onClick,
}: {
  data: any[];
  type: ResourceType;
  onEdit: (resource: any) => void;
  onDelete: (resource: any) => void;
  onViewProcesses: (resource: any) => void;
  onClick: (resource: any) => void;
}) => {
  const getColumns = () => {
    const base = [{ key: 'name', label: 'Nom' }];
    const specific = {
      hr: [
        { key: 'role', label: 'Rôle' },
        { key: 'email', label: 'Email' },
      ],
      equipment: [
        { key: 'type', label: 'Type' },
        { key: 'quantity', label: 'Qté' },
      ],
      app: [{ key: 'remplacablepar', label: 'Alternative' }],
      supplier: [
        { key: 'service', label: 'Service' },
        { key: 'contact', label: 'Contact' },
      ],
    };
    return [...base, ...(specific[type] || []), { key: 'usage', label: 'Utilisé par' }];
  };

  const columns = getColumns();

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50/80 border-b border-gray-200">
            {columns.map((col) => (
              <TableHead key={col.key} className="text-xs font-semibold text-gray-400 uppercase tracking-wider py-3">
                {col.label}
              </TableHead>
            ))}
            <TableHead className="text-xs font-semibold text-gray-400 uppercase tracking-wider py-3 text-center">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item, idx) => (
            <ResourceRow
              key={item.id}
              resource={item}
              type={type}
              index={idx}
              onEdit={onEdit}
              onDelete={onDelete}
              onViewProcesses={onViewProcesses}
              onClick={onClick}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

// ============================================================
// COMPOSANT - ResourceGridCard
// ============================================================
const ResourceGridCard = ({
  resource,
  type,
  onEdit,
  onDelete,
  onViewProcesses,
  onClick,
}: {
  resource: any;
  type: ResourceType;
  onEdit: (resource: any) => void;
  onDelete: (resource: any) => void;
  onViewProcesses: (resource: any) => void;
  onClick: (resource: any) => void;
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const getInitials = (name: string) => {
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  };

  const getIcon = () => {
    switch(type) {
      case 'hr': return <Users className="h-5 w-5 text-blue-600" />;
      case 'equipment': return <Monitor className="h-5 w-5 text-amber-600" />;
      case 'app': return <Server className="h-5 w-5 text-purple-600" />;
      case 'supplier': return <Handshake className="h-5 w-5 text-orange-600" />;
      default: return <Building2 className="h-5 w-5 text-gray-600" />;
    }
  };

  const getGlowColor = () => {
    switch(type) {
      case 'hr': return 'shadow-[0_0_20px_rgba(59,130,246,0.15)]';
      case 'equipment': return 'shadow-[0_0_20px_rgba(245,158,11,0.15)]';
      case 'app': return 'shadow-[0_0_20px_rgba(147,51,234,0.15)]';
      case 'supplier': return 'shadow-[0_0_20px_rgba(249,115,22,0.15)]';
      default: return 'shadow-[0_0_20px_rgba(0,0,0,0.05)]';
    }
  };

  const isUsed = resource.used_by_count > 0;
  const hasCriticalImpact = resource.max_criticality === 'Critique';

  return (
    <div 
      className={cn(
        "group border rounded-xl p-4 bg-white",
        "transition-shadow duration-200 cursor-pointer",
        isHovered ? getGlowColor() : "border-gray-200",
        hasCriticalImpact && "border-l-4 border-l-red-500"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onClick(resource)}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {type === 'hr' ? (
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 transition-colors duration-200",
              isHovered ? "bg-blue-100 text-blue-700" : "bg-[#2A5141]/10 text-[#2A5141]"
            )}>
              {getInitials(resource.name)}
            </div>
          ) : (
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center border flex-shrink-0 transition-colors duration-200",
              isHovered ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-gray-50"
            )}>
              {getIcon()}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-medium text-gray-900 truncate">{resource.name}</p>
            {hasCriticalImpact && (
              <Badge className="mt-0.5 bg-red-100 text-red-700 border-red-200 text-[10px]">
                <AlertOctagon className="h-3 w-3 mr-1" />
                Critique
              </Badge>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreVertical className="h-4 w-4 text-gray-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="border-gray-200 shadow-lg">
            <DropdownMenuItem onClick={() => onClick(resource)} className="cursor-pointer">
              <Eye className="h-4 w-4 mr-2 text-gray-500" />
              Voir le détail
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(resource)} className="cursor-pointer">
              <Pencil className="h-4 w-4 mr-2 text-gray-500" />
              Modifier
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onViewProcesses(resource)} className="cursor-pointer">
              <Link className="h-4 w-4 mr-2 text-gray-500" />
              Voir les processus liés
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => onDelete(resource)}
              className="cursor-pointer text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        <Badge 
          variant="outline"
          className={cn(
            "text-xs transition-colors duration-200",
            isUsed 
              ? "bg-green-50 text-green-700 border-green-200" 
              : "bg-gray-50 text-gray-500 border-gray-200"
          )}
        >
          {isUsed ? `${resource.used_by_count} processus` : "Non utilisé"}
        </Badge>
        {type === 'hr' && resource.role && (
          <span className="text-xs text-gray-400">{resource.role}</span>
        )}
        {type === 'equipment' && resource.type && (
          <span className="text-xs text-gray-400">{resource.type}</span>
        )}
        {type === 'app' && resource.remplacablepar && (
          <span className="text-xs text-gray-400">Alt: {resource.remplacablepar}</span>
        )}
        {type === 'supplier' && resource.service && (
          <span className="text-xs text-gray-400">{resource.service}</span>
        )}
      </div>
    </div>
  );
};

// ============================================================
// COMPOSANT - ResourceDetailSheet
// ============================================================
const ResourceDetailSheet = ({
  resource,
  type,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  processes,
  onResourceUpdated,
}: {
  resource: any;
  type: ResourceType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (resource: any) => void;
  onDelete: (resource: any) => void;
  processes: any[];
  onResourceUpdated?: () => void;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (resource) {
      setFormData({ ...resource });
      setFormErrors({});
    }
  }, [resource]);

  const getTypeLabel = () => {
    switch(type) {
      case 'hr': return 'Collaborateur';
      case 'equipment': return 'Équipement';
      case 'app': return 'Application IT';
      case 'supplier': return 'Prestataire';
      default: return 'Ressource';
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  };

  const getIcon = () => {
    switch(type) {
      case 'hr': return <Users className="h-12 w-12 text-blue-600" />;
      case 'equipment': return <Monitor className="h-12 w-12 text-amber-600" />;
      case 'app': return <Server className="h-12 w-12 text-purple-600" />;
      case 'supplier': return <Handshake className="h-12 w-12 text-orange-600" />;
      default: return <Building2 className="h-12 w-12 text-gray-600" />;
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCriticalityBadge = (criticality: Criticality) => {
    return criticalityColors[criticality] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const validateForm = (data: any) => {
    const errors: Record<string, string> = {};
    if (!data.name?.trim()) {
      errors.name = "Le nom est requis";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm(formData)) return;
    
    setIsSaving(true);
    const tables = {
      hr: 'ressources_humaines',
      equipment: 'ressources_equipements',
      app: 'applications_it',
      supplier: 'fournisseurs',
    };

    try {
      const cleanData = { ...formData };
      delete cleanData.used_by_count;
      delete cleanData.process_ids;
      delete cleanData.process_names;
      delete cleanData.process_criticalities;
      delete cleanData.max_criticality;
      delete cleanData.department_name;
      delete cleanData._resourceType;

      const { error } = await supabase
        .from(tables[type])
        .update(cleanData)
        .eq('id', resource.id);

      if (error) throw error;

      toast.success("Ressource mise à jour avec succès");
      setIsEditing(false);
      
      if (onResourceUpdated) {
        onResourceUpdated();
      }
      
      setTimeout(() => {
        onOpenChange(false);
      }, 500);

    } catch (error: any) {
      toast.error("Erreur lors de la mise à jour: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const renderForm = () => {
    const forms = {
      hr: (
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Nom *</Label>
            <Input 
              value={formData.name || ""} 
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={cn("mt-1", formErrors.name && "border-red-400")}
              placeholder="Nom complet"
            />
            {formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>}
          </div>
          <div>
            <Label className="text-sm font-medium">Rôle</Label>
            <Input 
              value={formData.role || ""} 
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="mt-1"
              placeholder="Ex: Chef de projet"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Email</Label>
            <Input 
              type="email"
              value={formData.email || ""} 
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="mt-1"
              placeholder="email@entreprise.com"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Téléphone</Label>
            <Input 
              value={formData.phone || ""} 
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="mt-1"
              placeholder="+33 6 12 34 56 78"
            />
          </div>
        </div>
      ),
      equipment: (
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Nom *</Label>
            <Input 
              value={formData.name || ""} 
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={cn("mt-1", formErrors.name && "border-red-400")}
              placeholder="Nom de l'équipement"
            />
            {formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>}
          </div>
          <div>
            <Label className="text-sm font-medium">Type</Label>
            <Input 
              value={formData.type || ""} 
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="mt-1"
              placeholder="Ex: Serveur, PC, Switch"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Quantité</Label>
            <Input 
              type="number"
              min={1}
              value={formData.quantity || 1} 
              onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
              className="mt-1"
            />
          </div>
        </div>
      ),
      app: (
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Nom *</Label>
            <Input 
              value={formData.name || ""} 
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={cn("mt-1", formErrors.name && "border-red-400")}
              placeholder="Nom de l'application"
            />
            {formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>}
          </div>
          <div>
            <Label className="text-sm font-medium">Application alternative</Label>
            <Input 
              value={formData.remplacablepar || ""} 
              onChange={(e) => setFormData({ ...formData, remplacablepar: e.target.value })}
              className="mt-1"
              placeholder="Ex: Alternative manuelle"
            />
          </div>
        </div>
      ),
      supplier: (
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Nom *</Label>
            <Input 
              value={formData.name || ""} 
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={cn("mt-1", formErrors.name && "border-red-400")}
              placeholder="Nom du prestataire"
            />
            {formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>}
          </div>
          <div>
            <Label className="text-sm font-medium">Service</Label>
            <Input 
              value={formData.service || ""} 
              onChange={(e) => setFormData({ ...formData, service: e.target.value })}
              className="mt-1"
              placeholder="Ex: Hébergement cloud"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Contact</Label>
            <Input 
              value={formData.contact || ""} 
              onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
              className="mt-1"
              placeholder="Nom du contact"
            />
          </div>
        </div>
      ),
    };

    return forms[type];
  };

  const linkedProcesses = processes || [];

  return (
    <Sheet open={open} onOpenChange={(newOpen) => {
      if (!newOpen) {
        setIsEditing(false);
        if (resource) setFormData({ ...resource });
        setFormErrors({});
        onOpenChange(newOpen);
      }
    }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Edit className="h-5 w-5 text-[#2A5141]" />
                Modifier la ressource
              </>
            ) : (
              <>
                <Eye className="h-5 w-5 text-[#2A5141]" />
                Détail de la ressource
              </>
            )}
          </SheetTitle>
          <SheetDescription>
            {isEditing ? 'Modifiez les informations de la ressource' : 'Informations détaillées de la ressource'}
          </SheetDescription>
        </SheetHeader>

        {resource && (
          <>
            <div className="flex items-center gap-4 py-4 border-b border-gray-200">
              {type === 'hr' ? (
                <div className="w-16 h-16 rounded-full bg-[#2A5141]/10 flex items-center justify-center text-xl font-semibold text-[#2A5141]">
                  {getInitials(resource.name)}
                </div>
              ) : (
                <div className="w-16 h-16 rounded-xl bg-gray-50 flex items-center justify-center border border-gray-200">
                  {getIcon()}
                </div>
              )}
              <div>
                <p className="text-lg font-semibold text-gray-900">{resource.name}</p>
                <p className="text-sm text-gray-500">{getTypeLabel()}</p>
                {resource.max_criticality === 'Critique' && (
                  <Badge className="mt-1 bg-red-100 text-red-700 border-red-200">
                    <AlertOctagon className="h-3 w-3 mr-1" />
                    Impact critique
                  </Badge>
                )}
              </div>
            </div>

            {isEditing ? (
              <div className="space-y-4 py-4">
                {renderForm()}
                <div className="flex gap-2 pt-4 border-t border-gray-200">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIsEditing(false);
                      setFormData({ ...resource });
                      setFormErrors({});
                    }} 
                    className="flex-1"
                    disabled={isSaving}
                  >
                    Annuler
                  </Button>
                  <Button 
                    onClick={handleSave} 
                    className="flex-1 bg-[#2A5141] hover:bg-[#1a3329] text-white"
                    disabled={isSaving || !formData.name?.trim()}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sauvegarde...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Sauvegarder
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-4">
                <div className="space-y-1">
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Informations générales</p>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Nom</span>
                      <span className="text-sm font-medium text-gray-900">{resource.name}</span>
                    </div>
                    {type === 'hr' && (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-500">Rôle</span>
                          <span className="text-sm text-gray-700">{resource.role || "—"}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-500">Email</span>
                          <span className="text-sm text-gray-700">{resource.email || "—"}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-500">Téléphone</span>
                          <span className="text-sm text-gray-700">{resource.phone || "—"}</span>
                        </div>
                      </>
                    )}
                    {type === 'equipment' && (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-500">Type</span>
                          <span className="text-sm text-gray-700">{resource.type || "—"}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-500">Quantité</span>
                          <span className="text-sm text-gray-700">{resource.quantity || 1}</span>
                        </div>
                      </>
                    )}
                    {type === 'app' && (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-500">Alternative</span>
                          <span className="text-sm text-gray-700">{resource.remplacablepar || "—"}</span>
                        </div>
                      </>
                    )}
                    {type === 'supplier' && (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-500">Service</span>
                          <span className="text-sm text-gray-700">{resource.service || "—"}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-500">Contact</span>
                          <span className="text-sm text-gray-700">{resource.contact || "—"}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {(resource.created_at || resource.updated_at) && (
                  <div className="space-y-1">
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Audit</p>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      {resource.created_at && (
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-3.5 w-3.5 text-gray-400" />
                          <span className="text-gray-500">Créée le</span>
                          <span className="font-medium text-gray-700">{formatDate(resource.created_at)}</span>
                        </div>
                      )}
                      {resource.updated_at && (
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-3.5 w-3.5 text-gray-400" />
                          <span className="text-gray-500">Dernière modification</span>
                          <span className="font-medium text-gray-700">{formatDate(resource.updated_at)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">
                    Processus liés ({linkedProcesses.length})
                  </p>
                  {linkedProcesses.length > 0 ? (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead className="text-xs font-semibold text-gray-400 py-2">Processus</TableHead>
                            <TableHead className="text-xs font-semibold text-gray-400 py-2">Criticité</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {linkedProcesses.map((p) => {
                            const crit = p.criticality || 'Mineur';
                            return (
                              <TableRow key={p.id} className="border-b border-gray-100">
                                <TableCell className="py-2 text-sm text-gray-700">{p.name}</TableCell>
                                <TableCell className="py-2">
                                  <Badge className={criticalityColors[crit as Criticality]}>
                                    {crit}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Aucun processus lié</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200">
                  <Button 
                    onClick={() => setIsEditing(true)}
                    className="flex-1 bg-[#2A5141] hover:bg-[#1a3329] text-white"
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Modifier
                  </Button>
                </div>
                <Button 
                  variant="outline"
                  onClick={() => onDelete(resource)}
                  className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </Button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

// ============================================================
// COMPOSANT - ImportExcelDialog (SANS RTO/RPO)
// ============================================================
const ImportExcelDialog = ({
  open,
  onOpenChange,
  resourceType,
  onImportComplete,
  entities,
  existingResources,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceType: ResourceType;
  onImportComplete: () => void;
  entities: any[];
  existingResources: any[];
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [file, setFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState<any[]>([]);
  const [editableData, setEditableData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<any>(null);
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [editRowData, setEditRowData] = useState<any>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [detectedResourceType, setDetectedResourceType] = useState<ResourceType | null>(null);

  const fieldDefinitions: Record<ResourceType, { key: string; label: string; required: boolean }[]> = {
    hr: [
      { key: 'name', label: 'Nom', required: true },
      { key: 'role', label: 'Rôle', required: false },
      { key: 'email', label: 'Email', required: false },
      { key: 'phone', label: 'Téléphone', required: false },
    ],
    equipment: [
      { key: 'name', label: 'Nom', required: true },
      { key: 'type', label: 'Type', required: false },
      { key: 'quantity', label: 'Quantité', required: false },
    ],
    app: [
      { key: 'name', label: 'Nom', required: true },
      { key: 'remplacablepar', label: 'Alternative', required: false },
    ],
    supplier: [
      { key: 'name', label: 'Nom', required: true },
      { key: 'service', label: 'Service', required: false },
      { key: 'contact', label: 'Contact', required: false },
    ],
  };

  const detectResourceType = (headers: string[]): ResourceType => {
    const normalized = headers.map(h => h.toLowerCase().trim());
    
    const typeIndicators: Record<ResourceType, string[]> = {
      hr: ['email', 'mail', '@', 'telephone', 'phone', 'mobile', 'prenom', 'prénom', 'role', 'fonction'],
      equipment: ['type', 'modele', 'modèle', 'reference', 'référence', 'quantite', 'quantité', 'serie', 'série', 'marque'],
      app: ['alternative', 'version', 'editeur', 'éditeur', 'logiciel', 'application'],
      supplier: ['service', 'contact', 'siret', 'adresse', 'activite', 'activité', 'fournisseur', 'prestataire']
    };

    const scores: Record<ResourceType, number> = {
      hr: 0,
      equipment: 0,
      app: 0,
      supplier: 0
    };

    for (const header of normalized) {
      for (const [type, indicators] of Object.entries(typeIndicators)) {
        for (const indicator of indicators) {
          if (header.includes(indicator)) {
            scores[type as ResourceType] += 2;
          }
        }
      }
      if (header.includes('nom') || header.includes('name')) {
        for (const type of Object.keys(scores) as ResourceType[]) {
          scores[type] += 1;
        }
      }
    }

    let maxScore = 0;
    let detectedType: ResourceType = 'hr';
    for (const [type, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        detectedType = type as ResourceType;
      }
    }

    return detectedType;
  };

  const autoMapColumns = (headers: string[], resourceType: ResourceType): Record<string, string> => {
    const mapping: Record<string, string> = {};
    const fields = fieldDefinitions[resourceType];
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim());

    for (const field of fields) {
      const fieldLabel = field.label.toLowerCase().trim();
      const fieldKey = field.key;
      
      let found = false;
      for (let i = 0; i < headers.length; i++) {
        const header = normalizedHeaders[i];
        if (header === fieldLabel || header === fieldKey) {
          mapping[headers[i]] = fieldKey;
          found = true;
          break;
        }
      }
      
      if (!found) {
        for (let i = 0; i < headers.length; i++) {
          const header = normalizedHeaders[i];
          if (header.includes(fieldLabel) || fieldLabel.includes(header) ||
              header.includes(fieldKey) || fieldKey.includes(header)) {
            mapping[headers[i]] = fieldKey;
            found = true;
            break;
          }
        }
      }
    }

    return mapping;
  };

  const processFile = (file: File) => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/)) {
      toast.error('Format de fichier non supporté. Utilisez .xlsx, .xls ou .csv');
      return;
    }

    setFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
        
        if (jsonData.length === 0) {
          toast.error('Le fichier est vide');
          return;
        }

        const detectedHeaders = Object.keys(jsonData[0]);
        setHeaders(detectedHeaders);
        setFileData(jsonData);
        setTotalRows(jsonData.length);
        
        const detectedType = detectResourceType(detectedHeaders);
        setDetectedResourceType(detectedType);
        
        const mapping = autoMapColumns(detectedHeaders, detectedType);
        
        const filteredData = jsonData.map(row => {
          const newRow: any = {};
          for (const [header, fieldKey] of Object.entries(mapping)) {
            if (fieldKey) {
              newRow[fieldKey] = row[header] || '';
            }
          }
          return newRow;
        });

        setEditableData(filteredData.map((row, index) => ({ ...row, _index: index, _isNew: true })));
        setTotalRows(filteredData.length);
        setStep(2);
        
        toast.success(`Fichier analysé : ${filteredData.length} lignes détectées (type: ${detectedType.toUpperCase()})`);
        
      } catch (error) {
        console.error('Erreur lecture fichier:', error);
        toast.error('Erreur lors de la lecture du fichier');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const startEditingRow = (index: number) => {
    setEditingRowIndex(index);
    setEditRowData({ ...editableData[index] });
  };

  const saveEditRow = () => {
    if (editingRowIndex === null) return;
    
    const updatedData = [...editableData];
    updatedData[editingRowIndex] = { ...editRowData };
    setEditableData(updatedData);
    setEditingRowIndex(null);
    setEditRowData({});
    toast.success('Ligne modifiée avec succès');
  };

  const cancelEditRow = () => {
    setEditingRowIndex(null);
    setEditRowData({});
  };

  const deleteRow = (index: number) => {
    if (!confirm(`Supprimer la ligne ${index + 1} ?`)) return;
    
    const updatedData = [...editableData];
    updatedData.splice(index, 1);
    setEditableData(updatedData);
    setTotalRows(updatedData.length);
    toast.success('Ligne supprimée');
  };

  const generateTemplate = () => {
    const fieldLabels = {
      hr: ['Nom', 'Rôle', 'Email', 'Téléphone'],
      equipment: ['Nom', 'Type', 'Quantité'],
      app: ['Nom', 'Alternative'],
      supplier: ['Nom', 'Service', 'Contact'],
    };
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([fieldLabels[resourceType]]);
    XLSX.utils.book_append_sheet(wb, ws, 'Ressources');
    XLSX.writeFile(wb, `template_${resourceType}.xlsx`);
  };

  const resetDialog = () => {
    setStep(1);
    setFile(null);
    setFileData([]);
    setEditableData([]);
    setHeaders([]);
    setTotalRows(0);
    setImportResult(null);
    setImportProgress(0);
    setEditingRowIndex(null);
    setEditRowData({});
    setDetectedResourceType(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImport = async () => {
    setIsUploading(true);
    setImportProgress(0);
    
    const results = { 
      created: 0, 
      updated: 0, 
      ignored: 0, 
      errors: 0, 
      errorDetails: [] as string[] 
    };
    
    const tableName = {
      hr: 'ressources_humaines',
      equipment: 'ressources_equipements',
      app: 'applications_it',
      supplier: 'fournisseurs',
    }[detectedResourceType || resourceType];

    for (let i = 0; i < editableData.length; i++) {
      const row = editableData[i];
      const item: any = {};
      
      for (const [key, value] of Object.entries(row)) {
        if (key !== '_index' && key !== '_isNew' && value !== undefined) {
          item[key] = value;
        }
      }

      if (!item.name) {
        results.errors++;
        results.errorDetails.push(`Ligne ${i + 1}: Nom manquant`);
        continue;
      }

      const existing = existingResources.find(r => 
        r.name?.toLowerCase() === item.name?.toLowerCase()
      );
      
      try {
        if (existing) {
          const { error } = await supabase
            .from(tableName)
            .update(item)
            .eq('id', existing.id);
          
          if (error) throw error;
          results.updated++;
        } else {
          const { error } = await supabase
            .from(tableName)
            .insert(item);
          
          if (error) throw error;
          results.created++;
        }
      } catch (err: any) {
        results.errors++;
        results.errorDetails.push(`Erreur ligne ${i + 1}: ${item.name} - ${err.message}`);
      }
      
      setImportProgress(Math.round(((i + 1) / editableData.length) * 100));
    }

    setImportResult(results);
    setIsUploading(false);
    
    if (results.created > 0 || results.updated > 0) {
      toast.success(
        `Import terminé: ${results.created} créée${results.created > 1 ? 's' : ''}, ` +
        `${results.updated} mise${results.updated > 1 ? 's' : ''} à jour`
      );
      
      setTimeout(() => {
        onImportComplete();
        onOpenChange(false);
      }, 500);
    } else if (results.errors > 0) {
      toast.error(`Import terminé avec ${results.errors} erreur${results.errors > 1 ? 's' : ''}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen && !isUploading) {
        resetDialog();
      }
      onOpenChange(newOpen);
    }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-[#2A5141]" />
            Importer depuis Excel
          </DialogTitle>
          <DialogDescription>
            {step === 1 ? 'Étape 1 : Sélectionnez votre fichier' : 'Étape 2 : Aperçu et modification des données'}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4 py-4">
            <div 
              className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-[#2A5141] transition-colors cursor-pointer"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Upload className="h-12 w-12 mx-auto text-gray-300" />
              <p className="mt-4 text-sm text-gray-500">
                Glissez-déposez votre fichier ici ou cliquez pour parcourir
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Formats acceptés : .xlsx, .xls, .csv
              </p>
              <p className="text-xs text-blue-600 mt-2">
                💡 Le système détecte automatiquement le type de ressource et les colonnes
              </p>
              {file && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg flex items-center gap-3">
                  <FileSpreadsheet className="h-5 w-5 text-[#2A5141]" />
                  <span className="text-sm font-medium">{file.name}</span>
                  <span className="text-xs text-gray-400">
                    {(file.size / 1024).toFixed(1)} KB
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center">
              <Button
                variant="outline"
                size="sm"
                className="text-[#2A5141] border-[#2A5141] hover:bg-gray-50"
                onClick={generateTemplate}
              >
                <Download className="h-4 w-4 mr-2" />
                Télécharger le modèle
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
                <Button
                  onClick={() => {
                    if (file && headers.length > 0) {
                      const detectedType = detectResourceType(headers);
                      setDetectedResourceType(detectedType);
                      const mapping = autoMapColumns(headers, detectedType);
                      
                      const filteredData = fileData.map(row => {
                        const newRow: any = {};
                        for (const [header, fieldKey] of Object.entries(mapping)) {
                          if (fieldKey) {
                            newRow[fieldKey] = row[header] || '';
                          }
                        }
                        return newRow;
                      });

                      setEditableData(filteredData.map((row, index) => ({ ...row, _index: index, _isNew: true })));
                      setTotalRows(filteredData.length);
                      setStep(2);
                    }
                  }}
                  disabled={!file}
                  className="bg-[#2A5141] hover:bg-[#1a3329] text-white"
                >
                  Suivant
                  <ChevronRightIcon className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 py-4">
            {!importResult ? (
              <>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <p className="text-sm text-green-700">
                      <span className="font-bold">{totalRows}</span> lignes prêtes à être importées
                    </p>
                  </div>
                  <Badge className="bg-green-100 text-green-700 border-green-200">
                    Type détecté: {detectedResourceType?.toUpperCase()}
                  </Badge>
                </div>

                <div className="border rounded-lg overflow-x-auto max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 sticky top-0 z-10">
                        <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider py-2 w-10">
                          #
                        </TableHead>
                        {editableData.length > 0 && Object.keys(editableData[0])
                          .filter(key => key !== '_index' && key !== '_isNew')
                          .map((key) => (
                            <TableHead key={key} className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider py-2">
                              {key}
                            </TableHead>
                          ))}
                        <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider py-2 text-center">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {editableData.map((row, index) => {
                        const isEditing = editingRowIndex === index;
                        const fieldKeys = Object.keys(row).filter(key => key !== '_index' && key !== '_isNew');
                        
                        return (
                          <TableRow 
                            key={index} 
                            className={cn(
                              "border-b border-gray-100",
                              index % 2 === 0 ? "bg-white" : "bg-gray-50/50",
                              isEditing && "bg-blue-50"
                            )}
                          >
                            <TableCell className="py-2 text-center text-sm text-gray-400">
                              {index + 1}
                            </TableCell>
                            {fieldKeys.map((fieldKey) => (
                              <TableCell key={fieldKey} className="py-2">
                                {isEditing ? (
                                  <Input
                                    value={editRowData[fieldKey] || ''}
                                    onChange={(e) => setEditRowData({ ...editRowData, [fieldKey]: e.target.value })}
                                    className="h-8 text-sm border-gray-200"
                                    placeholder="..."
                                  />
                                ) : (
                                  <span className="text-sm text-gray-700">
                                    {row[fieldKey] || ''}
                                  </span>
                                )}
                              </TableCell>
                            ))}
                            <TableCell className="py-2 text-center">
                              {isEditing ? (
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={saveEditRow}
                                    title="Sauvegarder"
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                                    onClick={cancelEditRow}
                                    title="Annuler"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-gray-400 hover:text-[#2A5141] hover:bg-gray-50"
                                    onClick={() => startEditingRow(index)}
                                    title="Modifier"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-gray-300 hover:text-red-600 hover:bg-red-50"
                                    onClick={() => deleteRow(index)}
                                    title="Supprimer"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                    <tfoot>
                      <TableRow className="bg-gray-50 border-t-2 border-gray-200 sticky bottom-0">
                        <TableCell colSpan={Object.keys(editableData[0] || {}).filter(key => key !== '_index' && key !== '_isNew').length + 2} className="py-3 px-3 font-medium text-sm text-gray-700">
                          Total : <span className="text-[#2A5141]">{editableData.length}</span> lignes à importer
                        </TableCell>
                      </TableRow>
                    </tfoot>
                  </Table>
                </div>

                {isUploading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Import en cours...</span>
                      <span>{Math.round((importProgress / editableData.length) * 100)}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[#2A5141] transition-all duration-300"
                        style={{ width: `${(importProgress / editableData.length) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Retour
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={isUploading || editableData.length === 0}
                    className="bg-[#2A5141] hover:bg-[#1a3329] text-white"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Import en cours...
                      </>
                    ) : (
                      <>
                        <FileUp className="h-4 w-4 mr-2" />
                        Importer {editableData.length} lignes
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  <Card className="border-gray-200">
                    <CardContent className="p-4 text-center">
                      <p className="text-xs text-gray-400">Créées</p>
                      <p className="text-2xl font-bold text-green-600">{importResult.created}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-gray-200">
                    <CardContent className="p-4 text-center">
                      <p className="text-xs text-gray-400">Mises à jour</p>
                      <p className="text-2xl font-bold text-blue-600">{importResult.updated}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-gray-200">
                    <CardContent className="p-4 text-center">
                      <p className="text-xs text-gray-400">Ignorées</p>
                      <p className="text-2xl font-bold text-gray-400">{importResult.ignored}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-gray-200">
                    <CardContent className="p-4 text-center">
                      <p className="text-xs text-gray-400">Erreurs</p>
                      <p className={cn("text-2xl font-bold", importResult.errors > 0 ? "text-red-500" : "text-gray-400")}>
                        {importResult.errors}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {importResult.errorDetails?.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-32 overflow-y-auto">
                    <p className="text-sm font-medium text-red-700 mb-2">Détails des erreurs :</p>
                    <ul className="text-xs text-red-600 space-y-1">
                      {importResult.errorDetails.map((err: string, i: number) => (
                        <li key={i}>• {err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      resetDialog();
                      onOpenChange(false);
                      onImportComplete();
                    }}
                  >
                    Terminer
                  </Button>
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
// COMPOSANT - EmptyState
// ============================================================
const EmptyState = ({ 
  type, 
  onAdd,
  onImport,
}: { 
  type: ResourceType; 
  onAdd: () => void;
  onImport: () => void;
}) => {
  const getIcon = () => {
    switch(type) {
      case 'hr': return <Users className="h-12 w-12 text-gray-300" />;
      case 'equipment': return <Monitor className="h-12 w-12 text-gray-300" />;
      case 'app': return <Server className="h-12 w-12 text-gray-300" />;
      case 'supplier': return <Handshake className="h-12 w-12 text-gray-300" />;
      default: return <Building2 className="h-12 w-12 text-gray-300" />;
    }
  };

  const getLabel = () => {
    switch(type) {
      case 'hr': return 'collaborateurs';
      case 'equipment': return 'équipements';
      case 'app': return 'applications';
      case 'supplier': return 'prestataires';
      default: return 'ressources';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center mb-4">
        {getIcon()}
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-1">Aucune ressource</h3>
      <p className="text-sm text-gray-400 mb-6">
        Aucun {getLabel()} trouvé dans le référentiel.
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        <Button 
          onClick={onAdd}
          className="bg-[#2A5141] hover:bg-[#1a3329] text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Ajouter une ressource
        </Button>
        <Button
          variant="outline"
          onClick={onImport}
          className="text-[#2A5141] border-[#2A5141] hover:bg-gray-50"
        >
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Importer depuis Excel
        </Button>
      </div>
    </div>
  );
};

// ============================================================
// COMPOSANT PRINCIPAL - CMDBModule
// ============================================================
const CMDBModule = () => {
  const { entities } = useGovernance();
  const [activeTab, setActiveTab] = useState<ResourceType>('hr');
  const [searchQuery, setSearchQuery] = useState("");
  const [usageFilter, setUsageFilter] = useState<UsageFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [isLoading, setIsLoading] = useState(true);
  const [resources, setResources] = useState<Record<ResourceType, any[]>>({
    hr: [],
    equipment: [],
    app: [],
    supplier: []
  });
  const [selectedResource, setSelectedResource] = useState<any | null>(null);
  const [selectedResourceProcesses, setSelectedResourceProcesses] = useState<any[]>([]);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [refreshKey, setRefreshKey] = useState(0);

  const totalResources = Object.values(resources).reduce((acc, arr) => acc + arr.length, 0);
  const totalUnused = Object.values(resources).reduce((acc, arr) => arr.filter(r => r.used_by_count === 0).length + acc, 0);
  const totalUsed = totalResources - totalUnused;
  const totalLinks = Object.values(resources).reduce((acc, arr) => arr.reduce((sum, r) => sum + (r.used_by_count || 0), 0) + acc, 0);
  const unusedThreshold = totalResources > 0 ? totalUnused / totalResources : 0;

  const loadResources = useCallback(async () => {
    console.log('🔄 Chargement des ressources... (refreshKey:', refreshKey, ')');
    setIsLoading(true);
    try {
      const { data: hrData } = await supabase.from('ressources_humaines').select('*');
      const { data: equipData } = await supabase.from('ressources_equipements').select('*');
      const { data: appData } = await supabase.from('applications_it').select('*');
      const { data: suppData } = await supabase.from('fournisseurs').select('*');

      console.log('📊 Données brutes:', {
        hr: hrData?.length || 0,
        equip: equipData?.length || 0,
        app: appData?.length || 0,
        supp: suppData?.length || 0
      });

      const getUsageCount = async (table: string, idColumn: string, ids: string[]) => {
        if (!ids.length) return {};
        const { data } = await supabase
          .from(table)
          .select(`${idColumn}, processus_id, processus_metier(id, name, impacts)`)
          .in(idColumn, ids);
        
        const counts: Record<string, { count: number; processes: string[]; processNames: string[]; processCriticalities: Record<string, Criticality> }> = {};
        
        for (const item of ((data as any[]) || [])) {
          const id = item[idColumn];
          if (!counts[id]) {
            counts[id] = { count: 0, processes: [], processNames: [], processCriticalities: {} };
          }
          counts[id].count++;
          counts[id].processes.push(item.processus_id);
          if (item.processus_metier?.name) {
            counts[id].processNames.push(item.processus_metier.name);
          }
          if (item.processus_metier?.impacts) {
            const score = computeMaxScoreFromImpacts(item.processus_metier.impacts);
            const criticality = scoreToCriticality(score);
            counts[id].processCriticalities[item.processus_id] = criticality;
          }
        }
        return counts;
      };

      const hrIds = hrData?.map((r: any) => r.id) || [];
      const equipIds = equipData?.map((r: any) => r.id) || [];
      const appIds = appData?.map((r: any) => r.id) || [];
      const suppIds = suppData?.map((r: any) => r.id) || [];

      const [hrCounts, equipCounts, appCounts, suppCounts] = await Promise.all([
        getUsageCount('processus_ressources_humaines', 'ressource_humaine_id', hrIds),
        getUsageCount('processus_equipements', 'equipement_id', equipIds),
        getUsageCount('processus_applications', 'application_id', appIds),
        getUsageCount('processus_fournisseurs', 'fournisseur_id', suppIds),
      ]);

      const computeMaxCriticality = (counts: any, id: string) => {
        if (!counts[id] || Object.keys(counts[id].processCriticalities).length === 0) return null;
        const criticalities = Object.values(counts[id].processCriticalities);
        if (criticalities.includes('Critique')) return 'Critique';
        if (criticalities.includes('Majeur')) return 'Majeur';
        if (criticalities.includes('Modéré')) return 'Modéré';
        return 'Mineur';
      };

      const enrichedHR = hrData?.map((r: any) => ({
        ...r,
        used_by_count: hrCounts[r.id]?.count || 0,
        process_ids: hrCounts[r.id]?.processes || [],
        process_names: hrCounts[r.id]?.processNames || [],
        process_criticalities: hrCounts[r.id]?.processCriticalities || {},
        max_criticality: computeMaxCriticality(hrCounts, r.id),
        department_name: entities.find(e => e.id === r.department_id)?.name || null,
      })) || [];

      const enrichedEquip = equipData?.map((r: any) => ({
        ...r,
        used_by_count: equipCounts[r.id]?.count || 0,
        process_ids: equipCounts[r.id]?.processes || [],
        process_names: equipCounts[r.id]?.processNames || [],
        process_criticalities: equipCounts[r.id]?.processCriticalities || {},
        max_criticality: computeMaxCriticality(equipCounts, r.id),
        department_name: entities.find(e => e.id === r.department_id)?.name || null,
      })) || [];

      const enrichedApp = appData?.map((r: any) => ({
        ...r,
        used_by_count: appCounts[r.id]?.count || 0,
        process_ids: appCounts[r.id]?.processes || [],
        process_names: appCounts[r.id]?.processNames || [],
        process_criticalities: appCounts[r.id]?.processCriticalities || {},
        max_criticality: computeMaxCriticality(appCounts, r.id),
        department_name: entities.find(e => e.id === r.department_id)?.name || null,
      })) || [];

      const enrichedSupp = suppData?.map((r: any) => ({
        ...r,
        used_by_count: suppCounts[r.id]?.count || 0,
        process_ids: suppCounts[r.id]?.processes || [],
        process_names: suppCounts[r.id]?.processNames || [],
        process_criticalities: suppCounts[r.id]?.processCriticalities || {},
        max_criticality: computeMaxCriticality(suppCounts, r.id),
        department_name: entities.find(e => e.id === r.department_id)?.name || null,
      })) || [];

      console.log('✅ Ressources enrichies:', {
        hr: enrichedHR.length,
        equipment: enrichedEquip.length,
        app: enrichedApp.length,
        supplier: enrichedSupp.length
      });

      setResources({
        hr: enrichedHR,
        equipment: enrichedEquip,
        app: enrichedApp,
        supplier: enrichedSupp
      });

    } catch (error) {
      console.error('❌ Erreur chargement CMDB:', error);
      toast.error("Erreur lors du chargement des ressources");
    } finally {
      setIsLoading(false);
    }
  }, [entities, refreshKey]);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  const getFilteredResources = (type: ResourceType) => {
    let data = resources[type] || [];
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter((r: any) => 
        r.name?.toLowerCase().includes(q) ||
        r.type?.toLowerCase().includes(q) ||
        r.role?.toLowerCase().includes(q) ||
        r.service?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q)
      );
    }

    if (usageFilter === "used") {
      data = data.filter((r: any) => r.used_by_count > 0);
    } else if (usageFilter === "unused") {
      data = data.filter((r: any) => r.used_by_count === 0);
    }

    return data;
  };

  const handleKpiClick = (filter: UsageFilter) => {
    if (filter === 'all') {
      setUsageFilter('all');
      return;
    }
    if (usageFilter === filter) {
      setUsageFilter('all');
    } else {
      setUsageFilter(filter);
    }
  };

  const deleteResource = async (resource: any) => {
    if (!confirm(`⚠️ Supprimer définitivement "${resource.name}" ?\n\nCette action est irréversible.`)) return;

    const tables = {
      hr: { main: 'ressources_humaines', link: 'processus_ressources_humaines', idColumn: 'ressource_humaine_id' },
      equipment: { main: 'ressources_equipements', link: 'processus_equipements', idColumn: 'equipement_id' },
      app: { main: 'applications_it', link: 'processus_applications', idColumn: 'application_id' },
      supplier: { main: 'fournisseurs', link: 'processus_fournisseurs', idColumn: 'fournisseur_id' },
    };

    try {
      await supabase.from(tables[activeTab].link).delete().eq(tables[activeTab].idColumn, resource.id);
      await supabase.from(tables[activeTab].main).delete().eq('id', resource.id);
      toast.success(`"${resource.name}" supprimé avec succès`);
      setRefreshKey(prev => prev + 1);
    } catch (error: any) {
      toast.error("Erreur: " + error.message);
    }
  };

  const openEdit = (resource: any) => {
    setSelectedResource(resource);
    setFormData({ ...resource });
    setFormErrors({});
    setIsDetailOpen(false);
    setIsEditOpen(true);
  };

  const openDetail = (resource: any) => {
    const processIds = resource.process_ids || [];
    const processNames = resource.process_names || [];
    const processCriticalities = resource.process_criticalities || {};
    
    const processes = processIds.map((id: string, index: number) => ({
      id,
      name: processNames[index] || id,
      criticality: processCriticalities[id] || 'Mineur',
    }));
    
    setSelectedResourceProcesses(processes);
    setSelectedResource(resource);
    setIsDetailOpen(true);
  };

  const validateForm = (data: any) => {
    const errors: Record<string, string> = {};
    if (!data.name?.trim()) {
      errors.name = "Le nom est requis";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveEdit = async () => {
    if (!selectedResource || !validateForm(formData)) return;
    
    const type = activeTab;
    const tables = {
      hr: 'ressources_humaines',
      equipment: 'ressources_equipements',
      app: 'applications_it',
      supplier: 'fournisseurs',
    };

    try {
      await supabase.from(tables[type]).update(formData).eq('id', selectedResource.id);
      toast.success("Ressource mise à jour");
      setIsEditOpen(false);
      setRefreshKey(prev => prev + 1);
    } catch (error: any) {
      toast.error("Erreur: " + error.message);
    }
  };

  const createResource = async () => {
    if (!validateForm(formData)) return;

    const type = activeTab;
    const tables = {
      hr: 'ressources_humaines',
      equipment: 'ressources_equipements',
      app: 'applications_it',
      supplier: 'fournisseurs',
    };

    try {
      await supabase.from(tables[type]).insert(formData);
      toast.success("Ressource créée avec succès");
      setIsCreateOpen(false);
      setFormData({});
      setFormErrors({});
      setRefreshKey(prev => prev + 1);
    } catch (error: any) {
      toast.error("Erreur: " + error.message);
    }
  };

  const viewProcesses = (resource: any) => {
    openDetail(resource);
  };

  const renderForm = (type: ResourceType, data: any, onChange: (d: any) => void) => {
    const forms = {
      hr: (
        <>
          <div>
            <Label className="text-sm font-medium">Nom *</Label>
            <Input 
              value={data.name || ""} 
              onChange={(e) => onChange({ ...data, name: e.target.value })}
              placeholder="Nom complet"
              className={cn("mt-1", formErrors.name && "border-red-400")}
            />
            {formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>}
          </div>
          <div>
            <Label className="text-sm font-medium">Rôle</Label>
            <Input 
              value={data.role || ""} 
              onChange={(e) => onChange({ ...data, role: e.target.value })}
              placeholder="Ex: Chef de projet"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Email</Label>
            <Input 
              type="email"
              value={data.email || ""} 
              onChange={(e) => onChange({ ...data, email: e.target.value })}
              placeholder="email@domaine.com"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Téléphone</Label>
            <Input 
              value={data.phone || ""} 
              onChange={(e) => onChange({ ...data, phone: e.target.value })}
              placeholder="+33 6..."
              className="mt-1"
            />
          </div>
        </>
      ),
      equipment: (
        <>
          <div>
            <Label className="text-sm font-medium">Nom *</Label>
            <Input 
              value={data.name || ""} 
              onChange={(e) => onChange({ ...data, name: e.target.value })}
              placeholder="Ex: Serveur Dell R740"
              className={cn("mt-1", formErrors.name && "border-red-400")}
            />
            {formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>}
          </div>
          <div>
            <Label className="text-sm font-medium">Type</Label>
            <Input 
              value={data.type || ""} 
              onChange={(e) => onChange({ ...data, type: e.target.value })}
              placeholder="Ex: Serveur, Poste, Switch"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Quantité</Label>
            <Input 
              type="number"
              min={1}
              value={data.quantity || 1} 
              onChange={(e) => onChange({ ...data, quantity: Number(e.target.value) })}
              className="mt-1"
            />
          </div>
        </>
      ),
      app: (
        <>
          <div>
            <Label className="text-sm font-medium">Nom *</Label>
            <Input 
              value={data.name || ""} 
              onChange={(e) => onChange({ ...data, name: e.target.value })}
              placeholder="Ex: SAP S/4HANA"
              className={cn("mt-1", formErrors.name && "border-red-400")}
            />
            {formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>}
          </div>
          <div>
            <Label className="text-sm font-medium">Application alternative</Label>
            <Input 
              value={data.remplacablepar || ""} 
              onChange={(e) => onChange({ ...data, remplacablepar: e.target.value })}
              placeholder="Ex: Backup manuel..."
              className="mt-1"
            />
          </div>
        </>
      ),
      supplier: (
        <>
          <div>
            <Label className="text-sm font-medium">Nom *</Label>
            <Input 
              value={data.name || ""} 
              onChange={(e) => onChange({ ...data, name: e.target.value })}
              placeholder="Ex: AWS"
              className={cn("mt-1", formErrors.name && "border-red-400")}
            />
            {formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>}
          </div>
          <div>
            <Label className="text-sm font-medium">Service</Label>
            <Input 
              value={data.service || ""} 
              onChange={(e) => onChange({ ...data, service: e.target.value })}
              placeholder="Ex: Hébergement cloud"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Contact</Label>
            <Input 
              value={data.contact || ""} 
              onChange={(e) => onChange({ ...data, contact: e.target.value })}
              placeholder="Nom du contact"
              className="mt-1"
            />
          </div>
        </>
      ),
    };

    return forms[type];
  };

  const renderContent = (type: ResourceType) => {
    const data = getFilteredResources(type);

    if (isLoading) {
      return viewMode === 'list' ? <SkeletonLoader rows={5} /> : <SkeletonGrid count={6} />;
    }

    if (data.length === 0) {
      return (
        <EmptyState 
          type={type}
          onAdd={() => {
            setFormData({});
            setFormErrors({});
            setIsCreateOpen(true);
          }}
          onImport={() => setIsImportOpen(true)}
        />
      );
    }

    if (viewMode === 'grid') {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
          {data.map((item) => (
            <ResourceGridCard
              key={item.id}
              resource={item}
              type={type}
              onEdit={openEdit}
              onDelete={deleteResource}
              onViewProcesses={viewProcesses}
              onClick={openDetail}
            />
          ))}
        </div>
      );
    }

    return (
      <ResourceTable
        data={data}
        type={type}
        onEdit={openEdit}
        onDelete={deleteResource}
        onViewProcesses={viewProcesses}
        onClick={openDetail}
      />
    );
  };

  return (
    <div className="space-y-6">
      <ImportExcelDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        resourceType={activeTab}
        onImportComplete={() => {
          console.log('🔄 Rechargement après import...');
          setRefreshKey(prev => prev + 1);
        }}
        entities={entities}
        existingResources={resources[activeTab] || []}
      />

      {selectedResource && (
        <ResourceDetailSheet
          resource={selectedResource}
          type={activeTab}
          open={isDetailOpen}
          onOpenChange={setIsDetailOpen}
          onEdit={openEdit}
          onDelete={deleteResource}
          processes={selectedResourceProcesses}
          onResourceUpdated={() => {
            setRefreshKey(prev => prev + 1);
          }}
        />
      )}

      <div>
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Référentiel des ressources
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Gestion centralisée de toutes les ressources de l'entreprise
            </p>
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap">
            <Button 
              onClick={() => {
                setFormData({});
                setFormErrors({});
                setIsCreateOpen(true);
              }}
              className="gap-2 bg-[#2A5141] hover:bg-[#1a3329] text-white"
            >
              <Plus className="h-4 w-4" />
              Ajouter
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsImportOpen(true)}
              className="gap-2 text-[#2A5141] border-[#2A5141] hover:bg-gray-50"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Importer
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <KpiCard
            label="Total ressources"
            value={totalResources}
            icon={<Database className="h-4 w-4" />}
            onClick={() => handleKpiClick('all')}
            isActive={usageFilter === 'all'}
          />
          <KpiCard
            label="Utilisées"
            value={totalUsed}
            icon={<CheckCircle className="h-4 w-4" />}
            color="#2A5141"
            onClick={() => handleKpiClick('used')}
            isActive={usageFilter === 'used'}
            subtitle={`${totalResources > 0 ? Math.round((totalUsed / totalResources) * 100) : 0}%`}
          />
          <KpiCard
            label="Non utilisées"
            value={totalUnused}
            icon={<AlertCircle className="h-4 w-4" />}
            color={unusedThreshold > 0.3 ? "#f97316" : "#2A5141"}
            onClick={() => handleKpiClick('unused')}
            isActive={usageFilter === 'unused'}
            alertThreshold={unusedThreshold > 0.3 ? { 
              value: totalUnused, 
              message: `${Math.round(unusedThreshold * 100)}% des ressources` 
            } : undefined}
            subtitle={`${totalResources > 0 ? Math.round((totalUnused / totalResources) * 100) : 0}%`}
          />
          <KpiCard
            label="Processus liés"
            value={totalLinks}
            icon={<Link className="h-4 w-4" />}
            color="#2A5141"
            isClickable={false}
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input 
            placeholder="Rechercher une ressource..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 border-gray-200 focus:border-[#2A5141] focus:ring-[#2A5141]/20"
          />
        </div>

        <Select value={usageFilter} onValueChange={(v) => setUsageFilter(v as UsageFilter)}>
          <SelectTrigger className="w-full sm:w-[140px] border-gray-200">
            <SelectValue placeholder="Toutes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            <SelectItem value="used">Utilisées</SelectItem>
            <SelectItem value="unused">Non utilisées</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 whitespace-nowrap">
            {getFilteredResources(activeTab).length} / {resources[activeTab]?.length || 0}
          </span>
          <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as ViewMode)} className="border border-gray-200 rounded-lg p-0.5 bg-white">
            <ToggleGroupItem value="list" className="h-8 w-8 p-0 data-[state=on]:bg-[#2A5141] data-[state=on]:text-white rounded">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="grid" className="h-8 w-8 p-0 data-[state=on]:bg-[#2A5141] data-[state=on]:text-white rounded">
              <Grid3X3 className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ResourceType)} className="w-full">
        <TabsList className="bg-transparent border-b border-gray-200 rounded-none p-0 h-auto gap-0 flex flex-wrap">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const count = resources[tab.id as ResourceType]?.length || 0;
            const isActive = activeTab === tab.id;
            return (
              <TabsTrigger 
                key={tab.id}
                value={tab.id}
                className={cn(
                  "rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-gray-500 flex items-center gap-2 transition-all",
                  isActive && "border-[#2A5141] text-gray-900 bg-gray-50/50"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                <Badge variant="outline" className="text-xs bg-gray-50 border-gray-200 text-gray-500 ml-1">
                  {count}
                </Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {TABS.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="pt-4">
            <Card className="border-gray-200 shadow-sm">
              <CardContent className="p-0">
                {renderContent(tab.id as ResourceType)}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={isCreateOpen} onOpenChange={(open) => {
        if (!open) {
          setFormData({});
          setFormErrors({});
        }
        setIsCreateOpen(open);
      }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Plus className="h-5 w-5 text-[#2A5141]" />
              Ajouter une ressource
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            {renderForm(activeTab, formData, setFormData)}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => {
              setIsCreateOpen(false);
              setFormData({});
              setFormErrors({});
            }}>Annuler</Button>
            <Button onClick={createResource} className="bg-[#2A5141] hover:bg-[#1a3329] text-white">
              <Save className="h-4 w-4 mr-2" />
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={isEditOpen} onOpenChange={(open) => {
        if (!open) {
          setFormData({});
          setFormErrors({});
          setSelectedResource(null);
        }
        setIsEditOpen(open);
      }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Modifier la ressource</SheetTitle>
            <SheetDescription>
              Modifiez les informations de la ressource
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            {selectedResource && renderForm(activeTab, formData, setFormData)}
          </div>
          <div className="flex gap-2 pt-4 border-t border-gray-200">
            <Button variant="outline" onClick={() => {
              setIsEditOpen(false);
              setFormData({});
              setFormErrors({});
              setSelectedResource(null);
            }} className="flex-1">
              Annuler
            </Button>
            <Button onClick={saveEdit} className="flex-1 bg-[#2A5141] hover:bg-[#1a3329] text-white">
              <Save className="h-4 w-4 mr-2" />
              Sauvegarder
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default CMDBModule;