// Module M7 — Exercices PCA : refonte design premium (cockpit)
import { useMemo, useState } from "react";
import {
  Plus, Search, Target, AlertTriangle, ShieldCheck, CalendarClock, Loader2,
  ChevronRight, Sparkles, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  useExercices, TYPE_LABELS, STATUT_LABELS, CRIT_COLORS, CRIT_ACCENT, isCritical,
  lastTestedMap, monthsSince, fmtDate,
  TestPca, TestType, TestStatut,
} from "./useExercices";
import { TestWizard } from "./TestWizard";
import { TestRunner } from "./TestRunner";

type Tab = "overview" | "list" | "calendar" | "conformite";

const card = "bg-white rounded-xl shadow-[0_1px_3px_rgba(23,32,48,0.06)] transition-shadow hover:shadow-[0_4px_16px_rgba(23,32,48,0.08)]";
const STATUT_STYLE: Record<TestStatut, { bg: string; fg: string; dot: string }> = {
  PLANIFIE: { bg: "bg-[#F8F6F2]", fg: "text-[#3B4454]", dot: "bg-[#B08900]" },
  EN_COURS: { bg: "bg-[#FFF8E1]", fg: "text-[#8A6A00]", dot: "bg-[#EF6C00] animate-pulse" },
  TERMINE: { bg: "bg-[#E8F5E9]", fg: "text-[#2E7D32]", dot: "bg-[#2E7D32]" },
  OBJECTIFS_NON_ATTEINTS: { bg: "bg-[#FFEBEE]", fg: "text-[#C62828]", dot: "bg-[#C62828]" },
};

const relative = (s: string | null): string => {
  if (!s) return "—";
  const d = new Date(s).getTime();
  const diff = d - Date.now();
  const abs = Math.abs(diff);
  const day = 86400000;
  if (abs < day) return diff > 0 ? "aujourd'hui" : "il y a < 1 j";
  if (abs < 30 * day) {
    const n = Math.round(abs / day);
    return diff > 0 ? `dans ${n} j` : `il y a ${n} j`;
  }
  if (abs < 365 * day) {
    const n = Math.round(abs / (30.44 * day));
    return diff > 0 ? `dans ${n} mois` : `il y a ${n} mois`;
  }
  const n = Math.round(abs / (365 * day));
  return diff > 0 ? `dans ${n} an${n > 1 ? "s" : ""}` : `il y a ${n} an${n > 1 ? "s" : ""}`;
};

const RadialArc = ({ pct, color = "#2A5141" }: { pct: number; color?: string }) => {
  const r = 26;
  const c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;
  return (
    <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
      <circle cx="32" cy="32" r={r} fill="none" stroke="#F1EEE8" strokeWidth="6" />
      <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off}
        style={{ transition: "stroke-dashoffset 800ms cubic-bezier(.4,0,.2,1)" }} />
    </svg>
  );
};

