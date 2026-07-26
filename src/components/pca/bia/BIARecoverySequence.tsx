import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Clock, Users, Building, User, AlertTriangle, CheckCircle, 
  Link, Database, RefreshCw, Zap, Calendar, Activity, 
  TrendingDown, Target, Layers, GanttChart, Download,
  Eye, EyeOff, ChevronDown, ChevronRight, AlertOctagon,
  Check, Shield, Filter, X
} from 'lucide-react';
import { useBia } from '@/contexts/BiaContext';
import { useGovernance } from '@/contexts/GovernanceContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';

// Types
interface ProcessWithResources {
  id: string;
  name: string;
  code?: string;
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

interface WaveData {
  label: string;
  maxRto: number;
  color: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}

const BIARecoverySequence: React.FC = () => {
  const { processes } = useBia();
  const { entities } = useGovernance();
  
  const [isLoading, setIsLoading] = useState(true);
  const [enrichedProcesses, setEnrichedProcesses] = useState<ProcessWithResources[]>([]);
  const [selectedDirection, setSelectedDirection] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"vagues" | "chronologie">("vagues");
  const [expandedWaves, setExpandedWaves] = useState<Set<number>>(new Set([0, 1]));
  const [selectedWaveFilter, setSelectedWaveFilter] = useState<number | null>(null);

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
      }

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
  // 2. FONCTIONS UTILITAIRES
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

  const generateProcessCode = (department: string, index: number): string => {
    const prefix = department.substring(0, 2).toUpperCase() || "DE";
    return `${prefix}_${String(index + 1).padStart(6, '0')}`;
  };

  // ============================================================
  // 3. WAVES
  // ============================================================
  const waves: WaveData[] = [
    { label: '≤ 2h', maxRto: 2, color: '#DC2626', bgColor: 'bg-red-50', textColor: 'text-red-700', borderColor: 'border-red-200' },
    { label: '≤ 24h', maxRto: 24, color: '#EA580C', bgColor: 'bg-orange-50', textColor: 'text-orange-700', borderColor: 'border-orange-200' },
    { label: '≤ 48h', maxRto: 48, color: '#D97706', bgColor: 'bg-amber-50', textColor: 'text-amber-700', borderColor: 'border-amber-200' },
    { label: '≤ 120h', maxRto: 120, color: '#65A30D', bgColor: 'bg-green-50', textColor: 'text-green-700', borderColor: 'border-green-200' },
    { label: '> 120h', maxRto: Infinity, color: '#6B7280', bgColor: 'bg-gray-50', textColor: 'text-gray-500', borderColor: 'border-gray-200' },
  ];

  const getWaveIndex = (rto: number): number => {
    for (let i = 0; i < waves.length; i++) {
      if (rto <= waves[i].maxRto) return i;
    }
    return waves.length - 1;
  };

  // ============================================================
  // 4. DÉPENDANCES
  // ============================================================
  const dependencies = useMemo(() => {
    const deps: { from: string; to: string; toName: string }[] = [];
    for (const p of enrichedProcesses) {
      const depIds = p.depends_on || [];
      for (const depId of depIds) {
        const target = enrichedProcesses.find(x => x.id === depId);
        if (target) {
          deps.push({ from: p.id, to: depId, toName: target.name });
        }
      }
    }
    return deps;
  }, [enrichedProcesses]);

  const hasDependencies = (processId: string): boolean => {
    return dependencies.some(d => d.from === processId);
  };

  const getDependencyNames = (processId: string): string[] => {
    return dependencies.filter(d => d.from === processId).map(d => d.toName);
  };

  // ============================================================
  // 5. FILTRES
  // ============================================================
  const directions = useMemo(() => {
    const dirs = new Set<string>();
    for (const p of enrichedProcesses) {
      dirs.add(getDirectionName(p.entityId));
    }
    return Array.from(dirs);
  }, [enrichedProcesses, getDirectionName]);

  const filteredProcesses = useMemo(() => {
    let result = enrichedProcesses;
    if (selectedDirection !== "all") {
      result = result.filter(p => getDirectionName(p.entityId) === selectedDirection);
    }
    return result;
  }, [enrichedProcesses, selectedDirection, getDirectionName]);

  // ============================================================
  // 6. PROCESSUS PAR VAGUE
  // ============================================================
  const processesByWave = useMemo(() => {
    const result: Record<number, ProcessWithResources[]> = {};
    for (let i = 0; i < waves.length; i++) {
      result[i] = [];
    }

    for (const p of filteredProcesses) {
      const rto = p.rto || 0;
      const waveIndex = getWaveIndex(rto);
      result[waveIndex].push(p);
    }

    return result;
  }, [filteredProcesses]);

