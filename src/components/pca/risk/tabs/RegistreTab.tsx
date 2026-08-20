import { useState } from "react";
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
  Sparkles, Loader2, Info // 🔥 Ajout de l'icône Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/resillia/client";
import { type RiskData } from "../useRiskData";
import { type Risque, CATEGORIES_RISQUE, STATUTS_RISQUE, recompute, emptyRisque, NIVEAU_STYLE } from "../riskModel";
// 🔥 Imports pour le Tooltip
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Props = {
  data: RiskData;
};

type FilterType = "all" | "critical" | "analyzed" | "pending" | null;

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

  // ==========================================================
  // handleAIAnalyze : Remplit Probabilité, Impact, Maîtrise, Mesures
  // ==========================================================
  const handleAIAnalyze = async () => {
    if (!form.title?.trim()) {
      toast({ title: "Erreur", description: "Veuillez d'abord saisir le titre du risque.", variant: "destructive" });
      return;
    }

    setIsAnalyzing(true);
    try {
      const context = {
        title: form.title,
        description: form.description || "",
        category: form.category || "Cyber",
      };

      const { data, error } = await supabase.functions.invoke('groq-strategy-assist', {
        body: { 
          action: 'suggest_risk_measures',
          context 
        }
      });

      if (error) throw error;

      const updates: Partial<Risque> = {
        mesures_existantes: data?.mesures_existantes || form.mesures_existantes || "",
      };

      if (typeof data?.probabilite === 'number') updates.probabilite = data.probabilite;
      if (typeof data?.impact === 'number') updates.impact = data.impact;
      if (typeof data?.maitrise === 'number') updates.maitrise = data.maitrise;

      const updatedForm = { ...form, ...updates };
      const recomputed = recompute(updatedForm);
      
      setForm({
        ...updatedForm,
        score_brut: recomputed.score_brut,
        score_residuel: recomputed.score_residuel,
        niveau: recomputed.niveau,
      });

      toast({ 
        title: "Suggestions IA", 
        description: "Probabilité, impact, maîtrise et mesures suggérés par l'IA." 
      });
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

  const filtered = risques.filter((r) => {
    const q = query.trim().toLowerCase();
    if (q) {
      const searchText = `${r.title} ${r.description ?? ""} ${r.category ?? ""} ${r.owner ?? ""}`.toLowerCase();
      if (!searchText.includes(q)) return false;
    }
    if (filterSev !== "all" && r.niveau !== filterSev) return false;
    if (activeFilter === "critical" && r.niveau !== "Critique") return false;
    if (activeFilter === "analyzed" && (!r.score_brut || r.score_brut === 0)) return false;
    if (activeFilter === "pending" && r.status !== "À analyser") return false;
    return true;
  });

  const stats = {
    total: risques.length,
    critical: risques.filter((r) => r.niveau === "Critique").length,
    analyzed: risques.filter((r) => r.score_brut !== undefined && r.score_brut > 0).length,
    pending: risques.filter((r) => r.status === "À analyser").length,
  };

  const getReference = (index: number) => {
    return `R-${String(index + 1).padStart(4, '0')}`;
  };

  if (loading) {
    return <div className="text-center py-8 text-[#172030]/60 font-sans">Chargement...</div>;
  }

  return (
    <div className="max-w-[1440px] mx-auto space-y-6 font-sans">
      <Card className="border-0 shadow-sm bg-white rounded-xl">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="font-serif text-2xl font-bold tracking-tight text-[#172030]">Registre des risques</h2>
              <p className="text-sm text-[#172030]/60 mt-1 font-sans">Gérez tous vos risques évalués.</p>
            </div>
            <Button onClick={openCreate} className="bg-[#2A5141] hover:bg-[#1F3E32] text-white shadow-sm">
              <Plus className="h-4 w-4 mr-2" /> Nouveau risque
            </Button>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div onClick={() => setActiveFilter(activeFilter === "all" ? null : "all")} className={cn("rounded-xl p-4 border transition-all duration-200 cursor-pointer hover:shadow-sm", activeFilter === "all" ? "bg-[#F8F6F2] border-[#2A5141] ring-1 ring-[#2A5141]" : "bg-[#F3F1ED] border-transparent hover:border-[#2A5141]/30")}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#172030] text-sm font-medium"><Database className="h-4 w-4 text-[#172030]/50" /><span>Total</span></div>
                {activeFilter === "all" && <div className="h-2 w-2 rounded-full bg-[#2A5141]" />}
              </div>
              <div className="text-3xl font-bold text-[#172030] mt-2 font-serif">{stats.total}</div>
            </div>
            <div onClick={() => setActiveFilter(activeFilter === "critical" ? null : "critical")} className={cn("rounded-xl p-4 border transition-all duration-200 cursor-pointer hover:shadow-sm", activeFilter === "critical" ? "bg-[#FDE8E8] border-[#A52A2A] ring-1 ring-[#A52A2A]" : "bg-[#FDE8E8]/50 border-transparent hover:border-[#A52A2A]/30")}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#A52A2A] text-sm font-medium"><AlertTriangle className="h-4 w-4" /><span>Critiques</span></div>
                {activeFilter === "critical" && <div className="h-2 w-2 rounded-full bg-[#A52A2A]" />}
              </div>
              <div className="text-3xl font-bold text-[#A52A2A] mt-2 font-serif">{stats.critical}</div>
            </div>
            <div onClick={() => setActiveFilter(activeFilter === "analyzed" ? null : "analyzed")} className={cn("rounded-xl p-4 border transition-all duration-200 cursor-pointer hover:shadow-sm", activeFilter === "analyzed" ? "bg-[#E5F0EB] border-[#1F4E39] ring-1 ring-[#1F4E39]" : "bg-[#E5F0EB]/50 border-transparent hover:border-[#1F4E39]/30")}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#1F4E39] text-sm font-medium"><CheckCircle2 className="h-4 w-4" /><span>Analysés</span></div>
                {activeFilter === "analyzed" && <div className="h-2 w-2 rounded-full bg-[#1F4E39]" />}
              </div>
              <div className="text-3xl font-bold text-[#1F4E39] mt-2 font-serif">{stats.analyzed}</div>
            </div>
            <div onClick={() => setActiveFilter(activeFilter === "pending" ? null : "pending")} className={cn("rounded-xl p-4 border transition-all duration-200 cursor-pointer hover:shadow-sm", activeFilter === "pending" ? "bg-[#FDF3D6] border-[#A38730] ring-1 ring-[#A38730]" : "bg-[#FDF3D6]/50 border-transparent hover:border-[#A38730]/30")}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#A38730] text-sm font-medium"><Clock className="h-4 w-4" /><span>À analyser</span></div>
                {activeFilter === "pending" && <div className="h-2 w-2 rounded-full bg-[#A38730]" />}
              </div>
              <div className="text-3xl font-bold text-[#A38730] mt-2 font-serif">{stats.pending}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#172030]/40" />
          <Input placeholder="Rechercher un risque..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9 border-[#E5E2DD] focus-visible:ring-[#2A5141] bg-white shadow-sm" />
        </div>
        <Select value={filterSev} onValueChange={setFilterSev}>
          <SelectTrigger className="w-full md:w-[180px] border-[#E5E2DD] focus:ring-[#2A5141] bg-white shadow-sm">
            <SelectValue placeholder="Tous les niveaux" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les niveaux</SelectItem>
            {["Faible", "Modéré", "Élevé", "Critique"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        {(activeFilter || filterSev !== "all" || query) && (
          <Button variant="outline" onClick={() => { setActiveFilter(null); setFilterSev("all"); setQuery(""); }} className="border-[#E5E2DD] text-[#172030]/60 hover:text-[#2A5141] shadow-sm bg-white">Réinitialiser</Button>
        )}
      </div>

      <Card className="border-0 shadow-sm bg-white rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#F8F6F2] border-b border-[#E5E2DD]">
                <th className="text-left text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider p-3 font-sans">Réf.</th>
                <th className="text-left text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider p-3 font-sans">Risque</th>
                <th className="text-left text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider p-3 font-sans">Actif / Menace</th>
                <th className="text-center text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider p-3 font-sans">P</th>
                <th className="text-center text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider p-3 font-sans">I</th>
                <th className="text-center text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider p-3 font-sans">Brut</th>
                <th className="text-center text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider p-3 font-sans">Maîtrise</th>
                <th className="text-center text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider p-3 font-sans">Résiduel</th>
                <th className="text-center text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider p-3 font-sans">Niveau</th>
                <th className="text-left text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider p-3 font-sans">Pilote</th>
                <th className="text-center text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider p-3 font-sans">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-[#172030]/40 font-sans">
                    <div className="h-12 w-12 rounded-full bg-[#F8F6F2] flex items-center justify-center mx-auto mb-2"><Database className="h-5 w-5 text-[#172030]/20" /></div>
                    <p className="text-sm">Aucun risque trouvé</p>
                    <p className="text-xs mt-1">Essayez de modifier vos filtres.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((r, index) => {
                  const niveau = r.niveau || "Faible";
                  const style = NIVEAU_STYLE[niveau as keyof typeof NIVEAU_STYLE];
                  return (
                    <tr key={r.id} className="border-b border-[#F3F1ED] hover:bg-[#F8F6F2]/80 transition-colors">
                      <td className="p-3 font-mono text-xs text-[#172030]/50 font-sans">{getReference(index)}</td>
                      <td className="p-3">
                        <div className="font-medium text-[#172030] font-sans">{r.title}</div>
                        <div className="text-[10px] text-[#172030]/40 flex items-center gap-2 mt-0.5 font-sans">
                          <Badge variant="outline" className="text-[8px] border-[#E5E2DD] text-[#172030]/50 rounded-full px-2 py-0.5 h-5 bg-white">{r.status || "À analyser"}</Badge>
                          {r.date_identification && <span className="flex items-center gap-1">revue {new Date(r.date_identification).toLocaleDateString('fr-FR')}</span>}
                          {r.category && <span className="flex items-center gap-1">• {r.category}</span>}
                        </div>
                      </td>
                      <td className="p-3 text-xs text-[#172030]/40 font-sans">—</td>
                      <td className="p-3 text-center font-mono text-sm text-[#172030]">{r.probabilite || 3}</td>
                      <td className="p-3 text-center font-mono text-sm text-[#172030]">{r.impact || 3}</td>
                      <td className="p-3 text-center font-mono text-sm font-medium text-[#172030]">{r.score_brut || 0}</td>
                      <td className="p-3 text-center font-mono text-sm text-[#172030]">{r.maitrise || 1}</td>
                      <td className="p-3 text-center font-mono text-sm font-medium text-[#172030]">{r.score_residuel || 0}</td>
                      <td className="p-3 text-center"><Badge className={cn("text-[9px] font-medium border-0 rounded-full px-2 py-0.5", style?.badge)}>{niveau}</Badge></td>
                      <td className="p-3 text-xs text-[#172030]/60 font-sans">{r.owner || "—"}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-[#172030]/40 hover:text-[#172030] hover:bg-[#F8F6F2]" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-[#A52A2A]/50 hover:text-[#A52A2A] hover:bg-[#FDE8E8]" onClick={() => setToDelete(r)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="bg-[#F8F6F2] border-t-2 border-[#E5E2DD]">
                <td colSpan={11} className="p-3 font-medium text-sm text-[#172030] font-sans">Registre des risques ({filtered.length})</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

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
                  {/* 🔥 TOOLTIP PROBABILITÉ */}
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
                  {/* 🔥 TOOLTIP IMPACT */}
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
                  {/* 🔥 TOOLTIP MAÎTRISE */}
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