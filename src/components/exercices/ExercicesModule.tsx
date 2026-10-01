// Module M7 — Exercices PCA : vue d'ensemble, liste, conformité, wizard, exécution
import { useMemo, useState } from "react";
import { Plus, Search, Target, AlertTriangle, ShieldCheck, CalendarClock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  useExercices, TYPE_LABELS, STATUT_LABELS, CRIT_COLORS, CRIT_ACCENT, isCritical, lastTestedMap, monthsSince, fmtDate,
  TestPca, TestType, TestStatut,
} from "./useExercices";
import { TestWizard } from "./TestWizard";
import { TestRunner } from "./TestRunner";

type Tab = "overview" | "list" | "conformite";
const card = "bg-white rounded-xl shadow-[0_1px_3px_rgba(23,32,48,0.08)]";
const STATUT_STYLE: Record<TestStatut, string> = {
  PLANIFIE: "bg-[#F8F6F2] text-[#3B4454]",
  EN_COURS: "bg-[#FFF8E1] text-[#8A6A00]",
  TERMINE: "bg-[#E8F5E9] text-[#2E7D32]",
  OBJECTIFS_NON_ATTEINTS: "bg-[#FFEBEE] text-[#C62828]",
};

export default function ExercicesModule() {
  const data = useExercices();
  const [tab, setTab] = useState<Tab>("overview");
  const [wizard, setWizard] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [fType, setFType] = useState("all");
  const [fStatut, setFStatut] = useState("all");
  const [fPeriod, setFPeriod] = useState("all");

  const procName = (id: string | null) => data.processus.find((p) => p.id === id)?.name ?? "—";
  const last = useMemo(() => lastTestedMap(data.tests), [data.tests]);
  const critical = data.processus.filter((p) => isCritical(p.criticite));

  const kpi = useMemo(() => {
    const covered = critical.filter((p) => last.has(p.id) && monthsSince(last.get(p.id)!) <= 12).length;
    const done = data.tests.filter((t) => t.statut === "TERMINE" || t.statut === "OBJECTIFS_NON_ATTEINTS");
    const success = done.filter((t) => t.statut === "TERMINE").length;
    const late = data.processus.filter((p) => !last.has(p.id) || monthsSince(last.get(p.id)!) > 12).length;
    const tlpts = data.tests.filter((t) => t.est_tlpt);
    const lastTlpt = tlpts.filter((t) => t.statut === "TERMINE").map((t) => new Date(t.date_fin_reelle ?? t.date_planifiee ?? t.created_at)).sort((a, b) => +b - +a)[0];
    const plannedTlpt = tlpts.filter((t) => t.statut === "PLANIFIE" && t.date_planifiee).map((t) => new Date(t.date_planifiee!)).sort((a, b) => +a - +b)[0];
    // DORA : TLPT au moins tous les 3 ans
    const tlptDue = plannedTlpt ?? (lastTlpt ? new Date(lastTlpt.getFullYear() + 3, lastTlpt.getMonth(), lastTlpt.getDate()) : null);
    return {
      coverage: critical.length ? Math.round((covered / critical.length) * 100) : 0, covered,
      success: done.length ? Math.round((success / done.length) * 100) : null, doneCount: done.length,
      late, tlptDue, tlptKnown: !!(lastTlpt || plannedTlpt),
    };
  }, [critical, last, data.tests, data.processus]);

  const priority = critical
    .filter((p) => !last.has(p.id) || monthsSince(last.get(p.id)!) > 12)
    .sort((a, b) => ["Critique", "Sévère", "Majeur"].indexOf(a.criticite) - ["Critique", "Sévère", "Majeur"].indexOf(b.criticite))
    .slice(0, 6);

  const filtered = data.tests.filter((t) => {
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
    return !s || t.titre.toLowerCase().includes(s) || (t.reference ?? "").toLowerCase().includes(s) || procName(t.processus_id).toLowerCase().includes(s);
  });

  const openTest = data.tests.find((t) => t.id === openId);
  if (openTest) return <TestRunner test={openTest} data={data} onBack={() => setOpenId(null)} />;

  const TestRow = ({ t }: { t: TestPca }) => {
    const p = data.processus.find((x) => x.id === t.processus_id);
    return (
      <button onClick={() => setOpenId(t.id)}
        className="w-full text-left grid grid-cols-[110px_1fr_auto] sm:grid-cols-[110px_1fr_160px_110px_auto] items-center gap-4 px-5 py-3 border-l-[3px] hover:bg-[#FCFBF8] transition"
        style={{ borderColor: p ? CRIT_ACCENT[p.criticite] : "transparent" }}>
        <span className="text-xs font-mono text-[#3B4454]/70">{t.reference ?? "—"}</span>
        <span>
          <span className="block text-sm font-medium text-[#172030]">{t.titre}{t.est_tlpt && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-[#172030] text-white">TLPT</span>}</span>
          <span className="block text-xs text-[#3B4454]/70">{TYPE_LABELS[t.type]} · {p?.name ?? "—"}</span>
        </span>
        <span className="hidden sm:block text-xs text-[#3B4454]">{fmtDate(t.date_planifiee)}</span>
        <span className={cn("hidden sm:inline text-[11px] px-2 py-1 rounded-full text-center", STATUT_STYLE[t.statut])}>{STATUT_LABELS[t.statut]}</span>
        <span className="text-[#3B4454]/40">›</span>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#2A5141]">M7 · ISO 22301 · DORA</p>
          <h1 className="font-['Playfair_Display'] text-3xl text-[#172030]">Exercices PCA</h1>
        </div>
        <Button className="bg-[#2A5141] hover:bg-[#21402F]" onClick={() => setWizard(true)} disabled={!data.schemaReady}>
          <Plus className="h-4 w-4 mr-1" />Planifier un exercice
        </Button>
      </div>

      <nav className="flex gap-6 border-b border-[#E8E4DC]">
        {([["overview", "Vue d'ensemble"], ["list", "Tests"], ["conformite", "Conformité"]] as [Tab, string][]).map(([id, l]) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn("pb-2 text-sm -mb-px border-b-2 transition", tab === id ? "border-[#2A5141] text-[#172030] font-semibold" : "border-transparent text-[#3B4454]/70 hover:text-[#172030]")}>
            {l}
          </button>
        ))}
      </nav>

      {data.loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-[#2A5141]" /></div>
      ) : !data.schemaReady ? (
        <div className={cn(card, "p-6 text-sm text-[#3B4454]")}>
          Les tables du module ne sont pas encore créées. Exécutez le script <code>supabase/manual/2026-10-01_module_exercices.sql</code> dans l'éditeur SQL.
        </div>
      ) : (
        <>
          {tab === "overview" && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { icon: Target, l: "Couverture processus critiques", v: `${kpi.coverage}%`, s: `${kpi.covered}/${critical.length} testés < 12 mois` },
                  { icon: ShieldCheck, l: "Taux de réussite", v: kpi.success === null ? "—" : `${kpi.success}%`, s: `${kpi.doneCount} test(s) clôturé(s)` },
                  { icon: AlertTriangle, l: "Processus en retard", v: kpi.late, s: "non testés depuis > 12 mois" },
                  { icon: CalendarClock, l: "Prochaine échéance TLPT", v: data.dora ? (kpi.tlptDue ? kpi.tlptDue.toLocaleDateString("fr-FR") : "À planifier") : "N/A", s: data.dora ? "DORA · cycle de 3 ans" : "Entité non assujettie DORA" },
                ].map((k) => (
                  <div key={k.l} className={cn(card, "p-5")}>
                    <k.icon className="h-4 w-4 text-[#2A5141]" />
                    <p className="font-['Playfair_Display'] text-3xl text-[#172030] mt-2">{k.v}</p>
                    <p className="text-sm text-[#172030] mt-1">{k.l}</p>
                    <p className="text-xs text-[#3B4454]/60">{k.s}</p>
                  </div>
                ))}
              </div>
              <div className="grid lg:grid-cols-[3fr_2fr] gap-5">
                <section className={card}>
                  <h3 className="font-['Playfair_Display'] text-lg text-[#172030] px-5 pt-5 pb-3">Tests à venir & récents</h3>
                  <div className="divide-y divide-[#F1EEE8]">
                    {data.tests.slice(0, 8).map((t) => <TestRow key={t.id} t={t} />)}
                    {!data.tests.length && <p className="px-5 pb-5 text-sm text-[#3B4454]/60">Aucun exercice planifié.</p>}
                  </div>
                </section>
                <section className={cn(card, "p-5")}>
                  <h3 className="font-['Playfair_Display'] text-lg text-[#172030] mb-3">À tester en priorité</h3>
                  <div className="space-y-2">
                    {priority.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 border-l-[3px]"
                        style={{ background: CRIT_COLORS[p.criticite], borderColor: CRIT_ACCENT[p.criticite] }}>
                        <div>
                          <p className="text-sm font-medium text-[#172030]">{p.name}</p>
                          <p className="text-xs text-[#3B4454]">{p.criticite} · {last.has(p.id) ? `dernier test ${last.get(p.id)!.toLocaleDateString("fr-FR")}` : "jamais testé"}</p>
                        </div>
                      </div>
                    ))}
                    {!priority.length && <p className="text-sm text-[#3B4454]/60">Tous les processus critiques sont à jour.</p>}
                  </div>
                </section>
              </div>
            </>
          )}

          {tab === "list" && (
            <section className={card}>
              <div className="flex flex-wrap gap-2 p-4">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="h-4 w-4 absolute left-3 top-3 text-[#3B4454]/50" />
                  <Input className="pl-9" placeholder="Rechercher (titre, référence, processus)" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                <Select value={fType} onValueChange={setFType}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous types</SelectItem>
                    {(Object.keys(TYPE_LABELS) as TestType[]).map((k) => <SelectItem key={k} value={k}>{TYPE_LABELS[k]}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={fStatut} onValueChange={setFStatut}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous statuts</SelectItem>
                    {(Object.keys(STATUT_LABELS) as TestStatut[]).map((k) => <SelectItem key={k} value={k}>{STATUT_LABELS[k]}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={fPeriod} onValueChange={setFPeriod}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toute période</SelectItem>
                    <SelectItem value="upcoming">À venir</SelectItem>
                    <SelectItem value="past90">90 derniers jours</SelectItem>
                    <SelectItem value="year">Année en cours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="divide-y divide-[#F1EEE8]">
                {filtered.map((t) => <TestRow key={t.id} t={t} />)}
                {!filtered.length && <p className="p-5 text-sm text-[#3B4454]/60">Aucun test ne correspond.</p>}
              </div>
            </section>
          )}

          {tab === "conformite" && (
            <div className="grid lg:grid-cols-[2fr_1fr] gap-5">
              <section className={cn(card, "p-5")}>
                <h3 className="font-['Playfair_Display'] text-lg text-[#172030] mb-4">Couverture par processus critique</h3>
                <div className="space-y-2">
                  {critical.map((p) => {
                    const d = last.get(p.id);
                    const m = d ? monthsSince(d) : null;
                    const ok = m !== null && m <= 12;
                    const pct = m === null ? 0 : Math.max(0, Math.min(100, 100 - (m / 12) * 100));
                    return (
                      <div key={p.id} className="grid grid-cols-[1fr_90px_160px_120px] items-center gap-3 text-sm">
                        <span className="text-[#172030] truncate">{p.name}</span>
                        <span className="text-[11px] px-2 py-0.5 rounded text-center" style={{ background: CRIT_COLORS[p.criticite] }}>{p.criticite}</span>
                        <div className="h-2 rounded-full bg-[#F8F6F2] overflow-hidden"><div className="h-full" style={{ width: `${pct}%`, background: ok ? "#2A5141" : "#C62828" }} /></div>
                        <span className={cn("text-xs", ok ? "text-[#2E7D32]" : "text-[#C62828]")}>{d ? d.toLocaleDateString("fr-FR") : "Jamais testé"}</span>
                      </div>
                    );
                  })}
                  {!critical.length && <p className="text-sm text-[#3B4454]/60">Aucun processus critique identifié dans le BIA.</p>}
                </div>
              </section>
              <section className="rounded-xl bg-[#172030] text-white p-6 shadow-lg">
                <p className="text-xs uppercase tracking-widest text-white/50">DORA · Art. 26</p>
                <h3 className="font-['Playfair_Display'] text-xl mt-1">Tests TLPT</h3>
                {data.dora ? (
                  <>
                    <p className="font-['Playfair_Display'] text-4xl mt-4">{kpi.tlptDue ? kpi.tlptDue.toLocaleDateString("fr-FR") : "À planifier"}</p>
                    <p className="text-sm text-white/70 mt-2">{kpi.tlptKnown ? "Prochaine échéance (cycle de 3 ans)" : "Aucun TLPT réalisé ni planifié."}</p>
                    <p className="text-sm text-white/70 mt-4">{data.tests.filter((t) => t.est_tlpt).length} TLPT enregistré(s)</p>
                  </>
                ) : (
                  <p className="text-sm text-white/70 mt-4">Aucune entité marquée « assujettie DORA ».</p>
                )}
              </section>
            </div>
          )}
        </>
      )}

      <TestWizard open={wizard} onClose={() => setWizard(false)} data={data} onCreated={data.reload} />
    </div>
  );
}
