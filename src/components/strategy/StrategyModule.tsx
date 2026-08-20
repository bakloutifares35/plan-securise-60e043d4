// src/components/strategy/StrategyModule.tsx
import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";
import {
  Layers, CheckCircle2, AlertTriangle, FileWarning,
  Plus, ArrowLeft, ArrowRight, Users, Monitor, Server, Handshake,
  Building, Shield, Box, Zap, Clock, Sparkles, Loader2, List, LayoutGrid,
  AlertCircle, Pencil, Trash2, Activity, Database, TrendingUp, TrendingDown, Minus,
  Gauge, Target, ChevronRight, Building2, PieChart as PieChartIcon,
  Search, Filter, LayoutDashboard, Table, Eye, ArrowUpRight
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/resillia/client";
import { useStrategyData } from "./useStrategyData";
import { CatalogueTab } from "./tabs/CatalogueTab";
import { computeMaxScore, scoreToCriticality } from "@/data/bia";
import { STATUT_STYLE } from "./types";

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
// COMPOSANT: KPI CARD (compact)
// ============================================================
const KpiCard = ({ 
  label, 
  value, 
  subLabel, 
  icon: Icon, 
  color = "default",
  className 
}: { 
  label: string; 
  value: string | number; 
  subLabel?: string;
  icon: any; 
  color?: "default" | "warning" | "info" | "success" | "danger";
  className?: string;
}) => {
  const colorStyles = {
    default: { bg: "bg-white", text: "text-[#172030]", border: "border-[#E8E4DC]", iconBg: "bg-[#F5F3EF]", iconColor: "text-[#172030]/40" },
    warning: { bg: "bg-amber-50/60", text: "text-amber-700", border: "border-amber-200/40", iconBg: "bg-amber-100/60", iconColor: "text-amber-600" },
    info: { bg: "bg-blue-50/60", text: "text-blue-700", border: "border-blue-200/40", iconBg: "bg-blue-100/60", iconColor: "text-blue-600" },
    success: { bg: "bg-emerald-50/60", text: "text-emerald-700", border: "border-emerald-200/40", iconBg: "bg-emerald-100/60", iconColor: "text-emerald-600" },
    danger: { bg: "bg-rose-50/60", text: "text-rose-700", border: "border-rose-200/40", iconBg: "bg-rose-100/60", iconColor: "text-rose-600" }
  };

  const style = colorStyles[color];

  return (
    <Card className={cn(
      "border shadow-sm rounded-xl h-[112px]",
      style.bg,
      style.border,
      className
    )}>
      <CardContent className="p-4 flex items-center justify-between h-full">
        <div className="space-y-0.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-[#172030]/40">
            {label}
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className={cn("text-2xl font-bold", style.text)} style={{ fontFamily: "Playfair Display, serif" }}>
              {value}
            </span>
            {subLabel && (
              <span className="text-xs font-medium text-[#172030]/40">
                {subLabel}
              </span>
            )}
          </div>
        </div>
        <div className={cn(
          "h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0",
          style.iconBg
        )}>
          <Icon className={cn("h-4.5 w-4.5", style.iconColor)} />
        </div>
      </CardContent>
    </Card>
  );
};

// ============================================================
// COMPOSANT: CRITICALITY CARD (compact - petit donut)
// ============================================================
const CriticalityCard = ({ data }: { data: any[] }) => {
  const total = data.length;
  
  const levels = [
    { label: "Critique", key: "Critique", emoji: "🔴" },
    { label: "Sévère", key: "Sévère", emoji: "🟠" },
    { label: "Majeur", key: "Majeur", emoji: "🟡" },
    { label: "Modéré", key: "Modéré", emoji: "🔵" },
    { label: "Mineur", key: "Mineur", emoji: "🟢" },
  ];

  const counts = levels.map(level => ({
    ...level,
    count: data.filter(p => p.calculatedLevel === level.key).length,
    color: CRITICALITY_COLORS[level.key as keyof typeof CRITICALITY_COLORS] || CRITICALITY_COLORS["Mineur"]
  }));

  const pieData = counts.filter(d => d.count > 0).map(d => ({
    name: d.label,
    value: d.count,
    color: d.color.bg,
    borderColor: d.color.border,
  }));

  return (
    <Card className="border-[#E8E4DC] shadow-sm bg-white rounded-xl h-[285px]">
      <CardContent className="p-4 flex flex-col h-full">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-[#172030] text-xs flex items-center gap-1.5">
            <PieChartIcon className="h-3.5 w-3.5 text-[#172030]/40" />
            Criticité
          </h3>
          <Badge variant="outline" className="border-[#E8E4DC] text-[#172030]/50 text-[8px] px-1.5">
            {total} total
          </Badge>
        </div>

        <div className="flex items-center gap-3 flex-1">
          <div className="relative w-[104px] h-[104px] flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData.length > 0 ? pieData : [{ name: "Aucune", value: 1, color: "#E8E4DC", borderColor: "#D1D5DB" }]}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={33}
                  outerRadius={49}
                  paddingAngle={1.5}
                  stroke="white"
                  strokeWidth={1.5}
                >
                  {(pieData.length > 0 ? pieData : [{ name: "Aucune", value: 1, color: "#E8E4DC", borderColor: "#D1D5DB" }]).map((d) => (
                    <Cell key={d.name} fill={d.color} stroke={d.borderColor} strokeWidth={1} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-[#172030]" style={{ fontFamily: "Playfair Display, serif" }}>
                {total}
              </span>
            </div>
          </div>

          <div className="flex-1 space-y-0.5">
            {counts.filter(d => d.count > 0).map((d) => (
              <div key={d.key} className="flex items-center justify-between text-xs">
                <span className="text-[9px] text-[#172030]/70 flex items-center gap-1">
                  <span>{d.emoji}</span> {d.label}
                </span>
                <span className="text-[9px] font-medium text-[#172030]">
                  {d.count} ({total > 0 ? ((d.count / total) * 100).toFixed(0) : 0}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ============================================================
// COMPOSANT: PRIORITY CENTER (compact)
// ============================================================
const PriorityCenter = ({ items, onSelect, onViewAll }: { items: any[], onSelect: (id: string) => void, onViewAll: () => void }) => {
  if (items.length === 0) {
    return (
      <Card className="border-[#E8E4DC] shadow-sm bg-white rounded-xl h-full">
        <CardContent className="p-4 flex items-center gap-3 h-full">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-[#172030]">Tous les processus sont couverts</p>
            <p className="text-xs text-[#172030]/40">Aucune priorité de continuité à traiter</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayItems = items.slice(0, 4);

  return (
    <Card className="border-[#E8E4DC] shadow-sm bg-white rounded-xl h-[285px]">
      <CardContent className="p-4 flex flex-col h-full">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-medium text-[#172030] text-xs flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-[#172030]/40" />
              Priorités
            </h3>
            <p className="text-[9px] text-[#172030]/40">À traiter</p>
          </div>
          {items.length > 4 && (
            <Button variant="ghost" size="sm" className="text-[9px] h-6 px-2 text-[#172030]/50 hover:text-[#172030]" onClick={onViewAll}>
              Voir tout <ChevronRight className="h-3 w-3 ml-0.5" />
            </Button>
          )}
        </div>

        <div className="flex-1 min-h-0 space-y-1.5 overflow-hidden">
          {displayItems.map((item, idx) => {
            const isCritique = item.color === "#DC2626" || item.color === "#C62828";
            const isSevere = item.color === "#EA580C" || item.color === "#D84315";
            const isMajeur = item.color === "#F59E0B" || item.color === "#E65100";
            
            const level = isCritique ? "Critique" : isSevere ? "Sévère" : isMajeur ? "Majeur" : "Modéré";
            const levelColor = CRITICALITY_COLORS[level as keyof typeof CRITICALITY_COLORS] || CRITICALITY_COLORS["Mineur"];
            
            return (
              <div 
                key={idx} 
                className={cn(
                  "flex items-center justify-between min-h-[48px] p-2.5 rounded-lg border transition-all hover:shadow-sm cursor-pointer group",
                  isCritique ? "border-rose-200/50 bg-rose-50/30" : 
                  isSevere ? "border-orange-200/50 bg-orange-50/30" :
                  isMajeur ? "border-amber-200/50 bg-amber-50/30" : 
                  "border-[#E8E4DC] bg-[#F8F6F2]"
                )}
                onClick={() => onSelect(item.processId)}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className={cn(
                    "w-0.5 h-7 rounded-full flex-shrink-0",
                    isCritique ? "bg-rose-500" : isSevere ? "bg-orange-500" : isMajeur ? "bg-amber-500" : "bg-blue-400"
                  )} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[13px] font-medium text-[#172030] truncate leading-5">{item.processName}</p>
                      <Badge 
                        className="text-[7px] px-1.5 py-0 h-4 border-0 flex-shrink-0"
                        style={{ backgroundColor: levelColor.bg, color: levelColor.text }}
                      >
                        {level}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-[#172030]/40">{item.reason}</p>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  variant="ghost"
                  className="flex-shrink-0 ml-1 rounded-lg text-[9px] h-6 px-2 text-[#172030]/40 hover:text-[#172030] hover:bg-white/60 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); onSelect(item.processId); }}
                >
                  Définir <ArrowUpRight className="h-3 w-3 ml-0.5" />
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
// COMPOSANT: STRATEGY EXPLORER (compact)
// ============================================================
const StrategyExplorer = ({ 
  associations, 
  processus, 
  catalogue, 
  onEdit, 
  onDelete,
  searchTerm,
  setSearchTerm,
  criticalityFilter,
  setCriticalityFilter,
  viewMode,
  setViewMode
}: { 
  associations: any[];
  processus: any[];
  catalogue: any[];
  onEdit: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  criticalityFilter: CriticalityFilter;
  setCriticalityFilter: (value: CriticalityFilter) => void;
  viewMode: ViewMode;
  setViewMode: (value: ViewMode) => void;
}) => {
  const getProcessCriticality = (p: any) => {
    if (!p?.impacts) return "Non défini";
    const score = computeMaxScore(p.impacts);
    return scoreToCriticality(score);
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
      const matchSearch = !searchTerm || 
        (s?.nom?.toLowerCase().includes(search)) ||
        (p?.name?.toLowerCase().includes(search));
      
      if (!matchSearch) return false;
      
      if (criticalityFilter !== "all") {
        const crit = getProcessCriticality(p);
        if (crit !== criticalityFilter) return false;
      }
      
      return true;
    });
  }, [associations, processus, catalogue, searchTerm, criticalityFilter]);

  const criticalityOptions: { label: string; value: CriticalityFilter }[] = [
    { label: "Toutes", value: "all" },
    { label: "Critique", value: "Critique" },
    { label: "Sévère", value: "Sévère" },
    { label: "Majeur", value: "Majeur" },
    { label: "Modéré", value: "Modéré" },
    { label: "Mineur", value: "Mineur" },
  ];

  return (
    <Card className="border-[#E8E4DC] shadow-sm bg-white rounded-xl overflow-hidden flex flex-col h-[235px]">
      <div className="p-3 border-b border-[#E8E4DC] flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="font-serif text-[#172030] text-sm font-medium flex items-center gap-1.5">
            <FileWarning className="h-3.5 w-3.5 text-[#172030]/40" />
            Stratégies
          </h3>
          <Badge variant="outline" className="border-[#E8E4DC] text-[#172030]/50 text-[8px] px-1.5">
            {filtered.length}
          </Badge>
        </div>
        
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[#172030]/30" />
            <Input 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher..."
              className="h-7 pl-7 pr-2 text-[10px] border-[#E8E4DC] rounded-lg w-[140px] focus-visible:ring-[#172030]"
            />
          </div>
          
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
            <button 
              onClick={() => setViewMode("list")} 
              className={cn(
                "p-1 rounded transition-colors",
                viewMode === "list" ? "bg-[#F8F6F2] text-[#172030]" : "text-[#172030]/30 hover:text-[#172030]"
              )}
            >
              <Table className="h-3 w-3" />
            </button>
            <button 
              onClick={() => setViewMode("grid")} 
              className={cn(
                "p-1 rounded transition-colors",
                viewMode === "grid" ? "bg-[#F8F6F2] text-[#172030]" : "text-[#172030]/30 hover:text-[#172030]"
              )}
            >
              <LayoutGrid className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {viewMode === "list" ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[#F8F6F2] border-b border-[#E8E4DC]">
                  <th className="text-left p-3 text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider">Stratégie</th>
                  <th className="text-left p-3 text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider">Processus</th>
                  <th className="text-left p-3 text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider">Criticité</th>
                  <th className="text-left p-3 text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider">RTO</th>
                  <th className="text-left p-3 text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider">Ressources</th>
                  <th className="text-right p-3 text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-[#172030]/30 text-xs">
                      Aucune stratégie trouvée
                    </td>
                  </tr>
                ) : (
                  filtered.map((a: any) => {
                    const p = processus.find((pr: any) => pr.id === a.processus_id);
                    const s = catalogue.find((c: any) => c.id === a.strategie_id);
                    const crit = getProcessCriticality(p);
                    const critStyle = getCritStyle(crit);
                    
                    return (
                      <tr key={a.id} className="border-b border-[#EFEDE8] hover:bg-[#FAF9F6] transition-colors group">
                        <td className="p-3">
                          <span className="font-medium text-[#172030] text-xs">{s?.nom || "—"}</span>
                        </td>
                        <td className="p-3 text-[#172030]/60 text-xs">{p?.name || "—"}</td>
                        <td className="p-3">
                          <Badge 
                            variant="outline" 
                            className="border-0 text-[8px] px-1.5 py-0 h-4"
                            style={{ backgroundColor: critStyle.bg, color: critStyle.text }}
                          >
                            {crit}
                          </Badge>
                        </td>
                        <td className="p-3 font-mono text-[#172030]/60 text-xs">{p?.rto_hours || "—"}h</td>
                        <td className="p-3 text-[#172030]/40 text-xs">—</td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            <button 
                              onClick={() => onEdit(a.id)} 
                              className="p-1 text-[#172030]/20 hover:text-[#172030] rounded transition-colors hover:bg-[#F5F3EF]"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button 
                              onClick={() => onDelete(a.id, s?.nom || "cette stratégie")} 
                              className="p-1 text-[#172030]/20 hover:text-rose-600 rounded transition-colors hover:bg-rose-50"
                            >
                              <Trash2 className="h-3 w-3" />
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
          <div className="p-3 grid grid-cols-2 gap-2">
            {filtered.length === 0 ? (
              <div className="col-span-full text-center py-6 text-[#172030]/30 text-xs">
                Aucune stratégie trouvée
              </div>
            ) : (
              filtered.map((a: any) => {
                const p = processus.find((pr: any) => pr.id === a.processus_id);
                const s = catalogue.find((c: any) => c.id === a.strategie_id);
                const crit = getProcessCriticality(p);
                const critStyle = getCritStyle(crit);
                
                return (
                  <div 
                    key={a.id} 
                    className="border border-[#E8E4DC] rounded-lg p-2 hover:shadow-sm transition-shadow bg-white"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <span className="font-medium text-[#172030] text-xs">{s?.nom || "—"}</span>
                      <Badge 
                        variant="outline" 
                        className="border-0 text-[7px] px-1.5 py-0 h-4"
                        style={{ backgroundColor: critStyle.bg, color: critStyle.text }}
                      >
                        {crit}
                      </Badge>
                    </div>
                    <p className="text-[9px] text-[#172030]/50 mb-1.5">{p?.name || "—"}</p>
                    <div className="flex items-center justify-between text-[9px] text-[#172030]/40">
                      <span>RTO: {p?.rto_hours || "—"}h</span>
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => onEdit(a.id)} className="p-0.5 text-[#172030]/20 hover:text-[#172030]">
                          <Pencil className="h-2.5 w-2.5" />
                        </button>
                        <button onClick={() => onDelete(a.id, s?.nom || "cette stratégie")} className="p-0.5 text-[#172030]/20 hover:text-rose-600">
                          <Trash2 className="h-2.5 w-2.5" />
                        </button>
                      </div>
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
// ONGLET : GAPS (compact)
// ============================================================
const GapsTab = ({ data, onDefineStrategy }: { data: any, onDefineStrategy: (processId: string) => void }) => {
  const { processus, associations } = data;
  const gaps = useMemo(() => {
    const linkedIds = new Set(associations.map((a: any) => a.processus_id));
    return processus.filter((p: any) => !linkedIds.has(p.id));
  }, [processus, associations]);

  const getProcessCriticality = (p: any) => {
    if (!p.impacts) return "Non défini";
    const score = computeMaxScore(p.impacts);
    return scoreToCriticality(score);
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
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-[#F8F6F2] border-b border-[#E8E4DC]">
              <th className="text-left p-3 text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider">Processus</th>
              <th className="text-left p-3 text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider">Criticité</th>
              <th className="text-left p-3 text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider">RTO</th>
              <th className="text-right p-3 text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody>
            {gaps.map((p: any) => {
              const crit = getProcessCriticality(p);
              const critStyle = CRITICALITY_COLORS[crit as keyof typeof CRITICALITY_COLORS] || CRITICALITY_COLORS["Mineur"];
              
              return (
                <tr key={p.id} className="border-b border-[#EFEDE8] hover:bg-[#FAF9F6] transition-colors">
                  <td className="p-2 font-medium text-[#172030] text-xs">{p.name}</td>
                  <td className="p-3">
                    <Badge 
                      variant="outline" 
                      className="border-0 text-[8px] px-1.5 py-0 h-4"
                      style={{ backgroundColor: critStyle.bg, color: critStyle.text }}
                    >
                      {crit}
                    </Badge>
                  </td>
                  <td className="p-3 font-mono text-[#172030]/60 text-xs">{p.rto_hours || "—"}h</td>
                  <td className="p-3 text-right">
                    <Button 
                      size="sm" 
                      className="bg-[#172030] hover:bg-[#2A2A2A] text-white rounded-lg h-7 text-[10px] px-3"
                      onClick={() => onDefineStrategy(p.id)}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Définir
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
// WIZARD (version compacte)
// ============================================================
const StrategyWizard = ({ data, onComplete, onCancel, initialProcessId }: { data: any, onComplete: () => void, onCancel: () => void, initialProcessId?: string | null }) => {
  const { processus, catalogue, saveAssociation } = data;
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedProcessId, setSelectedProcessId] = useState<string>("");
  const [processResources, setProcessResources] = useState<{hr: any[], equip: any[], apps: any[], suppliers: any[]}>({hr: [], equip: [], apps: [], suppliers: []});
  const [loadingResources, setLoadingResources] = useState(false);
  const [form, setForm] = useState({ nomStrategie: "", perimetre: "", hypotheses: "", scenarios: [] as string[] });
  const [selectedOptionId, setSelectedOptionId] = useState<string>("");
  const [justification, setJustification] = useState("");
  
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRecommendation, setAiRecommendation] = useState<{recommended_option_id?: string, rationale?: string, confidence?: string} | null>(null);
  const [aiJustifying, setAiJustifying] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [hasData, setHasData] = useState(false);

  const getResourceBadgeColor = (type: string) => {
    switch(type) {
      case 'Ressources humaines': return { icon: Users, bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
      case 'Équipements': return { icon: Monitor, bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
      case 'Applications IT': return { icon: Server, bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' };
      case 'Prestataires': return { icon: Handshake, bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' };
      default: return { icon: Box, bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };
    }
  };

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
    else setProcessResources({hr: [], equip: [], apps: [], suppliers: []});
  }, [selectedProcessId]);

  useEffect(() => {
    if (initialProcessId) setSelectedProcessId(initialProcessId);
  }, [initialProcessId]);

  const selectedProcess = useMemo(() => processus.find((p: any) => p.id === selectedProcessId), [selectedProcessId, processus]);
  const dynamicCriticality = useMemo(() => {
    if (!selectedProcess?.impacts) return "—";
    return scoreToCriticality(computeMaxScore(selectedProcess.impacts));
  }, [selectedProcess]);

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
      if (confirm("Quitter la création ? Les informations saisies seront perdues.")) {
        onCancel();
      }
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
      delai_estime_heures: selectedProcess?.rto_hours || 0,
    });
    setLoading(false);
    if (ok) {
      toast({ title: "Succès", description: "Stratégie créée et associée au processus !" });
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
          options: catalogue.map((opt: any) => ({ id: opt.id, nom: opt.nom, description: opt.description }))
        };
        const { data, error } = await supabase.functions.invoke('groq-strategy-assist', { body: { action: 'recommend', context } });
        if (error) throw error;
        if (data?.response) {
          try { setAiRecommendation(JSON.parse(data.response)); } catch (e) { console.error("Erreur parsing", e); }
        }
      } catch (error) {
        console.error("Erreur recommandation:", error);
      } finally {
        setAiLoading(false);
      }
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
        selectedOptionDescription: selectedOption.description || ""
      };
      const { data, error } = await supabase.functions.invoke('groq-strategy-assist', { body: { action: 'justify', context } });
      if (error) throw error;
      if (data?.justification) setJustification(data.justification);
    } catch (error) {
      console.error("Erreur justification:", error);
      toast({ title: "Erreur", description: "Impossible de générer la justification.", variant: "destructive" });
    } finally {
      setAiJustifying(false);
    }
  };

  return (
    <Card className="border-[#E8E4DC] shadow-sm bg-white rounded-xl overflow-hidden">
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-6 border-b border-[#E8E4DC] pb-4">
          <div className="flex gap-0 items-center">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center gap-0">
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-serif transition-colors duration-300 relative z-10",
                  s === step ? "bg-[#172030] text-white" :
                  s < step ? "bg-emerald-100 text-emerald-700" :
                  "bg-white text-[#172030]/40 border-2 border-[#E8E4DC]"
                )}>
                  {s < step ? "✓" : s}
                </div>
                {s < 4 && <div className={cn("w-8 h-px", s < step ? "bg-[#172030]" : "bg-[#E8E4DC]")} />}
              </div>
            ))}
          </div>
          <span className="text-xs text-[#172030]/40 font-mono">Étape {step} sur 4</span>
        </div>

        {step === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto py-2">
            <div className="space-y-4">
              <div>
                <h3 className="font-serif text-xl text-[#172030] mb-0.5">Informations générales</h3>
                <p className="text-xs text-[#172030]/60">Sélectionnez l'activité et définissez le contexte.</p>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-[#172030]/80">Nom de la stratégie</Label>
                  <Input value={form.nomStrategie} onChange={(e) => setForm({ ...form, nomStrategie: e.target.value })} placeholder="ex. Site de repli" className="h-9 border-[#E8E4DC] focus-visible:ring-[#172030] rounded-lg text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-[#172030]/80">Activité / processus concerné</Label>
                  <Select value={selectedProcessId} onValueChange={setSelectedProcessId}>
                    <SelectTrigger className="w-full h-9 border-[#E8E4DC] focus:ring-[#172030] rounded-lg text-sm">
                      <SelectValue placeholder="Rechercher une activité..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-[250px]">
                      {processus.length === 0 ? <div className="p-3 text-center text-xs text-[#172030]/40">Aucune activité disponible</div> : processus.map((p: any) => {
                        const crit = p.impacts ? scoreToCriticality(computeMaxScore(p.impacts)) : "Non défini";
                        return (
                          <SelectItem key={p.id} value={p.id} className="py-1.5">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{p.name}</span>
                                {p.rto_hours && p.rto_hours <= 4 && crit === "Critique" && (
                                  <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[8px] gap-0.5 px-1.5">
                                    <AlertCircle className="h-2.5 w-2.5" /> RTO serré
                                  </Badge>
                                )}
                              </div>
                              <span className="text-[10px] text-[#172030]/50">{p.direction || "—"} • RTO: {p.rto_hours || "—"}h</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                {selectedProcess && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-[#172030]/80 flex items-center gap-1">Criticité <span className="text-[9px] bg-[#F8F6F2] text-[#172030]/50 px-1.5 py-0.5 rounded-full">Auto</span></Label>
                        <Input value={dynamicCriticality} readOnly className="h-9 bg-[#F8F6F2] text-[#172030]/70 border-[#E8E4DC] rounded-lg text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-[#172030]/80 flex items-center gap-1">RTO <span className="text-[9px] bg-[#F8F6F2] text-[#172030]/50 px-1.5 py-0.5 rounded-full">Auto</span></Label>
                        <Input value={`${selectedProcess.rto_hours || 0}h`} readOnly className="h-9 bg-[#F8F6F2] text-[#172030]/70 border-[#E8E4DC] rounded-lg text-sm" />
                      </div>
                    </div>
                  </>
                )}
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-[#172030]/80">Périmètre couvert</Label>
                  <Textarea value={form.perimetre} onChange={(e) => setForm({ ...form, perimetre: e.target.value })} rows={2} placeholder="ex. Équipe trésorerie..." className="resize-none border-[#E8E4DC] rounded-lg text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-[#172030]/80">Scénarios couverts</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {scenarioOptions.map((scenario) => (
                      <label key={scenario} className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-[#E8E4DC] bg-white hover:bg-[#F8F6F2] cursor-pointer text-[10px] transition-colors">
                        <Checkbox checked={form.scenarios.includes(scenario)} onCheckedChange={(checked) => {
                          if (checked) setForm({...form, scenarios: [...form.scenarios, scenario]});
                          else setForm({...form, scenarios: form.scenarios.filter(s => s !== scenario)});
                        }} className="h-3 w-3 data-[state=checked]:bg-[#172030] data-[state=checked]:border-[#172030]" />
                        <span className="select-none">{scenario}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-serif text-xl text-[#172030] mb-0.5">Ressources</h3>
                <p className="text-xs text-[#172030]/60">{selectedProcess ? "Récupérées automatiquement depuis le BIA" : "Sélectionnez un processus"}</p>
              </div>
              {loadingResources ? (
                <div className="flex justify-center py-8 text-[#172030]/40"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : selectedProcess ? (
                <div className="space-y-4">
                  {Object.entries({'Ressources humaines': processResources.hr,'Applications IT': processResources.apps,'Équipements': processResources.equip,'Prestataires': processResources.suppliers}).map(([category, items]) => {
                    if (items.length === 0) return null;
                    const style = getResourceBadgeColor(category);
                    const Icon = style.icon;
                    return (
                      <div key={category} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Icon className={cn("h-3.5 w-3.5", style.text)} />
                          <span className="text-xs font-medium text-[#172030]">{category}</span>
                          <Badge variant="secondary" className="h-4 px-1.5 rounded-full text-[8px] bg-[#F8F6F2] text-[#172030]/50 border border-[#E8E4DC]">{items.length}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {items.map((item: any) => (
                            <div key={item.id} className={cn("px-2 py-0.5 rounded-full text-[10px] border flex items-center gap-1", style.bg, style.text, style.border)}>
                              {item.name}{item.role ? ` (${item.role})` : ''}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-[#172030]/30 border border-dashed border-[#E8E4DC] rounded-lg">
                  <Building className="h-8 w-8 mx-auto opacity-30" />
                  <p className="text-xs mt-1">Sélectionnez un processus</p>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="max-w-2xl mx-auto py-2 space-y-4">
             <div className="text-center mb-2"><h3 className="font-serif text-xl text-[#172030] mb-0.5">Définition de la stratégie</h3><p className="text-xs text-[#172030]/60">Décrivez le contexte de la stratégie.</p></div>
             <div className="space-y-4">
                <div className="space-y-1"><Label className="text-xs font-medium text-[#172030]/80">Nom de la stratégie *</Label><Input value={form.nomStrategie} onChange={(e) => setForm({ ...form, nomStrategie: e.target.value })} placeholder="ex. Site de repli" className="h-9 border-[#E8E4DC] rounded-lg text-sm" /></div>
                <div className="space-y-1"><Label className="text-xs font-medium text-[#172030]/80">Description du périmètre</Label><Textarea value={form.perimetre} onChange={(e) => setForm({ ...form, perimetre: e.target.value })} rows={2} placeholder="Décrivez le périmètre..." className="resize-none border-[#E8E4DC] rounded-lg text-sm" /></div>
                <div className="space-y-1"><Label className="text-xs font-medium text-[#172030]/80">Hypothèses et contraintes</Label><Textarea value={form.hypotheses} onChange={(e) => setForm({ ...form, hypotheses: e.target.value })} rows={2} placeholder="Hypothèses..." className="resize-none border-[#E8E4DC] rounded-lg text-sm" /></div>
             </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 py-2 max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-2">
              <div>
                <h3 className="font-serif text-xl text-[#172030] mb-0.5">Comparaison des options</h3>
                <p className="text-xs text-[#172030]/60">
                  Pour <span className="font-medium">{selectedProcess?.name || "..."}</span> 
                  {selectedProcess && ` — ${dynamicCriticality} · RTO ${selectedProcess.rto_hours || 0}h`}
                </p>
              </div>
              <div className="flex items-center gap-1.5 border border-[#E8E4DC] rounded-lg p-0.5 bg-white">
                <button onClick={() => setViewMode("grid")} className={cn("p-1 rounded transition-colors", viewMode === "grid" ? "bg-[#F8F6F2] text-[#172030]" : "text-[#172030]/40 hover:text-[#172030]")}>
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setViewMode("table")} className={cn("p-1 rounded transition-colors", viewMode === "table" ? "bg-[#F8F6F2] text-[#172030]" : "text-[#172030]/40 hover:text-[#172030]")}>
                  <List className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {catalogue.map((opt: any) => {
                const isSelected = selectedOptionId === opt.id;
                const isRecommended = aiRecommendation?.recommended_option_id === opt.id;
                return (
                  <div 
                    key={opt.id} 
                    onClick={() => setSelectedOptionId(opt.id)} 
                    className={cn(
                      "relative border-2 rounded-lg p-3 cursor-pointer transition-all bg-white flex flex-col h-full",
                      isSelected ? "border-[#172030] bg-[#F8F6F2]" : 
                      isRecommended ? "border-[#172030] border-dashed" :
                      "border-[#E8E4DC] hover:border-[#172030]/40 hover:shadow-sm"
                    )}
                  >
                    {(isRecommended && !isSelected) && (
                      <div className="absolute -top-2 right-3 bg-emerald-50 text-emerald-700 text-[8px] font-bold px-2 py-0.5 rounded-full shadow-sm border border-emerald-200 flex items-center gap-0.5">
                        <Sparkles className="h-2.5 w-2.5" /> Recommandé
                      </div>
                    )}
                    <div className="flex justify-between items-start mb-1.5">
                      <h4 className={cn("font-serif font-bold text-sm", isSelected ? "text-[#172030]" : "text-[#172030]")}>{opt.nom}</h4>
                      {isSelected && <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-[#172030]/60 flex-1">{opt.description || "Option de continuité disponible."}</p>
                  </div>
                );
              })}
            </div>

            {aiLoading ? (
              <div className="flex items-center gap-2 text-xs text-[#172030]/60 py-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#172030]" /> Analyse du contexte par l'IA...
              </div>
            ) : aiRecommendation?.rationale && (
              <div className="bg-[#F8F6F2] border-l-3 border-l-[#172030] p-2.5 rounded-lg text-xs flex items-start gap-2">
                <Sparkles className="h-3.5 w-3.5 text-[#172030] mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium text-[#172030]">Recommandation IA :</span> {aiRecommendation.rationale}
                  <span className="text-[#172030]/40 ml-1.5">(Confiance : {aiRecommendation.confidence})</span>
                </div>
              </div>
            )}

            <div className="space-y-2 max-w-2xl mx-auto mt-2 border-t border-[#E8E4DC] pt-4">
              <div className="flex justify-between items-end">
                <Label className="text-xs font-medium text-[#172030]/80">Justification du choix</Label>
                <Button variant="outline" size="sm" className="border-[#172030] text-[#172030] hover:bg-[#F8F6F2] gap-1.5 rounded-lg h-7 text-[10px]" onClick={handleGenerateJustification} disabled={aiJustifying || !selectedOptionId}>
                  {aiJustifying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  {aiJustifying ? "Génération..." : "Générer avec l'IA"}
                </Button>
              </div>
              <Textarea value={justification} onChange={(e) => setJustification(e.target.value)} rows={2} placeholder="Expliquez votre choix..." className="resize-none border-[#E8E4DC] rounded-lg text-sm" />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="max-w-3xl mx-auto py-2 space-y-4">
            <div className="text-center mb-3">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-2"><CheckCircle2 className="h-6 w-6 text-emerald-600" /></div>
              <h3 className="font-serif text-xl text-[#172030] mb-0.5">Prêt pour la création</h3>
              <p className="text-xs text-[#172030]/60">Vérifiez le résumé avant de créer la stratégie.</p>
            </div>

            <Card className="border border-[#E8E4DC] shadow-sm bg-white rounded-lg overflow-hidden">
              <div className="bg-[#F8F6F2] px-4 py-2 border-b border-[#E8E4DC]">
                <h4 className="font-serif font-semibold text-[#172030] text-sm">Résumé de la stratégie</h4>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold text-[#172030]/40 uppercase tracking-wider mb-1">Activité</p>
                    <p className="font-medium text-sm">{selectedProcess?.name}</p>
                    <div className="flex gap-2 mt-0.5">
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px]">{dynamicCriticality}</Badge>
                      <span className="text-[10px] text-[#172030]/60">RTO {selectedProcess?.rto_hours || 0}h</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[#172030]/40 uppercase tracking-wider mb-1">Stratégie retenue</p>
                    <p className="font-medium text-sm">{form.nomStrategie}</p>
                    <p className="text-[10px] text-[#172030]/60">{catalogue.find((c:any) => c.id === selectedOptionId)?.nom}</p>
                  </div>
                </div>

                <div className="border-t border-[#E8E4DC] pt-3">
                  <p className="text-[10px] font-bold text-[#172030]/40 uppercase tracking-wider mb-1.5">Ressources liées</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[9px]">{processResources.hr.length} RH</Badge>
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[9px]">{processResources.apps.length} Apps</Badge>
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[9px]">{processResources.equip.length} Équipements</Badge>
                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-[9px]">{processResources.suppliers.length} Prestataires</Badge>
                  </div>
                </div>

                <div className="border-t border-[#E8E4DC] pt-3">
                  <p className="text-[10px] font-bold text-[#172030]/40 uppercase tracking-wider mb-0.5">Justification</p>
                  <p className="text-xs text-[#172030]/70 whitespace-pre-wrap">{justification || "Aucune justification fournie."}</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        <div className="flex justify-between mt-4 pt-4 border-t border-[#E8E4DC]">
          <Button variant="outline" onClick={step === 1 ? handleCancel : prevStep} className="border-[#E8E4DC] text-[#172030]/70 hover:bg-[#F8F6F2] rounded-lg h-9 text-sm">
            {step === 1 ? "Annuler" : <><ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Retour</>}
          </Button>
          <Button onClick={step === 4 ? submitWizard : nextStep} disabled={loading || (step === 1 && !selectedProcessId)} className="bg-[#172030] hover:bg-[#2A2A2A] text-white min-w-[100px] rounded-lg h-9 text-sm">
            {loading ? "Création..." : step === 4 ? "Créer la stratégie" : <>{step === 3 ? "Valider" : "Continuer"} <ArrowRight className="h-3.5 w-3.5 ml-1.5" /></>}
          </Button>
        </div>
      </CardContent>
    </Card>
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
      foundActions.forEach(action => {
        linkedActionIds.add(action.id);
      });
    });

    const justifiedCount = strategyData.associations.filter(a => a.justification && a.justification.trim().length > 0).length;
    const totalAssociations = strategyData.associations.length;
    
    const justificationRate = totalAssociations > 0 ? Math.round((justifiedCount / totalAssociations) * 100) : 0;

    const maturityScore = Math.round(
      (tauxCouverture * 0.40) + 
      (justificationRate * 0.60)
    );

    let maturityLabel = "Niveau initial";
    if (maturityScore >= 70) maturityLabel = "Niveau avancé";
    else if (maturityScore >= 40) maturityLabel = "Niveau intermédiaire";

    const criticalProcesses = processusWithCriticality.filter(p => p.calculatedLevel === "Critique" || p.calculatedLevel === "Sévère");
    const criticalCovered = criticalProcesses.filter(p => linkedIds.has(p.id));
    const majorProcesses = processusWithCriticality.filter(p => p.calculatedLevel === "Majeur");
    const majorCovered = majorProcesses.filter(p => linkedIds.has(p.id));

    const priorityList = strategyData.processus
      .filter(p => p.impacts)
      .map(p => {
        const score = computeMaxScore(p.impacts);
        const level = scoreToCriticality(score) as string;
        const linked = linkedIds.has(p.id);

        let priority = 999;
        let reason = "Stratégie définie";
        let color = "#2E7D32";

        if (level === "Critique") {
          color = "#DC2626";
          if (!linked) { priority = 1; reason = "Aucune stratégie définie"; }
          else { priority = 2; reason = "Stratégie définie"; }
        } else if (level === "Sévère") {
          color = "#EA580C";
          if (!linked) { priority = 3; reason = "Aucune stratégie définie"; }
          else { priority = 4; reason = "Stratégie définie"; }
        } else if (level === "Majeur") {
          color = "#F59E0B";
          if (!linked) { priority = 5; reason = "Aucune stratégie définie"; }
          else { priority = 6; reason = "Stratégie définie"; }
        } else {
          priority = 7;
          reason = "Couvert";
        }

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
      maturityLabel,
      justificationRate,
      priorityList,
      totalProcessus,
      criticalTotal: criticalProcesses.length,
      criticalCovered: criticalCovered.length,
      majorTotal: majorProcesses.length,
      majorCovered: majorCovered.length,
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
      if (ok) {
        toast({ title: "Association supprimée", description: "La stratégie a été dissociée de ce processus." });
      }
    }
  };

  return (
    <div className="bg-[#F8F6F2] min-h-screen p-5">
      <div className="max-w-[1500px] mx-auto space-y-4">
        
        {/* HEADER compact */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-[#172030]" style={{ fontFamily: "Playfair Display, serif" }}>
              Stratégies de continuité
            </h1>
            <p className="text-sm text-[#172030]/50">
              Pilotez la couverture des processus critiques et définissez les réponses adaptées.
            </p>
          </div>
          {currentView !== "create" && (
            <Button onClick={() => openWizard()} className="bg-[#172030] hover:bg-[#2A2A2A] text-white shadow-sm rounded-lg h-10 px-5 text-sm">
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Nouvelle stratégie
            </Button>
          )}
        </div>

        {/* Navigation compacte */}
        {currentView !== "create" && (
          <div className="flex flex-wrap gap-0.5 border-b border-[#E8E4DC] pb-0.5">
            {[
              { id: "overview", label: "Vue d'ensemble", icon: LayoutDashboard },
              { id: "catalog", label: "Catalogue", icon: FileWarning },
              { id: "gaps", label: "Écarts", icon: AlertTriangle },
            ].map((t) => {
              const active = currentView === t.id;
              return (
                <button key={t.id} onClick={() => setCurrentView(t.id as AppView)} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-t-md text-xs font-medium transition-colors", active ? "bg-white text-[#172030] border-b-2 border-[#172030]" : "text-[#172030]/50 hover:bg-white/50 hover:text-[#172030]")}>
                  <t.icon className="h-3.5 w-3.5" />
                  {t.label}
                  {t.id === "gaps" && stats.sansStrategie > 0 && <Badge className="bg-rose-500 text-white text-[8px] font-bold rounded-full ml-0.5 px-1.5 py-0">{stats.sansStrategie}</Badge>}
                </button>
              );
            })}
          </div>
        )}

        <div className="pt-1">
          {currentView === "create" ? (
            <StrategyWizard data={{ ...data, saveAssociation: strategyData.saveAssociation }} initialProcessId={wizardProcessId} onComplete={closeWizard} onCancel={closeWizard} />
          ) : currentView === "catalog" ? (
            <CatalogueTab data={data} />
          ) : currentView === "gaps" ? (
            <GapsTab data={data} onDefineStrategy={openWizard} />
          ) : (
            /* ===== VUE D'ENSEMBLE COMPACTE ===== */
            <div className="space-y-4">
              
              {/* ROW 1: KPI - 4 colonnes compactes */}
              <div className="grid grid-cols-4 gap-4">
                <KpiCard 
                  label="Maturité"
                  value={stats.maturityScore}
                  subLabel="/ 100"
                  icon={Gauge}
                  color={stats.maturityScore >= 70 ? "success" : stats.maturityScore >= 40 ? "info" : "warning"}
                />
                <KpiCard 
                  label="Couverture"
                  value={`${stats.tauxCouverture}%`}
                  subLabel={`${stats.coveredCount}/${stats.totalProcessus}`}
                  icon={Layers}
                  color={stats.tauxCouverture >= 80 ? "success" : stats.tauxCouverture >= 50 ? "info" : "warning"}
                />
                <KpiCard 
                  label="Sans stratégie"
                  value={stats.sansStrategie}
                  subLabel={stats.sansStrategie === 0 ? "Tous couverts" : "À traiter"}
                  icon={AlertTriangle}
                  color={stats.sansStrategie === 0 ? "success" : "danger"}
                />
                <KpiCard 
                  label="Stratégies"
                  value={stats.total}
                  subLabel="associées"
                  icon={FileWarning}
                  color="default"
                />
              </div>

              {/* ROW 2: Criticité + Priorités - 2 colonnes */}
              <div className="grid grid-cols-10 gap-4">
                <div className="col-span-3">
                  <CriticalityCard data={processusWithCriticality} />
                </div>
                <div className="col-span-7">
                  <PriorityCenter 
                    items={stats.priorityList} 
                    onSelect={openWizard}
                    onViewAll={() => setCurrentView("gaps")}
                  />
                </div>
              </div>

              {/* ROW 3: Stratégies Explorer - Pleine largeur */}
              <StrategyExplorer 
                associations={strategyData.associations}
                processus={data.processus}
                catalogue={data.catalogue}
                onEdit={handleEditInTable}
                onDelete={handleDeleteInTable}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                criticalityFilter={criticalityFilter}
                setCriticalityFilter={setCriticalityFilter}
                viewMode={viewMode}
                setViewMode={setViewMode}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StrategyModule;