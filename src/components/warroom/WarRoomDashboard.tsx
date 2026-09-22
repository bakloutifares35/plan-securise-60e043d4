// src/components/warroom/WarRoomDashboard.tsx
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Clock, ChevronRight, ShieldAlert, Flame, Activity,
  CheckCircle2, ListChecks, Search, Building2, Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  COLORS, SEV_PASTEL, severityRank, elapsedSince, formatDateTime,
  getInitials, getAvatarColor,
  type Severite,
} from "./warroomHelpers";

type Incident = {
  id: string;
  type: string | null;
  titre: string;
  date_heure_debut: string;
  date_heure_fin: string | null;
  niveau_severite: Severite;
  statut: string;
  declarant: string | null;
  description: string | null;
};

type IncidentAction = {
  id: string;
  incident_id: string;
  description: string;
  statut: string;
};

// ============================================================
// KPI CARD — variantes de taille et fond alerte conditionnel
// ============================================================
const KpiCard = ({
  label, value, suffix, icon: Icon, iconColor, valueColor,
  hint, active, onClick, pulse, alertBg, emphasized,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  icon: any;
  iconColor: string;
  valueColor: string;
  hint?: string;
  active?: boolean;
  onClick?: () => void;
  pulse?: boolean;
  alertBg?: string;
  emphasized?: boolean;
}) => {
  const isAlert = !!alertBg;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-left rounded-xl p-4 transition-all duration-200 relative overflow-hidden border",
        onClick && "cursor-pointer hover:-translate-y-0.5 hover:shadow-md",
        active && "ring-2 ring-offset-2"
      )}
      style={{
        backgroundColor: isAlert ? alertBg : "#FFFFFF",
        borderColor: active ? valueColor : COLORS.border,
        ...(active ? { boxShadow: `0 0 0 3px ${valueColor}22` } : {}),
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: COLORS.navy + "80" }}
          >
            {label}
          </p>
          <p
            className={cn(
              "font-bold mt-1 flex items-baseline gap-1.5",
              emphasized ? "text-4xl" : "text-3xl"
            )}
            style={{ fontFamily: "'Playfair Display', serif", color: valueColor }}
          >
            {value}
            {suffix && <span className="text-base font-normal opacity-60">{suffix}</span>}
          </p>
          {hint && (
            <p className="text-[11px] mt-1 font-medium" style={{ color: COLORS.navy + "70" }}>
              {hint}
            </p>
          )}
        </div>
        <div
          className={cn(
            "rounded-lg flex items-center justify-center flex-shrink-0",
            emphasized ? "h-10 w-10" : "h-9 w-9",
            pulse && "animate-pulse"
          )}
          style={{ backgroundColor: iconColor + "15" }}
        >
          <Icon className={cn(emphasized ? "h-5 w-5" : "h-4 w-4")} style={{ color: iconColor }} />
        </div>
      </div>
      {active && (
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5"
          style={{ backgroundColor: valueColor }}
        />
      )}
    </button>
  );
};

