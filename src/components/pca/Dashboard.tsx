import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarClock,
  ChevronRight,
  Database,
  FileText,
  Layers,
  RefreshCw,
  ShieldCheck,
  Users,
  Server,
  Handshake,
  Cpu,
  Target,
} from "lucide-react";
import { useBcmDashboard } from "@/hooks/useBcmDashboard";
import { cn } from "@/lib/utils";

// Charte Resillia
const C = {
  navy: "#172030",
  creme: "#F8F6F2",
  vert: "#2A5141",
  bordure: "#E8E4DC",
  vertClair: "#E8F5E9",
  orangeClair: "#FFF3E0",
  rougeClair: "#FFEBEE",
  gris: "#F1EFE8",
};

const serif = { fontFamily: "'Playfair Display', serif" };

type Props = { onNavigate?: (section: string) => void };

// ---------------------------------------------------------------- primitives
const Panel = ({
  title,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string;
  icon?: any;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) => (
  <Card className={cn("border-[#E8E4DC] bg-white shadow-[0_1px_2px_rgba(23,32,48,0.04)]", className)}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-[#E8E4DC] px-5 py-3.5">
      <CardTitle className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#172030]">
        {Icon && <Icon className="h-4 w-4 text-[#2A5141]" />}
        {title}
      </CardTitle>
      {action}
    </CardHeader>
    <CardContent className="p-5">{children}</CardContent>
  </Card>
);

const Empty = ({ label }: { label: string }) => (
  <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[#E8E4DC] bg-[#F8F6F2] py-8 text-center">
    <p className="text-sm text-[#172030]/50">{label}</p>
    <p className="text-[11px] text-[#172030]/35">Aucune donnée enregistrée</p>
  </div>
);

// ---------------------------------------------------------------- composant
export const Dashboard = ({ onNavigate }: Props) => {
  const d = useBcmDashboard();
  const [cell, setCell] = useState<{ p: number; i: number } | null>(null);

  const go = (section: string) => onNavigate?.(section);

  const today = useMemo(
    () =>
      new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    [],
  );

  const maxDirProc = Math.max(1, ...d.directions.map((x) => x.processus));
  const selectedCell = cell ? d.matrix.find((c) => c.p === cell.p && c.i === cell.i) : null;

  const kpis = [
    {
      label: "Processus critiques",
      value: d.criticalProcesses.length,
      sub: `${d.criticalProcesses.filter((p) => p.hasStrategy).length} avec stratégie`,
      icon: Target,
      section: "bia",
    },
    {
      label: "Risques critiques",
      value: d.criticalRisks.length,
      sub: `${d.riskEnriched.length} risques identifiés`,
      icon: AlertOctagon,
      section: "risk",
    },
    {
      label: "Risques non traités",
      value: d.untreatedRisks.length,
      sub: `${d.riskEnriched.length - d.untreatedRisks.length} avec mesure`,
      icon: AlertTriangle,
      section: "risk",
    },
    {
      label: "Stratégies",
      value: d.strategies.length,
      sub: `${d.assocs.length} association${d.assocs.length > 1 ? "s" : ""}`,
      icon: Layers,
      section: "strategies",
    },
    {
      label: "Plans de continuité",
      value: d.planStats.total,
      sub: `${d.planStats.approuves} approuvé${d.planStats.approuves > 1 ? "s" : ""}`,
      icon: FileText,
      section: "plan",
    },
    {
      label: "Ressources",
      value: d.resources.total,
      sub: `${d.directions.filter((x) => x.ressources > 0).length} directions couvertes`,
      icon: Database,
      section: "cmdb",
    },
  ];

  const cellColor = (p: number, i: number) => {
    const s = p * i;
    if (s >= 15) return { bg: C.rougeClair, fg: "#B3261E", bd: "#F0C4C0" };
    if (s >= 9) return { bg: C.orangeClair, fg: "#9A5B00", bd: "#F0DCBE" };
    if (s >= 4) return { bg: "#FBF6E3", fg: "#7A6A16", bd: "#EAE2C4" };
    return { bg: C.vertClair, fg: C.vert, bd: "#CFE3D2" };
  };

  if (d.loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex flex-col gap-4 border-b border-[#E8E4DC] pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#2A5141]">Resillia · Cockpit</p>
          <h1 className="mt-1 text-[32px] leading-tight text-[#172030]" style={serif}>
            Tableau de bord BCM
          </h1>
          <p className="mt-1 text-sm text-[#172030]/60">Vue globale de la résilience opérationnelle</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs capitalize text-[#172030]/45 sm:inline">{today}</span>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2 border-[#E8E4DC] text-[#172030]/70"
            onClick={d.reload}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Actualiser
          </Button>
        </div>
      </div>

      {/* MATURITÉ + KPI */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="border-[#E8E4DC] bg-[#172030] text-white shadow-sm xl:col-span-1">
          <CardContent className="p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">Indice de maturité BCM</p>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-[56px] leading-none" style={serif}>
                {d.maturity.global}
              </span>
              <span className="pb-2 text-lg text-white/45">/ 100</span>
            </div>
            <div className="mt-5 space-y-3">
              {d.maturity.pillars.map((p) => (
                <div key={p.key}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-white/70">{p.key}</span>
                    <span className="text-xs font-semibold text-white">{p.value}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-[#5B8F72] transition-all duration-700"
                      style={{ width: `${p.value}%` }}
                    />
                  </div>
                  <p className="mt-0.5 text-[10px] text-white/35">{p.detail}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 border-t border-white/10 pt-3 text-[10px] text-white/35">
              Calculé à partir des données actuelles
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:col-span-2 xl:auto-rows-fr">
          {kpis.map((k) => (
            <button
              key={k.label}
              onClick={() => go(k.section)}
              className="group rounded-xl border border-[#E8E4DC] bg-white p-4 text-left transition-all hover:border-[#2A5141]/35 hover:shadow-[0_4px_16px_rgba(23,32,48,0.06)]"
            >
              <div className="flex items-start justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#172030]/45">{k.label}</p>
                <k.icon className="h-4 w-4 text-[#2A5141]/70" />
              </div>
              <p className="mt-2 text-[30px] leading-none text-[#172030]" style={serif}>
                {k.value}
              </p>
              <p className="mt-2 flex items-center gap-1 text-[11px] text-[#172030]/50">
                {k.sub}
                <ChevronRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* CHAÎNE DE RÉSILIENCE */}
      <Panel title="Chaîne de résilience" icon={Activity}>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
          {[
            { l: "BIA", v: d.chain.processus, s: `${d.chain.critiques} critiques`, sec: "bia" },
            { l: "Risques", v: d.chain.risques, s: `${d.chain.risquesTraites} traités`, sec: "risk" },
            { l: "Stratégies", v: d.chain.avecStrategie, s: `sur ${d.chain.base} processus clés`, sec: "strategies" },
            { l: "Plans", v: d.chain.avecPlan, s: `sur ${d.chain.base} processus clés`, sec: "plan" },
            {
              l: "Résilience",
              v: `${d.chain.base ? Math.round((d.chain.avecPlan / d.chain.base) * 100) : 0}%`,
              s: `${d.chain.plansApprouves} plans approuvés`,
              sec: "plan",
            },
          ].map((step, idx, arr) => (
            <button
              key={step.l}
              onClick={() => go(step.sec)}
              className="relative rounded-lg border border-[#E8E4DC] bg-[#F8F6F2] p-4 text-left transition-colors hover:bg-[#EFEDE6]"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#2A5141]">{step.l}</p>
              <p className="mt-1.5 text-[26px] leading-none text-[#172030]" style={serif}>
                {step.v}
              </p>
              <p className="mt-1 text-[11px] text-[#172030]/50">{step.s}</p>
              {idx < arr.length - 1 && (
                <ArrowRight className="absolute -right-[13px] top-1/2 hidden h-4 w-4 -translate-y-1/2 text-[#2A5141]/35 lg:block" />
              )}
            </button>
          ))}
        </div>
      </Panel>

      {/* DIRECTIONS + MATRICE */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Panel title="Répartition par direction" icon={Building2} className="lg:col-span-3">
          {d.directions.length === 0 ? (
            <Empty label="Aucune direction rattachée à des processus ou ressources" />
          ) : (
            <div className="space-y-3.5">
              {d.directions.slice(0, 8).map((dir) => (
                <div key={dir.id} className="group cursor-pointer" onClick={() => go("governance")}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium text-[#172030]">{dir.name}</span>
                    <span className="text-[11px] text-[#172030]/45">
                      {dir.processus} processus · {dir.critiques} critiques · {dir.risques} risques · {dir.ressources} ressources
                    </span>
                  </div>
                  <div className="mt-1.5 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-[#F1EFE8]">
                    <div
                      className="h-full rounded-l-full bg-[#B3261E]/70"
                      style={{ width: `${(dir.critiques / maxDirProc) * 100}%` }}
                    />
                    <div
                      className="h-full bg-[#2A5141] transition-all group-hover:bg-[#356450]"
                      style={{ width: `${((dir.processus - dir.critiques) / maxDirProc) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-4 border-t border-[#E8E4DC] pt-3 text-[10px] text-[#172030]/45">
                <span className="flex items-center gap-1.5">
                  <i className="h-2 w-2 rounded-full bg-[#B3261E]/70" /> Processus critiques
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="h-2 w-2 rounded-full bg-[#2A5141]" /> Autres processus
                </span>
              </div>
            </div>
          )}
        </Panel>

        <Panel title="Matrice des risques" icon={ShieldCheck} className="lg:col-span-2">
          {d.riskEnriched.length === 0 ? (
            <Empty label="Aucun risque évalué" />
          ) : (
            <>
              <div className="flex gap-2">
                <div className="flex flex-col justify-between py-1 text-[9px] uppercase tracking-widest text-[#172030]/40">
                  <span className="rotate-180 [writing-mode:vertical-rl]">Probabilité</span>
                </div>
                <div className="grid flex-1 grid-cols-5 gap-1">
                  {d.matrix.map((c) => {
                    const col = cellColor(c.p, c.i);
                    const active = cell?.p === c.p && cell?.i === c.i;
                    return (
                      <button
                        key={`${c.p}-${c.i}`}
                        onClick={() => setCell(active ? null : { p: c.p, i: c.i })}
                        className={cn(
                          "flex aspect-square items-center justify-center rounded-md border text-sm font-semibold transition-all",
                          active && "ring-2 ring-[#172030] ring-offset-1",
                        )}
                        style={{ backgroundColor: col.bg, borderColor: col.bd, color: c.risks.length ? col.fg : "#B9B4A9" }}
                      >
                        {c.risks.length || ""}
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="mt-1.5 pl-6 text-center text-[9px] uppercase tracking-widest text-[#172030]/40">Impact</p>
              <div className="mt-3 border-t border-[#E8E4DC] pt-3">
                {selectedCell && selectedCell.risks.length > 0 ? (
                  <div className="space-y-1.5">
                    {selectedCell.risks.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => go("risk")}
                        className="flex w-full items-center justify-between rounded-md bg-[#F8F6F2] px-2.5 py-1.5 text-left hover:bg-[#EFEDE6]"
                      >
                        <span className="truncate text-xs text-[#172030]">{r.label}</span>
                        <Badge variant="outline" className="ml-2 shrink-0 border-[#E8E4DC] text-[9px]">
                          {r.residual}
                        </Badge>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-[11px] text-[#172030]/40">
                    Cliquez sur une cellule pour afficher les risques
                  </p>
                )}
              </div>
            </>
          )}
        </Panel>
      </div>

      {/* PROCESSUS CRITIQUES + PRIORITÉS */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Panel
          title="Processus critiques"
          icon={AlertOctagon}
          className="lg:col-span-3"
          action={
            <Button variant="ghost" size="sm" className="h-7 text-xs text-[#2A5141]" onClick={() => go("bia")}>
              Ouvrir le BIA <ChevronRight className="h-3 w-3" />
            </Button>
          }
        >
          {d.criticalProcesses.length === 0 ? (
            <Empty label="Aucun processus critique identifié" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E8E4DC] text-[10px] uppercase tracking-wider text-[#172030]/45">
                    <th className="py-2 text-left font-semibold">Processus</th>
                    <th className="py-2 text-left font-semibold">Direction</th>
                    <th className="py-2 text-center font-semibold">Crit.</th>
                    <th className="py-2 text-center font-semibold">RTO</th>
                    <th className="py-2 text-center font-semibold">RPO</th>
                    <th className="py-2 text-center font-semibold">Strat.</th>
                    <th className="py-2 text-center font-semibold">Plan</th>
                  </tr>
                </thead>
                <tbody>
                  {d.criticalProcesses.slice(0, 8).map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => go("bia")}
                      className="cursor-pointer border-b border-[#F1EFE8] last:border-0 hover:bg-[#F8F6F2]"
                    >
                      <td className="max-w-[220px] truncate py-2.5 pr-2 text-[#172030]">{p.name}</td>
                      <td className="py-2.5 pr-2 text-xs text-[#172030]/55">{p.direction_name}</td>
                      <td className="py-2.5 text-center">
                        <Badge
                          className="border text-[9px]"
                          style={{ backgroundColor: C.rougeClair, color: "#B3261E", borderColor: "#F0C4C0" }}
                        >
                          {p.criticite}
                        </Badge>
                      </td>
                      <td className="py-2.5 text-center text-xs text-[#172030]/70">{p.rto_hours ?? "—"}h</td>
                      <td className="py-2.5 text-center text-xs text-[#172030]/70">{p.rpo_hours ?? "—"}h</td>
                      <td className="py-2.5 text-center">
                        <i
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: p.hasStrategy ? C.vert : "#D9D4C8" }}
                        />
                      </td>
                      <td className="py-2.5 text-center">
                        <i
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: p.hasPlan ? C.vert : "#D9D4C8" }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Priorités de résilience" icon={AlertTriangle} className="lg:col-span-2">
          {d.priorities.length === 0 ? (
            <Empty label="Aucune priorité détectée" />
          ) : (
            <ScrollArea className="h-[300px] pr-3">
              <div className="space-y-2">
                {d.priorities.map((a, i) => {
                  const tone =
                    a.level === "critique"
                      ? { bg: C.rougeClair, dot: "#B3261E" }
                      : a.level === "eleve"
                        ? { bg: C.orangeClair, dot: "#C77700" }
                        : { bg: C.gris, dot: "#8A8474" };
                  return (
                    <button
                      key={i}
                      onClick={() => go(a.target)}
                      className="flex w-full items-start gap-2.5 rounded-lg border border-[#E8E4DC] p-2.5 text-left transition-colors hover:border-[#2A5141]/30"
                      style={{ backgroundColor: tone.bg }}
                    >
                      <i className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: tone.dot }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-[#172030]">{a.title}</span>
                        <span className="block truncate text-[10px] text-[#172030]/50">{a.detail}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </Panel>
      </div>

      {/* RESSOURCES + PLANS + ÉCHÉANCES */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Référentiel des ressources" icon={Database}>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { l: "Collaborateurs", v: d.resources.rh, icon: Users },
              { l: "Équipements", v: d.resources.equip, icon: Server },
              { l: "Applications IT", v: d.resources.apps, icon: Cpu },
              { l: "Fournisseurs", v: d.resources.fourn, icon: Handshake },
            ].map((r) => (
              <button
                key={r.l}
                onClick={() => go("cmdb")}
                className="rounded-lg border border-[#E8E4DC] bg-[#F8F6F2] p-3 text-left hover:bg-[#EFEDE6]"
              >
                <r.icon className="h-4 w-4 text-[#2A5141]/70" />
                <p className="mt-1.5 text-[22px] leading-none text-[#172030]" style={serif}>
                  {r.v}
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-wider text-[#172030]/45">{r.l}</p>
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-[#E8E4DC] pt-3">
            <span className="text-xs text-[#172030]/50">Total référencé</span>
            <span className="text-sm font-semibold text-[#2A5141]">{d.resources.total}</span>
          </div>
        </Panel>

        <Panel title="État des plans" icon={FileText}>
          {d.planStats.total === 0 ? (
            <Empty label="Aucun plan de continuité créé" />
          ) : (
            <div className="space-y-2.5">
              {["Brouillon", "En révision", "Approuvé", "À réviser", "Archivé"].map((s) => {
                const n = d.planStats.byStatut.get(s) ?? 0;
                return (
                  <div key={s} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-xs text-[#172030]/60">{s}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#F1EFE8]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(n / Math.max(1, d.planStats.total)) * 100}%`,
                          backgroundColor: s === "À réviser" ? "#C77700" : C.vert,
                        }}
                      />
                    </div>
                    <span className="w-6 text-right text-xs font-semibold text-[#172030]">{n}</span>
                  </div>
                );
              })}
              <div className="flex items-center justify-between border-t border-[#E8E4DC] pt-3 text-xs">
                <span className="text-[#172030]/50">Plans actifs</span>
                <span className="font-semibold text-[#2A5141]">{d.planStats.actifs}</span>
              </div>
            </div>
          )}
        </Panel>

        <Panel title="Prochaines échéances" icon={CalendarClock}>
          {d.deadlines.length === 0 ? (
            <Empty label="Aucune échéance planifiée" />
          ) : (
            <div className="space-y-0">
              {d.deadlines.map((e, i) => (
                <button
                  key={i}
                  onClick={() => go(e.target)}
                  className="flex w-full gap-3 border-l border-[#E8E4DC] py-2 pl-4 text-left hover:bg-[#F8F6F2]"
                >
                  <span className="relative -ml-[21px] mt-1 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-white"
                    style={{ backgroundColor: e.overdue ? "#B3261E" : C.vert }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-[#172030]">{e.label}</span>
                    <span className="block text-[10px] text-[#172030]/45">
                      {new Date(e.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                      {e.detail ? ` · ${e.detail}` : ""}
                      {e.overdue ? " · en retard" : ""}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
};
