// src/components/pca/Dashboard.tsx
import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  Activity,
  TrendingUp,
  RefreshCw,
  FileText,
  Bell,
  Calendar,
  CheckCircle2,
  AlertOctagon,
  FileCheck,
  Building2,
  Users,
  Server,
  Handshake,
  Database,
  Clock,
  Gauge,
  Target,
  Shield,
  Flame,
  Monitor,
  Boxes,
  ArrowRight,
  Link,
  GitBranch,
  MapPin,
  AlertCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/resillia/client";
import { useBia } from "@/contexts/BiaContext";
import { useGovernance } from "@/contexts/GovernanceContext";
import { computeMaxScore, scoreToCriticality } from "@/data/bia";

// ============================================================
// HELPERS & COULEURS
// ============================================================
const getAllDescendantIds = (entities: any[], rootId: string): string[] => {
  const result: string[] = [];
  const stack = [rootId];
  while (stack.length > 0) {
    const currentId = stack.pop()!;
    const children = entities.filter((e) => e.parentId === currentId);
    for (const child of children) {
      result.push(child.id);
      stack.push(child.id);
    }
  }
  return result;
};

const CHART_COLORS = {
  Mineur: "#A5D6A7",
  Modéré: "#FFE082",
  Majeur: "#FFCC80",
  Sévère: "#FFAB91",
  Critique: "#EF9A9A",
};

const MATRIX_STYLES = {
  low: { bg: "#D4F5E5", border: "#A8E5C1", dot: "#22C55E", text: "#16A34A" },
  moderate: {
    bg: "#FFF4D6",
    border: "#FFE28A",
    dot: "#EAB308",
    text: "#CA8A04",
  },
  high: { bg: "#FFE8D6", border: "#FFC38A", dot: "#F97316", text: "#EA580C" },
  critical: {
    bg: "#FCE4E8",
    border: "#F5A8B5",
    dot: "#EF4444",
    text: "#DC2626",
  },
};

