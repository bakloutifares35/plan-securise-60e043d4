import { useState, useMemo, useEffect } from "react";
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
import { supabase } from "@/integrations/supabase/db";
import { 
  Plus, Pencil, Trash2, AlertTriangle, CheckCircle2, Clock, Euro, Loader2,
  TrendingUp, Zap, Target, Shield
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type RiskData } from "../useRiskData";
import { type Risque, NIVEAU_STYLE } from "../riskModel";

type Props = {
  data: RiskData;
};

type Measure = {
  id: string;
  risque_id: string;
  mesure: string;
  description: string | null;
  type_mesure: string;
  responsable: string | null;
  echeance: string | null;
  cout_estime: number;
  charge_jh: number;
  avancement: number;
  statut: string;
  created_at?: string;
};

// ============================================================
// CHARTE GRAPHIQUE RESILLIA PREMIUM
// ============================================================
const COLORS = {
  navy: "#172030",
  cream: "#F8F6F2",
  forest: "#2A5141",
  text: "#172030",
  muted: "#6C7A8A",
  border: "#E5E2DD",
  
  // Badges d'avancement (Intégration des teintes Resillia)
  progress: {
    done: { bg: "#E5F0EB", text: "#1F4E39" },    // Vert Forêt clair
    half: { bg: "#FDF3D6", text: "#A38730" },    // Ambre/Doré
    low: { bg: "#F8F6F2", text: "#6C7A8A" },     // Gris subtil
  }
};

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================
export const PlansTab = ({ data }: Props) => {
  const { risques } = data;

  const [selectedRiskId, setSelectedRiskId] = useState<string>("");
  const [measures, setMeasures] = useState<Measure[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMeasure, setEditingMeasure] = useState<Measure | null>(null);
  const [form, setForm] = useState({
    mesure: "",
    description: "",
    responsable: "",
    echeance: "",
    cout_estime: "",
    charge_jh: "",
    type_mesure: "Préventive",
    avancement: 0,
    statut: "À faire",
  });

  // Charger les mesures depuis Supabase
  const loadMeasures = async () => {
    setLoading(true);
    try {
      const { data: measuresData, error } = await supabase
        .from("plans_traitement")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMeasures(measuresData || []);
    } catch (error: any) {
      console.error("Erreur chargement mesures:", error);
      toast({ 
        title: "Erreur", 
        description: error.message || "Impossible de charger les mesures", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeasures();
  }, []);

  // KPI dynamiques
  const stats = useMemo(() => {
    const total = measures.length;
    
    let totalAvancement = 0;
    let mesuresAvecAvancement = 0;
    for (const m of measures) {
      if (m.avancement !== undefined && m.avancement !== null) {
        totalAvancement += m.avancement;
        mesuresAvecAvancement++;
      }
    }
    const avancementMoyen = mesuresAvecAvancement > 0 
      ? Math.round(totalAvancement / mesuresAvecAvancement) 
      : 0;

    let coutTotal = 0;
    for (const m of measures) {
      if (m.cout_estime) {
        coutTotal += Number(m.cout_estime);
      }
    }

    const actionsTerminees = measures.filter(m => m.avancement === 100).length;
    const actionsEnCours = measures.filter(m => m.avancement > 0 && m.avancement < 100).length;

    return {
      total,
      avancementMoyen,
      coutTotal,
      actionsTerminees,
      actionsEnCours,
    };
  }, [measures]);

  const selectedRisk = risques.find(r => r.id === selectedRiskId);
  const riskMeasures = measures.filter(m => m.risque_id === selectedRiskId);

  const openCreate = () => {
    setEditingMeasure(null);
    setForm({
      mesure: "",
      description: "",
      responsable: "",
      echeance: "",
      cout_estime: "",
      charge_jh: "",
      type_mesure: "Préventive",
      avancement: 0,
      statut: "À faire",
    });
    setDialogOpen(true);
  };

  const openEdit = (measure: Measure) => {
    setEditingMeasure(measure);
    setForm({
      mesure: measure.mesure,
      description: measure.description || "",
      responsable: measure.responsable || "",
      echeance: measure.echeance || "",
      cout_estime: String(measure.cout_estime || ""),
      charge_jh: String(measure.charge_jh || ""),
      type_mesure: measure.type_mesure || "Préventive",
      avancement: measure.avancement || 0,
      statut: measure.statut || "À faire",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.mesure.trim()) {
      toast({ title: "Erreur", description: "Le nom de l'action est obligatoire", variant: "destructive" });
      return;
    }

    if (!selectedRiskId) {
      toast({ title: "Erreur", description: "Veuillez sélectionner un risque", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const dataToSave = {
        risque_id: selectedRiskId,
        mesure: form.mesure.trim(),
        description: form.description || null,
        type_mesure: form.type_mesure,
        responsable: form.responsable || null,
        echeance: form.echeance || null,
        cout_estime: Number(form.cout_estime) || 0,
        charge_jh: Number(form.charge_jh) || 0,
        avancement: Number(form.avancement) || 0,
        statut: form.statut || "À faire",
      };

      if (editingMeasure) {
        const { error } = await supabase
          .from("plans_traitement")
          .update(dataToSave)
          .eq("id", editingMeasure.id);

        if (error) throw error;
        toast({ title: "Succès", description: "Action mise à jour" });
      } else {
        const { error } = await supabase
          .from("plans_traitement")
          .insert(dataToSave);

        if (error) throw error;
        toast({ title: "Succès", description: "Action ajoutée" });
      }

      setDialogOpen(false);
      await loadMeasures();

    } catch (error: any) {
      console.error("Erreur sauvegarde action:", error);
      toast({ 
        title: "Erreur", 
        description: error.message || "Impossible de sauvegarder l'action", 
        variant: "destructive" 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette action ?")) return;

    try {
      const { error } = await supabase
        .from("plans_traitement")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      toast({ title: "Succès", description: "Action supprimée" });
      await loadMeasures();

    } catch (error: any) {
      console.error("Erreur suppression action:", error);
      toast({ 
        title: "Erreur", 
        description: error.message || "Impossible de supprimer l'action", 
        variant: "destructive" 
      });
    }
  };

  const getNiveauLabel = (risque: Risque) => {
    return risque.niveau || "Faible";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 bg-[#F8F6F2]">
        <Loader2 className="h-8 w-8 animate-spin text-[#2A5141]" />
        <span className="ml-2 text-[#172030]/60 font-sans">Chargement des actions...</span>
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto p-6 space-y-6 bg-[#F8F6F2] min-h-screen font-sans">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[#172030]">Plans de traitement</h1>
          <p className="text-sm text-[#172030]/60 font-sans">Gérez les actions de traitement pour chaque risque</p>
        </div>
      </div>

      {/* KPI PREMIUM UNIFIÉS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm bg-white rounded-xl">
          <CardContent className="p-5 flex justify-between items-start">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[#172030]/50 font-sans">Actions totales</p>
              <p className="font-serif text-3xl font-bold text-[#172030] mt-1">{stats.total}</p>
              <p className="text-[10px] text-[#172030]/40 mt-0.5 font-sans">Planifiées</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-[#172030]/5 flex items-center justify-center">
              <Target className="h-5 w-5 text-[#172030]/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-white rounded-xl">
          <CardContent className="p-5 flex justify-between items-start">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[#1F4E39]/70 font-sans">Avancement moyen</p>
              <div className="flex items-end gap-2 mt-1">
                <p className="font-serif text-3xl font-bold text-[#1F4E39]">{stats.avancementMoyen}%</p>
              </div>
              <p className="text-[10px] text-[#1F4E39]/60 mt-0.5 font-sans">En progression</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-[#E5F0EB] flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-[#1F4E39]" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-white rounded-xl">
          <CardContent className="p-5 flex justify-between items-start">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[#A38730]/70 font-sans">Coût total estimé</p>
              <p className="font-serif text-3xl font-bold text-[#A38730] mt-1">
                {stats.coutTotal.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 })}
              </p>
              <p className="text-[10px] text-[#A38730]/50 mt-0.5 font-sans">Budget alloué</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-[#FDF3D6] flex items-center justify-center">
              <Euro className="h-5 w-5 text-[#A38730]" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-white rounded-xl">
          <CardContent className="p-5 flex justify-between items-start">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[#172030]/50 font-sans">Actions terminées</p>
              <p className="font-serif text-3xl font-bold text-[#172030] mt-1">{stats.actionsTerminees}</p>
              <p className="text-[10px] text-[#172030]/40 mt-0.5 font-sans">Sur {stats.total} totales</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-[#F8F6F2] border border-[#172030]/10 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-[#2A5141]" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sélection du risque + Liste */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Liste des risques */}
        <div className="md:col-span-1">
          <Card className="border-0 shadow-sm bg-white rounded-xl">
            <CardHeader className="p-5 pb-2 border-b border-[#F8F6F2]">
              <CardTitle className="font-serif text-[#172030] text-base">Risques</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
              {risques.length === 0 ? (
                <p className="text-sm text-[#172030]/40 text-center py-4 font-sans">Aucun risque</p>
              ) : (
                risques.map((r) => {
                  const niveau = getNiveauLabel(r);
                  const style = NIVEAU_STYLE[niveau as keyof typeof NIVEAU_STYLE];
                  const count = measures.filter(m => m.risque_id === r.id).length;
                  
                  return (
                    <div
                      key={r.id}
                      onClick={() => setSelectedRiskId(r.id)}
                      className={cn(
                        "p-4 rounded-xl border cursor-pointer transition-all duration-200",
                        selectedRiskId === r.id
                          ? "border-[#2A5141] bg-[#F8F6F2] shadow-sm"
                          : "border-[#E5E2DD] hover:border-[#2A5141]/30 hover:bg-[#F8F6F2]/50 bg-white"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-[#172030] font-sans truncate">{r.title}</span>
                        <Badge className={cn("text-[9px] font-medium border-0 rounded-full px-2 py-0.5", style?.badge)}>
                          {niveau}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-[#172030]/40 font-sans">{r.category || "—"}</span>
                        {count > 0 && (
                          <Badge variant="outline" className="text-[9px] border-[#E5E2DD] text-[#172030]/50 font-sans rounded-full px-2 py-0.5 bg-white">
                            {count} action{count > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Détails du risque + Actions */}
        <div className="md:col-span-2">
          {selectedRisk ? (
            <Card className="border-0 shadow-sm bg-white rounded-xl h-full">
              <CardHeader className="p-5 pb-3 border-b border-[#F8F6F2]">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="font-serif text-[#172030] text-lg">
                      Actions
                    </CardTitle>
                    <p className="text-xs text-[#172030]/50 font-sans mt-0.5">
                      {selectedRisk.title} — {selectedRisk.description || "Pas de description"}
                    </p>
                  </div>
                  <Button 
                    size="sm" 
                    className="bg-[#2A5141] hover:bg-[#1F3E32] text-white shadow-sm font-sans"
                    onClick={openCreate}
                  >
                    <Plus className="h-4 w-4 mr-1.5" /> Nouvelle action
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-5 space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                {riskMeasures.length === 0 ? (
                  <div className="text-center py-12 text-[#172030]/40 border-2 border-dashed border-[#E5E2DD] rounded-xl bg-[#F8F6F2]/50">
                    <Shield className="h-10 w-10 mx-auto text-[#172030]/20 mb-2" />
                    <p className="text-sm font-sans">Aucune action pour ce risque</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-3 border-[#2A5141] text-[#2A5141] hover:bg-[#F8F6F2]"
                      onClick={openCreate}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Créer une action
                    </Button>
                  </div>
                ) : (
                  riskMeasures.map((m) => {
                    // Style d'avancement premium
                    const progressStyle = m.avancement >= 100 ? COLORS.progress.done : m.avancement >= 50 ? COLORS.progress.half : COLORS.progress.low;
                    
                    return (
                      <div key={m.id} className="border border-[#E5E2DD] rounded-xl p-4 hover:bg-[#F8F6F2] transition-colors bg-white">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 pr-4">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-medium text-sm text-[#172030] font-sans">{m.mesure}</span>
                              <Badge variant="outline" className="text-[9px] border-[#E5E2DD] text-[#172030]/50 font-sans">
                                {m.type_mesure}
                              </Badge>
                              <Badge className="text-[9px] font-medium border-0 rounded-full px-2 py-0.5" style={{ backgroundColor: progressStyle.bg, color: progressStyle.text }}>
                                {m.avancement}%
                              </Badge>
                              <Badge variant="outline" className="text-[9px] border-[#E5E2DD] text-[#172030]/50 font-sans">
                                {m.statut || "À faire"}
                              </Badge>
                            </div>
                            {m.description && (
                              <p className="text-xs text-[#172030]/60 font-sans mt-1">{m.description}</p>
                            )}
                            <div className="flex flex-wrap gap-4 mt-2 text-xs text-[#172030]/50 font-sans">
                              <span className="flex items-center gap-1">👤 {m.responsable || "—"}</span>
                              <span className="flex items-center gap-1">📅 {m.echeance ? new Date(m.echeance).toLocaleDateString('fr-FR') : "—"}</span>
                              <span className="flex items-center gap-1">💰 {m.cout_estime || 0} €</span>
                              <span className="flex items-center gap-1">⏱️ {m.charge_jh || 0} j/h</span>
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-[#172030]/40 hover:text-[#172030] hover:bg-[#F8F6F2]"
                              onClick={() => openEdit(m)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-[#A52A2A]/50 hover:text-[#A52A2A] hover:bg-[#FDE8E8]"
                              onClick={() => handleDelete(m.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-sm bg-white rounded-xl h-full flex items-center justify-center">
              <CardContent className="py-16 text-center text-[#172030]/40">
                <div className="h-16 w-16 rounded-2xl bg-[#F8F6F2] flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="h-8 w-8 text-[#172030]/20" />
                </div>
                <p className="text-base font-serif text-[#172030]/40">Sélectionnez un risque</p>
                <p className="text-sm font-sans mt-1">Choisissez un risque dans la colonne de gauche pour gérer ses actions.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dialog Ajout/Modification d'action (Premium) */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md bg-white border-[#E5E2DD] shadow-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-[#172030] text-lg">
              {editingMeasure ? "Modifier l'action" : "Nouvelle action"}
            </DialogTitle>
            <DialogDescription className="text-[#172030]/60 font-sans text-sm">
              {editingMeasure ? "Modifiez les détails de l'action" : "Ajoutez une action au plan de traitement"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-medium text-[#172030] font-sans">Action *</Label>
              <Input
                value={form.mesure}
                onChange={(e) => setForm({ ...form, mesure: e.target.value })}
                placeholder="Nom de l'action"
                className="mt-1.5 border-[#E5E2DD] focus-visible:ring-[#2A5141]"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-[#172030] font-sans">Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                placeholder="Décrivez l'action..."
                className="mt-1.5 border-[#E5E2DD] focus-visible:ring-[#2A5141]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-[#172030] font-sans">Type d'action</Label>
                <Select
                  value={form.type_mesure}
                  onValueChange={(v) => setForm({ ...form, type_mesure: v })}
                >
                  <SelectTrigger className="mt-1.5 border-[#E5E2DD] focus:ring-[#2A5141]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Préventive">Préventive</SelectItem>
                    <SelectItem value="Corrective">Corrective</SelectItem>
                    <SelectItem value="Détective">Détective</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium text-[#172030] font-sans">Statut</Label>
                <Select
                  value={form.statut}
                  onValueChange={(v) => setForm({ ...form, statut: v })}
                >
                  <SelectTrigger className="mt-1.5 border-[#E5E2DD] focus:ring-[#2A5141]">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="À faire">À faire</SelectItem>
                    <SelectItem value="En cours">En cours</SelectItem>
                    <SelectItem value="Terminé">Terminé</SelectItem>
                    <SelectItem value="Acceptée">Acceptée</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-[#172030] font-sans">Avancement (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={form.avancement}
                  onChange={(e) => setForm({ ...form, avancement: Number(e.target.value) })}
                  placeholder="0"
                  className="mt-1.5 border-[#E5E2DD] focus-visible:ring-[#2A5141]"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-[#172030] font-sans">Responsable</Label>
                <Input
                  value={form.responsable}
                  onChange={(e) => setForm({ ...form, responsable: e.target.value })}
                  placeholder="Nom"
                  className="mt-1.5 border-[#E5E2DD] focus-visible:ring-[#2A5141]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-[#172030] font-sans">Échéance</Label>
                <Input
                  type="date"
                  value={form.echeance}
                  onChange={(e) => setForm({ ...form, echeance: e.target.value })}
                  className="mt-1.5 border-[#E5E2DD] focus-visible:ring-[#2A5141]"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-[#172030] font-sans">Coût estimé (€)</Label>
                <Input
                  type="number"
                  value={form.cout_estime}
                  onChange={(e) => setForm({ ...form, cout_estime: e.target.value })}
                  placeholder="0"
                  className="mt-1.5 border-[#E5E2DD] focus-visible:ring-[#2A5141]"
                />
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-[#172030] font-sans">Charge (j/h)</Label>
              <Input
                type="number"
                value={form.charge_jh}
                onChange={(e) => setForm({ ...form, charge_jh: e.target.value })}
                placeholder="0"
                className="mt-1.5 border-[#E5E2DD] focus-visible:ring-[#2A5141]"
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" className="border-[#E5E2DD] text-[#172030]/60 hover:bg-[#F8F6F2]" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button 
              onClick={handleSave} 
              disabled={saving}
              className="bg-[#2A5141] hover:bg-[#1F3E32] text-white shadow-sm"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {saving ? "Enregistrement..." : (editingMeasure ? "Mettre à jour" : "Ajouter")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==========================================================
          STYLE SCROLLBAR PERSONNALISÉ
          ========================================================== */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #E5E2DD;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #C0D8CF;
        }
      `}</style>
    </div>
  );
};