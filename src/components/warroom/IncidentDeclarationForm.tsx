// src/components/warroom/IncidentDeclarationForm.tsx
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, X, UserPlus, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  COLORS, SEV_PASTEL, CELL_ROLES, CELL_ROLE_STYLE,
  getInitials, getAvatarColor,
  type Severite, type CellRole,
} from "./warroomHelpers";

// ============================================================
// TYPES
// ============================================================
type ProcessLite = {
  id: string;
  name: string;
  direction?: string | null;
  criticality_level?: string | null;
  rto_hours?: number | null;
};

type CellMemberDraft = {
  tempId: string;
  nom: string;
  role: CellRole;
  telephone?: string;
  email?: string;
};

const INCIDENT_TYPES = [
  "Cyberattaque",
  "Panne informatique",
  "Sinistre bâtiment",
  "Indisponibilité RH",
  "Défaillance fournisseur",
  "Crise sanitaire",
  "Autre",
];

const CRITICALITY_STYLE: Record<string, { bg: string; text: string }> = {
  Critique: { bg: "#FFEBEE", text: "#C62828" },
  Sévère: { bg: "#FBE9E7", text: "#D84315" },
  Majeur: { bg: "#FFF3E0", text: "#E65100" },
  Modéré: { bg: "#FFF8E1", text: "#F57F17" },
  Mineur: { bg: "#E8F5E9", text: "#2E7D32" },
};

