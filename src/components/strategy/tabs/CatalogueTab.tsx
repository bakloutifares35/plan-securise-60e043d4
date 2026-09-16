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
import {
  Plus, Trash2, Pencil, Home, Building, Users, AlertTriangle,
  Database, ArrowRight, Shield, Layers, Server, Handshake, Network,
  Sparkles,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/resillia/client";
import { StrategyData } from "../useStrategyData";

// ============================================================
// ICÔNES DISPONIBLES
// ============================================================
const ICON_MAP: Record<string, any> = {
  Home, Building, Users, AlertTriangle, Database, ArrowRight,
  Layers, Server, Handshake, Network,
};
const ICON_LIST = ["Home", "Building", "Users", "AlertTriangle", "Database", "ArrowRight", "Layers", "Server", "Handshake", "Network"];

export const CatalogueTab = ({ data }: { data: StrategyData }) => {
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
  
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [iconName, setIconName] = useState<string>("Home");
  const [saving, setSaving] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editNom, setEditNom] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIconName, setEditIconName] = useState<string>("Home");

  const [localRisks, setLocalRisks] = useState<any[]>(externalRisks);
  
  useEffect(() => {
    if (externalRisks.length === 0) {
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

  const riskById = useMemo(() => {
    return Object.fromEntries(localRisks.map((r) => [r.id, r]));
  }, [localRisks]);

  const processCounts = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    associations.forEach((a) => {
      if (!m[a.strategie_id]) m[a.strategie_id] = new Set();
      m[a.strategie_id].add(a.processus_id);
    });
    return m;
  }, [associations]);

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

  const unsuggestedActions = useMemo(() => {
    const linkedActionIds = new Set<string>();
    Object.values(actionCounts).forEach((actionSet) => {
      actionSet.forEach((id) => linkedActionIds.add(id));
    });
    return actionPlans.filter(action => !linkedActionIds.has(action.id));
  }, [actionPlans, actionCounts]);

  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const MAX_SUGGESTIONS = 4;
  const displayedSuggestions = showAllSuggestions 
    ? unsuggestedActions 
    : unsuggestedActions.slice(0, MAX_SUGGESTIONS);
  const remainingCount = unsuggestedActions.length - MAX_SUGGESTIONS;

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

  const getIndexLabel = (index: number) => String(index + 1).padStart(2, "0");

  return (
    <div className="space-y-5">
      {/* ===== HEADER ===== */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-serif text-xl font-bold text-[#172030]">Catalogue des options</h3>
          <p className="text-sm text-[#172030]/60">
            Options de stratégie génériques et personnalisées disponibles.
          </p>
        </div>
        <Button 
          onClick={() => setOpen(true)} 
          className="bg-[#2A5141] hover:bg-[#1F3E32] text-white shadow-sm"
        >
          <Plus className="h-4 w-4 mr-2" /> Nouvelle option
        </Button>
      </div>

      {/* ============================================================
          SECTION SUGGESTIONS — sans bordure latérale
          ============================================================ */}
      {!loadingActions && unsuggestedActions.length > 0 && (
        <Card 
          className="border-0 shadow-sm rounded-xl"
          style={{ backgroundColor: "#FBF9F5" }}
        >
          <CardContent className="p-5">
            {/* Header de la section */}
            <div className="flex items-start gap-3 mb-4">
              <div 
                className="flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0"
                style={{ backgroundColor: "#F8E8DC" }}
              >
                <Sparkles className="h-4 w-4" style={{ color: "#D97846" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-serif text-[#172030] font-bold text-base">
                    Suggestions
                  </h4>
                  <span 
                    className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
                    style={{ backgroundColor: "#F8E8DC", color: "#A85A2E" }}
                  >
                    {unsuggestedActions.length} action{unsuggestedActions.length > 1 ? "s" : ""}
                  </span>
                </div>
                <p className="text-sm text-[#172030]/60 mt-1">
                  Ces actions de traitement des risques n'ont pas encore d'option de continuité associée.
                </p>
              </div>
            </div>

            {/* Liste des suggestions */}
            <div className="space-y-1.5">
              {displayedSuggestions.map((act) => {
                const risk = riskById[act.risque_id];
                const riskTitle = risk?.title || "—";

                const statusInfo = act.avancement === 100 
                  ? { label: "Terminé", color: "#2E7D32", dot: "#2E7D32" }
                  : act.avancement > 0 
                  ? { label: act.statut || "En cours", color: "#A38730", dot: "#F5D061" }
                  : { label: act.statut || "À faire", color: "#6C7A8A", dot: "#9AA6B2" };

                return (
                  <div 
                    key={act.id} 
                    className="flex flex-col sm:flex-row sm:items-center justify-between px-3 py-2.5 bg-white rounded-lg gap-3 hover:bg-[#FDFCFA] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm text-[#172030] block truncate">
                        {act.mesure}
                      </span>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-[#172030]/60">
                        <span className="inline-flex items-center gap-1.5">
                          <span 
                            className="w-1.5 h-1.5 rounded-full" 
                            style={{ backgroundColor: statusInfo.dot }} 
                          />
                          <span style={{ color: statusInfo.color }} className="font-medium">
                            {statusInfo.label}
                          </span>
                        </span>
                        <span className="text-[#E5E2DD]">·</span>
                        <span className="font-mono" style={{ color: statusInfo.color }}>
                          {act.avancement || 0}%
                        </span>
                        <span className="text-[#E5E2DD]">·</span>
                        <span className="text-[#172030]/60">
                          Risque : <span className="font-medium text-[#172030]">{riskTitle}</span>
                        </span>
                      </div>
                    </div>
                    
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="flex-shrink-0 h-8 text-[#D97846] hover:text-[#A85A2E] hover:bg-[#F8E8DC]"
                      onClick={() => {
                        setNom(`Option pour : ${act.mesure}`);
                        setDescription(`Créée à partir de l'action du plan de traitement : "${act.mesure}"`);
                        setOpen(true);
                      }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Créer
                    </Button>
                  </div>
                );
              })}
            </div>

            {unsuggestedActions.length > MAX_SUGGESTIONS && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="mt-2 text-[#D97846] hover:text-[#A85A2E] hover:bg-[#F8E8DC] text-xs"
                onClick={() => setShowAllSuggestions(!showAllSuggestions)}
              >
                {showAllSuggestions 
                  ? "Réduire la liste" 
                  : `+ ${remainingCount} autre${remainingCount > 1 ? 's' : ''} action${remainingCount > 1 ? 's' : ''}`
                }
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* ============================================================
          GRILLE DES OPTIONS — cartes neutres, sans couleur, sans bordure
          ============================================================ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {catalogue.map((s, index) => {
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
              className="border-0 shadow-none bg-white rounded-xl relative group transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
            >
              <CardContent className="p-5 flex flex-col h-full gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="relative flex-shrink-0">
                      <span 
                        className="flex h-11 w-11 items-center justify-center rounded-xl"
                        style={{ backgroundColor: "#F1EFEA" }}
                      >
                        <Icon className="h-5 w-5" style={{ color: "#172030" }} />
                      </span>
                      <span 
                        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full text-[9px] font-bold flex items-center justify-center text-white shadow-sm"
                        style={{ backgroundColor: "#172030" }}
                      >
                        {getIndexLabel(index)}
                      </span>
                    </div>
                    
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="font-serif font-bold text-[#172030] leading-tight truncate">
                        {s.nom}
                      </p>
                      <span 
                        className="inline-block mt-1.5 text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
                        style={{ 
                          backgroundColor: "#F1EFEA", 
                          color: "#172030" 
                        }}
                      >
                        {s.type || "Générique"}
                      </span>
                    </div>
                  </div>
                  
                  <div 
                    className="flex gap-0.5 rounded-lg p-0.5 bg-white/80 backdrop-blur shadow-sm opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                  >
                    <button 
                      onClick={() => openEditDialog(s)} 
                      className="p-1.5 rounded-md text-[#172030]/50 hover:text-[#172030] hover:bg-[#F1EFEA] transition-colors"
                      title="Modifier"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button 
                      onClick={() => handleDelete(s.id, s.nom)} 
                      className="p-1.5 rounded-md text-[#172030]/50 hover:text-[#B91C1C] hover:bg-[#FBE9E7] transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                
                <p 
                  className="text-sm flex-1 leading-relaxed"
                  style={{ color: "rgba(23,32,48,0.65)" }}
                >
                  {s.description}
                </p>
                
                <div className="flex flex-wrap items-center gap-2 mt-auto pt-2">
                  <span 
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                    style={{ 
                      backgroundColor: "#F1EFEA", 
                      color: "#172030" 
                    }}
                  >
                    <span 
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: processCount > 0 ? "#2A5141" : "#C0C5CC" }}
                    />
                    {processCount} processus lié{processCount > 1 ? "s" : ""}
                  </span>
                  
                  {loadingActions ? (
                    <span 
                      className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium animate-pulse"
                      style={{ 
                        backgroundColor: "#F1EFEA", 
                        color: "#17203080" 
                      }}
                    >
                      Chargement...
                    </span>
                  ) : actionCount > 0 ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button 
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors hover:opacity-90"
                          style={{ 
                            backgroundColor: "#E8F0EC", 
                            color: "#2A5141" 
                          }}
                        >
                          <Shield className="h-3 w-3" />
                          {actionCount} action{actionCount > 1 ? "s" : ""}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-0 border-[#E5E2DD] bg-white shadow-lg rounded-xl overflow-hidden">
                        <div 
                          className="p-3 border-b border-[#E5E2DD]"
                          style={{ backgroundColor: "#F8F6F2" }}
                        >
                          <p className="text-xs font-semibold text-[#172030] font-sans uppercase tracking-wider">
                            Actions du plan de traitement
                          </p>
                          <p className="text-[10px] text-[#172030]/40 mt-0.5">
                            Liées aux risques de cette option
                          </p>
                        </div>
                        <div className="max-h-[200px] overflow-y-auto p-2 space-y-1.5">
                          {actionsForPopover.length === 0 ? (
                            <div className="p-3 text-center text-xs text-[#172030]/40">
                              Aucune action trouvée.
                            </div>
                          ) : (
                            actionsForPopover.map((act) => (
                              <div 
                                key={act.id} 
                                className="flex flex-col p-2.5 rounded-lg hover:bg-[#F8F6F2] transition-colors"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span className="text-sm font-medium text-[#172030] flex-1 leading-tight">
                                    {act.mesure}
                                  </span>
                                  <span 
                                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                                      act.avancement === 100 ? "bg-[#E8F5E9] text-[#2E7D32]" :
                                      act.avancement > 0 ? "bg-[#FFF8E1] text-[#A38730]" :
                                      "bg-[#F1EFEA] text-[#6C7A8A]"
                                    }`}
                                  >
                                    {act.avancement || 0}%
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-[10px] text-[#172030]/50">
                                  <span>{act.responsable || "—"}</span>
                                  <span className="w-1 h-1 rounded-full bg-[#E5E2DD]" />
                                  <span>{act.statut || "À faire"}</span>
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

      {/* ============================================================
          DIALOGUE D'AJOUT
          ============================================================ */}
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

      {/* ============================================================
          DIALOGUE D'ÉDITION
          ============================================================ */}
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