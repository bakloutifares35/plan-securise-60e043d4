// src/components/strategy/StrategyModule.tsx
import { functionsClient } from "@/integrations/supabase/functionsClient";
import { useMemo, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  Layers, CheckCircle2, AlertTriangle, FileWarning,
  Plus, ArrowLeft, ArrowRight, Users, Monitor, Server, Handshake,
  Building, Shield, Box, Clock, Sparkles, Loader2, List, LayoutGrid,
  AlertCircle, Pencil, Trash2, Activity, Gauge, Target,
  ChevronRight, PieChart as PieChartIcon, Search, LayoutDashboard, Table,
  ArrowLeftRight, RefreshCw, CalendarClock, FileText, Building2, Link2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/resillia/client";
import { useStrategyData } from "./useStrategyData";
import { CatalogueTab } from "./tabs/CatalogueTab";
import { computeMaxScore, scoreToCriticality } from "@/data/bia";
import {
  STATUT_STYLE, EFFORT_STYLE, checkRto, isStale,
  type Effort, type StrategieAssociation,
} from "./types";

type AppView = "overview" | "catalog" | "gaps" | "create";
type ViewMode = "list" | "grid";
type CriticalityFilter = "all" | "Critique" | "Sévère" | "Majeur" | "Modéré" | "Mineur";

// ============================================================
// COULEURS
// ============================================================
const CRITICALITY_COLORS = {
  "Critique": { bg: "#FFEBEE", text: "#C62828", border: "#EF9A9A" },
  "Sévère": { bg: "#FBE9E7", text: "#D84315", border: "#FFAB91" },
  "Majeur": { bg: "#FFF3E0", text: "#E65100", border: "#FFCC80" },
  "Modéré": { bg: "#FFF8E1", text: "#F57F17", border: "#FFE082" },
  "Mineur": { bg: "#E8F5E9", text: "#2E7D32", border: "#A5D6A7" },
};

// ============================================================
// DESIGN SYSTEM
// ============================================================
const FieldInput = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <Input
    {...props}
    className={cn(
      "h-11 bg-white text-[15px] text-[#172030] rounded-lg px-4",
      "border border-[#E8E4DC] shadow-[inset_0_1px_2px_rgba(23,32,48,0.04)]",
      "placeholder:text-[#172030]/30 transition-all duration-150",
      "focus-visible:outline-none focus-visible:border-[#2A5141] focus-visible:ring-2 focus-visible:ring-[#2A5141]/15 focus-visible:shadow-none",
      "hover:border-[#172030]/20",
      "disabled:bg-[#F8F6F2] disabled:text-[#172030]/50 disabled:cursor-not-allowed",
      className
    )}
  />
);

