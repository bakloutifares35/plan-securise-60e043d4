// src/components/warroom/WarRoomDashboard.tsx
// ⚠️ EXCEPTION URGENCE ASSUMÉE : le rouge d'urgence #E24B4A n'est utilisé
// QUE pour : bouton "Déclarer un incident", badge ALERTE P1.
// Toute la palette du reste respecte la charte Resillia sobre et pastel.
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Clock, ChevronRight, ShieldAlert,
  Flame, Activity, CheckCircle2, ListChecks, Search, Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  RESILLIA, SEVERITES,
  elapsedSince, formatDateTime,
  type Incident, type Severite, type ProcessLite, type IncidentAction,
} from "./types";

const severityRank = (s: Severite): number =>
  s === "P1" ? 0 : s === "P2" ? 1 : s === "P3" ? 2 : 3;

// Teintes pastel par sévérité
const SEV_PASTEL: Record<Severite, { bg: string; border: string; text: string; dot: string }> = {
  P1: { bg: "#FBE9E7", border: "#F5C6C2", text: "#B83A39", dot: "#E24B4A" },
  P2: { bg: "#FFF3E0", border: "#FFD9B0", text: "#B76E1D", dot: "#EF9F27" },
  P3: { bg: "#FFF8E1", border: "#FCE9A8", text: "#A18530", dot: "#F5D061" },
  P4: { bg: "#E8F5E9", border: "#C8E6C9", text: "#4B7718", dot: "#639922" },
};

// ✅ Palette des 4 KPI (chacun sa couleur pastel)
const KPI_STYLE = {
  priority: { bg: "#FBE9E7", iconBg: "#F5C6C2", iconColor: "#B83A39", accent: "#E24B4A" },
  duration: { bg: "#EDF2F7", iconBg: "#D6E0EA", iconColor: "#38536F", accent: "#5B7896" },
  actions:  { bg: "#FFF3E0", iconBg: "#FFE0B2", iconColor: "#B76E1D", accent: "#EF9F27" },
  closed:   { bg: "#E8F5E9", iconBg: "#C8E6C9", iconColor: "#4B7718", accent: "#639922" },
};

