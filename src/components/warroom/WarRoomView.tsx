// src/components/warroom/WarRoomView.tsx
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Send, Plus, CheckCircle2, Circle, Clock, FileText,
  MessageSquare, Target, Layers, Lock, AlertTriangle, Megaphone, Trash2,
  Users, ChevronRight, Edit3, Building2, User, Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  COLORS, SEV_PASTEL, MAIN_COURANTE_TYPES, ENTRY_TYPE_STYLE,
  COMM_TYPES, COMM_TYPE_STYLE, CELL_ROLE_STYLE,
  formatDateTime, elapsedSince, getInitials, getAvatarColor,
  type Severite, type EntryType, type CommType, type CellRole,
} from "./warroomHelpers";

// ============================================================
// TYPES
// ============================================================
type Incident = {
  id: string;
  type: string | null;
  titre: string;
  date_heure_debut: string;
  date_heure_fin: string | null;
  niveau_severite: Severite;
  statut: string;
  declarant: string | null;
  description: string | null;
};

type MainCouranteEntry = {
  id: string;
  incident_id: string;
  horodatage: string;
  auteur: string | null;
  type: EntryType;
  contenu: string;
};

type IncidentAction = {
  id: string;
  incident_id: string;
  description: string;
  responsable: string | null;
  echeance: string | null;
  statut: string;
};

type IncidentPlan = {
  id: string;
  incident_id: string;
  plan_id: string | null;
  libelle: string | null;
};

type IncidentCommunication = {
  id: string;
  incident_id: string;
  objet: string;
  message: string | null;
  statut: string;
  auteur: string | null;
  created_at: string;
  type?: CommType | null;
};

type CellMember = {
  id: string;
  incident_id: string;
  nom: string;
  role: CellRole | null;
  telephone: string | null;
  email: string | null;
  statut?: string | null;
};

type Retex = {
  id?: string;
  incident_id: string;
  resume: string;
  causes_racines: string;
  points_positifs: string;
  points_amelioration: string;
  actions_correctives: string;
  valide_par?: string | null;
};