const Sparkline12m = ({ tests }: { tests: TestPca[] }) => {
  const bars = useMemo(() => {
    const now = new Date();
    const out: { d: Date; ok: number; ko: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const inMonth = (t: TestPca, statut: TestStatut) => {
        if (t.statut !== statut) return false;
        const td = t.date_fin_reelle ?? t.date_planifiee ?? t.created_at;
        if (!td) return false;
        const x = new Date(td);
        return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth();
      };
      out.push({ d, ok: tests.filter((t) => inMonth(t, "TERMINE")).length, ko: tests.filter((t) => inMonth(t, "OBJECTIFS_NON_ATTEINTS")).length });
    }
    return out;
  }, [tests]);
  const max = Math.max(...bars.map((b) => b.ok + b.ko), 1);
  return (
    <div className="flex items-end gap-[3px] h-12 mt-1">
      {bars.map((b, i) => {
        const total = b.ok + b.ko;
        const h = total ? (total / max) * 100 : 4;
        return (
          <TooltipProvider key={i} delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col justify-end h-full w-2.5 cursor-default">
                  {b.ko > 0 && <div className="bg-[#FFEBEE]" style={{ height: `${(b.ko / (total || 1)) * h}%` }} />}
                  {b.ok > 0 && <div className="bg-[#2A5141]" style={{ height: `${(b.ok / (total || 1)) * h}%` }} />}
                  {total === 0 && <div className="bg-[#E8E4DC]" style={{ height: "4%" }} />}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {b.d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })} — {b.ok} réussi · {b.ko} échoué
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
};

const CritSegments = ({ byCrit }: { byCrit: Record<string, number> }) => {
  const total = Object.values(byCrit).reduce((a, b) => a + b, 0) || 1;
  const order = ["Critique", "Sévère", "Majeur", "Modéré", "Mineur"];
  return (
    <div className="mt-2">
      <div className="flex h-2.5 rounded-full overflow-hidden bg-[#F1EEE8]">
        {order.map((k) => byCrit[k] ? (
          <div key={k} style={{ width: `${(byCrit[k] / total) * 100}%`, background: CRIT_ACCENT[k] }} />
        ) : null)}
      </div>
      <div className="flex gap-3 mt-1.5 flex-wrap">
        {order.filter((k) => byCrit[k]).map((k) => (
          <span key={k} className="text-[10px] text-[#3B4454]/70 flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: CRIT_ACCENT[k] }} />
            {byCrit[k]} {k}
          </span>
        ))}
      </div>
    </div>
  );
};

const TlptTimeline = ({ due, last }: { due: Date | null; last: Date | null }) => {
  if (!due) return <div className="mt-2 h-12 flex items-center text-xs text-[#3B4454]/60">Aucun TLPT planifié</div>;
  const start = last ?? new Date(due.getFullYear() - 3, due.getMonth(), due.getDate());
  const total = due.getTime() - start.getTime();
  const pct = Math.max(0, Math.min(100, ((Date.now() - start.getTime()) / total) * 100));
  return (
    <div className="mt-3">
      <div className="relative h-2 bg-[#F1EEE8] rounded-full">
        <div className="absolute inset-y-0 left-0 bg-[#172030] rounded-full transition-all" style={{ width: `${pct}%` }} />
        <div className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-[#172030] ring-2 ring-white" style={{ left: `calc(${pct}% - 7px)` }} />
      </div>
      <div className="flex justify-between mt-1.5 text-[10px] text-[#3B4454]/70">
        <span>{start.toLocaleDateString("fr-FR")}</span>
        <span className="font-medium text-[#172030]">{Math.round(pct)}% du cycle</span>
        <span>{due.toLocaleDateString("fr-FR")}</span>
      </div>
    </div>
  );
};

// ─── Composant principal ──────────────────────────────────────────────
export default function ExercicesModule() {
  // ⚠️ TOUS LES HOOKS EN PREMIER (avant tout early return)
  const data = useExercices();
  const [tab, setTab] = useState<Tab>("overview");
  const [wizard, setWizard] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [fType, setFType] = useState("all");
  const [fStatut, setFStatut] = useState("all");
  const [fPeriod, setFPeriod] = useState("all");

  const last = useMemo(() => lastTestedMap(data.tests), [data.tests]);
  const critical = useMemo(() => data.processus.filter((p) => isCritical(p.criticite)), [data.processus]);

  const kpi = useMemo(() => {
    const covered = critical.filter((p) => last.has(p.id) && monthsSince(last.get(p.id)!) <= 12).length;
    const done = data.tests.filter((t) => t.statut === "TERMINE" || t.statut === "OBJECTIFS_NON_ATTEINTS");
    const success = done.filter((t) => t.statut === "TERMINE").length;
    const lateProcessus = data.processus.filter((p) => !last.has(p.id) || monthsSince(last.get(p.id)!) > 12);
    const byCrit: Record<string, number> = {};
    lateProcessus.forEach((p) => { byCrit[p.criticite] = (byCrit[p.criticite] ?? 0) + 1; });
    const tlpts = data.tests.filter((t) => t.est_tlpt);
    const lastTlpt = tlpts.filter((t) => t.statut === "TERMINE").map((t) => new Date(t.date_fin_reelle ?? t.date_planifiee ?? t.created_at)).sort((a, b) => +b - +a)[0] ?? null;
    const plannedTlpt = tlpts.filter((t) => t.statut === "PLANIFIE" && t.date_planifiee).map((t) => new Date(t.date_planifiee!)).sort((a, b) => +a - +b)[0] ?? null;
    const tlptDue = plannedTlpt ?? (lastTlpt ? new Date(lastTlpt.getFullYear() + 3, lastTlpt.getMonth(), lastTlpt.getDate()) : null);
    return {
      coverage: critical.length ? Math.round((covered / critical.length) * 100) : 0, covered,
      success: done.length ? Math.round((success / done.length) * 100) : null, doneCount: done.length,
      late: lateProcessus.length, byCrit,
      tlptDue, lastTlpt, tlptKnown: !!(lastTlpt || plannedTlpt),
    };
  }, [critical, last, data.tests, data.processus]);

  const priority = useMemo(() =>
    critical
      .filter((p) => !last.has(p.id) || monthsSince(last.get(p.id)!) > 12)
      .sort((a, b) => ["Critique", "Sévère", "Majeur"].indexOf(a.criticite) - ["Critique", "Sévère", "Majeur"].indexOf(b.criticite))
      .slice(0, 6)
  , [critical, last]);

  const filtered = useMemo(() => data.tests.filter((t) => {
    if (fType !== "all" && t.type !== fType) return false;
    if (fStatut !== "all" && t.statut !== fStatut) return false;
    if (fPeriod !== "all") {
      const d = new Date(t.date_planifiee ?? t.created_at).getTime();
      const days = (d - Date.now()) / 86400000;
      if (fPeriod === "upcoming" && days < 0) return false;
      if (fPeriod === "past90" && (days > 0 || days < -90)) return false;
      if (fPeriod === "year" && new Date(d).getFullYear() !== new Date().getFullYear()) return false;
    }
    const s = q.toLowerCase();
    const pName = data.processus.find((p) => p.id === t.processus_id)?.name ?? "";
    return !s || t.titre.toLowerCase().includes(s) || (t.reference ?? "").toLowerCase().includes(s) || pName.toLowerCase().includes(s);
  }), [data.tests, data.processus, q, fType, fStatut, fPeriod]);

  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      return { d, key: `${d.getFullYear()}-${d.getMonth()}` };
    });
  }, []);

  const upcoming12m = useMemo(() => data.tests
    .filter((t) => t.date_planifiee && new Date(t.date_planifiee) >= new Date())
    .sort((a, b) => +new Date(a.date_planifiee!) - +new Date(b.date_planifiee!)), [data.tests]);

  // ⚠️ EARLY RETURN APRÈS TOUS LES HOOKS
  const openTest = data.tests.find((t) => t.id === openId);
  if (openTest) return <TestRunner test={openTest} data={data} onBack={() => setOpenId(null)} />;

  const procName = (id: string | null) => data.processus.find((p) => p.id === id)?.name ?? "—";

  const TestRow = ({ t }: { t: TestPca }) => {
    const p = data.processus.find((x) => x.id === t.processus_id);
    const st = STATUT_STYLE[t.statut];
    return (
      <button onClick={() => setOpenId(t.id)}
        className="group w-full text-left grid grid-cols-[6px_110px_1fr_auto] sm:grid-cols-[6px_110px_1fr_140px_120px_140px_auto] items-center gap-3 px-4 py-3 hover:bg-[#FCFBF8] transition-all">
        <span className="h-8 w-[3px] rounded-full transition-all group-hover:h-10"
          style={{ background: p ? CRIT_ACCENT[p.criticite] : "#E8E4DC" }} />
        <span className="text-[11px] font-mono text-[#3B4454]/70">{t.reference ?? "—"}</span>
        <span className="min-w-0">
          <span className="block text-sm font-medium text-[#172030] truncate">
            {t.titre}
            {t.est_tlpt && <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-[#172030] text-white tracking-wider">TLPT</span>}
          </span>
          <span className="block text-xs text-[#3B4454]/60 truncate">{TYPE_LABELS[t.type]} · {p?.name ?? "—"}</span>
        </span>
        <span className="hidden sm:block text-xs text-[#3B4454] tabular-nums">{fmtDate(t.date_planifiee)}</span>
        <span className="hidden sm:block text-[11px] text-[#3B4454]/50 italic">{relative(t.date_planifiee)}</span>
        <span className={cn("hidden sm:inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full w-fit", st.bg, st.fg)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />
          {STATUT_LABELS[t.statut]}
        </span>
        <ChevronRight className="h-4 w-4 text-[#3B4454]/30 group-hover:text-[#2A5141] group-hover:translate-x-0.5 transition" />
      </button>
    );
  };

  const CalendarView = () => {
    const monthsArr: { label: string; key: string; items: TestPca[] }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      monthsArr.push({
        label: d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
        key: `${d.getFullYear()}-${d.getMonth()}`,
        items: upcoming12m.filter((t) => {
          const x = new Date(t.date_planifiee!);
          return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth();
        }),
      });
    }
    return (
      <section className={cn(card, "p-6")}>
        <div className="flex items-baseline justify-between mb-5">
          <div>
            <h3 className="font-['Playfair_Display'] text-xl text-[#172030]">Planning 12 mois</h3>
            <p className="text-xs text-[#3B4454]/60 mt-0.5">{upcoming12m.length} exercice(s) à venir</p>
          </div>
        </div>
        <div className="space-y-4">
          {monthsArr.map((m) => (
            <div key={m.key} className="grid grid-cols-[80px_1fr] gap-4 items-start">
              <div className="text-xs uppercase tracking-widest text-[#3B4454]/50 pt-1.5">{m.label}</div>
              <div className="min-h-[42px] flex flex-wrap gap-2">
                {m.items.length === 0 ? (
                  <div className="h-[42px] flex-1 rounded-lg bg-[#F8F6F2]/60 border border-dashed border-[#E8E4DC]" />
                ) : m.items.map((t) => {
                  const p = data.processus.find((x) => x.id === t.processus_id);
                  return (
                    <button key={t.id} onClick={() => setOpenId(t.id)}
                      className="group flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(23,32,48,0.10)]"
                      style={{ background: p ? CRIT_COLORS[p.criticite] : "#F8F6F2", borderLeft: `3px solid ${p ? CRIT_ACCENT[p.criticite] : "#E8E4DC"}` }}>
                      <div>
                        <p className="text-xs font-medium text-[#172030]">{t.titre}</p>
                        <p className="text-[10px] text-[#3B4454]/70">{t.reference} · {new Date(t.date_planifiee!).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="space-y-6">
      {/* ═══ HEADER HERO ═══ */}
      <div className="relative rounded-2xl bg-[#172030] text-white overflow-hidden px-7 py-6">
        {/* filigrane 07 */}
        <span className="absolute right-4 -top-6 font-['Playfair_Display'] italic text-[120px] leading-none text-white/[0.04] select-none pointer-events-none">
          07
        </span>
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-white/50">
              <span className="h-px w-6 bg-[#2A5141]" />
              M7 · ISO 22301 · DORA
            </div>
            <h1 className="font-['Playfair_Display'] text-4xl text-white mt-2">Exercices PCA</h1>
            <p className="text-sm text-white/60 mt-2 max-w-xl">
              Planifiez, exécutez et capitalisez vos tests de continuité. Chaque objectif non atteint déclenche une action corrective traçable.
            </p>
          </div>
          <Button
            className="group bg-[#2A5141] hover:bg-[#21402F] text-white shadow-[0_4px_16px_rgba(42,81,65,0.4)] h-11 px-5"
            onClick={() => setWizard(true)} disabled={!data.schemaReady}>
            <Plus className="h-4 w-4 mr-1.5 transition-transform duration-300 group-hover:rotate-90" />
            Planifier un exercice
          </Button>
        </div>

        {/* barre de micro-métriques */}
        <div className="relative mt-6 pt-4 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { l: "Processus critiques", v: critical.length },
            { l: "Exercices au registre", v: data.tests.length },
            { l: "Couverture 12 mois", v: `${kpi.coverage}%` },
            { l: "Assujetti DORA", v: data.dora ? "Oui" : "Non" },
          ].map((m) => (
            <div key={m.l}>
              <p className="text-[10px] uppercase tracking-wider text-white/40">{m.l}</p>
              <p className="font-['Playfair_Display'] text-xl text-white mt-0.5 tabular-nums">{m.v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <nav className="flex gap-6 border-b border-[#E8E4DC]">
        {([
          ["overview", "Vue d'ensemble"], ["list", "Registre"],
          ["calendar", "Calendrier"], ["conformite", "Conformité"],
        ] as [Tab, string][]).map(([id, l]) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn("pb-2 text-sm -mb-px border-b-2 transition-colors",
              tab === id ? "border-[#2A5141] text-[#172030] font-semibold" : "border-transparent text-[#3B4454]/70 hover:text-[#172030]")}>
            {l}
          </button>
        ))}
      </nav>

      {data.loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-[#2A5141]" /></div>
      ) : !data.schemaReady ? (
        <div className={cn(card, "p-6 text-sm text-[#3B4454]")}>
          Les tables du module ne sont pas encore créées. Exécutez le script <code>supabase/manual/2026-10-01_module_exercices.sql</code>.
        </div>
      ) : (
        <>
          {tab === "overview" && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className={cn(card, "p-5 relative overflow-hidden")}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-[#3B4454]/60">Couverture critique</p>
                      <p className="font-['Playfair_Display'] text-3xl text-[#172030] mt-1 tabular-nums">{kpi.coverage}<span className="text-lg text-[#3B4454]/40">%</span></p>
                    </div>
                    <div className="relative">
                      <RadialArc pct={kpi.coverage} />
                      <Target className="h-4 w-4 text-[#2A5141] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90" />
                    </div>
                  </div>
                  <p className="text-xs text-[#3B4454]/70 mt-2 tabular-nums">{kpi.covered} / {critical.length} testés &lt; 12 mois</p>
                </div>

                <div className={cn(card, "p-5")}>
                  <p className="text-[11px] uppercase tracking-wider text-[#3B4454]/60">Taux de réussite</p>
                  <div className="flex items-baseline justify-between">
                    <p className="font-['Playfair_Display'] text-3xl text-[#172030] mt-1 tabular-nums">
                      {kpi.success === null ? "—" : `${kpi.success}`}<span className="text-lg text-[#3B4454]/40">{kpi.success === null ? "" : "%"}</span>
                    </p>
                    <ShieldCheck className="h-4 w-4 text-[#2A5141]" />
                  </div>
                  <Sparkline12m tests={data.tests} />
                  <p className="text-xs text-[#3B4454]/70 mt-1">{kpi.doneCount} clôturé(s) · 12 mois</p>
                </div>

                <div className={cn(card, "p-5")}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-[#3B4454]/60">Processus en retard</p>
                      <p className="font-['Playfair_Display'] text-3xl text-[#172030] mt-1 tabular-nums">{kpi.late}</p>
                    </div>
                    <AlertTriangle className={cn("h-4 w-4", kpi.late > 0 ? "text-[#EF6C00]" : "text-[#2E7D32]")} />
                  </div>
                  <CritSegments byCrit={kpi.byCrit} />
                </div>

                <div className={cn(card, "p-5")}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-[#3B4454]/60">Cycle TLPT</p>
                      <p className="font-['Playfair_Display'] text-2xl text-[#172030] mt-1 tabular-nums">
                        {data.dora
                          ? (kpi.tlptDue ? kpi.tlptDue.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "À planifier")
                          : "N/A"}
                      </p>
                    </div>
                    <CalendarClock className="h-4 w-4 text-[#2A5141]" />
                  </div>
                  {data.dora
                    ? <TlptTimeline due={kpi.tlptDue} last={kpi.lastTlpt} />
                    : <p className="text-xs text-[#3B4454]/60 mt-2">Entité non assujettie DORA</p>}
                </div>
              </div>

              <div className="grid lg:grid-cols-[3fr_2fr] gap-5">
                <section className={card}>
                  <div className="px-5 pt-5 pb-3 flex items-baseline justify-between">
                    <h3 className="font-['Playfair_Display'] text-lg text-[#172030]">Tests à venir & récents</h3>
                    <button onClick={() => setTab("list")} className="text-xs text-[#2A5141] hover:underline">Tout voir</button>
                  </div>
                  <div className="divide-y divide-[#F1EEE8]">
                    {data.tests.slice(0, 8).map((t) => <TestRow key={t.id} t={t} />)}
                    {!data.tests.length && (
                      <div className="px-5 pb-6 pt-2 text-center">
                        <Sparkles className="h-6 w-6 text-[#2A5141]/40 mx-auto" />
                        <p className="text-sm text-[#3B4454]/60 mt-2">Aucun exercice planifié.</p>
                        <Button variant="link" className="text-[#2A5141]" onClick={() => setWizard(true)}>Planifier le premier →</Button>
                      </div>
                    )}
                  </div>
                </section>

                <section className={cn(card, "p-5")}>
                  <div className="flex items-baseline justify-between mb-3">
                    <h3 className="font-['Playfair_Display'] text-lg text-[#172030]">À tester en priorité</h3>
                    <span className="text-[10px] uppercase tracking-wider text-[#3B4454]/50">12 derniers mois</span>
                  </div>
                  <div className="space-y-2">
                    {priority.map((p) => {
                      const d = last.get(p.id);
                      const m = d ? Math.round(monthsSince(d)) : null;
                      return (
                        <div key={p.id} className="group relative rounded-lg pl-3 pr-3 py-2.5 transition-all hover:shadow-[0_2px_10px_rgba(23,32,48,0.08)]"
                          style={{ background: CRIT_COLORS[p.criticite], borderLeft: `4px solid ${CRIT_ACCENT[p.criticite]}` }}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-[#172030] truncate">{p.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] uppercase tracking-wider text-[#3B4454]/70">{p.criticite}</span>
                                <span className="text-[10px] text-[#3B4454]/40">·</span>
                                <span className={cn("text-[10px] font-medium", m === null ? "text-[#C62828]" : "text-[#EF6C00]")}>
                                  {m === null ? "Jamais testé" : `Il y a ${m} mois`}
                                </span>
                              </div>
                            </div>
                            <button onClick={() => setWizard(true)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-medium text-[#2A5141] whitespace-nowrap hover:underline">
                              Planifier →
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {!priority.length && (
                      <div className="text-center py-6">
                        <ShieldCheck className="h-6 w-6 text-[#2E7D32] mx-auto" />
                        <p className="text-sm text-[#3B4454]/60 mt-2">Tous les processus critiques sont à jour.</p>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </>
          )}

          {tab === "list" && (
            <section className={card}>
              <div className="flex flex-wrap gap-2 p-4 border-b border-[#F1EEE8]">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="h-4 w-4 absolute left-3 top-3 text-[#3B4454]/50" />
                  <Input className="pl-9" placeholder="Rechercher (titre, référence, processus)" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                <Select value={fType} onValueChange={setFType}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous types</SelectItem>
                    {(Object.keys(TYPE_LABELS) as TestType[]).map((k) => <SelectItem key={k} value={k}>{TYPE_LABELS[k]}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={fStatut} onValueChange={setFStatut}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous statuts</SelectItem>
                    {(Object.keys(STATUT_LABELS) as TestStatut[]).map((k) => <SelectItem key={k} value={k}>{STATUT_LABELS[k]}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={fPeriod} onValueChange={setFPeriod}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toute période</SelectItem>
                    <SelectItem value="upcoming">À venir</SelectItem>
                    <SelectItem value="past90">90 derniers jours</SelectItem>
                    <SelectItem value="year">Année en cours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="hidden sm:grid grid-cols-[6px_110px_1fr_140px_120px_140px_auto] gap-3 px-4 py-2 text-[10px] uppercase tracking-wider text-[#3B4454]/50 border-b border-[#F1EEE8]">
                <span /><span>Référence</span><span>Exercice</span><span>Date</span><span>Échéance</span><span>Statut</span><span />
              </div>
              <div className="divide-y divide-[#F1EEE8]">
                {filtered.map((t) => <TestRow key={t.id} t={t} />)}
                {!filtered.length && <p className="p-8 text-sm text-[#3B4454]/60 text-center">Aucun test ne correspond.</p>}
              </div>
            </section>
          )}

          {tab === "calendar" && <CalendarView />}

          {tab === "conformite" && (
            <div className="grid lg:grid-cols-[2fr_1fr] gap-5">
              <section className={cn(card, "p-5")}>
                <div className="flex items-baseline justify-between mb-4">
                  <h3 className="font-['Playfair_Display'] text-lg text-[#172030]">Couverture par processus critique</h3>
                  <div className="flex items-center gap-2 text-[10px] text-[#3B4454]/60">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#2A5141]" />Testé</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#F1EEE8]" />Non testé</span>
                  </div>
                </div>
                <div className="space-y-3">
                  {critical.map((p) => {
                    const d = last.get(p.id);
                    return (
                      <div key={p.id} className="grid grid-cols-[1fr_80px_auto] items-center gap-3">
                        <div className="min-w-0">
                          <p className="text-sm text-[#172030] truncate">{p.name}</p>
                          <p className="text-[10px] text-[#3B4454]/60">
                            {d ? `Dernier test : ${d.toLocaleDateString("fr-FR")}` : "Jamais testé"}
                          </p>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded text-center uppercase tracking-wider"
                          style={{ background: CRIT_COLORS[p.criticite], color: CRIT_ACCENT[p.criticite] }}>{p.criticite}</span>
                        <div className="flex gap-[2px]">
                          {months.map((mo, i) => {
                            const tested = data.tests.some((t) => {
                              if (t.processus_id !== p.id) return false;
                              if (t.statut !== "TERMINE" && t.statut !== "OBJECTIFS_NON_ATTEINTS") return false;
                              const td = t.date_fin_reelle ?? t.date_planifiee ?? t.created_at;
                              if (!td) return false;
                              const x = new Date(td);
                              return x.getFullYear() === mo.d.getFullYear() && x.getMonth() === mo.d.getMonth();
                            });
                            return (
                              <TooltipProvider key={i} delayDuration={150}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="h-4 w-4 rounded-sm transition-colors cursor-default"
                                      style={{ background: tested ? "#2A5141" : "#F1EEE8" }} />
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">
                                    {mo.d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })} — {tested ? "Testé" : "Non testé"}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {!critical.length && <p className="text-sm text-[#3B4454]/60">Aucun processus critique identifié dans le BIA.</p>}
                </div>
              </section>

              <section className="rounded-xl bg-[#172030] text-white p-6 shadow-[0_4px_24px_rgba(23,32,48,0.20)] relative overflow-hidden">
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[#2A5141]/30 blur-2xl" />
                <div className="relative">
                  <p className="text-[10px] uppercase tracking-widest text-white/50">DORA · Art. 26</p>
                  <h3 className="font-['Playfair_Display'] text-xl mt-1">Tests TLPT</h3>
                  {data.dora ? (
                    <>
                      <p className="font-['Playfair_Display'] text-4xl mt-4 tabular-nums">
                        {kpi.tlptDue ? kpi.tlptDue.toLocaleDateString("fr-FR") : "À planifier"}
                      </p>
                      <p className="text-sm text-white/70 mt-2">{kpi.tlptKnown ? "Prochaine échéance (cycle de 3 ans)" : "Aucun TLPT réalisé ni planifié."}</p>
                      <div className="mt-5 pt-5 border-t border-white/10 flex items-center gap-4">
                        <Clock className="h-5 w-5 text-white/40" />
                        <div>
                          <p className="text-2xl font-['Playfair_Display'] tabular-nums">{data.tests.filter((t) => t.est_tlpt).length}</p>
                          <p className="text-xs text-white/60">TLPT enregistré(s)</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-white/70 mt-4">Aucune entité marquée « assujettie DORA ».</p>
                  )}
                </div>
              </section>
            </div>
          )}
        </>
      )}

      <TestWizard open={wizard} onClose={() => setWizard(false)} data={data} onCreated={data.reload} />
    </div>
  );
}