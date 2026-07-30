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
import { Plus, Pencil, Trash2, AlertTriangle, CheckCircle2, Clock, Euro } from "lucide-react";
import { cn } from "@/lib/utils";
import { type RiskData } from "../useRiskData";
import { type Risque, NIVEAU_STYLE } from "../riskModel";

type Props = {
  data: RiskData;
};

export const PlansTab = ({ data }: Props) => {
  const { risques } = data;

  const [selectedRiskId, setSelectedRiskId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMeasure, setEditingMeasure] = useState<any>(null);
  const [form, setForm] = useState({
    mesure: "",
    description: "",
    responsable: "",
    echeance: "",
    cout_estime: "",
    charge_jh: "",
    type_mesure: "Préventive",
  });

  const [measures, setMeasures] = useState<any[]>([]);

  const selectedRisk = risques.find(r => r.id === selectedRiskId);
  const riskMeasures = measures.filter(m => m.risque_id === selectedRiskId);

  const stats = {
    enRetard: 0,
    avancementMoyen: 0,
    coutTotal: 0,
  };

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
    });
    setDialogOpen(true);
  };

  const openEdit = (measure: any) => {
    setEditingMeasure(measure);
    setForm({
      mesure: measure.mesure,
      description: measure.description || "",
      responsable: measure.responsable || "",
      echeance: measure.echeance || "",
      cout_estime: measure.cout_estime || "",
      charge_jh: measure.charge_jh || "",
      type_mesure: measure.type_mesure || "Préventive",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.mesure.trim()) {
      toast({ title: "Erreur", description: "Le nom de la mesure est obligatoire", variant: "destructive" });
      return;
    }
    
    if (editingMeasure) {
      setMeasures(prev => prev.map(m => 
        m.id === editingMeasure.id 
          ? { ...m, ...form, cout_estime: Number(form.cout_estime) || 0, charge_jh: Number(form.charge_jh) || 0 }
          : m
      ));
      toast({ title: "Succès", description: "Mesure mise à jour" });
    } else {
      const newMeasure = {
        id: `m${Date.now()}`,
        risque_id: selectedRiskId,
        ...form,
        cout_estime: Number(form.cout_estime) || 0,
        charge_jh: Number(form.charge_jh) || 0,
        avancement: 0,
      };
      setMeasures(prev => [...prev, newMeasure]);
      toast({ title: "Succès", description: "Mesure ajoutée au plan de traitement" });
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm("Supprimer cette mesure ?")) {
      setMeasures(prev => prev.filter(m => m.id !== id));
      toast({ title: "Succès", description: "Mesure supprimée" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[#172030]">Plans de traitement</h2>
          <p className="text-sm text-[#172030]/60">Gérez les mesures de traitement pour chaque risque</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-[#172030]/10">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-[#172030]/50">En retard</p>
              <p className="text-2xl font-bold text-[#172030]">{stats.enRetard}</p>
            </div>
            <AlertTriangle className="h-5 w-5 text-red-500" />
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
              <p className="text-2xl font-bold text-[#172030]">{measures.length}</p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-[#2A5141]" />
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
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
                  const niveau = r.niveau || "Faible";
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
                    className="bg-[#2A5141] hover:bg-[#1f3d31] text-white"
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
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-[#172030]">{m.mesure}</span>
                            <Badge variant="outline" className="text-[9px] border-[#172030]/20">
                              {m.type_mesure}
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
                        <div className="flex gap-1">
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button 
              onClick={handleSave} 
              className="bg-[#2A5141] hover:bg-[#1f3d31] text-white"
            >
              {editingMeasure ? "Mettre à jour" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};