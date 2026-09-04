// src/components/pca/bia/BiaDashboard.tsx
import { useMemo, useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  AreaChart,
  Area,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Download,
  ShieldAlert,
  Clock,
  Zap,
  Target,
  Building2,
  PieChart as PieChartIcon,
  Users,
  Server,
  Monitor,
  Handshake,
  Link as LinkIcon,
  Database,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import { useBia } from "@/contexts/BiaContext";
import { useGovernance } from "@/contexts/GovernanceContext";
import { computeMaxScore, scoreToCriticality, type Criticality } from "@/data/bia";
import { supabase } from "@/integrations/resillia/client";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

// ============================================================
// CONSTANTES
// ============================================================

const LEVELS: Criticality[] = ["Critique", "Majeur", "Modéré", "Mineur"];

const SEVERITY_COLORS = {
  "Critique": "#FFEBEE",
  "Sévère": "#FBE9E7",
  "Majeur": "#FFF3E0",
  "Modéré": "#FFF8E1",
  "Mineur": "#E8F5E9",
};

const SEVERITY_TEXT_COLORS = {
  "Critique": "#C62828",
  "Sévère": "#D84315",
  "Majeur": "#E65100",
  "Modéré": "#F57F17",
  "Mineur": "#2E7D32",
};

const SEVERITY_BORDER_COLORS = {
  "Critique": "#EF9A9A",
  "Sévère": "#FFAB91",
  "Majeur": "#FFCC80",
  "Modéré": "#FFE082",
  "Mineur": "#A5D6A7",
};

const CHART_COLORS = {
  "Mineur": "#A5D6A7",
  "Modéré": "#FFE082",
  "Majeur": "#FFCC80",
  "Sévère": "#FFAB91",
  "Critique": "#EF9A9A",
};

// ============================================================
// FONCTIONS DE CALCUL BIA (intégrées)
// ============================================================

interface ResourceCounts {
  [processusId: string]: {
    hr: number;
    equip: number;
    app: number;
    supplier: number;
    total: number;
  };
}

interface BiaCompletionResult {
  total: number;
  complets: number;
  pourcentage: number;
  processusIncomplets: {
    id: string;
    nom: string;
    criticite: string;
    champsManquants: string[];
  }[];
}

/**
 * Vérifie si un processus a un BIA complet
 */
const isProcessusBiaComplet = (
  processus: any,
  resourceCounts: ResourceCounts
): { complet: boolean; champsManquants: string[] } => {
  const manquants: string[] = [];
  const score = computeMaxScore(processus.impacts);
  const criticite = scoreToCriticality(score);

  // 1. Vérifier les impacts
  if (!processus.impacts) {
    manquants.push("Impacts non définis");
  } else {
    const periods = ['P0_4H', 'P4_8H', 'P1D', 'P2D', 'P1W'];
    const axes = ['financial', 'regulatory', 'operational', 'reputation'];
    let hasAllImpacts = true;
    
    for (const period of periods) {
      const periodData = processus.impacts[period];
      if (!periodData || typeof periodData !== 'object') {
        hasAllImpacts = false;
        break;
      }
      let hasValue = false;
      for (const axis of axes) {
        if (periodData[axis] && Number(periodData[axis]) > 0) {
          hasValue = true;
          break;
        }
      }
      if (!hasValue) {
        hasAllImpacts = false;
        break;
      }
    }
    
    if (!hasAllImpacts) {
      manquants.push("Impacts incomplets");
    }
  }

  // 2. Vérifier RTO et RPO
  if (!processus.rto || processus.rto <= 0) {
    manquants.push("RTO non défini");
  }
  if (!processus.rpo || processus.rpo <= 0) {
    manquants.push("RPO non défini");
  }
  
  // 3. Vérifier RTO <= MTPD
  if (processus.rto && processus.mtpd && processus.rto > processus.mtpd) {
    manquants.push(`RTO (${processus.rto}h) > MTPD (${processus.mtpd}h)`);
  }

  // 4. Vérifier la criticité
  if (!criticite) {
    manquants.push("Criticité non calculée");
  }

  // 5. Vérifier les ressources (Critique et Majeur uniquement)
  const res = resourceCounts[processus.id] || { hr: 0, equip: 0, app: 0, supplier: 0, total: 0 };
  const isCritiqueOuMajeur = criticite === "Critique" || criticite === "Majeur";

  if (isCritiqueOuMajeur) {
    if (res.hr === 0) {
      manquants.push("Aucune ressource humaine liée");
    }
    if (res.app === 0) {
      manquants.push("Aucune application IT liée");
    }
    if (res.equip === 0) {
      manquants.push("Aucun équipement lié");
    }
    if (res.supplier === 0) {
      manquants.push("Aucun prestataire lié");
    }
  }

  return { complet: manquants.length === 0, champsManquants: manquants };
};

/**
 * Calcule le taux de couverture BIA
 */
const calculerCouvertureBia = (
  processes: any[],
  resourceCounts: ResourceCounts
): BiaCompletionResult => {
  const total = processes.length;
  let complets = 0;
  const incomplets: { id: string; nom: string; criticite: string; champsManquants: string[] }[] = [];

  for (const p of processes) {
    const score = computeMaxScore(p.impacts);
    const criticite = scoreToCriticality(score);
    const result = isProcessusBiaComplet(p, resourceCounts);
    
    if (result.complet) {
      complets++;
    } else {
      incomplets.push({
        id: p.id,
        nom: p.name || "Sans nom",
        criticite: criticite || "Non définie",
        champsManquants: result.champsManquants,
      });
    }
  }

  let pourcentage = total > 0 ? (complets / total) * 100 : 0;
  if (pourcentage >= 99.5 && incomplets.length > 0) {
    pourcentage = 99;
  }
  pourcentage = Math.round(pourcentage);

  return {
    total,
    complets,
    pourcentage,
    processusIncomplets: incomplets,
  };
};

// ============================================================
// FONCTION HISTORIQUE - CALCULÉ À PARTIR DES VRAIES DONNÉES
// ============================================================

/**
 * Récupère ou CALCULE l'historique des scores BIA à partir des VRAIS processus
 * - D'abord, essaie de lire depuis la table bia_score_snapshots
 * - Si vide, calcule l'historique à partir des dates de création des processus
 */
const getBiaHistoricalScores = async (processes: any[]): Promise<any[]> => {
  try {
    // 1. Essayer de lire depuis Supabase
    const { data, error } = await (supabase as any)
      .from('bia_score_snapshots')
      .select('*')
      .order('date', { ascending: true });

    if (error) {
      console.error('Erreur chargement historique BIA:', error);
    }

    // 2. Si des données existent dans la table, les utiliser
    if (data && data.length > 0) {
      console.log(`✅ ${data.length} snapshots trouvés dans la table`);
      return data;
    }

    // 3. Sinon, CALCULER l'historique à partir des processus réels
    if (!processes || processes.length === 0) {
      return [];
    }

    console.log('🔄 Calcul de l\'historique depuis les VRAIS processus...');

    // Grouper les processus par mois de création
    const monthlyData: Record<string, { 
      processes: any[]; 
      score_sum: number; 
      nb_critiques: number;
      nb_processus: number;
    }> = {};

    for (const p of processes) {
      // Utiliser created_at ou lastUpdated ou date actuelle
      const createdDate = new Date(p.created_at || p.lastUpdated || Date.now());
      const monthKey = createdDate.toISOString().slice(0, 7); // "2025-01"
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          processes: [],
          score_sum: 0,
          nb_critiques: 0,
          nb_processus: 0,
        };
      }
      
      const score = computeMaxScore(p.impacts);
      const criticite = scoreToCriticality(score);
      
      monthlyData[monthKey].processes.push(p);
      monthlyData[monthKey].score_sum += score;
      monthlyData[monthKey].nb_processus++;
      if (criticite === "Critique" || (criticite as string) === "Sévère") {
        monthlyData[monthKey].nb_critiques++;
      }
    }

    // Construire les snapshots mensuels (cumulés)
    const snapshots: any[] = [];
    const sortedKeys = Object.keys(monthlyData).sort();
    
    let cumulativeProcessus = 0;
    let cumulativeCritiques = 0;
    let cumulativeScoreSum = 0;
    let cumulativeCount = 0;

    for (const key of sortedKeys) {
      const monthData = monthlyData[key];
      cumulativeProcessus += monthData.nb_processus;
      cumulativeCritiques += monthData.nb_critiques;
      cumulativeScoreSum += monthData.score_sum;
      cumulativeCount += monthData.nb_processus;
      
      const avgScore = cumulativeCount > 0 ? cumulativeScoreSum / cumulativeCount : 0;
      const coverage = processes.length > 0 
        ? Math.round((cumulativeProcessus / processes.length) * 100) 
        : 0;

      snapshots.push({
        date: `${key}-01`,
        score_moyen: Math.round(avgScore * 10) / 10,
        nb_processus: cumulativeProcessus,
        nb_critiques: cumulativeCritiques,
        taux_couverture: Math.min(coverage, 100),
        _month: key,
      });
    }

    console.log(`✅ ${snapshots.length} mois d'historique calculés à partir des VRAIS processus`);
    return snapshots;

  } catch (error) {
    console.error('Erreur chargement historique BIA:', error);
    return [];
  }
};

