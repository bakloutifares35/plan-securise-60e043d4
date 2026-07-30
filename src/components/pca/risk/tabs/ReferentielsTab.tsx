import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { type RiskData } from "../useRiskData";
import { type Actif, type Menace, TYPES_ACTIF, CATEGORIES_MENACE, ORIGINES_MENACE, INTENTIONS_MENACE, emptyActif, emptyMenace } from "../riskModel";

type Props = {
  data: RiskData;
};

export const ReferentielsTab = ({ data }: Props) => {
  const { actifs, menaces, saveActif, saveMenace, deleteRow } = data;
  const [activeTab, setActiveTab] = useState<"actifs" | "menaces">("actifs");
  const [query, setQuery] = useState("");

  // États pour Actif
  const [actifDialogOpen, setActifDialogOpen] = useState(false);
  const [editingActif, setEditingActif] = useState<Actif | null>(null);
  const [actifForm, setActifForm] = useState<Partial<Actif>>({});
  const [savingActif, setSavingActif] = useState(false);

  // États pour Menace
  const [menaceDialogOpen, setMenaceDialogOpen] = useState(false);
  const [editingMenace, setEditingMenace] = useState<Menace | null>(null);
  const [menaceForm, setMenaceForm] = useState<Partial<Menace>>({});
  const [savingMenace, setSavingMenace] = useState(false);

  // --- Actifs ---
  const openActifCreate = () => {
    setEditingActif(null);
    setActifForm(emptyActif());
    setActifDialogOpen(true);
  };

  const openActifEdit = (a: Actif) => {
    setEditingActif(a);
    setActifForm({
      nom: a.nom,
      type: a.type,
      description: a.description || "",
      proprietaire: a.proprietaire || "",
      localisation: a.localisation || "",
      criticite: a.criticite,
      besoin_d: a.besoin_d,
    });
    setActifDialogOpen(true);
  };

  const handleActifSave = async () => {
    if (!actifForm.nom?.trim()) {
      toast({ title: "Erreur", description: "Le nom est obligatoire", variant: "destructive" });
      return;
    }
    setSavingActif(true);
    await saveActif(actifForm);
    setSavingActif(false);
    setActifDialogOpen(false);
  };

  // --- Menaces ---
  const openMenaceCreate = () => {
    setEditingMenace(null);
    setMenaceForm(emptyMenace());
    setMenaceDialogOpen(true);
  };

  const openMenaceEdit = (m: Menace) => {
    setEditingMenace(m);
    setMenaceForm({
      nom: m.nom,
      code: m.code || "",
      categorie: m.categorie,
      origine: m.origine,
      intention: m.intention,
      description: m.description || "",
      referentiel: m.referentiel || "",
    });
    setMenaceDialogOpen(true);
  };

  const handleMenaceSave = async () => {
    if (!menaceForm.nom?.trim()) {
      toast({ title: "Erreur", description: "Le nom est obligatoire", variant: "destructive" });
      return;
    }
    setSavingMenace(true);
    await saveMenace(menaceForm);
    setSavingMenace(false);
    setMenaceDialogOpen(false);
  };

  // Filtres
  const filteredActifs = (actifs || []).filter(a => {
    const q = query.toLowerCase();
    if (!q) return true;
    return a.nom?.toLowerCase().includes(q) || 
           a.type?.toLowerCase().includes(q) ||
           a.proprietaire?.toLowerCase().includes(q);
  });

  const filteredMenaces = (menaces || []).filter(m => {
    const q = query.toLowerCase();
    if (!q) return true;
    return m.nom?.toLowerCase().includes(q) || 
           m.categorie?.toLowerCase().includes(q) ||
           m.code?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[#172030]">Référentiels</h2>
          <p className="text-sm text-[#172030]/60">Actifs supports et menaces</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={activeTab === "actifs" ? openActifCreate : openMenaceCreate}
            className="bg-[#2A5141] hover:bg-[#1f3d31] text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            {activeTab === "actifs" ? "Nouvel actif" : "Nouvelle menace"}
          </Button>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 border-b border-[#172030]/10">
        <button
          onClick={() => setActiveTab("actifs")}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors border-b-2",
            activeTab === "actifs"
              ? "border-[#2A5141] text-[#172030]"
              : "border-transparent text-[#172030]/50 hover:text-[#172030]"
          )}
        >
          Actifs ({actifs?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("menaces")}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors border-b-2",
            activeTab === "menaces"
              ? "border-[#2A5141] text-[#172030]"
              : "border-transparent text-[#172030]/50 hover:text-[#172030]"
          )}
        >
          Menaces ({menaces?.length || 0})
        </button>
      </div>

      {/* Recherche */}
      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#172030]/40" />
        <Input
          placeholder="Rechercher..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9 border-[#172030]/20 focus:border-[#2A5141]"
        />
      </div>

      {/* Liste des Actifs */}
      {activeTab === "actifs" && (
        <div className="border rounded-xl overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#F8F6F2] border-b border-[#E8E4DC]">
                  <th className="text-left text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider p-3">Actif</th>
                  <th className="text-left text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider p-3">Type</th>
                  <th className="text-left text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider p-3">Processus</th>
                  <th className="text-left text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider p-3">Propriétaire</th>
                  <th className="text-center text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider p-3">Criticité</th>
                  <th className="text-center text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider p-3">D</th>
                  <th className="text-center text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredActifs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-[#172030]/40">
                      Aucun actif trouvé
                    </td>
                  </tr>
                ) : (
                  filteredActifs.map((a) => (
                    <tr key={a.id} className="border-b border-[#E8E4DC] hover:bg-[#F8F6F2] transition-colors">
                      <td className="p-3 font-medium text-[#172030]">{a.nom}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs border-[#172030]/20">
                          {a.type || "—"}
                        </Badge>
                      </td>
                      <td className="p-3 text-xs text-[#172030]/40">—</td>
                      <td className="p-3 text-xs text-[#172030]/60">{a.proprietaire || "—"}</td>
                      <td className="p-3 text-center">
                        <Badge className={cn(
                          "text-xs",
                          a.criticite >= 4 ? "bg-red-100 text-red-700" :
                          a.criticite >= 3 ? "bg-orange-100 text-orange-700" :
                          "bg-green-100 text-green-700"
                        )}>
                          {a.criticite || 0}/5
                        </Badge>
                      </td>
                      <td className="p-3 text-center font-mono text-xs text-[#172030]/60">
                        {a.besoin_d || 0}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:bg-[#F8F6F2]"
                            onClick={() => openActifEdit(a)}
                          >
                            <Pencil className="h-3.5 w-3.5 text-[#172030]/60" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:bg-red-50"
                            onClick={() => {
                              if (confirm(`Supprimer "${a.nom}" ?`)) {
                                deleteRow("actifs", a.id);
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-400 hover:text-red-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-[#F8F6F2] border-t-2 border-[#E8E4DC]">
                  <td colSpan={7} className="p-3 font-semibold text-sm text-[#172030]">
                    {filteredActifs.length} actif{filteredActifs.length > 1 ? 's' : ''}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Liste des Menaces */}
      {activeTab === "menaces" && (
        <div className="border rounded-xl overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#F8F6F2] border-b border-[#E8E4DC]">
                  <th className="text-left text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider p-3">Code</th>
                  <th className="text-left text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider p-3">Menace</th>
                  <th className="text-left text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider p-3">Catégorie</th>
                  <th className="text-left text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider p-3">Origine</th>
                  <th className="text-left text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider p-3">Intention</th>
                  <th className="text-center text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMenaces.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-[#172030]/40">
                      Aucune menace trouvée
                    </td>
                  </tr>
                ) : (
                  filteredMenaces.map((m) => (
                    <tr key={m.id} className="border-b border-[#E8E4DC] hover:bg-[#F8F6F2] transition-colors">
                      <td className="p-3 font-mono text-xs text-[#172030]/40">{m.code || "—"}</td>
                      <td className="p-3 font-medium text-[#172030]">{m.nom}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs border-[#172030]/20">
                          {m.categorie || "—"}
                        </Badge>
                      </td>
                      <td className="p-3 text-xs text-[#172030]/60">{m.origine || "—"}</td>
                      <td className="p-3 text-xs text-[#172030]/60">{m.intention || "—"}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:bg-[#F8F6F2]"
                            onClick={() => openMenaceEdit(m)}
                          >
                            <Pencil className="h-3.5 w-3.5 text-[#172030]/60" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:bg-red-50"
                            onClick={() => {
                              if (confirm(`Supprimer "${m.nom}" ?`)) {
                                deleteRow("menaces", m.id);
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-400 hover:text-red-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-[#F8F6F2] border-t-2 border-[#E8E4DC]">
                  <td colSpan={6} className="p-3 font-semibold text-sm text-[#172030]">
                    {filteredMenaces.length} menace{filteredMenaces.length > 1 ? 's' : ''}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Dialog Création/Édition Actif - SEULEMENT Disponibilité */}
      <Dialog open={actifDialogOpen} onOpenChange={setActifDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl text-[#172030]">
              {editingActif ? "Modifier l'actif" : "Nouvel actif"}
            </DialogTitle>
            <DialogDescription className="text-[#172030]/60">
              Renseignez les informations de l'actif support.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Nom */}
            <div>
              <Label className="text-sm font-medium text-[#172030]">
                Nom <span className="text-red-500">*</span>
              </Label>
              <Input
                value={actifForm.nom || ""}
                onChange={(e) => setActifForm({ ...actifForm, nom: e.target.value })}
                placeholder="Nom de l'actif"
                className="mt-1 border-[#172030]/20 focus:border-[#2A5141]"
              />
            </div>

            {/* Type */}
            <div>
              <Label className="text-sm font-medium text-[#172030]">Type</Label>
              <Select
                value={actifForm.type || "Information"}
                onValueChange={(v) => setActifForm({ ...actifForm, type: v })}
              >
                <SelectTrigger className="mt-1 border-[#172030]/20">
                  <SelectValue placeholder="Sélectionner un type" />
                </SelectTrigger>
                <SelectContent>
                  {TYPES_ACTIF.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Propriétaire */}
            <div>
              <Label className="text-sm font-medium text-[#172030]">Propriétaire</Label>
              <Input
                value={actifForm.proprietaire || ""}
                onChange={(e) => setActifForm({ ...actifForm, proprietaire: e.target.value })}
                placeholder="Nom du propriétaire"
                className="mt-1 border-[#172030]/20 focus:border-[#2A5141]"
              />
            </div>

            {/* Description */}
            <div>
              <Label className="text-sm font-medium text-[#172030]">Description</Label>
              <Textarea
                value={actifForm.description || ""}
                onChange={(e) => setActifForm({ ...actifForm, description: e.target.value })}
                rows={2}
                placeholder="Description de l'actif..."
                className="mt-1 border-[#172030]/20 focus:border-[#2A5141]"
              />
            </div>

            {/* SEULEMENT Disponibilité - PAS Intégrité, Confidentialité, Traçabilité */}
            <div className="border-t border-[#172030]/10 pt-4">
              <div className="flex justify-between items-center mb-1">
                <Label className="text-sm font-medium text-[#172030]">Disponibilité</Label>
                <span className="text-sm font-bold text-[#2A5141]">{actifForm.besoin_d || 1}/5</span>
              </div>
              <div className="flex gap-2 mt-1">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    onClick={() => setActifForm({ ...actifForm, besoin_d: v })}
                    className={cn(
                      "w-10 h-10 text-base font-medium rounded-lg border transition-all flex items-center justify-center",
                      (actifForm.besoin_d || 1) === v
                        ? "bg-[#2A5141] text-white border-[#2A5141] shadow-md"
                        : "bg-white text-[#172030]/60 border-[#172030]/20 hover:border-[#2A5141] hover:bg-[#F8F6F2]"
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Criticité calculée automatiquement */}
            <div className="bg-[#F8F6F2] rounded-lg p-3 border border-[#172030]/10">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#172030]">Criticité calculée</span>
                <Badge className={cn(
                  "text-base px-4 py-1",
                  (actifForm.besoin_d || 1) >= 4
                    ? "bg-red-100 text-red-700"
                    : (actifForm.besoin_d || 1) >= 3
                    ? "bg-orange-100 text-orange-700"
                    : "bg-green-100 text-green-700"
                )}>
                  {actifForm.besoin_d || 1}/5
                </Badge>
              </div>
              <p className="text-xs text-[#172030]/50 mt-1">
                La criticité est égale au besoin de disponibilité.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-4 border-t border-[#172030]/10">
            <Button variant="outline" onClick={() => setActifDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleActifSave}
              disabled={savingActif}
              className="bg-[#2A5141] hover:bg-[#1f3d31] text-white"
            >
              {savingActif ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Création/Édition Menace */}
      <Dialog open={menaceDialogOpen} onOpenChange={setMenaceDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl text-[#172030]">
              {editingMenace ? "Modifier la menace" : "Nouvelle menace"}
            </DialogTitle>
            <DialogDescription className="text-[#172030]/60">
              Renseignez les informations de la menace.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <Label className="text-sm font-medium text-[#172030]">
                Nom <span className="text-red-500">*</span>
              </Label>
              <Input
                value={menaceForm.nom || ""}
                onChange={(e) => setMenaceForm({ ...menaceForm, nom: e.target.value })}
                placeholder="Nom de la menace"
                className="mt-1 border-[#172030]/20 focus:border-[#2A5141]"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-[#172030]">Code</Label>
              <Input
                value={menaceForm.code || ""}
                onChange={(e) => setMenaceForm({ ...menaceForm, code: e.target.value })}
                placeholder="Ex: M-001"
                className="mt-1 border-[#172030]/20 focus:border-[#2A5141]"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-[#172030]">Catégorie</Label>
              <Select
                value={menaceForm.categorie || "Cyber"}
                onValueChange={(v) => setMenaceForm({ ...menaceForm, categorie: v })}
              >
                <SelectTrigger className="mt-1 border-[#172030]/20">
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES_MENACE.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium text-[#172030]">Origine</Label>
                <Select
                  value={menaceForm.origine || "Externe"}
                  onValueChange={(v) => setMenaceForm({ ...menaceForm, origine: v })}
                >
                  <SelectTrigger className="mt-1 border-[#172030]/20">
                    <SelectValue placeholder="Origine" />
                  </SelectTrigger>
                  <SelectContent>
                    {ORIGINES_MENACE.map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-[#172030]">Intention</Label>
                <Select
                  value={menaceForm.intention || "Délibérée"}
                  onValueChange={(v) => setMenaceForm({ ...menaceForm, intention: v })}
                >
                  <SelectTrigger className="mt-1 border-[#172030]/20">
                    <SelectValue placeholder="Intention" />
                  </SelectTrigger>
                  <SelectContent>
                    {INTENTIONS_MENACE.map((i) => (
                      <SelectItem key={i} value={i}>{i}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-[#172030]">Description</Label>
              <Textarea
                value={menaceForm.description || ""}
                onChange={(e) => setMenaceForm({ ...menaceForm, description: e.target.value })}
                rows={2}
                placeholder="Description de la menace..."
                className="mt-1 border-[#172030]/20 focus:border-[#2A5141]"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-[#172030]">Référentiel</Label>
              <Input
                value={menaceForm.referentiel || ""}
                onChange={(e) => setMenaceForm({ ...menaceForm, referentiel: e.target.value })}
                placeholder="Ex: NIST, ISO 27005"
                className="mt-1 border-[#172030]/20 focus:border-[#2A5141]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-4 border-t border-[#172030]/10">
            <Button variant="outline" onClick={() => setMenaceDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleMenaceSave}
              disabled={savingMenace}
              className="bg-[#2A5141] hover:bg-[#1f3d31] text-white"
            >
              {savingMenace ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};