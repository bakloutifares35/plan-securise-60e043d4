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
  Clock, FilePlus2, CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PlansData } from "./usePlans";
import {
  Plan, PLAN_STATUTS, PLAN_TYPES, PLAN_TYPE_LABEL, STATUT_STYLE, TYPE_STYLE,
  effectiveStatut, fmtDate, isRevisionDue,
} from "./types";

// ---------------- Composants Premium ----------------

const Kpi = ({ label, value, icon: Icon, tone = "default" }: any) => {
  const tones: Record<string, string> = {
    default: "bg-[#F5F3EF] text-[#172030]",
    success: "bg-[#E8F5E9] text-emerald-700",
    warning: "bg-[#FFF8E1] text-amber-700",
    danger: "bg-[#FFEBEE] text-rose-700",
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

const StatutBadge = ({ statut }: { statut: string }) => {
  const s = STATUT_STYLE[statut] || STATUT_STYLE.Brouillon;
  return (
    <span
      className="text-[10px] font-medium rounded-full px-2.5 py-1 whitespace-nowrap"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {statut}
    </span>
  );
};

// ✅ AJOUT : Jauge de progression dynamique
const PlanProgress = ({ planId, data }: { planId: string; data: PlansData }) => {
  const sections = data.planSections.filter((s) => s.plan_id === planId);
  const total = sections.length;
  const done = sections.filter((s) => s.statut === "Rédigé").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="mt-4">
      <div className="flex justify-between text-[10px] text-[#172030]/50 mb-1">
        <span>Rédaction</span>
        <span className="font-medium">{done}/{total} sections</span>
      </div>
      <div className="h-1.5 rounded-full bg-[#E5E2DD] overflow-hidden">
        <div 
          className={cn("h-full rounded-full transition-all duration-500", pct === 100 ? "bg-[#2A5141]" : "bg-[#4A7A6A]")}
          style={{ width: `${pct}%` }}
        />
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
      {/* KPI PREMIUM */}
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

      {/* Liste des plans */}
      {filtered.length === 0 ? (
        <Card className="border border-dashed border-[#E8E4DC] bg-white/60">
          <CardContent className="py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-[#F0F7F4] mx-auto flex items-center justify-center mb-4">
              <FilePlus2 className="h-8 w-8 text-[#2A5141]" />
            </div>
            <p className="text-xl text-[#172030] font-medium" style={{ fontFamily: "Playfair Display, serif" }}>
              Aucun plan pour l'instant
            </p>
            <p className="text-sm text-[#172030]/50 mt-2 max-w-md mx-auto">
              Créez votre premier plan : les 9 sections types seront générées automatiquement.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => {
            const statut = effectiveStatut(p);
            const ts = TYPE_STYLE[p.type || "PCA"] || TYPE_STYLE.PCA;
            const due = isRevisionDue(p);

            return (
              <Card
                key={p.id}
                className={cn(
                  "border rounded-xl shadow-sm bg-white hover:shadow-md transition-all cursor-pointer overflow-hidden",
                  due ? "border-rose-200" : "border-[#E8E4DC]"
                )}
                onClick={() => onOpen(p.id)}
              >
                {/* Liseré de couleur selon le statut */}
                <div className="h-1 w-full" style={{ backgroundColor: ts.bg }} />
                
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className="text-[10px] font-semibold rounded-full px-2 py-0.5"
                      style={{ backgroundColor: ts.bg, color: ts.text }}
                      title={PLAN_TYPE_LABEL[p.type || "PCA"]}
                    >
                      {p.type}
                    </span>
                    <StatutBadge statut={statut} />
                  </div>

                  <div>
                    <p className="text-lg font-semibold text-[#172030] leading-snug" style={{ fontFamily: "Playfair Display, serif" }}>
                      {p.titre}
                    </p>
                    <p className="text-xs text-[#172030]/45 mt-1">
                      Version {p.numero_version ?? 1} · Rédacteur : {p.redacteur || "—"}
                    </p>
                  </div>

                  {/* ✅ Jauge de progression DYNAMIQUE */}
                  <PlanProgress planId={p.id} data={data} />

                  <div className="flex items-center gap-2 text-xs text-[#172030]/55">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Révision : {fmtDate(p.date_revision_suivante)}
                  </div>

                  {due && (
                    <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 rounded-lg px-2.5 py-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      Révision dépassée — le plan doit être mis à jour.
                    </div>
                  )}

                  <div className="flex items-center gap-1 pt-1" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" className="text-[#2A5141]" onClick={() => onOpen(p.id)}>
                      <Eye className="h-3.5 w-3.5 mr-1" /> Ouvrir
                    </Button>
                    <Button size="sm" variant="ghost" className="text-[#172030]/60" onClick={() => duplicatePlan(p)}>
                      <Copy className="h-3.5 w-3.5 mr-1" /> Dupliquer
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-rose-600 ml-auto"
                      onClick={() => {
                        if (confirm(`Supprimer le plan « ${p.titre} » ?`)) deletePlan(p.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
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