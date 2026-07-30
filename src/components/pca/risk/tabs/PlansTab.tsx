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
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, AlertTriangle, CheckCircle2, Clock, Euro, Loader2 } from "lucide-react";
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

  // 🔥 CALCUL DES KPI DYNAMIQUES
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

    const aujourdHui = new Date();
    const enRetard = measures.filter(m => {
      if (!m.echeance) return false;
      const echeance = new Date(m.echeance);
      return echeance < aujourdHui && m.avancement < 100;
    }).length;

    return {
      total,
      avancementMoyen,
      coutTotal,
      enRetard,
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
      toast({ title: "Erreur", description: "Le nom de la mesure est obligatoire", variant: "destructive" });
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
        toast({ title: "Succès", description: "Mesure mise à jour" });
      } else {
        const { error } = await supabase
          .from("plans_traitement")
          .insert(dataToSave);

        if (error) throw error;
        toast({ title: "Succès", description: "Mesure ajoutée au plan de traitement" });
      }

      setDialogOpen(false);
      await loadMeasures();

    } catch (error: any) {
      console.error("Erreur sauvegarde mesure:", error);
      toast({ 
        title: "Erreur", 
        description: error.message || "Impossible de sauvegarder la mesure", 
        variant: "destructive" 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette mesure ?")) return;

    try {
      const { error } = await supabase
        .from("plans_traitement")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      toast({ title: "Succès", description: "Mesure supprimée" });
      await loadMeasures();

    } catch (error: any) {
      console.error("Erreur suppression mesure:", error);
      toast({ 
        title: "Erreur", 
        description: error.message || "Impossible de supprimer la mesure", 
        variant: "destructive" 
      });
    }
  };

  const getNiveauLabel = (risque: Risque) => {
    return risque.niveau || "Faible";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#2A5141]" />
        <span className="ml-2 text-[#172030]/60">Chargement des mesures...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[#172030]">Plans de traitement</h2>
          <p className="text-sm text-[#172030]/60">Gérez les mesures de traitement pour chaque risque</p>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-[#172030]/10">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-[#172030]/50">En retard</p>
              <p className="text-2xl font-bold text-[#172030]">{stats.enRetard}</p>
            </div>
            <AlertTriangle className={`h-5 w-5 ${stats.enRetard > 0 ? 'text-red-500' : 'text-[#172030]/30'}`} />
          </CardContent>
        </Card>
        <Card className="border-[#172030]/10">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-[#172030]/50">Avancement moyen</p>
              <p className="text-2xl font-bold text-[#172030]">{stats.avancementMoyen}%</p>
            </div>
            <Clock className="h-5 w-5 text-[#2A5141]" />
          </CardContent>
        </Card>
        <Card className="border-[#172030]/10">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-[#172030]/50">Coût total estimé</p>
              <p className="text-2xl font-bold text-[#172030]">{stats.coutTotal} €</p>
            </div>
            <Euro className="h-5 w-5 text-[#2A5141]" />
          </CardContent>
        </Card>
        <Card className="border-[#172030]/10">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-[#172030]/50">Mesures totales</p>
              <p className="text-2xl font-bold text-[#172030]">{stats.total}</p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-[#2A5141]" />
          </CardContent>
        </Card>
      </div>

      {/* Sélection du risque + Liste */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Liste des risques */}
        <div className="md:col-span-1">
          <Card className="border-[#172030]/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#172030]">Risques</CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
              {risques.length === 0 ? (
                <p className="text-sm text-[#172030]/40 text-center py-4">Aucun risque</p>
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
                        "p-3 rounded-lg border cursor-pointer transition-all",
                        selectedRiskId === r.id
                          ? "border-[#2A5141] bg-[#F8F6F2] ring-1 ring-[#2A5141]"
                          : "border-[#E8E4DC] hover:border-[#2A5141]/30 hover:bg-[#F8F6F2]/50"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-[#172030] truncate">{r.title}</span>
                        <Badge className={cn("text-[9px]", style?.badge)}>
                          {niveau}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-[#172030]/40">{r.category || "—"}</span>
                        {count > 0 && (
                          <Badge variant="outline" className="text-[9px] border-[#172030]/20">
                            {count} mesure{count > 1 ? 's' : ''}
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

        {/* Détails du risque + Mesures */}
        <div className="md:col-span-2">
          {selectedRisk ? (
            <Card className="border-[#172030]/10">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-medium text-[#172030]">
                      {selectedRisk.title}
                    </CardTitle>
                    <p className="text-xs text-[#172030]/50 mt-0.5">
                      {selectedRisk.description || "Pas de description"}
                    </p>
                  </div>
                  <Button 
                    size="sm" 
                    className="bg-[#2A5141] hover:bg-[#1f3d31] text-white shrink-0"
                    onClick={openCreate}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter une mesure
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {riskMeasures.length === 0 ? (
                  <div className="text-center py-8 text-[#172030]/40 border-2 border-dashed border-[#E8E4DC] rounded-lg">
                    <p className="text-sm">Aucune mesure pour ce risque</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2 border-[#2A5141] text-[#2A5141]"
                      onClick={openCreate}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter une mesure
                    </Button>
                  </div>
                ) : (
                  riskMeasures.map((m) => (
                    <div key={m.id} className="border rounded-lg p-3 hover:bg-[#F8F6F2] transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm text-[#172030]">{m.mesure}</span>
                            <Badge variant="outline" className="text-[9px] border-[#172030]/20">
                              {m.type_mesure}
                            </Badge>
                            <Badge className={cn(
                              "text-[9px]",
                              m.avancement >= 100 ? "bg-green-100 text-green-700" :
                              m.avancement >= 50 ? "bg-amber-100 text-amber-700" :
                              "bg-blue-100 text-blue-700"
                            )}>
                              {m.avancement}%
                            </Badge>
                            <Badge variant="outline" className="text-[9px] border-[#172030]/20">
                              {m.statut || "À faire"}
                            </Badge>
                          </div>
                          {m.description && (
                            <p className="text-xs text-[#172030]/60 mt-0.5">{m.description}</p>
                          )}
                          <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-[#172030]/50">
                            <span>👤 {m.responsable || "—"}</span>
                            <span>📅 {m.echeance ? new Date(m.echeance).toLocaleDateString('fr-FR') : "—"}</span>
                            <span>💰 {m.cout_estime || 0} €</span>
                            <span>⏱️ {m.charge_jh || 0} j/h</span>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:bg-[#F8F6F2]"
                            onClick={() => openEdit(m)}
                          >
                            <Pencil className="h-3.5 w-3.5 text-[#172030]/60" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:bg-red-50"
                            onClick={() => handleDelete(m.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-400 hover:text-red-600" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-[#172030]/10">
              <CardContent className="py-12 text-center text-[#172030]/40">
                <AlertTriangle className="h-12 w-12 mx-auto text-[#172030]/20" />
                <p className="mt-3">Sélectionnez un risque pour voir ses mesures</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dialog Ajout/Modification de mesure */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#172030]">
              {editingMeasure ? "Modifier la mesure" : "Ajouter une mesure"}
            </DialogTitle>
            <DialogDescription className="text-[#172030]/60">
              {editingMeasure ? "Modifiez les détails de la mesure" : "Ajoutez une mesure au plan de traitement"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <Label className="text-sm font-medium text-[#172030]">Mesure *</Label>
              <Input
                value={form.mesure}
                onChange={(e) => setForm({ ...form, mesure: e.target.value })}
                placeholder="Nom de la mesure"
                className="mt-1 border-[#172030]/20"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-[#172030]">Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                placeholder="Décrivez la mesure..."
                className="mt-1 border-[#172030]/20"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-[#172030]">Type de mesure</Label>
              <Select
                value={form.type_mesure}
                onValueChange={(v) => setForm({ ...form, type_mesure: v })}
              >
                <SelectTrigger className="mt-1 border-[#172030]/20">
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
              <Label className="text-sm font-medium text-[#172030]">Avancement (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={form.avancement}
                onChange={(e) => setForm({ ...form, avancement: Number(e.target.value) })}
                placeholder="0"
                className="mt-1 border-[#172030]/20"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-[#172030]">Statut</Label>
              <Select
                value={form.statut}
                onValueChange={(v) => setForm({ ...form, statut: v })}
              >
                <SelectTrigger className="mt-1 border-[#172030]/20">
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

            <div>
              <Label className="text-sm font-medium text-[#172030]">Responsable</Label>
              <Input
                value={form.responsable}
                onChange={(e) => setForm({ ...form, responsable: e.target.value })}
                placeholder="Nom du responsable"
                className="mt-1 border-[#172030]/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium text-[#172030]">Échéance</Label>
                <Input
                  type="date"
                  value={form.echeance}
                  onChange={(e) => setForm({ ...form, echeance: e.target.value })}
                  className="mt-1 border-[#172030]/20"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-[#172030]">Coût estimé (€)</Label>
                <Input
                  type="number"
                  value={form.cout_estime}
                  onChange={(e) => setForm({ ...form, cout_estime: e.target.value })}
                  placeholder="0"
                  className="mt-1 border-[#172030]/20"
                />
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-[#172030]">Charge (j/h)</Label>
              <Input
                type="number"
                value={form.charge_jh}
                onChange={(e) => setForm({ ...form, charge_jh: e.target.value })}
                placeholder="0"
                className="mt-1 border-[#172030]/20"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-[#172030]/10">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={saving}
              className="bg-[#2A5141] hover:bg-[#1f3d31] text-white"
            >
              {saving ? "Enregistrement..." : editingMeasure ? "Mettre à jour" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};