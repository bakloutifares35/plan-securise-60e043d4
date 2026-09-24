// src/components/plans/PlanLibrary.tsx
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  FileText, Plus, Search, Copy, Trash2, Eye, AlertTriangle, CheckCircle2,
  Clock, FilePlus2, CalendarClock, MoreVertical, User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PlansData } from "./usePlans";
import {
  Plan, PLAN_STATUTS, PLAN_TYPES, PLAN_TYPE_LABEL, STATUT_STYLE, TYPE_STYLE,
  effectiveStatut, fmtDate, isRevisionDue,
} from "./types";

// ---------------- KPI ----------------
const Kpi = ({ label, value, icon: Icon, tone = "default" }: any) => {
  const tones: Record<string, string> = {
    default: "bg-[#F5F3EF] text-[#172030]",
    success: "bg-[#E8F0EC] text-[#2A5141]",
    warning: "bg-[#FFF8E1] text-[#A38730]",
    danger: "bg-[#FFEBEE] text-[#C62828]",
  };
  return (
    <Card className="border border-[#E8E4DC] rounded-xl shadow-sm bg-white hover:shadow-md transition-shadow">
      <CardContent className="p-5 flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-[#172030]/40 font-medium">{label}</p>
          <p className="text-4xl font-bold text-[#172030]" style={{ fontFamily: "Playfair Display, serif" }}>
            {value}
          </p>
        </div>
        <div className={cn("h-10 w-10 rounded-xl grid place-items-center", tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
};

// ---------------- Statut inline (point + label) ----------------
const StatutInline = ({ statut }: { statut: string }) => {
  const map: Record<string, { dot: string; text: string }> = {
    "Approuvé":     { dot: "#2A5141", text: "#2A5141" },
    "En révision":  { dot: "#B76E1D", text: "#B76E1D" },
    "Brouillon":    { dot: "#17203080", text: "#17203099" },
    "Obsolète":     { dot: "#C62828", text: "#C62828" },
  };
  const s = map[statut] || map["Brouillon"];
  return (
    <span className="inline-flex items-center gap-1.5 text-[10.5px] font-medium whitespace-nowrap">
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: s.dot }}
      />
      <span style={{ color: s.text }}>{statut}</span>
    </span>
  );
};

// ---------------- Anneau de progression ----------------
const ProgressRing = ({ percent }: { percent: number }) => {
  const size = 48;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;

  const color = percent >= 80 ? "#2A5141" : percent >= 30 ? "#B76E1D" : "#17203040";

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#E5E2DD"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 400ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="text-[12px] font-bold tabular-nums"
          style={{
            color: percent >= 80 ? "#2A5141" : percent >= 30 ? "#B76E1D" : "#17203099",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {percent}%
        </span>
      </div>
    </div>
  );
};

// ---------------- Carte plan ----------------
const PlanCard = ({
  plan,
  data,
  onOpen,
  onDuplicate,
  onDelete,
}: {
  plan: Plan;
  data: PlansData;
  onOpen: (id: string) => void;
  onDuplicate: (p: Plan) => void;
  onDelete: (id: string) => void;
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const statut = effectiveStatut(plan);
  const due = isRevisionDue(plan);
  const sections = data.planSections.filter((s) => s.plan_id === plan.id);
  const total = sections.length;
  const done = sections.filter((s) => s.statut === "Rédigé").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div
      className={cn(
        "group relative bg-white border border-[#E8E4DC] rounded-xl shadow-sm cursor-pointer",
        "transition-all duration-200 ease-out",
        "hover:shadow-md hover:-translate-y-1 hover:border-[#172030]/15"
      )}
      onClick={() => onOpen(plan.id)}
      onMouseLeave={() => setMenuOpen(false)}
    >
      <div className="p-4">
        {/* En-tête : badge type + point de statut + menu */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{ backgroundColor: "#F5F3EF", color: "#172030" }}
            >
              {plan.type}
            </span>
            {due && (
              <span
                className="inline-flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{ backgroundColor: "#FFEBEE", color: "#C62828" }}
                title="Révision dépassée"
              >
                <AlertTriangle className="h-2.5 w-2.5" />
                À réviser
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <StatutInline statut={statut} />

            {/* Menu contextuel "..." */}
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((v) => !v);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 h-6 w-6 rounded flex items-center justify-center text-[#172030]/50 hover:text-[#172030] hover:bg-[#F5F3EF] cursor-pointer"
                title="Actions"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>

              {menuOpen && (
                <div
                  className="absolute right-0 top-7 z-20 rounded-lg border border-[#E8E4DC] bg-white shadow-lg overflow-hidden min-w-[140px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-3 py-2 text-[11.5px] text-[#2A5141] hover:bg-[#F8F6F2] transition-colors cursor-pointer"
                    onClick={() => { setMenuOpen(false); onOpen(plan.id); }}
                  >
                    <Eye className="h-3.5 w-3.5" /> Ouvrir
                  </button>
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-3 py-2 text-[11.5px] text-[#172030]/70 hover:bg-[#F8F6F2] transition-colors cursor-pointer"
                    onClick={() => { setMenuOpen(false); onDuplicate(plan); }}
                  >
                    <Copy className="h-3.5 w-3.5" /> Dupliquer
                  </button>
                  <div className="h-px bg-[#E8E4DC]" />
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-3 py-2 text-[11.5px] text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    onClick={() => {
                      setMenuOpen(false);
                      if (confirm(`Supprimer le plan « ${plan.titre} » ?`)) onDelete(plan.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Supprimer
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Corps : titre + ring */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3
              className="text-[15px] font-semibold leading-snug text-[#172030] line-clamp-2"
              style={{ fontFamily: "'Playfair Display', serif" }}
              title={plan.titre}
            >
              {plan.titre || "Sans titre"}
            </h3>
            <p className="text-[11px] text-[#172030]/45 mt-1">
              Version {plan.numero_version ?? 1}
            </p>
          </div>

          <ProgressRing percent={pct} />
        </div>

        {/* Métadonnées */}
        <div className="space-y-1 pt-3 border-t border-[#E8E4DC]/70">
          <div className="flex items-center gap-1.5 text-[11px] text-[#172030]/60">
            <User className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{plan.redacteur || "Rédacteur non défini"}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[#172030]/60">
            <CalendarClock className="h-3 w-3 flex-shrink-0" />
            <span>Révision : {fmtDate(plan.date_revision_suivante)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------- Bibliothèque de plans ----------------

export const PlanLibrary = ({ data, onOpen }: { data: PlansData; onOpen: (id: string) => void }) => {
  const { plans, createPlan, deletePlan, duplicatePlan } = data;
  const [q, setQ] = useState("");
  const [fType, setFType] = useState("all");
  const [fStatut, setFStatut] = useState("all");
  const [openCreate, setOpenCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ titre: "", type: "PCA", redacteur: "", responsable_pca: "" });

  const filtered = useMemo(() => {
    return plans.filter((p) => {
      const s = effectiveStatut(p);
      const matchQ = !q || p.titre?.toLowerCase().includes(q.toLowerCase());
      const matchT = fType === "all" || p.type === fType;
      const matchS = fStatut === "all" || s === fStatut;
      return matchQ && matchT && matchS;
    });
  }, [plans, q, fType, fStatut]);

  const kpis = useMemo(() => {
    const total = plans.length;
    const approuves = plans.filter((p) => effectiveStatut(p) === "Approuvé").length;
    const enRevision = plans.filter((p) => effectiveStatut(p) === "En révision").length;
    const aReviser = plans.filter(isRevisionDue).length;
    return { total, approuves, enRevision, aReviser };
  }, [plans]);

  const submit = async () => {
    if (!form.titre.trim()) return;
    setSaving(true);
    const id = await createPlan(form as Partial<Plan>);
    setSaving(false);
    setOpenCreate(false);
    setForm({ titre: "", type: "PCA", redacteur: "", responsable_pca: "" });
    if (id) onOpen(id);
  };

  return (
    <div className="space-y-6">
      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Plans" value={kpis.total} icon={FileText} />
        <Kpi label="Approuvés" value={kpis.approuves} icon={CheckCircle2} tone="success" />
        <Kpi label="En révision" value={kpis.enRevision} icon={Clock} tone="warning" />
        <Kpi label="À réviser" value={kpis.aReviser} icon={AlertTriangle} tone="danger" />
      </div>

      {/* Barre de recherche & filtres */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#172030]/30" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un plan…"
            className="pl-9 bg-white border-[#E8E4DC]"
          />
        </div>
        <Select value={fType} onValueChange={setFType}>
          <SelectTrigger className="w-[190px] bg-white border-[#E8E4DC]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {PLAN_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fStatut} onValueChange={setFStatut}>
          <SelectTrigger className="w-[190px] bg-white border-[#E8E4DC]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {PLAN_STATUTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => setOpenCreate(true)} className="bg-[#2A5141] hover:bg-[#20402F] text-white">
          <Plus className="h-4 w-4 mr-2" /> Nouveau plan
        </Button>
      </div>

      {/* Grille de cards */}
      {filtered.length === 0 ? (
        <Card className="border border-dashed border-[#E8E4DC] bg-white/60">
          <CardContent className="py-16 text-center">
            <div className="h-14 w-14 rounded-full bg-[#F5F3EF] mx-auto flex items-center justify-center mb-4">
              <FileText className="h-6 w-6 text-[#172030]/40" />
            </div>
            <p className="text-base text-[#172030] font-medium" style={{ fontFamily: "Playfair Display, serif" }}>
              Aucun plan
            </p>
            <p className="text-sm text-[#172030]/50 mt-1.5 max-w-md mx-auto">
              Créez votre premier plan : les 9 sections types seront générées automatiquement.
            </p>
            <Button
              onClick={() => setOpenCreate(true)}
              className="mt-5 bg-[#2A5141] hover:bg-[#20402F] text-white"
            >
              <Plus className="h-4 w-4 mr-2" /> Nouveau plan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              data={data}
              onOpen={onOpen}
              onDuplicate={duplicatePlan}
              onDelete={deletePlan}
            />
          ))}
        </div>
      )}

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Playfair Display, serif" }}>Nouveau plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Titre du plan *</Label>
              <Input
                className="mt-1"
                value={form.titre}
                onChange={(e) => setForm({ ...form, titre: e.target.value })}
                placeholder="Ex : PCA Direction Financière"
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLAN_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t} — {PLAN_TYPE_LABEL[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Rédacteur</Label>
                <Input className="mt-1" value={form.redacteur} onChange={(e) => setForm({ ...form, redacteur: e.target.value })} />
              </div>
              <div>
                <Label>Responsable PCA</Label>
                <Input className="mt-1" value={form.responsable_pca} onChange={(e) => setForm({ ...form, responsable_pca: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreate(false)}>Annuler</Button>
            <Button disabled={saving || !form.titre.trim()} onClick={submit} className="bg-[#2A5141] hover:bg-[#20402F] text-white">
              Créer le plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};