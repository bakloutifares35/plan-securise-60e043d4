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
// RADAR DE VIGILANCE — vert forêt par défaut, rouge uniquement si P1 active
// ============================================================
const RADAR_LEVELS: Severite[] = ["P1", "P2", "P3", "P4"];

const RadarVigilance = ({
  activeIncidents,
  p1Active,
}: {
  activeIncidents: Incident[];
  p1Active: number;
}) => {
  const SIZE = 260;
  const CENTER = SIZE / 2;
  const RING_RADII: Record<Severite, number> = {
    P1: 42,
    P2: 70,
    P3: 96,
    P4: 120,
  };

  const hasP1 = p1Active > 0;
  const totalActive = activeIncidents.length;
  const isCalm = totalActive === 0;

  const sweepDuration = hasP1 ? "2s" : "4s";
  // Couleur d'accent du balayage : rouge UNIQUEMENT si P1 active
  const sweepColor = hasP1 ? COLORS.danger : COLORS.forest;

  const bySeverity = useMemo(() => {
    const map: Record<Severite, Incident[]> = { P1: [], P2: [], P3: [], P4: [] };
    for (const inc of activeIncidents) {
      map[inc.niveau_severite]?.push(inc);
    }
    return map;
  }, [activeIncidents]);

  const blips = useMemo(() => {
    const out: { x: number; y: number; color: string; glow: string; delay: number; key: string }[] = [];
    for (const level of RADAR_LEVELS) {
      const list = bySeverity[level];
      if (!list.length) continue;
      const r = RING_RADII[level];
      const sev = SEV_PASTEL[level];
      list.forEach((inc, i) => {
        const angle = (2 * Math.PI * i) / list.length - Math.PI / 2;
        const jitter = list.length > 1 ? 1 : 0;
        const rr = r + (jitter ? (i % 2 === 0 ? 6 : -6) : 0);
        const x = CENTER + rr * Math.cos(angle);
        const y = CENTER + rr * Math.sin(angle);
        out.push({
          x,
          y,
          color: sev.dot,
          glow: sev.dot + "66",
          delay: i * 0.25,
          key: `${level}-${inc.id}`,
        });
      });
    }
    return out;
  }, [bySeverity]);

  const ringColor = (level: Severite) => {
    if (isCalm) return COLORS.forest + "0E";
    const sev = SEV_PASTEL[level];
    return sev.dot + "10";
  };

  return (
    <div className="relative flex items-center justify-center">
      <style>{`
        @keyframes wr-radar-sweep {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes wr-radar-blip {
          0%, 100% { opacity: 0.55; transform: scale(0.9); }
          50%      { opacity: 1;    transform: scale(1.25); }
        }
        @keyframes wr-radar-breathe {
          0%, 100% { opacity: 0.35; }
          50%      { opacity: 0.7; }
        }
        .wr-radar-sweep {
          transform-origin: ${CENTER}px ${CENTER}px;
          animation: wr-radar-sweep var(--sweep-duration, 4s) linear infinite;
        }
        .wr-radar-blip {
          transform-origin: center;
          animation: wr-radar-blip 2.4s ease-in-out infinite;
        }
        .wr-radar-breathe {
          animation: wr-radar-breathe 3s ease-in-out infinite;
        }
      `}</style>

      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="block"
        style={{ maxWidth: "100%", height: "auto" }}
      >
        <defs>
          <linearGradient id="wr-sweep-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={sweepColor} stopOpacity={hasP1 ? 0.35 : 0.20} />
            <stop offset="100%" stopColor={sweepColor} stopOpacity="0" />
          </linearGradient>

          <radialGradient id="wr-center-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={sweepColor} stopOpacity={hasP1 ? 0.16 : 0.10} />
            <stop offset="100%" stopColor={sweepColor} stopOpacity="0" />
          </radialGradient>

          <clipPath id="wr-radar-clip">
            <circle cx={CENTER} cy={CENTER} r={RING_RADII.P4 + 2} />
          </clipPath>
        </defs>

        {/* Disque extérieur — crème neutre */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RING_RADII.P4 + 2}
          fill={COLORS.cream}
          opacity={isCalm ? 0.6 : 0.9}
        />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RING_RADII.P4 + 2}
          fill="none"
          stroke={COLORS.border}
          strokeWidth={1}
        />

        {/* Halo central respirant — vert forêt par défaut, rouge si P1 active */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RING_RADII.P4}
          fill="url(#wr-center-halo)"
          className="wr-radar-breathe"
        />

        {/* Anneaux : teintes SEV_PASTEL propres à chaque niveau */}
        {[...RADAR_LEVELS].reverse().map((level) => (
          <circle
            key={level}
            cx={CENTER}
            cy={CENTER}
            r={RING_RADII[level]}
            fill={ringColor(level)}
            stroke={COLORS.border}
            strokeWidth={0.8}
            strokeDasharray="2 3"
            opacity={0.85}
          />
        ))}

        {/* Croix cardinales */}
        <line
          x1={CENTER}
          y1={CENTER - RING_RADII.P4}
          x2={CENTER}
          y2={CENTER + RING_RADII.P4}
          stroke={COLORS.border}
          strokeWidth={0.6}
          opacity={0.6}
        />
        <line
          x1={CENTER - RING_RADII.P4}
          y1={CENTER}
          x2={CENTER + RING_RADII.P4}
          y2={CENTER}
          stroke={COLORS.border}
          strokeWidth={0.6}
          opacity={0.6}
        />

        {/* Secteur de balayage */}
        <g clipPath="url(#wr-radar-clip)">
          <g
            className="wr-radar-sweep"
            style={{ "--sweep-duration": sweepDuration } as React.CSSProperties}
          >
            <path
              d={`M ${CENTER} ${CENTER}
                  L ${CENTER + RING_RADII.P4 + 4} ${CENTER}
                  A ${RING_RADII.P4 + 4} ${RING_RADII.P4 + 4} 0 0 0
                    ${CENTER + (RING_RADII.P4 + 4) * Math.cos(-Math.PI / 4)}
                    ${CENTER + (RING_RADII.P4 + 4) * Math.sin(-Math.PI / 4)}
                  Z`}
              fill="url(#wr-sweep-grad)"
            />
            <line
              x1={CENTER}
              y1={CENTER}
              x2={CENTER + RING_RADII.P4 + 4}
              y2={CENTER}
              stroke={sweepColor}
              strokeWidth={1.4}
              opacity={hasP1 ? 0.7 : 0.45}
            />
          </g>
        </g>

        {/* Blips par sévérité */}
        {blips.map((b) => (
          <g key={b.key}>
            <circle
              cx={b.x}
              cy={b.y}
              r={3}
              fill={b.color}
              className="wr-radar-blip"
              style={{
                filter: `drop-shadow(0 0 4px ${b.glow})`,
                animationDelay: `${b.delay}s`,
              }}
            />
            <circle
              cx={b.x}
              cy={b.y}
              r={6}
              fill="none"
              stroke={b.color}
              strokeWidth={1}
              opacity={0.35}
              className="wr-radar-blip"
              style={{ animationDelay: `${b.delay}s` }}
            />
          </g>
        ))}

        {/* Chiffre central : navy par défaut, rouge seulement si P1 active */}
        <text
          x={CENTER}
          y={CENTER + 6}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontFamily: "'Playfair Display', serif",
            fontWeight: 700,
            fontSize: totalActive >= 10 ? 44 : 52,
            fill: hasP1 ? COLORS.danger : COLORS.navy,
          }}
        >
          {totalActive}
        </text>
        <text
          x={CENTER}
          y={CENTER + 30}
          textAnchor="middle"
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fill: COLORS.navy + "80",
          }}
        >
          crise{totalActive > 1 ? "s" : ""} active{totalActive > 1 ? "s" : ""}
        </text>

        {/* Légende P1-P4 */}
        {RADAR_LEVELS.map((level) => {
          const r = RING_RADII[level];
          const angle = -Math.PI / 4;
          const x = CENTER + (r + 6) * Math.cos(angle);
          const y = CENTER + (r + 6) * Math.sin(angle);
          return (
            <text
              key={level}
              x={x}
              y={y}
              fontSize="8"
              fontWeight="700"
              fill={SEV_PASTEL[level].text}
              opacity={0.75}
              textAnchor="middle"
            >
              {level}
            </text>
          );
        })}
      </svg>
    </div>
  );
};

