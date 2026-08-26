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
// HOOK CENTRALISÉ - CORRIGÉ AVEC LES RISQUES
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
  // ⭐ NOUVEAU : Chargement des risques réels
  const [risques, setRisques] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
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
    };
    loadData();
  }, []);

  const dashboard = useMemo(() => {
    const processus = processes;
    const totalProcessus = processus.length;
    const totalRessources =
      rh.length + equip.length + apps.length + fournisseurs.length;
    const totalStrategies = strategies.length;

    // ============================================================
    // 1. CRITICITÉ RÉELLE (calculée depuis les impacts)
    // ============================================================
    const processusAvecCriticite = processus.map((p) => {
      const score = computeMaxScore(p.impacts);
      const criticite = scoreToCriticality(score);
      return { ...p, score, criticite };
    });

    const processusCritiques = processusAvecCriticite.filter(
      (p) => p.criticite === "Critique" || p.criticite === "Sévère"
    ).length;

    // ============================================================
    // 2. BIA : % de processus AVEC des impacts RENSEIGNÉS
    // ============================================================
    const processusAvecBIA = processus.filter((p) => {
      if (!p.impacts) return false;
      for (const period of Object.values(p.impacts)) {
        if (period && typeof period === "object") {
          for (const value of Object.values(period)) {
            if (value && Number(value) > 0) {
              return true;
            }
          }
        }
      }
      return false;
    }).length;

    const matBIA =
      totalProcessus > 0
        ? Math.round((processusAvecBIA / totalProcessus) * 100)
        : 0;

    // ============================================================
    // 3. RISQUES : % de processus avec un score > 0
    // ============================================================
    const processusAvecRisque = processusAvecCriticite.filter(
      (p) => p.score > 0
    ).length;
    const matRisques =
      totalProcessus > 0
        ? Math.round((processusAvecRisque / totalProcessus) * 100)
        : 0;

    // ============================================================
    // 4. STRATÉGIES : % de processus critiques COUVERTS
    // ============================================================
    const totalCritiques = processusAvecCriticite.filter(
      (p) => p.criticite === "Critique" || p.criticite === "Sévère"
    ).length;

    const processusCritiquesAvecStrategie = processusAvecCriticite.filter(
      (p) =>
        (p.criticite === "Critique" || p.criticite === "Sévère") &&
        associations.some((a) => a.processus_id === p.id)
    ).length;

    const matStrategies =
      totalCritiques > 0
        ? Math.round(
            (processusCritiquesAvecStrategie / totalCritiques) * 100
          )
        : 0;

    // ============================================================
    // 5. PLANS : % de processus critiques AVEC un plan
    // ============================================================
    const processusCritiquesAvecPlan = processusAvecCriticite.filter(
      (p) =>
        (p.criticite === "Critique" || p.criticite === "Sévère") &&
        plans.some((pl) => pl.processus_id === p.id)
    ).length;

    const matPlans =
      totalCritiques > 0
        ? Math.round((processusCritiquesAvecPlan / totalCritiques) * 100)
        : 0;

    // ============================================================
    // 6. RESSOURCES : % de processus avec au moins une ressource liée
    // ============================================================
    const processusAvecRessources = processus.filter(
      (p) => p.resources && p.resources.length > 0
    ).length;

    const matRessources =
      totalProcessus > 0
        ? Math.round((processusAvecRessources / totalProcessus) * 100)
        : 0;

    // ============================================================
    // 7. MATURITÉ GLOBALE
    // ============================================================
    const globalMaturity = Math.round(
      matBIA * 0.25 + matRisques * 0.2 + matStrategies * 0.2 + matPlans * 0.25 +
        matRessources * 0.1
    );

    const piliers = [
      { label: "BIA", value: matBIA },
      { label: "Risques", value: matRisques },
      { label: "Stratégies", value: matStrategies },
      { label: "Plans", value: matPlans },
      { label: "Ressources", value: matRessources },
    ];
    const weakest = piliers.reduce((min, p) =>
      p.value < min.value ? p : min,
      piliers[0]
    );
    const insight = `Votre couverture ${weakest.label} est le point faible actuel : ${weakest.value}% des données évaluées.`;

    // ============================================================
    // 8. ALERTES
    // ============================================================
    const processusCritiquesSansStrategie = processusAvecCriticite.filter(
      (p) =>
        (p.criticite === "Critique" || p.criticite === "Sévère") &&
        !associations.some((a) => a.processus_id === p.id)
    ).length;

    const processusCritiquesSansRessources = processusAvecCriticite.filter(
      (p) =>
        (p.criticite === "Critique" || p.criticite === "Sévère") &&
        (!p.resources || p.resources.length === 0)
    ).length;

    // ============================================================
    // 9. ÉCHÉANCES (événements à venir)
    // ============================================================
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

    // ============================================================
    // 10. MATRICE DES RISQUES - AVEC LES VRAIS RISQUES ⭐
    // ============================================================
    const matrixData: Record<string, number> = {};

    risques.forEach((r) => {
      // Utilise les champs réels de la table "risques"
      const proba = r.probabilite || r.probability || 1;
      const impact = r.impact_global || r.impact || 1;
      const key = `${proba}-${impact}`;
      matrixData[key] = (matrixData[key] || 0) + 1;
    });

    // Si aucun risque n'est trouvé, on crée des données vides pour afficher la matrice
    const hasRisks = Object.keys(matrixData).length > 0;

    // ============================================================
    // 11. RÉPARTITION PAR DIRECTION
    // ============================================================
    const dirMap: Record<string, Record<string, number>> = {};
    const roots = entities.filter((e) => e.parentId === null);
    for (const root of roots) {
      const descendantIds = getAllDescendantIds(entities, root.id);
      const rootProcesses = processus.filter(
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

    // ============================================================
    // 12. HEATMAP MENSUEL
    // ============================================================
    const monthlyHeatmap = Array(12).fill(0);
    events.forEach((e) => {
      if (e.start_date) {
        const month = new Date(e.start_date).getMonth();
        monthlyHeatmap[month]++;
      }
    });

    const directionsList = entities.filter((e) => e.parentId === null);
    const totalDirections = directionsList.length;

    return {
      kpis: {
        totalProcessus,
        totalRisques: risques.length,
        totalStrategies,
        totalPlans: plans.length,
        totalRessources,
        totalDirections,
        processusCritiques,
        risquesCritiques: risques.filter((r) => {
          const score = (r.probabilite || 1) * (r.impact_global || 1);
          return score >= 12;
        }).length,
        processusAvecBIA,
        processusAvecRisque,
      },
      maturite: {
        global: globalMaturity,
        bia: matBIA,
        risques: matRisques,
        strategies: matStrategies,
        plans: matPlans,
        ressources: matRessources,
      },
      insight,
      echeances,
      matrixData,
      hasRisks,
      monthlyHeatmap,
      directionData,
      alertes: {
        sansStrategie: processusCritiquesSansStrategie,
        sansRessources: processusCritiquesSansRessources,
      },
      processusAvecCriticite,
      ressources: [
        {
          label: "Collaborateurs",
          count: rh.length,
          icon: Users,
          color: "#2A5141",
          bg: "bg-[#F0F7F4]",
        },
        {
          label: "Équipements",
          count: equip.length,
          icon: Server,
          color: "#172030",
          bg: "bg-[#F4F5F7]",
        },
        {
          label: "Applications IT",
          count: apps.length,
          icon: Boxes,
          color: "#4A7A6A",
          bg: "bg-[#EAF2EE]",
        },
        {
          label: "Prestataires",
          count: fournisseurs.length,
          icon: Handshake,
          color: "#E89B2D",
          bg: "bg-[#FFF8E1]",
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
  ]);

  return { loading: false, error: null, dashboard, refresh: () => {} };
};

// ============================================================
// COMPOSANTS UI
// ============================================================

// 1. BANDEAU MATURITÉ
const BandeauMaturite = ({ data, insight }: { data: any; insight: string }) => {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const progress = (data.global / 100) * circumference;

  const getScoreColor = (score: number) => {
    if (score < 40) return "#C62828";
    if (score < 70) return "#E89B2D";
    return "#639922";
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
          <p className="text-xs text-white/60 mt-1 max-w-[220px]">{insight}</p>
          <div className="flex items-center gap-1.5 mt-2">
            <TrendingUp className="h-3 w-3 text-[#639922]" />
            <span className="text-xs font-medium text-[#639922]">
              Calculé en temps réel
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-4 border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-8">
        {[
          { label: "BIA", value: data.bia, color: "#639922" },
          { label: "Risques", value: data.risques, color: "#4A7A6A" },
          { label: "Stratégies", value: data.strategies, color: "#6A9A8A" },
          { label: "Plans", value: data.plans, color: "#8A9A9A" },
          { label: "Ressources", value: data.ressources, color: "#A5B8B0" },
        ].map((item) => (
          <div key={item.label} className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-white/60">
                {item.label}
              </span>
              <span className="text-sm font-bold text-white">{item.value}%</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${item.value}%`,
                  backgroundColor: item.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 2. KPI CARD
const KpiCard = ({
  label,
  value,
  icon: Icon,
  color,
  bg,
  subtitle,
}: any) => (
  <Card className="border border-[#E8E4DC] shadow-sm bg-white hover:shadow-md transition-all duration-200">
    <CardContent className="p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider">
            {label}
          </p>
          <p className="text-3xl font-bold text-[#172030] mt-1 font-serif">
            {value}
          </p>
          {subtitle && (
            <p className="text-[10px] text-[#172030]/40 mt-0.5">{subtitle}</p>
          )}
        </div>
        <div
          className={cn(
            "h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
          )}
          style={{ backgroundColor: bg }}
        >
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
      description:
        "Ces processus peuvent générer des interruptions majeures sans plan de continuité adapté.",
      couleur: "#C62828",
      bg: "#FFEBEE",
      icone: AlertOctagon,
    });
  }

  if (alertes.sansRessources > 0) {
    alertesList.push({
      titre: `${alertes.sansRessources} processus critiques sans ressources allouées`,
      description:
        "Les ressources critiques doivent être identifiées pour assurer la continuité.",
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
          <p className="text-sm font-medium text-[#172030]">
            Excellent ! Aucune alerte active.
          </p>
          <p className="text-xs text-[#172030]/50 mt-1">
            Votre organisation est bien préparée.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-[#E8E4DC] shadow-sm bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[#172030] flex items-center gap-2 font-serif">
          <Bell className="h-4 w-4 text-[#C62828]" /> Alertes & Actions
          immédiates
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {alertesList.map((item, i) => (
          <div
            key={i}
            className="flex items-start gap-3 p-3 rounded-lg border border-[#E8E4DC]"
          >
            <div
              className={cn(
                "h-9 w-9 rounded-lg flex items-center justify-center border border-[#E8E4DC]"
              )}
              style={{ backgroundColor: item.bg }}
            >
              <item.icone className="h-4 w-4" style={{ color: item.couleur }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#172030]">{item.titre}</p>
              <p className="text-xs text-[#172030]/60 mt-0.5">
                {item.description}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px] px-2 text-[#2A5141] flex-shrink-0"
            >
              <ArrowRight className="h-3 w-3" /> Voir
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

// 4. ÉCHÉANCES - AVEC MESSAGE SI AUCUNE DONNÉE
const EcheancesOriginales = ({ events }: { events: any[] }) => {
  const today = new Date();

  const upcomingEvents = events
    .filter((e) => new Date(e.start_date) >= today)
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
    .slice(0, 5);

  const getEventStyle = (title: string) => {
    const t = title?.toLowerCase() || "";
    if (t.includes("test"))
      return { bg: "#FFEBEE", text: "#C62828", icon: Flame, label: "TEST" };
    if (t.includes("exercice"))
      return { bg: "#E8F5E9", text: "#2E7D32", icon: Shield, label: "EXERCICE" };
    if (t.includes("comité") || t.includes("comite"))
      return { bg: "#FFF8E1", text: "#F57F17", icon: Users, label: "COMITÉ" };
    return {
      bg: "#EAF2EE",
      text: "#2A5141",
      icon: Calendar,
      label: "ÉVÉNEMENT",
    };
  };

  const getMonthLabel = (date: Date) => {
    return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  };

  return (
    <Card className="border border-[#E8E4DC] shadow-sm bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[#172030] flex items-center gap-2 font-serif">
          <Calendar className="h-4 w-4 text-[#2A5141]" /> Prochaines
          échéances
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {upcomingEvents.length === 0 ? (
          <div className="text-center py-8 text-sm text-[#172030]/40">
            <Calendar className="h-10 w-10 mx-auto text-[#172030]/20 mb-2" />
            <p>Aucune échéance à venir</p>
            <p className="text-xs text-[#172030]/30 mt-1">
              Ajoutez des événements dans le module Calendrier annuel PCA
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingEvents.map((e) => {
              const eventDate = new Date(e.start_date);
              const style = getEventStyle(e.title);
              const Icon = style.icon;

              const daysLeft = Math.ceil(
                (eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
              );
              const isUrgent = daysLeft <= 30;
              const isSoon = daysLeft <= 90;

              return (
                <div
                  key={e.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-colors hover:shadow-sm",
                    isUrgent
                      ? "border-[#F5A8B5] bg-[#FFF5F5]"
                      : isSoon
                      ? "border-[#FFCC80] bg-[#FFF8F3]"
                      : "border-[#E8E4DC] bg-[#FAFAF9]"
                  )}
                >
                  <div
                    className={cn("h-10 w-10 rounded-lg flex items-center justify-center")}
                    style={{ backgroundColor: style.bg }}
                  >
                    <Icon className="h-5 w-5" style={{ color: style.text }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#172030] truncate">
                        {e.title || "Sans titre"}
                      </span>
                      <Badge
                        className={cn(
                          "text-[8px] px-1.5 py-0.5 rounded-full shrink-0"
                        )}
                        style={{ backgroundColor: style.bg, color: style.text }}
                      >
                        {style.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-[#172030]/50 flex items-center gap-2 mt-0.5">
                      <Clock className="h-3 w-3" />
                      {eventDate.toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                      {e.lieu && e.lieu !== "Non spécifié" && (
                        <>
                          <span className="text-[#172030]/30">•</span>
                          <MapPin className="h-3 w-3" />
                          {e.lieu}
                        </>
                      )}
                    </p>
                  </div>

                  <div className="flex flex-col items-end flex-shrink-0">
                    <span
                      className={cn(
                        "text-xs font-bold",
                        isUrgent
                          ? "text-[#C62828]"
                          : isSoon
                          ? "text-[#E65100]"
                          : "text-[#2A5141]"
                      )}
                    >
                      {daysLeft === 0 ? "Aujourd'hui" : `Dans ${daysLeft} j`}
                    </span>
                    <span className="text-[9px] text-[#172030]/40">
                      {getMonthLabel(eventDate)}
                    </span>
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

// 5. MATRICE DES RISQUES - AVEC LES VRAIS RISQUES ⭐
const RiskMatrix = ({
  matrixData,
  hasRisks,
}: {
  matrixData: Record<string, number>;
  hasRisks: boolean;
}) => {
  const hasData = Object.values(matrixData).some((v) => v > 0);

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
          <div className="text-[9px] text-[#172030]/40 font-medium flex items-end justify-center pb-1">
            IMPACT
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="text-center text-[10px] text-[#172030]/50 font-semibold"
            >
              {i}
            </div>
          ))}
        </div>
        {[5, 4, 3, 2, 1].map((p) => (
          <div key={p} className="grid grid-cols-6 gap-1.5 mb-1.5">
            <div className="flex items-center justify-center text-[10px] text-[#172030]/50 font-semibold">
              {p}
            </div>
            {[1, 2, 3, 4, 5].map((i) => {
              const count = matrixData[`${p}-${i}`] || 0;
              const score = p * i;
              const style = getMatrixStyle(score);
              return (
                <div
                  key={i}
                  className={cn(
                    "relative rounded-md border h-10 flex items-center justify-center transition-transform hover:scale-105",
                    count > 0 ? "cursor-pointer" : "opacity-60"
                  )}
                  style={{
                    backgroundColor: style.bg,
                    borderColor: style.border,
                  }}
                >
                  <div
                    className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
                    style={{
                      backgroundColor: style.dot,
                      opacity: count > 0 ? 1 : 0.4,
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
        <div className="flex flex-wrap items-center justify-center gap-3 mt-3 pt-3 border-t border-[#E8E4DC]">
          {[
            { label: "Faible", style: MATRIX_STYLES.low },
            { label: "Modéré", style: MATRIX_STYLES.moderate },
            { label: "Élevé", style: MATRIX_STYLES.high },
            { label: "Critique", style: MATRIX_STYLES.critical },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: item.style.dot }}
              />
              <span className="text-[9px] text-[#172030]/60 font-medium">
                {item.label}
              </span>
            </div>
          ))}
        </div>
        {hasData && (
          <p className="text-[9px] text-[#172030]/30 text-center mt-2">
            {Object.values(matrixData).reduce((a, b) => a + b, 0)} risques
            analysés
          </p>
        )}
      </CardContent>
    </Card>
  );
};

// 6. TOP PROCESSUS CRITIQUES
const TopProcessusCritiques = ({
  processes,
  entities,
}: {
  processes: any[];
  entities: any[];
}) => {
  const topProcesses = useMemo(() => {
    return processes
      .map((p) => {
        const score = computeMaxScore(p.impacts);
        const criticality = scoreToCriticality(score);
        const entity = entities.find((e) => e.id === p.entityId);
        return {
          ...p,
          score,
          criticality,
          entityName: entity?.name || "Sans direction",
          rto: p.rto || 0,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [processes, entities]);

  const levelBadgeClass = (level: string) => {
    const classes = {
      Critique:
        "bg-[#FFEBEE] text-[#C62828] border-[#EF9A9A]",
      Sévère:
        "bg-[#FBE9E7] text-[#D84315] border-[#FFAB91]",
      Majeur: "bg-[#FFF3E0] text-[#E65100] border-[#FFCC80]",
      Modéré: "bg-[#FFF8E1] text-[#F57F17] border-[#FFE082]",
      Mineur: "bg-[#E8F5E9] text-[#2E7D32] border-[#A5D6A7]",
    };
    return (
      classes[level as keyof typeof classes] ||
      "bg-gray-100 text-gray-700 border-gray-200"
    );
  };

  return (
    <Card className="border border-[#E8E4DC] shadow-sm bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[#172030] flex items-center gap-2 font-serif">
          <Target className="h-4 w-4 text-[#172030]/40" /> Top processus
          critiques
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="grid grid-cols-4 gap-2 py-1.5 border-b border-[#E8E4DC]">
          <span className="text-[9px] font-medium text-[#172030]/40 uppercase tracking-wider col-span-2">
            Processus
          </span>
          <span className="text-[9px] font-medium text-[#172030]/40 uppercase tracking-wider">
            RTO
          </span>
          <span className="text-[9px] font-medium text-[#172030]/40 uppercase tracking-wider text-center">
            Criticité
          </span>
        </div>
        <div className="divide-y divide-[#E8E4DC]/50">
          {topProcesses.length > 0 ? (
            topProcesses.map((p, index) => (
              <div key={index} className="grid grid-cols-4 gap-2 py-2.5 items-center">
                <span className="text-sm font-medium text-[#172030] truncate col-span-2">
                  {p.name}
                </span>
                <span className="text-xs text-[#172030]/60 text-center font-mono">
                  {p.rto || 0}h
                </span>
                <Badge
                  className={cn(
                    "text-[9px] px-2 py-0.5 h-5 border text-center justify-center",
                    levelBadgeClass(p.criticality)
                  )}
                >
                  {p.criticality}
                </Badge>
              </div>
            ))
          ) : (
            <div className="py-6 text-center text-sm text-[#172030]/30">
              Aucun processus trouvé
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// 7. RÉPARTITION PAR DIRECTION
const DirectionDistribution = ({
  processes,
  entities,
}: {
  processes: any[];
  entities: any[];
}) => {
  const directionData = useMemo(() => {
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
        if (dirMap[root.name][crit] !== undefined) dirMap[root.name][crit]++;
      }
    }

    return Object.entries(dirMap)
      .map(([name, values]) => ({
        name,
        ...values,
        total: Object.values(values).reduce((a, b) => a + b, 0),
      }))
      .filter((d) => d.total > 0);
  }, [processes, entities]);

  if (directionData.length === 0) {
    return (
      <Card className="border border-[#E8E4DC] shadow-sm bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[#172030] flex items-center gap-2 font-serif">
            <Building2 className="h-4 w-4 text-[#172030]/40" /> Répartition par
            direction
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <p className="text-sm text-[#172030]/40">
            Aucune direction renseignée
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-[#E8E4DC] shadow-sm bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[#172030] flex items-center gap-2 font-serif">
          <Building2 className="h-4 w-4 text-[#172030]/40" /> Répartition par
          direction
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={directionData}
              layout="vertical"
              margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
            >
              <XAxis type="number" hide />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fontSize: 10, fill: "#172030/60" }}
                width={90}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #E8E4DC",
                  borderRadius: "6px",
                  fontSize: "11px",
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
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  backgroundColor:
                    CHART_COLORS[level as keyof typeof CHART_COLORS],
                }}
              />
              <span className="text-[9px] text-[#172030]/50">{level}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// 8. RESSOURCES
const RessourcesBloc = ({
  ressources,
  total,
}: {
  ressources: any[];
  total: number;
}) => (
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
            <div
              key={i}
              className="flex items-center justify-between p-2 rounded-lg bg-[#FAFAF9] hover:bg-[#F0F7F4] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn("h-8 w-8 rounded-lg flex items-center justify-center")}
                  style={{ backgroundColor: res.bg }}
                >
                  <Icon className="h-4 w-4" style={{ color: res.color }} />
                </div>
                <span className="text-sm text-[#172030] font-medium">
                  {res.label}
                </span>
              </div>
              <span className="text-lg font-bold text-[#172030] font-serif">
                {res.count}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between pt-3 mt-2 border-t border-[#E8E4DC]">
        <span className="text-sm font-semibold text-[#172030]">
          Total ressources
        </span>
        <span className="text-xl font-bold text-[#2A5141] font-serif">
          {total}
        </span>
      </div>
    </CardContent>
  </Card>
);

// 9. STRATÉGIES
const StrategiesBloc = ({
  strategies,
  processus,
  associations,
}: {
  strategies: any[];
  processus: any[];
  associations: any[];
}) => {
  const totalStrat = strategies?.length || 0;
  const processusCouverts =
    processus?.filter((p) => associations?.some((a) => a.processus_id === p.id))
      .length || 0;
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
              <div className="h-8 w-8 rounded-lg bg-[#E8F5E9] flex items-center justify-center">
                <FileText className="h-4 w-4 text-[#2E7D32]" />
              </div>
              <span className="text-sm text-[#172030] font-medium">
                Stratégies définies
              </span>
            </div>
            <span className="text-lg font-bold text-[#172030] font-serif">
              {totalStrat}
            </span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-[#FAFAF9] hover:bg-[#F0F7F4] transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-[#FFF8E1] flex items-center justify-center">
                <Target className="h-4 w-4 text-[#F57F17]" />
              </div>
              <span className="text-sm text-[#172030] font-medium">
                Processus couverts
              </span>
            </div>
            <span className="text-lg font-bold text-[#172030] font-serif">
              {processusCouverts}
            </span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-[#FAFAF9] hover:bg-[#F0F7F4] transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-[#FFEBEE] flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-[#C62828]" />
              </div>
              <span className="text-sm text-[#172030] font-medium">
                Processus sans stratégie
              </span>
            </div>
            <span className="text-lg font-bold text-[#172030] font-serif">
              {sansStrategie}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between pt-3 mt-2 border-t border-[#E8E4DC]">
          <span className="text-sm font-semibold text-[#172030]">
            Total couverture
          </span>
          <span className="text-xl font-bold text-[#2A5141] font-serif">
            {processus?.length > 0
              ? Math.round((processusCouverts / processus.length) * 100)
              : 0}
            %
          </span>
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

  if (loading)
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

  if (error)
    return (
      <div className="h-full bg-[#F8F6F2] p-6 flex items-center justify-center">
        <Card className="border-[#E8E4DC] p-8 text-center max-w-md">
          <AlertTriangle className="h-12 w-12 text-[#ef4444] mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[#172030] font-serif">
            Erreur de chargement
          </h2>
          <p className="text-sm text-[#172030]/60 mt-2">{error}</p>
        </Card>
      </div>
    );

  return (
    <div className="h-full bg-[#F8F6F2] p-6 space-y-6 overflow-y-auto">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#172030] font-serif">
            Tableau de bord BCM
          </h1>
          <p className="text-sm text-[#172030]/60 mt-1">
            Vue consolidée de la résilience de votre organisation
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 text-xs text-[#172030]/40">
            <Calendar className="h-4 w-4" />
            {new Date().toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-[#E8E4DC] hover:bg-white"
            onClick={refresh}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Actualiser
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1.5 bg-[#2A5141] hover:bg-[#1a3329] text-white"
          >
            <FileText className="h-3.5 w-3.5" /> Exporter
          </Button>
        </div>
      </div>

      {/* 2. Bandeau de maturité */}
      <BandeauMaturite data={dashboard.maturite} insight={dashboard.insight} />

      {/* 3. VRAIS KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          label="Processus critiques"
          value={dashboard.kpis.processusCritiques}
          icon={Shield}
          color="#2A5141"
          bg="bg-[#F0F7F4]"
          subtitle={`sur ${dashboard.kpis.totalProcessus} processus`}
        />
        <KpiCard
          label="BIA réalisés"
          value={dashboard.kpis.processusAvecBIA}
          icon={FileCheck}
          color="#2A5141"
          bg="bg-[#E8F5E9]"
          subtitle={`${dashboard.maturite.bia}% de couverture`}
        />
        <KpiCard
          label="Stratégies définies"
          value={dashboard.kpis.totalStrategies}
          icon={GitBranch}
          color="#E89B2D"
          bg="bg-[#FFF8E1]"
          subtitle={`${dashboard.maturite.strategies}% des critiques couverts`}
        />
        <KpiCard
          label="Plans de continuité"
          value={dashboard.kpis.totalPlans}
          icon={FileText}
          color="#172030"
          bg="bg-[#F4F5F7]"
          subtitle={`${dashboard.maturite.plans}% des critiques couverts`}
        />
        <KpiCard
          label="Ressources recensées"
          value={dashboard.kpis.totalRessources}
          icon={Database}
          color="#2A5141"
          bg="bg-[#F0F7F4]"
          subtitle={`${dashboard.maturite.ressources}% des processus`}
        />
        <KpiCard
          label="Risques"
          value={dashboard.kpis.totalRisques}
          icon={Flame}
          color="#C62828"
          bg="bg-[#FDE8E8]"
          subtitle={`${dashboard.kpis.risquesCritiques} critiques`}
        />
      </div>

      {/* 4. ALERTES */}
      <AlertesBloc alertes={dashboard.alertes} />

      {/* 5. ÉCHÉANCES + MATRICE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EcheancesOriginales events={dashboard.events} />
        <RiskMatrix matrixData={dashboard.matrixData} hasRisks={dashboard.hasRisks} />
      </div>

      {/* 6. HEATMAP MENSUEL */}
      <Card className="border border-[#E8E4DC] shadow-sm bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[#172030] flex items-center gap-2 font-serif">
            <Calendar className="h-4 w-4 text-[#2A5141]" /> Activité annuelle
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-12 gap-1">
            {dashboard.monthlyHeatmap.map((count: number, i: number) => {
              const intensity = count > 0 ? Math.min(count / 5, 1) : 0.1;
              return (
                <div key={i} className="text-center">
                  <div
                    className="h-8 rounded-md flex items-center justify-center text-[9px] font-medium transition-all"
                    style={{
                      backgroundColor: `rgba(42, 81, 65, ${intensity * 0.8 + 0.1})`,
                      color: count > 2 ? "white" : "#172030",
                    }}
                  >
                    {count > 0 ? count : ""}
                  </div>
                  <span className="text-[8px] text-[#172030]/40 mt-0.5 block">
                    {new Date(2024, i, 1).toLocaleString("fr", { month: "short" })}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-[9px] text-[#172030]/30 text-center mt-2">
            Nombre d'événements par mois
          </p>
        </CardContent>
      </Card>

      {/* 7. TOP PROCESSUS + DIRECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopProcessusCritiques processes={processes} entities={entities} />
        <DirectionDistribution processes={processes} entities={entities} />
      </div>

      {/* 8. RESSOURCES & STRATÉGIES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RessourcesBloc
          ressources={dashboard.ressources}
          total={dashboard.kpis.totalRessources}
        />
        <StrategiesBloc
          strategies={dashboard.strategies}
          processus={processes}
          associations={dashboard.associations}
        />
      </div>
    </div>
  );
};