// src/components/strategy/tabs/CatalogueTab.tsx
import { useMemo, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, Trash2, Pencil, Home, Building, Users, AlertTriangle, Database, ArrowRight, Shield, Lightbulb } from "lucide-react";
import { toast } from "@/hooks/use-toast";
// 🔥 AJOUT DE L'IMPORT CN ICI
import { cn } from "@/lib/utils"; 
import { supabase } from "@/integrations/resillia/client";
import { StrategyData } from "../useStrategyData";

// Map des icônes
const ICON_MAP: Record<string, any> = {
  Home, Building, Users, AlertTriangle, Database, ArrowRight,
};
const ICON_LIST = ["Home", "Building", "Users", "AlertTriangle", "Database", "ArrowRight"];

export const CatalogueTab = ({ data }: { data: StrategyData }) => {
  // 🔥 On récupère risques via data (passé par StrategyModule), ou on fait un fetch local si pas présent
  const { 
    catalogue, 
    associations, 
    addStrategie, 
    deleteStrategie,
    actionPlans = [],
    loadingActions = false,
    risques: externalRisks = []
  } = data;
  
  const [open, setOpen] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  
  // Formulaire d'ajout
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [iconName, setIconName] = useState<string>("Home");
  const [saving, setSaving] = useState(false);

  // Formulaire d'édition
  const [editId, setEditId] = useState<string | null>(null);
  const [editNom, setEditNom] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIconName, setEditIconName] = useState<string>("Home");

  // 🔥 ÉTAT LOCAL POUR LES RISQUES (au cas où data.risques ne soit pas passé)
  const [localRisks, setLocalRisks] = useState<any[]>(externalRisks);
  
  useEffect(() => {
    if (externalRisks.length === 0) {
      // Si le parent n'a pas passé les risques, on les charge ici
      const fetchRisks = async () => {
        const { data, error } = await supabase
          .from("risques")
          .select("id, title");
        if (error) {
          console.error("Erreur chargement risques:", error);
        } else {
          setLocalRisks(data || []);
        }
      };
      fetchRisks();
    } else {
      setLocalRisks(externalRisks);
    }
  }, [externalRisks]);

  // 🔥 MAP POUR RÉSOUDRE LES TITRES DES RISQUES
  const riskById = useMemo(() => {
    return Object.fromEntries(localRisks.map((r) => [r.id, r]));
  }, [localRisks]);

  // ============================================================
  // LOGIQUE DE COMPTAGE
  // ============================================================
  
  // 1. Comptage des processus
  const processCounts = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    associations.forEach((a) => {
      if (!m[a.strategie_id]) m[a.strategie_id] = new Set();
      m[a.strategie_id].add(a.processus_id);
    });
    return m;
  }, [associations]);

  // 2. Comptage des Actions
  const actionCounts = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    const risksByStrategy: Record<string, Set<string>> = {};
    associations.forEach((a) => {
      if (a.scenario_id) {
        if (!risksByStrategy[a.strategie_id]) risksByStrategy[a.strategie_id] = new Set();
        risksByStrategy[a.strategie_id].add(a.scenario_id);
      }
    });
    Object.entries(risksByStrategy).forEach(([strategyId, riskIds]) => {
      const foundActions = actionPlans.filter(p => riskIds.has(p.risque_id));
      foundActions.forEach(action => {
        if (!m[strategyId]) m[strategyId] = new Set();
        m[strategyId].add(action.id);
      });
    });
    return m;
  }, [associations, actionPlans]);

  // 🔥 Calcul des actions orphelines (pour la section Suggestions)
  const unsuggestedActions = useMemo(() => {
    const linkedActionIds = new Set<string>();
    Object.values(actionCounts).forEach((actionSet) => {
      actionSet.forEach((id) => linkedActionIds.add(id));
    });
    return actionPlans.filter(action => !linkedActionIds.has(action.id));
  }, [actionPlans, actionCounts]);

  // Gestion de l'expansion
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const MAX_SUGGESTIONS = 4;
  const displayedSuggestions = showAllSuggestions 
    ? unsuggestedActions 
    : unsuggestedActions.slice(0, MAX_SUGGESTIONS);
  const remainingCount = unsuggestedActions.length - MAX_SUGGESTIONS;

  // ============================================================
  // CRUD
  // ============================================================
  const submitAdd = async () => {
    if (!nom.trim()) return;
    setSaving(true);
    const ok = await addStrategie({ 
      nom: nom.trim(), 
      description: description.trim() || null,
      type: iconName
    });
    setSaving(false);
    if (ok) {
      setOpen(false);
      setNom("");
      setDescription("");
      setIconName("Home");
    }
  };

  const openEditDialog = (s: any) => {
    setEditId(s.id);
    setEditNom(s.nom);
    setEditDescription(s.description || "");
    setEditIconName(s.type || "Home");
    setOpenEdit(true);
  };

  const submitEdit = async () => {
    if (!editId || !editNom.trim()) return;
    setSaving(true);
    const ok = await addStrategie({ 
      id: editId,
      nom: editNom.trim(), 
      description: editDescription.trim() || null,
      type: editIconName
    });
    setSaving(false);
    if (ok) {
      setOpenEdit(false);
      setEditId(null);
      toast({ title: "Stratégie modifiée", description: "Les changements ont été enregistrés." });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Voulez-vous vraiment supprimer l'option "${name}" ?`)) return;
    const ok = await deleteStrategie(id);
    if (ok) {
      toast({ title: "Option supprimée", description: `"${name}" a été retirée.` });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          {/* 🔥 RENOMMAGE EN "Catalogue des options" */}
          <h3 className="font-serif text-xl font-bold text-[#172030]">Catalogue des options</h3>
          <p className="text-sm text-[#172030]/60">Options de stratégie génériques et personnalisées disponibles.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-[#2A5141] hover:bg-[#1F3E32] text-white shadow-sm">
          <Plus className="h-4 w-4 mr-2" /> Nouvelle option
        </Button>
      </div>

      {/* ============================================================
          SECTION SUGGESTIONS (REDESIGNÉE)
          ============================================================ */}
      {!loadingActions && unsuggestedActions.length > 0 && (
        <Card className="border-0 shadow-sm bg-[#F8F6F2] rounded-xl overflow-hidden border-l-4 border-l-[#2A5141]">
          <CardContent className="p-5">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8F0EC] flex-shrink-0">
                <Lightbulb className="h-5 w-5 text-[#2A5141]" />
              </div>
              <div className="space-y-1">
                <h4 className="font-serif text-[#172030] font-bold">Suggestions — actions sans option associée</h4>
                <p className="text-sm text-[#172030]/60">
                  Ces actions de traitement des risques n'ont pas encore d'option de continuité associée. Créez-en une pour formaliser votre plan de réponse.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {displayedSuggestions.map((act) => {
                // 🔥 RÉSOLUTION DU NOM DU RISQUE
                const risk = riskById[act.risque_id];
                const riskTitle = risk?.title || "—";

                // 🔥 STYLE DU BADGE D'AVANCEMENT
                const badgeStyle = act.avancement === 100 
                  ? { bg: "#E8F5E9", text: "#2E7D32" } 
                  : act.avancement > 0 
                  ? { bg: "#FFF8E1", text: "#A38730" } 
                  : { bg: "#F1EFEA", text: "#6C7A8A" };

                return (
                  <div key={act.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white rounded-lg border border-[#E5E2DD] gap-3">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm text-[#172030] block">{act.mesure}</span>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-[#172030]/60">
                        {/* Badge Statut */}
                        <span className="bg-[#F1EFEA] text-[#444441] px-2 py-0.5 rounded-full">
                          {act.statut || "À faire"}
                        </span>
                        <span className="text-[#E5E2DD]">·</span>
                        {/* Badge Avancement */}
                        <span className={cn("px-2 py-0.5 rounded-full", badgeStyle.bg, `text-[${badgeStyle.text}]`)}>
                          {act.avancement || 0}%
                        </span>
                        <span className="text-[#E5E2DD]">·</span>
                        {/* Risque associé */}
                        <span className="text-[#172030]/60">
                          Risque : <span className="font-medium text-[#172030]">{riskTitle}</span>
                        </span>
                      </div>
                    </div>
                    
                    {/* 🔥 BOUTON DISCRET (Outline) */}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="border-[#2A5141] text-[#2A5141] hover:bg-[#F8F6F2] flex-shrink-0 h-8"
                      onClick={() => {
                        setNom(`Option pour : ${act.mesure}`);
                        setDescription(`Créée à partir de l'action du plan de traitement : "${act.mesure}"`);
                        setOpen(true);
                      }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1.5" /> Créer une option
                    </Button>
                  </div>
                );
              })}
            </div>

            {/* Bouton pour voir plus */}
            {unsuggestedActions.length > MAX_SUGGESTIONS && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="mt-3 text-[#2A5141] hover:text-[#1F3E32] hover:bg-[#E8F0EC]"
                onClick={() => setShowAllSuggestions(!showAllSuggestions)}
              >
                {showAllSuggestions 
                  ? "Réduire la liste" 
                  : `+ ${remainingCount} autre${remainingCount > 1 ? 's' : ''} action${remainingCount > 1 ? 's' : ''} sans option`
                }
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* ============================================================
          GRILLE DES OPTIONS (CARTES REDESIGNÉES)
          ============================================================ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {catalogue.map((s) => {
          // 🔥 Si 's.type' existe, on affiche son icône. Sinon, icône par défaut "Home".
          const Icon = ICON_MAP[s.type as string] || Home; 
          const processCount = processCounts[s.id]?.size ?? 0;
          const actionCount = actionCounts[s.id]?.size ?? 0;
          
          const linkedRiskIds = associations
            .filter(a => a.strategie_id === s.id && a.scenario_id)
            .map(a => a.scenario_id);
          const actionsForPopover = actionPlans.filter(p => linkedRiskIds.includes(p.risque_id));
          
          return (
            <Card 
              key={s.id} 
              // 🔥 EFFET DE SURVOL AVEC BORDURE ET OMBRE
              className="border border-[#E5E2DD] shadow-sm bg-white rounded-xl relative group transition-all duration-200 hover:shadow-md hover:border-[#2A5141]"
            >
              <CardContent className="p-5 flex flex-col h-full gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E8F0EC]">
                      <Icon className="h-4 w-4 text-[#2A5141]" />
                    </span>
                    <div>
                      <p className="font-serif font-bold text-[#172030] leading-tight">{s.nom}</p>
                      {/* 🔥 SOUS-TITRE PLUS DISCRET */}
                      <p className="text-[10px] uppercase tracking-wider text-[#172030]/30 mt-0.5">{s.type || "Générique"}</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEditDialog(s)} className="p-1 text-[#172030]/30 hover:text-[#2A5141] transition-colors">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(s.id, s.nom)} className="p-1 text-[#172030]/30 hover:text-[#B91C1C] transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                <p className="text-sm text-[#172030]/60 flex-1">{s.description}</p>
                
                <div className="flex flex-wrap items-center gap-2 mt-auto">
                  {/* 🔥 BADGE PROCESSUS (Harmonisé) */}
                  <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium bg-[#F1EFEA] text-[#172030]">
                    {processCount} processus lié{processCount > 1 ? "s" : ""}
                  </span>
                  
                  {/* Badge Actions liées (existant) */}
                  {loadingActions ? (
                    <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium bg-[#F8F6F2] text-[#172030]/30 animate-pulse">
                      Chargement...
                    </span>
                  ) : actionCount > 0 ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button 
                          variant="secondary" 
                          className="h-6 rounded-full px-2.5 py-1 text-xs font-medium bg-[#E5F0EB] text-[#1F4E39] hover:bg-[#C0D8CF] transition-colors gap-1"
                        >
                          <Shield className="h-3 w-3" />
                          {actionCount} action{actionCount > 1 ? "s" : ""} liée{actionCount > 1 ? "s" : ""}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-0 border-[#E5E2DD] bg-white shadow-lg rounded-xl overflow-hidden">
                        <div className="p-3 border-b border-[#E5E2DD] bg-[#F8F6F2]">
                          <p className="text-xs font-semibold text-[#172030] font-sans uppercase tracking-wider">Actions du plan de traitement</p>
                          <p className="text-[10px] text-[#172030]/40 mt-0.5">Liées aux risques de cette option</p>
                        </div>
                        <div className="max-h-[200px] overflow-y-auto p-2 space-y-1.5">
                          {actionsForPopover.length === 0 ? (
                            <div className="p-3 text-center text-xs text-[#172030]/40">Aucune action trouvée.</div>
                          ) : (
                            actionsForPopover.map((act) => (
                              <div key={act.id} className="flex flex-col p-2.5 rounded-lg hover:bg-[#F8F6F2] border border-transparent hover:border-[#E5E2DD] transition-colors">
                                <div className="flex items-start justify-between gap-2">
                                  <span className="text-sm font-medium text-[#172030] flex-1 leading-tight">{act.mesure}</span>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                                      act.avancement === 100 ? "bg-[#E8F5E9] text-[#2E7D32]" :
                                      act.avancement > 0 ? "bg-[#FFF8E1] text-[#A38730]" :
                                      "bg-[#F1EFEA] text-[#6C7A8A]"
                                    }`}>
                                      {act.avancement || 0}%
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-[10px] text-[#172030]/50">
                                  <span className="flex items-center gap-1">{act.responsable || "—"}</span>
                                  <span className="w-1 h-1 rounded-full bg-[#E5E2DD]" />
                                  <span className="flex items-center gap-1">{act.statut || "À faire"}</span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Dialogue d'ajout */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-[#172030]">Nouvelle option</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nom</Label>
              <Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex : Cellule de crise délocalisée" />
            </div>
            <div>
              <Label>Icône</Label>
              <Select value={iconName} onValueChange={setIconName}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ICON_LIST.map((icon) => (
                    <SelectItem key={icon} value={icon}>{icon}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={submitAdd} disabled={saving || !nom.trim()} className="bg-[#2A5141] hover:bg-[#1F3E32] text-white">
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue d'édition */}
      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-[#172030]">Modifier l'option</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nom</Label>
              <Input value={editNom} onChange={(e) => setEditNom(e.target.value)} />
            </div>
            <div>
              <Label>Icône</Label>
              <Select value={editIconName} onValueChange={setEditIconName}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ICON_LIST.map((icon) => (
                    <SelectItem key={icon} value={icon}>{icon}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenEdit(false)}>Annuler</Button>
            <Button onClick={submitEdit} disabled={saving || !editNom.trim()} className="bg-[#2A5141] hover:bg-[#1F3E32] text-white">
              Enregistrer les modifications
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};