// ============================================================
// AVATAR
// ============================================================
const Avatar = ({ name, size = 32 }: { name?: string | null; size?: number }) => {
  const color = getAvatarColor(name);
  return (
    <div
      className="rounded-full flex items-center justify-center font-semibold flex-shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: color.bg,
        color: color.text,
        fontSize: size * 0.38,
        fontFamily: "'Inter', sans-serif",
      }}
      title={name || ""}
    >
      {getInitials(name)}
    </div>
  );
};

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================
export const WarRoomDashboard = ({
  incidents,
  incidentProcessus,
  actions,
  onOpenIncident,
  onDeclare,
}: {
  incidents: Incident[];
  incidentProcessus: { incident_id: string; processus_id: string }[];
  actions?: IncidentAction[];
  onOpenIncident: (id: string) => void;
  onDeclare: () => void;
}) => {
  const [tab, setTab] = useState<"active" | "closed">("active");
  const [severityFilter, setSeverityFilter] = useState<"all" | Severite>("all");
  const [search, setSearch] = useState("");
  const [kpiFilter, setKpiFilter] = useState<"none" | "p1" | "actions" | "closed">("none");

  const procCountByIncident = useMemo(() => {
    const map: Record<string, number> = {};
    for (const ip of incidentProcessus) {
      map[ip.incident_id] = (map[ip.incident_id] || 0) + 1;
    }
    return map;
  }, [incidentProcessus]);

  const allActive = useMemo(
    () =>
      incidents
        .filter((i) => i.statut !== "Clôturé")
        .sort((a, b) => {
          const s = severityRank(a.niveau_severite) - severityRank(b.niveau_severite);
          if (s !== 0) return s;
          return new Date(b.date_heure_debut).getTime() - new Date(a.date_heure_debut).getTime();
        }),
    [incidents]
  );

  const allClosed = useMemo(
    () =>
      incidents
        .filter((i) => i.statut === "Clôturé")
        .sort((a, b) => new Date(b.date_heure_debut).getTime() - new Date(a.date_heure_debut).getTime()),
    [incidents]
  );

  const applyFilters = (list: Incident[]) => {
    let out = list;
    if (severityFilter !== "all") out = out.filter((i) => i.niveau_severite === severityFilter);
    const q = search.trim().toLowerCase();
    if (q) out = out.filter((i) => i.titre.toLowerCase().includes(q));
    if (kpiFilter === "p1") out = out.filter((i) => i.niveau_severite === "P1");
    if (kpiFilter === "closed") out = out.filter((i) => i.statut === "Clôturé");
    return out;
  };

  const displayedActive = applyFilters(allActive);
  const displayedClosed = applyFilters(allClosed);
  const displayed = tab === "active" ? displayedActive : displayedClosed;

  const kpi = useMemo(() => {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const p1Active = allActive.filter((i) => i.niveau_severite === "P1").length;
    const p2Active = allActive.filter((i) => i.niveau_severite === "P2").length;

    let avgDuration = 0;
    if (allActive.length > 0) {
      const total = allActive.reduce(
        (acc, i) => acc + (now - new Date(i.date_heure_debut).getTime()),
        0
      );
      avgDuration = total / allActive.length;
    }

    const actionsInProgress = (actions || []).filter(
      (a) => a.statut === "En cours" || a.statut === "À faire"
    ).length;

    const closed30d = allClosed.filter(
      (i) => new Date(i.date_heure_debut).getTime() >= thirtyDaysAgo
    ).length;

    const formatDuration = (ms: number): string => {
      if (ms <= 0) return "—";
      const min = Math.floor(ms / 60000);
      if (min < 60) return `${min}min`;
      const h = Math.floor(min / 60);
      if (h < 24) return `${h}h${String(min % 60).padStart(2, "0")}`;
      const d = Math.floor(h / 24);
      return `${d}j${h % 24}h`;
    };

    return {
      p1Active,
      p2Active,
      avgDurationLabel: avgDuration > 0 ? formatDuration(avgDuration) : "—",
      actionsInProgress,
      closed30d,
    };
  }, [allActive, allClosed, actions]);

  const lastClosed = allClosed[0];
  const daysSinceLastClosed = lastClosed
    ? Math.floor(
        (Date.now() - new Date(lastClosed.date_heure_fin || lastClosed.date_heure_debut).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  const toggleKpiFilter = (filter: "p1" | "actions" | "closed") => {
    setKpiFilter((prev) => (prev === filter ? "none" : filter));
    if (filter === "closed") setTab("closed");
    else setTab("active");
  };

  const hasP1 = kpi.p1Active > 0;

  return (
    <div className="space-y-5">
      {/* ===== HEADER ===== */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1
            className="text-2xl md:text-3xl font-bold flex items-center gap-3"
            style={{ color: COLORS.navy, fontFamily: "'Playfair Display', serif" }}
          >
            <span
              className="inline-flex items-center justify-center h-11 w-11 rounded-xl"
              style={{ backgroundColor: COLORS.danger + "15" }}
            >
              <ShieldAlert className="h-6 w-6" style={{ color: COLORS.danger }} />
            </span>
            War Room
          </h1>
          <p className="text-sm mt-1.5" style={{ color: COLORS.navy + "80" }}>
            Gestion opérationnelle des crises · {allActive.length} crise{allActive.length > 1 ? "s" : ""} active{allActive.length > 1 ? "s" : ""}
          </p>
        </div>

        <Button
          onClick={onDeclare}
          className="h-11 px-5 font-semibold text-white shadow-sm hover:opacity-95"
          style={{ backgroundColor: COLORS.danger }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Déclarer un incident
        </Button>
      </div>

      {/* ===== KPI ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* KPI 1 — Crises prioritaires */}
        <KpiCard
          label="Crises prioritaires"
          value={kpi.p1Active}
          suffix="P1"
          icon={Flame}
          iconColor={hasP1 ? COLORS.danger : COLORS.navy + "80"}
          valueColor={hasP1 ? COLORS.danger : COLORS.navy}
          hint={hasP1 ? "⚠ Action immédiate" : "Aucune urgence"}
          pulse={hasP1}
          alertBg={hasP1 ? "#FBE9E7" : undefined}
          emphasized={hasP1}
          active={kpiFilter === "p1"}
          onClick={() => toggleKpiFilter("p1")}
        />

        {/* KPI 2 — Durée moyenne */}
        <KpiCard
          label="Durée moyenne"
          value={kpi.avgDurationLabel}
          icon={Clock}
          iconColor="#5B7896"
          valueColor={COLORS.navy}
          hint={`${allActive.length} crise${allActive.length > 1 ? "s" : ""} en cours`}
        />

        {/* KPI 3 — Actions en cours */}
        <KpiCard
          label="Actions en cours"
          value={kpi.actionsInProgress}
          icon={ListChecks}
          iconColor="#EF9F27"
          valueColor={COLORS.navy}
          hint={kpi.actionsInProgress > 0 ? "À suivre" : "Aucune action"}
          active={kpiFilter === "actions"}
          onClick={() => toggleKpiFilter("actions")}
        />

        {/* KPI 4 — Clôturées */}
        <KpiCard
          label="Clôturées · 30 j"
          value={kpi.closed30d}
          icon={CheckCircle2}
          iconColor={COLORS.forest}
          valueColor={COLORS.navy}
          hint="Incidents résolus"
          active={kpiFilter === "closed"}
          onClick={() => toggleKpiFilter("closed")}
        />
      </div>

      {/* ===== ONGLETS + FILTRES ===== */}
      <div
        className="flex flex-col md:flex-row md:items-center gap-3 border-b"
        style={{ borderColor: COLORS.border }}
      >
        <div className="flex gap-1">
          <button
            onClick={() => { setTab("active"); setKpiFilter("none"); }}
            className="px-4 py-2.5 text-sm font-medium transition-colors relative"
            style={{
              color: tab === "active" ? COLORS.navy : COLORS.navy + "60",
              borderBottom:
                tab === "active" ? `2px solid ${COLORS.forest}` : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            <Activity className="h-4 w-4 inline-block mr-1.5 -mt-0.5" />
            Actives ({allActive.length})
          </button>
          <button
            onClick={() => { setTab("closed"); setKpiFilter("none"); }}
            className="px-4 py-2.5 text-sm font-medium transition-colors"
            style={{
              color: tab === "closed" ? COLORS.navy : COLORS.navy + "60",
              borderBottom:
                tab === "closed" ? `2px solid ${COLORS.forest}` : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            <CheckCircle2 className="h-4 w-4 inline-block mr-1.5 -mt-0.5" />
            Clôturées ({allClosed.length})
          </button>
        </div>

        <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pb-3 md:pb-0 md:justify-end">
          <div className="relative sm:w-56">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
              style={{ color: COLORS.navy + "60" }}
            />
            <Input
              placeholder="Rechercher un titre…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-9 text-sm bg-white"
              style={{ borderColor: COLORS.border }}
            />
          </div>
          <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as any)}>
            <SelectTrigger
              className="h-9 sm:w-44 text-sm bg-white"
              style={{ borderColor: COLORS.border }}
            >
              <Filter className="h-3.5 w-3.5 mr-1" style={{ color: COLORS.navy + "60" }} />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes sévérités</SelectItem>
              <SelectItem value="P1">P1 — Critique</SelectItem>
              <SelectItem value="P2">P2 — Sévère</SelectItem>
              <SelectItem value="P3">P3 — Majeur</SelectItem>
              <SelectItem value="P4">P4 — Modéré</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ===== LISTE ===== */}
      <div className="space-y-2.5">
        {displayed.length === 0 ? (
          tab === "active" ? (
            <Card style={{ backgroundColor: "#FFFFFF", borderColor: COLORS.border }}>
              <CardContent className="p-10 text-center">
                <div
                  className="inline-flex items-center justify-center h-16 w-16 rounded-full mb-4"
                  style={{ backgroundColor: "#E8F5E9" }}
                >
                  <CheckCircle2 className="h-8 w-8" style={{ color: COLORS.forest }} />
                </div>
                <p className="font-semibold text-lg" style={{ color: COLORS.navy }}>
                  Aucune crise active en ce moment
                </p>
                <p className="text-sm mt-1.5 max-w-md mx-auto" style={{ color: COLORS.navy + "80" }}>
                  Votre dispositif est au repos. Utilisez le bouton rouge ci-dessus en cas de nouvel incident.
                </p>
                {(lastClosed || kpi.actionsInProgress > 0) && (
                  <div
                    className="mt-6 pt-6 border-t flex flex-col sm:flex-row gap-6 justify-center items-start sm:items-center text-left"
                    style={{ borderColor: COLORS.border }}
                  >
                    {lastClosed && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: COLORS.navy + "60" }}>
                          Dernier incident
                        </p>
                        <p className="mt-1 text-sm font-medium" style={{ color: COLORS.navy }}>
                          {lastClosed.titre}
                        </p>
                        <p className="mt-0.5 text-xs" style={{ color: COLORS.navy + "70" }}>
                          Clôturé il y a {daysSinceLastClosed} jour{daysSinceLastClosed !== 1 ? "s" : ""}
                        </p>
                      </div>
                    )}
                    {kpi.actionsInProgress > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: COLORS.navy + "60" }}>
                          Suivi en cours
                        </p>
                        <p className="mt-1 text-sm font-medium" style={{ color: COLORS.navy }}>
                          {kpi.actionsInProgress} action{kpi.actionsInProgress > 1 ? "s" : ""} corrective{kpi.actionsInProgress > 1 ? "s" : ""}
                        </p>
                        <p className="mt-0.5 text-xs" style={{ color: COLORS.navy + "70" }}>
                          Issue{kpi.actionsInProgress > 1 ? "s" : ""} des RETEX
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card style={{ backgroundColor: "#FFFFFF", borderColor: COLORS.border }}>
              <CardContent className="p-8 text-center">
                <p className="text-sm" style={{ color: COLORS.navy + "70" }}>
                  Aucun incident clôturé
                  {search || severityFilter !== "all" ? " ne correspond aux filtres" : " pour le moment"}.
                </p>
              </CardContent>
            </Card>
          )
        ) : tab === "active" ? (
          displayed.map((inc) => {
            const sev = SEV_PASTEL[inc.niveau_severite];
            const processCount = procCountByIncident[inc.id] || 0;
            const isP1 = inc.niveau_severite === "P1";
            return (
              <div
                key={inc.id}
                onClick={() => onOpenIncident(inc.id)}
                className={cn(
                  "rounded-xl transition-all cursor-pointer hover:shadow-md bg-white",
                  isP1 ? "border-2" : "border"
                )}
                style={{
                  borderColor: isP1 ? COLORS.danger + "55" : COLORS.border,
                  boxShadow: isP1 ? `0 1px 3px ${COLORS.danger}18` : "0 1px 2px rgba(23,32,48,0.04)",
                }}
              >
                <div className="flex flex-col md:flex-row md:items-center gap-3 px-4 py-3">
                  {/* Badge sévérité + indicateur d'état */}
                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    <span
                      className="inline-flex items-center justify-center h-10 w-10 rounded-lg font-bold text-[12px]"
                      style={{ backgroundColor: sev.bg, color: sev.text }}
                    >
                      {inc.niveau_severite}
                    </span>
                    {isP1 && (
                      <span
                        className="inline-flex items-center gap-1 text-white text-[9.5px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
                        style={{ backgroundColor: COLORS.danger }}
                      >
                        <ShieldAlert className="h-2.5 w-2.5" />
                        Alerte
                      </span>
                    )}
                  </div>

                  {/* Avatar */}
                  <Avatar name={inc.declarant} size={34} />

                  {/* Contenu */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[14px] leading-tight truncate" style={{ color: COLORS.navy }}>
                        {inc.titre}
                      </span>
                      {inc.type && (
                        <span
                          className="text-[9.5px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wider"
                          style={{ backgroundColor: COLORS.cream, color: COLORS.navy + "80" }}
                        >
                          {inc.type}
                        </span>
                      )}
                      <span
                        className="text-[9.5px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wider"
                        style={{ backgroundColor: sev.bg, color: sev.text }}
                      >
                        {inc.statut}
                      </span>
                    </div>

                    <div className="flex items-center gap-3.5 mt-1.5 text-[11px] flex-wrap" style={{ color: COLORS.navy + "70" }}>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Il y a {elapsedSince(inc.date_heure_debut)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {processCount} processus
                      </span>
                      {inc.declarant && (
                        <span className="hidden md:inline">· Par {inc.declarant}</span>
                      )}
                    </div>
                  </div>

                  {/* Bouton */}
                  <Button
                    onClick={(e) => { e.stopPropagation(); onOpenIncident(inc.id); }}
                    className="h-9 px-4 font-semibold flex-shrink-0 text-white shadow-sm"
                    style={{ backgroundColor: isP1 ? COLORS.danger : COLORS.forest }}
                  >
                    Ouvrir la war room
                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            );
          })
        ) : (
          <div
            className="rounded-xl border divide-y overflow-hidden bg-white"
            style={{ borderColor: COLORS.border }}
          >
            {displayed.map((inc) => {
              const sev = SEV_PASTEL[inc.niveau_severite];
              return (
                <button
                  key={inc.id}
                  onClick={() => onOpenIncident(inc.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#FAFAF9] transition-colors"
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: sev.dot }} />
                  <Avatar name={inc.declarant} size={30} />
                  <span className="flex-1 text-sm font-medium truncate" style={{ color: COLORS.navy }}>
                    {inc.titre}
                  </span>
                  <span className="text-xs hidden md:inline" style={{ color: COLORS.navy + "70" }}>
                    {formatDateTime(inc.date_heure_debut)}
                  </span>
                  <Badge className="text-[10px] border-0" style={{ backgroundColor: sev.bg, color: sev.text }}>
                    {inc.niveau_severite}
                  </Badge>
                  <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" style={{ color: COLORS.navy + "40" }} />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default WarRoomDashboard;