// ============================================================
// COMPOSANT
// ============================================================
export const IncidentDeclarationForm = ({
  open,
  onOpenChange,
  processus,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  processus: ProcessLite[];
  onSubmit: (payload: any, processusIds: string[], cellMembers: CellMemberDraft[]) => Promise<string | null>;
}) => {
  const [type, setType] = useState<string>(INCIDENT_TYPES[0]);
  const [titre, setTitre] = useState("");
  const [declarant, setDeclarant] = useState("");
  const [severite, setSeverite] = useState<Severite>("P2");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Cellule de crise
  const [cellMembers, setCellMembers] = useState<CellMemberDraft[]>([]);
  const [cellName, setCellName] = useState("");
  const [cellRole, setCellRole] = useState<CellRole>("Coordinateur");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? processus.filter((p) => p.name?.toLowerCase().includes(q)) : processus;
    return list.slice(0, 40);
  }, [processus, search]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const addCellMember = () => {
    if (!cellName.trim()) return;
    setCellMembers((prev) => [
      ...prev,
      {
        tempId: `temp-${Date.now()}-${Math.random()}`,
        nom: cellName.trim(),
        role: cellRole,
      },
    ]);
    setCellName("");
    setCellRole("Coordinateur");
  };

  const removeCellMember = (tempId: string) => {
    setCellMembers((prev) => prev.filter((m) => m.tempId !== tempId));
  };

  const reset = () => {
    setType(INCIDENT_TYPES[0]);
    setTitre("");
    setDeclarant("");
    setSeverite("P2");
    setDescription("");
    setSearch("");
    setSelected([]);
    setCellMembers([]);
    setCellName("");
    setCellRole("Coordinateur");
  };

  const submit = async () => {
    setSaving(true);
    const id = await onSubmit(
      {
        type,
        titre: titre.trim(),
        declarant: declarant.trim() || null,
        niveau_severite: severite,
        description,
      },
      selected,
      cellMembers
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
        className="!max-w-2xl w-[calc(100vw-2rem)] sm:w-full max-h-[92vh] !p-0 !gap-0 overflow-hidden flex flex-col"
        style={{ backgroundColor: COLORS.cream }}
      >
        {/* ===== HEADER ===== */}
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0 border-b" style={{ borderColor: COLORS.border }}>
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: COLORS.danger + "15" }}
            >
              <ShieldAlert className="h-5 w-5" style={{ color: COLORS.danger }} />
            </div>
            <div>
              <DialogTitle
                style={{ fontFamily: "'Playfair Display', serif", color: COLORS.navy }}
              >
                Déclarer un incident
              </DialogTitle>
              <p className="text-xs mt-0.5" style={{ color: COLORS.navy + "70" }}>
                Renseignez les informations essentielles — modifiables après création
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* ===== CONTENU SCROLLABLE ===== */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto overflow-x-hidden flex-1">
          {/* Type + Titre */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label style={{ color: COLORS.navy }}>Type d'incident</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-11 bg-white" style={{ borderColor: COLORS.border }}>
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
              <Label style={{ color: COLORS.navy }}>Déclarant</Label>
              <Input
                className="h-11 bg-white"
                style={{ borderColor: COLORS.border }}
                value={declarant}
                onChange={(e) => setDeclarant(e.target.value)}
                placeholder="Votre nom"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label style={{ color: COLORS.navy }}>
              Titre de l'incident <span style={{ color: COLORS.danger }}>*</span>
            </Label>
            <Input
              className="h-12 bg-white"
              style={{ borderColor: COLORS.border }}
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Ex : Indisponibilité du système de paiement"
            />
          </div>

          {/* Sévérité — cartes colorées même non sélectionnées */}
          <div className="space-y-2">
            <Label style={{ color: COLORS.navy }}>Niveau de sévérité</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(["P1", "P2", "P3", "P4"] as Severite[]).map((s) => {
                const active = severite === s;
                const style = SEV_PASTEL[s];
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSeverite(s)}
                    className="rounded-xl py-3 px-2 text-left transition-all min-w-0 relative overflow-hidden"
                    style={{
                      backgroundColor: style.bg,
                      border: `2px solid ${active ? style.dot : style.border}`,
                      boxShadow: active ? `0 0 0 3px ${style.dot}22` : "none",
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: style.dot }}
                      />
                      <span
                        className="font-bold text-sm"
                        style={{ color: style.text }}
                      >
                        {s}
                      </span>
                    </div>
                    <p
                      className="text-[10px] font-medium mt-0.5 truncate"
                      style={{ color: style.text + "CC" }}
                    >
                      {style.label}
                    </p>
                    {active && (
                      <div
                        className="absolute top-2 right-2 h-4 w-4 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: style.dot }}
                      >
                        <svg
                          className="w-2.5 h-2.5 text-white"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Processus impactés */}
          <div className="space-y-2">
            <Label style={{ color: COLORS.navy }}>
              Processus impactés
              {selected.length > 0 && (
                <span className="ml-2 text-xs font-normal" style={{ color: COLORS.forest }}>
                  {selected.length} sélectionné{selected.length > 1 ? "s" : ""}
                </span>
              )}
            </Label>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                style={{ color: COLORS.navy + "40" }}
              />
              <Input
                className="h-11 pl-9 bg-white"
                style={{ borderColor: COLORS.border }}
                placeholder="Rechercher un processus…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div
              className="max-h-52 overflow-y-auto overflow-x-hidden rounded-lg bg-white divide-y"
              style={{ border: `1px solid ${COLORS.border}` }}
            >
              {filtered.length === 0 && (
                <p className="p-3 text-xs" style={{ color: COLORS.navy + "50" }}>
                  Aucun processus trouvé.
                </p>
              )}
              {filtered.map((p) => {
                const active = selected.includes(p.id);
                const critStyle = p.criticality_level
                  ? CRITICALITY_STYLE[p.criticality_level] || CRITICALITY_STYLE.Mineur
                  : null;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
                      active ? "bg-[#F0F5F0]" : "hover:bg-[#FAFAF9]"
                    )}
                  >
                    <span
                      className="flex h-4 w-4 items-center justify-center rounded border flex-shrink-0"
                      style={{
                        borderColor: active ? COLORS.forest : COLORS.border,
                        backgroundColor: active ? COLORS.forest : "transparent",
                      }}
                    >
                      {active && (
                        <svg
                          className="w-2.5 h-2.5 text-white"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate" style={{ color: COLORS.navy }}>
                          {p.name}
                        </span>
                        {critStyle && (
                          <span
                            className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: critStyle.bg, color: critStyle.text }}
                          >
                            {p.criticality_level}
                          </span>
                        )}
                      </div>
                      {p.direction && (
                        <p className="text-[11px] truncate" style={{ color: COLORS.navy + "50" }}>
                          {p.direction}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cellule de crise */}
          <div className="space-y-2">
            <Label style={{ color: COLORS.navy }}>
              Cellule de crise
              <span className="ml-2 text-xs font-normal" style={{ color: COLORS.navy + "60" }}>
                (optionnel — peut être complété plus tard)
              </span>
            </Label>

            {cellMembers.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {cellMembers.map((m) => {
                  const av = getAvatarColor(m.nom);
                  const roleStyle = CELL_ROLE_STYLE[m.role];
                  return (
                    <div
                      key={m.tempId}
                      className="flex items-center gap-3 p-2.5 rounded-lg bg-white border"
                      style={{ borderColor: COLORS.border }}
                    >
                      <div
                        className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                        style={{ backgroundColor: av.bg, color: av.text }}
                      >
                        {getInitials(m.nom)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: COLORS.navy }}>
                          {m.nom}
                        </p>
                        <span
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: roleStyle.bg, color: roleStyle.text }}
                        >
                          {m.role}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCellMember(m.tempId)}
                        className="p-1.5 rounded-md hover:bg-[#FBE9E7] transition-colors"
                        style={{ color: COLORS.navy + "50" }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                className="h-10 bg-white flex-1"
                style={{ borderColor: COLORS.border }}
                placeholder="Nom du membre"
                value={cellName}
                onChange={(e) => setCellName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCellMember();
                  }
                }}
              />
              <Select value={cellRole} onValueChange={(v) => setCellRole(v as CellRole)}>
                <SelectTrigger className="h-10 bg-white w-40" style={{ borderColor: COLORS.border }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CELL_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                onClick={addCellMember}
                disabled={!cellName.trim()}
                variant="outline"
                className="h-10 px-3"
                style={{ borderColor: COLORS.forest, color: COLORS.forest }}
              >
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label style={{ color: COLORS.navy }}>Description courte</Label>
            <Textarea
              rows={3}
              className="bg-white"
              style={{ borderColor: COLORS.border }}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ce qui s'est passé, en quelques lignes…"
            />
          </div>
        </div>

        {/* ===== FOOTER ===== */}
        <div
          className="px-6 py-4 border-t flex flex-col-reverse sm:flex-row sm:justify-end gap-2 shrink-0"
          style={{ borderColor: COLORS.border, backgroundColor: COLORS.cream }}
        >
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            style={{ borderColor: COLORS.border }}
          >
            Annuler
          </Button>
          <Button
            onClick={submit}
            disabled={saving || !titre.trim()}
            className="h-11 px-6"
            style={{ backgroundColor: COLORS.danger, color: "#FFFFFF" }}
          >
            {saving ? "Déclaration…" : "Déclarer l'incident"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default IncidentDeclarationForm;