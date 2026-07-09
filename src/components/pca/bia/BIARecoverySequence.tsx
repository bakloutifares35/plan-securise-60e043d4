import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  AlertCircle, Clock, Server, Users, Monitor, Handshake, Building2,
  ChevronDown, ChevronRight, AlertTriangle, CheckCircle, Link2,
  GitBranch, Database, Shield, RefreshCw, Calendar, Filter,
  LayoutGrid, List, Download, Eye, EyeOff, Zap, Target,
  Activity, BarChart3, TrendingUp, TrendingDown
} from 'lucide-react';
import { useBia } from '@/contexts/BiaContext';
import { useGovernance } from '@/contexts/GovernanceContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

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
  icon: React.ReactNode;
}

interface Dependency {
  from: string;
  to: string;
  fromName: string;
  toName: string;
}

const BIARecoverySequence: React.FC = () => {
  const { processes } = useBia();
  const { entities } = useGovernance();
  
  const [isLoading, setIsLoading] = useState(true);
  const [enrichedProcesses, setEnrichedProcesses] = useState<ProcessWithResources[]>([]);
  const [selectedDirection, setSelectedDirection] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"waves" | "gantt">("waves");
  const [expandedWaves, setExpandedWaves] = useState<Set<string>>(new Set(['wave-0', 'wave-1']));

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

      // Charger les ressources liées
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

      // Construire les maps
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
  // 3. WAVES / VAGUES
  // ============================================================
  const waves: WaveData[] = [
    { 
      label: '≤ 2h', 
      maxRto: 2, 
      color: '#DC2626', 
      bgColor: 'bg-red-50', 
      textColor: 'text-red-600',
      icon: <Zap className="h-4 w-4" />
    },
    { 
      label: '≤ 24h', 
      maxRto: 24, 
      color: '#EA580C', 
      bgColor: 'bg-orange-50', 
      textColor: 'text-orange-600',
      icon: <Clock className="h-4 w-4" />
    },
    { 
      label: '≤ 48h', 
      maxRto: 48, 
      color: '#D97706', 
      bgColor: 'bg-amber-50', 
      textColor: 'text-amber-600',
      icon: <Calendar className="h-4 w-4" />
    },
    { 
      label: '≤ 120h', 
      maxRto: 120, 
      color: '#CA8A04', 
      bgColor: 'bg-yellow-50', 
      textColor: 'text-yellow-600',
      icon: <Activity className="h-4 w-4" />
    },
    { 
      label: '> 120h', 
      maxRto: Infinity, 
      color: '#6B7280', 
      bgColor: 'bg-gray-50', 
      textColor: 'text-gray-500',
      icon: <TrendingDown className="h-4 w-4" />
    },
  ];

  const getWaveIndex = (rto: number): number => {
    for (let i = 0; i < waves.length; i++) {
      if (rto <= waves[i].maxRto) return i;
    }
    return waves.length - 1;
  };

  const getProcessesByWave = useMemo(() => {
    const result: Record<number, ProcessWithResources[]> = {};
    for (let i = 0; i < waves.length; i++) {
      result[i] = [];
    }

    for (const p of enrichedProcesses) {
      const rto = p.rto || 0;
      const waveIndex = getWaveIndex(rto);
      result[waveIndex].push(p);
    }

    return result;
  }, [enrichedProcesses]);

  // ============================================================
  // 4. DÉPENDANCES
  // ============================================================
  const dependencies = useMemo((): Dependency[] => {
    const deps: Dependency[] = [];
    for (const p of enrichedProcesses) {
      const depIds = p.depends_on || [];
      for (const depId of depIds) {
        const target = enrichedProcesses.find(x => x.id === depId);
        if (target) {
          deps.push({
            from: p.id,
            to: depId,
            fromName: p.name,
            toName: target.name
          });
        }
      }
    }
    return deps;
  }, [enrichedProcesses]);

  const getDependencies = (processId: string): string[] => {
    const deps: string[] = [];
    for (const dep of dependencies) {
      if (dep.from === processId) {
        deps.push(dep.toName);
      }
    }
    return deps;
  };

  const hasDependencies = (processId: string): boolean => {
    return dependencies.some(d => d.from === processId);
  };

  const isDependedOn = (processId: string): boolean => {
    return dependencies.some(d => d.to === processId);
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

  // Recalculer les vagues avec les filtres
  const filteredProcessesByWave = useMemo(() => {
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
  // 6. STATS
  // ============================================================
  const waveStats = useMemo(() => {
    const stats: { wave: number; count: number; label: string; color: string }[] = [];
    for (let i = 0; i < waves.length; i++) {
      const count = filteredProcessesByWave[i]?.length || 0;
      if (count > 0 || i < 4) {
        stats.push({
          wave: i,
          count,
          label: waves[i].label,
          color: waves[i].color
        });
      }
    }
    return stats;
  }, [filteredProcessesByWave]);

  const totalCritical = useMemo(() => {
    return filteredProcesses.filter(p => computeMaxScore(p.impacts) >= 4).length;
  }, [filteredProcesses, computeMaxScore]);

  // ============================================================
  // 7. TOGGLE WAVES
  // ============================================================
  const toggleWave = (waveKey: string) => {
    setExpandedWaves(prev => {
      const newSet = new Set(prev);
      if (newSet.has(waveKey)) {
        newSet.delete(waveKey);
      } else {
        newSet.add(waveKey);
      }
      return newSet;
    });
  };

  // ============================================================
  // 8. RENDU
  // ============================================================
  if (isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-[#2A5141] mx-auto mb-4" />
            <p className="text-sm text-[#172030]/60">Chargement des données...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!enrichedProcesses || enrichedProcesses.length === 0) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <Card className="border-[#E8E4DC] shadow-sm">
            <CardContent className="p-8 text-center">
              <Database className="h-12 w-12 text-[#172030]/30 mx-auto mb-4" />
              <p className="text-[#172030] font-medium">Aucune donnée BIA disponible</p>
              <p className="text-sm text-[#172030]/50">Veuillez créer des processus dans le module BIA</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* En-tête */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#172030]" style={{ fontFamily: 'Playfair Display, serif' }}>
            Séquence de reprise des activités
          </h1>
          <p className="text-sm text-[#172030]/60 mt-1">
            Ordre de redémarrage des activités critiques après un sinistre, classées par RTO. 
            Les vagues indiquent quelles activités mobiliser en premier.
          </p>
        </div>
        <div className="flex items-center gap-2 mt-2 md:mt-0">
          <Select value={selectedDirection} onValueChange={setSelectedDirection}>
            <SelectTrigger className="w-[180px] h-8 text-xs border-[#E8E4DC]">
              <SelectValue placeholder="Toutes directions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes directions</SelectItem>
              {directions.map(dir => (
                <SelectItem key={dir} value={dir}>{dir}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-1.5 border-[#E8E4DC] text-[#172030]/60 hover:text-[#172030]"
          >
            <Download className="h-4 w-4" />
            Exporter
          </Button>
        </div>
      </div>

      {/* CARTES STATISTIQUES */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {waveStats.map((stat) => (
          <Card key={stat.wave} className="border-[#E8E4DC] shadow-sm" style={{ borderTop: `3px solid ${stat.color}` }}>
            <CardContent className="p-3">
              <div className="text-xs font-medium text-[#172030]/50" style={{ color: stat.color }}>
                {stat.label}
              </div>
              <div className="text-2xl font-bold text-[#172030]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {stat.count}
              </div>
              <div className="text-[10px] text-[#172030]/40">
                Vague {stat.wave + 1}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Insight */}
      {waveStats[0]?.count > 0 && (
        <div className="mb-6 p-3 bg-[#F5F3FF] border border-[#DDD6FE] rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-[#5B21B6] mt-0.5 flex-shrink-0" />
          <div className="text-sm text-[#5B21B6]">
            La <strong>vague 1</strong> concentre {waveStats[0].count} activité{waveStats[0].count > 1 ? 's' : ''} à redémarrer en moins de 2h. 
            Vérifiez que les dépendances amont sont bien dans la même vague.
          </div>
        </div>
      )}

      {/* Switch Vue */}
      <div className="flex items-center gap-2 mb-4">
        <div className="inline-flex bg-[#F4F4F5] rounded-lg p-0.5">
          <button
            onClick={() => setViewMode("waves")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              viewMode === "waves" 
                ? "bg-white text-[#172030] shadow-sm" 
                : "text-[#71717A] hover:text-[#172030]"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Vagues
          </button>
          <button
            onClick={() => setViewMode("gantt")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              viewMode === "gantt" 
                ? "bg-white text-[#172030] shadow-sm" 
                : "text-[#71717A] hover:text-[#172030]"
            )}
          >
            <List className="h-3.5 w-3.5" />
            Chronologie
          </button>
        </div>
        <span className="text-xs text-[#172030]/40 ml-auto">
          {filteredProcesses.length} processus
        </span>
      </div>

      {/* ===== VUE VAGUES ===== */}
      {viewMode === "waves" && (
        <div className="space-y-4">
          {waves.map((wave, waveIndex) => {
            const processesInWave = filteredProcessesByWave[waveIndex] || [];
            if (processesInWave.length === 0 && waveIndex > 3) return null;
            
            const waveKey = `wave-${waveIndex}`;
            const isExpanded = expandedWaves.has(waveKey);
            const totalResources = processesInWave.reduce((acc, p) => 
              acc + p.linkedHR.length + p.linkedEquipment.length + p.linkedApps.length + p.linkedSuppliers.length, 0
            );

            return (
              <div key={waveIndex} className="relative">
                {/* Ligne de connexion */}
                {waveIndex < waves.length - 1 && (
                  <div className="absolute left-6 top-10 bottom-0 w-0.5 bg-[#E4E4E7]" />
                )}

                <div className="relative pl-10">
                  {/* Point */}
                  <div 
                    className="absolute left-0 top-1.5 w-4 h-4 rounded-full border-2 border-white z-10"
                    style={{ backgroundColor: wave.color }}
                  />

                  {/* En-tête de vague */}
                  <div 
                    className="flex items-center gap-3 mb-3 cursor-pointer"
                    onClick={() => toggleWave(waveKey)}
                  >
                    <div className="min-w-[64px] text-center">
                      <div className="font-mono text-sm font-bold" style={{ color: wave.color }}>
                        {wave.label}
                      </div>
                      <div className="text-[9px] text-[#A1A1AA] uppercase tracking-wider">
                        {waveIndex === 0 ? 'Immédiat' : 
                         waveIndex === 1 ? 'Jour 1' : 
                         waveIndex === 2 ? 'Jour 2' : 
                         waveIndex === 3 ? 'Semaine 1' : 'Au-delà'}
                      </div>
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-[#172030]">
                        Vague {waveIndex + 1}
                      </span>
                      <span className="text-xs text-[#A1A1AA] ml-2">
                        {processesInWave.length} activité{processesInWave.length > 1 ? 's' : ''}
                        {totalResources > 0 && ` · ${totalResources} ressources`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-[#A1A1AA]" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-[#A1A1AA]" />
                      )}
                    </div>
                  </div>

                  {/* Cartes des activités */}
                  {isExpanded && (
                    <div className="space-y-2 ml-[76px]">
                      {processesInWave.map((p, idx) => {
                        const code = generateProcessCode(getEntityName(p.entityId), idx);
                        const deps = getDependencies(p.id);
                        const hasDep = deps.length > 0;
                        const isDepended = isDependedOn(p.id);
                        const critical = computeMaxScore(p.impacts) >= 4;

                        return (
                          <div 
                            key={p.id}
                            className={cn(
                              "bg-white border border-[#E4E4E7] rounded-lg p-3",
                              "grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-3 items-center",
                              hasDep && "border-l-4",
                              hasDep && `border-l-[${wave.color}]`
                            )}
                            style={hasDep ? { borderLeftColor: wave.color } : {}}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm text-[#172030]">{p.name}</span>
                                {critical && (
                                  <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">
                                    Critique
                                  </Badge>
                                )}
                                {isDepended && (
                                  <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px]">
                                    Dépendance entrante
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-xs text-[#A1A1AA]">
                                <span className="font-mono bg-[#F4F4F5] px-1.5 py-0.5 rounded">
                                  {code}
                                </span>
                                <span>{getDirectionName(p.entityId)}</span>
                                <span>·</span>
                                <span>{p.owner || '—'}</span>
                              </div>
                            </div>

                            <div className="text-center">
                              <div className="text-[9px] text-[#A1A1AA] uppercase tracking-wider">RTO</div>
                              <div className="font-mono font-bold text-sm" style={{ color: wave.color }}>
                                {p.rto || 0}h
                              </div>
                            </div>

                            <div className="text-center">
                              <div className="text-[9px] text-[#A1A1AA] uppercase tracking-wider">RPO</div>
                              <div className="font-mono font-bold text-sm text-[#172030]">
                                {p.rpo || 0}h
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 text-xs">
                              {hasDep ? (
                                <>
                                  <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                                  <span className="text-[#71717A] truncate max-w-[120px]">
                                    Dépend de: {deps.join(', ')}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                                  <span className="text-[#71717A]">Socle — aucune dépendance</span>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {processesInWave.length === 0 && (
                        <div className="text-center py-4 text-[#A1A1AA] text-sm">
                          Aucune activité dans cette vague
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Légende */}
          <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-[#F4F4F5] mt-4">
            {waves.map((wave, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: wave.color }} />
                <span className="text-xs text-[#71717A]">{wave.label}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5 ml-auto">
              <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
              <span className="text-xs text-[#71717A]">Activité avec dépendance amont</span>
            </div>
          </div>
        </div>
      )}

      {/* ===== VUE GANTT ===== */}
      {viewMode === "gantt" && (
        <Card className="border-[#E8E4DC] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* En-tête */}
              <div className="grid grid-cols-[220px_1fr] border-b border-[#E4E4E7] bg-[#FAFAFA]">
                <div className="px-4 py-2.5 text-[10px] font-semibold text-[#71717A] uppercase tracking-wider">
                  Activité
                </div>
                <div className="grid grid-cols-5">
                  {['0h', '2h', '24h', '48h', '120h'].map((label, i) => (
                    <div key={i} className="px-3 py-2.5 font-mono text-[10px] font-semibold text-[#71717A] border-l border-[#E4E4E7]">
                      {label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Lignes */}
              {filteredProcesses
                .sort((a, b) => (a.rto || 0) - (b.rto || 0))
                .map((p) => {
                  const rto = p.rto || 0;
                  const waveIndex = getWaveIndex(rto);
                  const wave = waves[waveIndex];
                  
                  // Calcul de la position (0-100%)
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
                    <div key={p.id} className="grid grid-cols-[220px_1fr] border-b border-[#F4F4F5] hover:bg-[#FAFAFA]">
                      <div className="px-4 py-3">
                        <div className="text-xs font-medium text-[#172030]">{p.name}</div>
                        <div className="text-[10px] text-[#A1A1AA]">{getDirectionName(p.entityId)}</div>
                      </div>
                      <div className="relative h-12">
                        {/* Grille */}
                        <div className="absolute inset-0 grid grid-cols-5">
                          {[0, 1, 2, 3, 4].map((i) => (
                            <div key={i} className="border-l border-[#F4F4F5]" />
                          ))}
                        </div>
                        {/* Barre */}
                        <div 
                          className="absolute top-1/2 -translate-y-1/2 h-6 rounded-md flex items-center px-2 text-white text-[10px] font-mono font-bold"
                          style={{
                            left: 0,
                            width: `${Math.max(position, 5)}%`,
                            backgroundColor: wave.color,
                            minWidth: '30px'
                          }}
                        >
                          {rto}h
                        </div>
                      </div>
                    </div>
                  );
                })}

              {filteredProcesses.length === 0 && (
                <div className="text-center py-8 text-[#A1A1AA] text-sm">
                  Aucun processus correspondant aux filtres
                </div>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default BIARecoverySequence;