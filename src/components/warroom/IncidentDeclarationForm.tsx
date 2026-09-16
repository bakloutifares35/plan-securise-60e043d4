// src/components/warroom/IncidentDeclarationForm.tsx — Déclaration d'incident (mobile-first)
import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  INCIDENT_TYPES,
  ProcessLite,
  RESILLIA,
  SEVERITES,
  SEVERITE_COLORS,
  SEVERITE_LABELS,
  Severite,
} from "./types";

export const IncidentDeclarationForm = ({
  open,
  onOpenChange,
  processus,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  processus: ProcessLite[];
  onSubmit: (payload: any, processusIds: string[]) => Promise<string | null>;
}) => {
  const [type, setType] = useState<string>(INCIDENT_TYPES[0]);
  const [titre, setTitre] = useState("");
  const [declarant, setDeclarant] = useState("");
  const [severite, setSeverite] = useState<Severite>("P2");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? processus.filter((p) => p.name?.toLowerCase().includes(q)) : processus;
    return list.slice(0, 40);
  }, [processus, search]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const reset = () => {
    setType(INCIDENT_TYPES[0]);
    setTitre("");
    setDeclarant("");
    setSeverite("P2");
    setDescription("");
    setSearch("");
    setSelected([]);
  };

  const submit = async () => {
    setSaving(true);
    const id = await onSubmit(
      { type, titre: titre.trim(), declarant: declarant.trim() || null, niveau_severite: severite, description },
      selected
    );
    setSaving(false);
    if (id) {
      reset();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg max-h-[92vh] overflow-y-auto"
        style={{ backgroundColor: RESILLIA.cream }}
      >
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "'Playfair Display', serif", color: RESILLIA.navy }}>
            Déclarer un incident
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label style={{ color: RESILLIA.navy }}>Type d'incident</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-12 bg-white" style={{ borderColor: RESILLIA.border }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INCIDENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label style={{ color: RESILLIA.navy }}>Titre de l'incident</Label>
            <Input
              className="h-12 bg-white"
              style={{ borderColor: RESILLIA.border }}
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Ex. Indisponibilité du système de paiement"
            />
          </div>

          {/* Sévérité : gros boutons visuels, l'urgence prime sur la sobriété (exception charte) */}
          <div className="space-y-1.5">
            <Label style={{ color: RESILLIA.navy }}>Niveau de sévérité</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {SEVERITES.map((s) => {
                const active = severite === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSeverite(s)}
                    className="rounded-lg py-3 text-sm font-semibold transition-all"
                    style={{
                      backgroundColor: active ? SEVERITE_COLORS[s] : "#FFFFFF",
                      color: active ? "#FFFFFF" : RESILLIA.navy,
                      border: `2px solid ${active ? SEVERITE_COLORS[s] : RESILLIA.border}`,
                    }}
                  >
                    {s}
                    <span className="block text-[10px] font-normal opacity-80">
                      {SEVERITE_LABELS[s].split("— ")[1]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label style={{ color: RESILLIA.navy }}>Processus impactés</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#172030]/40" />
              <Input
                className="h-11 pl-9 bg-white"
                style={{ borderColor: RESILLIA.border }}
                placeholder="Rechercher un processus…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div
              className="mt-2 max-h-44 overflow-y-auto rounded-lg bg-white divide-y"
              style={{ border: `1px solid ${RESILLIA.border}` }}
            >
              {filtered.length === 0 && (
                <p className="p-3 text-xs text-[#172030]/50">Aucun processus trouvé.</p>
              )}
              {filtered.map((p) => {
                const active = selected.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p.id)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-[#F1EFE8]"
                    style={{ color: RESILLIA.navy }}
                  >
                    <span className="truncate">
                      {p.name}
                      {p.direction ? <span className="text-[#172030]/40"> · {p.direction}</span> : null}
                    </span>
                    {active && <Check className="h-4 w-4 shrink-0" style={{ color: RESILLIA.forest }} />}
                  </button>
                );
              })}
            </div>
            {selected.length > 0 && (
              <p className="text-xs" style={{ color: RESILLIA.forest }}>
                {selected.length} processus sélectionné{selected.length > 1 ? "s" : ""}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label style={{ color: RESILLIA.navy }}>Déclarant</Label>
            <Input
              className="h-12 bg-white"
              style={{ borderColor: RESILLIA.border }}
              value={declarant}
              onChange={(e) => setDeclarant(e.target.value)}
              placeholder="Votre nom"
            />
          </div>

          <div className="space-y-1.5">
            <Label style={{ color: RESILLIA.navy }}>Description courte</Label>
            <Textarea
              rows={3}
              className="bg-white"
              style={{ borderColor: RESILLIA.border }}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ce qui s'est passé, en quelques lignes…"
            />
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} style={{ borderColor: RESILLIA.border }}>
            Annuler
          </Button>
          <Button
            onClick={submit}
            disabled={saving || !titre.trim()}
            className="h-12 sm:h-10"
            style={{ backgroundColor: RESILLIA.urgence, color: "#FFFFFF" }}
          >
            {saving ? "Déclaration…" : "Déclarer l'incident"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default IncidentDeclarationForm;