  // ============================================================
  // 7. STATS
  // ============================================================
  const totalProcesses = filteredProcesses.length;
  const totalResources = filteredProcesses.reduce((acc, p) => 
    acc + p.linkedHR.length + p.linkedEquipment.length + p.linkedApps.length + p.linkedSuppliers.length, 0
  );

  const waveStats = useMemo(() => {
    const stats = [];
    for (let i = 0; i < waves.length; i++) {
      const count = processesByWave[i]?.length || 0;
      if (count > 0 || i < 4) {
        stats.push({
          wave: i,
          count,
          label: waves[i].label,
          color: waves[i].color,
          bgColor: waves[i].bgColor,
          textColor: waves[i].textColor,
          borderColor: waves[i].borderColor
        });
      }
    }
    return stats;
  }, [processesByWave]);

  const toggleWave = (waveIndex: number) => {
    setExpandedWaves(prev => {
      const newSet = new Set(prev);
      if (newSet.has(waveIndex)) {
        newSet.delete(waveIndex);
      } else {
        newSet.add(waveIndex);
      }
      return newSet;
    });
  };

  // Filtrer par vague sélectionnée
  const handleWaveClick = (waveIndex: number) => {
    if (selectedWaveFilter === waveIndex) {
      setSelectedWaveFilter(null);
    } else {
      setSelectedWaveFilter(waveIndex);
      // Ouvrir automatiquement la vague
      if (!expandedWaves.has(waveIndex)) {
        toggleWave(waveIndex);
      }
    }
  };

