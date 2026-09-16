// src/components/warroom/RetexForm.tsx — Formulaire RETEX (retour d'expérience)
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RESILLIA, Retex } from "./types";

const FIELDS: { key: keyof Retex; label: string; placeholder: string }[] = [
  { key: "resume", label: "Résumé de la crise", placeholder: "Déroulé synthétique de l'incident…" },
  { key: "causes_racines", label: "Causes racines", placeholder: "Facteurs déclencheurs et causes profondes…" },
  { key: "points_positifs", label: "Points positifs", placeholder: "Ce qui a bien fonctionné…" },
  { key: "points_amelioration", label: "Points d'amélioration", placeholder: "Ce qui doit être amélioré…" },
  { key: "actions_correctives", label: "Actions correctives", placeholder: "Actions à engager après la crise…" },
];

export const RetexForm = ({
  open,
  onOpenChange,
  incidentId,
  retex,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  incidentId: string;
  retex: Retex | null;
  onSave: (payload: Retex) => Promise<boolean>;
}) => {
  const empty: Retex = {
    incident_id: incidentId,
    resume: "",
    causes_racines: "",
    points_positifs: "",
    points_amelioration: "",
    actions_correctives: "",
    valide_par: "",
  };
  const [form, setForm] = useState<Retex>(retex ?? empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(retex ? { ...empty, ...retex } : empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retex, incidentId, open]);

  const submit = async () => {
    setSaving(true);
    const ok = await onSave(form);
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: RESILLIA.cream }}>
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "'Playfair Display', serif", color: RESILLIA.navy }}>
            RETEX — Retour d'expérience
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {FIELDS.map((f) => (
            <div key={String(f.key)} className="space-y-1.5">
              <Label style={{ color: RESILLIA.navy }}>{f.label}</Label>
              <Textarea
                rows={3}
                value={(form[f.key] as string) || ""}
                placeholder={f.placeholder}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                className="bg-white"
                style={{ borderColor: RESILLIA.border }}
              />
            </div>
          ))}
          <div className="space-y-1.5">
            <Label style={{ color: RESILLIA.navy }}>Validé par (optionnel)</Label>
            <Input
              value={form.valide_par || ""}
              onChange={(e) => setForm({ ...form, valide_par: e.target.value })}
              className="bg-white"
              style={{ borderColor: RESILLIA.border }}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} style={{ borderColor: RESILLIA.border }}>
            Annuler
          </Button>
          <Button
            onClick={submit}
            disabled={saving || !form.resume.trim()}
            style={{ backgroundColor: RESILLIA.forest, color: RESILLIA.cream }}
          >
            {saving ? "Enregistrement…" : "Enregistrer le RETEX"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RetexForm;
