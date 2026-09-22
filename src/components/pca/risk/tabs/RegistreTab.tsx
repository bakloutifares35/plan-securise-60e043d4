import { useState, useMemo } from "react";
import { supabase as functionsClient } from "@/integrations/resillia/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  Plus, Pencil, Trash2, ShieldAlert, Search, AlertTriangle, CheckCircle2, Clock, Database,
  Sparkles, Loader2, Info, TrendingUp, Target, Activity, BarChart3, ShieldCheck, 
  ArrowUpRight, ArrowDownRight, Minus, Filter, LayoutDashboard, ListFilter
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/resillia/client";
import { type RiskData } from "../useRiskData";
import { type Risque, CATEGORIES_RISQUE, STATUTS_RISQUE, recompute, emptyRisque, NIVEAU_STYLE } from "../riskModel";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Props = {
  data: RiskData;
};

type FilterType = "all" | "critical" | "high" | "analyzed" | "pending" | "action" | null;

// ============================================================
// PALETTE RESILLIA CONSOLIDÉE
// ============================================================
const COLORS = {
  navy: "#172030",
  cream: "#F8F6F2",
  forest: "#2A5141",
  border: "#E5E2DD",
  danger: "#A52A2A",
  warning: "#A38730",
  info: "#38536F",
  success: "#1F4E39",
  muted: "#172030",
};

// ============================================================
// CONFIGURATION DES NIVEAUX DE RISQUE
// Couleurs VIVES pour les badges, pastel pour les barres
// ============================================================
const NIVEAU_CONFIG: Record<string, { 
  badgeBg: string;    // Couleur de fond du badge (vive)
  badgeText: string;  // Couleur du texte du badge
  barBg: string;      // Couleur de la barre (pastel)
  barFill: string;    // Couleur de remplissage de la barre
  label: string 
}> = {
  "Critique": { 
    badgeBg: "#DC2626", badgeText: "#FFFFFF",  // Rouge vif
    barBg: "#FEE2E2", barFill: "#DC2626", 
    label: "Critique" 
  },
  "Élevé": { 
    badgeBg: "#F59E0B", badgeText: "#FFFFFF",  // Orange vif
    barBg: "#FEF3C7", barFill: "#F59E0B", 
    label: "Élevé" 
  },
  "Modéré": { 
    badgeBg: "#10B981", badgeText: "#FFFFFF",  // Vert émeraude
    barBg: "#D1FAE5", barFill: "#10B981", 
    label: "Modéré" 
  },
  "Faible": { 
    badgeBg: "#6B7280", badgeText: "#FFFFFF",  // Gris
    barBg: "#F3F4F6", barFill: "#9CA3AF", 
    label: "Faible" 
  },
};

// Styles pour le niveau de maîtrise (Couleurs dynamiques)
const getMaitriseConfig = (level: number) => {
  if (level <= 2) return { color: "#DC2626", bg: "#FEE2E2", label: "Faible" }; // Rouge
  if (level <= 3) return { color: "#F59E0B", bg: "#FEF3C7", label: "Moyen" };  // Orange
  return { color: "#10B981", bg: "#D1FAE5", label: "Fort" };                   // Vert
};