  // ============================================================
  // 8. RENDU
  // ============================================================
  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-[#2A5141] mx-auto mb-4" />
            <p className="text-sm text-gray-500">Chargement des données...</p>
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
    <div className="p-6 max-w-7xl mx-auto">
      {/* ===== HEADER ===== */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#172030]">
            Séquence de reprise des activités
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Ordre de redémarrage des activités critiques après un sinistre, classées par RTO. 
            Les vagues indiquent quelles activités mobiliser en premier.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Select value={selectedDirection} onValueChange={setSelectedDirection}>
            <SelectTrigger className="w-[180px] h-9 text-sm border-gray-200 bg-white">
              <SelectValue placeholder="Toutes directions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes directions</SelectItem>
              {directions.map(dir => (
                <SelectItem key={dir} value={dir}>{dir}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-1.5 border-gray-200 text-gray-500">
            <Download className="h-4 w-4" />
            Exporter
          </Button>
        </div>
      </div>

      {/* ===== KPI CARDS - CLAIQUABLES ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {waveStats.map((stat) => {
          const isActive = selectedWaveFilter === stat.wave;
          return (
            <div
              key={stat.wave}
              className={cn(
                "rounded-lg border p-4 shadow-sm cursor-pointer transition-all duration-200",
                stat.bgColor,
                stat.borderColor,
                isActive && "ring-2 ring-offset-2",
                isActive && `ring-[${stat.color}]`
              )}
              onClick={() => handleWaveClick(stat.wave)}
            >
              <div className="flex items-center justify-between">
                <span className={cn("text-sm font-medium", stat.textColor)}>
                  {stat.label}
                </span>
                <div 
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: stat.color }}
                />
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {stat.count}
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-xs text-gray-400">
                  Vague {stat.wave + 1}
                </span>
                <span className="text-[10px] text-gray-400">
                  {totalProcesses > 0 ? Math.round((stat.count / totalProcesses) * 100) : 0}%
                </span>
              </div>
              <div className="mt-2 h-1 w-full bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all"
                  style={{ 
                    width: `${totalProcesses > 0 ? (stat.count / totalProcesses) * 100 : 0}%`,
                    backgroundColor: stat.color
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== INSIGHT ===== */}
      {waveStats.length > 0 && waveStats[0]?.count > 0 && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-700">
            La <strong>vague 1</strong> concentre <strong>{waveStats[0].count}</strong> activité{waveStats[0].count > 1 ? 's' : ''} à redémarrer en moins de 2h. 
            Vérifiez que les dépendances amont sont bien dans la même vague.
          </div>
        </div>
      )}

      {/* ===== SWITCH VUE ===== */}
      <div className="flex items-center gap-3 mb-4">
        <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode("vagues")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
              viewMode === "vagues" 
                ? "bg-white text-gray-900 shadow-sm" 
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Layers className="h-4 w-4" />
            Vagues
          </button>
          <button
            onClick={() => setViewMode("chronologie")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
              viewMode === "chronologie" 
                ? "bg-white text-gray-900 shadow-sm" 
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <GanttChart className="h-4 w-4" />
            Chronologie
          </button>
        </div>
        <span className="text-sm text-gray-400">
          {totalProcesses} processus · {totalResources} ressources
        </span>
        {selectedWaveFilter !== null && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs text-gray-400 hover:text-gray-600"
            onClick={() => setSelectedWaveFilter(null)}
          >
            <X className="h-3 w-3 mr-1" />
            Effacer le filtre
          </Button>
        )}
      </div>

      {/* ===== VUE VAGUES ===== */}
      {viewMode === "vagues" && (
        <div className="space-y-4">
          {waves.map((wave, waveIndex) => {
            const processesInWave = processesByWave[waveIndex] || [];
            
            if (processesInWave.length === 0 && waveIndex > 3) return null;
            if (selectedWaveFilter !== null && selectedWaveFilter !== waveIndex && processesInWave.length === 0) return null;
            
            const isExpanded = expandedWaves.has(waveIndex);
            const totalRes = processesInWave.reduce((acc, p) => 
              acc + p.linkedHR.length + p.linkedEquipment.length + p.linkedApps.length + p.linkedSuppliers.length, 0
            );

            // Si un filtre est actif et que cette vague n'est pas sélectionnée, la cacher
            if (selectedWaveFilter !== null && selectedWaveFilter !== waveIndex) {
              return null;
            }

            return (
              <div key={waveIndex} className="relative">
                {/* Ligne de connexion */}
                {waveIndex < waves.length - 1 && (
                  <div className="absolute left-5 top-8 bottom-0 w-0.5 bg-gray-200" />
                )}

                <div className="relative pl-8">
                  {/* Point */}
                  <div 
                    className="absolute left-0 top-1.5 w-4 h-4 rounded-full border-2 border-white shadow-sm z-10 cursor-pointer"
                    style={{ backgroundColor: wave.color }}
                    onClick={() => toggleWave(waveIndex)}
                  />

                  {/* En-tête vague */}
                  <div 
                    className="flex items-center gap-3 mb-2 cursor-pointer group"
                    onClick={() => toggleWave(waveIndex)}
                  >
                    <div className="min-w-[60px] text-center">
                      <div className="font-mono text-sm font-bold" style={{ color: wave.color }}>
                        {wave.label}
                      </div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wider">
                        {waveIndex === 0 ? 'Immédiat' : 
                         waveIndex === 1 ? 'Jour 1' : 
                         waveIndex === 2 ? 'Jour 2' : 
                         waveIndex === 3 ? 'Semaine 1' : 'Au-delà'}
                      </div>
                    </div>
                    <div className="flex-1">
                      <span className="text-base font-medium text-gray-800">
                        Vague {waveIndex + 1}
                      </span>
                      <span className="text-sm text-gray-400 ml-2">
                        {processesInWave.length} activité{processesInWave.length > 1 ? 's' : ''}
                        {totalRes > 0 && ` · ${totalRes} ressources`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* Cartes - Version plus compacte */}
                  {isExpanded && processesInWave.length > 0 && (
                    <div className="space-y-1.5 ml-[72px]">
                      {processesInWave.map((p, idx) => {
                        const code = generateProcessCode(getEntityName(p.entityId), idx);
                        const deps = getDependencyNames(p.id);
                        const hasDep = deps.length > 0;
                        const critical = computeMaxScore(p.impacts) >= 4;
                        const totalRes = p.linkedHR.length + p.linkedEquipment.length + p.linkedApps.length + p.linkedSuppliers.length;

                        return (
                          <div
                            key={p.id}
                            className={cn(
                              "bg-white border rounded-lg px-3 py-2",
                              "hover:shadow-sm transition-shadow",
                              "flex flex-wrap items-center gap-2",
                              hasDep ? `border-l-3` : "border-gray-200",
                              hasDep && `border-l-[${wave.color}]`
                            )}
                            style={hasDep ? { borderLeftColor: wave.color } : {}}
                          >
                            {/* Nom + badge */}
                            <div className="flex items-center gap-2 min-w-[120px] flex-1">
                              <span className="text-sm font-medium text-gray-800 truncate">
                                {p.name}
                              </span>
                              {critical && (
                                <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] px-1.5 py-0">
                                  Critique
                                </Badge>
                              )}
                              <span className="text-[10px] text-gray-400 font-mono hidden sm:inline">
                                {code}
                              </span>
                            </div>

                            {/* Direction + Owner */}
                            <div className="flex items-center gap-2 text-xs text-gray-500 min-w-[100px] flex-1">
                              <Building className="h-3 w-3 text-gray-400" />
                              <span className="truncate">{getDirectionName(p.entityId)}</span>
                              <span className="text-gray-300">·</span>
                              <User className="h-3 w-3 text-gray-400" />
                              <span className="truncate">{p.owner || '—'}</span>
                            </div>

                            {/* Métriques */}
                            <div className="flex items-center gap-3 text-xs">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-gray-400" />
                                <span className="font-mono font-medium" style={{ color: wave.color }}>
                                  {p.rto || 0}h
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Target className="h-3 w-3 text-gray-400" />
                                <span className="font-mono text-gray-600">{p.rpo || 0}h</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Users className="h-3 w-3 text-gray-400" />
                                <span className="text-gray-500">{totalRes}</span>
                              </div>
                            </div>

                            {/* Dépendances */}
                            <div className="flex items-center gap-1 text-xs min-w-[80px]">
                              {hasDep ? (
                                <>
                                  <Link className="h-3 w-3 text-amber-500 flex-shrink-0" />
                                  <span className="text-gray-500 truncate max-w-[100px]">
                                    {deps.join(', ')}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Check className="h-3 w-3 text-green-500 flex-shrink-0" />
                                  <span className="text-gray-400 text-[10px]">Aucune dépendance</span>
                                </>
                              )}
                            </div>

                            {/* Score */}
                            <div className="flex items-center gap-1">
                              <div className="w-12 h-1 bg-gray-100 rounded-full">
                                <div 
                                  className="h-full rounded-full"
                                  style={{ 
                                    width: `${Math.min((computeMaxScore(p.impacts) / 5) * 100, 100)}%`,
                                    backgroundColor: computeMaxScore(p.impacts) >= 4 ? '#DC2626' : '#6B7280'
                                  }}
                                />
                              </div>
                              <span className="text-[9px] text-gray-400 font-mono">
                                {computeMaxScore(p.impacts)}/5
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {isExpanded && processesInWave.length === 0 && (
                    <div className="ml-[72px] text-center py-3 text-gray-400 text-sm">
                      Aucune activité dans cette vague
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Légende */}
          <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-gray-200 mt-4">
            {waves.map((wave, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: wave.color }} />
                <span className="text-sm text-gray-600">{wave.label}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5 ml-auto">
              <Link className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-sm text-gray-500">Dépendance amont</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-green-500" />
              <span className="text-sm text-gray-500">Aucune dépendance</span>
            </div>
          </div>
        </div>
      )}

      {/* ===== VUE CHRONOLOGIE ===== */}
      {viewMode === "chronologie" && (
        <Card className="border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              <div className="grid grid-cols-[180px_1fr] border-b border-gray-200 bg-gray-50">
                <div className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Activité
                </div>
                <div className="grid grid-cols-5">
                  {['0h', '2h', '24h', '48h', '120h'].map((label, i) => (
                    <div key={i} className="px-3 py-2.5 font-mono text-xs font-semibold text-gray-400 border-l border-gray-200 text-center">
                      {label}
                    </div>
                  ))}
                </div>
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                {filteredProcesses
                  .filter(p => selectedWaveFilter === null || getWaveIndex(p.rto || 0) === selectedWaveFilter)
                  .sort((a, b) => (a.rto || 0) - (b.rto || 0))
                  .map((p) => {
                    const rto = p.rto || 0;
                    const waveIndex = getWaveIndex(rto);
                    const wave = waves[waveIndex];
                    
                    const stops = [0, 2, 24, 48, 120];
                    let position = 0;
                    for (let i = 0; i < stops.length - 1; i++) {
                      if (rto <= stops[i + 1]) {
                        position = (i / (stops.length - 1)) * 100 + 
                          (rto - stops[i]) / (stops[i + 1] - stops[i]) * (100 / (stops.length - 1));
                        break;
                      }
                      if (i === stops.length - 2) position = 100;
                    }
                    position = Math.min(100, Math.max(0, position));

                    return (
                      <div key={p.id} className="grid grid-cols-[180px_1fr] border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <div className="px-4 py-2.5">
                          <div className="text-sm font-medium text-gray-800 truncate">{p.name}</div>
                          <div className="text-xs text-gray-400 truncate">{getDirectionName(p.entityId)}</div>
                        </div>
                        <div className="relative h-9">
                          <div className="absolute inset-0 grid grid-cols-5">
                            {[0, 1, 2, 3, 4].map((i) => (
                              <div key={i} className="border-l border-gray-100" />
                            ))}
                          </div>
                          <div 
                            className="absolute top-1/2 -translate-y-1/2 h-5 rounded shadow-sm flex items-center px-2.5 text-white text-[10px] font-mono font-bold transition-all hover:h-6"
                            style={{
                              left: 0,
                              width: `${Math.max(position, 5)}%`,
                              backgroundColor: wave.color,
                              minWidth: '36px'
                            }}
                          >
                            {rto}h
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default BIARecoverySequence;