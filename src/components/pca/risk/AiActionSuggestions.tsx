// Modale de suggestions d'actions de traitement générées par l'IA (GPT-oss)
import { useCallback, useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/db";
import { Loader2, Sparkles, Plus, Pencil, RefreshCw, Check, X, ListPlus } from "lucide-react";
import type { Risque } from "./riskModel";

export type SuggestedAction = {
  mesure: string;
  description: string;
  type_mesure: string;
  responsable: string;
  echeance: string;
  cout_estime: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  risque: Risque | null;
  existingActions?: string[];
  onAdded: () => void | Promise<void>;
};

const TYPES = ["Préventive", "Corrective", "Détective"] as const;

const emptyAction: SuggestedAction = {
  mesure: "",
  description: "",
  type_mesure: "Préventive",
  responsable: "",
  echeance: "",
  cout_estime: 0,
};

export const AiActionSuggestions = ({ open, onOpenChange, risque, existingActions = [], onAdded }: Props) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actions, setActions] = useState<SuggestedAction[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<SuggestedAction>(emptyAction);
  const [addedIndexes, setAddedIndexes] = useState<number[]>([]);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [savingAll, setSavingAll] = useState(false);

  const generate = useCallback(async () => {
    if (!risque) return;
    setLoading(true);
    setError(null);
    setEditingIndex(null);
    setAddedIndexes([]);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("risk-actions-suggester", {
        body: {
          title: risque.title,
          description: risque.description,
          category: risque.category,
          probabilite: risque.probabilite,
          impact: risque.impact,
          score_residuel: risque.score_residuel,
          niveau: risque.niveau,
          cause: risque.cause,
          consequence: risque.consequence,
          mesures_existantes: risque.mesures_existantes,
          existing_actions: existingActions,
        },
      });

      if (fnError) throw new Error(fnError.message);
      const list = (data as { actions?: SuggestedAction[] } | null)?.actions;
      if (!Array.isArray(list) || list.length === 0) {
        throw new Error("L'IA n'a retourné aucune action exploitable.");
      }
      setActions(list);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erreur inconnue";
      setError(message);
      toast({ title: "Erreur IA", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [risque, existingActions]);

  useEffect(() => {
    if (open && risque) {
      setActions([]);
      void generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, risque?.id]);

  const insertActions = async (list: SuggestedAction[]): Promise<boolean> => {
    if (!risque) return false;
    const rows = list.map((a) => ({
      risque_id: risque.id,
      mesure: a.mesure,
      description: a.description || null,
      type_mesure: a.type_mesure,
      responsable: a.responsable || null,
      echeance: a.echeance || null,
      cout_estime: Number(a.cout_estime) || 0,
      avancement: 0,
      statut: "À faire",
    }));

    const { error: insertError } = await supabase.from("plans_traitement").insert(rows);
    if (insertError) {
      toast({ title: "Erreur", description: insertError.message, variant: "destructive" });
      return false;
    }
    await onAdded();
    return true;
  };

  const handleAddOne = async (index: number) => {
    setSavingIndex(index);
    const ok = await insertActions([actions[index]]);
    if (ok) {
      setAddedIndexes((prev) => [...prev, index]);
      toast({ title: "Action ajoutée", description: actions[index].mesure });
    }
    setSavingIndex(null);
  };

  const handleAddAll = async () => {
    const remaining = actions.filter((_, i) => !addedIndexes.includes(i));
    if (remaining.length === 0) return;
    setSavingAll(true);
    const ok = await insertActions(remaining);
    if (ok) {
      setAddedIndexes(actions.map((_, i) => i));
      toast({ title: "Actions ajoutées", description: `${remaining.length} action(s) ajoutée(s) au plan de traitement.` });
    }
    setSavingAll(false);
  };

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setDraft({ ...actions[index] });
  };

  const saveEdit = () => {
    if (editingIndex === null) return;
    if (!draft.mesure.trim()) {
      toast({ title: "Erreur", description: "Le titre de l'action est obligatoire", variant: "destructive" });
      return;
    }
    setActions((prev) => prev.map((a, i) => (i === editingIndex ? { ...draft } : a)));
    setEditingIndex(null);
  };

  const allAdded = actions.length > 0 && addedIndexes.length === actions.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-[#F8F6F2] border-[#E5E2DD] shadow-xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-[#172030] text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#2A5141]" />
            Actions suggérées par l'IA
          </DialogTitle>
          <DialogDescription className="text-[#172030]/60 font-sans text-sm">
            {risque
              ? `${risque.title} — P${risque.probabilite ?? "?"} / I${risque.impact ?? "?"} · ${risque.category || "Sans catégorie"}`
              : "Sélectionnez un risque"}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#2A5141]" />
            <p className="text-sm text-[#172030]/60 font-sans">Analyse du risque en cours...</p>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-[#E5C0C0] bg-[#FDE8E8] p-4 text-sm text-[#A52A2A] font-sans">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-3 py-1">
            {actions.map((a, index) => {
              const isEditing = editingIndex === index;
              const isAdded = addedIndexes.includes(index);

              return (
                <div
                  key={`${a.mesure}-${index}`}
                  className="rounded-xl border border-[#E5E2DD] bg-white p-4 shadow-sm"
                >
                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium text-[#172030] font-sans">Action *</Label>
                        <Input
                          value={draft.mesure}
                          onChange={(e) => setDraft({ ...draft, mesure: e.target.value })}
                          className="mt-1.5 border-[#E5E2DD] focus-visible:ring-[#2A5141]"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-[#172030] font-sans">Description</Label>
                        <Textarea
                          rows={2}
                          value={draft.description}
                          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                          className="mt-1.5 border-[#E5E2DD] focus-visible:ring-[#2A5141]"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-sm font-medium text-[#172030] font-sans">Type</Label>
                          <Select
                            value={draft.type_mesure}
                            onValueChange={(v) => setDraft({ ...draft, type_mesure: v })}
                          >
                            <SelectTrigger className="mt-1.5 border-[#E5E2DD] focus:ring-[#2A5141]">
                              <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent>
                              {TYPES.map((t) => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-[#172030] font-sans">Responsable</Label>
                          <Input
                            value={draft.responsable}
                            onChange={(e) => setDraft({ ...draft, responsable: e.target.value })}
                            className="mt-1.5 border-[#E5E2DD] focus-visible:ring-[#2A5141]"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-sm font-medium text-[#172030] font-sans">Échéance</Label>
                          <Input
                            type="date"
                            value={draft.echeance}
                            onChange={(e) => setDraft({ ...draft, echeance: e.target.value })}
                            className="mt-1.5 border-[#E5E2DD] focus-visible:ring-[#2A5141]"
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-[#172030] font-sans">Coût estimé (€)</Label>
                          <Input
                            type="number"
                            min={0}
                            value={draft.cout_estime}
                            onChange={(e) => setDraft({ ...draft, cout_estime: Number(e.target.value) })}
                            className="mt-1.5 border-[#E5E2DD] focus-visible:ring-[#2A5141]"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-[#E5E2DD] text-[#172030]/60 hover:bg-[#F8F6F2]"
                          onClick={() => setEditingIndex(null)}
                        >
                          <X className="h-3.5 w-3.5 mr-1" /> Annuler
                        </Button>
                        <Button
                          size="sm"
                          className="bg-[#2A5141] hover:bg-[#1F3E32] text-white"
                          onClick={saveEdit}
                        >
                          <Check className="h-3.5 w-3.5 mr-1" /> Valider
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-[#172030] font-sans">{a.mesure}</span>
                          <Badge variant="outline" className="text-[9px] border-[#E5E2DD] text-[#172030]/50 font-sans">
                            {a.type_mesure}
                          </Badge>
                          {isAdded && (
                            <Badge className="text-[9px] border-0 rounded-full px-2 py-0.5 bg-[#E5F0EB] text-[#1F4E39]">
                              Ajoutée
                            </Badge>
                          )}
                        </div>
                        {a.description && (
                          <p className="text-xs text-[#172030]/60 font-sans mt-1">{a.description}</p>
                        )}
                        <div className="flex flex-wrap gap-4 mt-2 text-xs text-[#172030]/50 font-sans">
                          <span>👤 {a.responsable || "—"}</span>
                          <span>📅 {a.echeance ? new Date(a.echeance).toLocaleDateString("fr-FR") : "—"}</span>
                          <span>💰 {Number(a.cout_estime || 0).toLocaleString("fr-FR")} €</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <Button
                          size="sm"
                          disabled={isAdded || savingIndex === index || savingAll}
                          className="bg-[#2A5141] hover:bg-[#1F3E32] text-white"
                          onClick={() => handleAddOne(index)}
                        >
                          {savingIndex === index ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                          ) : (
                            <Plus className="h-3.5 w-3.5 mr-1" />
                          )}
                          Ajouter
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isAdded}
                          className="border-[#2A5141]/30 text-[#2A5141] hover:bg-[#F8F6F2]"
                          onClick={() => startEdit(index)}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1" /> Modifier
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter className="mt-2 gap-2 sm:gap-2">
          <Button
            variant="outline"
            className="border-[#E5E2DD] text-[#172030]/60 hover:bg-white"
            onClick={() => onOpenChange(false)}
          >
            Fermer
          </Button>
          <Button
            variant="outline"
            disabled={loading}
            className="border-[#2A5141]/30 text-[#2A5141] hover:bg-white"
            onClick={() => void generate()}
          >
            <RefreshCw className="h-4 w-4 mr-1.5" /> Régénérer
          </Button>
          <Button
            disabled={loading || savingAll || actions.length === 0 || allAdded}
            className="bg-[#2A5141] hover:bg-[#1F3E32] text-white shadow-sm"
            onClick={() => void handleAddAll()}
          >
            {savingAll ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <ListPlus className="h-4 w-4 mr-1.5" />}
            Ajouter toutes les actions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AiActionSuggestions;
