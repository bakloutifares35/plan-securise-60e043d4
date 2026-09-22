import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  FileSpreadsheet, FileText, AlertTriangle, Search, TrendingUp,
  Calendar, Users, Server, Building2, Clock, CheckCircle2, XCircle,
  ShieldAlert, UserX, FileWarning, RefreshCw, Package, Handshake,
  Layers, Target, Activity, Gauge, Link2,
} from "lucide-react";
import { useBia } from "@/contexts/BiaContext";
import { useGovernance } from "@/contexts/GovernanceContext";
import { computeMaxScore, scoreToCriticality, criticalityColor } from "@/data/bia";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/db";

// ============================================================
// PALETTE RESILLIA
// ============================================================
const COLORS = {
  navy: "#172030",
  cream: "#F8F6F2",
  forest: "#2A5141",
  border: "#E8E4DC",
  danger: "#C62828",
  warning: "#E65100",
  amber: "#B76E1D",
  info: "#38536F",
  success: "#2E7D32",
};

const CRITICALITY_PASTEL: Record<string, { bg: string; text: string; border: string }> = {
  "Critique": { bg: "#FFEBEE", text: "#C62828", border: "#EF9A9A" },
  "Sévère":   { bg: "#FBE9E7", text: "#D84315", border: "#FFAB91" },
  "Majeur":   { bg: "#FFF3E0", text: "#E65100", border: "#FFCC80" },
  "Modéré":   { bg: "#FFF8E1", text: "#F57F17", border: "#FFE082" },
  "Mineur":   { bg: "#E8F5E9", text: "#2E7D32", border: "#A5D6A7" },
};

