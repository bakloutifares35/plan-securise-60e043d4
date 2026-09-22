// src/components/warroom/WarRoomView.tsx
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Users, Edit3, Building2, User, Calendar, Info, Check, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  COLORS, SEV_PASTEL, MAIN_COURANTE_TYPES, ENTRY_TYPE_STYLE,
  COMM_TYPES, COMM_TYPE_STYLE, CELL_ROLE_STYLE,
  formatDateTime, elapsedSince, getInitials, getAvatarColor,
  type Severite, type EntryType, type CommType, type CellRole,
} from "./warroomHelpers";
import { AiCrisisRecommendations, type AiProcessContext } from "./AiCrisisRecommendations";

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
// RAIL DE PROGRESSION
// ============================================================
const CrisisRail = ({
  hasEntries, hasActions, hasComms, isClosed,
}: {
  hasEntries: boolean;
  hasActions: boolean;
  hasComms: boolean;
  isClosed: boolean;
}) => {
  const steps = [
    { label: "Déclaration", sub: "Tracé", done: true },
    { label: "Actions", sub: hasActions ? "En cours" : "À lancer", done: hasActions },
    { label: "Communication", sub: hasComms ? "Émise" : "À rédiger", done: hasComms },
    { label: "Clôture", sub: isClosed ? "Clôturé" : "RETEX requis", done: isClosed },
  ];

  const currentIdx = steps.findIndex((s) => !s.done);
  const activeIdx = currentIdx === -1 ? steps.length - 1 : currentIdx;

  return (
    <div className="relative">
      <div className="flex items-stretch gap-0 w-full">
        {steps.map((s, i) => {
          const isActive = i === activeIdx && !s.done;
          const isDone = s.done;
          return (
            <div key={s.label} className="flex-1 flex items-stretch min-w-0">
              <div className="flex-1 flex flex-col items-start gap-2 min-w-0">
                <div className="flex items-center gap-3 w-full">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold flex-shrink-0 transition-all relative",
                      isActive && "animate-pulse"
                    )}
                    style={{
                      backgroundColor: isDone ? COLORS.forest : isActive ? COLORS.forest : "#FFFFFF",
                      color: isDone || isActive ? "#FFFFFF" : COLORS.navy + "60",
                      border: isDone || isActive ? "none" : `1.5px solid ${COLORS.border}`,
                      boxShadow: isActive ? `0 0 0 4px ${COLORS.forest}22` : "none",
                    }}
                  >
                    {isDone ? <Check className="h-3.5 w-3.5" /> : <span>{i + 1}</span>}
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      className="flex-1 h-1 rounded-full relative overflow-hidden"
                      style={{ backgroundColor: COLORS.border }}
                    >
                      <div
                        className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                        style={{
                          backgroundColor: isDone ? COLORS.forest : COLORS.forest + "40",
                          width: isDone ? "100%" : "0%",
                        }}
                      />
                    </div>
                  )}
                </div>
                <div className="pl-0.5 -mt-0.5">
                  <p
                    className="text-[11px] font-semibold leading-tight"
                    style={{
                      color: isActive ? COLORS.navy : isDone ? COLORS.forest : COLORS.navy + "40",
                    }}
                  >
                    {s.label}
                  </p>
                  <p
                    className="text-[9.5px] leading-tight mt-0.5"
                    style={{ color: isActive ? COLORS.forest : COLORS.navy + "40" }}
                  >
                    {s.sub}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================
// SIDE BLOCK — avec hauteur fixe optionnelle
// ============================================================
const SideBlock = ({
  number,
  icon: Icon,
  title,
  count,
  onAdd,
  addDisabled,
  addTitle,
  tone = "neutral",
  fixedHeight,
  children,
}: {
  number: string;
  icon: any;
  title: string;
  count?: number;
  onAdd?: () => void;
  addDisabled?: boolean;
  addTitle?: string;
  tone?: "neutral" | "warm" | "cool" | "rose";
  fixedHeight?: string;
  children: React.ReactNode;
}) => {
  const tones = {
    neutral: { bg: "#FFFFFF", headerBg: "#FCFBF8", iconBg: COLORS.forest + "15", iconColor: COLORS.forest },
    warm:    { bg: "#FFFFFF", headerBg: "#FDF9F3", iconBg: "#FFF3E0", iconColor: "#B76E1D" },
    cool:    { bg: "#FFFFFF", headerBg: "#F6F8FA", iconBg: "#EDF2F7", iconColor: "#38536F" },
    rose:    { bg: "#FFFFFF", headerBg: "#FDF6F5", iconBg: "#FBE9E7", iconColor: "#C62828" },
  }[tone];

  return (
    <div
      className={cn("rounded-xl overflow-hidden flex flex-col", fixedHeight)}
      style={{
        border: `1px solid ${COLORS.border}`,
        backgroundColor: tones.bg,
        boxShadow: "0 1px 3px rgba(23,32,48,0.05)",
      }}
    >
      <div
        className="flex items-center gap-2.5 px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: COLORS.border + "99", backgroundColor: tones.headerBg }}
      >
        <span
          className="flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold flex-shrink-0"
          style={{ backgroundColor: tones.iconBg, color: tones.iconColor }}
        >
          {number}
        </span>
        <Icon className="h-4 w-4 flex-shrink-0" style={{ color: tones.iconColor }} />
        <span
          className="text-[13.5px] font-semibold flex-1 truncate"
          style={{ color: COLORS.navy, fontFamily: "'Playfair Display', serif" }}
        >
          {title}
        </span>
        {typeof count === "number" && (
          <span
            className="text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-full"
            style={{ backgroundColor: tones.iconBg, color: tones.iconColor }}
          >
            {count}
          </span>
        )}
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            disabled={addDisabled}
            className={cn(
              "h-7 w-7 p-0 rounded-md flex items-center justify-center transition-colors",
              addDisabled ? "opacity-40 cursor-not-allowed" : "hover:bg-white"
            )}
            style={{ color: COLORS.navy + "80" }}
            title={addTitle}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="p-3.5 flex-1 min-h-0 overflow-hidden flex flex-col">
        {children}
      </div>
    </div>
  );
};

// ============================================================
// EMPTY STATE
// ============================================================
const EmptyState = ({
  icon: Icon, title, hint, tone = "neutral",
}: {
  icon: any; title: string; hint?: string;
  tone?: "neutral" | "warm" | "cool" | "rose";
}) => {
  const tones = {
    neutral: { bg: COLORS.cream, color: COLORS.navy + "35" },
    warm:    { bg: "#FFF3E0", color: "#B76E1D" },
    cool:    { bg: "#EDF2F7", color: "#38536F" },
    rose:    { bg: "#FBE9E7", color: "#C62828" },
  }[tone];

  return (
    <div className="flex flex-col items-center text-center py-4 my-auto">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-full mb-2"
        style={{ backgroundColor: tones.bg }}
      >
        <Icon className="h-4.5 w-4.5" style={{ color: tones.color }} />
      </div>
      <p className="text-[12px] font-medium" style={{ color: COLORS.navy + "80" }}>
        {title}
      </p>
      {hint && (
        <p className="text-[10.5px] mt-1 max-w-[220px] leading-snug" style={{ color: COLORS.navy + "50" }}>
          {hint}
        </p>
      )}
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
  impactedProcessus,
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
  impactedProcessus?: AiProcessContext[];
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

  // Détecte si l'auteur d'une entrée est "Inconnu" (ou vide) → affiche Copilote IA si l'entrée est de type Action et a été créée automatiquement
  const isCopiloteEntry = (entry: MainCouranteEntry): boolean => {
    if (entry.auteur && entry.auteur.trim() && entry.auteur.trim() !== "Inconnu") return false;
    // Heuristique : si l'auteur est Inconnu et le contenu commence par "Action créée" ou "Plan activé", c'est probablement le copilote
    const c = entry.contenu.toLowerCase();
    return c.startsWith("action créée") || c.startsWith("plan activé");
  };

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
    <div className="space-y-4">
      {/* ============================================================
          BANDEAU DE CRISE
          ============================================================ */}
      <div
        className="rounded-2xl overflow-hidden bg-white"
        style={{
          border: `1px solid ${COLORS.border}`,
          boxShadow: "0 1px 3px rgba(23,32,48,0.05)",
        }}
      >
        <div className="flex h-1.5">
          <div className="flex-1" style={{ backgroundColor: sev.dot }} />
          <div className="flex-1" style={{ backgroundColor: sev.dot, opacity: 0.7 }} />
          <div className="flex-1" style={{ backgroundColor: sev.dot, opacity: 0.4 }} />
          <div className="flex-1" style={{ backgroundColor: sev.dot, opacity: 0.15 }} />
        </div>

        <div className="p-5">
          <div className="flex flex-col md:flex-row md:items-start gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="self-start hover:bg-[#F8F6F2] -ml-2"
              style={{ color: COLORS.navy + "80" }}
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Retour
            </Button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <span
                  className="inline-flex items-center justify-center h-11 min-w-11 px-3 rounded-lg font-bold text-white text-sm flex-shrink-0"
                  style={{
                    backgroundColor: sev.dot,
                    fontFamily: "'Playfair Display', serif",
                    letterSpacing: "0.02em",
                  }}
                >
                  {incident.niveau_severite}
                </span>
                <div className="min-w-0 flex-1">
                  <h1
                    className="text-xl md:text-2xl font-bold leading-tight truncate"
                    style={{ color: COLORS.navy, fontFamily: "'Playfair Display', serif" }}
                  >
                    {incident.titre}
                  </h1>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge
                      className="text-[10px] border-0 font-medium"
                      style={{ backgroundColor: sev.bg, color: sev.text }}
                    >
                      {incident.statut}
                    </Badge>
                    {incident.type && (
                      <span className="text-[11px]" style={{ color: COLORS.navy + "70" }}>
                        {incident.type}
                      </span>
                    )}
                    <span className="text-[11px]" style={{ color: COLORS.navy + "40" }}>·</span>
                    <span className="text-[11px]" style={{ color: COLORS.navy + "70" }}>
                      Il y a {elapsedSince(incident.date_heure_debut)}
                    </span>
                    {incident.declarant && (
                      <>
                        <span className="text-[11px]" style={{ color: COLORS.navy + "40" }}>·</span>
                        <span className="text-[11px]" style={{ color: COLORS.navy + "70" }}>
                          Par {incident.declarant}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <CrisisRail
                  hasEntries={hasEntries}
                  hasActions={hasActions}
                  hasComms={hasComms}
                  isClosed={isClosed}
                />
              </div>
            </div>

            <div className="flex gap-2 flex-shrink-0 self-start">
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenTimeline}
                className="h-8"
                style={{ borderColor: COLORS.border, color: COLORS.navy }}
              >
                <Clock className="h-3.5 w-3.5 mr-1" /> Timeline
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenRetex}
                className="h-8"
                style={{
                  borderColor: hasRetex ? COLORS.forest : COLORS.border,
                  color: hasRetex ? COLORS.forest : COLORS.navy,
                  backgroundColor: hasRetex ? COLORS.forest + "08" : "transparent",
                }}
              >
                <FileText className="h-3.5 w-3.5 mr-1" />
                {retex?.id ? "RETEX" : "Remplir RETEX"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
          LAYOUT PRINCIPAL
          ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main courante */}
        <div className="lg:col-span-2 space-y-4">
          <div
            className="rounded-xl overflow-hidden bg-white flex flex-col"
            style={{
              border: `1px solid ${COLORS.border}`,
              boxShadow: "0 1px 2px rgba(23,32,48,0.04)",
            }}
          >
            <div
              className="px-4 py-3 border-b"
              style={{ borderColor: COLORS.border + "99", backgroundColor: "#FCFBF8" }}
            >
              <div className="flex items-center gap-2.5 mb-3">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-lg"
                  style={{ backgroundColor: COLORS.forest + "15" }}
                >
                  <MessageSquare className="h-3.5 w-3.5" style={{ color: COLORS.forest }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3
                    className="text-[14px] font-semibold leading-tight"
                    style={{ color: COLORS.navy, fontFamily: "'Playfair Display', serif" }}
                  >
                    Main courante
                  </h3>
                  <p className="text-[10px] leading-tight mt-0.5" style={{ color: COLORS.navy + "55" }}>
                    {entries.length} entrée{entries.length > 1 ? "s" : ""} · Journal immuable horodaté
                  </p>
                </div>
              </div>

              <div className="flex gap-1.5 flex-wrap">
                <button
                  onClick={() => setMcFilter("all")}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all"
                  style={{
                    backgroundColor: mcFilter === "all" ? COLORS.navy : "#FFFFFF",
                    color: mcFilter === "all" ? "#FFFFFF" : COLORS.navy + "70",
                    border: `1px solid ${mcFilter === "all" ? COLORS.navy : COLORS.border}`,
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
                      className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all flex items-center gap-1.5"
                      style={{
                        backgroundColor: active ? style.text : "#FFFFFF",
                        color: active ? "#FFFFFF" : style.text,
                        border: `1px solid ${active ? style.text : COLORS.border}`,
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: active ? "#FFFFFF" : style.text }}
                      />
                      {t} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-3 flex-1">
              <div
                className="space-y-1.5 overflow-y-auto pr-1"
                style={{ maxHeight: "480px" }}
              >
                {filteredEntries.length === 0 ? (
                  <p className="text-sm italic text-center py-6" style={{ color: COLORS.navy + "50" }}>
                    {mcFilter === "all" ? "Aucune entrée pour l'instant" : "Aucune entrée de ce type"}
                  </p>
                ) : (
                  filteredEntries.map((entry) => {
                    const style = ENTRY_TYPE_STYLE[entry.type] || ENTRY_TYPE_STYLE.Information;
                    const fromCopilote = isCopiloteEntry(entry);
                    return (
                      <div
                        key={entry.id}
                        className="flex items-start gap-3 p-3 rounded-lg transition-colors hover:bg-[#FAF9F6]"
                        style={{
                          borderLeft: `3px solid ${fromCopilote ? COLORS.forest : style.text}`,
                          backgroundColor: fromCopilote ? COLORS.forest + "06" : "#FAFAF9",
                        }}
                      >
                        <div className="flex flex-col items-start gap-0.5 flex-shrink-0 w-24">
                          <span
                            className="text-[10px] font-mono font-medium tabular-nums"
                            style={{ color: COLORS.navy + "80" }}
                          >
                            {new Date(entry.horodatage).toLocaleTimeString("fr-FR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <span className="text-[9px] font-mono" style={{ color: COLORS.navy + "40" }}>
                            {new Date(entry.horodatage).toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                            })}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Badge
                              className="text-[9px] border-0 font-semibold uppercase tracking-wider"
                              style={{ backgroundColor: style.bg, color: style.text }}
                            >
                              {entry.type}
                            </Badge>
                            {fromCopilote ? (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                                style={{ backgroundColor: COLORS.forest + "12", color: COLORS.forest }}
                              >
                                <Sparkles className="h-2.5 w-2.5" />
                                Copilote IA
                              </span>
                            ) : (
                              entry.auteur && entry.auteur !== "Inconnu" && (
                                <span className="text-[11px] font-medium" style={{ color: COLORS.navy }}>
                                  {entry.auteur}
                                </span>
                              )
                            )}
                          </div>
                          <p
                            className="text-[13px] leading-relaxed whitespace-pre-wrap break-words"
                            style={{ color: COLORS.navy }}
                          >
                            {entry.contenu}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {!isClosed && (
                <div
                  className="mt-4 pt-4 border-t space-y-2"
                  style={{ borderColor: COLORS.border }}
                >
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
                      className="h-9"
                      style={{ backgroundColor: COLORS.forest, color: "white" }}
                    >
                      <Send className="h-3.5 w-3.5 mr-1.5" />
                      Ajouter
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Colonne latérale */}
        <div className="space-y-3">
          <SideBlock number="01" icon={Info} title="Informations">
            <div className="space-y-2.5">
              {incident.type && (
                <div className="flex items-start gap-2">
                  <Layers className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: COLORS.navy + "50" }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: COLORS.navy + "50" }}>
                      Type
                    </p>
                    <p className="text-[12px]" style={{ color: COLORS.navy }}>{incident.type}</p>
                  </div>
                </div>
              )}
              {incident.declarant && (
                <div className="flex items-start gap-2">
                  <User className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: COLORS.navy + "50" }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: COLORS.navy + "50" }}>
                      Déclarant
                    </p>
                    <p className="text-[12px]" style={{ color: COLORS.navy }}>{incident.declarant}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2">
                <Calendar className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: COLORS.navy + "50" }} />
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: COLORS.navy + "50" }}>
                    Déclaré le
                  </p>
                  <p className="text-[12px]" style={{ color: COLORS.navy }}>{formatDateTime(incident.date_heure_debut)}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Building2 className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: COLORS.navy + "50" }} />
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: COLORS.navy + "50" }}>
                    Processus impactés
                  </p>
                  <p className="text-[12px]" style={{ color: COLORS.navy }}>{processCount}</p>
                </div>
              </div>
            </div>
          </SideBlock>

          {cellMembers.length > 0 && (
            <SideBlock number="02" icon={Users} title="Cellule" count={cellMembers.length}>
              <div className="space-y-2">
                {cellMembers.map((m) => {
                  const av = getAvatarColor(m.nom);
                  const roleStyle = m.role
                    ? CELL_ROLE_STYLE[m.role]
                    : { bg: COLORS.cream, text: COLORS.navy };
                  return (
                    <div key={m.id} className="flex items-center gap-2.5">
                      <div
                        className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                        style={{ backgroundColor: av.bg, color: av.text }}
                      >
                        {getInitials(m.nom)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11.5px] font-medium truncate" style={{ color: COLORS.navy }}>
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
              </div>
            </SideBlock>
          )}

          <AiCrisisRecommendations
            incidentId={incident.id}
            typeIncident={incident.type}
            severite={incident.niveau_severite}
            titre={incident.titre}
            description={incident.description}
            processus={impactedProcessus ?? []}
            plans={(plans ?? []).map((p: any) => ({ id: p.id, titre: p.titre }))}
            disabled={isClosed}
            onAddAction={(p) => addAction(p as Partial<IncidentAction>)}
            onAddPlan={addPlan}
          />
        </div>
      </div>

      {/* ============================================================
          TROIS BLOCS Actions / Plans / Communication — HAUTEUR UNIFORME
          ============================================================ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        {/* Actions */}
        <SideBlock
          number="03"
          icon={Target}
          title="Actions"
          count={actions.length}
          onAdd={() => setActionDialog(true)}
          addDisabled={isClosed}
          addTitle="Ajouter une action"
          tone="warm"
          fixedHeight="h-[280px]"
        >
          {actions.length === 0 ? (
            <EmptyState
              icon={Target}
              title="Aucune action en cours"
              hint="Ajoutez-en une ou utilisez une suggestion IA"
              tone="warm"
            />
          ) : (
            <div className="space-y-1.5 overflow-y-auto pr-1 flex-1">
              {actions.map((a) => {
                const isDone = a.statut === "Fait";
                return (
                  <div
                    key={a.id}
                    className="flex items-start gap-2.5 px-2.5 py-2 rounded-md transition-colors hover:bg-[#FDF9F3]"
                    style={{ opacity: isDone ? 0.55 : 1 }}
                  >
                    <button
                      onClick={() => !isClosed && cycleAction(a)}
                      disabled={isClosed}
                      className="mt-0.5 flex-shrink-0"
                    >
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4" style={{ color: COLORS.forest }} />
                      ) : (
                        <Circle className="h-4 w-4" style={{ color: COLORS.navy + "40" }} />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn("text-[12px] leading-snug", isDone && "line-through")}
                        style={{ color: COLORS.navy }}
                      >
                        {a.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] flex-wrap" style={{ color: COLORS.navy + "60" }}>
                        {a.responsable && <span>· {a.responsable}</span>}
                        <span
                          className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor:
                              a.statut === "Fait" ? "#E8F5E9" :
                              a.statut === "En cours" ? "#FFF3E0" :
                              "#F1EFE8",
                            color:
                              a.statut === "Fait" ? COLORS.forest :
                              a.statut === "En cours" ? "#B76E1D" :
                              COLORS.navy + "70",
                          }}
                        >
                          {a.statut}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SideBlock>

        {/* Plans */}
        <SideBlock
          number="04"
          icon={Layers}
          title="Plans"
          count={plansLies.length}
          onAdd={() => setPlanDialog(true)}
          addDisabled={isClosed}
          addTitle="Activer un plan"
          tone="cool"
          fixedHeight="h-[280px]"
        >
          {plansLies.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="Aucun plan activé"
              hint="Activez un plan PCA/PRA ou utilisez une suggestion IA"
              tone="cool"
            />
          ) : (
            <div className="space-y-1.5 overflow-y-auto pr-1 flex-1">
              {plansLies.map((p) => (
                <div
                  key={p.id}
                  className="flex items-start gap-2.5 px-2.5 py-2 rounded-md transition-colors hover:bg-[#F6F8FA] group"
                >
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-md flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: "#EDF2F7" }}
                  >
                    <Layers className="h-3 w-3" style={{ color: "#38536F" }} />
                  </span>
                  <p
                    className="flex-1 min-w-0 text-[12px] leading-snug font-medium truncate"
                    style={{ color: COLORS.navy }}
                  >
                    {p.libelle || plans.find((x) => x.id === p.plan_id)?.titre || "Plan référencé"}
                  </p>
                  {!isClosed && (
                    <button
                      onClick={() => removePlan(p.id)}
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: COLORS.navy + "40" }}
                      title="Retirer ce plan"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </SideBlock>

        {/* Communication */}
        <SideBlock
          number="05"
          icon={Megaphone}
          title="Communication"
          count={communications.length}
          onAdd={() => {
            setNewComm({ objet: "", message: "", type: "Interne" });
            setCommDialog(true);
          }}
          addDisabled={isClosed}
          addTitle="Rédiger une communication"
          tone="rose"
          fixedHeight="h-[280px]"
        >
          {communications.length === 0 ? (
            <div className="flex-1 overflow-y-auto">
              <EmptyState
                icon={Megaphone}
                title="Aucune communication"
                hint="Rédigez un message pour vos parties prenantes"
                tone="rose"
              />
              {!isClosed && (
                <div className="pt-3 mt-1 border-t" style={{ borderColor: COLORS.border + "80" }}>
                  <p
                    className="text-[9.5px] font-semibold uppercase tracking-wider text-center mb-2"
                    style={{ color: COLORS.navy + "45" }}
                  >
                    Créer un message
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {COMM_TYPES.map((t) => {
                      const style = COMM_TYPE_STYLE[t];
                      return (
                        <button
                          key={t}
                          onClick={() => {
                            setNewComm({ objet: "", message: "", type: t });
                            setCommDialog(true);
                          }}
                          className="h-8 rounded-md text-[10.5px] font-medium border transition-all hover:shadow-sm hover:-translate-y-0.5 flex items-center justify-center"
                          style={{
                            borderColor: style.text + "40",
                            color: style.text,
                            backgroundColor: style.bg,
                          }}
                        >
                          <Plus className="h-3 w-3 mr-0.5" />
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1.5 overflow-y-auto pr-1 flex-1">
              {communications.map((c) => {
                const statutStyle =
                  c.statut === "Envoyé" ? { bg: "#E8F5E9", text: COLORS.forest } :
                  c.statut === "Validé" ? { bg: "#FFF3E0", text: "#B76E1D" } :
                  { bg: "#F1EFE8", text: COLORS.navy + "70" };
                const typeStyle = c.type ? COMM_TYPE_STYLE[c.type] : null;
                return (
                  <div
                    key={c.id}
                    className="px-2.5 py-2 rounded-md transition-colors hover:bg-[#FDF6F5]"
                  >
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      {typeStyle && (
                        <span
                          className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: typeStyle.bg, color: typeStyle.text }}
                        >
                          {c.type}
                        </span>
                      )}
                      <span
                        className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: statutStyle.bg, color: statutStyle.text }}
                      >
                        {c.statut}
                      </span>
                    </div>
                    <p className="text-[12px] font-medium leading-snug truncate" style={{ color: COLORS.navy }}>
                      {c.objet}
                    </p>
                    {!isClosed && (c.statut === "Brouillon" || c.statut === "Validé") && (
                      <button
                        onClick={() => setCommunicationStatut(c, c.statut === "Brouillon" ? "Validé" : "Envoyé")}
                        className="text-[10px] mt-1 font-medium hover:underline"
                        style={{ color: COLORS.forest }}
                      >
                        {c.statut === "Brouillon" ? "Marquer comme validé" : "Marquer comme envoyé"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SideBlock>
      </div>

      {/* ============================================================
          RETEX — padding resserré
          ============================================================ */}
      <div
        className="rounded-2xl overflow-hidden bg-white"
        style={{
          border: `1px solid ${COLORS.border}`,
          boxShadow: "0 1px 2px rgba(23,32,48,0.04)",
        }}
      >
        <div
          className="px-4 py-3 border-b flex items-center gap-2.5"
          style={{ borderColor: COLORS.border + "99", backgroundColor: "#FCFBF8" }}
        >
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ backgroundColor: COLORS.forest + "15" }}
          >
            <FileText className="h-3.5 w-3.5" style={{ color: COLORS.forest }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3
              className="text-[13.5px] font-semibold leading-tight"
              style={{ color: COLORS.navy, fontFamily: "'Playfair Display', serif" }}
            >
              RETEX · Retour d'expérience
            </h3>
            <p className="text-[10px] leading-tight mt-0.5" style={{ color: COLORS.navy + "55" }}>
              Analyse post-crise requise avant clôture
            </p>
          </div>
          {hasRetex ? (
            <Badge
              className="text-[10px] border-0 font-semibold"
              style={{ backgroundColor: "#E8F5E9", color: COLORS.forest }}
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Enregistré
            </Badge>
          ) : (
            <Badge
              className="text-[10px] border-0 font-semibold"
              style={{ backgroundColor: sev.bg, color: sev.text }}
            >
              <AlertTriangle className="h-3 w-3 mr-1" />
              Requis
            </Badge>
          )}
        </div>

        <div className="p-4">
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-medium" style={{ color: COLORS.navy + "80" }}>
                Progression du RETEX
              </span>
              <span
                className="text-[12px] font-bold tabular-nums"
                style={{
                  color: retexProgress === 100 ? COLORS.forest : retexProgress > 0 ? "#B76E1D" : COLORS.navy + "50",
                  fontFamily: "'Playfair Display', serif",
                }}
              >
                {retexProgress}%
              </span>
            </div>
            <div
              className="h-1.5 rounded-full overflow-hidden"
              style={{ backgroundColor: COLORS.border + "70" }}
            >
              <div
                className="h-full transition-all duration-500 rounded-full"
                style={{
                  width: `${retexProgress}%`,
                  backgroundColor: retexProgress === 100 ? COLORS.forest : retexProgress > 0 ? "#B76E1D" : COLORS.navy + "40",
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
            {[
              { key: "resume", label: "Résumé de la crise", num: "1" },
              { key: "causes_racines", label: "Causes racines", num: "2" },
              { key: "points_amelioration", label: "Points d'amélioration", num: "3" },
              { key: "actions_correctives", label: "Actions correctives", num: "4" },
            ].map((f) => {
              const value = (retex as any)?.[f.key] || "";
              const filled = value.trim().length > 0;
              return (
                <div
                  key={f.key}
                  className="p-2.5 rounded-lg flex items-start gap-2"
                  style={{
                    backgroundColor: filled ? "#F0F5F0" : "#FAFAF9",
                    border: `1px solid ${filled ? COLORS.forest + "33" : COLORS.border}`,
                  }}
                >
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold flex-shrink-0 mt-0.5"
                    style={{
                      backgroundColor: filled ? COLORS.forest : COLORS.border,
                      color: filled ? "#FFFFFF" : COLORS.navy + "60",
                    }}
                  >
                    {filled ? <Check className="h-3 w-3" /> : f.num}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: filled ? COLORS.forest : COLORS.navy + "70" }}
                    >
                      {f.label}
                    </p>
                    <p className="text-[11.5px] mt-0.5 line-clamp-2" style={{ color: COLORS.navy }}>
                      {filled ? value : <em style={{ color: COLORS.navy + "40" }}>Non renseigné</em>}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className="flex flex-col md:flex-row md:items-center gap-3 pt-3 border-t"
            style={{ borderColor: COLORS.border }}
          >
            <div className="flex-1 flex items-start gap-2.5">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0"
                style={{ backgroundColor: hasRetex ? "#E8F5E9" : sev.bg }}
              >
                {hasRetex ? (
                  <CheckCircle2 className="h-3.5 w-3.5" style={{ color: COLORS.forest }} />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5" style={{ color: sev.text }} />
                )}
              </div>
              <div>
                <p className="text-[12.5px] font-medium" style={{ color: COLORS.navy }}>
                  {hasRetex ? "Le RETEX est prêt" : "RETEX requis avant clôture"}
                </p>
                <p className="text-[10.5px] mt-0.5" style={{ color: COLORS.navy + "70" }}>
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
                  className="h-8"
                  style={{ borderColor: COLORS.forest, color: COLORS.forest }}
                >
                  <Edit3 className="h-3.5 w-3.5 mr-1.5" />
                  {hasRetex ? "Modifier" : "Remplir le RETEX"}
                </Button>
              )}
              <Button
                onClick={closeIncident}
                disabled={!hasRetex || isClosed || closing}
                title={!hasRetex ? "RETEX obligatoire avant clôture" : undefined}
                className="font-medium h-8"
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
        </div>
      </div>

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