const FieldTextarea = ({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <Textarea
    {...props}
    className={cn(
      "bg-white text-[14px] text-[#172030] rounded-lg px-4 py-3",
      "border border-[#E8E4DC] shadow-[inset_0_1px_2px_rgba(23,32,48,0.04)]",
      "placeholder:text-[#172030]/30 resize-none transition-all duration-150",
      "focus-visible:outline-none focus-visible:border-[#2A5141] focus-visible:ring-2 focus-visible:ring-[#2A5141]/15 focus-visible:shadow-none",
      "hover:border-[#172030]/20",
      className
    )}
  />
);

const AutoSourceChip = () => (
  <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-[#E8F0EC] text-[#2A5141] border border-[#2A5141]/15 px-2 py-0.5 rounded-full">
    <Link2 className="h-3 w-3" />
    Auto BIA
  </span>
);

const ProcessSummaryCard = ({ process, criticality }: { process: any; criticality: string }) => {
  const critStyle = CRITICALITY_COLORS[criticality as keyof typeof CRITICALITY_COLORS] || { bg: "#F1EFE8", text: "#172030" };
  const rto = process.rto_hours;
  const rtoSerre = rto != null && rto <= 4 && criticality === "Critique";
  return (
    <div className="rounded-xl border border-[#E8E4DC] bg-gradient-to-br from-white to-[#FAF9F6] p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 rounded-lg bg-[#172030] text-white flex items-center justify-center flex-shrink-0 shadow-sm">
          <Building2 className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#172030]/40">
              Processus sélectionné
            </span>
            {rtoSerre && (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider bg-[#FBE9E7] text-[#C62828] border border-[#C62828]/20 px-1.5 py-0.5 rounded">
                <AlertTriangle className="h-2.5 w-2.5" />
                RTO serré
              </span>
            )}
          </div>
          <p className="font-medium text-[#172030] text-[15px] truncate" style={{ fontFamily: "'Playfair Display', serif" }}>
            {process.name}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md" style={{ backgroundColor: critStyle.bg, color: critStyle.text }}>
              {criticality}
            </span>
            <span className="text-[11px] text-[#172030]/60">
              RTO <span className="font-mono font-semibold text-[#172030]">{rto ?? "—"}h</span>
            </span>
            {process.rpo_hours != null && (
              <span className="text-[11px] text-[#172030]/60">
                RPO <span className="font-mono font-semibold text-[#172030]">{process.rpo_hours}h</span>
              </span>
            )}
            {process.owner && <span className="text-[11px] text-[#172030]/50 truncate">• {process.owner}</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

const SectionCard = ({
  title, subtitle, icon: Icon, step, variant = "white", children,
}: {
  title: string;
  subtitle?: string;
  icon?: any;
  step?: string;
  variant?: "white" | "cream";
  children: React.ReactNode;
}) => (
  <div className={cn("rounded-2xl border border-[#E8E4DC] p-6 md:p-7 shadow-sm", variant === "white" ? "bg-white" : "bg-[#FBF9F5]")}>
    <div className="flex items-start gap-3 mb-6 pb-5 border-b border-[#E8E4DC]/70">
      {Icon && (
        <div className="h-9 w-9 rounded-lg bg-[#172030] text-white flex items-center justify-center flex-shrink-0">
          <Icon className="h-4 w-4" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        {step && (
          <span className="inline-block text-[9px] font-bold uppercase tracking-[0.14em] text-[#2A5141] mb-1">{step}</span>
        )}
        <h3 className="font-semibold text-[#172030] text-lg leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
          {title}
        </h3>
        {subtitle && <p className="text-[13px] text-[#172030]/50 mt-1 leading-relaxed">{subtitle}</p>}
      </div>
    </div>
    {children}
  </div>
);

const ScenarioPill = ({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: (v: boolean) => void }) => (
  <button
    type="button"
    onClick={() => onToggle(!checked)}
    className={cn(
      "group flex items-center gap-2 px-3.5 py-2 rounded-full text-[13px] font-medium transition-all duration-150 border",
      checked
        ? "bg-[#2A5141] text-white border-[#2A5141] shadow-sm shadow-[#2A5141]/20"
        : "bg-white text-[#172030]/70 border-[#E8E4DC] hover:border-[#2A5141]/40 hover:bg-[#F8F6F2]"
    )}
  >
    <span className={cn("flex items-center justify-center h-4 w-4 rounded-full transition-all flex-shrink-0", checked ? "bg-white/20" : "bg-[#F1EFE8] group-hover:bg-white")}>
      {checked ? <CheckCircle2 className="h-2.5 w-2.5 text-white" /> : <span className="h-1.5 w-1.5 rounded-full bg-[#172030]/20" />}
    </span>
    <span>{label}</span>
  </button>
);

const WizardStepper = ({ steps, current }: { steps: { num: number; label: string; icon: any }[]; current: number }) => (
  <div className="relative">
    <div className="flex items-start justify-between gap-2 md:gap-4">
      {steps.map((s, i) => {
        const Icon = s.icon;
        const isActive = s.num === current;
        const isDone = s.num < current;
        const isLast = i === steps.length - 1;
        return (
          <div key={s.num} className="flex-1 flex items-start gap-2 md:gap-3 relative">
            <div className="flex flex-col items-center flex-shrink-0 relative z-10">
              <div className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center transition-all duration-300 border-2",
                isDone && "bg-[#2A5141] border-[#2A5141] text-white shadow-sm shadow-[#2A5141]/30",
                isActive && "bg-[#2A5141] border-[#2A5141] text-white shadow-md shadow-[#2A5141]/30 ring-4 ring-[#2A5141]/10",
                !isActive && !isDone && "bg-white border-[#E8E4DC] text-[#172030]/40"
              )}>
                {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <div className="mt-2 text-center hidden md:block">
                <p className={cn("text-[10px] font-bold uppercase tracking-wider leading-none",
                  isActive ? "text-[#2A5141]" : isDone ? "text-[#2A5141]/70" : "text-[#172030]/30")}>
                  Étape {s.num}
                </p>
                <p className={cn("text-[11px] mt-0.5 leading-tight whitespace-nowrap",
                  isActive ? "text-[#172030] font-semibold" : isDone ? "text-[#172030]/60" : "text-[#172030]/35")}>
                  {s.label}
                </p>
              </div>
            </div>
            {!isLast && (
              <div className="flex-1 h-0.5 mt-5 rounded-full transition-all duration-500 relative overflow-hidden bg-[#E8E4DC]">
                <div className="absolute inset-y-0 left-0 bg-[#2A5141] rounded-full transition-all duration-500"
                  style={{ width: isDone ? "100%" : isActive ? "50%" : "0%" }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
);

const ResourceCard = ({ item, category }: { item: any; category: string }) => {
  const config: any = {
    'Ressources humaines': { icon: Users, bg: "#EDF2F7", text: "#38536F", accent: "#5B7896" },
    'Applications IT': { icon: Server, bg: "#F5F0FA", text: "#6A4A8A", accent: "#8E6DB1" },
    'Équipements': { icon: Monitor, bg: "#FFF3E0", text: "#B76E1D", accent: "#EF9F27" },
    'Prestataires': { icon: Handshake, bg: "#FCE4EC", text: "#AD1457", accent: "#E91E63" },
  }[category] || { icon: Box, bg: "#F1EFE8", text: "#172030", accent: "#8C7566" };
  const Icon = config.icon;
  const initials = category === 'Ressources humaines'
    ? (item.name || "?").split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()
    : null;
  return (
    <div className="group flex items-center gap-2.5 p-2.5 rounded-lg bg-white border border-[#E8E4DC] hover:border-[#172030]/15 hover:shadow-sm transition-all">
      {initials ? (
        <div className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ backgroundColor: config.bg, color: config.text }}>
          {initials}
        </div>
      ) : (
        <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: config.bg }}>
          <Icon className="h-3.5 w-3.5" style={{ color: config.text }} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-[#172030] truncate leading-tight">{item.name}</p>
        {item.role && <p className="text-[10px] text-[#172030]/50 truncate mt-0.5">{item.role}</p>}
      </div>
      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: config.accent }} />
    </div>
  );
};

const ResourceGroup = ({ category, items }: { category: string; items: any[] }) => {
  if (items.length === 0) return null;
  const config: any = {
    'Ressources humaines': { icon: Users, color: "#38536F" },
    'Applications IT': { icon: Server, color: "#6A4A8A" },
    'Équipements': { icon: Monitor, color: "#B76E1D" },
    'Prestataires': { icon: Handshake, color: "#AD1457" },
  }[category] || { icon: Box, color: "#172030" };
  const Icon = config.icon;
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" style={{ color: config.color }} />
        <span className="text-[12px] font-semibold text-[#172030] uppercase tracking-wider">{category}</span>
        <span className="text-[10px] font-medium bg-[#F1EFE8] text-[#172030]/60 px-2 py-0.5 rounded-full">{items.length}</span>
      </div>
      <div className="grid grid-cols-1 gap-1.5">
        {items.map((item: any) => <ResourceCard key={item.id} item={item} category={category} />)}
      </div>
    </div>
  );
};

// ============================================================
// KPI CARD — Discipline chromatique
// Fond neutre par défaut. La couleur n'apparaît QUE sur le chiffre
// et l'icône, ET uniquement si la valeur représente une anomalie réelle.
// Variant "critical" : réservé à LA seule métrique la plus urgente.
// ============================================================
const KpiCard = ({
  label, value, subLabel, icon: Icon, tone = "neutral", className, onClick, variant = "default", badge,
}: {
  label: string;
  value: string | number;
  subLabel?: string;
  icon: any;
  tone?: "neutral" | "alert" | "success" | "info";
  className?: string;
  onClick?: () => void;
  variant?: "default" | "critical";
  badge?: { label: string; bg: string; text: string };
}) => {
  const isCritical = variant === "critical";

  const toneColor = {
    neutral: { value: "#172030", icon: "#17203080", iconBg: "#F5F3EF" },
    alert:   { value: "#C62828", icon: "#C62828",   iconBg: "#FFEBEE" },
    success: { value: "#2A5141", icon: "#2A5141",   iconBg: "#E8F0EC" },
    info:    { value: "#38536F", icon: "#38536F",   iconBg: "#EDF2F7" },
  }[tone];

  return (
    <Card
      className={cn(
        "border rounded-xl transition-all group relative overflow-hidden bg-white",
        "border-[#E8E4DC]",
        isCritical
          ? "shadow-md hover:shadow-lg"
          : "shadow-sm hover:shadow-md hover:-translate-y-0.5",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {isCritical && (
        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: "#C62828" }} />
      )}

      <CardContent className={cn("flex items-start justify-between", isCritical ? "p-6 pl-7" : "p-5")}>
        <div className="space-y-1.5 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              "font-semibold uppercase tracking-wider block",
              isCritical ? "text-[11px] text-[#172030]/70" : "text-[10px] text-[#172030]/45"
            )}>
              {label}
            </span>
            {badge && (
              <span
                className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{ backgroundColor: badge.bg, color: badge.text }}
              >
                {badge.label}
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-2">
            <span
              className={cn("font-bold leading-none", isCritical ? "text-4xl" : "text-3xl")}
              style={{
                fontFamily: "'Playfair Display', serif",
                color: tone === "neutral" ? "#172030" : toneColor.value,
              }}
            >
              {value}
            </span>
            {subLabel && (
              <span className={cn("font-medium text-[#172030]/40 whitespace-nowrap",
                isCritical ? "text-sm" : "text-xs")}>
                {subLabel}
              </span>
            )}
          </div>
        </div>

        <div
          className={cn(
            "rounded-xl flex items-center justify-center flex-shrink-0 transition-all group-hover:scale-105",
            isCritical ? "h-12 w-12" : "h-10 w-10"
          )}
          style={{ backgroundColor: toneColor.iconBg }}
        >
          <Icon
            className={cn(isCritical ? "h-5 w-5" : "h-4.5 w-4.5")}
            style={{ color: toneColor.icon }}
          />
        </div>
      </CardContent>
    </Card>
  );
};

// ============================================================
// CRITICALITY CARD
// ============================================================
const CriticalityCard = ({ data, coveragePercent = 0 }: { data: any[]; coveragePercent?: number }) => {
  const total = data.length;
  const levels = [
    { label: "Critique", key: "Critique", weight: 5 },
    { label: "Sévère", key: "Sévère", weight: 4 },
    { label: "Majeur", key: "Majeur", weight: 3 },
    { label: "Modéré", key: "Modéré", weight: 2 },
    { label: "Mineur", key: "Mineur", weight: 1 },
  ];
  const counts = levels.map(level => ({
    ...level,
    count: data.filter(p => p.calculatedLevel === level.key).length,
    color: CRITICALITY_COLORS[level.key as keyof typeof CRITICALITY_COLORS] || CRITICALITY_COLORS["Mineur"]
  }));
  const pieData = counts.filter(d => d.count > 0).map(d => ({
    name: d.label, value: d.count, color: d.color.bg, borderColor: d.color.border,
  }));
  const maxCount = Math.max(...counts.map(d => d.count), 1);
  const criticalCount = counts.find(d => d.key === "Critique")?.count || 0;
  const severeCount = counts.find(d => d.key === "Sévère")?.count || 0;
  const criticalAndSevere = criticalCount + severeCount;
  const targetCoverage = 80;
  const coverageProgress = Math.min(coveragePercent, 100);

  return (
    <Card className="border-[#E8E4DC] shadow-sm bg-white rounded-xl h-[380px]">
      <CardContent className="p-5 flex flex-col h-full">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E8E4DC]/70">
          <h3 className="font-medium text-[#172030] text-sm flex items-center gap-2">
            <PieChartIcon className="h-4 w-4 text-[#172030]/40" />
            Répartition par criticité
          </h3>
          <Badge variant="outline" className="border-[#E8E4DC] text-[#172030]/50 text-[9px] px-2">
            {total} processus
          </Badge>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <div className="relative w-[120px] h-[120px] flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData.length > 0 ? pieData : [{ name: "Aucune", value: 1, color: "#E8E4DC", borderColor: "#D1D5DB" }]}
                  dataKey="value" nameKey="name" innerRadius={38} outerRadius={54}
                  paddingAngle={2} stroke="white" strokeWidth={2}
                >
                  {(pieData.length > 0 ? pieData : [{ name: "Aucune", value: 1, color: "#E8E4DC", borderColor: "#D1D5DB" }]).map((d) => (
                    <Cell key={d.name} fill={d.color} stroke={d.borderColor} strokeWidth={1} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold text-[#172030]" style={{ fontFamily: "Playfair Display, serif" }}>{total}</span>
              <span className="text-[8px] text-[#172030]/40 uppercase tracking-wider">Total</span>
            </div>
          </div>
          <div className="flex-1 flex items-end gap-1.5 h-[100px]">
            {counts.filter(d => d.count > 0).map((d) => {
              const percentage = (d.count / maxCount) * 100;
              return (
                <div key={d.key} className="flex-1 flex flex-col items-center gap-1 h-full">
                  <div className="w-full rounded-t transition-all duration-500 hover:opacity-80"
                    style={{ height: `${Math.max(percentage, 12)}%`, backgroundColor: d.color.bg, border: `1px solid ${d.color.border}` }} />
                  <span className="text-[10px] font-semibold text-[#172030]/70">{d.count}</span>
                  <span className="text-[8px] text-[#172030]/40 uppercase tracking-wider">{d.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-3 border-t border-[#E8E4DC] space-y-3 mt-auto">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#172030]/50">
                Objectif de couverture
              </span>
              <span className="text-[10px] font-semibold text-[#172030]">
                {coverageProgress}% / {targetCoverage}%
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden bg-[#F1EFE8]">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(coverageProgress / targetCoverage) * 100}%`,
                  backgroundColor: coverageProgress >= targetCoverage ? "#2E7D32" : "#A38730",
                }}
              />
            </div>
          </div>
          <p className="text-[10px] text-[#172030]/60">
            {criticalAndSevere > 0
              ? `⚠️ ${criticalAndSevere} processus critique${criticalAndSevere > 1 ? 's' : ''} à prioriser`
              : "✅ Aucun processus critique identifié"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

// ============================================================
// PRIORITY CENTER
// ============================================================
const PriorityCenter = ({ items, onSelect, onViewAll }: { items: any[], onSelect: (id: string) => void, onViewAll: () => void }) => {
  if (items.length === 0) {
    return (
      <Card className="border-[#E8E4DC] shadow-sm bg-white rounded-xl h-[380px]">
        <CardContent className="p-5 flex items-center justify-center h-full">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#172030]">Tous les processus sont couverts</p>
              <p className="text-xs text-[#172030]/40">Aucune priorité de continuité à traiter</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  const displayItems = items.slice(0, 6);

  return (
    <Card className="border-[#E8E4DC] shadow-sm bg-white rounded-xl h-[380px]">
      <CardContent className="p-5 flex flex-col h-full">
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-[#E8E4DC]/70">
          <div>
            <h3 className="font-medium text-[#172030] text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-[#172030]/40" />
              À traiter en priorité
            </h3>
            <p className="text-[10px] text-[#172030]/40 mt-0.5">
              {items.length} élément{items.length > 1 ? 's' : ''} à traiter
            </p>
          </div>
          {items.length > 6 && (
            <Button variant="ghost" size="sm" className="text-[10px] h-7 px-3 text-[#172030]/50 hover:text-[#172030]" onClick={onViewAll}>
              Voir tout <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          )}
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
          {displayItems.map((item, idx) => {
            const isCritique = item.color === "#DC2626" || item.color === "#C62828";
            const isSevere = item.color === "#EA580C" || item.color === "#D84315";
            const isMajeur = item.color === "#F59E0B" || item.color === "#E65100";
            const level = isCritique ? "Critique" : isSevere ? "Sévère" : isMajeur ? "Majeur" : "Modéré";
            const levelColor = CRITICALITY_COLORS[level as keyof typeof CRITICALITY_COLORS] || CRITICALITY_COLORS["Mineur"];
            const isFirst = idx === 0;
            const isSecond = idx === 1;

            const itemBg = isFirst
              ? "bg-rose-50/60 border-rose-200/50"
              : isSecond
                ? "bg-rose-50/30 border-rose-200/30"
                : isSevere
                  ? "bg-orange-50/20 border-orange-200/20"
                  : isMajeur
                    ? "bg-amber-50/20 border-amber-200/20"
                    : "bg-[#FAFAF8] border-[#E8E4DC]";

            const itemPadding = isFirst ? "p-4" : isSecond ? "p-3.5" : "p-3";
            const itemMinHeight = isFirst ? "min-h-[70px]" : isSecond ? "min-h-[62px]" : "min-h-[54px]";
            const textSize = isFirst ? "text-[15px]" : isSecond ? "text-sm" : "text-[13px]";

            return (
              <div
                key={idx}
                className={cn(
                  "flex items-center justify-between rounded-xl border transition-all hover:shadow-sm cursor-pointer group relative overflow-hidden",
                  itemBg, itemPadding, itemMinHeight,
                  isFirst && "border-l-4 border-l-rose-500"
                )}
                onClick={() => onSelect(item.processId)}
              >
                {isFirst && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 bg-[#C62828] text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm">
                    <AlertCircle className="h-2.5 w-2.5" />
                    Priorité n°1
                  </div>
                )}

                <div className="flex items-center gap-3 min-w-0 flex-1 pr-16">
                  <div className={cn(
                    "flex items-center justify-center rounded-full flex-shrink-0 font-bold",
                    isFirst ? "h-8 w-8 text-sm bg-[#C62828] text-white shadow-sm" :
                    isSecond ? "h-7 w-7 text-xs bg-[#FBE9E7] text-[#C62828]" :
                    "h-6 w-6 text-[10px] bg-[#F1EFE8] text-[#172030]/60"
                  )}>
                    {idx + 1}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={cn("font-semibold text-[#172030] truncate", textSize)}>
                        {item.processName}
                      </p>
                      <Badge className="text-[8px] px-1.5 py-0 h-4 border-0 flex-shrink-0"
                        style={{ backgroundColor: levelColor.bg, color: levelColor.text }}>
                        {level}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-[#172030]/40 flex items-center gap-1 mt-0.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: isCritique ? "#DC2626" : isSevere ? "#EA580C" : isMajeur ? "#F59E0B" : "#3B82F6" }} />
                      {item.reason}
                    </p>
                  </div>
                </div>

                <Button
                  size="sm"
                  className={cn(
                    "flex-shrink-0 ml-2 rounded-lg text-[10px] h-7 px-3 transition-opacity bg-[#2A5141] hover:bg-[#1F3E32] text-white",
                    isFirst ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  )}
                  onClick={(e) => { e.stopPropagation(); onSelect(item.processId); }}
                >
                  <Plus className="h-3 w-3 mr-1" /> Créer
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

// ============================================================
// COMPARATEUR
// ============================================================
const ComparatorDialog = ({
  open, onOpenChange, processName, associations, catalogue, processus,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  processName: string;
  associations: StrategieAssociation[];
  catalogue: any[];
  processus: any[];
}) => {
  const rows = useMemo(() => {
    return associations.map((a) => {
      const strat = catalogue.find((c: any) => c.id === a.strategie_id);
      const proc = processus.find((p: any) => p.id === a.processus_id);
      const rto = proc?.rto_hours ?? null;
      const atteignable = a.rto_atteignable ?? a.delai_estime_heures ?? null;
      const chk = checkRto(atteignable, rto);
      return {
        id: a.id, nom: strat?.nom || "—", scenario: a.scenario_id || "Tous",
        effort: a.effort || null, statut: a.statut, rtoCible: rto, rtoAtteignable: atteignable,
        rtoOk: chk.known ? chk.ok : null, ecart: chk.known ? chk.ecart : null,
        cout: a.cout_estime,
        critique: proc ? (proc.impacts ? scoreToCriticality(computeMaxScore(proc.impacts)) : "—") : "—",
      };
    });
  }, [associations, catalogue, processus]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-[#172030]">Comparateur — {processName}</DialogTitle>
          <DialogDescription>Comparaison côte-à-côte des stratégies associées à ce processus.</DialogDescription>
        </DialogHeader>
        {rows.length === 0 ? (
          <p className="text-sm text-center text-[#172030]/50 py-8">Aucune stratégie à comparer pour ce processus.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#E8E4DC]">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#F8F6F2] border-b border-[#E8E4DC]">
                  <th className="text-left text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider p-3">Critère</th>
                  {rows.map((r) => (
                    <th key={r.id} className="text-left text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider p-3">
                      <span className="font-serif text-[11px] text-[#172030]">{r.nom}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#EFEDE8]">
                  <td className="p-3 text-[11px] font-medium text-[#172030]/60">Scénario</td>
                  {rows.map((r) => <td key={r.id} className="p-3 text-xs text-[#172030]">{r.scenario}</td>)}
                </tr>
                <tr className="border-b border-[#EFEDE8] bg-[#FAF9F6]">
                  <td className="p-3 text-[11px] font-medium text-[#172030]/60">Criticité couverte</td>
                  {rows.map((r) => {
                    const col = CRITICALITY_COLORS[r.critique as keyof typeof CRITICALITY_COLORS] || CRITICALITY_COLORS["Mineur"];
                    return <td key={r.id} className="p-3"><Badge className="text-[9px] border-0" style={{ backgroundColor: col.bg, color: col.text }}>{r.critique}</Badge></td>;
                  })}
                </tr>
                <tr className="border-b border-[#EFEDE8]">
                  <td className="p-3 text-[11px] font-medium text-[#172030]/60">RTO cible</td>
                  {rows.map((r) => <td key={r.id} className="p-3 font-mono text-xs text-[#172030]">{r.rtoCible != null ? `${r.rtoCible}h` : "—"}</td>)}
                </tr>
                <tr className="border-b border-[#EFEDE8] bg-[#FAF9F6]">
                  <td className="p-3 text-[11px] font-medium text-[#172030]/60">RTO atteignable</td>
                  {rows.map((r) => (
                    <td key={r.id} className="p-3">
                      {r.rtoAtteignable != null ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="font-mono text-xs text-[#172030]">{r.rtoAtteignable}h</span>
                          {r.rtoOk === true && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                          {r.rtoOk === false && <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />}
                        </span>
                      ) : <span className="text-xs text-[#172030]/40">—</span>}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-[#EFEDE8]">
                  <td className="p-3 text-[11px] font-medium text-[#172030]/60">Effort</td>
                  {rows.map((r) => {
                    if (!r.effort) return <td key={r.id} className="p-3 text-xs text-[#172030]/40">—</td>;
                    const st = EFFORT_STYLE[r.effort as Effort] || EFFORT_STYLE.Moyen;
                    return <td key={r.id} className="p-3"><span className="text-[10px] font-medium px-2 py-0.5 rounded" style={{ backgroundColor: st.bg, color: st.text }}>{r.effort}</span></td>;
                  })}
                </tr>
                <tr className="border-b border-[#EFEDE8] bg-[#FAF9F6]">
                  <td className="p-3 text-[11px] font-medium text-[#172030]/60">Statut</td>
                  {rows.map((r) => {
                    const st = STATUT_STYLE[r.statut] || STATUT_STYLE.Brouillon;
                    return <td key={r.id} className="p-3"><span className="text-[10px] font-medium px-2 py-0.5 rounded" style={{ backgroundColor: st.bg, color: st.text }}>{r.statut}</span></td>;
                  })}
                </tr>
                <tr>
                  <td className="p-3 text-[11px] font-medium text-[#172030]/60">Coût estimé</td>
                  {rows.map((r) => <td key={r.id} className="p-3 font-mono text-xs text-[#172030]">{Number(r.cout || 0).toLocaleString("fr-FR")} €</td>)}
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================
// STRATEGY EXPLORER
// ============================================================
const StrategyExplorer = ({
  associations, processus, catalogue, onEdit, onDelete, onCompare,
  searchTerm, setSearchTerm, criticalityFilter, setCriticalityFilter,
  viewMode, setViewMode, statutFilter, setStatutFilter,
}: {
  associations: any[];
  processus: any[];
  catalogue: any[];
  onEdit: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  onCompare: (processId: string, processName: string) => void;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  criticalityFilter: CriticalityFilter;
  setCriticalityFilter: (value: CriticalityFilter) => void;
  viewMode: ViewMode;
  setViewMode: (value: ViewMode) => void;
  statutFilter: string;
  setStatutFilter: (value: string) => void;
}) => {
  const getProcessCriticality = (p: any) => {
    if (!p?.impacts) return "Non défini";
    return scoreToCriticality(computeMaxScore(p.impacts));
  };
  const getCritStyle = (crit: string) => {
    const colors = CRITICALITY_COLORS[crit as keyof typeof CRITICALITY_COLORS];
    if (!colors) return { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200" };
    return { bg: colors.bg, text: colors.text, border: colors.border };
  };

  const filtered = useMemo(() => {
    return associations.filter((a: any) => {
      const p = processus.find((pr: any) => pr.id === a.processus_id);
      const s = catalogue.find((c: any) => c.id === a.strategie_id);
      const search = searchTerm.toLowerCase();
      const matchSearch = !searchTerm || (s?.nom?.toLowerCase().includes(search)) || (p?.name?.toLowerCase().includes(search));
      if (!matchSearch) return false;
      if (criticalityFilter !== "all") {
        const crit = getProcessCriticality(p);
        if (crit !== criticalityFilter) return false;
      }
      if (statutFilter !== "all" && a.statut !== statutFilter) return false;
      return true;
    });
  }, [associations, processus, catalogue, searchTerm, criticalityFilter, statutFilter]);

  const criticalityOptions: { label: string; value: CriticalityFilter }[] = [
    { label: "Toutes", value: "all" },
    { label: "Critique", value: "Critique" },
    { label: "Sévère", value: "Sévère" },
    { label: "Majeur", value: "Majeur" },
    { label: "Modéré", value: "Modéré" },
    { label: "Mineur", value: "Mineur" },
  ];

  const RtoGauge = ({ atteignable, cible }: { atteignable: number | null; cible: number | null }) => {
    if (atteignable == null || cible == null) {
      return <span className="text-xs text-[#172030]/30">—</span>;
    }
    const ok = atteignable <= cible;
    const percent = Math.min((cible / Math.max(atteignable, 1)) * 100, 100);
    return (
      <div className="flex items-center gap-2 min-w-[110px]">
        <div className="flex-1 h-1.5 rounded-full bg-[#F1EFE8] overflow-hidden relative">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${percent}%`, backgroundColor: ok ? "#2E7D32" : "#C62828" }}
          />
        </div>
        <span className="text-[10px] font-mono font-semibold whitespace-nowrap"
          style={{ color: ok ? "#2E7D32" : "#C62828" }}>
          {atteignable}h {ok ? "≤" : ">"} {cible}h
        </span>
      </div>
    );
  };

  return (
    <Card className="border-[#E8E4DC] shadow-sm bg-white rounded-xl overflow-hidden flex flex-col h-[340px]">
      <div className="p-3 border-b border-[#E8E4DC] flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="font-serif text-[#172030] text-sm font-medium flex items-center gap-2">
            <FileWarning className="h-4 w-4 text-[#172030]/40" />
            Stratégies de continuité
          </h3>
          <Badge variant="outline" className="border-[#E8E4DC] text-[#172030]/50 text-[9px] px-2">
            {filtered.length} stratégie{filtered.length > 1 ? 's' : ''}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[#172030]/30" />
            <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher..."
              className="h-7 pl-7 pr-2 text-[10px] border-[#E8E4DC] rounded-lg w-[130px]" />
          </div>
          <Select value={statutFilter} onValueChange={setStatutFilter}>
            <SelectTrigger className="h-7 w-[110px] text-[10px] border-[#E8E4DC] rounded-lg">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Tous statuts</SelectItem>
              {["Brouillon", "En revue", "À valider", "Validée", "À revoir"].map((s) => (
                <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={criticalityFilter} onValueChange={(v) => setCriticalityFilter(v as CriticalityFilter)}>
            <SelectTrigger className="h-7 w-[90px] text-[10px] border-[#E8E4DC] rounded-lg">
              <SelectValue placeholder="Criticité" />
            </SelectTrigger>
            <SelectContent>
              {criticalityOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center border border-[#E8E4DC] rounded-lg p-0.5 bg-white">
            <button onClick={() => setViewMode("list")}
              className={cn("p-1 rounded transition-colors", viewMode === "list" ? "bg-[#F8F6F2] text-[#172030]" : "text-[#172030]/30 hover:text-[#172030]")}>
              <Table className="h-3 w-3" />
            </button>
            <button onClick={() => setViewMode("grid")}
              className={cn("p-1 rounded transition-colors", viewMode === "grid" ? "bg-[#F8F6F2] text-[#172030]" : "text-[#172030]/30 hover:text-[#172030]")}>
              <LayoutGrid className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {viewMode === "list" ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#F8F6F2] border-b border-[#E8E4DC]">
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[#172030]/40 uppercase tracking-wider">Stratégie</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[#172030]/40 uppercase tracking-wider">Processus</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[#172030]/40 uppercase tracking-wider">Criticité</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[#172030]/40 uppercase tracking-wider">Couverture RTO</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[#172030]/40 uppercase tracking-wider">Effort</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[#172030]/40 uppercase tracking-wider">Statut</th>
                  <th className="text-right px-4 py-3 text-[10px] font-semibold text-[#172030]/40 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-6 text-[#172030]/30 text-sm">Aucune stratégie trouvée</td></tr>
                ) : (
                  filtered.map((a: any) => {
                    const p = processus.find((pr: any) => pr.id === a.processus_id);
                    const s = catalogue.find((c: any) => c.id === a.strategie_id);
                    const crit = getProcessCriticality(p);
                    const critStyle = getCritStyle(crit);
                    const statutStyle = STATUT_STYLE[a.statut] || STATUT_STYLE.Brouillon;
                    const rtoAtteignable = a.rto_atteignable ?? a.delai_estime_heures ?? null;
                    const stale = isStale(a.updated_at);
                    const effortStyle = a.effort ? EFFORT_STYLE[a.effort as Effort] : null;
                    return (
                      <tr key={a.id} className="border-b border-[#EFEDE8] hover:bg-[#FAF9F6] transition-colors group">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-[#172030]">{s?.nom || "—"}</span>
                            {stale && (
                              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded flex items-center gap-0.5"
                                style={{ backgroundColor: "#FFF3E0", color: "#E65100" }}>
                                <CalendarClock className="h-2.5 w-2.5" />
                                À revoir
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-[#172030]/60">{p?.name || "—"}</td>
                        <td className="px-4 py-3.5">
                          <Badge variant="outline" className="border-0 text-[9px] px-2 py-0.5 h-5"
                            style={{ backgroundColor: critStyle.bg, color: critStyle.text }}>
                            {crit}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5">
                          <RtoGauge atteignable={rtoAtteignable} cible={p?.rto_hours ?? null} />
                        </td>
                        <td className="px-4 py-3.5">
                          {effortStyle ? (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded" style={{ backgroundColor: effortStyle.bg, color: effortStyle.text }}>
                              {a.effort}
                            </span>
                          ) : <span className="text-xs text-[#172030]/30">—</span>}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded" style={{ backgroundColor: statutStyle.bg, color: statutStyle.text }}>
                            {a.statut}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => onCompare(a.processus_id, p?.name || "—")}
                              className="p-1.5 text-[#172030]/20 hover:text-[#2A5141] rounded transition-colors hover:bg-[#E8F0EC]"
                              title="Comparer">
                              <ArrowLeftRight className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => onEdit(a.id)}
                              className="p-1.5 text-[#172030]/20 hover:text-[#172030] rounded transition-colors hover:bg-[#F5F3EF]">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => onDelete(a.id, s?.nom || "cette stratégie")}
                              className="p-1.5 text-[#172030]/20 hover:text-rose-600 rounded transition-colors hover:bg-rose-50">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-3 grid grid-cols-2 md:grid-cols-3 gap-2">
            {filtered.length === 0 ? (
              <div className="col-span-full text-center py-6 text-[#172030]/30 text-sm">Aucune stratégie trouvée</div>
            ) : (
              filtered.map((a: any) => {
                const p = processus.find((pr: any) => pr.id === a.processus_id);
                const s = catalogue.find((c: any) => c.id === a.strategie_id);
                const crit = getProcessCriticality(p);
                const critStyle = getCritStyle(crit);
                const statutStyle = STATUT_STYLE[a.statut] || STATUT_STYLE.Brouillon;
                const stale = isStale(a.updated_at);
                const rtoAtteignable = a.rto_atteignable ?? a.delai_estime_heures ?? null;
                return (
                  <div key={a.id} className="border border-[#E8E4DC] rounded-lg p-3 hover:shadow-sm transition-shadow bg-white">
                    <div className="flex items-start justify-between mb-1 gap-1">
                      <span className="font-medium text-sm text-[#172030] truncate">{s?.nom || "—"}</span>
                      <Badge variant="outline" className="border-0 text-[8px] px-1.5 py-0 h-4 flex-shrink-0"
                        style={{ backgroundColor: critStyle.bg, color: critStyle.text }}>
                        {crit}
                      </Badge>
                    </div>
                    <p className="text-xs text-[#172030]/50 mb-1.5 truncate">{p?.name || "—"}</p>
                    <div className="mb-2">
                      <RtoGauge atteignable={rtoAtteignable} cible={p?.rto_hours ?? null} />
                    </div>
                    <div className="flex items-center gap-1 mb-2 flex-wrap">
                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: statutStyle.bg, color: statutStyle.text }}>
                        {a.statut}
                      </span>
                      {a.effort && (
                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: EFFORT_STYLE[a.effort as Effort]?.bg || "#F1EFE8",
                            color: EFFORT_STYLE[a.effort as Effort]?.text || "#444441",
                          }}>
                          {a.effort}
                        </span>
                      )}
                      {stale && (
                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-orange-50 text-orange-700">À revoir</span>
                      )}
                    </div>
                    <div className="flex items-center justify-end gap-0.5">
                      <button onClick={() => onCompare(a.processus_id, p?.name || "—")} className="p-0.5 text-[#172030]/20 hover:text-[#2A5141]">
                        <ArrowLeftRight className="h-3 w-3" />
                      </button>
                      <button onClick={() => onEdit(a.id)} className="p-0.5 text-[#172030]/20 hover:text-[#172030]">
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button onClick={() => onDelete(a.id, s?.nom || "cette stratégie")} className="p-0.5 text-[#172030]/20 hover:text-rose-600">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

// ============================================================
// GAPS TAB
// ============================================================
const GapsTab = ({ data, onDefineStrategy }: { data: any, onDefineStrategy: (processId: string) => void }) => {
  const { processus, associations } = data;
  const gaps = useMemo(() => {
    const linkedIds = new Set(associations.map((a: any) => a.processus_id));
    return processus.filter((p: any) => !linkedIds.has(p.id));
  }, [processus, associations]);

  const getProcessCriticality = (p: any) => {
    if (!p.impacts) return "Non défini";
    return scoreToCriticality(computeMaxScore(p.impacts));
  };

  if (gaps.length === 0) {
    return (
      <Card className="border-[#E8E4DC] shadow-sm bg-white rounded-xl p-8 text-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          </div>
          <p className="text-sm font-medium text-[#172030]">Tous les processus sont couverts</p>
          <p className="text-xs text-[#172030]/40">Aucun processus critique sans stratégie</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-[#E8E4DC] shadow-sm bg-white rounded-xl overflow-hidden">
      <div className="p-3 border-b border-[#E8E4DC]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-serif text-[#172030] text-sm font-medium">Processus sans stratégie</h3>
            <p className="text-sm text-[#172030]/50">{gaps.length} processus à traiter</p>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#F8F6F2] border-b border-[#E8E4DC]">
              <th className="text-left p-3 text-[10px] font-semibold text-[#172030]/40 uppercase tracking-wider">Processus</th>
              <th className="text-left p-3 text-[10px] font-semibold text-[#172030]/40 uppercase tracking-wider">Criticité</th>
              <th className="text-left p-3 text-[10px] font-semibold text-[#172030]/40 uppercase tracking-wider">RTO</th>
              <th className="text-right p-3 text-[10px] font-semibold text-[#172030]/40 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody>
            {gaps.map((p: any) => {
              const crit = getProcessCriticality(p);
              const critStyle = CRITICALITY_COLORS[crit as keyof typeof CRITICALITY_COLORS] || CRITICALITY_COLORS["Mineur"];
              return (
                <tr key={p.id} className="border-b border-[#EFEDE8] hover:bg-[#FAF9F6] transition-colors">
                  <td className="p-3 font-medium text-sm text-[#172030]">{p.name}</td>
                  <td className="p-3">
                    <Badge variant="outline" className="border-0 text-[9px] px-2 py-0.5 h-5"
                      style={{ backgroundColor: critStyle.bg, color: critStyle.text }}>
                      {crit}
                    </Badge>
                  </td>
                  <td className="p-3 font-mono text-sm text-[#172030]/60">{p.rto_hours || "—"}h</td>
                  <td className="p-3 text-right">
                    <Button size="sm" className="bg-[#172030] hover:bg-[#2A2A2A] text-white rounded-lg h-8 text-sm px-4"
                      onClick={() => onDefineStrategy(p.id)}>
                      <Plus className="h-3.5 w-3.5 mr-1.5" /> Définir
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

// ============================================================
// WIZARD
// ============================================================
const StrategyWizard = ({ data, onComplete, onCancel, initialProcessId }: { data: any, onComplete: () => void, onCancel: () => void, initialProcessId?: string | null }) => {
  const { processus, catalogue, saveAssociation } = data;
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedProcessId, setSelectedProcessId] = useState<string>("");
  const [processResources, setProcessResources] = useState<{ hr: any[], equip: any[], apps: any[], suppliers: any[] }>({ hr: [], equip: [], apps: [], suppliers: [] });
  const [loadingResources, setLoadingResources] = useState(false);
  const [form, setForm] = useState({ nomStrategie: "", perimetre: "", hypotheses: "", scenarios: [] as string[] });
  const [selectedOptionId, setSelectedOptionId] = useState<string>("");
  const [justification, setJustification] = useState("");
  const [effort, setEffort] = useState<Effort>("Moyen");
  const [rtoAtteignable, setRtoAtteignable] = useState<number | "">("");
  const [validateur, setValidateur] = useState<string>("");
  const [statutInitial, setStatutInitial] = useState<string>("Brouillon");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRecommendation, setAiRecommendation] = useState<any>(null);
  const [aiJustifying, setAiJustifying] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    const fetchResources = async (processId: string) => {
      setLoadingResources(true);
      let hr: any[] = [], equip: any[] = [], apps: any[] = [], suppliers: any[] = [];
      const { data: hrData } = await supabase.from('processus_ressources_humaines').select('ressource_humaine_id').eq('processus_id', processId);
      if (hrData && hrData.length > 0) {
        const ids = hrData.map((l: any) => l.ressource_humaine_id);
        const { data } = await supabase.from('ressources_humaines').select('*').in('id', ids);
        hr = data || [];
      }
      const { data: equipData } = await supabase.from('processus_equipements').select('equipement_id').eq('processus_id', processId);
      if (equipData && equipData.length > 0) {
        const ids = equipData.map((l: any) => l.equipement_id);
        const { data } = await supabase.from('ressources_equipements').select('*').in('id', ids);
        equip = data || [];
      }
      const { data: appData } = await supabase.from('processus_applications').select('application_id').eq('processus_id', processId);
      if (appData && appData.length > 0) {
        const ids = appData.map((l: any) => l.application_id);
        const { data } = await supabase.from('applications_it').select('*').in('id', ids);
        apps = data || [];
      }
      const { data: suppData } = await supabase.from('processus_fournisseurs').select('fournisseur_id').eq('processus_id', processId);
      if (suppData && suppData.length > 0) {
        const ids = suppData.map((l: any) => l.fournisseur_id);
        const { data } = await supabase.from('fournisseurs').select('*').in('id', ids);
        suppliers = data || [];
      }
      setProcessResources({ hr, equip, apps, suppliers });
      setLoadingResources(false);
    };
    if (selectedProcessId) fetchResources(selectedProcessId);
    else setProcessResources({ hr: [], equip: [], apps: [], suppliers: [] });
  }, [selectedProcessId]);

  useEffect(() => {
    if (initialProcessId) setSelectedProcessId(initialProcessId);
  }, [initialProcessId]);

  const selectedProcess = useMemo(() => processus.find((p: any) => p.id === selectedProcessId), [selectedProcessId, processus]);
  const dynamicCriticality = useMemo(() => {
    if (!selectedProcess?.impacts) return "—";
    return scoreToCriticality(computeMaxScore(selectedProcess.impacts));
  }, [selectedProcess]);

  useEffect(() => {
    if (selectedProcess?.rto_hours && rtoAtteignable === "") setRtoAtteignable(selectedProcess.rto_hours);
  }, [selectedProcess?.rto_hours]);

  const nextStep = () => {
    if (step === 1 && !selectedProcessId) {
      toast({ title: "Erreur", description: "Veuillez sélectionner une activité.", variant: "destructive" });
      return;
    }
    if (step === 2 && !form.nomStrategie.trim()) {
      toast({ title: "Erreur", description: "Veuillez donner un nom à la stratégie.", variant: "destructive" });
      return;
    }
    setStep(s => s + 1);
    setHasData(true);
  };
  const prevStep = () => setStep(s => s - 1);

  const handleCancel = () => {
    if (hasData) {
      if (confirm("Quitter la création ? Les informations saisies seront perdues.")) onCancel();
    } else {
      onCancel();
    }
  };

  const submitWizard = async () => {
    if (!selectedOptionId) {
      toast({ title: "Erreur", description: "Veuillez sélectionner une option.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const ok = await saveAssociation({
      processus_id: selectedProcessId,
      strategie_id: selectedOptionId,
      justification: justification,
      delai_estime_heures: rtoAtteignable !== "" ? Number(rtoAtteignable) : (selectedProcess?.rto_hours || 0),
      statut: statutInitial,
      effort: effort,
      rto_atteignable: rtoAtteignable !== "" ? Number(rtoAtteignable) : null,
      validateur: validateur || null,
      date_validation: statutInitial === "Validée" ? new Date().toISOString() : null,
    });
    setLoading(false);
    if (ok) {
      toast({ title: "Succès", description: "Stratégie créée !" });
      onComplete();
    }
  };

  const scenarioOptions = ["Indisponibilité du site", "Panne systèmes", "Indisponibilité du personnel", "Défaillance fournisseur", "Cyberattaque"];

  useEffect(() => {
    const fetchRecommendation = async () => {
      if (step !== 3 || !selectedProcess) return;
      setAiLoading(true);
      setAiRecommendation(null);
      try {
        const context = {
          processName: selectedProcess.name,
          criticality: dynamicCriticality,
          rto: selectedProcess.rto_hours || 0,
          rpo: selectedProcess.rpo_hours || 0,
          resources: `${processResources.hr.length} RH, ${processResources.apps.length} Apps, ${processResources.equip.length} Équipements, ${processResources.suppliers.length} Prestataires`,
          scenarios: form.scenarios.join(", "),
          perimetre: form.perimetre,
          hypotheses: form.hypotheses,
          options: catalogue.map((opt: any) => ({ id: opt.id, nom: opt.nom, description: opt.description })),
        };
        const { data, error } = await functionsClient.functions.invoke('groq-strategy-assist', { body: { action: 'recommend', context } });
        if (error) throw error;
        if (data?.response) {
          try { setAiRecommendation(JSON.parse(data.response)); } catch (e) { console.error(e); }
        }
      } catch (error) { console.error(error); }
      finally { setAiLoading(false); }
    };
    fetchRecommendation();
  }, [step, selectedProcess?.id, dynamicCriticality]);

  const handleGenerateJustification = async () => {
    if (!selectedOptionId) return;
    const selectedOption = catalogue.find((o: any) => o.id === selectedOptionId);
    if (!selectedOption) return;
    setAiJustifying(true);
    try {
      const context = {
        processName: selectedProcess?.name,
        criticality: dynamicCriticality,
        rto: selectedProcess?.rto_hours || 0,
        rpo: selectedProcess?.rpo_hours || 0,
        selectedOptionName: selectedOption.nom,
        selectedOptionDescription: selectedOption.description || "",
      };
      const { data, error } = await functionsClient.functions.invoke('groq-strategy-assist', { body: { action: 'justify', context } });
      if (error) throw error;
      if (data?.justification) setJustification(data.justification);
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de générer la justification.", variant: "destructive" });
    } finally { setAiJustifying(false); }
  };

  const rtoCheck = useMemo(() => {
    if (!selectedProcess?.rto_hours || rtoAtteignable === "") return { known: false, ok: false, ecart: 0 };
    return checkRto(Number(rtoAtteignable), selectedProcess.rto_hours);
  }, [rtoAtteignable, selectedProcess?.rto_hours]);

  const WIZARD_STEPS = [
    { num: 1, label: "Activité", icon: Building2 },
    { num: 2, label: "Définition", icon: FileText },
    { num: 3, label: "Options", icon: Sparkles },
    { num: 4, label: "Validation", icon: Shield },
    { num: 5, label: "Récap", icon: CheckCircle2 },
  ];

  return (
    <div className="bg-[#F8F6F2] rounded-2xl overflow-hidden shadow-lg border border-[#E8E4DC]">
      <div className="bg-white border-b border-[#E8E4DC] px-6 md:px-10 pt-8 pb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-[#2A5141] text-white flex items-center justify-center">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-[#172030]" style={{ fontFamily: "'Playfair Display', serif" }}>
              Nouvelle stratégie de continuité
            </h2>
            <p className="text-[12px] text-[#172030]/50 mt-0.5">
              Assistant guidé en 5 étapes · {selectedProcess ? `Processus : ${selectedProcess.name}` : "Aucun processus sélectionné"}
            </p>
          </div>
        </div>
        <WizardStepper steps={WIZARD_STEPS} current={step} />
      </div>

      <div className="px-6 md:px-10 py-8">
        {step === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
            <SectionCard variant="white" icon={Building2} step="Étape 1 · Contexte" title="Informations générales" subtitle="Sélectionnez l'activité et définissez le contexte de la stratégie.">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-[13px] font-semibold text-[#172030]">Nom de la stratégie</Label>
                  <FieldInput value={form.nomStrategie} onChange={(e) => setForm({ ...form, nomStrategie: e.target.value })} placeholder="ex. Site de repli — Salle des marchés" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[13px] font-semibold text-[#172030]">Activité / processus concerné</Label>
                  <Select value={selectedProcessId} onValueChange={setSelectedProcessId}>
                    <SelectTrigger className="w-full h-11 bg-white border-[#E8E4DC] rounded-lg px-4 shadow-[inset_0_1px_2px_rgba(23,32,48,0.04)] focus:ring-2 focus:ring-[#2A5141]/15 focus:border-[#2A5141] hover:border-[#172030]/20 transition-all">
                      <SelectValue placeholder="Rechercher une activité..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-[280px]">
                      {processus.length === 0 ? (
                        <div className="p-4 text-center text-sm text-[#172030]/40">Aucune activité disponible</div>
                      ) : (
                        processus.map((p: any) => (
                          <SelectItem key={p.id} value={p.id} className="py-2">
                            <div className="flex flex-col py-1">
                              <span className="font-medium text-sm">{p.name}</span>
                              <span className="text-[10px] text-[#172030]/50">{p.direction || "—"} • RTO: {p.rto_hours || "—"}h</span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                {selectedProcess && <ProcessSummaryCard process={selectedProcess} criticality={dynamicCriticality} />}
                <div className="space-y-2">
                  <Label className="text-[13px] font-semibold text-[#172030]">Périmètre couvert</Label>
                  <FieldTextarea value={form.perimetre} onChange={(e) => setForm({ ...form, perimetre: e.target.value })} rows={3} placeholder="ex. Équipe trésorerie, systèmes SWIFT Alliance Access..." />
                </div>
                <div className="space-y-3">
                  <Label className="text-[13px] font-semibold text-[#172030]">Scénarios de disruption couverts</Label>
                  <div className="flex flex-wrap gap-2">
                    {scenarioOptions.map((scenario) => (
                      <ScenarioPill key={scenario} label={scenario} checked={form.scenarios.includes(scenario)}
                        onToggle={(checked) => {
                          if (checked) setForm({ ...form, scenarios: [...form.scenarios, scenario] });
                          else setForm({ ...form, scenarios: form.scenarios.filter(s => s !== scenario) });
                        }} />
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[13px] font-semibold text-[#172030]">Hypothèses et contraintes</Label>
                  <FieldTextarea value={form.hypotheses} onChange={(e) => setForm({ ...form, hypotheses: e.target.value })} rows={3} placeholder="ex. Le site de repli doit être opérationnel sous 2h..." />
                </div>
              </div>
            </SectionCard>

            <SectionCard variant="cream" icon={Layers} step="Étape 1 · Dépendances" title="Ressources et dépendances"
              subtitle={selectedProcess ? "Récupérées automatiquement depuis le BIA et la cartographie." : "Sélectionnez un processus pour charger ses ressources."}>
              {loadingResources ? (
                <div className="flex flex-col items-center justify-center py-16 text-[#172030]/40 gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-[#2A5141]" />
                  <span className="text-sm">Chargement des ressources...</span>
                </div>
              ) : selectedProcess ? (
                <div className="space-y-6">
                  <ResourceGroup category="Ressources humaines" items={processResources.hr} />
                  <ResourceGroup category="Applications IT" items={processResources.apps} />
                  <ResourceGroup category="Équipements" items={processResources.equip} />
                  <ResourceGroup category="Prestataires" items={processResources.suppliers} />
                  <div className="pt-4 border-t border-[#E8E4DC]">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="h-4 w-4 text-[#2A5141]" />
                      <span className="text-[13px] font-semibold text-[#172030]">Risques associés</span>
                      <AutoSourceChip />
                    </div>
                    <p className="text-[13px] text-[#172030]/50 italic">À implémenter dans une version future.</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 border-2 border-dashed border-[#E8E4DC] rounded-xl bg-white/50">
                  <Building className="h-12 w-12 mx-auto text-[#172030]/20 mb-3" />
                  <p className="text-sm font-medium text-[#172030]/60">Sélectionnez un processus</p>
                  <p className="text-xs text-[#172030]/40 mt-1">Les ressources apparaîtront automatiquement</p>
                </div>
              )}
            </SectionCard>
          </div>
        )}

        {step === 2 && (
          <div className="max-w-3xl mx-auto">
            <SectionCard variant="white" icon={FileText} step="Étape 2 · Définition" title="Définition de la stratégie" subtitle="Décrivez le contexte, l'effort et les hypothèses.">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-[13px] font-semibold text-[#172030]">Nom de la stratégie <span className="text-[#C62828]">*</span></Label>
                  <FieldInput value={form.nomStrategie} onChange={(e) => setForm({ ...form, nomStrategie: e.target.value })} placeholder="ex. Site de repli — Salle des marchés" />
                </div>
                <div className="space-y-3">
                  <Label className="text-[13px] font-semibold text-[#172030]">Effort de mise en œuvre</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {(["Faible", "Moyen", "Élevé"] as Effort[]).map((e) => {
                      const st = EFFORT_STYLE[e];
                      const active = effort === e;
                      return (
                        <button key={e} type="button" onClick={() => setEffort(e)}
                          className={cn("rounded-xl py-4 text-sm font-semibold transition-all border-2 relative overflow-hidden", active ? "shadow-md" : "hover:shadow-sm")}
                          style={{
                            backgroundColor: active ? st.text : "#FFFFFF",
                            color: active ? "#FFFFFF" : st.text,
                            borderColor: active ? st.text : "#E8E4DC",
                          }}>
                          {e}
                          {active && <div className="absolute top-2 right-2"><CheckCircle2 className="h-4 w-4 text-white/80" /></div>}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[13px] font-semibold text-[#172030]">RTO atteignable (heures) — estimation de votre stratégie</Label>
                  <FieldInput type="number" min={0} value={rtoAtteignable}
                    onChange={(e) => setRtoAtteignable(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder={selectedProcess?.rto_hours ? `Cible BIA : ${selectedProcess.rto_hours}h` : "Ex. 4"} />
                  {rtoCheck.known && (
                    <div className={cn("flex items-center gap-2 text-[12px] font-medium mt-2 px-3 py-2 rounded-lg",
                      rtoCheck.ok ? "bg-[#E8F5E9] text-[#2E7D32] border border-[#2E7D32]/15" : "bg-[#FBE9E7] text-[#C62828] border border-[#C62828]/15")}>
                      {rtoCheck.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                      {rtoCheck.ok
                        ? `Atteignable — couvre le RTO de ${selectedProcess?.rto_hours}h`
                        : `Non atteignable — écart de ${rtoCheck.ecart}h avec le RTO cible`}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-[13px] font-semibold text-[#172030]">Description du périmètre</Label>
                  <FieldTextarea value={form.perimetre} onChange={(e) => setForm({ ...form, perimetre: e.target.value })} rows={4} placeholder="Décrivez le périmètre couvert par cette stratégie..." />
                </div>
                <div className="space-y-2">
                  <Label className="text-[13px] font-semibold text-[#172030]">Hypothèses et contraintes</Label>
                  <FieldTextarea value={form.hypotheses} onChange={(e) => setForm({ ...form, hypotheses: e.target.value })} rows={4} placeholder="Listez les hypothèses et contraintes..." />
                </div>
              </div>
            </SectionCard>
          </div>
        )}

        {step === 3 && (
          <div className="max-w-6xl mx-auto space-y-6">
            <SectionCard variant="white" icon={Sparkles} step="Étape 3 · Comparaison" title="Options de continuité"
              subtitle={selectedProcess ? `Pour ${selectedProcess.name} — ${dynamicCriticality} · RTO ${selectedProcess.rto_hours || 0}h` : "Sélectionnez une option"}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {catalogue.map((opt: any) => {
                  const isSelected = selectedOptionId === opt.id;
                  const isRecommended = aiRecommendation?.recommended_option_id === opt.id;
                  return (
                    <button key={opt.id} type="button" onClick={() => setSelectedOptionId(opt.id)}
                      className={cn(
                        "relative text-left rounded-xl p-5 transition-all duration-200 border-2 bg-white min-h-[160px] flex flex-col",
                        isSelected ? "border-[#2A5141] bg-[#F8F6F2] shadow-md shadow-[#2A5141]/10"
                          : isRecommended ? "border-[#2A5141] border-dashed"
                          : "border-[#E8E4DC] hover:border-[#2A5141]/40 hover:shadow-md hover:-translate-y-0.5"
                      )}>
                      {isRecommended && !isSelected && (
                        <div className="absolute -top-2.5 left-4 bg-[#2A5141] text-white text-[10px] font-bold px-3 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                          <Sparkles className="h-3 w-3" /> Recommandé IA
                        </div>
                      )}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <h4 className={cn("font-semibold text-[15px] leading-tight", isSelected ? "text-[#2A5141]" : "text-[#172030]")}
                          style={{ fontFamily: "'Playfair Display', serif" }}>
                          {opt.nom}
                        </h4>
                        {isSelected && <div className="h-6 w-6 rounded-full bg-[#2A5141] flex items-center justify-center flex-shrink-0"><CheckCircle2 className="h-4 w-4 text-white" /></div>}
                      </div>
                      <p className="text-[13px] text-[#172030]/60 flex-1 leading-relaxed">{opt.description || "Option de continuité disponible."}</p>
                    </button>
                  );
                })}
              </div>
              {aiLoading && (
                <div className="flex items-center gap-3 text-[13px] text-[#172030]/60 py-3 bg-[#F8F6F2] rounded-lg px-4 mt-5">
                  <Loader2 className="h-4 w-4 animate-spin text-[#2A5141]" /> Analyse du contexte par l'IA...
                </div>
              )}
              {!aiLoading && aiRecommendation?.rationale && (
                <div className="bg-[#F8F6F2] border-l-4 border-l-[#2A5141] p-4 rounded-lg text-[13px] flex items-start gap-3 mt-5">
                  <Sparkles className="h-4 w-4 text-[#2A5141] mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-semibold text-[#172030]">Recommandation IA :</span> {aiRecommendation.rationale}
                    <span className="text-[#172030]/40 text-xs ml-2">(Confiance : {aiRecommendation.confidence})</span>
                  </div>
                </div>
              )}
              <div className="space-y-3 mt-6 pt-5 border-t border-[#E8E4DC]">
                <div className="flex justify-between items-end">
                  <Label className="text-[13px] font-semibold text-[#172030]">Justification du choix</Label>
                  <Button variant="outline" size="sm"
                    className="border-[#2A5141] text-[#2A5141] hover:bg-[#F8F6F2] gap-2 rounded-lg h-9 px-4"
                    onClick={handleGenerateJustification} disabled={aiJustifying || !selectedOptionId}>
                    {aiJustifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    {aiJustifying ? "Génération..." : "Générer avec l'IA"}
                  </Button>
                </div>
                <FieldTextarea value={justification} onChange={(e) => setJustification(e.target.value)} rows={3} placeholder="Expliquez votre choix..." />
              </div>
            </SectionCard>
          </div>
        )}

        {step === 4 && (
          <div className="max-w-3xl mx-auto">
            <SectionCard variant="white" icon={Shield} step="Étape 4 · Gouvernance" title="Validation et gouvernance" subtitle="Définissez le statut initial et le validateur de cette stratégie.">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-[13px] font-semibold text-[#172030]">Statut initial</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {["Brouillon", "En revue", "À valider", "Validée"].map((s) => {
                      const active = statutInitial === s;
                      const st = STATUT_STYLE[s] || STATUT_STYLE.Brouillon;
                      return (
                        <button key={s} type="button" onClick={() => setStatutInitial(s)}
                          className={cn("rounded-lg py-3 text-[13px] font-semibold transition-all border-2", active ? "shadow-sm" : "hover:shadow-sm")}
                          style={{
                            backgroundColor: active ? st.text : "#FFFFFF",
                            color: active ? "#FFFFFF" : st.text,
                            borderColor: active ? st.text : "#E8E4DC",
                          }}>
                          {s}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-[#172030]/50">Le statut "Brouillon" est recommandé pour une stratégie en cours de construction.</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-[13px] font-semibold text-[#172030]">Validateur / Sponsor</Label>
                  <FieldInput value={validateur} onChange={(e) => setValidateur(e.target.value)} placeholder="Nom du responsable qui validera cette stratégie" />
                  <p className="text-[11px] text-[#172030]/50">Recommandé pour les statuts "À valider" et "Validée".</p>
                </div>
              </div>
            </SectionCard>
          </div>
        )}

        {step === 5 && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-[#E8F0EC] flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-8 w-8 text-[#2A5141]" />
              </div>
              <h3 className="text-2xl font-semibold text-[#172030] mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>Prêt pour la validation</h3>
              <p className="text-[13px] text-[#172030]/50 max-w-md mx-auto">Vérifiez le récapitulatif avant de créer la stratégie.</p>
            </div>
            <SectionCard variant="white" icon={FileText} step="Étape 5 · Récapitulatif" title="Résumé de la stratégie">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-[10px] font-bold text-[#172030]/40 uppercase tracking-wider mb-2">Activité</p>
                    <p className="font-medium text-sm text-[#172030]">{selectedProcess?.name}</p>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <Badge variant="outline" className="bg-[#E8F0EC] text-[#2A5141] border-[#2A5141]/15 text-[10px] px-3 py-0.5">{dynamicCriticality}</Badge>
                      <span className="text-[12px] text-[#172030]/60">RTO cible {selectedProcess?.rto_hours || 0}h</span>
                      {rtoAtteignable !== "" && (
                        <span className="text-[12px] font-medium" style={{ color: rtoCheck.ok ? "#2E7D32" : "#C62828" }}>Atteignable : {rtoAtteignable}h</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[#172030]/40 uppercase tracking-wider mb-2">Stratégie retenue</p>
                    <p className="font-medium text-sm text-[#172030]">{form.nomStrategie}</p>
                    <p className="text-[12px] text-[#172030]/60 mt-1">{catalogue.find((c: any) => c.id === selectedOptionId)?.nom}</p>
                  </div>
                </div>
                <div className="border-t border-[#E8E4DC] pt-5 grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-[10px] font-bold text-[#172030]/40 uppercase tracking-wider mb-2">Effort</p>
                    <span className="text-[11px] font-medium px-2.5 py-1 rounded-md"
                      style={{ backgroundColor: EFFORT_STYLE[effort].bg, color: EFFORT_STYLE[effort].text }}>{effort}</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[#172030]/40 uppercase tracking-wider mb-2">Statut</p>
                    <span className="text-[11px] font-medium px-2.5 py-1 rounded-md"
                      style={{
                        backgroundColor: STATUT_STYLE[statutInitial]?.bg || "#F1EFE8",
                        color: STATUT_STYLE[statutInitial]?.text || "#444441",
                      }}>{statutInitial}</span>
                  </div>
                  {validateur && (
                    <div>
                      <p className="text-[10px] font-bold text-[#172030]/40 uppercase tracking-wider mb-2">Validateur</p>
                      <p className="text-[13px] text-[#172030]">{validateur}</p>
                    </div>
                  )}
                </div>
                <div className="border-t border-[#E8E4DC] pt-5">
                  <p className="text-[10px] font-bold text-[#172030]/40 uppercase tracking-wider mb-3">Ressources liées</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="bg-[#EDF2F7] text-[#38536F] border-[#38536F]/15 text-[12px] px-3 py-1">{processResources.hr.length} RH</Badge>
                    <Badge variant="outline" className="bg-[#F5F0FA] text-[#6A4A8A] border-[#6A4A8A]/15 text-[12px] px-3 py-1">{processResources.apps.length} Apps</Badge>
                    <Badge variant="outline" className="bg-[#FFF3E0] text-[#B76E1D] border-[#B76E1D]/15 text-[12px] px-3 py-1">{processResources.equip.length} Équipements</Badge>
                    <Badge variant="outline" className="bg-[#FCE4EC] text-[#AD1457] border-[#AD1457]/15 text-[12px] px-3 py-1">{processResources.suppliers.length} Prestataires</Badge>
                  </div>
                </div>
                {justification && (
                  <div className="border-t border-[#E8E4DC] pt-5">
                    <p className="text-[10px] font-bold text-[#172030]/40 uppercase tracking-wider mb-2">Justification</p>
                    <p className="text-[13px] text-[#172030]/70 whitespace-pre-wrap leading-relaxed">{justification}</p>
                  </div>
                )}
              </div>
            </SectionCard>
          </div>
        )}
      </div>

      <div className="bg-white border-t border-[#E8E4DC] px-6 md:px-10 py-5 flex justify-between items-center gap-3">
        <Button variant="outline" onClick={step === 1 ? handleCancel : prevStep}
          className="border-[#E8E4DC] text-[#172030]/70 hover:bg-[#F8F6F2] rounded-lg h-11 px-5 text-sm">
          {step === 1 ? "Annuler" : <><ArrowLeft className="h-4 w-4 mr-2" /> Retour</>}
        </Button>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[#172030]/40 hidden md:inline">Étape {step} sur 5</span>
          <Button onClick={step === 5 ? submitWizard : nextStep}
            disabled={loading || (step === 1 && !selectedProcessId)}
            className="bg-[#2A5141] hover:bg-[#1F3E32] text-white min-w-[140px] rounded-lg h-11 px-6 text-sm font-medium shadow-sm shadow-[#2A5141]/20">
            {loading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Création...</>)
              : step === 5 ? ("Créer la stratégie")
              : (<>{step === 3 ? "Valider le choix" : "Continuer"} <ArrowRight className="h-4 w-4 ml-2" /></>)}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// MODULE PRINCIPAL
// ============================================================
export const StrategyModule = () => {
  const [currentView, setCurrentView] = useState<AppView>("overview");
  const [wizardProcessId, setWizardProcessId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [criticalityFilter, setCriticalityFilter] = useState<CriticalityFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [statutFilter, setStatutFilter] = useState<string>("all");
  const [comparatorOpen, setComparatorOpen] = useState(false);
  const [comparatorProcess, setComparatorProcess] = useState<{ id: string; name: string } | null>(null);

  const strategyData = useStrategyData();

  const [actionPlans, setActionPlans] = useState<any[]>([]);
  const [loadingRiskData, setLoadingRiskData] = useState(true);

  useEffect(() => {
    const loadRiskData = async () => {
      setLoadingRiskData(true);
      const { data: actionData } = await supabase.from("plans_traitement").select("id, risque_id, mesure, statut, avancement, responsable");
      setActionPlans(actionData || []);
      setLoadingRiskData(false);
    };
    loadRiskData();
  }, []);

  const data = { ...strategyData, actionPlans, loadingActions: loadingRiskData };

  const processusWithCriticality = useMemo(() => {
    return strategyData.processus.map((p: any) => {
      let level = "Non défini";
      if (p.impacts) {
        const score = computeMaxScore(p.impacts);
        level = scoreToCriticality(score);
      }
      return { ...p, calculatedLevel: level };
    });
  }, [strategyData.processus]);

  const stats = useMemo(() => {
    const linkedIds = new Set(strategyData.associations.map(a => a.processus_id));
    const covered = strategyData.processus.filter(p => linkedIds.has(p.id));
    const totalProcessus = strategyData.processus.length;
    const sansStrategie = totalProcessus - covered.length;
    const tauxCouverture = totalProcessus > 0 ? Math.round((covered.length / totalProcessus) * 100) : 0;

    const linkedActionIds = new Set<string>();
    const risksByStrategy: Record<string, Set<string>> = {};
    strategyData.associations.forEach((a) => {
      if (a.scenario_id) {
        if (!risksByStrategy[a.strategie_id]) risksByStrategy[a.strategie_id] = new Set();
        risksByStrategy[a.strategie_id].add(a.scenario_id);
      }
    });
    Object.values(risksByStrategy).forEach((riskIds) => {
      const foundActions = actionPlans.filter(p => riskIds.has(p.risque_id));
      foundActions.forEach(action => linkedActionIds.add(action.id));
    });

    const justifiedCount = strategyData.associations.filter(a => a.justification && a.justification.trim().length > 0).length;
    const totalAssociations = strategyData.associations.length;
    const justificationRate = totalAssociations > 0 ? Math.round((justifiedCount / totalAssociations) * 100) : 0;
    const maturityScore = Math.round((tauxCouverture * 0.40) + (justificationRate * 0.60));

    const rtoGaps = strategyData.associations.filter((a: any) => {
      const p = strategyData.processus.find((pr: any) => pr.id === a.processus_id);
      if (!p?.rto_hours) return false;
      const atteignable = a.rto_atteignable ?? a.delai_estime_heures ?? null;
      const chk = checkRto(atteignable, p.rto_hours);
      return chk.known && !chk.ok;
    }).length;

    const staleCount = strategyData.associations.filter((a: any) => isStale(a.updated_at)).length;

    const criticalProcesses = processusWithCriticality.filter(p => p.calculatedLevel === "Critique" || p.calculatedLevel === "Sévère");
    const criticalCovered = criticalProcesses.filter(p => linkedIds.has(p.id));
    const majorProcesses = processusWithCriticality.filter(p => p.calculatedLevel === "Majeur");

    const priorityList = strategyData.processus
      .filter(p => p.impacts)
      .map(p => {
        const score = computeMaxScore(p.impacts);
        const level = scoreToCriticality(score);
        const linked = linkedIds.has(p.id);
        let priority = 999;
        let reason = "Stratégie définie";
        let color = "#2E7D32";
        if (level === "Critique") {
          color = "#DC2626";
          if (!linked) { priority = 1; reason = "Aucune stratégie définie"; }
          else { priority = 2; reason = "Stratégie définie"; }
        } else if ((level as string) === "Sévère") {
          color = "#EA580C";
          if (!linked) { priority = 3; reason = "Aucune stratégie définie"; }
          else { priority = 4; reason = "Stratégie définie"; }
        } else if (level === "Majeur") {
          color = "#F59E0B";
          if (!linked) { priority = 5; reason = "Aucune stratégie définie"; }
          else { priority = 6; reason = "Stratégie définie"; }
        } else { priority = 7; reason = "Couvert"; }
        return { processId: p.id, processName: p.name, reason, color, priority };
      })
      .filter(p => p.priority < 7)
      .sort((a, b) => a.priority - b.priority);

    return {
      total: strategyData.associations.length,
      coveredCount: covered.length,
      tauxCouverture,
      sansStrategie,
      linkedActionCount: linkedActionIds.size,
      maturityScore,
      justificationRate,
      priorityList,
      totalProcessus,
      criticalTotal: criticalProcesses.length,
      criticalCovered: criticalCovered.length,
      majorTotal: majorProcesses.length,
      rtoGaps,
      staleCount,
    };
  }, [strategyData, actionPlans, processusWithCriticality]);

  const openWizard = (processId?: string) => {
    setWizardProcessId(processId || null);
    setCurrentView("create");
  };
  const closeWizard = () => {
    setWizardProcessId(null);
    setCurrentView("overview");
    strategyData.reload();
  };

  const handleEditInTable = (id: string) => {
    const assoc = strategyData.associations.find(a => a.id === id);
    if (!assoc) return;
    toast({ title: "Info", description: "Édition à implémenter." });
  };

  const handleDeleteInTable = async (id: string, strategyName: string) => {
    if (confirm(`Voulez-vous vraiment supprimer l'association pour la stratégie "${strategyName}" ?`)) {
      const ok = await strategyData.deleteAssociation(id);
      if (ok) toast({ title: "Association supprimée" });
    }
  };

  const handleCompare = (processId: string, processName: string) => {
    setComparatorProcess({ id: processId, name: processName });
    setComparatorOpen(true);
  };

  const comparatorAssociations = useMemo(() => {
    if (!comparatorProcess) return [];
    return strategyData.associations.filter((a: any) => a.processus_id === comparatorProcess.id);
  }, [comparatorProcess, strategyData.associations]);

  return (
    <div className="bg-[#F8F6F2] min-h-screen p-5">
      <div className="max-w-[1500px] mx-auto space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-[#172030]" style={{ fontFamily: "Playfair Display, serif" }}>
              Stratégies de continuité
            </h1>
            <p className="text-sm text-[#172030]/50">Pilotez la couverture des processus critiques et définissez les réponses adaptées.</p>
          </div>
          {currentView !== "create" && (
            <Button onClick={() => openWizard()} className="bg-[#172030] hover:bg-[#2A2A2A] text-white shadow-sm rounded-lg h-9 px-4 text-sm">
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Nouvelle stratégie
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 border-b border-[#E8E4DC] pb-1">
          {[
            { id: "overview", label: "Vue d'ensemble", icon: LayoutDashboard },
            { id: "catalog", label: "Catalogue", icon: FileWarning },
            { id: "gaps", label: "Écarts", icon: AlertTriangle },
          ].map((t) => {
            const active = currentView === t.id;
            return (
              <button key={t.id} onClick={() => setCurrentView(t.id as AppView)}
                className={cn("flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors",
                  active ? "bg-[#2A5141] text-white" : "text-[#172030]/65 hover:bg-[#F8F6F2] hover:text-[#172030]")}>
                <t.icon className="h-4 w-4" />
                {t.label}
                {t.id === "gaps" && stats.sansStrategie > 0 && (
                  <Badge className="bg-rose-500 text-white text-[10px] font-bold rounded-full ml-1 px-2 py-0.5">
                    {stats.sansStrategie}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>

        <div className="pt-1">
          {currentView === "create" ? (
            <StrategyWizard data={{ ...data, saveAssociation: strategyData.saveAssociation }}
              initialProcessId={wizardProcessId} onComplete={closeWizard} onCancel={closeWizard} />
          ) : currentView === "catalog" ? (
            <CatalogueTab data={data} />
          ) : currentView === "gaps" ? (
            <GapsTab data={data} onDefineStrategy={openWizard} />
          ) : (
            <div className="space-y-4">
              {/* ===== KPI — Bandeau discipliné (4 cartes) ===== */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* CARTE 1 — Sans stratégie : seule carte pouvant passer en "critical" */}
                <KpiCard
                  label="Sans stratégie"
                  value={stats.sansStrategie}
                  subLabel={stats.sansStrategie === 0 ? "tous couverts" : "à traiter"}
                  icon={AlertTriangle}
                  tone={stats.sansStrategie === 0 ? "success" : "alert"}
                  variant={stats.sansStrategie > 0 ? "critical" : "default"}
                  onClick={() => setCurrentView("gaps")}
                />

                {/* CARTE 2 — Écarts RTO */}
                <KpiCard
                  label="Écarts RTO"
                  value={stats.rtoGaps}
                  subLabel={stats.rtoGaps === 0 ? "tous couverts" : "non atteignables"}
                  icon={Target}
                  tone={stats.rtoGaps === 0 ? "success" : "alert"}
                />

                {/* CARTE 3 — Maturité */}
                <KpiCard
                  label="Maturité"
                  value={stats.maturityScore}
                  subLabel="/ 100"
                  icon={Gauge}
                  tone="neutral"
                />

                {/* CARTE 4 — Couverture + badge secondaire "À revoir" */}
                <KpiCard
                  label="Couverture"
                  value={`${stats.tauxCouverture}%`}
                  subLabel={`${stats.coveredCount}/${stats.totalProcessus}`}
                  icon={Layers}
                  tone="neutral"
                  badge={
                    stats.staleCount > 0
                      ? { label: `${stats.staleCount} à revoir`, bg: "#FFF8E1", text: "#A38730" }
                      : undefined
                  }
                />
              </div>

              {/* ===== CRITICITÉ + PRIORITÉS ===== */}
              <div className="grid grid-cols-10 gap-4">
                <div className="col-span-10 md:col-span-4 lg:col-span-3">
                  <CriticalityCard data={processusWithCriticality} coveragePercent={stats.tauxCouverture} />
                </div>
                <div className="col-span-10 md:col-span-6 lg:col-span-7">
                  <PriorityCenter items={stats.priorityList} onSelect={openWizard} onViewAll={() => setCurrentView("gaps")} />
                </div>
              </div>

              {/* ===== TABLE ===== */}
              <StrategyExplorer
                associations={strategyData.associations}
                processus={data.processus}
                catalogue={data.catalogue}
                onEdit={handleEditInTable}
                onDelete={handleDeleteInTable}
                onCompare={handleCompare}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                criticalityFilter={criticalityFilter}
                setCriticalityFilter={setCriticalityFilter}
                viewMode={viewMode}
                setViewMode={setViewMode}
                statutFilter={statutFilter}
                setStatutFilter={setStatutFilter}
              />

              {/* ===== FOOTER SOIGNÉ ===== */}
              <Card className="border-[#E8E4DC] shadow-sm bg-gradient-to-r from-white to-[#FAF9F6] rounded-xl overflow-hidden">
                <CardContent className="p-4 flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-6 flex-wrap">
                    <div className="flex items-center gap-2.5">
                      <div className="relative">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping opacity-60" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider text-[#172030]/40 font-semibold">Système</span>
                        <span className="text-[12px] font-medium text-[#172030]">Opérationnel</span>
                      </div>
                    </div>

                    <div className="w-px h-8 bg-[#E8E4DC]" />

                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-[#E8F0EC] flex items-center justify-center">
                        <Activity className="h-4 w-4 text-[#2A5141]" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider text-[#172030]/40 font-semibold">Stratégies actives</span>
                        <span className="text-[12px] font-medium text-[#172030]">{strategyData.associations.length}</span>
                      </div>
                    </div>

                    <div className="w-px h-8 bg-[#E8E4DC]" />

                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-[#E8F0EC] flex items-center justify-center">
                        <CheckCircle2 className="h-4 w-4 text-[#2A5141]" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider text-[#172030]/40 font-semibold">Processus couverts</span>
                        <span className="text-[12px] font-medium text-[#172030]">{stats.coveredCount} / {stats.totalProcessus}</span>
                      </div>
                    </div>

                    <div className="w-px h-8 bg-[#E8E4DC]" />

                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-[#F5F3EF] flex items-center justify-center">
                        <Clock className="h-4 w-4 text-[#172030]/50" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider text-[#172030]/40 font-semibold">Dernière mise à jour</span>
                        <span className="text-[12px] font-medium text-[#172030]">{new Date().toLocaleTimeString('fr-FR')}</span>
                      </div>
                    </div>
                  </div>

                  <Button variant="ghost" size="sm" className="text-[10px] text-[#172030]/40 hover:text-[#172030]"
                    onClick={() => strategyData.reload()}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    Actualiser
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      <ComparatorDialog
        open={comparatorOpen}
        onOpenChange={setComparatorOpen}
        processName={comparatorProcess?.name || ""}
        associations={comparatorAssociations}
        catalogue={data.catalogue}
        processus={data.processus}
      />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E5E2DD; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #C0D8CF; }
      `}</style>
    </div>
  );
};

export default StrategyModule;