export const RegistreTab = ({ data }: Props) => {
  const { risques, loading, saveRisque, deleteRow } = data;
  const [query, setQuery] = useState("");
  const [filterSev, setFilterSev] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<FilterType>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Risque | null>(null);
  const [form, setForm] = useState<Partial<Risque>>({});
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Risque | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // ============================================================
  // LOGIQUE MÉTIER
  // ============================================================
  const openCreate = () => {
    setEditing(null);
    setForm(emptyRisque());
    setDialogOpen(true);
  };

  const openEdit = (r: Risque) => {
    setEditing(r);
    setForm({
      id: r.id,
      title: r.title,
      description: r.description || "",
      category: r.category || "Cyber",
      owner: r.owner || "",
      status: r.status || "À analyser",
      probabilite: r.probabilite || 3,
      impact: r.impact || 3,
      maitrise: r.maitrise || 1,
      mesures_existantes: r.mesures_existantes || "",
    });
    setDialogOpen(true);
  };

  const updateField = <K extends keyof Risque>(field: K, value: Risque[K]) => {
    const updated = { ...form, [field]: value };
    if (field === "probabilite" || field === "impact" || field === "maitrise") {
      const recomputed = recompute(updated);
      updated.score_brut = recomputed.score_brut;
      updated.score_residuel = recomputed.score_residuel;
      updated.niveau = recomputed.niveau;
    }
    setForm(updated);
  };

  const handleAIAnalyze = async () => {
    if (!form.title?.trim()) {
      toast({ title: "Erreur", description: "Veuillez d'abord saisir le titre du risque.", variant: "destructive" });
      return;
    }
    setIsAnalyzing(true);
    try {
      const context = { title: form.title, description: form.description || "", category: form.category || "Cyber" };
      const { data, error } = await functionsClient.functions.invoke('groq-strategy-assist', {
        body: { action: 'suggest_risk_measures', context }
      });
      if (error) throw error;
      const updates: Partial<Risque> = { mesures_existantes: data?.mesures_existantes || form.mesures_existantes || "" };
      if (typeof data?.probabilite === 'number') updates.probabilite = data.probabilite;
      if (typeof data?.impact === 'number') updates.impact = data.impact;
      if (typeof data?.maitrise === 'number') updates.maitrise = data.maitrise;
      const updatedForm = { ...form, ...updates };
      const recomputed = recompute(updatedForm);
      setForm({ ...updatedForm, score_brut: recomputed.score_brut, score_residuel: recomputed.score_residuel, niveau: recomputed.niveau });
      toast({ title: "Suggestions IA", description: "Probabilité, impact, maîtrise et mesures suggérés par l'IA." });
    } catch (error) {
      console.error("Erreur suggestion IA:", error);
      toast({ title: "Erreur", description: "Impossible d'obtenir une suggestion.", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!form.title?.trim()) {
      toast({ title: "Titre requis", description: "Le titre du risque est obligatoire", variant: "destructive" });
      return;
    }
    setSaving(true);
    await saveRisque(form);
    setSaving(false);
    setDialogOpen(false);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    await deleteRow("risques", toDelete.id);
    setToDelete(null);
  };

  // ============================================================
  // STATISTIQUES CONSOLIDÉES
  // ============================================================
  const stats = useMemo(() => {
    const total = risques.length;
    const critical = risques.filter(r => r.niveau === "Critique").length;
    const high = risques.filter(r => r.niveau === "Élevé").length;
    
    // Risques analysés (score brut > 0)
    const analyzed = risques.filter(r => r.score_brut && r.score_brut > 0).length;
    const analysisRate = total > 0 ? Math.round((analyzed / total) * 100) : 0;

    // Exposition résiduelle moyenne
    const analyzedRisks = risques.filter(r => r.score_brut && r.score_brut > 0);
    const avgResidual = analyzedRisks.length > 0 
      ? Math.round(analyzedRisks.reduce((acc, r) => acc + (r.score_residuel || 0), 0) / analyzedRisks.length * 10) / 10
      : 0;

    // Risques à traiter (Score résiduel >= 12, soit Modéré+)
    const actionRequired = risques.filter(r => (r.score_residuel || 0) >= 12).length;

    // Répartition
    const matrix = { "Faible": 0, "Modéré": 0, "Élevé": 0, "Critique": 0 };
    risques.forEach(r => { if (r.niveau && matrix[r.niveau as keyof typeof matrix] !== undefined) matrix[r.niveau as keyof typeof matrix]++; });

    return { total, critical, high, analyzed, analysisRate, avgResidual, actionRequired, matrix };
  }, [risques]);

  // ============================================================
  // FILTRAGE
  // ============================================================
  const filtered = risques.filter((r) => {
    const q = query.trim().toLowerCase();
    if (q) {
      const searchText = `${r.title} ${r.description ?? ""} ${r.category ?? ""} ${r.owner ?? ""}`.toLowerCase();
      if (!searchText.includes(q)) return false;
    }
    if (filterSev !== "all" && r.niveau !== filterSev) return false;
    if (activeFilter === "critical" && r.niveau !== "Critique") return false;
    if (activeFilter === "high" && r.niveau !== "Élevé") return false;
    if (activeFilter === "analyzed" && (!r.score_brut || r.score_brut === 0)) return false;
    if (activeFilter === "pending" && r.status !== "À analyser") return false;
    if (activeFilter === "action" && (r.score_residuel || 0) < 12) return false;
    return true;
  });

  const getReference = (index: number) => `R-${String(index + 1).padStart(4, '0')}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-[#2A5141]" />
        <span className="ml-3 text-[#172030]/60 font-sans">Chargement du registre...</span>
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto space-y-6 font-sans pb-12">
      
      {/* ============================================================
          EN-TÊTE
          ============================================================ */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <LayoutDashboard className="h-5 w-5 text-[#2A5141]" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#2A5141]/60">Rapport Consolidé</span>
          </div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[#172030]">
            Registre des Risques
          </h1>
          <p className="text-sm text-[#172030]/60 mt-1">
            Vue synthétique de l'exposition, de la maturité et de l'efficacité des mesures de maîtrise.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={openCreate} className="bg-[#2A5141] hover:bg-[#1F3E32] text-white shadow-sm h-9">
            <Plus className="h-4 w-4 mr-2" /> Nouveau risque
          </Button>
        </div>
      </div>

      {/* ============================================================
          KPI STRATÉGIQUES (4 CARTES)
          ============================================================ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1 : Risques analysés */}
        <Card 
          className={cn("border rounded-xl transition-all cursor-pointer hover:shadow-md", activeFilter === "analyzed" ? "ring-2 ring-[#2A5141] bg-[#E5F0EB]/30" : "bg-white")} 
          style={{ borderColor: COLORS.border }}
          onClick={() => setActiveFilter(activeFilter === "analyzed" ? null : "analyzed")}
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#172030]/50">Risques analysés</p>
                <p className="font-serif text-3xl font-bold text-[#172030] mt-1">{stats.analyzed}<span className="text-lg font-normal text-[#172030]/40">/{stats.total}</span></p>
              </div>
              <div className="h-9 w-9 rounded-lg bg-[#E5F0EB] flex items-center justify-center">
                <Target className="h-4 w-4 text-[#1F4E39]" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="h-1.5 flex-1 bg-[#E5E2DD] rounded-full overflow-hidden">
                <div className="h-full bg-[#1F4E39] rounded-full" style={{ width: `${stats.analysisRate}%` }} />
              </div>
              <span className="text-[10px] font-medium text-[#172030]/60">{stats.analysisRate}%</span>
            </div>
            <p className="text-[10px] text-[#172030]/40 mt-2">Risques avec évaluation complète</p>
          </CardContent>
        </Card>

        {/* KPI 2 : Exposition Résiduelle */}
        <Card 
          className={cn("border rounded-xl transition-all cursor-pointer hover:shadow-md", activeFilter === "high" ? "ring-2 ring-[#A38730] bg-[#FEF3C7]/30" : "bg-white")} 
          style={{ borderColor: COLORS.border }}
          onClick={() => setActiveFilter(activeFilter === "high" ? null : "high")}
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#172030]/50">Exposition résiduelle</p>
                <p className="font-serif text-3xl font-bold text-[#A38730] mt-1">{stats.avgResidual}<span className="text-lg font-normal text-[#172030]/40">/25</span></p>
              </div>
              <div className="h-9 w-9 rounded-lg bg-[#FEF3C7] flex items-center justify-center">
                <Activity className="h-4 w-4 text-[#A38730]" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1 text-[10px] font-medium text-[#172030]/60">
              <span>Moyenne sur les risques analysés</span>
            </div>
            <p className="text-[10px] text-[#172030]/40 mt-2">Après application des mesures</p>
          </CardContent>
        </Card>

        {/* KPI 3 : Risques à traiter */}
        <Card 
          className={cn("border rounded-xl transition-all cursor-pointer hover:shadow-md", activeFilter === "action" ? "ring-2 ring-[#A52A2A] bg-[#FDE8E8]/30" : "bg-white")} 
          style={{ borderColor: COLORS.border }}
          onClick={() => setActiveFilter(activeFilter === "action" ? null : "action")}
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#172030]/50">Risques à traiter</p>
                <p className="font-serif text-3xl font-bold text-[#A52A2A] mt-1">{stats.actionRequired}</p>
              </div>
              <div className="h-9 w-9 rounded-lg bg-[#FDE8E8] flex items-center justify-center">
                <ShieldAlert className="h-4 w-4 text-[#A52A2A]" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1 text-[10px] font-medium text-[#172030]/60">
              <AlertTriangle className="h-3 w-3 text-[#A52A2A]" />
              <span>Score résiduel ≥ 12</span>
            </div>
            <p className="text-[10px] text-[#172030]/40 mt-2">Nécessitent des actions correctives</p>
          </CardContent>
        </Card>

        {/* KPI 4 : Répartition */}
        <Card 
          className="border rounded-xl bg-white transition-all hover:shadow-md" 
          style={{ borderColor: COLORS.border }}
        >
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4 text-[#2A5141]" />
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[#172030]/50">Répartition</h3>
            </div>
            <div className="space-y-2">
              {Object.entries(stats.matrix).map(([niveau, count]) => {
                const config = NIVEAU_CONFIG[niveau] || NIVEAU_CONFIG["Faible"];
                const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
                return (
                  <div key={niveau}>
                    <div className="flex justify-between text-[9px] font-medium mb-0.5">
                      <span style={{ color: config.barFill }}>{niveau}</span>
                      <span className="text-[#172030]/60">{count}</span>
                    </div>
                    <div className="h-1 w-full rounded-full overflow-hidden" style={{ backgroundColor: config.barBg }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${percentage}%`, backgroundColor: config.barFill }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ============================================================
          FILTRES
          ============================================================ */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#172030]/40" />
          <Input 
            placeholder="Rechercher un risque, un pilote, une catégorie..." 
            value={query} 
            onChange={(e) => setQuery(e.target.value)} 
            className="pl-9 border-[#E5E2DD] focus-visible:ring-[#2A5141] bg-white shadow-sm h-10" 
          />
        </div>
        <Select value={filterSev} onValueChange={setFilterSev}>
          <SelectTrigger className="w-full md:w-[180px] border-[#E5E2DD] focus:ring-[#2A5141] bg-white shadow-sm h-10">
            <ListFilter className="h-3.5 w-3.5 mr-2 text-[#172030]/40" />
            <SelectValue placeholder="Tous les niveaux" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les niveaux</SelectItem>
            {["Faible", "Modéré", "Élevé", "Critique"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        {(activeFilter || filterSev !== "all" || query) && (
          <Button 
            variant="outline" 
            onClick={() => { setActiveFilter(null); setFilterSev("all"); setQuery(""); }} 
            className="border-[#E5E2DD] text-[#172030]/60 hover:text-[#2A5141] shadow-sm bg-white h-10"
          >
            Réinitialiser
          </Button>
        )}
      </div>
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-[#172030]/50">
          Affichage de <span className="font-bold text-[#172030]">{filtered.length}</span> risque{filtered.length > 1 ? 's' : ''} sur {stats.total}
        </span>
        {activeFilter && (
          <Badge variant="outline" className="text-[9px] border-[#2A5141] text-[#2A5141] bg-[#E5F0EB]">
            Filtre actif : {activeFilter === "critical" ? "Critiques" : activeFilter === "high" ? "Élevés" : activeFilter === "analyzed" ? "Analysés" : activeFilter === "action" ? "À traiter" : "À analyser"}
          </Badge>
        )}
      </div>

      {/* ============================================================
          TABLEAU
          ============================================================ */}
      <Card className="border rounded-xl bg-white shadow-sm overflow-hidden" style={{ borderColor: COLORS.border }}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#F8F6F2] border-b border-[#E5E2DD]">
                <th className="text-left text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider p-3 font-sans w-20">Réf.</th>
                <th className="text-left text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider p-3 font-sans">Risque & Contexte</th>
                <th className="text-center text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider p-3 font-sans w-16">P</th>
                <th className="text-center text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider p-3 font-sans w-16">I</th>
                <th className="text-center text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider p-3 font-sans w-20">Brut</th>
                <th className="text-center text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider p-3 font-sans w-24">Maîtrise</th>
                <th className="text-center text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider p-3 font-sans w-20">Résiduel</th>
                <th className="text-center text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider p-3 font-sans w-24">Niveau</th>
                <th className="text-left text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider p-3 font-sans w-32">Pilote</th>
                <th className="text-center text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider p-3 font-sans w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-16 text-[#172030]/40 font-sans">
                    <div className="h-14 w-14 rounded-full bg-[#F8F6F2] flex items-center justify-center mx-auto mb-3">
                      <Database className="h-6 w-6 text-[#172030]/20" />
                    </div>
                    <p className="text-sm font-medium">Aucun risque trouvé</p>
                    <p className="text-xs mt-1">Essayez de modifier vos filtres ou d'ajouter un nouveau risque.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((r, index) => {
                  const niveau = r.niveau || "Faible";
                  // Utilisation de NIVEAU_CONFIG pour les couleurs VIVES des badges
                  const config = NIVEAU_CONFIG[niveau] || NIVEAU_CONFIG["Faible"];
                  const mitigation = (r.score_brut || 0) - (r.score_residuel || 0);
                  const maitriseLevel = r.maitrise || 1;
                  const maitriseConfig = getMaitriseConfig(maitriseLevel);
                  
                  return (
                    <tr key={r.id} className="border-b border-[#F3F1ED] hover:bg-[#F8F6F2]/80 transition-colors group">
                      <td className="p-3 font-mono text-xs text-[#172030]/50 font-sans">{getReference(index)}</td>
                      <td className="p-3">
                        <div className="font-medium text-[#172030] font-sans group-hover:text-[#2A5141] transition-colors">{r.title}</div>
                        <div className="text-[10px] text-[#172030]/40 flex items-center gap-2 mt-1 font-sans">
                          <Badge variant="outline" className="text-[8px] border-[#E5E2DD] text-[#172030]/50 rounded-full px-2 py-0.5 h-5 bg-white">{r.status || "À analyser"}</Badge>
                          {r.date_identification && <span className="flex items-center gap-1">revue {new Date(r.date_identification).toLocaleDateString('fr-FR')}</span>}
                          {r.category && <span className="flex items-center gap-1">• {r.category}</span>}
                        </div>
                      </td>
                      <td className="p-3 text-center font-mono text-sm text-[#172030]">{r.probabilite || 3}</td>
                      <td className="p-3 text-center font-mono text-sm text-[#172030]">{r.impact || 3}</td>
                      <td className="p-3 text-center font-mono text-sm font-medium text-[#172030]">{r.score_brut || 0}</td>
                      <td className="p-3">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-mono text-xs font-semibold" style={{ color: maitriseConfig.color }}>
                            {maitriseLevel}/5
                          </span>
                          <div className="h-1 w-12 bg-[#F3F1ED] rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all" 
                              style={{ 
                                width: `${(maitriseLevel / 5) * 100}%`, 
                                backgroundColor: maitriseConfig.color 
                              }} 
                            />
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex flex-col items-center">
                          <span className="font-mono text-sm font-medium text-[#172030]">{r.score_residuel || 0}</span>
                          {mitigation > 0 && (
                            <span className="text-[9px] text-[#1F4E39] font-medium flex items-center gap-0.5">
                              <ArrowDownRight className="h-2 w-2" /> -{mitigation}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        {/* BADGE AVEC COULEUR VIVE */}
                        <Badge 
                          className="text-[9px] font-semibold border-0 rounded-full px-2.5 py-0.5"
                          style={{ 
                            backgroundColor: config.badgeBg, 
                            color: config.badgeText 
                          }}
                        >
                          {config.label}
                        </Badge>
                      </td>
                      <td className="p-3 text-xs text-[#172030]/60 font-sans">{r.owner || "—"}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-[#172030]/40 hover:text-[#172030] hover:bg-[#F8F6F2]" onClick={() => openEdit(r)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-[#A52A2A]/50 hover:text-[#A52A2A] hover:bg-[#FDE8E8]" onClick={() => setToDelete(r)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="bg-[#F8F6F2] border-t-2 border-[#E5E2DD]">
                <td colSpan={10} className="p-3 font-medium text-sm text-[#172030] font-sans flex items-center justify-between">
                  <span>Registre consolidé ({filtered.length})</span>
                  <span className="text-xs text-[#172030]/50">Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* ============================================================
          DIALOGUES
          ============================================================ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white border-[#E5E2DD] shadow-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-[#172030] text-xl">{editing ? "Modifier le risque" : "Nouveau risque"}</DialogTitle>
            <DialogDescription className="text-[#172030]/60 font-sans text-sm">Renseignez les informations du risque et évaluez la probabilité et l'impact.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-medium text-[#172030] font-sans">Titre <span className="text-[#A52A2A]">*</span></Label>
              <Input value={form.title || ""} onChange={(e) => updateField("title", e.target.value)} placeholder="Ex: Cyberattaque ransomware" className="mt-1.5 border-[#E5E2DD] focus-visible:ring-[#2A5141]" />
            </div>

            <div>
              <Label className="text-sm font-medium text-[#172030] font-sans">Description</Label>
              <Textarea value={form.description || ""} onChange={(e) => updateField("description", e.target.value)} rows={2} placeholder="Décrivez le risque…" className="mt-1.5 border-[#E5E2DD] focus-visible:ring-[#2A5141]" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-[#172030] font-sans">Catégorie</Label>
                <Select value={form.category || "Cyber"} onValueChange={(v) => updateField("category", v)}>
                  <SelectTrigger className="mt-1.5 border-[#E5E2DD] focus:ring-[#2A5141]"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>{CATEGORIES_RISQUE.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-[#172030] font-sans">Pilote</Label>
                <Input value={form.owner || ""} onChange={(e) => updateField("owner", e.target.value)} placeholder="Nom du responsable" className="mt-1.5 border-[#E5E2DD] focus-visible:ring-[#2A5141]" />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium text-[#172030] font-sans">Probabilité</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="h-4 w-4 text-[#172030]/40 hover:text-[#2A5141] transition-colors">
                          <Info className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[250px] text-xs bg-white border-[#E5E2DD] shadow-md p-3 text-[#172030]">
                        <p className="font-semibold mb-1">Échelle de probabilité :</p>
                        <ul className="list-none space-y-0.5 text-[#172030]/80">
                          <li><span className="font-bold text-[#2A5141]">1</span> Très rare</li>
                          <li><span className="font-bold text-[#2A5141]">2</span> Rare</li>
                          <li><span className="font-bold text-[#2A5141]">3</span> Possible</li>
                          <li><span className="font-bold text-[#2A5141]">4</span> Probable</li>
                          <li><span className="font-bold text-[#2A5141]">5</span> Quasi certain</li>
                        </ul>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <span className="text-sm font-bold text-[#2A5141] font-sans">{form.probabilite || 3}/5</span>
              </div>
              <div className="flex gap-1 mt-1.5">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button key={v} onClick={() => updateField("probabilite", v)} className={cn("flex-1 h-8 text-sm font-medium rounded border transition-all flex items-center justify-center font-sans", (form.probabilite || 3) === v ? "bg-[#2A5141] text-white border-[#2A5141] shadow-sm" : "bg-white text-[#172030]/60 border-[#E5E2DD] hover:border-[#2A5141]")}>{v}</button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium text-[#172030] font-sans">Impact</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="h-4 w-4 text-[#172030]/40 hover:text-[#2A5141] transition-colors">
                          <Info className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[250px] text-xs bg-white border-[#E5E2DD] shadow-md p-3 text-[#172030]">
                        <p className="font-semibold mb-1">Échelle d'impact :</p>
                        <ul className="list-none space-y-0.5 text-[#172030]/80">
                          <li><span className="font-bold text-[#2A5141]">1</span> Négligeable</li>
                          <li><span className="font-bold text-[#2A5141]">2</span> Mineur</li>
                          <li><span className="font-bold text-[#2A5141]">3</span> Modéré</li>
                          <li><span className="font-bold text-[#2A5141]">4</span> Majeur</li>
                          <li><span className="font-bold text-[#2A5141]">5</span> Critique</li>
                        </ul>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <span className="text-sm font-bold text-[#2A5141] font-sans">{form.impact || 3}/5</span>
              </div>
              <div className="flex gap-1 mt-1.5">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button key={v} onClick={() => updateField("impact", v)} className={cn("flex-1 h-8 text-sm font-medium rounded border transition-all flex items-center justify-center font-sans", (form.impact || 3) === v ? "bg-[#2A5141] text-white border-[#2A5141] shadow-sm" : "bg-white text-[#172030]/60 border-[#E5E2DD] hover:border-[#2A5141]")}>{v}</button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium text-[#172030] font-sans">Niveau de maîtrise</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="h-4 w-4 text-[#172030]/40 hover:text-[#2A5141] transition-colors">
                          <Info className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[250px] text-xs bg-white border-[#E5E2DD] shadow-md p-3 text-[#172030]">
                        <p className="font-semibold mb-1">Échelle de maîtrise :</p>
                        <ul className="list-none space-y-0.5 text-[#172030]/80">
                          <li><span className="font-bold text-[#2A5141]">1</span> Aucune mesure</li>
                          <li><span className="font-bold text-[#2A5141]">2</span> Faible</li>
                          <li><span className="font-bold text-[#2A5141]">3</span> Moyen</li>
                          <li><span className="font-bold text-[#2A5141]">4</span> Élevé</li>
                          <li><span className="font-bold text-[#2A5141]">5</span> Total</li>
                        </ul>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <span className="text-sm font-bold text-[#2A5141] font-sans">{form.maitrise || 1}/5</span>
              </div>
              <div className="flex gap-1 mt-1.5">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button key={v} onClick={() => updateField("maitrise", v)} className={cn("flex-1 h-8 text-sm font-medium rounded border transition-all flex items-center justify-center font-sans", (form.maitrise || 1) === v ? "bg-[#2A5141] text-white border-[#2A5141] shadow-sm" : "bg-white text-[#172030]/60 border-[#E5E2DD] hover:border-[#2A5141]")}>{v}</button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-end mb-1">
                <Label className="text-sm font-medium text-[#172030] font-sans">Mesures existantes</Label>
                <Button variant="outline" size="sm" className="border-[#2A5141] text-[#2A5141] hover:bg-[#F8F6F2] gap-2" onClick={handleAIAnalyze} disabled={isAnalyzing || !form.title?.trim()}>
                  {isAnalyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {isAnalyzing ? "Analyse..." : "Suggérer avec l'IA"}
                </Button>
              </div>
              <Textarea value={form.mesures_existantes || ""} onChange={(e) => updateField("mesures_existantes", e.target.value)} rows={2} placeholder="Mesures déjà en place…" className="mt-1.5 border-[#E5E2DD] focus-visible:ring-[#2A5141]" />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[#E5E2DD]">
              <div className="bg-[#F8F6F2] rounded-xl p-3 text-center">
                <p className="text-[10px] text-[#172030]/40 font-sans uppercase tracking-wider">Score brut</p>
                <p className="text-xl font-bold text-[#172030] font-serif">{form.score_brut || 0}/25</p>
                <p className="text-[9px] text-[#172030]/30 font-sans">Probabilité × Impact</p>
              </div>
              <div className="bg-[#F8F6F2] rounded-xl p-3 text-center">
                <p className="text-[10px] text-[#172030]/40 font-sans uppercase tracking-wider">Score résiduel</p>
                <p className="text-xl font-bold text-[#172030] font-serif">{form.score_residuel || 0}/25</p>
                <Badge className={cn("mt-1 text-[9px] font-medium border-0 rounded-full px-2 py-0.5", NIVEAU_STYLE[(form.niveau || "Faible") as keyof typeof NIVEAU_STYLE]?.badge)}>
                  {form.niveau || "Faible"}
                </Badge>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-[#172030] font-sans">Statut</Label>
              <Select value={form.status || "À analyser"} onValueChange={(v) => updateField("status", v)}>
                <SelectTrigger className="mt-1.5 border-[#E5E2DD] focus:ring-[#2A5141]"><SelectValue placeholder="Statut" /></SelectTrigger>
                <SelectContent>{STATUTS_RISQUE.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-4 border-t border-[#E5E2DD]">
            <Button variant="outline" className="border-[#E5E2DD] text-[#172030]/60 hover:bg-[#F8F6F2]" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#2A5141] hover:bg-[#1F3E32] text-white shadow-sm">{saving ? "Enregistrement…" : editing ? "Mettre à jour" : "Créer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent className="bg-white border-[#E5E2DD] shadow-xl rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-[#172030] text-lg">Supprimer ce risque ?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#172030]/60 font-sans text-sm">Cette action est irréversible. Le risque « <span className="font-medium text-[#172030]">{toDelete?.title}</span> » et toutes ses données associées seront définitivement supprimés.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#E5E2DD] text-[#172030]/60 hover:bg-[#F8F6F2]">Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-[#A52A2A] hover:bg-[#8B2323] text-white">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};