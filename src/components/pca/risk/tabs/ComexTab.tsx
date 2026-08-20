import { useState, useMemo, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle, Activity, ShieldCheck, TrendingDown,
  Sparkles, Clock, Download, RefreshCw, ChevronRight, Grid3x3, PieChart as PieIcon,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/db";
import type { RiskData } from "../useRiskData";
import { scoreToNiveau } from "../riskModel";

type Props = { data: RiskData };

type Measure = { id: string; risque_id: string; mesure: string };

// ============================================================
// PALETTE RESILLIA
// ============================================================
const C = {
  navy: "#172030",
  cream: "#F8F6F2",
  forest: "#2A5141",
  border: "#E8E4DC",
  white: "#FFFFFF",
};

const LEVELS = {
  Critique: { bg: "#FFEBEE", text: "#C62828", chip: "bg-[#FFEBEE] text-[#C62828]" },
  "Élevé": { bg: "#FBE9E7", text: "#D84315", chip: "bg-[#FBE9E7] text-[#D84315]" },
  "Modéré": { bg: "#FFF8E1", text: "#F57F17", chip: "bg-[#FFF8E1] text-[#F57F17]" },
  Faible: { bg: "#E8F5E9", text: "#2E7D32", chip: "bg-[#E8F5E9] text-[#2E7D32]" },
} as const;

type LevelKey = keyof typeof LEVELS;

const lvl = (l?: string) => LEVELS[(l as LevelKey)] ?? LEVELS.Faible;

const CARD = "bg-white rounded-xl border border-[#E8E4DC] shadow-[0_1px_3px_rgba(23,32,48,0.06)]";

// ============================================================
// SOUS-COMPOSANTS
// ============================================================

const SectionTitle = ({ icon: Icon, children, right }: any) => (
  <div className="flex items-center justify-between mb-3">
    <div className="flex items-center gap-2">
      {Icon && <Icon className="h-3.5 w-3.5 text-[#2A5141]" />}
      <h2 className="font-serif text-[13px] font-semibold text-[#172030]">{children}</h2>
    </div>
    {right}
  </div>
);

const KpiCard = ({ label, value, sub, icon: Icon, tone, trend }: {
  label: string; value: string | number; sub: string; icon: any;
  tone: { bg: string; text: string }; trend?: string;
}) => (
  <div className={cn(CARD, "h-[135px] p-5 flex items-start justify-between")}>
    <div className="flex flex-col justify-between h-full min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#172030]/45">{label}</p>
      <p className="font-serif text-[32px] leading-none font-bold text-[#172030]">{value}</p>
      <div className="flex items-center gap-1.5 min-w-0">
        <p className="text-[11px] text-[#172030]/50 truncate">{sub}</p>
        {trend && (
          <span
            className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
            style={{ backgroundColor: tone.bg, color: tone.text }}
          >
            {trend}
          </span>
        )}
      </div>
    </div>
    <div
      className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
      style={{ backgroundColor: tone.bg }}
    >
      <Icon className="h-5 w-5" style={{ color: tone.text }} />
    </div>
  </div>
);

const Gauge = ({ value }: { value: number }) => {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(100, Math.max(0, value)) / 100) * circ;
  return (
    <div className="relative h-[96px] w-[96px] shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#EFEBE4" strokeWidth="10" />
        <circle
          cx="50" cy="50" r={r} fill="none" stroke={C.forest} strokeWidth="10"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-serif text-[20px] font-bold text-[#172030] leading-none">{value}%</span>
        <span className="text-[8px] uppercase tracking-wider text-[#172030]/40 mt-0.5">couvert</span>
      </div>
    </div>
  );
};

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================
export const ComexTab = ({ data }: Props) => {
  const { risques, reload } = data;
  const exportRef = useRef<HTMLDivElement>(null);

  const [selectedCell, setSelectedCell] = useState<{ p: number; i: number } | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);

  // ---- Mesures réelles (plans_traitement)
  const [allMeasures, setAllMeasures] = useState<Measure[]>([]);
  const [loadingMeasures, setLoadingMeasures] = useState(false);

  useEffect(() => {
    const loadMeasures = async () => {
      setLoadingMeasures(true);
      try {
        const { data: measuresData, error } = await supabase
          .from("plans_traitement")
          .select("id, risque_id, mesure");
        if (error) throw error;
        setAllMeasures(measuresData || []);
      } catch (error) {
        console.error("Erreur chargement mesures pour le dashboard:", error);
      } finally {
        setLoadingMeasures(false);
      }
    };
    loadMeasures();
  }, []);

  // ---- Logique métier (inchangée)
  const enriched = useMemo(
    () => risques.map((r) => ({ ...r, niveauCalc: r.niveau || scoreToNiveau(r.score_residuel || 1) })),
    [risques]
  );

  const filteredRisks = useMemo(() => {
    return enriched.filter((r) => {
      const matchCell = !selectedCell || (r.probabilite === selectedCell.p && r.impact === selectedCell.i);
      const matchLevel = !selectedLevel || r.niveauCalc === selectedLevel;
      return matchCell && matchLevel;
    });
  }, [enriched, selectedCell, selectedLevel]);

  const total = filteredRisks.length;
  const critiques = filteredRisks.filter((r) => r.niveauCalc === "Critique").length;
  const eleves = filteredRisks.filter((r) => r.niveauCalc === "Élevé").length;
  const moderes = filteredRisks.filter((r) => r.niveauCalc === "Modéré").length;
  const faibles = filteredRisks.filter((r) => r.niveauCalc === "Faible").length;

  const scoreMoyen = total ? filteredRisks.reduce((s, r) => s + (r.score_residuel || 0), 0) / total : 0;
  const reduction = (() => {
    const brut = filteredRisks.reduce((s, r) => s + (r.score_brut || 0), 0);
    const res = filteredRisks.reduce((s, r) => s + (r.score_residuel || 0), 0);
    return brut ? Math.round(((brut - res) / brut) * 100) : 0;
  })();

  const risqueIdsAvecMesures = useMemo(() => new Set(allMeasures.map((m) => m.risque_id)), [allMeasures]);
  const withMesures = filteredRisks.filter((r) => risqueIdsAvecMesures.has(r.id)).length;
  const sansMesures = total - withMesures;
  const couvertureMesures = total > 0 ? Math.round((withMesures / total) * 100) : 0;
  const sansResponsable = filteredRisks.filter((r) => !r.owner || r.owner.trim() === "").length;

  const lastUpdateDate = useMemo(() => {
    if (risques.length === 0) return null;
    const dates = risques
      .map((r) => {
        if (r.updated_at) return new Date(r.updated_at);
        if (r.date_identification) return new Date(r.date_identification);
        return null;
      })
      .filter((d): d is Date => d !== null && !isNaN(d.getTime()));
    if (dates.length === 0) return null;
    const latest = new Date(Math.max(...dates.map((d) => d.getTime())));
    return latest.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  }, [risques]);

  const topRisks = useMemo(
    () => [...filteredRisks].sort((a, b) => (b.score_residuel || 0) - (a.score_residuel || 0)).slice(0, 5),
    [filteredRisks]
  );

  const matrix = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of enriched) {
      if (selectedLevel && r.niveauCalc !== selectedLevel) continue;
      const key = `${r.probabilite}-${r.impact}`;
      map[key] = (map[key] || 0) + 1;
    }
    return map;
  }, [enriched, selectedLevel]);

  const cellTone = (score: number, count: number) => {
    if (count === 0) return { bg: "#FAF9F6", text: "#C9C4BA" };
    if (score <= 6) return LEVELS.Faible;
    if (score <= 12) return LEVELS["Modéré"];
    if (score <= 18) return LEVELS["Élevé"];
    return LEVELS.Critique;
  };

  const donut = useMemo(
    () => [
      { name: "Critique", value: critiques, color: LEVELS.Critique.text, bg: LEVELS.Critique.bg },
      { name: "Élevé", value: eleves, color: LEVELS["Élevé"].text, bg: LEVELS["Élevé"].bg },
      { name: "Modéré", value: moderes, color: LEVELS["Modéré"].text, bg: LEVELS["Modéré"].bg },
      { name: "Faible", value: faibles, color: LEVELS.Faible.text, bg: LEVELS.Faible.bg },
    ],
    [critiques, eleves, moderes, faibles]
  );
  const donutData = donut.filter((d) => d.value > 0);

  const impactBars = useMemo(
    () =>
      [...filteredRisks]
        .sort((a, b) => (b.score_brut || 0) - (a.score_brut || 0))
        .slice(0, 5)
        .map((r) => {
          const brut = r.score_brut || 0;
          const res = r.score_residuel || 0;
          return {
            id: r.id,
            title: r.title,
            brut,
            res,
            gain: brut ? Math.round(((brut - res) / brut) * 100) : 0,
          };
        }),
    [filteredRisks]
  );

  // ---- Synthèse IA dynamique
  const synthese = useMemo(() => {
    if (total === 0) return "Aucun risque ne correspond à la sélection en cours. Réinitialisez les filtres pour afficher l'ensemble du portefeuille.";
    const partCritique = Math.round(((critiques + eleves) / total) * 100);
    const phrases: string[] = [];
    phrases.push(
      `Le portefeuille compte ${total} risque${total > 1 ? "s" : ""} actif${total > 1 ? "s" : ""}, dont ${critiques + eleves} en zone d'attention (${partCritique} % du portefeuille), pour un score résiduel moyen de ${scoreMoyen.toFixed(1)}/25.`
    );
    phrases.push(
      couvertureMesures >= 75
        ? `La couverture par des mesures de traitement atteint ${couvertureMesures} %, un niveau conforme aux attentes de maîtrise.`
        : `La couverture par des mesures de traitement s'établit à ${couvertureMesures} % : ${sansMesures} risque${sansMesures > 1 ? "s restent" : " reste"} sans plan de traitement formalisé.`
    );
    phrases.push(
      `Les dispositifs en place génèrent une réduction de ${reduction} % entre exposition brute et résiduelle.` +
        (sansResponsable > 0 ? ` ${sansResponsable} risque${sansResponsable > 1 ? "s n'ont" : " n'a"} pas de pilote désigné — point d'arbitrage à porter au COMEX.` : " L'ensemble des risques dispose d'un pilote désigné.")
    );
    return phrases.join(" ");
  }, [total, critiques, eleves, scoreMoyen, couvertureMesures, sansMesures, reduction, sansResponsable]);

  // ---- Export PDF (inchangé)
  const handleExportPDF = async () => {
    try {
      const html2canvas = (await import("html2canvas")).default;
      const jsPDF = (await import("jspdf")).default;
      if (exportRef.current) {
        const canvas = await html2canvas(exportRef.current, { scale: 2, backgroundColor: C.cream, logging: false });
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("l", "mm", "a3");
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
        pdf.save("Resillia_Risques_Dashboard.pdf");
      }
    } catch (error) {
      console.error("Erreur lors de l'export PDF:", error);
    }
  };

  if (loadingMeasures) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center text-[#172030]/50">
          <Clock className="h-7 w-7 mb-2 animate-pulse" />
          <p className="text-sm">Chargement des actions de traitement…</p>
        </div>
      </div>
    );
  }

  const hasFilter = !!selectedCell || !!selectedLevel;

  return (
    <div ref={exportRef} className="bg-[#F8F6F2] max-w-[1440px] mx-auto space-y-4">
      {/* ============ HEADER ============ */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-[26px] leading-tight font-bold text-[#172030]">Analyse des Risques</h1>
          <p className="text-[12px] text-[#172030]/55 mt-0.5 flex items-center gap-2 flex-wrap">
            <span>
              Portefeuille actif · <span className="font-semibold text-[#2A5141]">{risques.length} risques</span> identifiés
            </span>
            {lastUpdateDate && (
              <span className="inline-flex items-center gap-1 text-[10px] text-[#172030]/40 bg-white border border-[#E8E4DC] rounded-full px-2 py-0.5">
                <Clock className="h-2.5 w-2.5" /> MAJ {lastUpdateDate}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasFilter && (
            <button
              onClick={() => { setSelectedCell(null); setSelectedLevel(null); }}
              className="text-[11px] text-[#2A5141] underline underline-offset-2 hover:opacity-70 transition-opacity"
            >
              Réinitialiser la sélection
            </button>
          )}
          <Button
            onClick={handleExportPDF}
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 bg-white border-[#E8E4DC] text-[#172030] hover:bg-[#F8F6F2] hover:text-[#2A5141] text-xs"
          >
            <Download className="h-3.5 w-3.5" /> Exporter
          </Button>
          <Button
            onClick={() => reload()}
            size="sm"
            className="h-8 gap-1.5 bg-[#2A5141] hover:bg-[#2A5141]/90 text-white text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Actualiser
          </Button>
        </div>
      </div>

      {/* ============ KPI ============ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Risques actifs"
          value={total}
          sub={`Score moyen ${scoreMoyen.toFixed(1)}/25`}
          icon={Activity}
          tone={{ bg: "#EFEDE7", text: C.navy }}
          trend={hasFilter ? "filtré" : undefined}
        />
        <KpiCard
          label="Risques critiques"
          value={critiques + eleves}
          sub={`${total > 0 ? Math.round(((critiques + eleves) / total) * 100) : 0}% du portefeuille`}
          icon={AlertTriangle}
          tone={{ bg: LEVELS.Critique.bg, text: LEVELS.Critique.text }}
          trend={critiques > 0 ? `${critiques} critique${critiques > 1 ? "s" : ""}` : undefined}
        />
        <KpiCard
          label="Couverture mesures"
          value={`${couvertureMesures}%`}
          sub={`${withMesures}/${total} risques couverts`}
          icon={ShieldCheck}
          tone={{ bg: LEVELS.Faible.bg, text: C.forest }}
          trend={sansMesures > 0 ? `${sansMesures} sans plan` : "complet"}
        />
        <KpiCard
          label="Réduction du risque"
          value={`${reduction}%`}
          sub="Écart brut → résiduel"
          icon={TrendingDown}
          tone={{ bg: "#EAF0ED", text: C.forest }}
          trend={sansResponsable > 0 ? `${sansResponsable} sans pilote` : undefined}
        />
      </div>

      {/* ============ TOP RISQUES + MATRICE ============ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* TOP RISQUES */}
        <div className={cn(CARD, "lg:col-span-3 p-5")}>
          <SectionTitle
            icon={AlertTriangle}
            right={<span className="text-[10px] text-[#172030]/35">Cliquez pour filtrer la matrice</span>}
          >
            Top risques à traiter
          </SectionTitle>
          <div className="space-y-1">
            {topRisks.length === 0 ? (
              <div className="py-10 text-center text-sm text-[#172030]/35">Aucun risque ne correspond à la sélection</div>
            ) : (
              topRisks.map((risk, idx) => {
                const s = lvl(risk.niveauCalc);
                const active = selectedCell?.p === risk.probabilite && selectedCell?.i === risk.impact;
                const couvert = risqueIdsAvecMesures.has(risk.id);
                return (
                  <button
                    key={risk.id}
                    onClick={() =>
                      setSelectedCell(active ? null : { p: risk.probabilite, i: risk.impact })
                    }
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all duration-150",
                      active
                        ? "bg-[#F8F6F2] border-[#2A5141]"
                        : "bg-white border-transparent hover:bg-[#FAF9F6] hover:border-[#E8E4DC]"
                    )}
                  >
                    <span className="font-serif text-[11px] font-bold text-[#172030]/25 w-4 shrink-0">
                      {idx + 1}
                    </span>
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: s.text }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-[#172030] truncate" title={risk.title}>
                        {risk.title}
                      </p>
                      <p className="text-[10px] text-[#172030]/45 truncate">
                        {risk.owner?.trim() || "Sans pilote"} · P{risk.probabilite} × I{risk.impact}
                        {risk.category ? ` · ${risk.category}` : ""}
                      </p>
                    </div>
                    {!couvert && (
                      <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-[#FFEBEE] text-[#C62828] shrink-0">
                        Non couvert
                      </span>
                    )}
                    <span
                      className={cn("text-[9px] font-semibold px-2 py-0.5 rounded-full shrink-0", s.chip)}
                    >
                      {risk.niveauCalc}
                    </span>
                    <span className="font-serif text-[15px] font-bold text-[#172030] w-7 text-right shrink-0">
                      {risk.score_residuel || 0}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* MATRICE */}
        <div className={cn(CARD, "lg:col-span-2 p-5")}>
          <SectionTitle icon={Grid3x3}>Matrice probabilité / impact</SectionTitle>
          <div className="max-w-[400px] mx-auto">
            <div className="flex">
              <div className="flex flex-col justify-center pr-1.5">
                <span className="text-[8px] uppercase tracking-wider text-[#172030]/40 [writing-mode:vertical-rl] rotate-180 text-center">
                  Probabilité
                </span>
              </div>
              <div className="flex-1">
                <div className="grid grid-cols-[14px_repeat(5,1fr)] gap-1">
                  {[5, 4, 3, 2, 1].map((p) => (
                    <>
                      <div key={`l-${p}`} className="flex items-center justify-center text-[9px] text-[#172030]/35 font-medium">
                        {p}
                      </div>
                      {[1, 2, 3, 4, 5].map((i) => {
                        const count = matrix[`${p}-${i}`] || 0;
                        const tone = cellTone(p * i, count);
                        const active = selectedCell?.p === p && selectedCell?.i === i;
                        return (
                          <button
                            key={`${p}-${i}`}
                            disabled={count === 0}
                            onClick={() => setSelectedCell(active ? null : { p, i })}
                            title={`P${p} × I${i} — ${count} risque(s)`}
                            className={cn(
                              "aspect-square rounded-md flex items-center justify-center font-serif text-[13px] font-bold transition-transform duration-150 border",
                              count > 0 && "hover:scale-105 cursor-pointer",
                              active ? "border-[#2A5141] border-2" : "border-transparent"
                            )}
                            style={{ backgroundColor: tone.bg, color: tone.text }}
                          >
                            {count || ""}
                          </button>
                        );
                      })}
                    </>
                  ))}
                  <div />
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={`b-${i}`} className="text-center text-[9px] text-[#172030]/35 font-medium pt-0.5">
                      {i}
                    </div>
                  ))}
                </div>
                <p className="text-center text-[8px] uppercase tracking-wider text-[#172030]/40 mt-1">Impact</p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-3 mt-3 pt-3 border-t border-[#E8E4DC]">
              {(Object.keys(LEVELS) as LevelKey[]).map((k) => (
                <span key={k} className="flex items-center gap-1 text-[9px] text-[#172030]/55">
                  <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: LEVELS[k].bg, border: `1px solid ${LEVELS[k].text}33` }} />
                  {k}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ============ RÉPARTITION + COUVERTURE + IMPACT ============ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* RÉPARTITION */}
        <div className={cn(CARD, "p-5")}>
          <SectionTitle icon={PieIcon}>Répartition par niveau</SectionTitle>
          <div className="flex items-center gap-4">
            <div className="h-[100px] w-[100px] shrink-0">
              {donutData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      innerRadius={32}
                      outerRadius={48}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {donutData.map((d) => (
                        <Cell key={d.name} fill={d.bg} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full rounded-full border-[10px] border-[#EFEDE7]" />
              )}
            </div>
            <div className="flex-1 space-y-1">
              {donut.map((d) => {
                const active = selectedLevel === d.name;
                return (
                  <button
                    key={d.name}
                    onClick={() => { setSelectedLevel(active ? null : d.name); setSelectedCell(null); }}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1 rounded-md transition-colors text-left",
                      active ? "bg-[#F8F6F2] ring-1 ring-[#2A5141]" : "hover:bg-[#FAF9F6]"
                    )}
                  >
                    <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.bg, border: `1px solid ${d.color}33` }} />
                    <span className="text-[11px] text-[#172030]/70 flex-1">{d.name}</span>
                    <span className="font-serif text-[13px] font-bold text-[#172030]">{d.value}</span>
                    <span className="text-[9px] text-[#172030]/35 w-8 text-right">
                      {total ? Math.round((d.value / total) * 100) : 0}%
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* COUVERTURE */}
        <div className={cn(CARD, "p-5")}>
          <SectionTitle icon={ShieldCheck}>Couverture par les mesures</SectionTitle>
          <div className="flex items-center gap-5">
            <Gauge value={couvertureMesures} />
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-[#E8F5E9]">
                <span className="text-[11px] text-[#2E7D32]">Avec mesures</span>
                <span className="font-serif text-[15px] font-bold text-[#2E7D32]">{withMesures}</span>
              </div>
              <div className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-[#FFEBEE]">
                <span className="text-[11px] text-[#C62828]">Sans mesures</span>
                <span className="font-serif text-[15px] font-bold text-[#C62828]">{sansMesures}</span>
              </div>
              <div className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-[#F8F6F2]">
                <span className="text-[11px] text-[#172030]/60">Sans pilote</span>
                <span className="font-serif text-[15px] font-bold text-[#172030]">{sansResponsable}</span>
              </div>
            </div>
          </div>
        </div>

        {/* IMPACT */}
        <div className={cn(CARD, "p-5")}>
          <SectionTitle icon={TrendingDown}>Impact des mesures</SectionTitle>
          <div className="space-y-2.5">
            {impactBars.length === 0 ? (
              <div className="py-8 text-center text-sm text-[#172030]/35">Aucune donnée</div>
            ) : (
              impactBars.map((b) => (
                <div key={b.id}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[11px] text-[#172030]/70 truncate" title={b.title}>{b.title}</span>
                    <span className="text-[9px] font-semibold text-[#2E7D32] bg-[#E8F5E9] px-1.5 py-0.5 rounded-full shrink-0">
                      −{b.gain}%
                    </span>
                  </div>
                  <div className="relative h-2 rounded-full bg-[#EFEDE7] overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-[#D9D4CA]"
                      style={{ width: `${(b.brut / 25) * 100}%` }}
                    />
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-[#2A5141] transition-all duration-500"
                      style={{ width: `${(b.res / 25) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
            <div className="flex items-center gap-3 pt-1.5 border-t border-[#E8E4DC]">
              <span className="flex items-center gap-1 text-[9px] text-[#172030]/50">
                <span className="h-2 w-2 rounded-sm bg-[#D9D4CA]" /> Brut
              </span>
              <span className="flex items-center gap-1 text-[9px] text-[#172030]/50">
                <span className="h-2 w-2 rounded-sm bg-[#2A5141]" /> Résiduel
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ============ SYNTHÈSE IA ============ */}
      <div className={cn(CARD, "border-l-[3px] border-l-[#2A5141] p-5 flex items-start gap-4")}>
        <div className="h-9 w-9 rounded-xl bg-[#EAF0ED] flex items-center justify-center shrink-0">
          <Sparkles className="h-4 w-4 text-[#2A5141]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#2A5141] mb-1">
            Synthèse executive
          </p>
          <p className="text-[12.5px] leading-relaxed text-[#172030]/75">{synthese}</p>
        </div>
        <button className="flex items-center gap-1 text-[11px] text-[#2A5141] hover:opacity-70 transition-opacity shrink-0 whitespace-nowrap self-center">
          Voir le registre <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