// ============================================================
// MODAL DE DÉTAIL ENRICHI — avec ressources liées
// ============================================================
const ProcessDetailModal = ({
  process,
  entityName,
  onClose,
}: {
  process: any;
  entityName: string;
  onClose: () => void;
}) => {
  const score = computeMaxScore(process.impacts);
  const criticality = scoreToCriticality(score);
  const critStyle = CRITICALITY_PASTEL[criticality] || CRITICALITY_PASTEL["Mineur"];

  const [resources, setResources] = useState<{
    hr: any[];
    equipment: any[];
    apps: any[];
    suppliers: any[];
  }>({ hr: [], equipment: [], apps: [], suppliers: [] });
  const [loadingResources, setLoadingResources] = useState(true);

  // Chargement des ressources liées
  useState(() => {
    const load = async () => {
      if (!process?.id) return;
      setLoadingResources(true);
      try {
        const [hrLinks, equipLinks, appLinks, suppLinks] = await Promise.all([
          supabase.from("processus_ressources_humaines").select("ressource_humaine_id").eq("processus_id", process.id),
          supabase.from("processus_equipements").select("equipement_id, rto_hours").eq("processus_id", process.id),
          supabase.from("processus_applications").select("application_id, rto_hours, rpo_hours").eq("processus_id", process.id),
          supabase.from("processus_fournisseurs").select("fournisseur_id, rto_hours").eq("processus_id", process.id),
        ]);

        const result = { hr: [] as any[], equipment: [] as any[], apps: [] as any[], suppliers: [] as any[] };

        if (hrLinks.data && hrLinks.data.length > 0) {
          const ids = hrLinks.data.map((l: any) => l.ressource_humaine_id);
          const { data } = await supabase.from("ressources_humaines").select("*").in("id", ids);
          result.hr = data || [];
        }

        if (equipLinks.data && equipLinks.data.length > 0) {
          const ids = equipLinks.data.map((l: any) => l.equipement_id);
          const { data } = await supabase.from("ressources_equipements").select("*").in("id", ids);
          result.equipment = (data || []).map((eq) => {
            const link = equipLinks.data!.find((l: any) => l.equipement_id === eq.id);
            return { ...eq, _linkRto: link?.rto_hours || eq.rto_hours };
          });
        }

        if (appLinks.data && appLinks.data.length > 0) {
          const ids = appLinks.data.map((l: any) => l.application_id);
          const { data } = await supabase.from("applications_it").select("*").in("id", ids);
          result.apps = (data || []).map((app) => {
            const link = appLinks.data!.find((l: any) => l.application_id === app.id);
            return { ...app, _linkRto: link?.rto_hours, _linkRpo: link?.rpo_hours };
          });
        }

        if (suppLinks.data && suppLinks.data.length > 0) {
          const ids = suppLinks.data.map((l: any) => l.fournisseur_id);
          const { data } = await supabase.from("fournisseurs").select("*").in("id", ids);
          result.suppliers = (data || []).map((sup) => {
            const link = suppLinks.data!.find((l: any) => l.fournisseur_id === sup.id);
            return { ...sup, _linkRto: link?.rto_hours };
          });
        }

        setResources(result);
      } catch (e) {
        console.error("Erreur chargement ressources:", e);
      } finally {
        setLoadingResources(false);
      }
    };
    load();
  });

  const totalResources = resources.hr.length + resources.equipment.length + resources.apps.length + resources.suppliers.length;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <div
          className="px-6 py-5 border-b"
          style={{ borderColor: COLORS.border, backgroundColor: "#FCFBF8" }}
        >
          <DialogHeader>
            <DialogTitle
              className="text-xl flex items-center gap-3"
              style={{ fontFamily: "'Playfair Display', serif", color: COLORS.navy }}
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0"
                style={{ backgroundColor: COLORS.forest + "15" }}
              >
                <FileText className="h-5 w-5" style={{ color: COLORS.forest }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate">{process.name}</p>
                <p className="text-[11px] font-normal mt-0.5" style={{ color: COLORS.navy + "60" }}>
                  {entityName} · {process.department || "Sans département"}
                </p>
              </div>
              <Badge
                className="text-[11px] border-0 font-semibold"
                style={{ backgroundColor: critStyle.bg, color: critStyle.text }}
              >
                {criticality}
              </Badge>
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-5">
          {/* Infos clés */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg" style={{ backgroundColor: COLORS.cream }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: COLORS.navy + "60" }}>
                Score BIA
              </p>
              <p
                className="text-xl font-bold mt-0.5"
                style={{ fontFamily: "'Playfair Display', serif", color: critStyle.text }}
              >
                {score}/5
              </p>
            </div>
            <div className="p-3 rounded-lg" style={{ backgroundColor: COLORS.cream }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: COLORS.navy + "60" }}>
                RTO
              </p>
              <p
                className="text-xl font-bold mt-0.5"
                style={{ fontFamily: "'Playfair Display', serif", color: COLORS.navy }}
              >
                {process.rto}h
              </p>
            </div>
            <div className="p-3 rounded-lg" style={{ backgroundColor: COLORS.cream }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: COLORS.navy + "60" }}>
                RPO
              </p>
              <p
                className="text-xl font-bold mt-0.5"
                style={{ fontFamily: "'Playfair Display', serif", color: COLORS.navy }}
              >
                {process.rpo}h
              </p>
            </div>
            <div className="p-3 rounded-lg" style={{ backgroundColor: COLORS.cream }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: COLORS.navy + "60" }}>
                Responsable
              </p>
              <p className="text-sm font-medium mt-0.5 truncate" style={{ color: process.owner ? COLORS.navy : COLORS.danger }}>
                {process.owner || "Non assigné"}
              </p>
            </div>
          </div>

          {/* Description */}
          {process.description && (
            <div className="p-3 rounded-lg" style={{ backgroundColor: COLORS.cream }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: COLORS.navy + "60" }}>
                Description
              </p>
              <p className="text-sm" style={{ color: COLORS.navy }}>{process.description}</p>
            </div>
          )}

          {/* Ressources liées */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Link2 className="h-4 w-4" style={{ color: COLORS.forest }} />
              <h4
                className="text-sm font-semibold"
                style={{ color: COLORS.navy, fontFamily: "'Playfair Display', serif" }}
              >
                Ressources liées
              </h4>
              <span
                className="text-[10px] font-semibold tabular-nums px-2 py-0.5 rounded-full"
                style={{ backgroundColor: COLORS.forest + "15", color: COLORS.forest }}
              >
                {totalResources}
              </span>
            </div>

            {loadingResources ? (
              <div className="flex items-center gap-2 py-6 justify-center">
                <RefreshCw className="h-4 w-4 animate-spin" style={{ color: COLORS.forest }} />
                <span className="text-sm" style={{ color: COLORS.navy + "60" }}>
                  Chargement des ressources...
                </span>
              </div>
            ) : totalResources === 0 ? (
              <div
                className="p-6 rounded-lg text-center border-dashed border-2"
                style={{ borderColor: COLORS.border, backgroundColor: "#FAFAF9" }}
              >
                <Link2 className="h-8 w-8 mx-auto mb-2" style={{ color: COLORS.navy + "30" }} />
                <p className="text-sm" style={{ color: COLORS.navy + "60" }}>
                  Aucune ressource liée à ce processus
                </p>
                <p className="text-xs mt-1" style={{ color: COLORS.navy + "40" }}>
                  Les ressources doivent être ajoutées via la fiche BIA du service
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* RH */}
                {resources.hr.length > 0 && (
                  <ResourceSection
                    icon={Users}
                    label="Collaborateurs"
                    count={resources.hr.length}
                    color="#38536F"
                    bgColor="#EDF2F7"
                  >
                    {resources.hr.map((r) => (
                      <ResourceItem key={r.id} name={r.name} subtitle={r.role} />
                    ))}
                  </ResourceSection>
                )}

                {/* Applications IT */}
                {resources.apps.length > 0 && (
                  <ResourceSection
                    icon={Server}
                    label="Applications IT"
                    count={resources.apps.length}
                    color="#6A4A8A"
                    bgColor="#F5F0FA"
                  >
                    {resources.apps.map((a) => (
                      <ResourceItem
                        key={a.id}
                        name={a.name}
                        subtitle={a.type}
                        badges={[
                          a._linkRto ? `RTO ${a._linkRto}h` : null,
                          a._linkRpo ? `RPO ${a._linkRpo}h` : null,
                        ].filter(Boolean) as string[]}
                      />
                    ))}
                  </ResourceSection>
                )}

                {/* Équipements */}
                {resources.equipment.length > 0 && (
                  <ResourceSection
                    icon={Package}
                    label="Équipements"
                    count={resources.equipment.length}
                    color="#B76E1D"
                    bgColor="#FFF3E0"
                  >
                    {resources.equipment.map((e) => (
                      <ResourceItem
                        key={e.id}
                        name={e.name}
                        subtitle={e.type}
                        badges={e._linkRto ? [`RTO ${e._linkRto}h`] : []}
                      />
                    ))}
                  </ResourceSection>
                )}

                {/* Prestataires */}
                {resources.suppliers.length > 0 && (
                  <ResourceSection
                    icon={Handshake}
                    label="Prestataires"
                    count={resources.suppliers.length}
                    color="#AD1457"
                    bgColor="#FCE4EC"
                  >
                    {resources.suppliers.map((s) => (
                      <ResourceItem
                        key={s.id}
                        name={s.name}
                        subtitle={s.service}
                        badges={s._linkRto ? [`RTO ${s._linkRto}h`] : []}
                      />
                    ))}
                  </ResourceSection>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================
// SOUS-COMPOSANTS POUR LA MODAL
// ============================================================
const ResourceSection = ({
  icon: Icon, label, count, color, bgColor, children,
}: {
  icon: any; label: string; count: number; color: string; bgColor: string;
  children: React.ReactNode;
}) => (
  <div
    className="rounded-lg border overflow-hidden"
    style={{ borderColor: COLORS.border }}
  >
    <div
      className="flex items-center gap-2 px-3 py-2 border-b"
      style={{ borderColor: COLORS.border + "99", backgroundColor: bgColor + "40" }}
    >
      <div
        className="flex h-6 w-6 items-center justify-center rounded-md flex-shrink-0"
        style={{ backgroundColor: bgColor }}
      >
        <Icon className="h-3.5 w-3.5" style={{ color }} />
      </div>
      <span className="text-[12px] font-semibold" style={{ color: COLORS.navy }}>
        {label}
      </span>
      <span
        className="text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full ml-auto"
        style={{ backgroundColor: bgColor, color }}
      >
        {count}
      </span>
    </div>
    <div className="p-2 space-y-1">{children}</div>
  </div>
);

const ResourceItem = ({
  name, subtitle, badges,
}: {
  name: string;
  subtitle?: string | null;
  badges?: string[];
}) => (
  <div
    className="flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors hover:bg-[#FAF9F6]"
  >
    <span
      className="h-1.5 w-1.5 rounded-full flex-shrink-0"
      style={{ backgroundColor: COLORS.forest + "60" }}
    />
    <div className="flex-1 min-w-0">
      <p className="text-[12px] font-medium truncate" style={{ color: COLORS.navy }}>
        {name}
      </p>
      {subtitle && (
        <p className="text-[10px] truncate" style={{ color: COLORS.navy + "55" }}>
          {subtitle}
        </p>
      )}
    </div>
    {badges && badges.length > 0 && (
      <div className="flex items-center gap-1 flex-shrink-0">
        {badges.map((b, i) => (
          <span
            key={i}
            className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
            style={{ backgroundColor: COLORS.cream, color: COLORS.navy + "80" }}
          >
            {b}
          </span>
        ))}
      </div>
    )}
  </div>
);

// ============================================================
// KPI CARD
// ============================================================
const KpiCard = ({
  label, value, suffix, icon: Icon, tone = "neutral", hint, emphasis, subValues,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  icon: any;
  tone?: "neutral" | "danger" | "warning" | "success" | "info";
  hint?: string;
  emphasis?: boolean;
  subValues?: { label: string; value: string | number; color: string }[];
}) => {
  const tones = {
    neutral: { value: COLORS.navy, icon: COLORS.navy + "80", iconBg: COLORS.cream },
    danger:  { value: COLORS.danger, icon: COLORS.danger, iconBg: "#FFEBEE" },
    warning: { value: COLORS.warning, icon: COLORS.warning, iconBg: "#FFF3E0" },
    success: { value: COLORS.success, icon: COLORS.success, iconBg: "#E8F5E9" },
    info:    { value: COLORS.info, icon: COLORS.info, iconBg: "#EDF2F7" },
  }[tone];

  return (
    <Card
      className="border rounded-xl transition-all hover:shadow-md hover:-translate-y-0.5 relative overflow-hidden bg-white"
      style={{
        borderColor: COLORS.border,
        boxShadow: emphasis ? `0 0 0 2px ${tones.value}22` : "0 1px 2px rgba(23,32,48,0.04)",
      }}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-2">
          <p
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: COLORS.navy + "60" }}
          >
            {label}
          </p>
          <div
            className="rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: tones.iconBg, width: 36, height: 36 }}
          >
            <Icon className="h-4 w-4" style={{ color: tones.icon }} />
          </div>
        </div>
        <p
          className="font-bold flex items-baseline gap-1.5"
          style={{
            fontFamily: "'Playfair Display', serif",
            color: tones.value,
            fontSize: emphasis ? "36px" : "30px",
            lineHeight: 1.1,
          }}
        >
          {value}
          {suffix && (
            <span className="text-base font-normal" style={{ color: COLORS.navy + "60" }}>
              {suffix}
            </span>
          )}
        </p>
        {hint && (
          <p className="text-[11px] mt-1.5" style={{ color: COLORS.navy + "60" }}>
            {hint}
          </p>
        )}
        {subValues && subValues.length > 0 && (
          <div className="flex gap-1.5 mt-3 flex-wrap">
            {subValues.map((sv, i) => (
              <span
                key={i}
                className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: sv.color + "15", color: sv.color }}
              >
                {sv.label} {sv.value}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ============================================================
// STATUT BADGE
// ============================================================
const StatusBadge = ({ status }: { status: "a_jour" | "a_reviser" | "incomplet" }) => {
  const config = {
    a_jour:    { label: "À jour",    bg: "#E8F5E9", text: "#2E7D32", icon: CheckCircle2 },
    a_reviser: { label: "À réviser", bg: "#FFF3E0", text: "#B76E1D", icon: RefreshCw },
    incomplet: { label: "Incomplet", bg: "#FFEBEE", text: "#C62828", icon: XCircle },
  }[status];
  const Icon = config.icon;

  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md"
      style={{ backgroundColor: config.bg, color: config.text }}
    >
      <Icon className="h-2.5 w-2.5" />
      {config.label}
    </span>
  );
};

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================
export const ConsolidatedReport = () => {
  const { processes } = useBia();
  const { entities } = useGovernance();

  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [criticalityFilter, setCriticalityFilter] = useState<string>("all");
  const [selectedProcess, setSelectedProcess] = useState<any>(null);

  // ============================================================
  // CHARGEMENT DES RESSOURCES PAR PROCESSUS (pour les KPI)
  // ============================================================
  const [resourceCounts, setResourceCounts] = useState<Record<string, number>>({});

  useMemo(() => {
    const loadResourceCounts = async () => {
      if (processes.length === 0) return;
      const processIds = processes.map(p => p.id);
      try {
        const [hrData, equipData, appData, suppData] = await Promise.all([
          supabase.from("processus_ressources_humaines").select("processus_id").in("processus_id", processIds),
          supabase.from("processus_equipements").select("processus_id").in("processus_id", processIds),
          supabase.from("processus_applications").select("processus_id").in("processus_id", processIds),
          supabase.from("processus_fournisseurs").select("processus_id").in("processus_id", processIds),
        ]);

        const counts: Record<string, number> = {};
        for (const pid of processIds) counts[pid] = 0;
        for (const item of (hrData.data || [])) counts[item.processus_id] = (counts[item.processus_id] || 0) + 1;
        for (const item of (equipData.data || [])) counts[item.processus_id] = (counts[item.processus_id] || 0) + 1;
        for (const item of (appData.data || [])) counts[item.processus_id] = (counts[item.processus_id] || 0) + 1;
        for (const item of (suppData.data || [])) counts[item.processus_id] = (counts[item.processus_id] || 0) + 1;

        setResourceCounts(counts);
      } catch (e) {
        console.error("Erreur chargement ressources:", e);
      }
    };
    loadResourceCounts();
  }, [processes]);

  // ============================================================
  // ENRICHISSEMENT
  // ============================================================
  const enriched = useMemo(() => {
    return processes.map(p => {
      const entity = entities.find(e => e.id === p.entityId);
      const score = computeMaxScore(p.impacts);
      const criticality = scoreToCriticality(score);
      const rtoIssue = p.rto > p.mtpd;
      const daysSinceUpdate = (Date.now() - new Date(p.lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
      const stale = daysSinceUpdate > 365;
      const needPca = score >= 3;
      const resourceCount = resourceCounts[p.id] || 0;

      // Complétude : impacts + RTO + ressources
      const hasImpacts = !!p.impacts && Object.keys(p.impacts).length > 0;
      const hasRto = p.rto > 0;
      const hasResources = resourceCount > 0;
      const isComplete = hasImpacts && hasRto && hasResources;

      let status: "a_jour" | "a_reviser" | "incomplet" = "a_jour";
      if (!isComplete || !p.owner) status = "incomplet";
      else if (stale || rtoIssue) status = "a_reviser";

      return {
        ...p, entityName: entity?.name || "—", score, criticality,
        rtoIssue, stale, needPca, resourceCount, isComplete, status,
        hasImpacts, hasRto, hasResources,
      };
    });
  }, [processes, entities, resourceCounts]);

  // ============================================================
  // FILTRAGE
  // ============================================================
  const filtered = useMemo(() => {
    let list = enriched;
    if (search) {
      list = list.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.entityName.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (entityFilter !== "all") list = list.filter(p => p.entityId === entityFilter);
    if (criticalityFilter !== "all") list = list.filter(p => p.criticality === criticalityFilter);
    return list;
  }, [enriched, search, entityFilter, criticalityFilter]);

  // ============================================================
  // STATS — 4 KPI consultant
  // ============================================================
  const stats = useMemo(() => {
    const total = enriched.length;

    // 1. Complétude BIA : % de processus avec impacts + RTO + ressources
    const completeCount = enriched.filter(p => p.isComplete).length;
    const completenessRate = total > 0 ? Math.round((completeCount / total) * 100) : 0;

    // 2. Processus critiques couverts : score >= 4 ET ressources liées
    const criticalProcesses = enriched.filter(p => p.score >= 4);
    const criticalCovered = criticalProcesses.filter(p => p.resourceCount > 0).length;
    const criticalCoverage = criticalProcesses.length > 0
      ? Math.round((criticalCovered / criticalProcesses.length) * 100)
      : 100;

    // 3. Densité ressources/processus : moyenne des ressources sur les processus critiques
    const avgResourcesOnCritical = criticalProcesses.length > 0
      ? Math.round(
          (criticalProcesses.reduce((sum, p) => sum + p.resourceCount, 0) / criticalProcesses.length) * 10
        ) / 10
      : 0;

    // 4. Écarts méthodologiques
    const rtoIssues = enriched.filter(p => p.rtoIssue).length;
    const noOwner = enriched.filter(p => !p.owner).length;
    const noImpacts = enriched.filter(p => !p.hasImpacts).length;
    const stale = enriched.filter(p => p.stale).length;
    const totalGaps = rtoIssues + noOwner + noImpacts + stale;

    return {
      total,
      completeCount,
      completenessRate,
      criticalCount: criticalProcesses.length,
      criticalCovered,
      criticalCoverage,
      avgResourcesOnCritical,
      rtoIssues,
      noOwner,
      noImpacts,
      stale,
      totalGaps,
    };
  }, [enriched]);

  const uniqueEntities = useMemo(() => {
    const map = new Map();
    enriched.forEach(p => { if (p.entityId) map.set(p.entityId, { id: p.entityId, name: p.entityName }); });
    return Array.from(map.values());
  }, [enriched]);

  // ============================================================
  // EXPORTS
  // ============================================================
  const exportCSV = () => {
    const rows = [
      ["ID", "Processus", "Entité", "Département", "RTO (h)", "RPO (h)", "Criticité", "Score",
       "Responsable", "Nb ressources liées", "Statut", "Dernière MAJ", "PCA requis"],
      ...enriched.map((p) => [
        p.id, p.name, p.entityName, p.department || "—",
        p.rto, p.rpo, p.criticality, p.score,
        p.owner || "—",
        p.resourceCount,
        p.status === "a_jour" ? "À jour" : p.status === "a_reviser" ? "À réviser" : "Incomplet",
        p.lastUpdated, p.needPca ? "Oui" : "Non",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "rapport-bia.csv"; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export CSV", description: "Le rapport BIA a été téléchargé." });
  };

  const exportPDF = () => {
    window.print();
    toast({ title: "Export PDF", description: "Utilisez la boîte de dialogue d'impression pour enregistrer en PDF." });
  };

  return (
    <div className="space-y-6">
      {/* ===== EN-TÊTE ===== */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1
            className="text-2xl md:text-3xl font-bold"
            style={{ color: COLORS.navy, fontFamily: "'Playfair Display', serif" }}
          >
            Rapport BIA consolidé
          </h1>
          <p className="mt-1 text-sm" style={{ color: COLORS.navy + "70" }}>
            Vue synthétique de la maturité et de la qualité des analyses d'impact métier
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportPDF} className="h-9">
            <FileText className="h-4 w-4 mr-2" /> PDF
          </Button>
          <Button
            onClick={exportCSV}
            className="h-9 text-white"
            style={{ backgroundColor: COLORS.navy }}
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel (CSV)
          </Button>
        </div>
      </div>

      {/* ===== 4 KPI CONSULTANT ===== */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1 — Processus analysés (remplace Écarts détectés, placé en premier) */}
        <KpiCard
          label="Processus analysés"
          value={stats.total}
          icon={Layers}
          tone="info"
          hint={`${stats.total} processus au total`}
          subValues={[
            { label: "Critiques", value: enriched.filter(p => p.score >= 4).length, color: COLORS.danger },
            { label: "À jour", value: enriched.filter(p => p.status === "a_jour").length, color: COLORS.success },
          ]}
        />

        {/* KPI 2 — Complétude BIA */}
        <KpiCard
          label="Complétude BIA"
          value={stats.completenessRate}
          suffix="%"
          icon={Gauge}
          tone={stats.completenessRate >= 80 ? "success" : stats.completenessRate >= 50 ? "warning" : "danger"}
          hint={`${stats.completeCount}/${stats.total} processus complets`}
          emphasis={stats.completenessRate < 50}
          subValues={[
            { label: "Impacts", value: enriched.filter(p => p.hasImpacts).length, color: COLORS.info },
            { label: "RTO défini", value: enriched.filter(p => p.hasRto).length, color: COLORS.forest },
            { label: "Ressources", value: enriched.filter(p => p.hasResources).length, color: COLORS.amber },
          ]}
        />

        {/* KPI 3 — Critiques couverts */}
        <KpiCard
          label="Critiques couverts"
          value={stats.criticalCoverage}
          suffix="%"
          icon={ShieldAlert}
          tone={stats.criticalCoverage >= 80 ? "success" : stats.criticalCoverage >= 50 ? "warning" : "danger"}
          hint={`${stats.criticalCovered}/${stats.criticalCount} processus score ≥ 4`}
          emphasis={stats.criticalCoverage < 50}
        />

        {/* KPI 4 — Densité ressources */}
        <KpiCard
          label="Densité ressources"
          value={stats.avgResourcesOnCritical}
          suffix="/processus"
          icon={Activity}
          tone={stats.avgResourcesOnCritical >= 3 ? "success" : stats.avgResourcesOnCritical >= 1.5 ? "info" : "warning"}
          hint="Moyenne sur les processus critiques"
        />
      </div>

      {/* ===== FILTRES ===== */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
              style={{ color: COLORS.navy + "50" }}
            />
            <Input
              placeholder="Rechercher processus ou entité..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-[240px] h-9 text-sm"
              style={{ borderColor: COLORS.border }}
            />
          </div>
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-[180px] h-9 text-sm" style={{ borderColor: COLORS.border }}>
              <Building2 className="h-3.5 w-3.5 mr-1" style={{ color: COLORS.navy + "50" }} />
              <SelectValue placeholder="Toutes entités" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes entités</SelectItem>
              {uniqueEntities.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={criticalityFilter} onValueChange={setCriticalityFilter}>
            <SelectTrigger className="w-[160px] h-9 text-sm" style={{ borderColor: COLORS.border }}>
              <SelectValue placeholder="Toutes criticités" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes criticités</SelectItem>
              <SelectItem value="Critique">Critique</SelectItem>
              <SelectItem value="Majeur">Majeur</SelectItem>
              <SelectItem value="Modéré">Modéré</SelectItem>
              <SelectItem value="Mineur">Mineur</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm" style={{ color: COLORS.navy + "60" }}>
          {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
        </div>
      </div>

      {/* ===== TABLEAU ===== */}
      <Card className="border rounded-xl overflow-hidden" style={{ borderColor: COLORS.border }}>
        <CardHeader
          className="border-b"
          style={{ borderColor: COLORS.border + "99", backgroundColor: "#FCFBF8" }}
        >
          <CardTitle
            className="text-base font-semibold flex items-center gap-2"
            style={{ color: COLORS.navy, fontFamily: "'Playfair Display', serif" }}
          >
            <Target className="h-4 w-4" style={{ color: COLORS.forest }} />
            Synthèse des processus
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto p-0">
          <Table>
            <TableHeader>
              <TableRow style={{ backgroundColor: COLORS.cream }}>
                <TableHead className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: COLORS.navy + "60" }}>
                  Processus
                </TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: COLORS.navy + "60" }}>
                  Entité
                </TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: COLORS.navy + "60" }}>
                  Responsable
                </TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-center" style={{ color: COLORS.navy + "60" }}>
                  RTO
                </TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-center" style={{ color: COLORS.navy + "60" }}>
                  Ressources
                </TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-center" style={{ color: COLORS.navy + "60" }}>
                  Criticité
                </TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-center" style={{ color: COLORS.navy + "60" }}>
                  Statut
                </TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const critStyle = CRITICALITY_PASTEL[p.criticality] || CRITICALITY_PASTEL["Mineur"];
                return (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-[#FAF9F6] transition-colors"
                    onClick={() => setSelectedProcess(p)}
                  >
                    <TableCell className="py-3">
                      <p className="font-medium text-sm" style={{ color: COLORS.navy }}>{p.name}</p>
                      <p className="text-[10px]" style={{ color: COLORS.navy + "40" }}>
                        {p.id.slice(0, 8)} · {p.department || "—"}
                      </p>
                    </TableCell>
                    <TableCell className="py-3 text-sm" style={{ color: COLORS.navy + "80" }}>
                      {p.entityName}
                    </TableCell>
                    <TableCell className="py-3">
                      {p.owner ? (
                        <span className="text-sm" style={{ color: COLORS.navy }}>{p.owner}</span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded"
                          style={{ backgroundColor: "#FFEBEE", color: "#C62828" }}
                        >
                          <UserX className="h-2.5 w-2.5" />
                          Non assigné
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="py-3 text-center">
                      <span
                        className="text-sm font-mono font-semibold"
                        style={{ color: p.rtoIssue ? COLORS.danger : COLORS.navy }}
                      >
                        {p.rto}h
                      </span>
                    </TableCell>
                    <TableCell className="py-3 text-center">
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: p.resourceCount > 0 ? COLORS.forest + "15" : "#FFEBEE",
                          color: p.resourceCount > 0 ? COLORS.forest : COLORS.danger,
                        }}
                      >
                        <Link2 className="h-2.5 w-2.5" />
                        {p.resourceCount}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 text-center">
                      <Badge
                        className="text-[10px] border-0 font-semibold"
                        style={{ backgroundColor: critStyle.bg, color: critStyle.text }}
                      >
                        {p.criticality}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3 text-center">
                      <StatusBadge status={p.status} />
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[11px]"
                        style={{ color: COLORS.forest }}
                        onClick={(e) => { e.stopPropagation(); setSelectedProcess(p); }}
                      >
                        Détail
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10" style={{ color: COLORS.navy + "40" }}>
                    Aucun processus trouvé pour ces critères.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ===== MODAL DE DÉTAIL ===== */}
      {selectedProcess && (
        <ProcessDetailModal
          process={selectedProcess}
          entityName={selectedProcess.entityName}
          onClose={() => setSelectedProcess(null)}
        />
      )}
    </div>
  );
};