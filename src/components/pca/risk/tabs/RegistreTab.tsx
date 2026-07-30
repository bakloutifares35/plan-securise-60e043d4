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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type RiskData } from "../useRiskData";
import { type Risque, CATEGORIES_RISQUE, STATUTS_RISQUE, recompute, emptyRisque, NIVEAU_STYLE } from "../riskModel";

type Props = {
  data: RiskData;
};

export const RegistreTab = ({ data }: Props) => {
  const { risques, loading, saveRisque, deleteRow } = data;
  const [query, setQuery] = useState("");
  const [filterSev, setFilterSev] = useState<string>("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Risque | null>(null);
  const [form, setForm] = useState<Partial<Risque>>({});
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Risque | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyRisque());
    setDialogOpen(true);
  };

  const openEdit = (r: Risque) => {
    setEditing(r);
    setForm({
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
    return <div className="text-center py-8 text-[#172030]/60">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header avec stats */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-[#172030]/10 p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-[#172030]">Registre des risques</h2>
            <p className="text-sm text-[#172030]/70 mt-1">
              Gérez tous vos risques évalués.
            </p>
          </div>
          <Button 
            onClick={openCreate} 
            className="bg-[#2A5141] hover:bg-[#1f3d31] text-white"
          >
            <Plus className="h-4 w-4 mr-2" /> Nouveau risque
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-[#2A5141]/10 rounded-lg p-4 border border-[#2A5141]/20">
            <div className="flex items-center gap-2 text-[#2A5141] text-sm">
              <Database className="h-4 w-4" />
              <span>Total</span>
            </div>
            <div className="text-2xl font-bold text-[#2A5141] mt-1">{stats.total}</div>
          </div>
          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span>Critiques</span>
            </div>
            <div className="text-2xl font-bold text-red-700 mt-1">{stats.critical}</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle2 className="h-4 w-4" />
              <span>Analysés</span>
            </div>
            <div className="text-2xl font-bold text-green-700 mt-1">{stats.analyzed}</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
            <div className="flex items-center gap-2 text-yellow-600 text-sm">
              <Clock className="h-4 w-4" />
              <span>À analyser</span>
            </div>
            <div className="text-2xl font-bold text-yellow-700 mt-1">{stats.pending}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#172030]/40" />
          <Input
            placeholder="Rechercher un risque..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 border-[#172030]/20 focus:border-[#2A5141]"
          />
        </div>
        <Select value={filterSev} onValueChange={setFilterSev}>
          <SelectTrigger className="w-full md:w-[180px] border-[#172030]/20">
            <SelectValue placeholder="Tous les niveaux" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les niveaux</SelectItem>
            {["Faible", "Modéré", "Élevé", "Critique"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Tableau */}
      <div className="border rounded-xl overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#F8F6F2] border-b border-[#E8E4DC]">
                <th className="text-left text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider p-3">Réf.</th>
                <th className="text-left text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider p-3">Risque</th>
                <th className="text-left text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider p-3">Actif / Menace</th>
                <th className="text-center text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider p-3">P</th>
                <th className="text-center text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider p-3">I</th>
                <th className="text-center text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider p-3">Brut</th>
                <th className="text-center text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider p-3">Maîtrise</th>
                <th className="text-center text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider p-3">Résiduel</th>
                <th className="text-center text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider p-3">Niveau</th>
                <th className="text-left text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider p-3">Pilote</th>
                <th className="text-center text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-8 text-[#172030]/40">
                    Aucun risque trouvé
                  </td>
                </tr>
              ) : (
                filtered.map((r, index) => {
                  const niveau = r.niveau || "Faible";
                  const style = NIVEAU_STYLE[niveau as keyof typeof NIVEAU_STYLE];
                  
                  return (
                    <tr key={r.id} className="border-b border-[#E8E4DC] hover:bg-[#F8F6F2] transition-colors">
                      <td className="p-3 font-mono text-xs text-[#172030]/60">{getReference(index)}</td>
                      <td className="p-3">
                        <div className="font-medium text-[#172030]">{r.title}</div>
                        <div className="text-xs text-[#172030]/40 flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[9px] border-[#172030]/20">
                            {r.status || "À analyser"}
                          </Badge>
                          {r.date_identification && (
                            <span>revue {new Date(r.date_identification).toLocaleDateString('fr-FR')}</span>
                          )}
                          {r.category && (
                            <span>• {r.category}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-xs text-[#172030]/40">—</td>
                      <td className="p-3 text-center font-mono text-sm">{r.probabilite || 3}</td>
                      <td className="p-3 text-center font-mono text-sm">{r.impact || 3}</td>
                      <td className="p-3 text-center font-mono text-sm font-medium">{r.score_brut || 0}</td>
                      <td className="p-3 text-center font-mono text-sm">{r.maitrise || 1}</td>
                      <td className="p-3 text-center font-mono text-sm font-medium">{r.score_residuel || 0}</td>
                      <td className="p-3 text-center">
                        <Badge className={cn("text-[10px]", style?.badge)}>
                          {niveau}
                        </Badge>
                      </td>
                      <td className="p-3 text-xs text-[#172030]/60">{r.owner || "—"}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:bg-[#F8F6F2]"
                            onClick={() => openEdit(r)}
                          >
                            <Pencil className="h-3.5 w-3.5 text-[#172030]/60" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:bg-red-50"
                            onClick={() => setToDelete(r)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-400 hover:text-red-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="bg-[#F8F6F2] border-t-2 border-[#E8E4DC]">
                <td colSpan={11} className="p-3 font-semibold text-sm text-[#172030]">
                  Registre des risques ({filtered.length})
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Dialog Création/Édition */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl text-[#172030]">
              {editing ? "Modifier le risque" : "Nouveau risque"}
            </DialogTitle>
            <DialogDescription className="text-[#172030]/60">
              Renseignez les informations du risque et évaluez la probabilité et l'impact.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {/* Titre */}
            <div>
              <Label className="text-sm font-medium text-[#172030]">
                Titre <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.title || ""}
                onChange={(e) => updateField("title", e.target.value)}
                placeholder="Ex: Cyberattaque ransomware"
                className="mt-1 border-[#172030]/20 focus:border-[#2A5141]"
              />
            </div>

            {/* Description */}
            <div>
              <Label className="text-sm font-medium text-[#172030]">Description</Label>
              <Textarea
                value={form.description || ""}
                onChange={(e) => updateField("description", e.target.value)}
                rows={2}
                placeholder="Décrivez le risque…"
                className="mt-1 border-[#172030]/20 focus:border-[#2A5141]"
              />
            </div>

            {/* Catégorie + Pilote sur une ligne */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium text-[#172030]">Catégorie</Label>
                <Select
                  value={form.category || "Cyber"}
                  onValueChange={(v) => updateField("category", v)}
                >
                  <SelectTrigger className="mt-1 border-[#172030]/20">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES_RISQUE.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-[#172030]">Pilote</Label>
                <Input
                  value={form.owner || ""}
                  onChange={(e) => updateField("owner", e.target.value)}
                  placeholder="Nom du responsable"
                  className="mt-1 border-[#172030]/20 focus:border-[#2A5141]"
                />
              </div>
            </div>

            {/* Probabilité + Impact côte à côte */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between items-center">
                  <Label className="text-sm font-medium text-[#172030]">Probabilité</Label>
                  <span className="text-sm font-bold text-[#2A5141]">{form.probabilite || 3}/5</span>
                </div>
                <div className="flex gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button
                      key={v}
                      onClick={() => updateField("probabilite", v)}
                      className={cn(
                        "flex-1 h-8 text-sm font-medium rounded border transition-all flex items-center justify-center",
                        (form.probabilite || 3) === v
                          ? "bg-[#2A5141] text-white border-[#2A5141]"
                          : "bg-white text-[#172030]/60 border-[#172030]/20 hover:border-[#2A5141]"
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center">
                  <Label className="text-sm font-medium text-[#172030]">Impact</Label>
                  <span className="text-sm font-bold text-[#2A5141]">{form.impact || 3}/5</span>
                </div>
                <div className="flex gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button
                      key={v}
                      onClick={() => updateField("impact", v)}
                      className={cn(
                        "flex-1 h-8 text-sm font-medium rounded border transition-all flex items-center justify-center",
                        (form.impact || 3) === v
                          ? "bg-[#2A5141] text-white border-[#2A5141]"
                          : "bg-white text-[#172030]/60 border-[#172030]/20 hover:border-[#2A5141]"
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Niveau de maîtrise actuel */}
            <div>
              <div className="flex justify-between items-center">
                <Label className="text-sm font-medium text-[#172030]">Niveau de maîtrise actuel</Label>
                <span className="text-sm font-bold text-[#2A5141]">{form.maitrise || 1}/5</span>
              </div>
              <div className="flex gap-1 mt-1">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    onClick={() => updateField("maitrise", v)}
                    className={cn(
                      "flex-1 h-8 text-sm font-medium rounded border transition-all flex items-center justify-center",
                      (form.maitrise || 1) === v
                        ? "bg-[#2A5141] text-white border-[#2A5141]"
                        : "bg-white text-[#172030]/60 border-[#172030]/20 hover:border-[#2A5141]"
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Mesures existantes */}
            <div>
              <Label className="text-sm font-medium text-[#172030]">Mesures existantes</Label>
              <Textarea
                value={form.mesures_existantes || ""}
                onChange={(e) => updateField("mesures_existantes", e.target.value)}
                rows={2}
                placeholder="Mesures déjà en place…"
                className="mt-1 border-[#172030]/20 focus:border-[#2A5141]"
              />
            </div>

            {/* Scores côte à côte */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#172030]/10">
              <div className="bg-[#F8F6F2] rounded-lg p-2 text-center">
                <p className="text-xs text-[#172030]/50">Score brut</p>
                <p className="text-lg font-bold text-[#172030]">{form.score_brut || 0}/25</p>
                <p className="text-[9px] text-[#172030]/40">Probabilité × Impact</p>
              </div>
              <div className="bg-[#F8F6F2] rounded-lg p-2 text-center">
                <p className="text-xs text-[#172030]/50">Score résiduel</p>
                <p className="text-lg font-bold text-[#172030]">{form.score_residuel || 0}/25</p>
                <Badge className={cn(
                  "mt-0.5",
                  NIVEAU_STYLE[(form.niveau || "Faible") as keyof typeof NIVEAU_STYLE]?.badge
                )}>
                  {form.niveau || "Faible"}
                </Badge>
              </div>
            </div>

            {/* Statut */}
            <div>
              <Label className="text-sm font-medium text-[#172030]">Statut</Label>
              <Select
                value={form.status || "À analyser"}
                onValueChange={(v) => updateField("status", v)}
              >
                <SelectTrigger className="mt-1 border-[#172030]/20">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  {STATUTS_RISQUE.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-3 border-t border-[#172030]/10">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#2A5141] hover:bg-[#1f3d31] text-white"
            >
              {saving ? "Enregistrement…" : editing ? "Mettre à jour" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#172030]">Supprimer ce risque ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le risque « {toDelete?.title} » sera supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};