// ============================================================
// FRISE CHRONOLOGIQUE HORIZONTALE
// ============================================================
const CrisisTimeline = ({
  hasEntries, hasActions, hasComms, isClosed,
}: {
  hasEntries: boolean;
  hasActions: boolean;
  hasComms: boolean;
  isClosed: boolean;
}) => {
  const steps = [
    { label: "Déclaration", done: true },
    { label: "Actions", done: hasActions },
    { label: "Communication", done: hasComms },
    { label: "Clôture", done: isClosed },
  ];

  const currentIdx = steps.findIndex((s) => !s.done);
  const activeIdx = currentIdx === -1 ? steps.length - 1 : currentIdx;

  return (
    <div className="flex items-center gap-1 w-full">
      {steps.map((s, i) => {
        const isActive = i === activeIdx;
        const isDone = s.done;
        return (
          <div key={s.label} className="flex items-center gap-1 flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold flex-shrink-0 transition-all"
                )}
                style={{
                  backgroundColor: isDone ? COLORS.forest : isActive ? COLORS.forest : "#FFFFFF",
                  color: isDone || isActive ? "#FFFFFF" : COLORS.navy + "60",
                  border: isDone || isActive ? "none" : `1.5px solid ${COLORS.border}`,
                  ...(isActive ? { boxShadow: `0 0 0 2px ${COLORS.forest}33` } : {}),
                }}
              >
                {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span
                className="text-xs font-medium truncate hidden md:block"
                style={{
                  color: isActive ? COLORS.navy : isDone ? COLORS.forest : COLORS.navy + "60",
                }}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="flex-1 h-px mx-1"
                style={{ backgroundColor: isDone ? COLORS.forest : COLORS.border }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================
export const WarRoomView = ({
  incident,
  entries,
  actions,
  plansLies,
  communications,
  cellMembers,
  retex,
  plansModuleAvailable,
  plans,
  processCount,
  currentUser,
  onBack,
  onOpenRetex,
  onOpenTimeline,
  addEntry,
  addAction,
  setActionStatut,
  addPlan,
  removePlan,
  addCommunication,
  setCommunicationStatut,
  updateIncident,
  reload,
}: {
  incident: Incident;
  entries: MainCouranteEntry[];
  actions: IncidentAction[];
  plansLies: IncidentPlan[];
  communications: IncidentCommunication[];
  cellMembers: CellMember[];
  retex: Retex | null;
  plansModuleAvailable: boolean;
  plans: any[];
  processCount: number;
  currentUser?: string;
  onBack: () => void;
  onOpenRetex: () => void;
  onOpenTimeline: () => void;
  addEntry: (p: Partial<MainCouranteEntry>) => Promise<boolean>;
  addAction: (p: Partial<IncidentAction>) => Promise<boolean>;
  setActionStatut: (a: IncidentAction, s: string) => Promise<void>;
  addPlan: (p: { plan_id?: string | null; libelle?: string | null }) => Promise<boolean>;
  removePlan: (id: string) => Promise<void>;
  addCommunication: (p: Partial<IncidentCommunication>) => Promise<boolean>;
  setCommunicationStatut: (c: IncidentCommunication, s: string) => Promise<void>;
  updateIncident: (id: string, p: Partial<Incident>) => Promise<boolean>;
  reload: () => Promise<void>;
}) => {
  const sev = SEV_PASTEL[incident.niveau_severite];
  const isClosed = incident.statut === "Clôturé";
  const hasRetex = !!retex?.id && !!retex.resume?.trim();

  // ===== MAIN COURANTE =====
  const [mcType, setMcType] = useState<EntryType>("Information");
  const [mcContenu, setMcContenu] = useState("");
  const [mcAuteur, setMcAuteur] = useState(currentUser || "");
  const [mcSubmitting, setMcSubmitting] = useState(false);
  const [mcFilter, setMcFilter] = useState<"all" | EntryType>("all");

  const filteredEntries = useMemo(() => {
    if (mcFilter === "all") return entries;
    return entries.filter((e) => e.type === mcFilter);
  }, [entries, mcFilter]);

  const entryCountByType = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of entries) counts[e.type] = (counts[e.type] || 0) + 1;
    return counts;
  }, [entries]);

  const submitMc = async () => {
    if (!mcContenu.trim()) return;
    setMcSubmitting(true);
    const ok = await addEntry({
      type: mcType,
      contenu: mcContenu.trim(),
      auteur: mcAuteur.trim() || undefined,
    });
    setMcSubmitting(false);
    if (ok) setMcContenu("");
  };

  // ===== ACTIONS =====
  const [actionDialog, setActionDialog] = useState(false);
  const [newAction, setNewAction] = useState({ description: "", responsable: "", echeance: "" });
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const submitAction = async () => {
    if (!newAction.description.trim()) return;
    setActionSubmitting(true);
    const ok = await addAction({
      description: newAction.description.trim(),
      responsable: newAction.responsable || undefined,
      echeance: newAction.echeance ? new Date(newAction.echeance).toISOString() : null,
      statut: "À faire",
    });
    setActionSubmitting(false);
    if (ok) {
      setNewAction({ description: "", responsable: "", echeance: "" });
      setActionDialog(false);
    }
  };

  const cycleAction = async (a: IncidentAction) => {
    const next = a.statut === "À faire" ? "En cours" : a.statut === "En cours" ? "Fait" : "À faire";
    await setActionStatut(a, next);
  };

  // ===== PLANS =====
  const [planDialog, setPlanDialog] = useState(false);
  const [newPlan, setNewPlan] = useState({ plan_id: "", libelle: "" });

  const submitPlan = async () => {
    if (!newPlan.plan_id && !newPlan.libelle.trim()) return;
    const ok = await addPlan({
      plan_id: newPlan.plan_id || null,
      libelle: newPlan.libelle || (plans.find((p) => p.id === newPlan.plan_id)?.titre ?? null),
    });
    if (ok) {
      setNewPlan({ plan_id: "", libelle: "" });
      setPlanDialog(false);
    }
  };

  // ===== COMMUNICATIONS =====
  const [commDialog, setCommDialog] = useState(false);
  const [newComm, setNewComm] = useState<{ objet: string; message: string; type: CommType }>({
    objet: "", message: "", type: "Interne",
  });

  const submitComm = async () => {
    if (!newComm.objet.trim() || !newComm.message.trim()) return;
    const ok = await addCommunication({
      objet: newComm.objet.trim(),
      message: newComm.message.trim(),
      statut: "Brouillon",
      auteur: currentUser || null,
      type: newComm.type,
    });
    if (ok) {
      setNewComm({ objet: "", message: "", type: "Interne" });
      setCommDialog(false);
    }
  };

  // ===== CLÔTURE =====
  const [closing, setClosing] = useState(false);
  const retexProgress = useMemo(() => {
    if (!retex) return 0;
    const fields = [retex.resume, retex.causes_racines, retex.points_amelioration, retex.actions_correctives];
    const filled = fields.filter((f) => f && f.trim().length > 0).length;
    return Math.round((filled / fields.length) * 100);
  }, [retex]);

  const closeIncident = async () => {
    if (!hasRetex) {
      toast({
        title: "RETEX incomplet",
        description: "Complétez le RETEX avant de clôturer.",
        variant: "destructive",
      });
      return;
    }
    if (!confirm("Confirmer la clôture de cet incident ?")) return;
    setClosing(true);
    await updateIncident(incident.id, {
      statut: "Clôturé",
      date_heure_fin: new Date().toISOString(),
    });
    setClosing(false);
    await reload();
  };

  const hasEntries = entries.length > 0;
  const hasActions = actions.length > 0;
  const hasComms = communications.length > 0;

  return (
    <div className="space-y-5">
      {/* ===== BANDEAU CRISE + STEPPER ===== */}
      <div
        className="rounded-xl p-5 bg-white"
        style={{
          borderLeft: `4px solid ${sev.dot}`,
          border: `1px solid ${COLORS.border}`,
        }}
      >
        <div className="flex flex-col md:flex-row md:items-start gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="self-start hover:bg-[#F8F6F2]"
            style={{ color: COLORS.navy + "80" }}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Retour
          </Button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="inline-flex items-center justify-center h-10 w-10 rounded-xl font-bold text-white text-sm flex-shrink-0"
                style={{ backgroundColor: sev.dot }}
              >
                {incident.niveau_severite}
              </span>
              <span
                className="font-semibold text-xl truncate"
                style={{ color: COLORS.navy, fontFamily: "'Playfair Display', serif" }}
              >
                {incident.titre}
              </span>
              <Badge
                className="text-[10px] border-0"
                style={{ backgroundColor: sev.bg, color: sev.text }}
              >
                {incident.statut}
              </Badge>
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs flex-wrap" style={{ color: COLORS.navy + "75" }}>
              {incident.type && <span>{incident.type}</span>}
              <span>·</span>
              <span>Déclaré il y a {elapsedSince(incident.date_heure_debut)}</span>
              {incident.declarant && (
                <>
                  <span>·</span>
                  <span>Par {incident.declarant}</span>
                </>
              )}
              <span>·</span>
              <span>{processCount} processus impacté{processCount > 1 ? "s" : ""}</span>
            </div>

            {/* Stepper pleine largeur */}
            <div className="mt-4">
              <CrisisTimeline
                hasEntries={hasEntries}
                hasActions={hasActions}
                hasComms={hasComms}
                isClosed={isClosed}
              />
            </div>
          </div>

          <div className="flex gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenTimeline}
              style={{ borderColor: COLORS.border, color: COLORS.navy }}
            >
              <Clock className="h-3.5 w-3.5 mr-1" /> Timeline
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenRetex}
              style={{
                borderColor: hasRetex ? COLORS.forest : COLORS.border,
                color: hasRetex ? COLORS.forest : COLORS.navy,
              }}
            >
              <FileText className="h-3.5 w-3.5 mr-1" /> {retex?.id ? "RETEX" : "Remplir RETEX"}
            </Button>
          </div>
        </div>
      </div>

      {/* ===== LAYOUT 2 COLONNES ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ===== COLONNE PRINCIPALE : MAIN COURANTE ===== */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-0 shadow-sm" style={{ backgroundColor: "#FFFFFF" }}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle
                  className="text-base flex items-center gap-2"
                  style={{ color: COLORS.navy, fontFamily: "'Playfair Display', serif" }}
                >
                  <MessageSquare className="h-4 w-4" style={{ color: COLORS.forest }} />
                  Main courante
                  <span className="text-xs font-normal" style={{ color: COLORS.navy + "60" }}>
                    {entries.length} entrée{entries.length > 1 ? "s" : ""} · immuable
                  </span>
                </CardTitle>
              </div>

              {/* Filtres */}
              <div className="flex gap-1.5 flex-wrap mt-3">
                <button
                  onClick={() => setMcFilter("all")}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors"
                  style={{
                    backgroundColor: mcFilter === "all" ? COLORS.navy : COLORS.cream,
                    color: mcFilter === "all" ? "#FFFFFF" : COLORS.navy,
                  }}
                >
                  Toutes ({entries.length})
                </button>
                {MAIN_COURANTE_TYPES.map((t) => {
                  const count = entryCountByType[t] || 0;
                  if (count === 0) return null;
                  const style = ENTRY_TYPE_STYLE[t];
                  const active = mcFilter === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setMcFilter(t)}
                      className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors flex items-center gap-1.5"
                      style={{
                        backgroundColor: active ? style.text : style.bg,
                        color: active ? "#FFFFFF" : style.text,
                      }}
                    >
                      {t} ({count})
                    </button>
                  );
                })}
              </div>
            </CardHeader>

            <CardContent>
              {/* Liste scrollable avec max-height */}
              <div
                className="space-y-2 overflow-y-auto pr-1"
                style={{ maxHeight: "480px" }}
              >
                {filteredEntries.length === 0 ? (
                  <p className="text-sm italic text-center py-6" style={{ color: COLORS.navy + "50" }}>
                    {mcFilter === "all" ? "Aucune entrée pour l'instant" : "Aucune entrée de ce type"}
                  </p>
                ) : (
                  filteredEntries.map((entry) => {
                    const style = ENTRY_TYPE_STYLE[entry.type] || ENTRY_TYPE_STYLE.Information;
                    return (
                      <div
                        key={entry.id}
                        className="flex items-start gap-3 p-3 rounded-lg"
                        style={{ backgroundColor: "#FAFAF9" }}
                      >
                        <div
                          className="text-[11px] whitespace-nowrap font-mono pt-0.5"
                          style={{ color: COLORS.navy + "80" }}
                        >
                          {formatDateTime(entry.horodatage)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              className="text-[10px] border-0"
                              style={{ backgroundColor: style.bg, color: style.text }}
                            >
                              {entry.type}
                            </Badge>
                            {entry.auteur && (
                              <span className="text-xs font-medium" style={{ color: COLORS.navy }}>
                                {entry.auteur}
                              </span>
                            )}
                          </div>
                          <p className="text-sm mt-1 whitespace-pre-wrap break-words" style={{ color: COLORS.navy }}>
                            {entry.contenu}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Ajout rapide */}
              {!isClosed && (
                <div className="mt-4 pt-4 border-t space-y-2" style={{ borderColor: COLORS.border }}>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Select value={mcType} onValueChange={(v) => setMcType(v as EntryType)}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MAIN_COURANTE_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Auteur"
                      value={mcAuteur}
                      onChange={(e) => setMcAuteur(e.target.value)}
                      className="h-9 sm:col-span-2"
                    />
                  </div>
                  <Textarea
                    placeholder="Nouvelle entrée…"
                    value={mcContenu}
                    onChange={(e) => setMcContenu(e.target.value)}
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitMc();
                    }}
                  />
                  <div className="flex justify-end">
                    <Button
                      onClick={submitMc}
                      disabled={!mcContenu.trim() || mcSubmitting}
                      style={{ backgroundColor: COLORS.forest, color: "white" }}
                    >
                      <Send className="h-3.5 w-3.5 mr-1.5" />
                      Ajouter
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ===== COLONNE LATÉRALE ===== */}
        <div className="space-y-4">
          {/* Infos crise */}
          <Card className="border-0 shadow-sm" style={{ backgroundColor: "#FFFFFF" }}>
            <CardHeader className="pb-2">
              <CardTitle
                className="text-sm flex items-center gap-2"
                style={{ color: COLORS.navy, fontFamily: "'Playfair Display', serif" }}
              >
                <FileText className="h-4 w-4" style={{ color: COLORS.forest }} />
                Informations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {incident.type && (
                <div className="flex items-start gap-2">
                  <Layers className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: COLORS.navy + "50" }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: COLORS.navy + "60" }}>
                      Type
                    </p>
                    <p className="text-sm" style={{ color: COLORS.navy }}>{incident.type}</p>
                  </div>
                </div>
              )}
              {incident.declarant && (
                <div className="flex items-start gap-2">
                  <User className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: COLORS.navy + "50" }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: COLORS.navy + "60" }}>
                      Déclarant
                    </p>
                    <p className="text-sm" style={{ color: COLORS.navy }}>{incident.declarant}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2">
                <Calendar className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: COLORS.navy + "50" }} />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: COLORS.navy + "60" }}>
                    Déclaré le
                  </p>
                  <p className="text-sm" style={{ color: COLORS.navy }}>{formatDateTime(incident.date_heure_debut)}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Building2 className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: COLORS.navy + "50" }} />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: COLORS.navy + "60" }}>
                    Processus impactés
                  </p>
                  <p className="text-sm" style={{ color: COLORS.navy }}>{processCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cellule de crise */}
          {cellMembers.length > 0 && (
            <Card className="border-0 shadow-sm" style={{ backgroundColor: "#FFFFFF" }}>
              <CardHeader className="pb-2">
                <CardTitle
                  className="text-sm flex items-center gap-2"
                  style={{ color: COLORS.navy, fontFamily: "'Playfair Display', serif" }}
                >
                  <Users className="h-4 w-4" style={{ color: COLORS.forest }} />
                  Cellule
                  <span className="text-[10px] font-normal ml-auto" style={{ color: COLORS.navy + "60" }}>
                    {cellMembers.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {cellMembers.map((m) => {
                  const av = getAvatarColor(m.nom);
                  const roleStyle = m.role
                    ? CELL_ROLE_STYLE[m.role]
                    : { bg: COLORS.cream, text: COLORS.navy };
                  return (
                    <div key={m.id} className="flex items-center gap-2.5">
                      <div
                        className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0"
                        style={{ backgroundColor: av.bg, color: av.text }}
                      >
                        {getInitials(m.nom)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate" style={{ color: COLORS.navy }}>
                          {m.nom}
                        </p>
                        {m.role && (
                          <span
                            className="text-[9px] font-medium px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: roleStyle.bg, color: roleStyle.text }}
                          >
                            {m.role}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <Card className="border-0 shadow-sm" style={{ backgroundColor: "#FFFFFF" }}>
            <CardHeader className="pb-2">
              <CardTitle
                className="text-sm flex items-center gap-2"
                style={{ color: COLORS.navy, fontFamily: "'Playfair Display', serif" }}
              >
                <Target className="h-4 w-4" style={{ color: COLORS.forest }} />
                Actions
                <span className="text-[10px] font-normal" style={{ color: COLORS.navy + "60" }}>
                  {actions.length}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto h-6 w-6 p-0"
                  onClick={() => setActionDialog(true)}
                  disabled={isClosed}
                  style={{ color: COLORS.forest }}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {actions.length === 0 ? (
                <p className="text-xs italic text-center py-2" style={{ color: COLORS.navy + "50" }}>
                  Aucune action
                </p>
              ) : (
                <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1">
                  {actions.map((a) => {
                    const isDone = a.statut === "Fait";
                    return (
                      <div
                        key={a.id}
                        className="flex items-start gap-2 p-2 rounded-lg"
                        style={{ backgroundColor: "#FAFAF9", opacity: isDone ? 0.6 : 1 }}
                      >
                        <button
                          onClick={() => !isClosed && cycleAction(a)}
                          disabled={isClosed}
                          className="mt-0.5 flex-shrink-0"
                        >
                          {isDone ? (
                            <CheckCircle2 className="h-4 w-4" style={{ color: COLORS.forest }} />
                          ) : (
                            <Circle className="h-4 w-4" style={{ color: COLORS.navy + "50" }} />
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn("text-xs", isDone && "line-through")}
                            style={{ color: COLORS.navy }}
                          >
                            {a.description}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] flex-wrap" style={{ color: COLORS.navy + "70" }}>
                            {a.responsable && <span>👤 {a.responsable}</span>}
                            <Badge variant="outline" className="text-[9px]" style={{ borderColor: COLORS.border }}>
                              {a.statut}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Plans activés */}
          <Card className="border-0 shadow-sm" style={{ backgroundColor: "#FFFFFF" }}>
            <CardHeader className="pb-2">
              <CardTitle
                className="text-sm flex items-center gap-2"
                style={{ color: COLORS.navy, fontFamily: "'Playfair Display', serif" }}
              >
                <Layers className="h-4 w-4" style={{ color: COLORS.forest }} />
                Plans
                <span className="text-[10px] font-normal" style={{ color: COLORS.navy + "60" }}>
                  {plansLies.length}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto h-6 w-6 p-0"
                  onClick={() => setPlanDialog(true)}
                  disabled={isClosed}
                  style={{ color: COLORS.forest }}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {plansLies.length === 0 ? (
                <p className="text-xs italic text-center py-2" style={{ color: COLORS.navy + "50" }}>
                  Aucun plan activé
                </p>
              ) : (
                <div className="space-y-1.5">
                  {plansLies.map((p) => (
                    <div
                      key={p.id}
                      className="p-2 rounded-lg flex items-start justify-between gap-2"
                      style={{ backgroundColor: "#FAFAF9" }}
                    >
                      <p className="text-xs font-medium truncate" style={{ color: COLORS.navy }}>
                        {p.libelle || plans.find((x) => x.id === p.plan_id)?.titre || "Plan référencé"}
                      </p>
                      {!isClosed && (
                        <button
                          onClick={() => removePlan(p.id)}
                          className="flex-shrink-0"
                          style={{ color: COLORS.navy + "40" }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Communication */}
          <Card className="border-0 shadow-sm" style={{ backgroundColor: "#FFFFFF" }}>
            <CardHeader className="pb-2">
              <CardTitle
                className="text-sm flex items-center gap-2"
                style={{ color: COLORS.navy, fontFamily: "'Playfair Display', serif" }}
              >
                <Megaphone className="h-4 w-4" style={{ color: COLORS.forest }} />
                Communication
                <span className="text-[10px] font-normal" style={{ color: COLORS.navy + "60" }}>
                  {communications.length}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto h-6 w-6 p-0"
                  onClick={() => setCommDialog(true)}
                  disabled={isClosed}
                  style={{ color: COLORS.forest }}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {communications.length === 0 ? (
                <div className="text-center py-2">
                  <p className="text-xs italic" style={{ color: COLORS.navy + "50" }}>
                    Aucune communication
                  </p>
                  {!isClosed && (
                    <div className="flex flex-wrap justify-center gap-1 mt-2">
                      {COMM_TYPES.map((t) => {
                        const style = COMM_TYPE_STYLE[t];
                        return (
                          <button
                            key={t}
                            onClick={() => {
                              setNewComm({ objet: "", message: "", type: t });
                              setCommDialog(true);
                            }}
                            className="px-2 py-0.5 rounded-full text-[10px] font-medium hover:opacity-80"
                            style={{ backgroundColor: style.bg, color: style.text }}
                          >
                            + {t}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1">
                  {communications.map((c) => {
                    const statutColor =
                      c.statut === "Envoyé" ? COLORS.forest :
                      c.statut === "Validé" ? "#EF9F27" :
                      COLORS.navy + "60";
                    const typeStyle = c.type ? COMM_TYPE_STYLE[c.type] : null;
                    return (
                      <div key={c.id} className="p-2 rounded-lg" style={{ backgroundColor: "#FAFAF9" }}>
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          {typeStyle && (
                            <span
                              className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: typeStyle.bg, color: typeStyle.text }}
                            >
                              {c.type}
                            </span>
                          )}
                          <Badge className="text-[9px] border-0 text-white" style={{ backgroundColor: statutColor }}>
                            {c.statut}
                          </Badge>
                        </div>
                        <p className="text-xs font-medium truncate" style={{ color: COLORS.navy }}>
                          {c.objet}
                        </p>
                        {!isClosed && c.statut === "Brouillon" && (
                          <Button
                            size="sm" variant="outline"
                            className="h-6 text-[10px] mt-1.5 w-full"
                            onClick={() => setCommunicationStatut(c, "Validé")}
                          >
                            Valider
                          </Button>
                        )}
                        {!isClosed && c.statut === "Validé" && (
                          <Button
                            size="sm" variant="outline"
                            className="h-6 text-[10px] mt-1.5 w-full"
                            onClick={() => setCommunicationStatut(c, "Envoyé")}
                          >
                            Envoyer
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ===== RETEX / CLÔTURE (pleine largeur) ===== */}
      <Card className="border-0 shadow-sm" style={{ backgroundColor: "#FFFFFF" }}>
        <CardHeader className="pb-2">
          <CardTitle
            className="text-base flex items-center gap-2"
            style={{ color: COLORS.navy, fontFamily: "'Playfair Display', serif" }}
          >
            <FileText className="h-4 w-4" style={{ color: COLORS.forest }} />
            RETEX · Retour d'expérience
            {hasRetex && (
              <Badge className="text-[10px] border-0 ml-1" style={{ backgroundColor: "#E8F5E9", color: COLORS.forest }}>
                ✓ Enregistré
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs" style={{ color: COLORS.navy + "80" }}>
                Progression du RETEX
              </span>
              <span className="text-xs font-semibold" style={{ color: COLORS.navy }}>
                {retexProgress}%
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: COLORS.cream }}>
              <div
                className="h-full transition-all"
                style={{
                  width: `${retexProgress}%`,
                  backgroundColor: retexProgress === 100 ? COLORS.forest : COLORS.danger,
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            {[
              { key: "resume", label: "Résumé de la crise" },
              { key: "causes_racines", label: "Causes racines" },
              { key: "points_amelioration", label: "Points d'amélioration" },
              { key: "actions_correctives", label: "Actions correctives" },
            ].map((f) => {
              const value = (retex as any)?.[f.key] || "";
              const filled = value.trim().length > 0;
              return (
                <div
                  key={f.key}
                  className="p-3 rounded-lg flex items-start gap-2"
                  style={{
                    backgroundColor: filled ? "#F0F5F0" : "#FAFAF9",
                    border: `1px solid ${filled ? COLORS.forest + "33" : COLORS.border}`,
                  }}
                >
                  <div
                    className="flex h-5 w-5 items-center justify-center rounded-full flex-shrink-0 mt-0.5"
                    style={{
                      backgroundColor: filled ? COLORS.forest : "#FFFFFF",
                      border: `1.5px solid ${filled ? COLORS.forest : COLORS.border}`,
                    }}
                  >
                    {filled && <CheckCircle2 className="h-3 w-3 text-white" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: COLORS.navy + "80" }}>
                      {f.label}
                    </p>
                    <p className="text-xs mt-0.5 line-clamp-2" style={{ color: COLORS.navy }}>
                      {filled ? value : <em style={{ color: COLORS.navy + "40" }}>Non renseigné</em>}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-3 pt-4 border-t" style={{ borderColor: COLORS.border }}>
            <div className="flex-1 flex items-start gap-2">
              {!hasRetex && (
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: COLORS.danger }} />
              )}
              <div>
                <p className="text-sm font-medium" style={{ color: COLORS.navy }}>
                  {hasRetex ? "Le RETEX est prêt" : "RETEX requis avant clôture"}
                </p>
                <p className="text-xs mt-0.5" style={{ color: COLORS.navy + "75" }}>
                  {hasRetex
                    ? "Vous pouvez modifier le RETEX ou clôturer l'incident."
                    : "Complétez au minimum le résumé, puis enregistrez pour débloquer la clôture."}
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {!isClosed && (
                <Button
                  variant="outline"
                  onClick={onOpenRetex}
                  style={{ borderColor: COLORS.forest, color: COLORS.forest }}
                >
                  <Edit3 className="h-4 w-4 mr-1.5" />
                  {hasRetex ? "Modifier le RETEX" : "Remplir le RETEX"}
                </Button>
              )}
              <Button
                onClick={closeIncident}
                disabled={!hasRetex || isClosed || closing}
                title={!hasRetex ? "RETEX obligatoire avant clôture" : undefined}
                className="font-medium"
                style={{
                  backgroundColor: hasRetex && !isClosed ? COLORS.forest : COLORS.border,
                  color: hasRetex && !isClosed ? "white" : COLORS.navy + "70",
                  cursor: !hasRetex || isClosed ? "not-allowed" : "pointer",
                }}
              >
                {!hasRetex && <Lock className="h-3.5 w-3.5 mr-1.5" />}
                {isClosed ? "Incident clôturé" : "Clôturer la crise"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===== DIALOGS ===== */}
      <Dialog open={actionDialog} onOpenChange={setActionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle action</DialogTitle>
            <DialogDescription>Ajoutez une action à suivre.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Description *</Label>
              <Textarea
                rows={2}
                value={newAction.description}
                onChange={(e) => setNewAction({ ...newAction, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Responsable</Label>
                <Input
                  value={newAction.responsable}
                  onChange={(e) => setNewAction({ ...newAction, responsable: e.target.value })}
                />
              </div>
              <div>
                <Label>Échéance</Label>
                <Input
                  type="datetime-local"
                  value={newAction.echeance}
                  onChange={(e) => setNewAction({ ...newAction, echeance: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(false)}>Annuler</Button>
            <Button
              onClick={submitAction}
              disabled={!newAction.description.trim() || actionSubmitting}
              style={{ backgroundColor: COLORS.forest, color: "white" }}
            >
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={planDialog} onOpenChange={setPlanDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Activer un plan</DialogTitle>
            <DialogDescription>
              {plansModuleAvailable ? "Sélectionnez un plan du référentiel ou saisissez une référence." : "Saisissez une référence libre."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {plansModuleAvailable && plans.length > 0 && (
              <div>
                <Label>Plan du référentiel</Label>
                <Select value={newPlan.plan_id} onValueChange={(v) => setNewPlan({ ...newPlan, plan_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="— Aucun —" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.titre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Référence libre {plansModuleAvailable ? "(optionnel)" : "*"}</Label>
              <Input
                value={newPlan.libelle}
                onChange={(e) => setNewPlan({ ...newPlan, libelle: e.target.value })}
                placeholder="Ex : PCA-SI-2024-01"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialog(false)}>Annuler</Button>
            <Button
              onClick={submitPlan}
              disabled={!newPlan.plan_id && !newPlan.libelle.trim()}
              style={{ backgroundColor: COLORS.forest, color: "white" }}
            >
              Activer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={commDialog} onOpenChange={setCommDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvelle communication</DialogTitle>
            <DialogDescription>
              Choisissez le type et rédigez. Le message restera en brouillon jusqu'à validation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Type</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {COMM_TYPES.map((t) => {
                  const active = newComm.type === t;
                  const style = COMM_TYPE_STYLE[t];
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNewComm({ ...newComm, type: t })}
                      className="rounded-lg py-2 text-xs font-medium transition-all"
                      style={{
                        backgroundColor: active ? style.text : style.bg,
                        color: active ? "#FFFFFF" : style.text,
                        border: `1.5px solid ${active ? style.text : "transparent"}`,
                      }}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label>Objet *</Label>
              <Input
                value={newComm.objet}
                onChange={(e) => setNewComm({ ...newComm, objet: e.target.value })}
                placeholder="Ex : Information clientèle"
              />
            </div>
            <div>
              <Label>Message *</Label>
              <Textarea
                rows={5}
                value={newComm.message}
                onChange={(e) => setNewComm({ ...newComm, message: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommDialog(false)}>Annuler</Button>
            <Button
              onClick={submitComm}
              disabled={!newComm.objet.trim() || !newComm.message.trim()}
              style={{ backgroundColor: COLORS.forest, color: "white" }}
            >
              Créer le brouillon
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WarRoomView;