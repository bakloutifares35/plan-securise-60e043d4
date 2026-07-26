import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  AlertCircle, Database, Clock, Server, TrendingUp, AlertTriangle, 
  Building2, Activity, Globe, Shield, Download, RefreshCw,
  Users, Monitor, Handshake, FileText, CheckCircle, XCircle,
  ChevronDown, ChevronRight, Package, Wifi, HardDrive, Cpu,
  Printer, FileSpreadsheet, Layers, BarChart3, PieChart,
  Target, Zap, Gauge, ShieldCheck, ArrowUpRight, ArrowDownRight,
  CircleDot, Square, LayoutDashboard, ListChecks, Briefcase
} from 'lucide-react';
import { useBia } from '@/contexts/BiaContext';
import { useGovernance } from '@/contexts/GovernanceContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { scoreToCriticality, criticalityColor } from '@/data/bia';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Types
interface ProcessWithResources {
  id: string;
  name: string;
  department: string;
  entityId: string;
  owner: string;
  rto: number;
  rpo: number;
  mtpd: number;
  impacts: any;
  depends_on: string[];
  linkedHR: any[];
  linkedEquipment: any[];
  linkedApps: any[];
  linkedSuppliers: any[];
}

interface ImpactSeverity {
  financier: number;
  conformite: number;
  operationnel: number;
  reputationnel: number;
}

interface DirectionDetail {
  services: Set<string>;
  count: number;
  critiques: number;
  complet: number;
  apps: Set<string>;
  suppliers: Set<string>;
  rtoMin: number;
  processes: ProcessWithResources[];
}

