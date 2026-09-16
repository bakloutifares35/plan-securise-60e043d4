// src/components/warroom/WarRoomView.tsx — Interface centrale de la war room (4 zones)
import { useState } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  RESILLIA, SEVERITE_COLORS, ENTRY_TYPES, ENTRY_TYPE_COLORS,
  formatDateTime, elapsedSince,
  type Incident, type MainCouranteEntry, type IncidentAction,
  type IncidentPlan, type IncidentCommunication, type Retex,
  type EntryType, type ActionStatut, type CommStatut, type PlanLite,
} from "./types";

export const WarRoomView = ({
  incident,
  entries,
  actions,
  plansLies,
  communications,
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
  retex: Retex | null;
  plansModuleAvailable: boolean;
  plans: PlanLite[];
  processCount: number;
  currentUser?: string;
  onBack: () => void;
  onOpenRetex: () => void;
  onOpenTimeline: () => void;
  addEntry: (p: Partial<MainCouranteEntry>) => Promise<boolean>;
  addAction: (p: Partial<IncidentAction>) => Promise<boolean>;
  setActionStatut: (a: IncidentAction, s: ActionStatut) => Promise<void>;
  addPlan: (p: { plan_id?: string | null; libelle?: string | null }) => Promise<boolean>;
  removePlan: (id: string) => Promise<void>;
  addCommunication: (p: Partial<IncidentCommunication>) => Promise<boolean>;
  setCommunicationStatut: (c: IncidentCommunication, s: CommStatut) => Promise<void>;
  updateIncident: (id: string, p: Partial<Incident>) => Promise<boolean>;
  reload: () => Promise<void>;
}) => {
  const sevColor = SEVERITE_COLORS[incident.niveau_severite];
  const isClosed = incident.statut === "Clôturé";
  const hasRetex = !!retex?.id && !!retex.resume?.trim();

  // ===== Main courante =====
  const [mcType, setMcType] = useState<EntryType>("Information");
  const [mcContenu, setMcContenu] = useState("");
  const [mcAuteur, setMcAuteur] = useState(currentUser || "");
  const [mcSubmitting, setMcSubmitting] = useState(false);

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

  // ===== Actions =====
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
    const next: ActionStatut = a.statut === "À faire" ? "En cours" : a.statut === "En cours" ? "Fait" : "À faire";
    await setActionStatut(a, next);
  };

  // ===== Plans =====
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

  // ===== Communications =====
  const [commDialog, setCommDialog] = useState(false);
  const [newComm, setNewComm] = useState({ objet: "", message: "" });

  const submitComm = async () => {
    if (!newComm.objet.trim() || !newComm.message.trim()) return;
    const ok = await addCommunication({
      objet: newComm.objet.trim(),
      message: newComm.message.trim(),
      statut: "Brouillon",
      auteur: currentUser || null,
    });
    if (ok) {
      setNewComm({ objet: "", message: "" });
      setCommDialog(false);
    }
  };

  // ===== Clôture =====
  const [closing, setClosing] = useState(false);
  const closeIncident = async () => {
    if (!hasRetex) {
      toast({
        title: "RETEX obligatoire",
        description: "Vous devez enregistrer le RETEX avant de pouvoir clôturer cet incident.",
        variant: "destructive",
      });
      return;
    }
    if (!confirm("Confirmer la clôture de cet incident ? Cette action est définitive.")) return;
    setClosing(true);
    await updateIncident(incident.id, {
      statut: "Clôturé",
      date_heure_fin: new Date().toISOString(),
    });
    setClosing(false);
    await reload();
  };

  return (
    <div className="space-y-5">
      {/* Bandeau crise */}
      <div
        className="rounded-lg p-4 flex flex-col md:flex-row md:items-center gap-4"
        style={{ backgroundColor: RESILLIA.navy, borderLeft: `6px solid ${sevColor}` }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="self-start text-white/80 hover:text-white hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Retour
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center justify-center h-9 w-9 rounded-full font-bold text-white text-xs"
              style={{ backgroundColor: sevColor }}
            >
              {incident.niveau_severite}
            </span>
            <span className="text-white font-semibold text-lg truncate">{incident.titre}</span>
            <Badge variant="outline" className="text-[10px] border-white/30 text-white/90">
              {incident.statut}
            </Badge>
          </div>
          <div className="flex items-center gap-4 mt-1.5 text-xs flex-wrap" style={{ color: "rgba(255,255,255,0.75)" }}>
            {incident.type && <span>{incident.type}</span>}
            <span>Déclaré il y a {elapsedSince(incident.date_heure_debut)}</span>
            {incident.declarant && <span>Par {incident.declarant}</span>}
            <span>{processCount} processus impacté{processCount > 1 ? "s" : ""}</span>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenTimeline}
            className="border-white/30 text-white hover:bg-white/10"
          >
            <Clock className="h-3.5 w-3.5 mr-1" /> Timeline
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenRetex}
            className="border-white/30 text-white hover:bg-white/10"
          >
            <FileText className="h-3.5 w-3.5 mr-1" /> {retex?.id ? "Modifier RETEX" : "RETEX"}
          </Button>
        </div>
      </div>

      {/* Grille 2x2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 1. Main courante */}
        <Card className="lg:col-span-2" style={{ backgroundColor: "#FFF", borderColor: RESILLIA.border }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2" style={{ color: RESILLIA.navy, fontFamily: "'Playfair Display', serif" }}>
              <MessageSquare className="h-4 w-4" style={{ color: RESILLIA.forest }} />
              Main courante
              <span className="text-xs font-normal ml-auto" style={{ color: RESILLIA.navy + "70" }}>
                {entries.length} entrée{entries.length > 1 ? "s" : ""} · audit trail immuable
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {entries.length === 0 ? (
                <p className="text-sm italic text-center py-4" style={{ color: RESILLIA.navy + "60" }}>
                  Aucune entrée pour l'instant
                </p>
              ) : (
                entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-3 p-3 rounded-lg border"
                    style={{ borderColor: RESILLIA.border, backgroundColor: RESILLIA.cream }}
                  >
                    <div className="text-xs whitespace-nowrap font-mono pt-0.5" style={{ color: RESILLIA.navy + "90" }}>
                      {formatDateTime(entry.horodatage)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          className="text-[10px] border-0 text-white"
                          style={{ backgroundColor: ENTRY_TYPE_COLORS[entry.type] }}
                        >
                          {entry.type}
                        </Badge>
                        {entry.auteur && (
                          <span className="text-xs font-medium" style={{ color: RESILLIA.navy }}>
                            {entry.auteur}
                          </span>
                        )}
                      </div>
                      <p className="text-sm mt-1 whitespace-pre-wrap break-words" style={{ color: RESILLIA.navy }}>
                        {entry.contenu}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {!isClosed && (
              <div className="mt-4 pt-4 border-t space-y-2" style={{ borderColor: RESILLIA.border }}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Select value={mcType} onValueChange={(v) => setMcType(v as EntryType)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ENTRY_TYPES.map((t) => (
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
                  placeholder="Nouvelle entrée (décision, action, information, communication)…"
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
                    style={{ backgroundColor: RESILLIA.forest, color: "white" }}
                  >
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                    Ajouter
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2. Actions */}
        <Card style={{ backgroundColor: "#FFF", borderColor: RESILLIA.border }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2" style={{ color: RESILLIA.navy, fontFamily: "'Playfair Display', serif" }}>
              <Target className="h-4 w-4" style={{ color: RESILLIA.forest }} />
              Actions en cours
              <Button
                size="sm"
                variant="outline"
                className="ml-auto h-7 text-xs"
                style={{ borderColor: RESILLIA.forest, color: RESILLIA.forest }}
                onClick={() => setActionDialog(true)}
                disabled={isClosed}
              >
                <Plus className="h-3 w-3 mr-1" /> Ajouter
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {actions.length === 0 ? (
              <p className="text-sm italic text-center py-4" style={{ color: RESILLIA.navy + "60" }}>
                Aucune action
              </p>
            ) : (
              <div className="space-y-2">
                {actions.map((a) => {
                  const isDone = a.statut === "Fait";
                  return (
                    <div
                      key={a.id}
                      className="flex items-start gap-3 p-2.5 rounded-lg border"
                      style={{ borderColor: RESILLIA.border, opacity: isDone ? 0.55 : 1 }}
                    >
                      <button
                        onClick={() => !isClosed && cycleAction(a)}
                        disabled={isClosed}
                        className="mt-0.5 flex-shrink-0"
                        title="Faire avancer le statut"
                      >
                        {isDone
                          ? <CheckCircle2 className="h-5 w-5" style={{ color: RESILLIA.forest }} />
                          : <Circle className="h-5 w-5" style={{ color: RESILLIA.navy + "50" }} />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm", isDone && "line-through")} style={{ color: RESILLIA.navy }}>
                          {a.description}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-[11px] flex-wrap" style={{ color: RESILLIA.navy + "80" }}>
                          {a.responsable && <span>👤 {a.responsable}</span>}
                          {a.echeance && (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {formatDateTime(a.echeance)}
                            </span>
                          )}
                          <Badge variant="outline" className="text-[9px]" style={{ borderColor: RESILLIA.border }}>
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

        {/* 3. Plans activés */}
        <Card style={{ backgroundColor: "#FFF", borderColor: RESILLIA.border }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2" style={{ color: RESILLIA.navy, fontFamily: "'Playfair Display', serif" }}>
              <Layers className="h-4 w-4" style={{ color: RESILLIA.forest }} />
              Plans activés
              <Button
                size="sm"
                variant="outline"
                className="ml-auto h-7 text-xs"
                style={{ borderColor: RESILLIA.forest, color: RESILLIA.forest }}
                onClick={() => setPlanDialog(true)}
                disabled={isClosed}
              >
                <Plus className="h-3 w-3 mr-1" /> Ajouter
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {plansLies.length === 0 ? (
              <p className="text-sm italic text-center py-4" style={{ color: RESILLIA.navy + "60" }}>
                Aucun plan activé
              </p>
            ) : (
              <div className="space-y-2">
                {plansLies.map((p) => (
                  <div
                    key={p.id}
                    className="p-2.5 rounded-lg border flex items-start justify-between gap-2"
                    style={{ borderColor: RESILLIA.border, backgroundColor: RESILLIA.cream }}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium" style={{ color: RESILLIA.navy }}>
                        {p.libelle || plans.find((x) => x.id === p.plan_id)?.titre || "Plan référencé"}
                      </p>
                      {p.plan_id && (
                        <p className="text-[10px] mt-0.5" style={{ color: RESILLIA.navy + "60" }}>
                          Référence M5 · {p.plan_id}
                        </p>
                      )}
                    </div>
                    {!isClosed && (
                      <button
                        onClick={() => removePlan(p.id)}
                        className="text-red-400 hover:text-red-600 flex-shrink-0"
                        title="Retirer ce plan"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 4. Communication */}
        <Card className="lg:col-span-2" style={{ backgroundColor: "#FFF", borderColor: RESILLIA.border }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2" style={{ color: RESILLIA.navy, fontFamily: "'Playfair Display', serif" }}>
              <Megaphone className="h-4 w-4" style={{ color: RESILLIA.forest }} />
              Communication de crise
              <Button
                size="sm"
                variant="outline"
                className="ml-auto h-7 text-xs"
                style={{ borderColor: RESILLIA.forest, color: RESILLIA.forest }}
                onClick={() => setCommDialog(true)}
                disabled={isClosed}
              >
                <Plus className="h-3 w-3 mr-1" /> Rédiger
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {communications.length === 0 ? (
              <p className="text-sm italic text-center py-4" style={{ color: RESILLIA.navy + "60" }}>
                Aucune communication rédigée
              </p>
            ) : (
              <div className="space-y-2">
                {communications.map((c) => {
                  const statutColor =
                    c.statut === "Envoyé" ? RESILLIA.forest :
                    c.statut === "Validé" ? "#EF9F27" :
                    RESILLIA.navy + "60";
                  return (
                    <div
                      key={c.id}
                      className="p-3 rounded-lg border flex flex-col md:flex-row md:items-center gap-3"
                      style={{ borderColor: RESILLIA.border }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: RESILLIA.navy }}>{c.objet}</p>
                        {c.message && (
                          <p className="text-xs mt-0.5 line-clamp-2" style={{ color: RESILLIA.navy + "80" }}>
                            {c.message}
                          </p>
                        )}
                        <p className="text-[10px] mt-1" style={{ color: RESILLIA.navy + "60" }}>
                          {formatDateTime(c.created_at)}
                          {c.auteur && ` · ${c.auteur}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge className="text-[10px] border-0 text-white" style={{ backgroundColor: statutColor }}>
                          {c.statut}
                        </Badge>
                        {!isClosed && c.statut === "Brouillon" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setCommunicationStatut(c, "Validé")}>
                            Valider
                          </Button>
                        )}
                        {!isClosed && c.statut === "Validé" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setCommunicationStatut(c, "Envoyé")}>
                            Marquer envoyé
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Clôture */}
      <div
        className="flex flex-col md:flex-row md:items-center gap-3 p-4 rounded-lg border"
        style={{ borderColor: RESILLIA.border, backgroundColor: RESILLIA.cream }}
      >
        <div className="flex-1 flex items-start gap-2">
          {!hasRetex && <AlertTriangle className="h-4 w-4 mt-0.5" style={{ color: "#EF9F27" }} />}
          <div>
            <p className="text-sm font-medium" style={{ color: RESILLIA.navy }}>
              Clôture de l'incident
            </p>
            <p className="text-xs mt-0.5" style={{ color: RESILLIA.navy + "80" }}>
              {hasRetex
                ? "Le RETEX est enregistré — la clôture est possible."
                : "Le RETEX doit être rempli et enregistré avant de pouvoir clôturer."}
            </p>
          </div>
        </div>
        <Button
          onClick={closeIncident}
          disabled={!hasRetex || isClosed || closing}
          title={!hasRetex ? "RETEX obligatoire avant clôture" : undefined}
          className="font-medium"
          style={{
            backgroundColor: hasRetex && !isClosed ? RESILLIA.forest : RESILLIA.border,
            color: hasRetex && !isClosed ? "white" : RESILLIA.navy + "70",
            cursor: !hasRetex || isClosed ? "not-allowed" : "pointer",
          }}
        >
          {!hasRetex && <Lock className="h-3.5 w-3.5 mr-1.5" />}
          {isClosed ? "Incident clôturé" : "Clôturer la crise"}
        </Button>
      </div>

      {/* ===== Dialogs ===== */}
      <Dialog open={actionDialog} onOpenChange={setActionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle action</DialogTitle>
            <DialogDescription>Ajoutez une action à suivre dans cette crise.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Description *</Label>
              <Textarea
                rows={2}
                value={newAction.description}
                onChange={(e) => setNewAction({ ...newAction, description: e.target.value })}
                placeholder="Ex : Couper les flux réseau compromis"
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
              style={{ backgroundColor: RESILLIA.forest, color: "white" }}
            >
              Créer l'action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={planDialog} onOpenChange={setPlanDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Activer un plan</DialogTitle>
            <DialogDescription>
              {plansModuleAvailable
                ? "Sélectionnez un plan existant ou saisissez une référence libre."
                : "Le module Plans n'est pas disponible — saisissez une référence libre."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {plansModuleAvailable && plans.length > 0 && (
              <div>
                <Label>Plan du référentiel (optionnel)</Label>
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
              style={{ backgroundColor: RESILLIA.forest, color: "white" }}
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
            <DialogDescription>Rédigez un message de crise — il restera en brouillon jusqu'à validation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Objet *</Label>
              <Input
                value={newComm.objet}
                onChange={(e) => setNewComm({ ...newComm, objet: e.target.value })}
                placeholder="Ex : Information clientèle — incident SI"
              />
            </div>
            <div>
              <Label>Message *</Label>
              <Textarea
                rows={5}
                value={newComm.message}
                onChange={(e) => setNewComm({ ...newComm, message: e.target.value })}
                placeholder="Contenu du message…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommDialog(false)}>Annuler</Button>
            <Button
              onClick={submitComm}
              disabled={!newComm.objet.trim() || !newComm.message.trim()}
              style={{ backgroundColor: RESILLIA.forest, color: "white" }}
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