// ============================================================
// HELPER : récupère récursivement TOUS les descendants d'une entité
// ============================================================
const getAllDescendantIds = (entities: any[], rootId: string): string[] => {
  const result: string[] = [];
  const stack = [rootId];
  while (stack.length > 0) {
    const currentId = stack.pop()!;
    const children = entities.filter(e => e.parentId === currentId);
    for (const child of children) {
      result.push(child.id);
      stack.push(child.id);
    }
  }
  return result;
};

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================

export const BiaDashboard = () => {
  const { processes, campaigns } = useBia();
  const { entities } = useGovernance();
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const [selectedEntity, setSelectedEntity] = useState<string>("all");
  const [selectedCriticality, setSelectedCriticality] = useState<string>("all");
  const [selectedDirection, setSelectedDirection] = useState<string>("all");

  // État pour les ressources
  const [resourceCounts, setResourceCounts] = useState<Record<string, {
    hr: number;
    equip: number;
    app: number;
    supplier: number;
    total: number;
  }>>({});
  
  // Totaux du référentiel
  const [referentialTotals, setReferentialTotals] = useState({
    hr: 0,
    equip: 0,
    app: 0,
    supplier: 0
  });
  
  const [isLoadingResources, setIsLoadingResources] = useState(true);
  const [historicalScores, setHistoricalScores] = useState<any[]>([]);
  const [isLoadingHistorical, setIsLoadingHistorical] = useState(true);
  
  // État pour la couverture BIA
  const [biaCoverage, setBiaCoverage] = useState<BiaCompletionResult | null>(null);
  const [isCoverageOpen, setIsCoverageOpen] = useState(false);

  // ============================================================
  // FILTRAGE DES PROCESSUS
  // ============================================================
  const filteredProcesses = useMemo(() => {
    let filtered = processes;
    if (selectedEntity !== "all") {
      filtered = filtered.filter((p) => p.entityId === selectedEntity);
    }
    if (selectedCriticality !== "all") {
      filtered = filtered.filter((p) => {
        const crit = scoreToCriticality(computeMaxScore(p.impacts));
        return crit === selectedCriticality;
      });
    }
    if (selectedDirection !== "all") {
      const descendantIds = getAllDescendantIds(entities, selectedDirection);
      filtered = filtered.filter((p) => 
        p.entityId === selectedDirection || descendantIds.includes(p.entityId)
      );
    }
    return filtered;
  }, [processes, selectedEntity, selectedCriticality, selectedDirection, entities]);

  const filteredProcessIds = useMemo(() => 
    filteredProcesses.map(p => p.id), 
    [filteredProcesses]
  );

  // ============================================================
  // CHARGEMENT DES TOTAUX DU RÉFÉRENTIEL
  // ============================================================
  useEffect(() => {
    const loadReferentialTotals = async () => {
      try {
        const [
          { count: hrCount, error: hrError },
          { count: equipCount, error: equipError },
          { count: appCount, error: appError },
          { count: supplierCount, error: supplierError }
        ] = await Promise.all([
          supabase.from('ressources_humaines').select('*', { count: 'exact', head: true }),
          supabase.from('ressources_equipements').select('*', { count: 'exact', head: true }),
          supabase.from('applications_it').select('*', { count: 'exact', head: true }),
          supabase.from('fournisseurs').select('*', { count: 'exact', head: true })
        ]);

        if (hrError) console.error('Erreur comptage RH:', hrError);
        if (equipError) console.error('Erreur comptage Équipements:', equipError);
        if (appError) console.error('Erreur comptage Applications:', appError);
        if (supplierError) console.error('Erreur comptage Prestataires:', supplierError);

        setReferentialTotals({
          hr: hrCount || 0,
          equip: equipCount || 0,
          app: appCount || 0,
          supplier: supplierCount || 0
        });
      } catch (error) {
        console.error('Erreur chargement totaux référentiel:', error);
      }
    };

    loadReferentialTotals();
  }, []);

  // ============================================================
  // CHARGEMENT DES RESSOURCES PAR PROCESSUS
  // ============================================================
  useEffect(() => {
    const loadResourceCounts = async () => {
      if (filteredProcessIds.length === 0) {
        setResourceCounts({});
        setIsLoadingResources(false);
        return;
      }

      setIsLoadingResources(true);
      
      try {
        const [
          { data: hrData },
          { data: equipData },
          { data: appData },
          { data: suppData }
        ] = await Promise.all([
          supabase.from('processus_ressources_humaines').select('processus_id, ressource_humaine_id').in('processus_id', filteredProcessIds),
          supabase.from('processus_equipements').select('processus_id, equipement_id').in('processus_id', filteredProcessIds),
          supabase.from('processus_applications').select('processus_id, application_id').in('processus_id', filteredProcessIds),
          supabase.from('processus_fournisseurs').select('processus_id, fournisseur_id').in('processus_id', filteredProcessIds),
        ]);

        const counts: Record<string, { hr: number; equip: number; app: number; supplier: number; total: number }> = {};
        
        for (const pid of filteredProcessIds) {
          counts[pid] = { hr: 0, equip: 0, app: 0, supplier: 0, total: 0 };
        }

        if (hrData) {
          for (const item of hrData) {
            if (counts[item.processus_id]) {
              counts[item.processus_id].hr++;
              counts[item.processus_id].total++;
            }
          }
        }

        if (equipData) {
          for (const item of equipData) {
            if (counts[item.processus_id]) {
              counts[item.processus_id].equip++;
              counts[item.processus_id].total++;
            }
          }
        }

        if (appData) {
          for (const item of appData) {
            if (counts[item.processus_id]) {
              counts[item.processus_id].app++;
              counts[item.processus_id].total++;
            }
          }
        }

        if (suppData) {
          for (const item of suppData) {
            if (counts[item.processus_id]) {
              counts[item.processus_id].supplier++;
              counts[item.processus_id].total++;
            }
          }
        }

        setResourceCounts(counts);
        
        // Calculer la couverture BIA après chargement des ressources
        const coverage = calculerCouvertureBia(filteredProcesses, counts);
        setBiaCoverage(coverage);
        
      } catch (error) {
        console.error("Erreur chargement des ressources:", error);
        toast({
          title: "Erreur",
          description: "Impossible de charger les ressources",
          variant: "destructive"
        });
      } finally {
        setIsLoadingResources(false);
      }
    };

    loadResourceCounts();
  }, [filteredProcessIds, filteredProcesses]);

  // ============================================================
  // CHARGEMENT DES DONNÉES HISTORIQUES - À PARTIR DES VRAIES DONNÉES
  // ============================================================
  useEffect(() => {
    const loadHistoricalData = async () => {
      setIsLoadingHistorical(true);
      try {
        // 🔥 On passe les processus réels à la fonction
        const data = await getBiaHistoricalScores(processes);
        
        if (data && data.length > 0) {
          setHistoricalScores(data);
        } else {
          setHistoricalScores([]);
        }
      } catch (error) {
        console.error("Erreur chargement historique:", error);
        setHistoricalScores([]);
      } finally {
        setIsLoadingHistorical(false);
      }
    };
    
    // Ne charger que si des processus existent
    if (processes && processes.length > 0) {
      loadHistoricalData();
    } else {
      setHistoricalScores([]);
      setIsLoadingHistorical(false);
    }
  }, [processes]);

  // ============================================================
  // STATISTIQUES
  // ============================================================
  const stats = useMemo(() => {
    const totals = LEVELS.reduce(
      (acc, l) => ({ ...acc, [l]: [] as typeof processes }),
      {} as Record<Criticality, typeof processes>
    );
    let stale = 0;
    let rtoIssues = 0;
    let noResources = 0;
    let totalResources = 0;
    let processesWithResources = 0;
    let processesWithHR = 0;
    let processesWithEquip = 0;
    let processesWithApps = 0;
    let processesWithSuppliers = 0;
    const now = Date.now();

    for (const p of filteredProcesses) {
      const score = computeMaxScore(p.impacts);
      const c = scoreToCriticality(score);
      totals[c].push(p);
      
      const days = (now - new Date(p.lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
      if (days > 365) stale++;
      if (p.rto > p.mtpd) rtoIssues++;
      
      const res = resourceCounts[p.id] || { hr: 0, equip: 0, app: 0, supplier: 0, total: 0 };
      
      const hasHR = res.hr > 0;
      const hasEquip = res.equip > 0;
      const hasApp = res.app > 0;
      const hasSupplier = res.supplier > 0;
      
      if (hasHR) processesWithHR++;
      if (hasEquip) processesWithEquip++;
      if (hasApp) processesWithApps++;
      if (hasSupplier) processesWithSuppliers++;
      
      const hasAnyResource = res.total > 0;
      totalResources += res.total;
      if (hasAnyResource) processesWithResources++;
      if (!hasAnyResource) noResources++;
    }
    
    const criticalCount = totals.Critique.length + totals.Majeur.length;
    const total = filteredProcesses.length;
    const avgScore = total
      ? (filteredProcesses.reduce((acc, p) => acc + computeMaxScore(p.impacts), 0) / total)
      : 0;

    const coverage = biaCoverage?.pourcentage || 0;

    return { 
      totals, 
      criticalCount, 
      total, 
      avgScore, 
      coverage, 
      stale, 
      rtoIssues,
      noResources,
      processesWithResources,
      totalResources,
      processesWithHR,
      processesWithEquip,
      processesWithApps,
      processesWithSuppliers,
    };
  }, [filteredProcesses, resourceCounts, biaCoverage]);

  // ============================================================
  // TOP PROCESSUS CRITIQUES
  // ============================================================
  const topProcesses = useMemo(() => {
    return filteredProcesses
      .map((p) => {
        const score = computeMaxScore(p.impacts);
        const criticality = scoreToCriticality(score);
        const entity = entities.find(e => e.id === p.entityId);
        const daysSinceUpdate = (Date.now() - new Date(p.lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
        return { 
          ...p, 
          score, 
          criticality, 
          entityName: entity?.name || "Sans direction",
          daysSinceUpdate: Math.round(daysSinceUpdate),
          rto: p.rto || 0,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [filteredProcesses, entities]);

  // ============================================================
  // RÉPARTITION PAR DIRECTION
  // ============================================================
  const directionData = useMemo(() => {
    const dirMap: Record<string, Record<string, number>> = {};
    
    const roots = entities.filter(e => e.parentId === null);
    
    for (const root of roots) {
      const descendantIds = getAllDescendantIds(entities, root.id);
      const rootProcesses = filteredProcesses.filter(p => 
        p.entityId === root.id || descendantIds.includes(p.entityId)
      );
      
      if (rootProcesses.length === 0) continue;

      dirMap[root.name] = {
        "Mineur": 0,
        "Modéré": 0,
        "Majeur": 0,
        "Sévère": 0,
        "Critique": 0,
      };
      
      for (const p of rootProcesses) {
        const crit = scoreToCriticality(computeMaxScore(p.impacts));
        if (dirMap[root.name][crit] !== undefined) {
          dirMap[root.name][crit]++;
        }
      }
    }
    
    return Object.entries(dirMap).map(([name, values]) => ({
      name,
      ...values,
      total: Object.values(values).reduce((a, b) => a + b, 0),
    })).filter(d => d.total > 0);
  }, [filteredProcesses, entities]);

  // ============================================================
  // POINTS D'ATTENTION
  // ============================================================
  const attentionPoints = useMemo(() => {
    const points = [];
    const now = Date.now();
    
    // 1. Processus sans collaborateur (RH)
    const noHR = filteredProcesses.filter(p => {
      const res = resourceCounts[p.id] || { hr: 0 };
      return res.hr === 0;
    });
    if (noHR.length > 0) {
      points.push({
        icon: Users,
        color: "text-red-600",
        bg: "bg-red-50",
        text: `${noHR.length} processus sans collaborateur`,
        action: "Voir",
        link: `/bia/process/${noHR[0]?.id || ''}`,
        severity: "high"
      });
    }

    // 2. Processus sans application IT
    const noApp = filteredProcesses.filter(p => {
      const res = resourceCounts[p.id] || { app: 0 };
      return res.app === 0;
    });
    if (noApp.length > 0) {
      points.push({
        icon: Server,
        color: "text-purple-600",
        bg: "bg-purple-50",
        text: `${noApp.length} processus sans application IT`,
        action: "Voir",
        link: `/bia/process/${noApp[0]?.id || ''}`,
        severity: "high"
      });
    }

    // 3. Processus sans équipement
    const noEquip = filteredProcesses.filter(p => {
      const res = resourceCounts[p.id] || { equip: 0 };
      return res.equip === 0;
    });
    if (noEquip.length > 0) {
      points.push({
        icon: Monitor,
        color: "text-amber-600",
        bg: "bg-amber-50",
        text: `${noEquip.length} processus sans équipement`,
        action: "Voir",
        link: `/bia/process/${noEquip[0]?.id || ''}`,
        severity: "medium"
      });
    }

    // 4. Processus sans prestataire
    const noSupplier = filteredProcesses.filter(p => {
      const res = resourceCounts[p.id] || { supplier: 0 };
      return res.supplier === 0;
    });
    if (noSupplier.length > 0) {
      points.push({
        icon: Handshake,
        color: "text-orange-600",
        bg: "bg-orange-50",
        text: `${noSupplier.length} processus sans prestataire`,
        action: "Voir",
        link: `/bia/process/${noSupplier[0]?.id || ''}`,
        severity: "medium"
      });
    }

    // 5. PRA expirés (plus de 365 jours)
    const expiredPra = filteredProcesses.filter(p => {
      if (!p.lastUpdated) return false;
      const days = (now - new Date(p.lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
      return days > 365;
    });
    if (expiredPra.length > 0) {
      points.push({
        icon: Clock,
        color: "text-rose-600",
        bg: "bg-rose-50",
        text: `${expiredPra.length} PRA expiré${expiredPra.length > 1 ? 's' : ''}`,
        action: "Voir",
        link: `/bia/process/${expiredPra[0]?.id || ''}`,
        severity: "critical"
      });
    }

    // 6. Processus critiques sans PCA
    const noPca = filteredProcesses.filter(p => !(p as any).hasPca && computeMaxScore(p.impacts) >= 3);
    if (noPca.length > 0) {
      points.push({
        icon: ShieldAlert,
        color: "text-orange-600",
        bg: "bg-orange-50",
        text: `${noPca.length} processus critique${noPca.length > 1 ? 's' : ''} sans PCA`,
        action: "Voir",
        link: `/bia/process/${noPca[0]?.id || ''}`,
        severity: "high"
      });
    }

    return points.slice(0, 6);
  }, [filteredProcesses, resourceCounts]);

  // ============================================================
  // DONNÉES POUR GRAPHIQUES
  // ============================================================
  const pieData = LEVELS.map((level) => ({
    name: level,
    value: stats.totals[level]?.length || 0,
    color: SEVERITY_COLORS[level as keyof typeof SEVERITY_COLORS] || "#E8E4DC",
    textColor: SEVERITY_TEXT_COLORS[level as keyof typeof SEVERITY_TEXT_COLORS] || "#6B7280",
    borderColor: SEVERITY_BORDER_COLORS[level as keyof typeof SEVERITY_BORDER_COLORS] || "#D1D5DB",
  })).filter((d) => d.value > 0);

  // Données d'évolution - calculées à partir des VRAIS processus
  const scoreEvolutionData = useMemo(() => {
    if (historicalScores.length > 0) {
      return historicalScores.map((s) => ({
        month: new Date(s.date).toLocaleDateString('fr', { month: 'short', year: '2-digit' }),
        score: Math.round(s.score_moyen * 10) / 10,
        processes: s.nb_processus,
        coverage: s.taux_couverture,
      }));
    }
    return [];
  }, [historicalScores]);

  // ============================================================
  // GESTIONNAIRES DE CLIC
  // ============================================================
  const openProcessDetail = (processId: string) => {
    if (processId) {
      window.dispatchEvent(new CustomEvent('openProcessDetail', { detail: { processId } }));
    }
  };

  // ============================================================
  // EXPORT PDF
  // ============================================================
  const handleExportPDF = async () => {
    if (!dashboardRef.current) return;
    
    setIsExporting(true);
    
    try {
      const element = dashboardRef.current;
      
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#F8F6F2',
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
      });
      
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      pdf.setFillColor(23, 32, 48);
      pdf.rect(0, 0, pdfWidth, 25, 'F');
      
      pdf.setTextColor(248, 246, 242);
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Resillia — Tableau de bord BIA', 15, 15);
      
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      const dateStr = new Date().toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      pdf.text(`Généré le ${dateStr}`, 15, 21);
      
      const imgWidth = pdfWidth - 20;
      const imgHeight = (canvas.height / canvas.width) * imgWidth;
      
      let heightLeft = imgHeight;
      let position = 30;
      
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= (pdfHeight - position - 20);
      
      while (heightLeft > 0) {
        pdf.addPage();
        position = 10;
        const yOffset = imgHeight - heightLeft - 10;
        pdf.addImage(imgData, 'PNG', 10, position - yOffset, imgWidth, imgHeight);
        heightLeft -= (pdfHeight - position - 20);
      }
      
      const pageCount = pdf.internal.pages.length;
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`Page ${i}/${pageCount}`, pdfWidth - 30, pdfHeight - 8);
        pdf.text('Document confidentiel - Resillia', 15, pdfHeight - 8);
      }
      
      pdf.save(`Tableau_de_bord_BIA_${new Date().toISOString().split('T')[0]}.pdf`);
      
      toast({
        title: "Export réussi",
        description: "Le PDF a été généré et téléchargé",
      });
    } catch (error) {
      console.error("Erreur lors de l'export PDF:", error);
      toast({
        title: "Erreur d'export",
        description: "Impossible de générer le PDF. Veuillez réessayer.",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  // ============================================================
  // LEVEL BADGE CLASS
  // ============================================================
  const levelBadgeClass = (level: string) => {
    const classes = {
      "Critique": "bg-[#FFEBEE] text-[#C62828] border-[#EF9A9A]",
      "Sévère": "bg-[#FBE9E7] text-[#D84315] border-[#FFAB91]",
      "Majeur": "bg-[#FFF3E0] text-[#E65100] border-[#FFCC80]",
      "Modéré": "bg-[#FFF8E1] text-[#F57F17] border-[#FFE082]",
      "Mineur": "bg-[#E8F5E9] text-[#2E7D32] border-[#A5D6A7]",
    };
    return classes[level as keyof typeof classes] || "bg-gray-100 text-gray-700 border-gray-200";
  };

  const getScoreColor = (score: number) => {
    if (score >= 4) return "text-[#C62828]";
    if (score >= 3) return "text-[#E65100]";
    if (score >= 2) return "text-[#F57F17]";
    return "text-[#2E7D32]";
  };

  // ============================================================
  // RENDU DE LA CARTE RESSOURCES (TOTAUX DU RÉFÉRENTIEL)
  // ============================================================
  const renderResourceCard = () => {
    if (isLoadingResources) {
      return (
        <div className="flex flex-col items-center justify-center h-[200px] gap-3">
          <RefreshCw className="h-6 w-6 animate-spin text-[#2A5141]" />
          <p className="text-sm text-[#172030]/40">Chargement des ressources...</p>
        </div>
      );
    }

    const resourceTypes = [
      { 
        key: 'hr', 
        label: 'Collaborateurs', 
        icon: Users, 
        count: referentialTotals.hr,
        color: 'text-blue-600',
        bg: 'bg-blue-50'
      },
      { 
        key: 'equip', 
        label: 'Équipements', 
        icon: Monitor, 
        count: referentialTotals.equip,
        color: 'text-amber-600',
        bg: 'bg-amber-50'
      },
      { 
        key: 'app', 
        label: 'Applications IT', 
        icon: Server, 
        count: referentialTotals.app,
        color: 'text-purple-600',
        bg: 'bg-purple-50'
      },
      { 
        key: 'supplier', 
        label: 'Prestataires', 
        icon: Handshake, 
        count: referentialTotals.supplier,
        color: 'text-orange-600',
        bg: 'bg-orange-50'
      },
    ];

    const totalResources = referentialTotals.hr + referentialTotals.equip + referentialTotals.app + referentialTotals.supplier;

    return (
      <div className="space-y-4">
        <div className="space-y-3">
          {resourceTypes.map((rt) => {
            const Icon = rt.icon;
            const hasResources = rt.count > 0;
            
            return (
              <div key={rt.key} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                    rt.bg
                  )}>
                    <Icon className={cn("h-4 w-4", rt.color)} />
                  </div>
                  <span className="text-sm font-medium text-[#172030]">{rt.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-[#172030]" style={{ fontFamily: "Playfair Display, serif" }}>
                    {rt.count}
                  </span>
                  {!hasResources && (
                    <div className="w-2 h-2 rounded-full bg-[#E65100] flex-shrink-0" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-3 border-t border-[#E8E4DC] flex items-center justify-between">
          <span className="text-sm font-medium text-[#172030]">Total ressources</span>
          <span className="text-xl font-bold text-[#2A5141]" style={{ fontFamily: "Playfair Display, serif" }}>
            {totalResources}
          </span>
        </div>
      </div>
    );
  };

  // ============================================================
  // RENDU
  // ============================================================
  if (!processes || processes.length === 0) {
    return (
      <div className="bg-[#F8F6F2] min-h-screen p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-96">
            <Card className="border-gray-200 shadow-sm max-w-md w-full">
              <CardContent className="p-8 text-center">
                <Database className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-700 font-medium">Aucune donnée BIA disponible</p>
                <p className="text-sm text-gray-500 mt-1">Commencez par créer des processus dans le module BIA</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={dashboardRef} className="bg-[#F8F6F2] min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ===== HEADER ===== */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#172030]" style={{ fontFamily: "Playfair Display, serif" }}>
              Tableau de bord BIA
            </h1>
            <p className="text-sm text-[#172030]/50">
              Vue globale de la continuité métier · {stats.total} processus analysés
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-medium text-[#172030]/40 uppercase tracking-wider">Direction</label>
              <Select value={selectedDirection} onValueChange={setSelectedDirection}>
                <SelectTrigger className="w-[140px] h-8 text-xs border-[#E8E4DC] bg-white">
                  <SelectValue placeholder="Toutes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {entities.filter(e => e.parentId === null).map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-medium text-[#172030]/40 uppercase tracking-wider">Criticité</label>
              <Select value={selectedCriticality} onValueChange={setSelectedCriticality}>
                <SelectTrigger className="w-[120px] h-8 text-xs border-[#E8E4DC] bg-white">
                  <SelectValue placeholder="Toutes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>{level}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 gap-1.5 border-[#E8E4DC] text-[#172030]/60 hover:text-[#172030]"
              onClick={handleExportPDF}
              disabled={isExporting}
            >
              <Download className="h-3.5 w-3.5" />
              {isExporting ? "Export en cours..." : "Exporter"}
            </Button>
          </div>
        </div>

        {/* ===== LIGNE 1: KPI ===== */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-[#E8E4DC] shadow-sm bg-white hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider">Processus analysés</p>
                  <p className="text-2xl font-bold text-[#172030] mt-0.5" style={{ fontFamily: "Playfair Display, serif" }}>
                    {stats.total}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-[#172030]/40">Couverture BIA</span>
                    <span className="text-[10px] font-medium text-[#2A5141]">{stats.coverage}%</span>
                  </div>
                </div>
                <div className="h-10 w-10 rounded-xl bg-[#E8F5E9] flex items-center justify-center flex-shrink-0 ml-3">
                  <Activity className="h-4.5 w-4.5 text-[#2A5141]" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E8E4DC] shadow-sm bg-white hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider">Processus critiques</p>
                  <p className="text-2xl font-bold text-[#C62828] mt-0.5" style={{ fontFamily: "Playfair Display, serif" }}>
                    {stats.criticalCount}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-[#172030]/40">Niveau critique</span>
                    <span className="text-[10px] font-medium text-[#2A5141]">
                      {stats.criticalCount > 0 ? '⚠️ Attention' : '✅ OK'}
                    </span>
                  </div>
                </div>
                <div className="h-10 w-10 rounded-xl bg-[#FFEBEE] flex items-center justify-center flex-shrink-0 ml-3">
                  <AlertTriangle className="h-4.5 w-4.5 text-[#C62828]" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E8E4DC] shadow-sm bg-white hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider">Score moyen</p>
                  <p className="text-2xl font-bold text-[#172030] mt-0.5" style={{ fontFamily: "Playfair Display, serif" }}>
                    {stats.avgScore.toFixed(1)}/5
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-[#172030]/40">Tendance</span>
                    <span className="text-[10px] font-medium text-[#2A5141]">
                      {stats.avgScore > 3 ? '↑ En hausse' : '→ Stable'}
                    </span>
                  </div>
                </div>
                <div className="h-10 w-10 rounded-xl bg-[#E8F5E9] flex items-center justify-center flex-shrink-0 ml-3">
                  <TrendingUp className="h-4.5 w-4.5 text-[#2E7D32]" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ===== CARTE COUVERTURE BIA AVEC TOOLTIP ===== */}
          <Card className="border-[#E8E4DC] shadow-sm bg-white hover:shadow-md transition-shadow relative">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider">Couverture BIA</p>
                  <p className="text-2xl font-bold text-[#172030] mt-0.5" style={{ fontFamily: "Playfair Display, serif" }}>
                    {stats.coverage}%
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-[#172030]/40">Objectif</span>
                    <span className="text-[10px] font-medium text-[#2A5141]">
                      {stats.coverage >= 80 ? '✅ Atteint' : '⏳ En cours'}
                    </span>
                  </div>
                  {biaCoverage && biaCoverage.processusIncomplets.length > 0 && (
                    <button
                      onClick={() => setIsCoverageOpen(!isCoverageOpen)}
                      className="flex items-center gap-1 text-[10px] text-[#172030]/50 hover:text-[#2A5141] mt-1 transition-colors"
                    >
                      <Info className="h-3 w-3" />
                      <span>{biaCoverage.processusIncomplets.length} processus incomplet{biaCoverage.processusIncomplets.length > 1 ? 's' : ''}</span>
                      {isCoverageOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                  )}
                </div>
                <div className="h-10 w-10 rounded-xl bg-[#E8F5E9] flex items-center justify-center flex-shrink-0 ml-3">
                  <CheckCircle2 className="h-4.5 w-4.5 text-[#2A5141]" />
                </div>
              </div>

              {isCoverageOpen && biaCoverage && biaCoverage.processusIncomplets.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[#E8E4DC] max-h-[200px] overflow-y-auto">
                  <p className="text-[9px] font-medium text-[#172030]/40 uppercase tracking-wider mb-2">
                    Processus à compléter
                  </p>
                  <div className="space-y-1.5">
                    {biaCoverage.processusIncomplets.map((p) => (
                      <div 
                        key={p.id}
                        className="flex items-start gap-2 p-2 rounded-lg bg-[#F8F6F2] hover:bg-[#F0EDE8] cursor-pointer transition-colors"
                        onClick={() => openProcessDetail(p.id)}
                      >
                        <Badge className={cn(
                          "text-[8px] px-1.5 py-0.5 flex-shrink-0 mt-0.5",
                          levelBadgeClass(p.criticite)
                        )}>
                          {p.criticite}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-[#172030] truncate">{p.nom}</p>
                          <p className="text-[9px] text-[#172030]/40 truncate">
                            {p.champsManquants.join(', ')}
                          </p>
                        </div>
                        <ChevronDown className="h-3 w-3 text-[#172030]/30 flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ===== LIGNE 2: Top processus + Donut + Évolution ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <Card className="lg:col-span-3 border-[#E8E4DC] shadow-sm bg-white flex flex-col">
            <CardHeader className="pb-2 flex-shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-[#172030] flex items-center gap-2" style={{ fontFamily: "Playfair Display, serif" }}>
                  <Target className="h-4 w-4 text-[#172030]/40" />
                  Top processus critiques
                </CardTitle>
                <span className="text-xs text-[#172030]/40">5 processus les plus critiques</span>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0 px-4 pb-4">
              <div className="h-full flex flex-col">
                <div className="grid grid-cols-6 gap-2 py-1.5 border-b border-[#E8E4DC]">
                  <span className="text-[9px] font-medium text-[#172030]/40 uppercase tracking-wider col-span-2">Processus</span>
                  <span className="text-[9px] font-medium text-[#172030]/40 uppercase tracking-wider">Direction</span>
                  <span className="text-[9px] font-medium text-[#172030]/40 uppercase tracking-wider text-center">Score</span>
                  <span className="text-[9px] font-medium text-[#172030]/40 uppercase tracking-wider text-center">RTO</span>
                  <span className="text-[9px] font-medium text-[#172030]/40 uppercase tracking-wider text-center">Criticité</span>
                </div>
                <div className="flex-1 divide-y divide-[#E8E4DC]/50 overflow-y-auto">
                  {topProcesses.length > 0 ? (
                    topProcesses.map((p, index) => {
                      const scorePercent = (p.score / 5) * 100;
                      return (
                        <div 
                          key={p.id || index} 
                          className="grid grid-cols-6 gap-2 py-2.5 items-center hover:bg-[#F8F6F2] rounded-lg transition-colors -mx-1 px-1 cursor-pointer"
                          onClick={() => openProcessDetail(p.id)}
                        >
                          <span className="text-sm font-medium text-[#172030] truncate col-span-2">{p.name}</span>
                          <span className="text-xs text-[#172030]/50 truncate flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {p.entityName}
                          </span>
                          <div className="flex items-center gap-1.5 justify-center">
                            <span className={cn("text-sm font-bold", getScoreColor(p.score))}>{p.score.toFixed(1)}</span>
                            <div className="w-10 h-1 bg-[#E8E4DC] rounded-full overflow-hidden">
                              <div 
                                className="h-full rounded-full transition-all"
                                style={{ 
                                  width: `${scorePercent}%`,
                                  backgroundColor: p.score >= 4 ? "#C62828" : p.score >= 3 ? "#E65100" : p.score >= 2 ? "#F57F17" : "#2E7D32"
                                }}
                              />
                            </div>
                          </div>
                          <span className="text-xs text-[#172030]/60 text-center font-mono">{p.rto || 0}h</span>
                          <Badge className={cn("text-[9px] px-2 py-0.5 h-5 border text-center justify-center", levelBadgeClass(p.criticality))}>
                            {p.criticality}
                          </Badge>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex items-center justify-center h-full text-sm text-[#172030]/30">
                      Aucun processus trouvé
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-1 border-[#E8E4DC] shadow-sm bg-white flex flex-col">
            <CardHeader className="pb-1 flex-shrink-0">
              <CardTitle className="text-sm font-semibold text-[#172030] flex items-center gap-2" style={{ fontFamily: "Playfair Display, serif" }}>
                <PieChartIcon className="h-4 w-4 text-[#172030]/40" />
                Criticité
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0 px-3 pb-3">
              <div className="h-full flex flex-col items-center">
                <div className="relative w-[110px] h-[110px] flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData.length > 0 ? pieData : [{ name: "Aucune donnée", value: 1, color: "#E8E4DC", borderColor: "#D1D5DB" }]}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={35}
                        outerRadius={52}
                        paddingAngle={2}
                        stroke="white"
                        strokeWidth={2}
                      >
                        {(pieData.length > 0 ? pieData : [{ name: "Aucune donnée", value: 1, color: "#E8E4DC", borderColor: "#D1D5DB" }]).map((d) => (
                          <Cell key={d.name} fill={d.color} stroke={d.borderColor} strokeWidth={1} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-lg font-bold text-[#172030]" style={{ fontFamily: "Playfair Display, serif" }}>
                        {stats.total}
                      </p>
                      <p className="text-[8px] text-[#172030]/40 uppercase tracking-wider">Total</p>
                    </div>
                  </div>
                </div>
                <div className="w-full mt-2 space-y-1">
                  {pieData.length > 0 ? (
                    pieData.map((d) => (
                      <div key={d.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color, border: `1px solid ${d.borderColor}` }} />
                          <span className="text-[10px] text-[#172030]/70">{d.name}</span>
                        </div>
                        <span className="text-[10px] font-medium text-[#172030]">
                          {d.value} ({stats.total > 0 ? ((d.value / stats.total) * 100).toFixed(0) : 0}%)
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-[10px] text-[#172030]/40 py-2">
                      Aucune donnée de criticité
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-1 border-[#E8E4DC] shadow-sm bg-white flex flex-col">
            <CardHeader className="pb-1 flex-shrink-0">
              <CardTitle className="text-sm font-semibold text-[#172030] flex items-center gap-2" style={{ fontFamily: "Playfair Display, serif" }}>
                <TrendingUp className="h-4 w-4 text-[#172030]/40" />
                Évolution
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0 px-3 pb-3">
              <div className="h-full flex flex-col">
                <div className="flex-1 min-h-[80px]">
                  {scoreEvolutionData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={scoreEvolutionData}>
                        <defs>
                          <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2A5141" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#2A5141" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area
                          type="monotone"
                          dataKey="score"
                          stroke="#2A5141"
                          strokeWidth={2}
                          fill="url(#scoreGradient)"
                          dot={{ r: 2, fill: "#2A5141", strokeWidth: 1 }}
                        />
                        <XAxis 
                          dataKey="month" 
                          tick={{ fontSize: 8, fill: "#172030/40" }}
                          axisLine={false}
                          tickLine={false}
                          interval={Math.floor(scoreEvolutionData.length / 6)}
                        />
                        <YAxis 
                          domain={[1, 5]} 
                          tick={{ fontSize: 8, fill: "#172030/40" }}
                          axisLine={false}
                          tickLine={false}
                          width={20}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <div className="text-[#172030]/20">
                        <Database className="h-8 w-8 mx-auto mb-2" />
                        <p className="text-[10px] text-[#172030]/40">Aucune donnée historique</p>
                        <p className="text-[8px] text-[#172030]/30">Les snapshots mensuels apparaîtront ici</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between text-[10px] text-[#172030]/40 mt-1 pt-1 border-t border-[#E8E4DC]">
                  <span>Score moyen</span>
                  <span className="font-medium text-[#2A5141]">{stats.avgScore.toFixed(1)}/5</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ===== LIGNE 3: Répartition par direction + RESSOURCES ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 border-[#E8E4DC] shadow-sm bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-[#172030] flex items-center gap-2" style={{ fontFamily: "Playfair Display, serif" }}>
                <Building2 className="h-4 w-4 text-[#172030]/40" />
                Répartition par direction
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {directionData.length > 0 ? (
                <>
                  <div className="h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={directionData}
                        layout="vertical"
                        margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                      >
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "#172030/60" }} width={90} />
                        <RechartsTooltip 
                          contentStyle={{
                            backgroundColor: "white",
                            border: "1px solid #E8E4DC",
                            borderRadius: "6px",
                            fontSize: "11px",
                            padding: "6px 10px",
                          }}
                        />
                        <Bar dataKey="Mineur" stackId="a" fill={CHART_COLORS.Mineur} />
                        <Bar dataKey="Modéré" stackId="a" fill={CHART_COLORS.Modéré} />
                        <Bar dataKey="Majeur" stackId="a" fill={CHART_COLORS.Majeur} />
                        <Bar dataKey="Sévère" stackId="a" fill={CHART_COLORS.Sévère} />
                        <Bar dataKey="Critique" stackId="a" fill={CHART_COLORS.Critique} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-3 mt-1">
                    {["Mineur", "Modéré", "Majeur", "Sévère", "Critique"].map((level) => (
                      <div key={level} className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[level as keyof typeof CHART_COLORS] }} />
                        <span className="text-[9px] text-[#172030]/50">{level}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-[180px] text-sm text-[#172030]/30">
                  Aucune donnée à afficher pour cette sélection
                </div>
              )}
            </CardContent>
          </Card>

          {/* ===== CARTE : RESSOURCES ===== */}
          <Card className="border-[#E8E4DC] shadow-sm bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-[#172030] flex items-center gap-2" style={{ fontFamily: "Playfair Display, serif" }}>
                <LinkIcon className="h-4 w-4 text-[#172030]/40" />
                Ressources
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {renderResourceCard()}
            </CardContent>
          </Card>
        </div>

        {/* ===== LIGNE 4: Points d'attention ===== */}
        <Card className="border-[#E8E4DC] shadow-sm bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-[#172030] flex items-center gap-2" style={{ fontFamily: "Playfair Display, serif" }}>
                <Zap className="h-4 w-4 text-[#E65100]" />
                Points d'attention
              </CardTitle>
              <span className="text-xs text-[#172030]/40">Alertes à surveiller</span>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {attentionPoints.length > 0 ? (
                attentionPoints.map((point, index) => {
                  const Icon = point.icon;
                  const severityColors = {
                    critical: { border: "border-red-200", bg: "bg-red-50", text: "text-red-700" },
                    high: { border: "border-orange-200", bg: "bg-orange-50", text: "text-orange-700" },
                    medium: { border: "border-yellow-200", bg: "bg-yellow-50", text: "text-yellow-700" },
                    low: { border: "border-green-200", bg: "bg-green-50", text: "text-green-700" },
                  };
                  const sev = severityColors[point.severity as keyof typeof severityColors] || severityColors.medium;
                  
                  return (
                    <div 
                      key={index} 
                      className={cn(
                        "flex items-center justify-between gap-2 py-2.5 px-3 rounded-lg border transition-colors cursor-pointer hover:shadow-sm",
                        sev.border,
                        sev.bg,
                      )}
                      onClick={() => {
                        if (point.link) {
                          const processId = point.link.split('/').pop();
                          if (processId) openProcessDetail(processId);
                        }
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className={`h-7 w-7 rounded-lg ${sev.bg} flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`h-3.5 w-3.5 ${sev.text}`} />
                        </div>
                        <p className="text-xs text-[#172030] break-words">{point.text}</p>
                      </div>
                      <span className="text-xs text-[#172030]/40 flex-shrink-0">{point.action}</span>
                    </div>
                  );
                })
              ) : (
                <div className="flex items-center justify-center col-span-full py-4 text-sm text-[#172030]/30">
                  <CheckCircle2 className="h-5 w-5 text-[#2E7D32] mr-2" />
                  Aucune alerte — Tout est sous contrôle
                </div>
              )}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};