const getMatrixStyle = (score: number) => {
  if (score >= 16) return MATRIX_STYLES.critical;
  if (score >= 9) return MATRIX_STYLES.high;
  if (score >= 4) return MATRIX_STYLES.moderate;
  return MATRIX_STYLES.low;
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

function isProcessusBiaComplet(
  processus: any,
  resourceCounts: ResourceCounts
): { complet: boolean; champsManquants: string[] } {
  const manquants: string[] = [];
  const score = computeMaxScore(processus.impacts);
  const criticite = scoreToCriticality(score);

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

  if (!processus.rto || processus.rto <= 0) {
    manquants.push("RTO non défini");
  }
  if (!processus.rpo || processus.rpo <= 0) {
    manquants.push("RPO non défini");
  }
  
  if (processus.rto && processus.mtpd && processus.rto > processus.mtpd) {
    manquants.push(`RTO (${processus.rto}h) > MTPD (${processus.mtpd}h)`);
  }

  if (!criticite) {
    manquants.push("Criticité non calculée");
  }

  const res = resourceCounts[processus.id] || { hr: 0, equip: 0, app: 0, supplier: 0, total: 0 };
  const isCritiqueOuMajeur = criticite === "Critique" || criticite === "Majeur";

  if (isCritiqueOuMajeur) {
    if (res.hr === 0) manquants.push("Aucune ressource humaine liée");
    if (res.app === 0) manquants.push("Aucune application IT liée");
    if (res.equip === 0) manquants.push("Aucun équipement lié");
    if (res.supplier === 0) manquants.push("Aucun prestataire lié");
  }

  return { complet: manquants.length === 0, champsManquants: manquants };
}

function calculerCouvertureBia(
  processes: any[],
  resourceCounts: ResourceCounts
): { total: number; complet: number; pourcentage: number } {
  const total = processes.length;
  let complets = 0;

  for (const p of processes) {
    const result = isProcessusBiaComplet(p, resourceCounts);
    if (result.complet) complets++;
  }

  let pourcentage = total > 0 ? (complets / total) * 100 : 0;
  if (pourcentage >= 99.5 && total - complets > 0) pourcentage = 99;
  pourcentage = Math.round(pourcentage);

  return { total, complet: complets, pourcentage };
}

// ============================================================
// HOOK CENTRALISÉ - AVEC CALCULS JUSTES
// ============================================================
const useBCMDashboard = () => {
  const { processes } = useBia();
  const { entities } = useGovernance();

  const [events, setEvents] = useState<any[]>([]);
  const [strategies, setStrategies] = useState<any[]>([]);
  const [associations, setAssociations] = useState<any[]>([]);
  const [rh, setRh] = useState<any[]>([]);
  const [equip, setEquip] = useState<any[]>([]);
  const [apps, setApps] = useState<any[]>([]);
  const [fournisseurs, setFournisseurs] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [risques, setRisques] = useState<any[]>([]);
  const [resourceCounts, setResourceCounts] = useState<ResourceCounts>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [ev, st, asso, rhRes, eqRes, appRes, fourRes, plRes, risqRes] =
          await Promise.all([
            supabase.from("calendar_events").select("*"),
            supabase.from("strategies_catalogue").select("*"),
            supabase.from("strategies_association").select("*"),
            supabase.from("ressources_humaines").select("*"),
            supabase.from("ressources_equipements").select("*"),
            supabase.from("applications_it").select("*"),
            supabase.from("fournisseurs").select("*"),
            supabase.from("plans").select("*"),
            supabase.from("risques").select("*"),
          ]);

        setEvents(ev.data || []);
        setStrategies(st.data || []);
        setAssociations(asso.data || []);
        setRh(rhRes.data || []);
        setEquip(eqRes.data || []);
        setApps(appRes.data || []);
        setFournisseurs(fourRes.data || []);
        setPlans(plRes.data || []);
        setRisques(risqRes.data || []);

        const processIds = processes.map(p => p.id);
        if (processIds.length > 0) {
          const [
            { data: hrLinks },
            { data: equipLinks },
            { data: appLinks },
            { data: suppLinks }
          ] = await Promise.all([
            supabase.from('processus_ressources_humaines').select('processus_id, ressource_humaine_id').in('processus_id', processIds),
            supabase.from('processus_equipements').select('processus_id, equipement_id').in('processus_id', processIds),
            supabase.from('processus_applications').select('processus_id, application_id').in('processus_id', processIds),
            supabase.from('processus_fournisseurs').select('processus_id, fournisseur_id').in('processus_id', processIds),
          ]);

          const counts: ResourceCounts = {};
          for (const pid of processIds) {
            counts[pid] = { hr: 0, equip: 0, app: 0, supplier: 0, total: 0 };
          }

          if (hrLinks) {
            for (const item of hrLinks) {
              if (counts[item.processus_id]) {
                counts[item.processus_id].hr++;
                counts[item.processus_id].total++;
              }
            }
          }
          if (equipLinks) {
            for (const item of equipLinks) {
              if (counts[item.processus_id]) {
                counts[item.processus_id].equip++;
                counts[item.processus_id].total++;
              }
            }
          }
          if (appLinks) {
            for (const item of appLinks) {
              if (counts[item.processus_id]) {
                counts[item.processus_id].app++;
                counts[item.processus_id].total++;
              }
            }
          }
          if (suppLinks) {
            for (const item of suppLinks) {
              if (counts[item.processus_id]) {
                counts[item.processus_id].supplier++;
                counts[item.processus_id].total++;
              }
            }
          }
          setResourceCounts(counts);
        }
      } catch (error) {
        console.error("Erreur chargement données:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [processes]);

  // ============================================================
  // CALCUL DE LA MATURITÉ BCM
  // ============================================================
  const maturite = useMemo(() => {
    const totalProcessus = processes.length;
    const totalRisques = risques.length;

    const biaResult = calculerCouvertureBia(processes, resourceCounts);
    const biaScore = biaResult.pourcentage;

    const risquesComplets = risques.filter((r) => {
      const hasProbabilite = r.probabilite && r.probabilite > 0;
      const hasImpact = r.impact_global && r.impact_global > 0;
      const hasMesure = r.mesures_existantes && r.mesures_existantes.length > 0;
      return hasProbabilite && hasImpact && hasMesure;
    }).length;

    let risquesScore = totalRisques > 0 ? (risquesComplets / totalRisques) * 100 : 0;
    if (risquesScore >= 99.5 && totalRisques - risquesComplets > 0) risquesScore = 99;
    risquesScore = Math.round(risquesScore);

    const processusAvecCriticite = processes.map((p) => {
      const score = computeMaxScore(p.impacts);
      const criticite = scoreToCriticality(score);
      return { ...p, score, criticite };
    });

    const processusCritiques = processusAvecCriticite.filter(
      (p) => p.criticite === "Critique" || p.criticite === "Sévère"
    );
    const totalCritiques = processusCritiques.length;

    const processusCritiquesAvecStrategie = processusCritiques.filter(
      (p) => associations.some((a) => a.processus_id === p.id)
    ).length;

    let strategiesScore = totalCritiques > 0 
      ? (processusCritiquesAvecStrategie / totalCritiques) * 100 
      : 0;
    if (strategiesScore >= 99.5 && totalCritiques - processusCritiquesAvecStrategie > 0) strategiesScore = 99;
    strategiesScore = Math.round(strategiesScore);

    const processusCritiquesAvecPlanApprouve = processusCritiques.filter(
      (p) => plans.some((pl) => pl.processus_id === p.id && pl.statut === "Approuvé")
    ).length;

    let plansScore = totalCritiques > 0 
      ? (processusCritiquesAvecPlanApprouve / totalCritiques) * 100 
      : 0;
    if (plansScore >= 99.5 && totalCritiques - processusCritiquesAvecPlanApprouve > 0) plansScore = 99;
    plansScore = Math.round(plansScore);

    const processusCritiquesAvecRessourcesCompletes = processusCritiques.filter((p) => {
      const res = resourceCounts[p.id] || { hr: 0, equip: 0, app: 0, supplier: 0 };
      return res.hr > 0 && res.equip > 0 && res.app > 0 && res.supplier > 0;
    }).length;

    let ressourcesScore = totalCritiques > 0 
      ? (processusCritiquesAvecRessourcesCompletes / totalCritiques) * 100 
      : 0;
    if (ressourcesScore >= 99.5 && totalCritiques - processusCritiquesAvecRessourcesCompletes > 0) ressourcesScore = 99;
    ressourcesScore = Math.round(ressourcesScore);

    const globalScore = Math.round(
      (biaScore * 0.20) +
      (risquesScore * 0.20) +
      (strategiesScore * 0.20) +
      (plansScore * 0.25) +
      (ressourcesScore * 0.15)
    );

    const modules = [
      { label: "BIA", value: biaScore, manquant: biaResult.total - biaResult.complet },
      { label: "Risques", value: risquesScore, manquant: totalRisques - risquesComplets },
      { label: "Stratégies", value: strategiesScore, manquant: totalCritiques - processusCritiquesAvecStrategie },
      { label: "Plans", value: plansScore, manquant: totalCritiques - processusCritiquesAvecPlanApprouve },
      { label: "Ressources", value: ressourcesScore, manquant: totalCritiques - processusCritiquesAvecRessourcesCompletes },
    ];

    const weakest = modules.reduce((min, m) => m.value < min.value ? m : min, modules[0]);
    const insight = `Votre couverture ${weakest.label} est le point faible actuel : ${weakest.value}% des données évaluées. ${weakest.manquant > 0 ? `(${weakest.manquant} élément${weakest.manquant > 1 ? 's' : ''} à compléter)` : ''}`;

    return {
      global: globalScore,
      bia: biaScore,
      risques: risquesScore,
      strategies: strategiesScore,
      plans: plansScore,
      ressources: ressourcesScore,
      details: {
        bia: { total: biaResult.total, complet: biaResult.complet, manquant: biaResult.total - biaResult.complet },
        risques: { total: totalRisques, evalues: risquesComplets, manquant: totalRisques - risquesComplets },
        strategies: { totalCritiques, couverts: processusCritiquesAvecStrategie, manquant: totalCritiques - processusCritiquesAvecStrategie },
        plans: { totalCritiques, approuves: processusCritiquesAvecPlanApprouve, manquant: totalCritiques - processusCritiquesAvecPlanApprouve },
        ressources: { totalCritiques, complets: processusCritiquesAvecRessourcesCompletes, manquant: totalCritiques - processusCritiquesAvecRessourcesCompletes },
      },
      insight,
      weakestModule: weakest.label,
    };
  }, [processes, risques, associations, plans, resourceCounts]);

  // ============================================================
  // DASHBOARD COMPLET
  // ============================================================
  const dashboard = useMemo(() => {
    const totalProcessus = processes.length;
    const totalRessources = rh.length + equip.length + apps.length + fournisseurs.length;

    const processusAvecCriticite = processes.map((p) => {
      const score = computeMaxScore(p.impacts);
      const criticite = scoreToCriticality(score);
      return { ...p, score, criticite };
    });

    const processusCritiques = processusAvecCriticite.filter(
      (p) => p.criticite === "Critique" || p.criticite === "Sévère"
    ).length;

    const today = new Date();
    const echeances = events
      .filter((e) => new Date(e.start_date) >= today)
      .map((e) => ({
        date: new Date(e.start_date),
        type: e.title?.split(" ")[0] || "Événement",
        titre: e.title || "Sans titre",
        lieu: e.location || "Non spécifié",
        participants: e.participants || [],
        id: e.id,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 5);

    const matrixData: Record<string, number> = {};
    risques.forEach((r) => {
      const proba = r.probabilite || r.probability || 1;
      const impact = r.impact_global || r.impact || 1;
      const key = `${proba}-${impact}`;
      matrixData[key] = (matrixData[key] || 0) + 1;
    });
    const hasRisks = Object.keys(matrixData).length > 0;

    const monthlyHeatmap = Array(12).fill(0);
    events.forEach((e) => {
      if (e.start_date) {
        const month = new Date(e.start_date).getMonth();
        monthlyHeatmap[month]++;
      }
    });

    const dirMap: Record<string, Record<string, number>> = {};
    const roots = entities.filter((e) => e.parentId === null);
    for (const root of roots) {
      const descendantIds = getAllDescendantIds(entities, root.id);
      const rootProcesses = processes.filter(
        (p) => p.entityId === root.id || descendantIds.includes(p.entityId)
      );
      if (rootProcesses.length === 0) continue;
      dirMap[root.name] = {
        Mineur: 0,
        Modéré: 0,
        Majeur: 0,
        Sévère: 0,
        Critique: 0,
      };
      for (const p of rootProcesses) {
        const crit = scoreToCriticality(computeMaxScore(p.impacts));
        if (dirMap[root.name][crit] !== undefined) {
          dirMap[root.name][crit]++;
        }
      }
    }
    const directionData = Object.entries(dirMap)
      .map(([name, values]) => ({
        name,
        ...values,
        total: Object.values(values).reduce((a, b) => a + b, 0),
      }))
      .filter((d) => d.total > 0);

    const directionsList = entities.filter((e) => e.parentId === null);
    const totalDirections = directionsList.length;

    return {
      kpis: {
        totalProcessus,
        totalRisques: risques.length,
        totalStrategies: strategies.length,
        totalPlans: plans.length,
        totalRessources,
        totalDirections,
        processusCritiques,
        risquesCritiques: risques.filter((r) => {
          const score = (r.probabilite || 1) * (r.impact_global || 1);
          return score >= 12;
        }).length,
      },
      maturite,
      insight: maturite.insight,
      echeances,
      matrixData,
      hasRisks,
      monthlyHeatmap,
      directionData,
      alertes: {
        sansStrategie: processusAvecCriticite.filter(
          (p) =>
            (p.criticite === "Critique" || p.criticite === "Sévère") &&
            !associations.some((a) => a.processus_id === p.id)
        ).length,
        sansRessources: processusAvecCriticite.filter(
          (p) =>
            (p.criticite === "Critique" || p.criticite === "Sévère") &&
            (!p.resources || p.resources.length === 0)
        ).length,
      },
      ressources: [
        {
          label: "Collaborateurs",
          count: rh.length,
          icon: Users,
          color: "#3B82F6",
          bg: "bg-blue-50",
        },
        {
          label: "Équipements",
          count: equip.length,
          icon: Monitor,
          color: "#F59E0B",
          bg: "bg-amber-50",
        },
        {
          label: "Applications IT",
          count: apps.length,
          icon: Boxes,
          color: "#8B5CF6",
          bg: "bg-violet-50",
        },
        {
          label: "Prestataires",
          count: fournisseurs.length,
          icon: Handshake,
          color: "#F97316",
          bg: "bg-orange-50",
        },
      ],
      strategies,
      associations,
      events,
      plans,
      risques,
    };
  }, [
    processes,
    entities,
    events,
    strategies,
    associations,
    rh,
    equip,
    apps,
    fournisseurs,
    plans,
    risques,
    maturite,
  ]);

  return { loading, error: null, dashboard, refresh: () => {} };
};

// ============================================================
// COMPOSANTS UI
// ============================================================

// 1. BANDEAU MATURITÉ AVEC TOOLTIP
const BandeauMaturite = ({ data, insight }: { data: any; insight: string }) => {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const progress = (data.global / 100) * circumference;

  const getScoreColor = (score: number) => {
    if (score < 40) return "#C62828";
    if (score < 70) return "#E89B2D";
    return "#639922";
  };

  const getScoreLabel = (score: number) => {
    if (score < 40) return "Débutant";
    if (score < 70) return "Intermédiaire";
    return "Avancé";
  };

  return (
    <div className="w-full bg-[#172030] rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-8">
      <div className="flex items-center gap-6 flex-shrink-0">
        <div className="relative h-32 w-32">
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="10"
            />
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={getScoreColor(data.global)}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - progress}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold text-white font-serif">
              {data.global}
            </span>
            <span className="text-[10px] text-white/50 uppercase tracking-wider mt-1">
              / 100
            </span>
          </div>
        </div>
        <div className="flex flex-col justify-center">
          <p className="text-sm font-semibold text-white flex items-center gap-2">
            <Gauge className="h-4 w-4 text-[#639922]" /> Maturité BCM globale
          </p>
          <p className={`text-sm font-medium ${getScoreColor(data.global)}`}>
            Niveau {getScoreLabel(data.global)}
          </p>
          <p className="text-xs text-white/60 mt-1 max-w-[220px]">{insight}</p>
          <div className="flex items-center gap-1.5 mt-2">
            <TrendingUp className="h-3 w-3 text-[#639922]" />
            <span className="text-xs font-medium text-[#639922]">Calculé en temps réel</span>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-4 border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-8">
        {[
          { label: "BIA", value: data.bia, color: "#639922", detail: data.details?.bia, manquant: data.details?.bia?.manquant, total: data.details?.bia?.total },
          { label: "Risques", value: data.risques, color: "#4A7A6A", detail: data.details?.risques, manquant: data.details?.risques?.manquant, total: data.details?.risques?.total },
          { label: "Stratégies", value: data.strategies, color: "#6A9A8A", detail: data.details?.strategies, manquant: data.details?.strategies?.manquant, total: data.details?.strategies?.totalCritiques },
          { label: "Plans", value: data.plans, color: "#8A9A9A", detail: data.details?.plans, manquant: data.details?.plans?.manquant, total: data.details?.plans?.totalCritiques },
          { label: "Ressources", value: data.ressources, color: "#A5B8B0", detail: data.details?.ressources, manquant: data.details?.ressources?.manquant, total: data.details?.ressources?.totalCritiques },
        ].map((item) => {
          const detailText = item.manquant > 0 
            ? `${item.manquant} élément${item.manquant > 1 ? 's' : ''} manquant${item.manquant > 1 ? 's' : ''} sur ${item.total}`
            : "Complet ✅";
          return (
            <div key={item.label} className="flex flex-col gap-1 group relative">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-white/60">{item.label}</span>
                <span className="text-sm font-bold text-white">{item.value}%</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${item.value}%`, backgroundColor: item.color }} />
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-8 left-0 bg-[#172030] border border-white/10 text-[8px] text-white/80 px-2 py-1 rounded whitespace-nowrap z-10 shadow-lg pointer-events-none">
                {detailText}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// 2. KPI CARD
const KpiCard = ({ label, value, icon: Icon, color, bg, subtitle }: any) => (
  <Card className="border border-[#E8E4DC] shadow-sm bg-white hover:shadow-md transition-all duration-200">
    <CardContent className="p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-bold text-[#172030] mt-1 font-serif">{value}</p>
          {subtitle && <p className="text-[10px] text-[#172030]/40 mt-0.5">{subtitle}</p>}
        </div>
        <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0")} style={{ backgroundColor: bg }}>
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
      </div>
    </CardContent>
  </Card>
);

// 3. ALERTES
const AlertesBloc = ({ alertes }: { alertes: any }) => {
  const alertesList = [];

  if (alertes.sansStrategie > 0) {
    alertesList.push({
      titre: `${alertes.sansStrategie} processus critiques sans stratégie`,
      description: "Ces processus peuvent générer des interruptions majeures sans plan de continuité adapté.",
      couleur: "#C62828",
      bg: "#FFEBEE",
      icone: AlertOctagon,
    });
  }

  if (alertes.sansRessources > 0) {
    alertesList.push({
      titre: `${alertes.sansRessources} processus critiques sans ressources allouées`,
      description: "Les ressources critiques doivent être identifiées pour assurer la continuité.",
      couleur: "#D84315",
      bg: "#FBE9E7",
      icone: AlertTriangle,
    });
  }

  if (alertesList.length === 0) {
    return (
      <Card className="border border-[#E8E4DC] shadow-sm bg-white">
        <CardContent className="p-6 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-medium text-[#172030]">Excellent ! Aucune alerte active.</p>
          <p className="text-xs text-[#172030]/50 mt-1">Votre organisation est bien préparée.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-[#E8E4DC] shadow-sm bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[#172030] flex items-center gap-2 font-serif">
          <Bell className="h-4 w-4 text-[#C62828]" /> Alertes & Actions immédiates
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {alertesList.map((item, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-[#E8E4DC]">
            <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center border border-[#E8E4DC]")} style={{ backgroundColor: item.bg }}>
              <item.icone className="h-4 w-4" style={{ color: item.couleur }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#172030]">{item.titre}</p>
              <p className="text-xs text-[#172030]/60 mt-0.5">{item.description}</p>
            </div>
            <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 text-[#2A5141] flex-shrink-0">
              <ArrowRight className="h-3 w-3" /> Voir
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

// 4. ÉCHÉANCES
const EcheancesOriginales = ({ events }: { events: any[] }) => {
  const today = new Date();

  const upcomingEvents = events
    .filter((e) => new Date(e.start_date) >= today)
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
    .slice(0, 5);

  const getEventStyle = (title: string) => {
    const t = title?.toLowerCase() || "";
    if (t.includes("test")) return { bg: "#FFEBEE", text: "#C62828", icon: Flame, label: "TEST" };
    if (t.includes("exercice")) return { bg: "#E8F5E9", text: "#2E7D32", icon: Shield, label: "EXERCICE" };
    if (t.includes("comité") || t.includes("comite")) return { bg: "#FFF8E1", text: "#F57F17", icon: Users, label: "COMITÉ" };
    return { bg: "#EAF2EE", text: "#2A5141", icon: Calendar, label: "ÉVÉNEMENT" };
  };

  const getMonthLabel = (date: Date) => date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  return (
    <Card className="border border-[#E8E4DC] shadow-sm bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[#172030] flex items-center gap-2 font-serif">
          <Calendar className="h-4 w-4 text-[#2A5141]" /> Prochaines échéances
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {upcomingEvents.length === 0 ? (
          <div className="text-center py-8 text-sm text-[#172030]/40">
            <Calendar className="h-10 w-10 mx-auto text-[#172030]/20 mb-2" />
            <p>Aucune échéance à venir</p>
            <p className="text-xs text-[#172030]/30 mt-1">Ajoutez des événements dans le module Calendrier annuel PCA</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingEvents.map((e) => {
              const eventDate = new Date(e.start_date);
              const style = getEventStyle(e.title);
              const Icon = style.icon;
              const daysLeft = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              const isUrgent = daysLeft <= 30;
              const isSoon = daysLeft <= 90;

              return (
                <div key={e.id} className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-colors hover:shadow-sm",
                  isUrgent ? "border-[#F5A8B5] bg-[#FFF5F5]" : isSoon ? "border-[#FFCC80] bg-[#FFF8F3]" : "border-[#E8E4DC] bg-[#FAFAF9]"
                )}>
                  <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center")} style={{ backgroundColor: style.bg }}>
                    <Icon className="h-5 w-5" style={{ color: style.text }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#172030] truncate">{e.title || "Sans titre"}</span>
                      <Badge className={cn("text-[8px] px-1.5 py-0.5 rounded-full shrink-0")} style={{ backgroundColor: style.bg, color: style.text }}>
                        {style.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-[#172030]/50 flex items-center gap-2 mt-0.5">
                      <Clock className="h-3 w-3" />
                      {eventDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                      {e.lieu && e.lieu !== "Non spécifié" && (<><span className="text-[#172030]/30">•</span><MapPin className="h-3 w-3" />{e.lieu}</>)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end flex-shrink-0">
                    <span className={cn("text-xs font-bold", isUrgent ? "text-[#C62828]" : isSoon ? "text-[#E65100]" : "text-[#2A5141]")}>
                      {daysLeft === 0 ? "Aujourd'hui" : `Dans ${daysLeft} j`}
                    </span>
                    <span className="text-[9px] text-[#172030]/40">{getMonthLabel(eventDate)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// 5. MATRICE DES RISQUES AVEC TOOLTIP VOLANT
const RiskMatrix = ({
  matrixData,
  hasRisks,
  risques,
}: {
  matrixData: Record<string, number>;
  hasRisks: boolean;
  risques?: any[];
}) => {
  const [hoveredCell, setHoveredCell] = useState<{ p: number; i: number } | null>(null);
  const [tooltipData, setTooltipData] = useState<{ p: number; i: number; count: number; risques: any[] } | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const hasData = Object.values(matrixData).some((v) => v > 0);

  const getRisksInCell = (p: number, i: number) => {
    if (!risques) return [];
    return risques.filter((r) => {
      const proba = r.probabilite || r.probability || 1;
      const impact = r.impact_global || r.impact || 1;
      return proba === p && impact === i;
    });
  };

  const handleMouseEnter = (p: number, i: number, e: React.MouseEvent) => {
    const count = matrixData[`${p}-${i}`] || 0;
    const risksInCell = getRisksInCell(p, i);
    if (count > 0) {
      setHoveredCell({ p, i });
      setTooltipData({ p, i, count, risques: risksInCell });
      setTooltipPosition({ x: e.clientX + 15, y: e.clientY - 10 });
    }
  };

  const handleMouseLeave = () => {
    setHoveredCell(null);
    setTooltipData(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (tooltipData) {
      setTooltipPosition({ x: e.clientX + 15, y: e.clientY - 10 });
    }
  };

  return (
    <Card className="border border-[#E8E4DC] shadow-sm bg-white">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold text-[#172030] flex items-center gap-2">
          <Flame className="h-4 w-4 text-[#ef4444]" /> Matrice des risques
        </CardTitle>
        {!hasData && (
          <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded-lg mt-1">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>Aucun risque enregistré dans la base de données</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="grid grid-cols-6 gap-1.5 mb-1.5">
          <div className="text-[9px] text-[#172030]/40 font-medium flex items-end justify-center pb-1">IMPACT</div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="text-center text-[10px] text-[#172030]/50 font-semibold">{i}</div>
          ))}
        </div>
        {[5, 4, 3, 2, 1].map((p) => (
          <div key={p} className="grid grid-cols-6 gap-1.5 mb-1.5">
            <div className="flex items-center justify-center text-[10px] text-[#172030]/50 font-semibold">{p}</div>
            {[1, 2, 3, 4, 5].map((i) => {
              const count = matrixData[`${p}-${i}`] || 0;
              const score = p * i;
              const style = getMatrixStyle(score);
              const isHovered = hoveredCell?.p === p && hoveredCell?.i === i;

              return (
                <div
                  key={i}
                  className={cn(
                    "relative rounded-md border h-10 flex items-center justify-center transition-all duration-200",
                    count > 0 ? "cursor-pointer hover:scale-105 hover:shadow-md" : "opacity-60"
                  )}
                  style={{
                    backgroundColor: isHovered ? style.bg : style.bg,
                    borderColor: isHovered ? style.dot : style.border,
                    borderWidth: isHovered ? "2px" : "1px",
                  }}
                  onMouseEnter={(e) => count > 0 && handleMouseEnter(p, i, e)}
                  onMouseLeave={handleMouseLeave}
                  onMouseMove={count > 0 ? handleMouseMove : undefined}
                >
                  <div
                    className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full transition-all duration-200"
                    style={{
                      backgroundColor: style.dot,
                      opacity: count > 0 ? 1 : 0.4,
                      transform: isHovered ? "scale(1.5)" : "scale(1)",
                    }}
                  />
                  {count > 0 && (
                    <span className="text-[13px] font-bold" style={{ color: style.text }}>
                      {count}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* TOOLTIP VOLANT - Épuré */}
        {tooltipData && (
          <div
            className="fixed z-50 pointer-events-none transition-opacity duration-200"
            style={{
              left: tooltipPosition.x,
              top: tooltipPosition.y,
              opacity: tooltipData ? 1 : 0,
            }}
          >
            <div className="bg-white rounded-xl shadow-xl border border-[#E8E4DC] p-4 min-w-[220px] max-w-[300px]">
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-[#E8E4DC]">
                <span className="text-xs font-medium text-[#172030]/60">
                  P {tooltipData.p} × I {tooltipData.i}
                </span>
                <Badge className="text-[9px] bg-[#2A5141] text-white">
                  {tooltipData.count} risque{tooltipData.count > 1 ? 's' : ''}
                </Badge>
              </div>
              <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
                {tooltipData.risques.slice(0, 4).map((risk, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-[#172030] truncate max-w-[150px]">{risk.title}</span>
                    <span className="text-[10px] font-mono text-[#172030]/40 flex-shrink-0 ml-2">
                      {(risk.probabilite || 1) * (risk.impact_global || 1)}/25
                    </span>
                  </div>
                ))}
                {tooltipData.risques.length > 4 && (
                  <div className="text-[10px] text-[#172030]/30 text-center pt-1 border-t border-[#E8E4DC]">
                    +{tooltipData.risques.length - 4} autre{tooltipData.risques.length - 4 > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3 mt-3 pt-3 border-t border-[#E8E4DC]">
          {[
            { label: "Faible", style: MATRIX_STYLES.low },
            { label: "Modéré", style: MATRIX_STYLES.moderate },
            { label: "Élevé", style: MATRIX_STYLES.high },
            { label: "Critique", style: MATRIX_STYLES.critical },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.style.dot }} />
              <span className="text-[9px] text-[#172030]/60 font-medium">{item.label}</span>
            </div>
          ))}
        </div>
        {hasData && (
          <p className="text-[9px] text-[#172030]/30 text-center mt-2">
            {Object.values(matrixData).reduce((a, b) => a + b, 0)} risques analysés
          </p>
        )}
      </CardContent>
    </Card>
  );
};

// 6. TOP PROCESSUS CRITIQUES
const TopProcessusCritiques = ({ processes, entities }: { processes: any[]; entities: any[] }) => {
  const topProcesses = useMemo(() => {
    return processes
      .map((p) => {
        const score = computeMaxScore(p.impacts);
        const criticality = scoreToCriticality(score);
        const entity = entities.find((e) => e.id === p.entityId);
        return { ...p, score, criticality, entityName: entity?.name || "Sans direction", rto: p.rto || 0 };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [processes, entities]);

  const levelBadgeClass = (level: string) => {
    const classes = {
      Critique: "bg-[#FFEBEE] text-[#C62828] border-[#EF9A9A]",
      Sévère: "bg-[#FBE9E7] text-[#D84315] border-[#FFAB91]",
      Majeur: "bg-[#FFF3E0] text-[#E65100] border-[#FFCC80]",
      Modéré: "bg-[#FFF8E1] text-[#F57F17] border-[#FFE082]",
      Mineur: "bg-[#E8F5E9] text-[#2E7D32] border-[#A5D6A7]",
    };
    return classes[level as keyof typeof classes] || "bg-gray-100 text-gray-700 border-gray-200";
  };

  return (
    <Card className="border border-[#E8E4DC] shadow-sm bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[#172030] flex items-center gap-2 font-serif">
          <Target className="h-4 w-4 text-[#172030]/40" /> Top processus critiques
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="grid grid-cols-4 gap-2 py-1.5 border-b border-[#E8E4DC]">
          <span className="text-[9px] font-medium text-[#172030]/40 uppercase tracking-wider col-span-2">Processus</span>
          <span className="text-[9px] font-medium text-[#172030]/40 uppercase tracking-wider">RTO</span>
          <span className="text-[9px] font-medium text-[#172030]/40 uppercase tracking-wider text-center">Criticité</span>
        </div>
        <div className="divide-y divide-[#E8E4DC]/50">
          {topProcesses.length > 0 ? (
            topProcesses.map((p, index) => (
              <div key={index} className="grid grid-cols-4 gap-2 py-2.5 items-center">
                <span className="text-sm font-medium text-[#172030] truncate col-span-2">{p.name}</span>
                <span className="text-xs text-[#172030]/60 text-center font-mono">{p.rto || 0}h</span>
                <Badge className={cn("text-[9px] px-2 py-0.5 h-5 border text-center justify-center", levelBadgeClass(p.criticality))}>
                  {p.criticality}
                </Badge>
              </div>
            ))
          ) : (
            <div className="py-6 text-center text-sm text-[#172030]/30">Aucun processus trouvé</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// 7. RÉPARTITION PAR DIRECTION
const DirectionDistribution = ({ processes, entities }: { processes: any[]; entities: any[] }) => {
  const directionData = useMemo(() => {
    const dirMap: Record<string, Record<string, number>> = {};
    const roots = entities.filter((e) => e.parentId === null);
    for (const root of roots) {
      const descendantIds = getAllDescendantIds(entities, root.id);
      const rootProcesses = processes.filter((p) => p.entityId === root.id || descendantIds.includes(p.entityId));
      if (rootProcesses.length === 0) continue;
      dirMap[root.name] = { Mineur: 0, Modéré: 0, Majeur: 0, Sévère: 0, Critique: 0 };
      for (const p of rootProcesses) {
        const crit = scoreToCriticality(computeMaxScore(p.impacts));
        if (dirMap[root.name][crit] !== undefined) dirMap[root.name][crit]++;
      }
    }
    return Object.entries(dirMap).map(([name, values]) => ({
      name, ...values, total: Object.values(values).reduce((a, b) => a + b, 0)
    })).filter((d) => d.total > 0);
  }, [processes, entities]);

  if (directionData.length === 0) {
    return (
      <Card className="border border-[#E8E4DC] shadow-sm bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[#172030] flex items-center gap-2 font-serif">
            <Building2 className="h-4 w-4 text-[#172030]/40" /> Répartition par direction
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <p className="text-sm text-[#172030]/40">Aucune direction renseignée</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-[#E8E4DC] shadow-sm bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[#172030] flex items-center gap-2 font-serif">
          <Building2 className="h-4 w-4 text-[#172030]/40" /> Répartition par direction
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={directionData} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "#172030/60" }} width={90} />
              <Tooltip contentStyle={{ backgroundColor: "white", border: "1px solid #E8E4DC", borderRadius: "6px", fontSize: "11px" }} />
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
      </CardContent>
    </Card>
  );
};

// 8. RESSOURCES
const RessourcesBloc = ({ ressources, total }: { ressources: any[]; total: number }) => (
  <Card className="border border-[#E8E4DC] shadow-sm bg-white">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-semibold text-[#172030] flex items-center gap-2 font-serif">
        <Link className="h-4 w-4 text-[#2A5141]" /> Ressources
      </CardTitle>
    </CardHeader>
    <CardContent className="p-4 pt-0">
      <div className="space-y-2">
        {ressources.map((res, i) => {
          const Icon = res.icon;
          return (
            <div key={i} className={cn("flex items-center justify-between p-2.5 rounded-lg border transition-all hover:shadow-sm", res.bg, "border-[#E8E4DC]")}>
              <div className="flex items-center gap-3">
                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", res.bg)}>
                  <Icon className="h-4 w-4" style={{ color: res.color }} />
                </div>
                <span className="text-sm font-medium text-[#172030]">{res.label}</span>
              </div>
              <span className="text-lg font-bold text-[#172030] font-serif">{res.count}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between pt-3 mt-2 border-t border-[#E8E4DC]">
        <span className="text-sm font-semibold text-[#172030]">Total ressources</span>
        <span className="text-xl font-bold text-[#2A5141] font-serif">{total}</span>
      </div>
    </CardContent>
  </Card>
);

// 9. STRATÉGIES
const StrategiesBloc = ({ strategies, processus, associations }: { strategies: any[]; processus: any[]; associations: any[] }) => {
  const totalStrat = strategies?.length || 0;
  const processusCouverts = processus?.filter((p) => associations?.some((a) => a.processus_id === p.id)).length || 0;
  const sansStrategie = (processus?.length || 0) - processusCouverts;

  return (
    <Card className="border border-[#E8E4DC] shadow-sm bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[#172030] flex items-center gap-2 font-serif">
          <GitBranch className="h-4 w-4 text-[#2A5141]" /> Stratégies
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="space-y-2">
          <div className="flex items-center justify-between p-2 rounded-lg bg-[#FAFAF9] hover:bg-[#F0F7F4] transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-[#E8F5E9] flex items-center justify-center"><FileText className="h-4 w-4 text-[#2E7D32]" /></div>
              <span className="text-sm text-[#172030] font-medium">Stratégies définies</span>
            </div>
            <span className="text-lg font-bold text-[#172030] font-serif">{totalStrat}</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-[#FAFAF9] hover:bg-[#F0F7F4] transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-[#FFF8E1] flex items-center justify-center"><Target className="h-4 w-4 text-[#F57F17]" /></div>
              <span className="text-sm text-[#172030] font-medium">Processus couverts</span>
            </div>
            <span className="text-lg font-bold text-[#172030] font-serif">{processusCouverts}</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-[#FAFAF9] hover:bg-[#F0F7F4] transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-[#FFEBEE] flex items-center justify-center"><AlertTriangle className="h-4 w-4 text-[#C62828]" /></div>
              <span className="text-sm text-[#172030] font-medium">Processus sans stratégie</span>
            </div>
            <span className="text-lg font-bold text-[#172030] font-serif">{sansStrategie}</span>
          </div>
        </div>
        <div className="flex items-center justify-between pt-3 mt-2 border-t border-[#E8E4DC]">
          <span className="text-sm font-semibold text-[#172030]">Total couverture</span>
          <span className="text-xl font-bold text-[#2A5141] font-serif">{processus?.length > 0 ? Math.round((processusCouverts / processus.length) * 100) : 0}%</span>
        </div>
      </CardContent>
    </Card>
  );
};

// 10. HEATMAP MENSUEL AVEC TOOLTIP VOLANT
const MonthlyHeatmap = ({ events }: { events: any[] }) => {
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const monthlyHeatmap = useMemo(() => {
    const months = Array(12).fill(0);
    events.forEach((e) => {
      if (e.start_date) {
        const month = new Date(e.start_date).getMonth();
        months[month]++;
      }
    });
    return months;
  }, [events]);

  const getMonthEvents = (monthIndex: number) => {
    return events
      .filter((e) => new Date(e.start_date).getMonth() === monthIndex)
      .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
  };

  const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  const monthFullNames = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];

  const getEventTypeColor = (title: string) => {
    const t = title?.toLowerCase() || "";
    if (t.includes("test")) return "bg-rose-100 text-rose-700 border-rose-200";
    if (t.includes("exercice")) return "bg-emerald-100 text-emerald-700 border-emerald-200";
    if (t.includes("comité") || t.includes("comite")) return "bg-amber-100 text-amber-700 border-amber-200";
    if (t.includes("audit")) return "bg-purple-100 text-purple-700 border-purple-200";
    return "bg-blue-100 text-blue-700 border-blue-200";
  };

  const handleMouseEnter = (index: number, e: React.MouseEvent) => {
    const count = monthlyHeatmap[index];
    if (count > 0) {
      setHoveredMonth(index);
      setTooltipPosition({ x: e.clientX + 15, y: e.clientY - 10 });
    }
  };

  const handleMouseLeave = () => {
    setHoveredMonth(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (hoveredMonth !== null) {
      setTooltipPosition({ x: e.clientX + 15, y: e.clientY - 10 });
    }
  };

  return (
    <Card className="border border-[#E8E4DC] shadow-sm bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[#172030] flex items-center gap-2 font-serif">
          <Calendar className="h-4 w-4 text-[#2A5141]" /> Activité annuelle
        </CardTitle>
        <p className="text-xs text-[#172030]/40">
          {events.length} événement{events.length > 1 ? "s" : ""} planifié{events.length > 1 ? "s" : ""}
        </p>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-12 gap-1">
          {monthlyHeatmap.map((count, i) => {
            const intensity = count > 0 ? Math.min(count / 5, 1) : 0.1;
            const hasEvents = count > 0;

            return (
              <div
                key={i}
                className="text-center relative"
                onMouseEnter={(e) => hasEvents && handleMouseEnter(i, e)}
                onMouseLeave={handleMouseLeave}
                onMouseMove={hasEvents ? handleMouseMove : undefined}
              >
                <div
                  className={cn(
                    "h-8 rounded-md flex items-center justify-center text-[9px] font-medium transition-all duration-200 cursor-default",
                    hasEvents && "cursor-pointer hover:scale-105 hover:shadow-md"
                  )}
                  style={{
                    backgroundColor: hasEvents
                      ? `rgba(42, 81, 65, ${intensity * 0.8 + 0.2})`
                      : "rgba(232, 228, 220, 0.3)",
                    color: hasEvents && count > 2 ? "white" : count > 0 ? "#172030" : "#172030/20",
                  }}
                >
                  {count > 0 ? count : ""}
                </div>
                <span className="text-[8px] text-[#172030]/40 mt-0.5 block">
                  {monthNames[i]}
                </span>
              </div>
            );
          })}
        </div>

        {/* TOOLTIP VOLANT - Heatmap */}
        {hoveredMonth !== null && monthlyHeatmap[hoveredMonth] > 0 && (
          <div
            className="fixed z-50 pointer-events-none transition-opacity duration-200"
            style={{
              left: tooltipPosition.x,
              top: tooltipPosition.y,
              opacity: 1,
            }}
          >
            <div className="bg-white rounded-xl shadow-xl border border-[#E8E4DC] p-4 min-w-[200px] max-w-[320px]">
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-[#E8E4DC]">
                <span className="text-xs font-semibold text-[#172030]">
                  {monthFullNames[hoveredMonth]}
                </span>
                <Badge className="text-[9px] bg-[#2A5141] text-white">
                  {monthlyHeatmap[hoveredMonth]} événement{monthlyHeatmap[hoveredMonth] > 1 ? "s" : ""}
                </Badge>
              </div>
              <div className="space-y-2 max-h-[150px] overflow-y-auto">
                {getMonthEvents(hoveredMonth).slice(0, 4).map((e, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <span className={cn(
                      "text-[8px] px-1.5 py-0.5 rounded border font-medium flex-shrink-0",
                      getEventTypeColor(e.title)
                    )}>
                      {e.title?.split(" ")[0] || "Évt"}
                    </span>
                    <span className="text-[#172030] truncate flex-1">{e.title}</span>
                    <span className="text-[10px] text-[#172030]/30 font-mono flex-shrink-0">
                      {new Date(e.start_date).toLocaleDateString("fr", { day: "2-digit", month: "2-digit" })}
                    </span>
                  </div>
                ))}
                {getMonthEvents(hoveredMonth).length > 4 && (
                  <div className="text-[10px] text-[#172030]/30 text-center pt-1 border-t border-[#E8E4DC]">
                    +{getMonthEvents(hoveredMonth).length - 4} autre{getMonthEvents(hoveredMonth).length - 4 > 1 ? "s" : ""}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-center gap-4 mt-3 pt-2 border-t border-[#E8E4DC]">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#2A5141] opacity-80" />
            <span className="text-[9px] text-[#172030]/40">Activité</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#E8E4DC] opacity-40" />
            <span className="text-[9px] text-[#172030]/30">Inactif</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ============================================================
// COMPOSANT PRINCIPAL - Dashboard
// ============================================================
export const Dashboard = () => {
  const { loading, error, dashboard, refresh } = useBCMDashboard();
  const { processes } = useBia();
  const { entities } = useGovernance();

  if (loading) {
    return (
      <div className="h-full bg-[#F8F6F2] p-6 space-y-6">
        <Skeleton className="h-32 w-full bg-[#E8E4DC]/50" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full bg-[#E8E4DC]/50" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full bg-[#F8F6F2] p-6 flex items-center justify-center">
        <Card className="border-[#E8E4DC] p-8 text-center max-w-md">
          <AlertTriangle className="h-12 w-12 text-[#ef4444] mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[#172030] font-serif">Erreur de chargement</h2>
          <p className="text-sm text-[#172030]/60 mt-2">{error}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#F8F6F2] p-6 space-y-6 overflow-y-auto">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#172030] font-serif">Tableau de bord BCM</h1>
          <p className="text-sm text-[#172030]/60 mt-1">Vue consolidée de la résilience de votre organisation</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 text-xs text-[#172030]/40">
            <Calendar className="h-4 w-4" />
            {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </span>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 border-[#E8E4DC] hover:bg-white" onClick={refresh}>
            <RefreshCw className="h-3.5 w-3.5" /> Actualiser
          </Button>
          <Button size="sm" className="h-8 gap-1.5 bg-[#2A5141] hover:bg-[#1a3329] text-white">
            <FileText className="h-3.5 w-3.5" /> Exporter
          </Button>
        </div>
      </div>

      {/* 2. Bandeau de maturité avec tooltip */}
      <BandeauMaturite data={dashboard.maturite} insight={dashboard.insight} />

      {/* 3. VRAIS KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard label="Processus critiques" value={dashboard.kpis.processusCritiques} icon={Shield} color="#2A5141" bg="bg-[#F0F7F4]" subtitle={`sur ${dashboard.kpis.totalProcessus} processus`} />
        <KpiCard label="Risques" value={dashboard.kpis.totalRisques} icon={Flame} color="#C62828" bg="bg-[#FDE8E8]" subtitle={`${dashboard.kpis.risquesCritiques} critiques`} />
        <KpiCard label="Stratégies définies" value={dashboard.kpis.totalStrategies} icon={GitBranch} color="#E89B2D" bg="bg-[#FFF8E1]" subtitle={`${dashboard.maturite.strategies}% des critiques couverts`} />
        <KpiCard label="Plans de continuité" value={dashboard.kpis.totalPlans} icon={FileText} color="#172030" bg="bg-[#F4F5F7]" subtitle={`${dashboard.maturite.plans}% des critiques couverts`} />
        <KpiCard label="Ressources recensées" value={dashboard.kpis.totalRessources} icon={Database} color="#2A5141" bg="bg-[#F0F7F4]" subtitle={`${dashboard.maturite.ressources}% des critiques`} />
        <KpiCard label="Directions" value={dashboard.kpis.totalDirections} icon={Building2} color="#E89B2D" bg="bg-[#FFF8E1]" />
      </div>

      {/* 4. ALERTES */}
      <AlertesBloc alertes={dashboard.alertes} />

      {/* 5. ÉCHÉANCES + MATRICE AVEC TOOLTIP VOLANT */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EcheancesOriginales events={dashboard.events} />
        <RiskMatrix matrixData={dashboard.matrixData} hasRisks={dashboard.hasRisks} risques={dashboard.risques} />
      </div>

      {/* 6. HEATMAP MENSUEL AVEC TOOLTIP VOLANT */}
      <MonthlyHeatmap events={dashboard.events} />

      {/* 7. TOP PROCESSUS + DIRECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopProcessusCritiques processes={processes} entities={entities} />
        <DirectionDistribution processes={processes} entities={entities} />
      </div>

      {/* 8. RESSOURCES & STRATÉGIES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RessourcesBloc ressources={dashboard.ressources} total={dashboard.kpis.totalRessources} />
        <StrategiesBloc strategies={dashboard.strategies} processus={processes} associations={dashboard.associations} />
      </div>
    </div>
  );
};