// ============================================================
// COMPOSANT - StatCard
// ============================================================
const StatCard = ({ 
  label, 
  value, 
  sub, 
  icon, 
  trend, 
  trendLabel,
  color 
}: { 
  label: string; 
  value: string | number; 
  sub?: string; 
  icon: React.ReactNode;
  trend?: number;
  trendLabel?: string;
  color?: string;
}) => {
  return (
    <Card className="border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 group">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1" style={{ fontFamily: 'Playfair Display, serif' }}>
              {value}
            </p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          </div>
          <div className={cn(
            "p-2 rounded-lg transition-colors",
            color || "bg-[#2A5141]/10 text-[#2A5141]"
          )}>
            {icon}
          </div>
        </div>
        {trend !== undefined && (
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-100">
            {trend >= 0 ? (
              <ArrowUpRight className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
            )}
            <span className={cn(
              "text-xs font-medium",
              trend >= 0 ? "text-green-600" : "text-red-600"
            )}>
              {Math.abs(trend)}%
            </span>
            <span className="text-xs text-gray-400">{trendLabel || 'vs mois dernier'}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ============================================================
// COMPOSANT - DistributionBar
// ============================================================
const DistributionBar = ({ 
  label, 
  count, 
  total, 
  color,
  maxCount 
}: { 
  label: string; 
  count: number; 
  total: number;
  color: string;
  maxCount: number;
}) => {
  const percentage = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
  const percentOfTotal = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 hover:border-gray-300 transition-colors">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-gray-700">≤ {label}</span>
        <span className="text-lg font-bold text-gray-900">{count}</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs text-gray-400">{percentOfTotal}% du total</span>
        <span className="text-xs font-medium" style={{ color }}>{count} processus</span>
      </div>
    </div>
  );
};

// ============================================================
// COMPOSANT - ResourceTable
// ============================================================
const ResourceTable = ({ 
  data, 
  paliers 
}: { 
  data: any[]; 
  paliers: any[];
}) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-3 font-semibold text-gray-400 text-xs uppercase tracking-wider">
              RESSOURCE
            </th>
            {paliers.map(p => (
              <th key={p.label} className="text-center py-3 px-3 font-semibold text-gray-400 text-xs uppercase tracking-wider">
                {p.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((rt, idx) => {
            const Icon = rt.icon;
            return (
              <tr key={rt.key} className={cn(
                "transition-colors",
                idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
              )}>
                <td className="py-2.5 px-3 font-medium text-gray-700">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-gray-400" />
                    {rt.label}
                  </div>
                </td>
                {rt.values.map((val: number, i: number) => (
                  <td key={i} className="text-center py-2.5 px-3 font-mono font-bold text-gray-900">
                    {val}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200 bg-gray-50">
            <td className="py-2.5 px-3 font-semibold text-gray-700">TOTAL</td>
            {paliers.map((p, i) => {
              const total = data.reduce((sum, rt) => sum + rt.values[i], 0);
              return (
                <td key={i} className="text-center py-2.5 px-3 font-bold text-[#2A5141]">
                  {total}
                </td>
              );
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

// ============================================================
// COMPOSANT - TopItemCard
// ============================================================
const TopItemCard = ({ 
  items, 
  title, 
  icon, 
  color,
  badgeColor,
  subKey,
  subLabel
}: { 
  items: any[]; 
  title: string; 
  icon: React.ReactNode;
  color: string;
  badgeColor: string;
  subKey?: string;
  subLabel?: string;
}) => {
  if (items.length === 0) {
    return (
      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className={cn("p-1.5 rounded", color)}>{icon}</div>
            <CardTitle className="text-sm font-semibold text-gray-700">{title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-gray-400 text-sm">
            Aucune donnée disponible
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className={cn("p-1.5 rounded", color)}>{icon}</div>
          <CardTitle className="text-sm font-semibold text-gray-700">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={item.name} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400">#{index + 1}</span>
                  <p className="font-medium text-sm text-gray-800 truncate">{item.name}</p>
                </div>
                {subKey && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {subLabel || ''}: {item[subKey] || '—'}
                  </p>
                )}
              </div>
              <Badge className={cn("text-xs", badgeColor)}>
                {item.count}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// ============================================================
// COMPOSANT PRINCIPAL - BIASynthesis
// ============================================================
const BIASynthesis: React.FC = () => {
  const { processes } = useBia();
  const { entities } = useGovernance();
  const contentRef = useRef<HTMLDivElement>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [enrichedProcesses, setEnrichedProcesses] = useState<ProcessWithResources[]>([]);
  const [allHR, setAllHR] = useState<any[]>([]);
  const [allEquipment, setAllEquipment] = useState<any[]>([]);
  const [allApps, setAllApps] = useState<any[]>([]);
  const [allSuppliers, setAllSuppliers] = useState<any[]>([]);
  const [expandedDirections, setExpandedDirections] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

  // ============================================================
  // 1. CHARGEMENT DES DONNÉES
  // ============================================================
  const loadAllResources = useCallback(async () => {
    setIsLoading(true);
    try {
      const processIds = processes.map(p => p.id);
      
      if (processIds.length === 0) {
        setIsLoading(false);
        return;
      }

      const { data: hrLinks } = await supabase
        .from('processus_ressources_humaines')
        .select('processus_id, ressource_humaine_id')
        .in('processus_id', processIds);

      const hrIds = hrLinks ? hrLinks.map(l => l.ressource_humaine_id) : [];
      let hrData: any[] = [];
      if (hrIds.length > 0) {
        const { data } = await supabase
          .from('ressources_humaines')
          .select('*')
          .in('id', hrIds);
        hrData = data || [];
      }

      const { data: equipLinks } = await supabase
        .from('processus_equipements')
        .select('processus_id, equipement_id, rto_hours')
        .in('processus_id', processIds);

      const equipIds = equipLinks ? equipLinks.map(l => l.equipement_id) : [];
      let equipData: any[] = [];
      if (equipIds.length > 0) {
        const { data } = await supabase
          .from('ressources_equipements')
          .select('*')
          .in('id', equipIds);
        equipData = data || [];
        equipData = equipData.map(eq => {
          const link = equipLinks?.find(l => l.equipement_id === eq.id);
          return { ...eq, _linkRto: link?.rto_hours || 4 };
        });
      }

      const { data: appLinks } = await supabase
        .from('processus_applications')
        .select('processus_id, application_id, rto_hours, rpo_hours')
        .in('processus_id', processIds);

      const appIds = appLinks ? appLinks.map(l => l.application_id) : [];
      let appData: any[] = [];
      if (appIds.length > 0) {
        const { data } = await supabase
          .from('applications_it')
          .select('*')
          .in('id', appIds);
        appData = data || [];
        appData = appData.map(app => {
          const link = appLinks?.find(l => l.application_id === app.id);
          return { 
            ...app, 
            _linkRto: link?.rto_hours || 4,
            _linkRpo: link?.rpo_hours || 2
          };
        });
      }

      const { data: suppLinks } = await supabase
        .from('processus_fournisseurs')
        .select('processus_id, fournisseur_id, rto_hours')
        .in('processus_id', processIds);

      const suppIds = suppLinks ? suppLinks.map(l => l.fournisseur_id) : [];
      let suppData: any[] = [];
      if (suppIds.length > 0) {
        const { data } = await supabase
          .from('fournisseurs')
          .select('*')
          .in('id', suppIds);
        suppData = data || [];
        suppData = suppData.map(sup => {
          const link = suppLinks?.find(l => l.fournisseur_id === sup.id);
          return { ...sup, _linkRto: link?.rto_hours || 4 };
        });
      }

      setAllHR(hrData);
      setAllEquipment(equipData);
      setAllApps(appData);
      setAllSuppliers(suppData);

      const hrMap: Record<string, any[]> = {};
      const equipMap: Record<string, any[]> = {};
      const appMap: Record<string, any[]> = {};
      const suppMap: Record<string, any[]> = {};

      for (const pid of processIds) {
        hrMap[pid] = [];
        equipMap[pid] = [];
        appMap[pid] = [];
        suppMap[pid] = [];
      }

      if (hrLinks) {
        for (const link of hrLinks) {
          const hr = hrData.find(h => h.id === link.ressource_humaine_id);
          if (hr) hrMap[link.processus_id].push(hr);
        }
      }

      if (equipLinks) {
        for (const link of equipLinks) {
          const eq = equipData.find(e => e.id === link.equipement_id);
          if (eq) equipMap[link.processus_id].push(eq);
        }
      }

      if (appLinks) {
        for (const link of appLinks) {
          const app = appData.find(a => a.id === link.application_id);
          if (app) appMap[link.processus_id].push(app);
        }
      }

      if (suppLinks) {
        for (const link of suppLinks) {
          const sup = suppData.find(s => s.id === link.fournisseur_id);
          if (sup) suppMap[link.processus_id].push(sup);
        }
      }

      const enriched = processes.map(p => ({
        ...p,
        linkedHR: hrMap[p.id] || [],
        linkedEquipment: equipMap[p.id] || [],
        linkedApps: appMap[p.id] || [],
        linkedSuppliers: suppMap[p.id] || [],
      }));

      setEnrichedProcesses(enriched);

    } catch (error) {
      console.error('Erreur chargement ressources:', error);
    } finally {
      setIsLoading(false);
    }
  }, [processes]);

  useEffect(() => {
    loadAllResources();
  }, [loadAllResources]);

  // ============================================================
  // 2. RÉSOLUTION DES NOMS
  // ============================================================
  const getEntityName = useCallback((entityId: string): string => {
    if (!entityId) return 'Non défini';
    const entity = entities.find(e => e.id === entityId);
    return entity?.name || 'Non défini';
  }, [entities]);

  const getDirectionName = useCallback((entityId: string): string => {
    if (!entityId) return 'Non défini';
    const entity = entities.find(e => e.id === entityId);
    if (!entity) return 'Non défini';
    
    let current = entity;
    let parent = entities.find(e => e.id === current.parentId);
    while (parent && parent.parentId !== null) {
      current = parent;
      parent = entities.find(e => e.id === current.parentId);
    }
    return current.name || 'Non défini';
  }, [entities]);

  // ============================================================
  // 3. FONCTIONS DE CALCUL
  // ============================================================
  const computeMaxScore = useCallback((impacts: any): number => {
    if (!impacts) return 0;
    let max = 0;
    for (const period of Object.values(impacts)) {
      if (typeof period === 'object' && period !== null) {
        for (const val of Object.values(period as any)) {
          const num = typeof val === 'number' ? val : parseInt(String(val));
          if (num > max) max = num;
        }
      }
    }
    return max;
  }, []);

  const isProcessComplete = useCallback((p: ProcessWithResources): boolean => {
    const hasImpacts = p.impacts && Object.keys(p.impacts).length > 0;
    const hasResources = p.linkedHR.length > 0 || 
                         p.linkedEquipment.length > 0 || 
                         p.linkedApps.length > 0 || 
                         p.linkedSuppliers.length > 0;
    return hasImpacts && hasResources;
  }, []);

  // ============================================================
  // 4. STATISTIQUES
  // ============================================================
  const stats = useMemo(() => {
    const totalProcessus = enrichedProcesses.length;
    const completeCount = enrichedProcesses.filter(isProcessComplete).length;
    const completude = totalProcessus > 0 ? Math.round((completeCount / totalProcessus) * 100) : 0;
    
    const processusCritiques = enrichedProcesses.filter(p => computeMaxScore(p.impacts) >= 4).length;
    const pourcentageCritique = totalProcessus > 0 ? Math.round((processusCritiques / totalProcessus) * 100) : 0;
    
    const rtoValues = enrichedProcesses.map(p => p.rto || 0);
    const rtoLePlusCourt = rtoValues.length > 0 ? Math.min(...rtoValues) : 0;
    const processAvecRtoLePlusCourt = enrichedProcesses.filter(p => (p.rto || 0) === rtoLePlusCourt).length;
    
    const rtoDistribution = [
      { label: '2h', count: enrichedProcesses.filter(p => (p.rto || 0) <= 2).length },
      { label: '24h', count: enrichedProcesses.filter(p => (p.rto || 0) > 2 && (p.rto || 0) <= 24).length },
      { label: '48h', count: enrichedProcesses.filter(p => (p.rto || 0) > 24 && (p.rto || 0) <= 48).length },
      { label: '120h', count: enrichedProcesses.filter(p => (p.rto || 0) > 48 && (p.rto || 0) <= 120).length },
    ];
    const totalAlerte = rtoDistribution[0].count + rtoDistribution[1].count;
    
    const serviceIds = new Set(enrichedProcesses.map(p => p.entityId));
    const servicesCount = serviceIds.size;
    
    const allAppNames = new Set<string>();
    for (const p of enrichedProcesses) {
      for (const app of p.linkedApps) {
        allAppNames.add(app.name);
      }
    }
    const totalApps = allAppNames.size;
    
    const appsWithoutSLA = enrichedProcesses.flatMap(p => p.linkedApps)
      .filter(app => !app._linkRto || app._linkRto === 0);
    const appsSansSLA = new Set(appsWithoutSLA.map(a => a.name)).size;
    
    const fichesIncompletes = totalProcessus - completeCount;
    
    return {
      totalProcessus,
      completeCount,
      completude,
      processusCritiques,
      pourcentageCritique,
      rtoLePlusCourt,
      processAvecRtoLePlusCourt,
      rtoDistribution,
      totalAlerte,
      servicesCount,
      totalApps,
      appsSansSLA,
      fichesIncompletes,
    };
  }, [enrichedProcesses, computeMaxScore, isProcessComplete]);

  // ============================================================
  // 5. RESSOURCES PAR PALIER
  // ============================================================
  const resourcesByTimeframe = useMemo(() => {
    const paliers = [
      { label: '≤ 2H', max: 2 },
      { label: '≤ 24H', max: 24 },
      { label: '≤ 48H', max: 48 },
      { label: '≤ 120H', max: 120 },
      { label: '> 120H', max: Infinity },
    ];

    const resourceTypes = [
      { key: 'hr', label: 'Personnel (FTE)', icon: Users },
      { key: 'postes', label: 'Postes de bureau', icon: Monitor },
      { key: 'equipements', label: 'Équipements spécifiques', icon: Package },
    ];

    const result: Record<string, Record<string, number>> = {};
    
    for (const rt of resourceTypes) {
      result[rt.key] = {};
      for (const palier of paliers) {
        result[rt.key][palier.label] = 0;
      }
    }

    for (const p of enrichedProcesses) {
      const rto = p.rto || 0;
      
      let processPalier = '> 120H';
      for (const palier of paliers) {
        if (rto <= palier.max) {
          processPalier = palier.label;
          break;
        }
      }

      for (const hr of p.linkedHR) {
        result['hr'][processPalier] = (result['hr'][processPalier] || 0) + 1;
      }

      for (const eq of p.linkedEquipment) {
        const eqType = eq.type?.toLowerCase() || '';
        if (eqType.includes('poste') || eqType.includes('bureau') || eqType.includes('station')) {
          result['postes'][processPalier] = (result['postes'][processPalier] || 0) + (eq.quantity || 1);
        }
      }

      let otherEquipCount = 0;
      for (const eq of p.linkedEquipment) {
        const eqType = eq.type?.toLowerCase() || '';
        if (!eqType.includes('poste') && !eqType.includes('bureau') && !eqType.includes('station')) {
          otherEquipCount += (eq.quantity || 1);
        }
      }
      if (otherEquipCount > 0) {
        result['equipements'][processPalier] = (result['equipements'][processPalier] || 0) + otherEquipCount;
      }
    }

    return {
      paliers,
      data: resourceTypes.map(rt => ({
        ...rt,
        values: paliers.map(p => result[rt.key][p.label] || 0)
      }))
    };
  }, [enrichedProcesses]);

  // ============================================================
  // 6. TOP CLASSEMENTS
  // ============================================================
  const topApps = useMemo(() => {
    const appCount: Record<string, { count: number; rto: number; sla: boolean }> = {};
    
    for (const p of enrichedProcesses) {
      for (const app of p.linkedApps) {
        if (!appCount[app.name]) {
          appCount[app.name] = { count: 0, rto: app._linkRto || 4, sla: true };
        }
        appCount[app.name].count++;
        if (!app._linkRto || app._linkRto === 0) {
          appCount[app.name].sla = false;
        }
      }
    }
    
    return Object.entries(appCount)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([name, data]) => ({ name, ...data }));
  }, [enrichedProcesses]);

  const topPrestataires = useMemo(() => {
    const suppCount: Record<string, { count: number; rto: number }> = {};
    
    for (const p of enrichedProcesses) {
      for (const sup of p.linkedSuppliers) {
        if (!suppCount[sup.name]) {
          suppCount[sup.name] = { count: 0, rto: sup._linkRto || 4 };
        }
        suppCount[sup.name].count++;
      }
    }
    
    return Object.entries(suppCount)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([name, data]) => ({ name, ...data }));
  }, [enrichedProcesses]);

  const topEquipements = useMemo(() => {
    const equipCount: Record<string, { count: number; type: string; rto: number }> = {};
    
    for (const p of enrichedProcesses) {
      for (const eq of p.linkedEquipment) {
        if (!equipCount[eq.name]) {
          equipCount[eq.name] = { count: 0, type: eq.type || 'Équipement', rto: eq._linkRto || 4 };
        }
        equipCount[eq.name].count += (eq.quantity || 1);
      }
    }
    
    return Object.entries(equipCount)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([name, data]) => ({ name, ...data }));
  }, [enrichedProcesses]);

  // ============================================================
  // 7. DÉTAIL PAR DIRECTION
  // ============================================================
  const directionsDetail = useMemo(() => {
    const result: Record<string, DirectionDetail> = {};
    
    for (const p of enrichedProcesses) {
      const direction = getDirectionName(p.entityId);
      if (!result[direction]) {
        result[direction] = {
          services: new Set<string>(),
          count: 0,
          critiques: 0,
          complet: 0,
          apps: new Set<string>(),
          suppliers: new Set<string>(),
          rtoMin: Infinity,
          processes: []
        };
      }
      
      const detail = result[direction];
      detail.services.add(p.entityId);
      detail.count++;
      detail.processes.push(p);
      
      if (computeMaxScore(p.impacts) >= 4) detail.critiques++;
      if (isProcessComplete(p)) detail.complet++;
      
      for (const app of p.linkedApps) {
        detail.apps.add(app.name);
      }
      for (const sup of p.linkedSuppliers) {
        detail.suppliers.add(sup.name);
      }
      
      const rto = p.rto || 0;
      if (rto < detail.rtoMin) detail.rtoMin = rto;
    }
    
    for (const key of Object.keys(result)) {
      if (result[key].rtoMin === Infinity) result[key].rtoMin = 0;
    }
    
    return result;
  }, [enrichedProcesses, getDirectionName, computeMaxScore, isProcessComplete]);

  // ============================================================
  // 8. EXPORT PDF COMPLET
  // ============================================================
  const exportPDF = useCallback(async () => {
    if (enrichedProcesses.length === 0) {
      toast({
        title: "Erreur",
        description: "Aucune donnée à exporter",
        variant: "destructive"
      });
      return;
    }

    setIsExporting(true);
    
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      let y = margin;
      let pageNumber = 1;

      const addNewPage = () => {
        doc.addPage();
        y = margin;
        pageNumber++;
      };

      // ===== EN-TÊTE =====
      doc.setFillColor(42, 81, 65);
      doc.rect(0, 0, pageWidth, 20, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Synthèse BIA consolidée', margin, 14);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Généré le ${new Date().toLocaleDateString('fr-FR')}`,
        pageWidth - margin - 45,
        14
      );

      y = 30;

      // ===== STATS CARDS =====
      const cardWidth = (pageWidth - margin * 2) / 4 - 3;
      const statCards = [
        { label: 'Processus analysés', value: stats.totalProcessus, sub: `sur ${stats.servicesCount} services` },
        { label: 'Processus critiques', value: stats.processusCritiques, sub: `${stats.pourcentageCritique}% du total` },
        { label: 'RTO le plus court', value: `${stats.rtoLePlusCourt}h`, sub: `${stats.processAvecRtoLePlusCourt} processus` },
        { label: 'Applications IT', value: stats.totalApps, sub: `dont ${stats.appsSansSLA} sans SLA` }
      ];

      for (let i = 0; i < statCards.length; i++) {
        const card = statCards[i];
        const x = margin + i * (cardWidth + 3);
        doc.setFillColor(245, 245, 245);
        doc.rect(x, y, cardWidth, 22, 'F');
        doc.setDrawColor(232, 228, 220);
        doc.rect(x, y, cardWidth, 22, 'S');
        doc.setTextColor(23, 32, 48);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(card.label, x + 3, y + 6);
        doc.setFontSize(14);
        doc.text(String(card.value), x + 3, y + 16);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        doc.text(card.sub, x + 3, y + 21);
      }

      y += 30;

      // ===== COMPLÉTUDE =====
      doc.setFillColor(248, 246, 242);
      doc.rect(margin, y, pageWidth - margin * 2, 10, 'F');
      doc.setDrawColor(232, 228, 220);
      doc.rect(margin, y, pageWidth - margin * 2, 10, 'S');
      doc.setTextColor(23, 32, 48);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Complétude globale', margin + 5, y + 7);
      
      const barWidth = 80;
      const barX = margin + 55;
      const barY = y + 2.5;
      doc.setDrawColor(232, 228, 220);
      doc.setFillColor(232, 228, 220);
      doc.rect(barX, barY, barWidth, 5, 'F');
      
      const completionColor = stats.completude >= 80 ? [42, 81, 65] : 
                              stats.completude >= 50 ? [234, 179, 8] : [239, 68, 68];
      doc.setFillColor(completionColor[0], completionColor[1], completionColor[2]);
      doc.rect(barX, barY, (barWidth * stats.completude) / 100, 5, 'F');
      
      doc.setTextColor(23, 32, 48);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`${stats.completude}%`, barX + barWidth + 5, y + 7);

      if (stats.fichesIncompletes > 0) {
        doc.setTextColor(234, 179, 8);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(`${stats.fichesIncompletes} fiches incomplètes`, pageWidth - margin - 40, y + 7);
      }

      y += 18;

      // ===== DISTRIBUTION RTO =====
      if (y > pageHeight - 40) {
        addNewPage();
      }

      doc.setFillColor(248, 246, 242);
      doc.rect(margin, y, pageWidth - margin * 2, 28, 'F');
      doc.setDrawColor(232, 228, 220);
      doc.rect(margin, y, pageWidth - margin * 2, 28, 'S');
      
      doc.setTextColor(23, 32, 48);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Concentration du risque', margin + 5, y + 6);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.text('Distribution des RTO - Nombre de processus devant redémarrer dans chaque fenêtre', margin + 5, y + 11);

      const rtoColors = [
        [239, 68, 68],
        [249, 115, 22],
        [234, 179, 8],
        [59, 130, 246]
      ];

      const rtoWidth = (pageWidth - margin * 2 - 20) / 4;
      let rtoX = margin + 5;
      const rtoY = y + 15;

      for (let i = 0; i < stats.rtoDistribution.length && i < 4; i++) {
        const r = stats.rtoDistribution[i];
        const maxCount = Math.max(1, ...stats.rtoDistribution.map(d => d.count));
        const height = 6 + (r.count / maxCount) * 10;
        
        doc.setFillColor(rtoColors[i][0], rtoColors[i][1], rtoColors[i][2]);
        doc.rect(rtoX, rtoY + 10 - height, rtoWidth - 3, height, 'F');
        doc.setDrawColor(232, 228, 220);
        doc.rect(rtoX, rtoY + 10 - height, rtoWidth - 3, height, 'S');
        
        doc.setTextColor(23, 32, 48);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text(`≤ ${r.label}`, rtoX + 2, rtoY + 4);
        doc.setFontSize(11);
        doc.text(`${r.count}`, rtoX + 2, rtoY + 14);
        doc.setFontSize(5);
        doc.setFont('helvetica', 'normal');
        doc.text(`${r.count} processus`, rtoX + 2, rtoY + 19);
        
        rtoX += rtoWidth;
      }

      if (stats.totalAlerte > 0) {
        y += 32;
        doc.setFillColor(254, 242, 242);
        doc.rect(margin, y, pageWidth - margin * 2, 8, 'F');
        doc.setDrawColor(254, 202, 202);
        doc.rect(margin, y, pageWidth - margin * 2, 8, 'S');
        
        doc.setTextColor(220, 38, 38);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(
          `✅ ${stats.totalAlerte} processus sur ${stats.totalProcessus} exigent une reprise en moins de 24h. Le dispositif de secours doit prioriser cette fenêtre.`,
          margin + 5,
          y + 6
        );
        y += 12;
      } else {
        y += 32;
      }

      // ===== RESSOURCES PAR PALIER =====
      if (y > pageHeight - 40) {
        addNewPage();
      }

      doc.setFillColor(248, 246, 242);
      doc.rect(margin, y, pageWidth - margin * 2, 10, 'F');
      doc.setDrawColor(232, 228, 220);
      doc.rect(margin, y, pageWidth - margin * 2, 10, 'S');
      
      doc.setTextColor(23, 32, 48);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Ressources à mobiliser par palier de temps', margin + 5, y + 5);
      doc.setFontSize(5);
      doc.setFont('helvetica', 'normal');
      doc.text('Somme des besoins de tous les processus critiques', margin + 5, y + 9);

      y += 12;

      const paliers = resourcesByTimeframe.paliers || [];
      const headers = ['RESSOURCE', ...paliers.map(p => p.label || '')];
      
      const body = resourcesByTimeframe.data.map(rt => {
        const values = rt.values || [];
        return [rt.label || '', ...values.map(v => String(v || 0))];
      });

      autoTable(doc, {
        head: [headers],
        body: body,
        startY: y,
        margin: { left: margin + 2, right: margin + 2 },
        styles: { 
          fontSize: 6, 
          cellPadding: 2,
          halign: 'center'
        },
        headStyles: { 
          fillColor: [248, 246, 242], 
          textColor: [23, 32, 48], 
          fontSize: 6, 
          fontStyle: 'bold',
          halign: 'center'
        },
        alternateRowStyles: { fillColor: [250, 250, 249] },
        columnStyles: {
          0: { cellWidth: 35, halign: 'left', fontStyle: 'bold' },
        },
      });

      y = (doc as any).lastAutoTable?.finalY + 8 || y + 40;

      // ===== TOP APPLICATIONS IT =====
      if (topApps.length > 0) {
        if (y > pageHeight - 30) {
          addNewPage();
        }

        doc.setFillColor(248, 246, 242);
        doc.rect(margin, y, pageWidth - margin * 2, 8, 'F');
        doc.setDrawColor(232, 228, 220);
        doc.rect(margin, y, pageWidth - margin * 2, 8, 'S');
        doc.setTextColor(23, 32, 48);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Applications IT les plus partagées', margin + 5, y + 6);
        y += 10;

        const appTableData = topApps.map((app, idx) => [
          `#${idx + 1} ${app.name}`,
          `${app.count}`,
          `${app.rto}h`,
          app.sla ? 'Avec SLA' : 'Sans SLA'
        ]);

        autoTable(doc, {
          head: [['Application', 'Processus liés', 'RTO', 'SLA']],
          body: appTableData,
          startY: y,
          margin: { left: margin + 2, right: margin + 2 },
          styles: { fontSize: 6, cellPadding: 1.5 },
          headStyles: { 
            fillColor: [248, 246, 242], 
            textColor: [23, 32, 48], 
            fontSize: 6, 
            fontStyle: 'bold'
          },
          alternateRowStyles: { fillColor: [250, 250, 249] },
          columnStyles: {
            0: { cellWidth: 50, halign: 'left' },
            1: { cellWidth: 20, halign: 'center' },
            2: { cellWidth: 15, halign: 'center' },
            3: { cellWidth: 25, halign: 'center' },
          },
        });

        y = (doc as any).lastAutoTable?.finalY + 6 || y + 30;
      }

      // ===== TOP PRESTATAIRES =====
      if (topPrestataires.length > 0) {
        if (y > pageHeight - 30) {
          addNewPage();
        }

        doc.setFillColor(248, 246, 242);
        doc.rect(margin, y, pageWidth - margin * 2, 8, 'F');
        doc.setDrawColor(232, 228, 220);
        doc.rect(margin, y, pageWidth - margin * 2, 8, 'S');
        doc.setTextColor(23, 32, 48);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Prestataires les plus critiques', margin + 5, y + 6);
        y += 10;

        const prestaTableData = topPrestataires.map((presta, idx) => [
          `#${idx + 1} ${presta.name}`,
          `${presta.count}`,
          `${presta.rto}h`
        ]);

        autoTable(doc, {
          head: [['Prestataire', 'Processus liés', 'RTO']],
          body: prestaTableData,
          startY: y,
          margin: { left: margin + 2, right: margin + 2 },
          styles: { fontSize: 6, cellPadding: 1.5 },
          headStyles: { 
            fillColor: [248, 246, 242], 
            textColor: [23, 32, 48], 
            fontSize: 6, 
            fontStyle: 'bold'
          },
          alternateRowStyles: { fillColor: [250, 250, 249] },
          columnStyles: {
            0: { cellWidth: 60, halign: 'left' },
            1: { cellWidth: 20, halign: 'center' },
            2: { cellWidth: 15, halign: 'center' },
          },
        });

        y = (doc as any).lastAutoTable?.finalY + 6 || y + 30;
      }

      // ===== TOP ÉQUIPEMENTS =====
      if (topEquipements.length > 0) {
        if (y > pageHeight - 30) {
          addNewPage();
        }

        doc.setFillColor(248, 246, 242);
        doc.rect(margin, y, pageWidth - margin * 2, 8, 'F');
        doc.setDrawColor(232, 228, 220);
        doc.rect(margin, y, pageWidth - margin * 2, 8, 'S');
        doc.setTextColor(23, 32, 48);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Équipements les plus partagés', margin + 5, y + 6);
        y += 10;

        const equipTableData = topEquipements.map((eq, idx) => [
          `#${idx + 1} ${eq.name}`,
          `${eq.type}`,
          `${eq.count}`,
          `${eq.rto}h`
        ]);

        autoTable(doc, {
          head: [['Équipement', 'Type', 'Quantité totale', 'RTO']],
          body: equipTableData,
          startY: y,
          margin: { left: margin + 2, right: margin + 2 },
          styles: { fontSize: 6, cellPadding: 1.5 },
          headStyles: { 
            fillColor: [248, 246, 242], 
            textColor: [23, 32, 48], 
            fontSize: 6, 
            fontStyle: 'bold'
          },
          alternateRowStyles: { fillColor: [250, 250, 249] },
          columnStyles: {
            0: { cellWidth: 45, halign: 'left' },
            1: { cellWidth: 25, halign: 'center' },
            2: { cellWidth: 20, halign: 'center' },
            3: { cellWidth: 15, halign: 'center' },
          },
        });

        y = (doc as any).lastAutoTable?.finalY + 6 || y + 30;
      }

      // ===== DÉTAIL PAR DIRECTION =====
      if (Object.keys(directionsDetail).length > 0) {
        if (y > pageHeight - 30) {
          addNewPage();
        }

        doc.setFillColor(248, 246, 242);
        doc.rect(margin, y, pageWidth - margin * 2, 8, 'F');
        doc.setDrawColor(232, 228, 220);
        doc.rect(margin, y, pageWidth - margin * 2, 8, 'S');
        doc.setTextColor(23, 32, 48);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Détail par direction & département', margin + 5, y + 6);
        y += 10;

        for (const [direction, data] of Object.entries(directionsDetail)) {
          if (y > pageHeight - 30) {
            addNewPage();
          }

          const completionRate = data.count > 0 ? Math.round((data.complet / data.count) * 100) : 0;
          
          doc.setFillColor(248, 246, 242);
          doc.rect(margin, y, pageWidth - margin * 2, 8, 'F');
          doc.setDrawColor(232, 228, 220);
          doc.rect(margin, y, pageWidth - margin * 2, 8, 'S');
          
          doc.setTextColor(23, 32, 48);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.text(direction, margin + 5, y + 6);
          
          const infoText = `${data.count} Processus · ${data.critiques} Critiques · ${data.apps.size} Applis IT · ${data.suppliers.size} Prestataires · ${completionRate}% Complétude`;
          doc.setTextColor(23, 32, 48);
          doc.setFontSize(5);
          doc.setFont('helvetica', 'normal');
          doc.text(infoText, margin + 55, y + 6);
          
          doc.setTextColor(23, 32, 48);
          doc.setFontSize(5);
          doc.setFont('helvetica', 'bold');
          doc.text(`RTO min: ${data.rtoMin}h`, pageWidth - margin - 25, y + 6);

          y += 10;

          // Tableau des départements
          const deptMap: Record<string, ProcessWithResources[]> = {};
          for (const p of data.processes) {
            const deptName = getEntityName(p.entityId);
            if (!deptMap[deptName]) deptMap[deptName] = [];
            deptMap[deptName].push(p);
          }

          const deptTableData = Object.entries(deptMap).map(([deptName, procs]) => {
            const deptProcesses = procs.length;
            const deptCritiques = procs.filter(p => computeMaxScore(p.impacts) >= 4).length;
            const deptRtoMin = Math.min(...procs.map(p => p.rto || 0));
            const deptApps = new Set<string>();
            const deptSuppliers = new Set<string>();
            let deptComplet = 0;
            
            for (const p of procs) {
              if (isProcessComplete(p)) deptComplet++;
              for (const app of p.linkedApps) deptApps.add(app.name);
              for (const sup of p.linkedSuppliers) deptSuppliers.add(sup.name);
            }
            
            const deptCompletionRate = deptProcesses > 0 ? Math.round((deptComplet / deptProcesses) * 100) : 0;
            
            return [
              deptName,
              String(deptProcesses),
              String(deptCritiques),
              deptRtoMin === Infinity ? '-' : `${deptRtoMin}h`,
              String(deptApps.size),
              String(deptSuppliers.size),
              `${deptCompletionRate}%`
            ];
          });

          if (deptTableData.length > 0) {
            autoTable(doc, {
              head: [['DÉPARTEMENT', 'Processus', 'Critiques', 'RTO MIN', 'Applis IT', 'Prestataires', 'Complétude']],
              body: deptTableData,
              startY: y,
              margin: { left: margin + 2, right: margin + 2 },
              styles: { fontSize: 5, cellPadding: 1.5 },
              headStyles: { 
                fillColor: [250, 250, 249], 
                textColor: [23, 32, 48], 
                fontSize: 5, 
                fontStyle: 'bold',
                halign: 'center'
              },
              alternateRowStyles: { fillColor: [250, 250, 249] },
              columnStyles: {
                0: { cellWidth: 40, halign: 'left' },
                1: { cellWidth: 15, halign: 'center' },
                2: { cellWidth: 15, halign: 'center' },
                3: { cellWidth: 18, halign: 'center' },
                4: { cellWidth: 18, halign: 'center' },
                5: { cellWidth: 18, halign: 'center' },
                6: { cellWidth: 20, halign: 'center' },
              },
            });

            y = (doc as any).lastAutoTable?.finalY + 4 || y + 20;
          }
        }
      }

      // ===== PIED DE PAGE =====
      doc.setFontSize(6);
      doc.setTextColor(128, 128, 128);
      doc.setFont('helvetica', 'italic');
      doc.text(
        `Document généré automatiquement depuis la plateforme BCM - Page ${pageNumber}`,
        margin,
        pageHeight - 5
      );

      // Sauvegarde du PDF
      doc.save(`Synthèse_BIA_${new Date().toISOString().split('T')[0]}.pdf`);
      
      toast({
        title: "Succès",
        description: "Le PDF a été généré avec succès"
      });

    } catch (error: any) {
      console.error('Erreur export PDF:', error);
      toast({
        title: "Erreur",
        description: error?.message || "Erreur lors de la génération du PDF",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  }, [enrichedProcesses, stats, resourcesByTimeframe, topApps, topPrestataires, topEquipements, directionsDetail]);

  // ============================================================
  // 9. TOGGLE
  // ============================================================
  const toggleDirection = (direction: string) => {
    setExpandedDirections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(direction)) {
        newSet.delete(direction);
      } else {
        newSet.add(direction);
      }
      return newSet;
    });
  };

  // ============================================================
  // 10. RENDU
  // ============================================================
  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-[#2A5141] mx-auto mb-4" />
            <p className="text-sm text-gray-500">Chargement des données BIA...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!enrichedProcesses || enrichedProcesses.length === 0) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="p-8 text-center">
              <Database className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-700 font-medium">Aucune donnée BIA disponible</p>
              <p className="text-sm text-gray-500">Veuillez créer des processus dans le module BIA</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto" ref={contentRef}>
      {/* ===== HEADER ===== */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-[#2A5141]" />
            <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Playfair Display, serif' }}>
              Synthèse BIA consolidée
            </h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Vue agrégée de toutes les analyses d'impact, par direction et par département.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge variant="outline" className="text-xs bg-gray-50 border-gray-200 text-gray-500">
            {stats.completeCount} fiches
          </Badge>
          <Badge variant="outline" className="text-xs bg-gray-50 border-gray-200 text-gray-500">
            {new Date().toLocaleDateString('fr-FR')}
          </Badge>
          <Button 
            onClick={exportPDF} 
            disabled={isExporting}
            className="gap-2 bg-[#2A5141] hover:bg-[#1a3329] text-white"
            size="sm"
          >
            {isExporting ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            {isExporting ? 'Génération...' : 'Exporter PDF'}
          </Button>
        </div>
      </div>

      {/* ===== STATS CARDS ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Processus analysés"
          value={stats.totalProcessus}
          sub={`sur ${stats.servicesCount} services`}
          icon={<Database className="h-4 w-4" />}
          color="bg-[#2A5141]/10 text-[#2A5141]"
        />
        <StatCard
          label="Processus critiques"
          value={stats.processusCritiques}
          sub={`${stats.pourcentageCritique}% du total`}
          icon={<AlertCircle className="h-4 w-4" />}
          color="bg-red-100 text-red-600"
        />
        <StatCard
          label="RTO le plus court"
          value={`${stats.rtoLePlusCourt}h`}
          sub={`${stats.processAvecRtoLePlusCourt} processus`}
          icon={<Clock className="h-4 w-4" />}
          color="bg-orange-100 text-orange-600"
        />
        <StatCard
          label="Applications IT"
          value={stats.totalApps}
          sub={`dont ${stats.appsSansSLA} sans SLA`}
          icon={<Server className="h-4 w-4" />}
          color="bg-purple-100 text-purple-600"
        />
      </div>

      {/* ===== COMPLÉTUDE ===== */}
      <Card className="mb-6 border-gray-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-[#2A5141]" />
                <span className="text-sm font-medium text-gray-700">Complétude globale</span>
              </div>
              <div className="w-48">
                <Progress 
                  value={stats.completude} 
                  className="h-2"
                  indicatorClassName={cn(
                    stats.completude >= 80 ? 'bg-[#2A5141]' :
                    stats.completude >= 50 ? 'bg-amber-500' :
                    'bg-red-500'
                  )}
                />
              </div>
              <span className="text-sm font-bold text-gray-900">{stats.completude}%</span>
            </div>
            {stats.fichesIncompletes > 0 && (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                <AlertCircle className="h-4 w-4" />
                <span>{stats.fichesIncompletes} fiches incomplètes</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ===== DISTRIBUTION RTO ===== */}
      <Card className="mb-6 border-gray-200 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#2A5141]" />
            <CardTitle className="text-base font-semibold text-gray-800">
              Concentration du risque
            </CardTitle>
          </div>
          <p className="text-xs text-gray-400">
            Distribution des RTO - Combien de processus critiques doivent redémarrer dans chaque fenêtre de temps
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.rtoDistribution.map(({ label, count }) => {
              const colors: Record<string, string> = {
                '2h': '#ef4444',
                '24h': '#f97316',
                '48h': '#eab308',
                '120h': '#3b82f6',
              };
              const maxCount = Math.max(...stats.rtoDistribution.map(d => d.count), 1);
              
              return (
                <DistributionBar
                  key={label}
                  label={label}
                  count={count}
                  total={stats.totalProcessus}
                  color={colors[label] || '#94a3b8'}
                  maxCount={maxCount}
                />
              );
            })}
          </div>
          {stats.totalAlerte > 0 && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">
                <span className="font-bold">{stats.totalAlerte} processus sur {stats.totalProcessus}</span> exigent une reprise en moins de 24h. Le dispositif de secours doit prioriser cette fenêtre.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== RESSOURCES PAR PALIER ===== */}
      <Card className="mb-6 border-gray-200 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[#2A5141]" />
            <CardTitle className="text-base font-semibold text-gray-800">
              Ressources à mobiliser par palier de temps
            </CardTitle>
          </div>
          <p className="text-xs text-gray-400">
            Somme des besoins de tous les processus critiques. Le pic à ≤120h dimensionne le site de repli.
          </p>
        </CardHeader>
        <CardContent>
          <ResourceTable 
            data={resourcesByTimeframe.data} 
            paliers={resourcesByTimeframe.paliers} 
          />
        </CardContent>
      </Card>

      {/* ===== TOP 3 CLASSEMENTS ===== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <TopItemCard
          title="Applications IT les plus partagées"
          icon={<Server className="h-4 w-4 text-white" />}
          color="bg-purple-600"
          badgeColor="bg-purple-600 text-white"
          items={topApps}
          subKey="rto"
          subLabel="RTO"
        />
        <TopItemCard
          title="Prestataires les plus critiques"
          icon={<Handshake className="h-4 w-4 text-white" />}
          color="bg-red-600"
          badgeColor="bg-red-600 text-white"
          items={topPrestataires}
          subKey="rto"
          subLabel="RTO"
        />
        <TopItemCard
          title="Équipements les plus partagés"
          icon={<Package className="h-4 w-4 text-white" />}
          color="bg-amber-600"
          badgeColor="bg-amber-600 text-white"
          items={topEquipements}
          subKey="type"
          subLabel="Type"
        />
      </div>

      {/* ===== DÉTAIL PAR DIRECTION ===== */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[#2A5141]" />
            <CardTitle className="text-base font-semibold text-gray-800">
              Détail par direction & département
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {Object.entries(directionsDetail).length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm">
              Aucune direction
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(directionsDetail).map(([direction, data]) => {
                const completionRate = data.count > 0 ? Math.round((data.complet / data.count) * 100) : 0;
                const isExpanded = expandedDirections.has(direction);
                
                const deptMap: Record<string, ProcessWithResources[]> = {};
                for (const p of data.processes) {
                  const deptName = getEntityName(p.entityId);
                  if (!deptMap[deptName]) deptMap[deptName] = [];
                  deptMap[deptName].push(p);
                }

                return (
                  <div key={direction} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div 
                      className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => toggleDirection(direction)}
                    >
                      <div className="flex items-center gap-4 flex-wrap">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        )}
                        <h3 className="font-semibold text-gray-800">{direction}</h3>
                        <div className="flex items-center gap-3 text-xs">
                          <Badge variant="outline" className="text-xs border-gray-300">
                            {data.count} Processus
                          </Badge>
                          {data.critiques > 0 && (
                            <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">
                              ⚠️ {data.critiques} Critiques
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs border-gray-300">
                            {data.apps.size} Applis IT
                          </Badge>
                          <Badge variant="outline" className="text-xs border-gray-300">
                            {data.suppliers.size} Prestataires
                          </Badge>
                          <Badge className={cn(
                            completionRate >= 80 ? 'bg-[#2A5141] text-white' :
                            completionRate >= 50 ? 'bg-amber-500 text-white' :
                            'bg-red-500 text-white'
                          )}>
                            {completionRate}% Complétude
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">
                          RTO min: <span className="font-medium text-gray-700">{data.rtoMin}h</span>
                        </span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-4 bg-white">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-200">
                                <th className="text-left py-2 px-3 font-semibold text-gray-400 text-[10px] uppercase tracking-wider">
                                  DÉPARTEMENT / SERVICE
                                </th>
                                <th className="text-center py-2 px-3 font-semibold text-gray-400 text-[10px] uppercase tracking-wider">
                                  Processus
                                </th>
                                <th className="text-center py-2 px-3 font-semibold text-gray-400 text-[10px] uppercase tracking-wider">
                                  Critiques
                                </th>
                                <th className="text-center py-2 px-3 font-semibold text-gray-400 text-[10px] uppercase tracking-wider">
                                  RTO MIN
                                </th>
                                <th className="text-center py-2 px-3 font-semibold text-gray-400 text-[10px] uppercase tracking-wider">
                                  Applis IT
                                </th>
                                <th className="text-center py-2 px-3 font-semibold text-gray-400 text-[10px] uppercase tracking-wider">
                                  Prestataires
                                </th>
                                <th className="text-center py-2 px-3 font-semibold text-gray-400 text-[10px] uppercase tracking-wider">
                                  Complétude
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(deptMap).map(([deptName, procs], idx) => {
                                const deptProcesses = procs.length;
                                const deptCritiques = procs.filter(p => computeMaxScore(p.impacts) >= 4).length;
                                const deptRtoMin = Math.min(...procs.map(p => p.rto || 0));
                                const deptApps = new Set<string>();
                                const deptSuppliers = new Set<string>();
                                let deptComplet = 0;
                                
                                for (const p of procs) {
                                  if (isProcessComplete(p)) deptComplet++;
                                  for (const app of p.linkedApps) deptApps.add(app.name);
                                  for (const sup of p.linkedSuppliers) deptSuppliers.add(sup.name);
                                }
                                
                                const deptCompletionRate = deptProcesses > 0 ? Math.round((deptComplet / deptProcesses) * 100) : 0;
                                
                                return (
                                  <tr key={deptName} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                    <td className="py-2 px-3 font-medium text-gray-700">{deptName}</td>
                                    <td className="text-center py-2 px-3 text-gray-700">{deptProcesses}</td>
                                    <td className="text-center py-2 px-3 text-red-600 font-medium">{deptCritiques}</td>
                                    <td className="text-center py-2 px-3 font-mono text-gray-700">
                                      {deptRtoMin === Infinity ? '-' : `${deptRtoMin}h`}
                                    </td>
                                    <td className="text-center py-2 px-3 text-gray-700">{deptApps.size}</td>
                                    <td className="text-center py-2 px-3 text-gray-700">{deptSuppliers.size}</td>
                                    <td className="text-center py-2 px-3">
                                      <Badge className={cn(
                                        deptCompletionRate >= 80 ? 'bg-[#2A5141] text-white' :
                                        deptCompletionRate >= 50 ? 'bg-amber-500 text-white' :
                                        'bg-red-500 text-white'
                                      )}>
                                        {deptCompletionRate}%
                                      </Badge>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BIASynthesis;