// src/components/plans/CoverageDashboard.tsx
import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { computeMaxScore, scoreToCriticality } from "@/data/bia";
import { PlansData } from "./usePlans";
import { effectiveStatut, isRevisionDue } from "./types";

const CRIT_ORDER: Record<string, number> = { Critique: 1, "Sévère": 2, Majeur: 3, "Modéré": 4, Mineur: 5 };
const CRIT_COLOR: Record<string, { bg: string; text: string }> = {
  Critique: { bg: "#FFEBEE", text: "#C62828" },
  "Sévère": { bg: "#FBE9E7", text: "#D84315" },
  Majeur: { bg: "#FFF3E0", text: "#E65100" },
  "Modéré": { bg: "#FFF8E1", text: "#B26A00" },
  Mineur: { bg: "#E8F5E9", text: "#2E7D32" },
};

export const CoverageDashboard = ({ data, onOpen }: { data: PlansData; onOpen: (id: string) => void }) => {
  const rows = useMemo(() => {
    const byProcess = new Map<string, string[]>();
    data.links.processus.forEach((l) => {
      const arr = byProcess.get(l.processus_id) ?? [];
      arr.push(l.plan_id);
      byProcess.set(l.processus_id, arr);
    });

    return data.processus
      .map((p) => {
        const planIds = byProcess.get(p.id) ?? [];
        const plans = planIds.map((id) => data.plans.find((x) => x.id === id)).filter(Boolean) as any[];
        const level = (p.criticality_level as string) || (scoreToCriticality(computeMaxScore(p.impacts)) as string);
        const approuve = plans.some((pl) => effectiveStatut(pl) === "Approuvé");
        return { proc: p, plans, level, approuve };
      })
      .sort((a, b) => (CRIT_ORDER[a.level] ?? 9) - (CRIT_ORDER[b.level] ?? 9));
  }, [data]);

  const kpis = useMemo(() => {
    const total = rows.length;
    const couverts = rows.filter((r) => r.plans.length > 0).length;
    const approuves = rows.filter((r) => r.approuve).length;
    const critiquesNonCouverts = rows.filter(
      (r) => (r.level === "Critique" || r.level === "Sévère") && r.plans.length === 0
    ).length;
    const obsoletes = data.plans.filter(isRevisionDue).length;
    return {
      total,
      couverts,
      taux: total ? Math.round((couverts / total) * 100) : 0,
      approuves,
      critiquesNonCouverts,
      obsoletes,
    };
  }, [rows, data.plans]);

  const Kpi = ({ label, value, sub, icon: Icon, tone }: any) => {
    const tones: Record<string, string> = {
      default: "text-[#172030] bg-[#F5F3EF]",
      success: "text-emerald-700 bg-emerald-50",
      warning: "text-amber-700 bg-amber-50",
      danger: "text-rose-700 bg-rose-50",
    };
    return (
      <Card className="border border-[#E8E4DC] rounded-xl bg-white shadow-sm">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#172030]/40 font-medium">{label}</p>
            <p className="text-2xl font-bold text-[#172030]" style={{ fontFamily: "Playfair Display, serif" }}>{value}</p>
            {sub && <p className="text-[11px] text-[#172030]/45">{sub}</p>}
          </div>
          <div className={cn("h-10 w-10 rounded-lg grid place-items-center", tones[tone || "default"])}>
            <Icon className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Couverture" value={`${kpis.taux}%`} sub={`${kpis.couverts}/${kpis.total} processus`} icon={ShieldCheck} tone="success" />
        <Kpi label="Plans approuvés" value={kpis.approuves} sub="processus couverts par un plan approuvé" icon={CheckCircle2} />
        <Kpi label="Critiques non couverts" value={kpis.critiquesNonCouverts} icon={ShieldAlert} tone="danger" />
        <Kpi label="Plans obsolètes" value={kpis.obsoletes} sub="révision dépassée" icon={AlertTriangle} tone="warning" />
      </div>

      <Card className="border border-[#E8E4DC] bg-white rounded-xl">
        <CardContent className="p-0">
          <div className="px-5 py-4 border-b border-[#EFEDE7]">
            <p className="text-sm font-semibold text-[#172030]" style={{ fontFamily: "Playfair Display, serif" }}>
              Couverture des processus par les plans
            </p>
            <p className="text-xs text-[#172030]/45">Triée par criticité — les processus sans plan apparaissent en premier.</p>
          </div>
          <div className="divide-y divide-[#F3F1EC]">
            {rows.length === 0 && <p className="p-6 text-sm text-[#172030]/45">Aucun processus BIA disponible.</p>}
            {rows.map(({ proc, plans, level, approuve }) => {
              const c = CRIT_COLOR[level] || CRIT_COLOR["Modéré"];
              return (
                <div key={proc.id} className="px-5 py-3 flex flex-wrap items-center gap-3">
                  <span className="text-[10px] font-semibold rounded-full px-2 py-0.5" style={{ backgroundColor: c.bg, color: c.text }}>
                    {level}
                  </span>
                  <div className="min-w-[180px] flex-1">
                    <p className="text-sm text-[#172030]">{proc.name}</p>
                    <p className="text-[11px] text-[#172030]/40">{proc.direction || "—"} · RTO {proc.rto_hours ?? "—"}h</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {plans.length === 0 ? (
                      <span className="text-[11px] rounded-full px-2 py-0.5 bg-rose-50 text-rose-700 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Aucun plan
                      </span>
                    ) : (
                      plans.map((pl) => (
                        <button
                          key={pl.id}
                          onClick={() => onOpen(pl.id)}
                          className="text-[11px] rounded-full px-2 py-0.5 bg-[#E8F0EC] text-[#2A5141] hover:bg-[#D8E7DE] flex items-center gap-1"
                        >
                          <FileText className="h-3 w-3" /> {pl.titre}
                        </button>
                      ))
                    )}
                    {plans.length > 0 && !approuve && (
                      <span className="text-[11px] rounded-full px-2 py-0.5 bg-amber-50 text-amber-700">Non approuvé</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
