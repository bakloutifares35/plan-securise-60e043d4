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
  ChevronRight,
  CalendarClock,
  CalendarCheck,
  FileWarning,
  PlayCircle,
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
// FONCTIONS DE CALCUL BIA (intégrées, inchangées)
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
// HOOK CENTRALISÉ - AVEC CALCULS JUSTES (inchangé)
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
  const [exercices, setExercices] = useState<any[]>([]);
  const [exercicesTableExists, setExercicesTableExists] = useState<boolean>(false);
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

        // Tentative de chargement d'une table d'exercices PCA si elle existe.
        // On ne casse rien si elle n'existe pas encore.
        try {
          const exRes = await (supabase as any).from("exercices_pca").select("*");
          if (!exRes.error) {
            setExercices(exRes.data || []);
            setExercicesTableExists(true);
          } else {
            setExercicesTableExists(false);
          }
        } catch {
          setExercicesTableExists(false);
        }

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
  // CALCUL DE LA MATURITÉ BCM (inchangé)
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
      totalCritiques,
      processusCritiquesAvecStrategie,
      processusCritiquesAvecPlanApprouve,
      processusCritiquesAvecRessourcesCompletes,
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
  // FRAÎCHEUR DU PROGRAMME (dernier exercice, prochain test, plans obsolètes)
  // ============================================================
  const fraicheur = useMemo(() => {
    const today = new Date();

    // Plans obsolètes : révision dépassée depuis plus de 12 mois (basé sur derniere_revision
    // ou updated_at si le champ n'existe pas ; on reste défensif sur les noms de colonnes).
    const plansObsoletes = plans.filter((pl) => {
      const dateRef = pl.derniere_revision || pl.date_revision || pl.updated_at;
      if (!dateRef) return false;
      const diffDays = (today.getTime() - new Date(dateRef).getTime()) / (1000 * 60 * 60 * 24);
      return diffDays > 365;
    }).length;

    // Exercices : si la table existe, on calcule le dernier et le prochain.
    let dernierExercice: { date: Date; titre: string } | null = null;
    let prochainExercice: { date: Date; titre: string } | null = null;

    if (exercicesTableExists && exercices.length > 0) {
      const passes = exercices
        .filter((e) => e.date_exercice && new Date(e.date_exercice) <= today)
        .sort((a, b) => new Date(b.date_exercice).getTime() - new Date(a.date_exercice).getTime());
      const futurs = exercices
        .filter((e) => e.date_exercice && new Date(e.date_exercice) > today)
        .sort((a, b) => new Date(a.date_exercice).getTime() - new Date(b.date_exercice).getTime());

      if (passes.length > 0) {
        dernierExercice = { date: new Date(passes[0].date_exercice), titre: passes[0].titre || passes[0].nom || "Exercice PCA" };
      }
      if (futurs.length > 0) {
        prochainExercice = { date: new Date(futurs[0].date_exercice), titre: futurs[0].titre || futurs[0].nom || "Exercice PCA" };
      }
    } else {
      // Repli : on regarde les événements calendrier taggés "test" ou "exercice"
      const evExercices = events.filter((e) => {
        const t = (e.title || "").toLowerCase();
        return t.includes("test") || t.includes("exercice");
      });
      const passes = evExercices
        .filter((e) => e.start_date && new Date(e.start_date) <= today)
        .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
      const futurs = evExercices
        .filter((e) => e.start_date && new Date(e.start_date) > today)
        .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

      if (passes.length > 0) {
        dernierExercice = { date: new Date(passes[0].start_date), titre: passes[0].title || "Exercice" };
      }
      if (futurs.length > 0) {
        prochainExercice = { date: new Date(futurs[0].start_date), titre: futurs[0].title || "Exercice" };
      }
    }

    const joursDepuisDernierExercice = dernierExercice
      ? Math.floor((today.getTime() - dernierExercice.date.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const joursAvantProchainExercice = prochainExercice
      ? Math.ceil((prochainExercice.date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      dernierExercice,
      prochainExercice,
      joursDepuisDernierExercice,
      joursAvantProchainExercice,
      plansObsoletes,
      hasExerciceData: !!dernierExercice || !!prochainExercice,
    };
  }, [plans, exercices, exercicesTableExists, events]);

  // ============================================================
  // DASHBOARD COMPLET (inchangé, sauf ajout fraicheur + funnel data)
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

    // Données du funnel de couverture (Processus -> Critiques -> Stratégie -> Plan -> Testé)
    const funnel = {
      totalProcessus,
      totalCritiques: maturite.totalCritiques,
      avecStrategie: maturite.processusCritiquesAvecStrategie,
      avecPlan: maturite.processusCritiquesAvecPlanApprouve,
      testes: fraicheur.hasExerciceData ? maturite.processusCritiquesAvecPlanApprouve : 0,
      hasExerciceTracking: fraicheur.hasExerciceData,
    };

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
      funnel,
      fraicheur,
      alertes: {
        sansStrategie: processusAvecCriticite.filter(
          (p) =>
            (p.criticite === "Critique" || p.criticite === "Sévère") &&
            !associations.some((a) => a.processus_id === p.id)
        ).length,
        sansRessources: processusAvecCriticite.filter((p) => {
          if (!(p.criticite === "Critique" || p.criticite === "Sévère")) return false;
          const res = resourceCounts[p.id] || { hr: 0, equip: 0, app: 0, supplier: 0 };
          return res.hr === 0 && res.equip === 0 && res.app === 0 && res.supplier === 0;
        }).length,
        sansPlan: processusAvecCriticite.filter(
          (p) =>
            (p.criticite === "Critique" || p.criticite === "Sévère") &&
            !plans.some((pl) => pl.processus_id === p.id && pl.statut === "Approuvé")
        ).length,
        risquesSansTraitement: risques.filter((r) => !r.mesures_existantes || r.mesures_existantes.length === 0).length,
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
    fraicheur,
    resourceCounts,
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

  const badgeColor = getScoreColor(data.global);

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
              stroke={badgeColor}
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
            <Gauge className="h-4 w-4" style={{ color: badgeColor }} /> Maturité BCM globale
          </p>
          <span
            className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full mt-1.5 w-fit"
            style={{ backgroundColor: `${badgeColor}22`, color: badgeColor }}
          >
            Niveau {getScoreLabel(data.global)}
          </span>
          <p className="text-xs text-white/60 mt-2 max-w-[240px]">{insight}</p>
          <div className="flex items-center gap-1.5 mt-2">
            <TrendingUp className="h-3 w-3 text-[#639922]" />
            <span className="text-xs font-medium text-[#639922]">Calculé en temps réel</span>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-4 border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-8">
        {[
          { label: "BIA", value: data.bia, color: "#639922", manquant: data.details?.bia?.manquant, total: data.details?.bia?.total },
          { label: "Risques", value: data.risques, color: "#4A7A6A", manquant: data.details?.risques?.manquant, total: data.details?.risques?.total },
          { label: "Stratégies", value: data.strategies, color: "#6A9A8A", manquant: data.details?.strategies?.manquant, total: data.details?.strategies?.totalCritiques },
          { label: "Plans", value: data.plans, color: "#8A9A9A", manquant: data.details?.plans?.manquant, total: data.details?.plans?.totalCritiques },
          { label: "Ressources", value: data.ressources, color: "#A5B8B0", manquant: data.details?.ressources?.manquant, total: data.details?.ressources?.totalCritiques },
        ].map((item) => {
          const isComplete = item.value >= 100;
          const detailText = item.manquant > 0
            ? `${item.manquant} élément${item.manquant > 1 ? 's' : ''} manquant${item.manquant > 1 ? 's' : ''} sur ${item.total || 0}`
            : "Complet";
          return (
            <div key={item.label} className="flex flex-col gap-1 group relative">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-white/60 flex items-center gap-1">
                  {item.label}
                  {isComplete && <CheckCircle2 className="h-3 w-3 text-[#639922]" />}
                </span>
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

// 2. ACTIONS PRIORITAIRES (remplace l'ancien AlertesBloc, limité à 3, trié par sévérité)
const ActionsPrioritaires = ({ alertes }: { alertes: any }) => {
  type ActionItem = {
    titre: string;
    description: string;
    couleur: string;
    bg: string;
    icone: any;
    severite: number; // plus haut = plus urgent
  };

  const alertesList: ActionItem[] = [];

  if (alertes.sansStrategie > 0) {
    alertesList.push({
      titre: `${alertes.sansStrategie} processus critique${alertes.sansStrategie > 1 ? 's' : ''} sans stratégie`,
      description: "Ces processus peuvent générer des interruptions majeures sans plan de continuité adapté.",
      couleur: "#C62828",
      bg: "#FFEBEE",
      icone: AlertOctagon,
      severite: 4,
    });
  }

  if (alertes.sansPlan > 0) {
    alertesList.push({
      titre: `${alertes.sansPlan} processus critique${alertes.sansPlan > 1 ? 's' : ''} sans plan approuvé`,
      description: "Un plan de continuité approuvé est indispensable pour garantir la reprise d'activité.",
      couleur: "#D84315",
      bg: "#FBE9E7",
      icone: FileWarning,
      severite: 3,
    });
  }

  if (alertes.risquesSansTraitement > 0) {
    alertesList.push({
      titre: `${alertes.risquesSansTraitement} risque${alertes.risquesSansTraitement > 1 ? 's' : ''} sans mesure de traitement`,
      description: "Ces risques ne sont pas encore couverts par une mesure de mitigation documentée.",
      couleur: "#B26A00",
      bg: "#FFF8E1",
      icone: Flame,
      severite: 2,
    });
  }

  if (alertes.sansRessources > 0) {
    alertesList.push({
      titre: `${alertes.sansRessources} processus critique${alertes.sansRessources > 1 ? 's' : ''} sans ressources allouées`,
      description: "Les ressources critiques doivent être identifiées pour assurer la continuité.",
      couleur: "#E65100",
      bg: "#FFF3E0",
      icone: AlertTriangle,
      severite: 1,
    });
  }

  const top3 = alertesList.sort((a, b) => b.severite - a.severite).slice(0, 3);

  if (top3.length === 0) {
    return (
      <Card className="border border-[#E8E4DC] shadow-sm bg-white">
        <CardContent className="p-6 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-medium text-[#172030]">Excellent ! Aucune action urgente.</p>
          <p className="text-xs text-[#172030]/50 mt-1">Votre organisation est bien préparée.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-[#E8E4DC] shadow-sm bg-white">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-[#172030] flex items-center gap-2 font-serif">
            <Bell className="h-4 w-4 text-[#C62828]" /> Actions prioritaires
          </CardTitle>
          <span className="text-[10px] text-[#172030]/40">Les {top3.length} plus urgentes</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {top3.map((item, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-[#E8E4DC] hover:shadow-sm transition-shadow">
            <div className="h-9 w-9 rounded-lg flex items-center justify-center border border-[#E8E4DC] flex-shrink-0" style={{ backgroundColor: item.bg }}>
              <item.icone className="h-4 w-4" style={{ color: item.couleur }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#172030]">{item.titre}</p>
              <p className="text-xs text-[#172030]/60 mt-0.5">{item.description}</p>
            </div>
            <Button size="sm" className="h-7 text-[10px] px-3 bg-[#2A5141] hover:bg-[#1a3329] text-white flex-shrink-0">
              Traiter <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

// 3. FUNNEL DE COUVERTURE (nouveau)
const CoverageFunnel = ({ funnel }: { funnel: any }) => {
  const steps = [
    { label: "Processus", value: funnel.totalProcessus, pct: 100, icon: Activity },
    {
      label: "Critiques",
      value: funnel.totalCritiques,
      pct: funnel.totalProcessus > 0 ? Math.round((funnel.totalCritiques / funnel.totalProcessus) * 100) : 0,
      icon: Shield,
    },
    {
      label: "Avec stratégie",
      value: funnel.avecStrategie,
      pct: funnel.totalCritiques > 0 ? Math.round((funnel.avecStrategie / funnel.totalCritiques) * 100) : 0,
      icon: GitBranch,
    },
    {
      label: "Avec plan approuvé",
      value: funnel.avecPlan,
      pct: funnel.totalCritiques > 0 ? Math.round((funnel.avecPlan / funnel.totalCritiques) * 100) : 0,
      icon: FileCheck,
    },
    {
      label: "Testés (12 mois)",
      value: funnel.hasExerciceTracking ? funnel.testes : null,
      pct: funnel.hasExerciceTracking && funnel.totalCritiques > 0 ? Math.round((funnel.testes / funnel.totalCritiques) * 100) : 0,
      icon: PlayCircle,
      untracked: !funnel.hasExerciceTracking,
    },
  ];

  return (
    <Card className="border border-[#E8E4DC] shadow-sm bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[#172030] flex items-center gap-2 font-serif">
          <Activity className="h-4 w-4 text-[#2A5141]" /> Parcours de couverture des processus critiques
        </CardTitle>
        <p className="text-xs text-[#172030]/40">De l'identification des processus jusqu'à leur mise à l'épreuve réelle</p>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isLast = idx === steps.length - 1;
            return (
              <div key={step.label} className="relative flex items-center">
                <div
                  className={cn(
                    "flex-1 rounded-xl p-3 border transition-all",
                    step.untracked
                      ? "border-dashed border-[#E8E4DC] bg-[#FAFAF9]"
                      : "border-[#E8E4DC] bg-[#F8F6F2]"
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className={cn(
                        "h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0",
                        step.untracked ? "bg-white" : "bg-[#2A5141]/10"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" style={{ color: step.untracked ? "#B0AFA8" : "#2A5141" }} />
                    </div>
                    <span className="text-[9px] font-semibold text-[#172030]/50 uppercase tracking-wider leading-tight">
                      {step.label}
                    </span>
                  </div>
                  {step.untracked ? (
                    <div>
                      <p className="text-[11px] font-medium text-[#172030]/40">Non suivi</p>
                      <p className="text-[9px] text-[#172030]/30 mt-0.5">Activez le module Exercices PCA</p>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-bold text-[#172030] font-serif">{step.value}</span>
                      {idx > 0 && (
                        <span className="text-[10px] text-[#172030]/40 font-medium">({step.pct}%)</span>
                      )}
                    </div>
                  )}
                </div>
                {!isLast && (
                  <ChevronRight className="hidden md:block h-4 w-4 text-[#172030]/20 mx-1 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

// 4. FRAÎCHEUR DU PROGRAMME (nouveau, remplace le heatmap mensuel)
const ProgramFreshness = ({ fraicheur }: { fraicheur: any }) => {
  const items = [
    {
      label: "Dernier exercice PCA",
      icon: CalendarCheck,
      value: fraicheur.dernierExercice
        ? fraicheur.dernierExercice.date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
        : null,
      subtitle: fraicheur.joursDepuisDernierExercice !== null
        ? `Il y a ${fraicheur.joursDepuisDernierExercice} jour${fraicheur.joursDepuisDernierExercice > 1 ? 's' : ''}`
        : "Aucun exercice enregistré",
      alerte: fraicheur.joursDepuisDernierExercice !== null && fraicheur.joursDepuisDernierExercice > 365,
      color: "#2A5141",
      bg: "#F0F7F4",
    },
    {
      label: "Prochain test planifié",
      icon: CalendarClock,
      value: fraicheur.prochainExercice
        ? fraicheur.prochainExercice.date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
        : null,
      subtitle: fraicheur.joursAvantProchainExercice !== null
        ? `Dans ${fraicheur.joursAvantProchainExercice} jour${fraicheur.joursAvantProchainExercice > 1 ? 's' : ''}`
        : "Aucun test à venir",
      alerte: fraicheur.joursAvantProchainExercice === null,
      color: "#E89B2D",
      bg: "#FFF8E1",
    },
    {
      label: "Plans obsolètes",
      icon: FileWarning,
      value: fraicheur.plansObsoletes,
      subtitle: fraicheur.plansObsoletes > 0 ? "Révision dépassée (>12 mois)" : "Tous les plans sont à jour",
      alerte: fraicheur.plansObsoletes > 0,
      color: "#C62828",
      bg: "#FFEBEE",
      isCount: true,
    },
  ];

  return (
    <Card className="border border-[#E8E4DC] shadow-sm bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[#172030] flex items-center gap-2 font-serif">
          <Clock className="h-4 w-4 text-[#2A5141]" /> Fraîcheur du programme
        </CardTitle>
        <p className="text-xs text-[#172030]/40">Le plan n'a de valeur que s'il est pratiqué et tenu à jour</p>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {items.map((item) => {
            const Icon = item.icon;
            const hasData = item.isCount ? true : !!item.value;
            return (
              <div
                key={item.label}
                className={cn(
                  "rounded-xl border p-4",
                  item.alerte ? "border-[#F5A8B5] bg-[#FFF5F5]" : "border-[#E8E4DC] bg-[#FAFAF9]"
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: item.bg }}>
                    <Icon className="h-4 w-4" style={{ color: item.color }} />
                  </div>
                  <span className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider">{item.label}</span>
                </div>
                {hasData ? (
                  <>
                    <p className="text-lg font-bold text-[#172030] font-serif">{item.value}</p>
                    <p className={cn("text-xs mt-0.5", item.alerte ? "text-[#C62828] font-medium" : "text-[#172030]/50")}>
                      {item.subtitle}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-[#172030]/40">Non renseigné</p>
                    <Button size="sm" variant="link" className="h-auto p-0 text-[11px] text-[#2A5141] mt-1">
                      Planifier un exercice <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

// 5. ÉCHÉANCES
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

// 6. MATRICE DES RISQUES AVEC TOOLTIP VOLANT
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
                    backgroundColor: style.bg,
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

// 7. TOP PROCESSUS CRITIQUES
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

// 8. RÉPARTITION PAR DIRECTION
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

// 9. RESSOURCES
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

// 10. STRATÉGIES
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
        <Skeleton className="h-20 w-full bg-[#E8E4DC]/50" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
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

      {/* 2. Bandeau de maturité */}
      <BandeauMaturite data={dashboard.maturite} insight={dashboard.insight} />

      {/* 3. Actions prioritaires (remonté juste après le bandeau) */}
      <ActionsPrioritaires alertes={dashboard.alertes} />

      {/* 4. Funnel de couverture (remplace la grille de 6 KPI cards) */}
      <CoverageFunnel funnel={dashboard.funnel} />

      {/* 5. Matrice des risques + Top processus critiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RiskMatrix matrixData={dashboard.matrixData} hasRisks={dashboard.hasRisks} risques={dashboard.risques} />
        <TopProcessusCritiques processes={processes} entities={entities} />
      </div>

      {/* 6. Fraîcheur du programme (remplace le heatmap mensuel) */}
      <ProgramFreshness fraicheur={dashboard.fraicheur} />

      {/* 7. Répartition par direction + Échéances */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DirectionDistribution processes={processes} entities={entities} />
        <EcheancesOriginales events={dashboard.events} />
      </div>

      {/* 8. Ressources & Stratégies */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RessourcesBloc ressources={dashboard.ressources} total={dashboard.kpis.totalRessources} />
        <StrategiesBloc strategies={dashboard.strategies} processus={processes} associations={dashboard.associations} />
      </div>
    </div>
  );
};