// ============================================================
// KPI COMPACT
// ============================================================
const KpiPill = ({
  label, value, suffix, icon: Icon, iconColor, valueColor,
  hint, active, onClick, pulse, alertBg,
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
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 border text-left w-full",
        onClick && "cursor-pointer hover:-translate-y-0.5 hover:shadow-md"
      )}
      style={{
        backgroundColor: alertBg ? alertBg : "#FFFFFF",
        borderColor: active ? valueColor : COLORS.border,
        boxShadow: active ? `0 0 0 3px ${valueColor}22` : "0 1px 2px rgba(23,32,48,0.04)",
      }}
    >
      <div
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0",
          pulse && "animate-pulse"
        )}
        style={{ backgroundColor: iconColor + "15" }}
      >
        <Icon className="h-4 w-4" style={{ color: iconColor }} />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="text-[9.5px] font-semibold uppercase tracking-wider truncate"
          style={{ color: COLORS.navy + "70" }}
        >
          {label}
        </p>
        <p
          className="font-bold leading-tight flex items-baseline gap-1"
          style={{
            fontFamily: "'Playfair Display', serif",
            color: valueColor,
            fontSize: 20,
          }}
        >
          {value}
          {suffix && <span className="text-[11px] font-normal opacity-60">{suffix}</span>}
        </p>
      </div>
      {hint && (
        <span
          className="hidden md:inline text-[10px] font-medium flex-shrink-0"
          style={{ color: COLORS.navy + "60" }}
        >
          {hint}
        </span>
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
              className="inline-flex items-center justify-center h-11 w-11 rounded-xl transition-colors duration-300"
              style={{
                backgroundColor: hasP1 ? COLORS.danger + "15" : COLORS.forest + "15",
              }}
            >
              <ShieldAlert
                className="h-6 w-6 transition-colors duration-300"
                style={{ color: hasP1 ? COLORS.danger : COLORS.forest }}
              />
            </span>
            War Room
          </h1>
          <p className="text-sm mt-1.5" style={{ color: COLORS.navy + "80" }}>
            Gestion opérationnelle des crises · {allActive.length} crise{allActive.length > 1 ? "s" : ""} active{allActive.length > 1 ? "s" : ""}
          </p>
        </div>

        {/* Bouton principal en vert forêt (couleur signature) */}
        <Button
          onClick={onDeclare}
          className="h-11 px-5 font-semibold text-white shadow-sm hover:opacity-95 transition-opacity"
          style={{ backgroundColor: COLORS.forest }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Déclarer un incident
        </Button>
      </div>

      {/* ===== RADAR + KPI ===== */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          backgroundColor: "#FFFFFF",
          border: `1px solid ${COLORS.border}`,
          boxShadow: "0 1px 3px rgba(23,32,48,0.05)",
        }}
      >
        <div className="p-5 md:p-6">
          <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-8">
            <div className="flex-shrink-0 flex flex-col items-center">
              <RadarVigilance
                activeIncidents={allActive}
                p1Active={kpi.p1Active}
              />
              <p
                className="text-[10px] uppercase tracking-wider font-semibold mt-3"
                style={{ color: COLORS.navy + "60" }}
              >
                Radar de vigilance
              </p>
            </div>

            <div className="flex-1 w-full min-w-0 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* KPI P1 : rouge uniquement si hasP1 */}
                <KpiPill
                  label="Crises prioritaires"
                  value={kpi.p1Active}
                  suffix="P1"
                  icon={Flame}
                  iconColor={hasP1 ? COLORS.danger : COLORS.navy + "80"}
                  valueColor={hasP1 ? COLORS.danger : COLORS.navy}
                  hint={hasP1 ? "Action immédiate" : "Aucune urgence"}
                  pulse={hasP1}
                  alertBg={hasP1 ? "#FBE9E7" : undefined}
                  active={kpiFilter === "p1"}
                  onClick={() => toggleKpiFilter("p1")}
                />
                <KpiPill
                  label="Durée moyenne"
                  value={kpi.avgDurationLabel}
                  icon={Clock}
                  iconColor="#5B7896"
                  valueColor={COLORS.navy}
                  hint={`${allActive.length} en cours`}
                />
                <KpiPill
                  label="Actions en cours"
                  value={kpi.actionsInProgress}
                  icon={ListChecks}
                  iconColor="#EF9F27"
                  valueColor={COLORS.navy}
                  hint={kpi.actionsInProgress > 0 ? "À suivre" : "Aucune"}
                  active={kpiFilter === "actions"}
                  onClick={() => toggleKpiFilter("actions")}
                />
                <KpiPill
                  label="Clôturées · 30 j"
                  value={kpi.closed30d}
                  icon={CheckCircle2}
                  iconColor={COLORS.forest}
                  valueColor={COLORS.navy}
                  hint="Résolues"
                  active={kpiFilter === "closed"}
                  onClick={() => toggleKpiFilter("closed")}
                />
              </div>

              {/* Légende P1-P4 */}
              <div className="flex items-center gap-3 flex-wrap pt-2">
                {(["P1", "P2", "P3", "P4"] as Severite[]).map((level) => {
                  const sev = SEV_PASTEL[level];
                  const count = allActive.filter((i) => i.niveau_severite === level).length;
                  return (
                    <span
                      key={level}
                      className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: count > 0 ? sev.bg : COLORS.cream,
                        color: count > 0 ? sev.text : COLORS.navy + "50",
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: count > 0 ? sev.dot : COLORS.border }}
                      />
                      {level}
                      <span className="font-bold tabular-nums">{count}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
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
            <Activity
              className="h-4 w-4 inline-block mr-1.5 -mt-0.5"
              style={{ color: tab === "active" ? COLORS.forest : "inherit" }}
            />
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
            <CheckCircle2
              className="h-4 w-4 inline-block mr-1.5 -mt-0.5"
              style={{ color: tab === "closed" ? COLORS.forest : "inherit" }}
            />
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
                  Votre dispositif est au repos. Utilisez le bouton ci-dessus en cas de nouvel incident.
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
                  "rounded-xl transition-all cursor-pointer hover:shadow-md bg-white relative overflow-hidden",
                  isP1 ? "border-2" : "border"
                )}
                style={{
                  borderColor: isP1 ? COLORS.danger + "55" : COLORS.border,
                  boxShadow: isP1
                    ? `0 1px 3px ${COLORS.danger}18`
                    : "0 1px 2px rgba(23,32,48,0.04)",
                }}
              >
                {/* Liseré gauche : couleur de la sévérité réelle (pas rouge systématique) */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1"
                  style={{ backgroundColor: sev.dot, opacity: 0.9 }}
                />
                <div className="flex flex-col md:flex-row md:items-center gap-3 px-4 py-3">
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

                  <Avatar name={inc.declarant} size={34} />

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

                  {/* Bouton vert forêt sauf pour P1 (rouge justifié) */}
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