export const WarRoomDashboard = ({
  incidents,
  processus,
  incidentProcessus,
  actions,
  onOpenIncident,
  onDeclare,
}: {
  incidents: Incident[];
  processus: ProcessLite[];
  incidentProcessus: { incident_id: string; processus_id: string }[];
  actions?: IncidentAction[];
  onOpenIncident: (id: string) => void;
  onDeclare: () => void;
}) => {
  const [tab, setTab] = useState<"active" | "closed">("active");
  const [severityFilter, setSeverityFilter] = useState<"all" | Severite>("all");
  const [search, setSearch] = useState("");

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

  return (
    <div className="space-y-6">
      {/* ===== HEADER ===== */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1
            className="text-2xl md:text-3xl font-bold flex items-center gap-3"
            style={{ color: RESILLIA.navy, fontFamily: "'Playfair Display', serif" }}
          >
            <span
              className="inline-flex items-center justify-center h-11 w-11 rounded-xl"
              style={{ backgroundColor: RESILLIA.urgence + "15" }}
            >
              <ShieldAlert className="h-6 w-6" style={{ color: RESILLIA.urgence }} />
            </span>
            War Room
          </h1>
          <p className="text-sm mt-1.5" style={{ color: RESILLIA.navy + "80" }}>
            Gestion opérationnelle des crises · {allActive.length} crise{allActive.length > 1 ? "s" : ""} active{allActive.length > 1 ? "s" : ""}
          </p>
        </div>

        {/* ⚠️ EXCEPTION URGENCE : seule action rouge du dashboard */}
        <Button
          onClick={onDeclare}
          className="h-11 px-5 font-semibold text-white shadow-sm hover:opacity-95"
          style={{ backgroundColor: RESILLIA.urgence }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Déclarer un incident
        </Button>
      </div>

      {/* ===== KPI CHIFFRÉS — chaque carte a sa couleur pastel ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* KPI 1 : Crises prioritaires — pastel rouge */}
        <Card
          className="border-0 shadow-sm"
          style={{ backgroundColor: KPI_STYLE.priority.bg }}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: KPI_STYLE.priority.iconColor + "CC" }}
                >
                  Crises prioritaires
                </p>
                <p
                  className="text-3xl font-bold mt-1"
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    color: KPI_STYLE.priority.iconColor,
                  }}
                >
                  {kpi.p1Active}
                  <span className="text-base font-normal ml-2 opacity-70">P1</span>
                </p>
                {kpi.p2Active > 0 && (
                  <p className="text-[11px] mt-0.5 font-medium" style={{ color: SEV_PASTEL.P2.text }}>
                    + {kpi.p2Active} P2 en cours
                  </p>
                )}
              </div>
              <div
                className={cn(
                  "h-9 w-9 rounded-lg flex items-center justify-center",
                  kpi.p1Active > 0 && "animate-pulse"
                )}
                style={{ backgroundColor: KPI_STYLE.priority.iconBg }}
              >
                <Flame className="h-4 w-4" style={{ color: KPI_STYLE.priority.iconColor }} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI 2 : Durée moyenne — pastel bleu-gris */}
        <Card
          className="border-0 shadow-sm"
          style={{ backgroundColor: KPI_STYLE.duration.bg }}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: KPI_STYLE.duration.iconColor + "CC" }}
                >
                  Durée moyenne
                </p>
                <p
                  className="text-3xl font-bold mt-1"
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    color: KPI_STYLE.duration.iconColor,
                  }}
                >
                  {kpi.avgDurationLabel}
                </p>
                <p className="text-[11px] mt-0.5 font-medium" style={{ color: KPI_STYLE.duration.iconColor + "AA" }}>
                  crises en cours
                </p>
              </div>
              <div
                className="h-9 w-9 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: KPI_STYLE.duration.iconBg }}
              >
                <Clock className="h-4 w-4" style={{ color: KPI_STYLE.duration.iconColor }} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI 3 : Actions en cours — pastel orange */}
        <Card
          className="border-0 shadow-sm"
          style={{ backgroundColor: KPI_STYLE.actions.bg }}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: KPI_STYLE.actions.iconColor + "CC" }}
                >
                  Actions en cours
                </p>
                <p
                  className="text-3xl font-bold mt-1"
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    color: KPI_STYLE.actions.iconColor,
                  }}
                >
                  {kpi.actionsInProgress}
                </p>
                <p className="text-[11px] mt-0.5 font-medium" style={{ color: KPI_STYLE.actions.iconColor + "AA" }}>
                  à suivre
                </p>
              </div>
              <div
                className="h-9 w-9 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: KPI_STYLE.actions.iconBg }}
              >
                <ListChecks className="h-4 w-4" style={{ color: KPI_STYLE.actions.iconColor }} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI 4 : Clôturées — pastel vert */}
        <Card
          className="border-0 shadow-sm"
          style={{ backgroundColor: KPI_STYLE.closed.bg }}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: KPI_STYLE.closed.iconColor + "CC" }}
                >
                  Clôturées · 30 j
                </p>
                <p
                  className="text-3xl font-bold mt-1"
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    color: KPI_STYLE.closed.iconColor,
                  }}
                >
                  {kpi.closed30d}
                </p>
                <p className="text-[11px] mt-0.5 font-medium" style={{ color: KPI_STYLE.closed.iconColor + "AA" }}>
                  incidents résolus
                </p>
              </div>
              <div
                className="h-9 w-9 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: KPI_STYLE.closed.iconBg }}
              >
                <CheckCircle2 className="h-4 w-4" style={{ color: KPI_STYLE.closed.iconColor }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== ONGLETS + FILTRES ===== */}
      <div
        className="flex flex-col md:flex-row md:items-center gap-3 border-b"
        style={{ borderColor: RESILLIA.border }}
      >
        <div className="flex gap-1">
          <button
            onClick={() => setTab("active")}
            className="px-4 py-2.5 text-sm font-medium transition-colors relative"
            style={{
              color: tab === "active" ? RESILLIA.navy : RESILLIA.navy + "60",
              borderBottom:
                tab === "active" ? `2px solid ${RESILLIA.forest}` : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            <Activity className="h-4 w-4 inline-block mr-1.5 -mt-0.5" />
            Actives ({allActive.length})
          </button>
          <button
            onClick={() => setTab("closed")}
            className="px-4 py-2.5 text-sm font-medium transition-colors"
            style={{
              color: tab === "closed" ? RESILLIA.navy : RESILLIA.navy + "60",
              borderBottom:
                tab === "closed" ? `2px solid ${RESILLIA.forest}` : "2px solid transparent",
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
              style={{ color: RESILLIA.navy + "60" }}
            />
            <Input
              placeholder="Rechercher un titre…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-9 text-sm bg-white"
              style={{ borderColor: RESILLIA.border }}
            />
          </div>
          <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as any)}>
            <SelectTrigger
              className="h-9 sm:w-40 text-sm bg-white"
              style={{ borderColor: RESILLIA.border }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes sévérités</SelectItem>
              {SEVERITES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ===== LISTE ===== */}
      <div className="space-y-3">
        {displayed.length === 0 ? (
          tab === "active" ? (
            /* ===== ÉTAT VIDE ENRICHI ===== */
            <Card style={{ backgroundColor: "#FFFFFF", borderColor: RESILLIA.border }}>
              <CardContent className="p-10 text-center">
                <div
                  className="inline-flex items-center justify-center h-16 w-16 rounded-full mb-4"
                  style={{ backgroundColor: SEV_PASTEL.P4.bg }}
                >
                  <CheckCircle2 className="h-8 w-8" style={{ color: SEV_PASTEL.P4.dot }} />
                </div>
                <p className="font-semibold text-lg" style={{ color: RESILLIA.navy }}>
                  Aucune crise active en ce moment
                </p>
                <p className="text-sm mt-1.5 max-w-md mx-auto" style={{ color: RESILLIA.navy + "80" }}>
                  Votre dispositif est au repos. Utilisez le bouton rouge ci-dessus en cas de
                  nouvel incident.
                </p>

                {(lastClosed || kpi.actionsInProgress > 0) && (
                  <div
                    className="mt-6 pt-6 border-t flex flex-col sm:flex-row gap-6 justify-center items-start sm:items-center text-left"
                    style={{ borderColor: RESILLIA.border }}
                  >
                    {lastClosed && (
                      <div>
                        <p
                          className="text-[10px] font-semibold uppercase tracking-wider"
                          style={{ color: RESILLIA.navy + "60" }}
                        >
                          Dernier incident
                        </p>
                        <p className="mt-1 text-sm font-medium" style={{ color: RESILLIA.navy }}>
                          {lastClosed.titre}
                        </p>
                        <p className="mt-0.5 text-xs" style={{ color: RESILLIA.navy + "70" }}>
                          Clôturé il y a {daysSinceLastClosed} jour
                          {daysSinceLastClosed !== 1 ? "s" : ""}
                        </p>
                      </div>
                    )}
                    {kpi.actionsInProgress > 0 && (
                      <div>
                        <p
                          className="text-[10px] font-semibold uppercase tracking-wider"
                          style={{ color: RESILLIA.navy + "60" }}
                        >
                          Suivi en cours
                        </p>
                        <p className="mt-1 text-sm font-medium" style={{ color: RESILLIA.navy }}>
                          {kpi.actionsInProgress} action{kpi.actionsInProgress > 1 ? "s" : ""}{" "}
                          corrective{kpi.actionsInProgress > 1 ? "s" : ""}
                        </p>
                        <p className="mt-0.5 text-xs" style={{ color: RESILLIA.navy + "70" }}>
                          Issue{kpi.actionsInProgress > 1 ? "s" : ""} des RETEX
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card style={{ backgroundColor: "#FFFFFF", borderColor: RESILLIA.border }}>
              <CardContent className="p-8 text-center">
                <p className="text-sm" style={{ color: RESILLIA.navy + "70" }}>
                  Aucun incident clôturé{" "}
                  {search || severityFilter !== "all" ? "ne correspond aux filtres" : "pour le moment"}.
                </p>
              </CardContent>
            </Card>
          )
        ) : tab === "active" ? (
          /* ===== CARTES ACTIVES — sans bordure gauche ===== */
          displayed.map((inc) => {
            const sev = SEV_PASTEL[inc.niveau_severite];
            const processCount = procCountByIncident[inc.id] || 0;
            const isP1 = inc.niveau_severite === "P1";
            return (
              <div
                key={inc.id}
                className={cn(
                  "rounded-xl transition-all hover:shadow-md flex flex-col md:flex-row md:items-center gap-4 p-4 border",
                  isP1 && "ring-2 ring-offset-1"
                )}
                style={{
                  backgroundColor: "#FFFFFF",
                  borderColor: sev.border,
                  ...(isP1 ? { boxShadow: `0 0 0 3px ${RESILLIA.urgence}22` } : {}),
                }}
              >
                {/* Badge sévérité pastel */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span
                    className="inline-flex items-center justify-center h-12 w-12 rounded-xl font-bold text-sm"
                    style={{ backgroundColor: sev.bg, color: sev.text }}
                  >
                    {inc.niveau_severite}
                  </span>
                  {isP1 && (
                    <Badge
                      className="animate-pulse text-white border-0 text-[10px] font-bold tracking-wide"
                      style={{ backgroundColor: RESILLIA.urgence }}
                    >
                      ⚠ ALERTE
                    </Badge>
                  )}
                </div>

                {/* Infos */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-base truncate" style={{ color: RESILLIA.navy }}>
                      {inc.titre}
                    </span>
                    {inc.type && (
                      <span
                        className="text-[10px] font-medium px-2 py-0.5 rounded-md"
                        style={{ backgroundColor: RESILLIA.cream, color: RESILLIA.navy + "AA" }}
                      >
                        {inc.type}
                      </span>
                    )}
                    <span
                      className="text-[10px] font-medium px-2 py-0.5 rounded-md"
                      style={{ backgroundColor: RESILLIA.cream, color: RESILLIA.navy + "AA" }}
                    >
                      {inc.statut}
                    </span>
                  </div>

                  <div
                    className="flex items-center gap-4 mt-2 text-xs flex-wrap"
                    style={{ color: RESILLIA.navy + "70" }}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      Déclaré il y a {elapsedSince(inc.date_heure_debut)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5" />
                      {processCount} processus impacté{processCount > 1 ? "s" : ""}
                    </span>
                    {inc.declarant && (
                      <span className="hidden md:inline">Par {inc.declarant}</span>
                    )}
                  </div>
                </div>

                {/* Bouton ouvrir — Vert Forêt par défaut, rouge si P1 */}
                <Button
                  onClick={() => onOpenIncident(inc.id)}
                  className="h-10 px-5 font-semibold flex-shrink-0 text-white shadow-sm"
                  style={{
                    backgroundColor: isP1 ? RESILLIA.urgence : RESILLIA.forest,
                  }}
                >
                  Ouvrir la war room
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            );
          })
        ) : (
          /* ===== LISTE HISTORIQUE COMPACTE ===== */
          <div
            className="rounded-xl border divide-y overflow-hidden bg-white"
            style={{ borderColor: RESILLIA.border }}
          >
            {displayed.map((inc) => {
              const sev = SEV_PASTEL[inc.niveau_severite];
              return (
                <button
                  key={inc.id}
                  onClick={() => onOpenIncident(inc.id)}
                  className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-[#FAFAF9] transition-colors"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: sev.dot }}
                  />
                  <span className="flex-1 text-sm font-medium truncate" style={{ color: RESILLIA.navy }}>
                    {inc.titre}
                  </span>
                  <span
                    className="text-xs hidden md:inline"
                    style={{ color: RESILLIA.navy + "70" }}
                  >
                    {formatDateTime(inc.date_heure_debut)}
                  </span>
                  <Badge
                    className="text-[10px] border-0"
                    style={{ backgroundColor: sev.bg, color: sev.text }}
                  >
                    {inc.niveau_severite}
                  </Badge>
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