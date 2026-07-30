import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Building2, Trash2, Pencil, Save, X, ExternalLink, FileText, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useGovernance } from "@/contexts/GovernanceContext";
import { useRole } from "@/contexts/RoleContext";
import { useBia } from "@/contexts/BiaContext";
import { computeMaxScore, scoreToCriticality, criticalityColor } from "@/data/bia";
import { type Entity, type EntityType, defaultMaturity } from "@/data/governance";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';
import jsPDF from 'jspdf';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;

// Types d'entités disponibles (sans HOLDING et GROUPE)
const ENTITY_TYPES_FILTERED = ["FILIALE", "DIRECTION", "SERVICE", "DÉPARTEMENT"];

// Helper pour déterminer si une entité est un niveau bas (Service ou Département)
const isLowLevel = (type?: string) => {
  const normalized = (type || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return ["SERVICE", "DEPARTEMENT"].includes(normalized);
};

// Helper pour déterminer si une entité est une Direction
const isDirection = (type?: string) => {
  const normalized = (type || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return normalized === "DIRECTION";
};

// Helper pour déterminer si une entité est une Filiale
const isFiliale = (type?: string) => {
  const normalized = (type || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return normalized === "FILIALE";
};

// Fonction de validation hiérarchique
const validateHierarchy = (type: string, parentId: string | null, entities: Entity[]): { valid: boolean; error?: string } => {
  const normalizedType = type.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Filiale → pas de parent
  if (normalizedType === "FILIALE") {
    if (parentId) return { valid: false, error: "Une filiale ne peut pas avoir d'entité parente" };
    return { valid: true };
  }
  
  // Direction → parent doit être une Filiale
  if (normalizedType === "DIRECTION") {
    if (!parentId) return { valid: false, error: "Une direction doit avoir une filiale parente" };
    const parent = entities.find(e => e.id === parentId);
    if (!parent) return { valid: false, error: "L'entité parente n'existe pas" };
    if (!isFiliale(parent.type)) return { valid: false, error: "Une direction doit être rattachée à une filiale" };
    return { valid: true };
  }
  
  // Service ou Département → parent doit être une Direction
  if (["SERVICE", "DEPARTEMENT"].includes(normalizedType)) {
    if (!parentId) return { valid: false, error: "Un service/département doit avoir une direction parente" };
    const parent = entities.find(e => e.id === parentId);
    if (!parent) return { valid: false, error: "L'entité parente n'existe pas" };
    if (!isDirection(parent.type)) return { valid: false, error: "Un service/département doit être rattaché à une direction" };
    return { valid: true };
  }
  
  return { valid: false, error: "Type d'entité invalide" };
};

// Récupérer les enfants d'une entité
const getChildren = (entities: Entity[], parentId: string) => {
  return entities.filter(e => e.parentId === parentId);
};

// Récupérer les processus d'une entité
const getEntityProcesses = (entity: Entity, allProcesses: any[]) => {
  return allProcesses.filter(p => p.entityId === entity.id);
};

const buildTree = (entities: Entity[], parentId: string | null = null): Entity[] =>
  entities.filter((e) => e.parentId === parentId).map((e) => ({ ...e, children: buildTree(entities, e.id) }));

const maturityColor = (m: number) => {
  if (m < 50) return "bg-destructive";
  if (m < 75) return "bg-warning";
  return "bg-success";
};

// ============================================================
// NODE AMÉLIORÉ AVEC HIÉRARCHIE VISUELLE
// ============================================================
const Node = ({ node, depth, onDelete, onSelect }: { 
  node: Entity; depth: number; onDelete: (id: string) => void; onSelect: (id: string) => void;
}) => {
  const [open, setOpen] = useState(true);
  const hasChildren = (node.children?.length ?? 0) > 0;
  const { can } = useRole();
  const m = node.maturity ?? defaultMaturity(node.pcaStatus);
  const isDept = isLowLevel(node.type);
  const isDir = isDirection(node.type);
  const isFil = isFiliale(node.type);

  // Couleurs par type
  const getTypeColors = (type?: string) => {
    if (isFil) return {
      iconBg: "bg-[#172030]",
      iconColor: "text-white",
      badgeBg: "bg-[#172030]",
      badgeText: "text-white",
      borderColor: "border-[#172030]",
      textSize: "text-base font-bold"
    };
    if (isDir) return {
      iconBg: "bg-[#2A5141]",
      iconColor: "text-white",
      badgeBg: "bg-[#2A5141]",
      badgeText: "text-white",
      borderColor: "border-[#2A5141]",
      textSize: "text-sm font-semibold"
    };
    if (type?.toUpperCase() === "SERVICE") return {
      iconBg: "bg-blue-100",
      iconColor: "text-blue-700",
      badgeBg: "bg-blue-100",
      badgeText: "text-blue-700",
      borderColor: "border-blue-200",
      textSize: "text-sm font-medium"
    };
    if (type?.toUpperCase() === "DÉPARTEMENT") return {
      iconBg: "bg-purple-100",
      iconColor: "text-purple-700",
      badgeBg: "bg-purple-100",
      badgeText: "text-purple-700",
      borderColor: "border-purple-200",
      textSize: "text-sm font-medium"
    };
    return {
      iconBg: "bg-gray-100",
      iconColor: "text-gray-600",
      badgeBg: "bg-gray-100",
      badgeText: "text-gray-600",
      borderColor: "border-gray-200",
      textSize: "text-sm font-medium"
    };
  };

  const colors = getTypeColors(node.type);
  
  // Taille de l'icône selon le niveau
  const iconSize = isFil ? "h-5 w-5" : isDir ? "h-4.5 w-4.5" : "h-4 w-4";
  const iconContainerSize = isFil ? "h-9 w-9" : isDir ? "h-8 w-8" : "h-7 w-7";

  // Détection des doublons de nom au même niveau
  const getDisplayName = () => {
    // Trouver toutes les entités au même niveau (même parentId)
    const siblingsWithSameName = node.parentId
      ? (getChildren([], node.parentId) as any).filter((e: any) => e.name === node.name && e.id !== node.id)
      : [];
    
    if (siblingsWithSameName.length > 0) {
      return `${node.name} (${node.country || 'FR'})`;
    }
    return node.name;
  };

  // Fond alterné selon la profondeur
  const bgColor = depth % 2 === 0 ? "bg-white" : "bg-[#F8F6F2]/30";

  return (
    <div className={cn("relative", bgColor)}>
      {/* Ligne de connexion verticale */}
      {depth > 0 && (
        <div 
          className="absolute left-[18px] top-0 bottom-0 w-px bg-gray-200"
          style={{ 
            height: '100%',
            left: `${depth * 24 + 18}px`
          }}
        />
      )}
      
      <div
        className={cn(
          "py-3 px-3 rounded-lg hover:bg-secondary/40 transition-all duration-200 group cursor-pointer relative",
          isFil ? "py-4" : "py-2.5"
        )}
        style={{ paddingLeft: `${depth * 28 + 12}px` }}
        onClick={() => onSelect(node.id)}
      >
        <div className="flex items-center gap-3">
          {/* Bouton d'expansion avec cercle au survol */}
          <button 
            onClick={(e) => { e.stopPropagation(); setOpen(!open); }} 
            className={cn(
              "flex items-center justify-center rounded-full transition-all duration-200",
              hasChildren ? "hover:bg-gray-200/70 w-6 h-6" : "w-6 h-6 opacity-0"
            )}
          >
            {hasChildren ? (
              open ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />
            ) : (
              <span className="inline-block w-4" />
            )}
          </button>

          {/* Icône avec couleur selon le type */}
          <div className={cn(
            "rounded-lg flex items-center justify-center flex-shrink-0 transition-all",
            iconContainerSize,
            colors.iconBg
          )}>
            <Building2 className={cn(iconSize, colors.iconColor)} />
          </div>

          {/* Colonnes alignées */}
          <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
            {/* Colonne Nom */}
            <div className="flex items-center gap-2 min-w-0">
              <span className={cn(
                "truncate",
                colors.textSize,
                isFil ? "text-[#172030]" : "text-gray-800"
              )}>
                {getDisplayName()}
              </span>
            </div>

            {/* Colonne Type - Badge coloré */}
            <div>
              <Badge className={cn(
                "font-medium px-2.5 py-0.5 rounded-full text-[10px]",
                colors.badgeBg,
                colors.badgeText,
                colors.borderColor
              )}>
                {node.type || "—"}
              </Badge>
            </div>

            {/* Colonne Pays */}
            <span className="text-xs text-muted-foreground">{node.country || "FR"}</span>

            {/* Colonne Référent */}
            <span className="text-xs truncate text-muted-foreground">{node.referent || "—"}</span>
          </div>

          {/* Bouton Supprimer */}
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
            {can("admin") && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-full" 
                onClick={() => onDelete(node.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Enfants */}
      {hasChildren && open && (
        <div className="relative">
          {node.children!.map((c, index) => (
            <div key={c.id} className="relative">
              {/* Connecteur en L pour le dernier enfant */}
              {index === node.children!.length - 1 && depth > 0 && (
                <div 
                  className="absolute w-px bg-gray-200"
                  style={{
                    left: `${depth * 28 + 18}px`,
                    top: 0,
                    bottom: '50%',
                    height: '50%'
                  }}
                />
              )}
              <Node 
                key={c.id} 
                node={c} 
                depth={depth + 1} 
                onDelete={onDelete} 
                onSelect={onSelect} 
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

type FormState = {
  name: string;
  type: EntityType | "";
  country: string;
  referent: string;
  referentContact: string;
  suppleant: string;
  suppleantContact: string;
  parentId: string;
};

const emptyForm: FormState = {
  name: "", type: "", country: "",
  referent: "", referentContact: "",
  suppleant: "", suppleantContact: "",
  parentId: "",
};

export const OrgChart = ({ onNavigate }: { onNavigate?: (section: string, entityId?: string) => void }) => {
  const { entities, setEntities, setSelectedEntityId } = useGovernance();
  const { processes } = useBia();
  const { can } = useRole();

  const [panelId, setPanelId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [form, setForm] = useState<FormState>(emptyForm);
  
  // ============================================================
  // ÉTAT POUR LE TRAITEMENT PDF
  // ============================================================
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const tree = buildTree(entities);
  const panelEntity = entities.find((e) => e.id === panelId) || null;
  const panelParent = panelEntity ? entities.find((e) => e.id === panelEntity.parentId) : null;

  // Récupérer les enfants d'une entité
  const panelChildren = panelEntity ? getChildren(entities, panelEntity.id) : [];
  
  // Récupérer les processus de l'entité affichée
  const panelProcesses = panelEntity ? getEntityProcesses(panelEntity, processes) : [];

  const submitInline = async () => {
    if (!can("write")) { toast.error("Permissions insuffisantes"); return; }
    
    // Vérifier les champs obligatoires (Nom, Type, Parent sauf pour Filiale)
    if (!form.name) { toast.error("Le nom est obligatoire"); return; }
    if (!form.type) { toast.error("Le type est obligatoire"); return; }
    
    const normalizedType = form.type.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (normalizedType !== "FILIALE" && !form.parentId) {
      toast.error("L'entité parente est obligatoire (sauf pour les filiales)");
      return;
    }
    
    // Valider la hiérarchie
    const validation = validateHierarchy(form.type, form.parentId || null, entities);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }
    
    const entityToInsert = {
      name: form.name,
      type: form.type?.toUpperCase(),
      country_code: form.country || "FR",
      parent_id: form.parentId || null,
      pca_referent: form.referent || "—",
      referent_contact: form.referentContact || null,
      referent_backup: form.suppleant || "—",
      referent_backup_contact: form.suppleantContact || null,
      pca_status: "Non démarré",
      maturity: 20,
      sector: "Général",
      status: "ACTIVE",
    };
    const { data, error } = await (supabase as any).from('organisations').insert(entityToInsert).select();
    if (error) { toast.error("Erreur: " + error.message); return; }
    const newEntity: any = {
      id: data[0].id,
      name: form.name,
      type: form.type as EntityType,
      country: form.country || "FR",
      sector: "Général",
      parentId: form.parentId || null,
      referent: form.referent || "—",
      referentContact: form.referentContact || undefined,
      referentBackup: form.suppleant || "—",
      suppleantContact: form.suppleantContact || undefined,
      status: "Actif",
      pcaStatus: "Non démarré",
      maturity: 20,
    };
    setEntities([...entities, newEntity]);
    setForm(emptyForm);
    toast.success("Entité créée et sauvegardée");
  };

  // ============================================================
  // handleDelete CORRIGÉ AVEC DONNÉES FRAÎCHES
  // ============================================================
  const handleDelete = async (id: string) => {
    if (!can("admin")) { 
      toast.error("Action réservée à l'administrateur"); 
      return; 
    }

    // Demander confirmation à l'utilisateur
    const entityName = entities.find(e => e.id === id)?.name || id;
    if (!confirm(`⚠️ Voulez-vous vraiment supprimer "${entityName}" et toutes ses entités filles ?`)) {
      return;
    }

    // 1. Récupérer les entités FRAÎCHES depuis la base pour un calcul de cascade fiable
    const { data: freshEntities, error: fetchError } = await (supabase as any)
      .from('organisations')
      .select('id, parent_id');
    
    if (fetchError) {
      toast.error("Erreur lors de la vérification des entités liées : " + fetchError.message);
      return;
    }
    
    // 2. Calculer la cascade avec les données fraîches
    const toRemove = new Set<string>([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const e of freshEntities) {
        if (e.parent_id && toRemove.has(e.parent_id) && !toRemove.has(e.id)) {
          toRemove.add(e.id);
          changed = true;
        }
      }
    }
    
    console.log(`🗑️ Suppression en cascade de ${toRemove.size} entité(s):`, Array.from(toRemove));
    
    // 3. Supprimer toutes les entités en cascade
    const { error: deleteError } = await (supabase as any)
      .from('organisations')
      .delete()
      .in('id', Array.from(toRemove));
    
    if (deleteError) {
      toast.error("Erreur lors de la suppression : " + deleteError.message);
      return;
    }
    
    // 4. Recharger l'état local depuis la base après suppression
    const { data: remainingEntities } = await (supabase as any)
      .from('organisations')
      .select('*');
    
    if (remainingEntities) {
      setEntities(remainingEntities.map((e: any) => ({
        id: e.id,
        name: e.name,
        type: e.type,
        country: e.country_code,
        parentId: e.parent_id,
        referent: e.pca_referent || '—',
        referentContact: e.referent_contact,
        referentBackup: e.referent_backup || '—',
        suppleantContact: e.referent_backup_contact,
        status: 'Actif',
        pcaStatus: e.pca_status || 'Non démarré',
        maturity: e.maturity || 20,
      })));
    }
    
    // 5. Fermer le panneau si l'entité supprimée était affichée
    if (panelId && toRemove.has(panelId)) { 
      setPanelId(null); 
      setEditing(false); 
    }
    
    toast.success(`${toRemove.size} entité(s) supprimée(s) avec succès`);
  };

  const openPanel = (id: string) => {
    setPanelId(id); setSelectedEntityId(id); setEditing(false);
    const e = entities.find((x) => x.id === id);
    if (e) {
      setEditForm({
        name: e.name, type: e.type || "", country: e.country,
        referent: e.referent,
        referentContact: (e as any).referentContact || "",
        suppleant: e.referentBackup || "",
        suppleantContact: (e as any).suppleantContact || "",
        parentId: e.parentId || "",
      });
    }
  };

  const saveEdit = async () => {
    if (!panelEntity) return;
    if (!can("write")) { toast.error("Permissions insuffisantes"); return; }
    if (!editForm.name) { toast.error("Le nom est obligatoire"); return; }
    if (!editForm.type) { toast.error("Le type est obligatoire"); return; }
    
    const normalizedType = editForm.type.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (normalizedType !== "FILIALE" && !editForm.parentId) {
      toast.error("L'entité parente est obligatoire (sauf pour les filiales)");
      return;
    }
    
    if (editForm.parentId === panelEntity.id) { toast.error("Une entité ne peut pas être son propre parent"); return; }
    
    // Valider la hiérarchie
    const validation = validateHierarchy(editForm.type, editForm.parentId || null, entities.filter(e => e.id !== panelEntity.id));
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }
    
    await (supabase as any).from('organisations').update({
      name: editForm.name, type: editForm.type?.toUpperCase(),
      country_code: editForm.country || "FR", parent_id: editForm.parentId || null,
      pca_referent: editForm.referent || "—", referent_contact: editForm.referentContact || null,
      referent_backup: editForm.suppleant || "—", referent_backup_contact: editForm.suppleantContact || null,
    }).eq('id', panelEntity.id);
    setEntities(entities.map((e) => e.id === panelEntity.id ? {
      ...panelEntity,
      name: editForm.name, type: (editForm.type || undefined) as EntityType | undefined,
      country: editForm.country || "FR", referent: editForm.referent || "—",
      referentContact: editForm.referentContact || undefined,
      referentBackup: editForm.suppleant || "—",
      suppleantContact: editForm.suppleantContact || undefined,
      parentId: editForm.parentId || null,
    } as any : e));
    setEditing(false);
    toast.success("Entité mise à jour");
  };
// ============================================================
// FONCTION RENDERFORMGRID CORRIGÉE AVEC HIÉRARCHIE VISIBLE
// ============================================================
const renderFormGrid = (state: FormState, set: (s: FormState) => void, excludeId?: string) => {
  // Récupérer les filiales pour le regroupement
  const filiales = entities.filter(e => e.id !== excludeId && isFiliale(e.type));
  
  // Fonction pour obtenir le chemin hiérarchique complet d'une entité
  const getFullPath = (entityId: string): string => {
    const entity = entities.find(e => e.id === entityId);
    if (!entity) return "";
    
    const path: string[] = [entity.name];
    let current = entity;
    
    // Remonter jusqu'à la racine (max 5 niveaux pour éviter les boucles)
    let maxLevels = 5;
    while (current.parentId && maxLevels > 0) {
      const parent = entities.find(e => e.id === current.parentId);
      if (parent) {
        path.unshift(parent.name);
        current = parent;
      } else {
        break;
      }
      maxLevels--;
    }
    
    return path.join(" → ");
  };

  // Filtrer les entités parentes disponibles selon le type sélectionné
  const getAvailableParents = () => {
    if (!state.type) return [];
    
    const normalizedType = state.type.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    if (normalizedType === "FILIALE") {
      return []; // Aucun parent possible
    }
    if (normalizedType === "DIRECTION") {
      // Directions → parent doit être une Filiale
      return entities.filter(e => e.id !== excludeId && isFiliale(e.type));
    }
    if (["SERVICE", "DEPARTEMENT"].includes(normalizedType)) {
      // Services/Départements → parent doit être une Direction
      return entities.filter(e => e.id !== excludeId && isDirection(e.type));
    }
    return [];
  };
  
  const availableParents = getAvailableParents();
  const showParentField = state.type && state.type.toUpperCase() !== "FILIALE";
  
  // Grouper les parents par filiale pour les Directions
  const getGroupedParents = () => {
    if (!state.type) return [];
    
    const normalizedType = state.type.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    if (normalizedType === "DIRECTION") {
      // Grouper les filiales avec leurs directions
      const groups: { filiale: Entity; directions: Entity[] }[] = [];
      
      for (const filiale of filiales) {
        const directions = availableParents.filter(e => {
          const parent = entities.find(p => p.id === e.parentId);
          return parent?.id === filiale.id;
        });
        if (directions.length > 0) {
          groups.push({ filiale, directions });
        }
      }
      
      // Filiales sans directions
      const filialesWithoutDirections = filiales.filter(f => {
        return !availableParents.some(e => {
          const parent = entities.find(p => p.id === e.parentId);
          return parent?.id === f.id;
        });
      });
      
      return { groups, filialesWithoutDirections };
    }
    
    if (["SERVICE", "DEPARTEMENT"].includes(normalizedType)) {
      // Grouper les directions par filiale
      const groups: { filiale: Entity; directions: Entity[] }[] = [];
      
      for (const filiale of filiales) {
        const directionsOfFiliale = entities.filter(e => e.id !== excludeId && isDirection(e.type) && e.parentId === filiale.id);
        const availableDirs = directionsOfFiliale.filter(d => availableParents.some(ap => ap.id === d.id));
        if (availableDirs.length > 0) {
          groups.push({ filiale, directions: availableDirs });
        }
      }
      
      // Directions sans filiale (cas exceptionnel)
      const orphanDirections = availableParents.filter(e => {
        const parent = entities.find(p => p.id === e.parentId);
        return !parent || !isFiliale(parent.type);
      });
      
      return { groups, orphanDirections };
    }
    
    return { groups: [], orphanDirections: [] };
  };

  const groupedParents = getGroupedParents();
  
  return (
    <div className="grid md:grid-cols-3 gap-3">
      <div>
        <Label>Nom <span className="text-destructive">*</span></Label>
        <Input value={state.name} onChange={(e) => set({ ...state, name: e.target.value })} placeholder="Direction Marketing" />
      </div>
      <div>
        <Label>Type <span className="text-destructive">*</span></Label>
        <Select value={state.type} onValueChange={(v) => {
          set({ ...state, type: v as EntityType, parentId: "" });
        }}>
          <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            {ENTITY_TYPES_FILTERED.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Pays</Label>
        <Input value={state.country} onChange={(e) => set({ ...state, country: e.target.value })} placeholder="France" />
      </div>
      <div>
        <Label>Référent PCA</Label>
        <Input value={state.referent} onChange={(e) => set({ ...state, referent: e.target.value })} placeholder="Nom du responsable" />
      </div>
      <div>
        <Label>Coordonnées référent</Label>
        <Input value={state.referentContact} onChange={(e) => set({ ...state, referentContact: e.target.value })} placeholder="email ou téléphone" />
      </div>
      <div>
        <Label>Suppléant</Label>
        <Input value={state.suppleant} onChange={(e) => set({ ...state, suppleant: e.target.value })} placeholder="Nom du suppléant" />
      </div>
      <div>
        <Label>Coordonnées suppléant</Label>
        <Input value={state.suppleantContact} onChange={(e) => set({ ...state, suppleantContact: e.target.value })} placeholder="email ou téléphone" />
      </div>
      {showParentField && (
        <div className="md:col-span-2">
          <Label className="flex items-center gap-2">
            Entité parente <span className="text-destructive">*</span>
            <span className="text-xs font-normal text-muted-foreground">
              (doit être une {state.type === "DIRECTION" ? "Filiale" : "Direction"})
            </span>
          </Label>
          
          {availableParents.length === 0 ? (
            <div className="mt-1 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              ⚠️ Aucune {state.type === "DIRECTION" ? "filiale" : "direction"} disponible. 
              {state.type === "DIRECTION" 
                ? " Créez d'abord une filiale." 
                : " Créez d'abord une direction."}
            </div>
          ) : (
            <Select value={state.parentId || "__root__"} onValueChange={(v) => set({ ...state, parentId: v === "__root__" ? "" : v })}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Sélectionner un parent" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {groupedParents && 'groups' in groupedParents && groupedParents.groups ? (
                  <>
                    {groupedParents.groups.map((group, idx) => (
                      <div key={idx}>
                        {/* En-tête de groupe - Filiale */}
                        <div className="px-2 py-1.5 bg-[#172030]/5 text-[#172030] text-xs font-semibold flex items-center gap-2 border-t border-[#E8E4DC]">
                          <Building2 className="h-3.5 w-3.5 text-[#172030]/50" />
                          <span>🏢 {group.filiale.name}</span>
                          <span className="text-[10px] font-normal text-muted-foreground">({group.filiale.country || "FR"})</span>
                          <span className="text-[10px] font-normal text-muted-foreground ml-auto">{group.directions.length}</span>
                        </div>
                        {group.directions.map((e) => (
                          <SelectItem key={e.id} value={e.id} className="pl-8">
                            <div className="flex items-center gap-2 w-full">
                              <span className="truncate">{e.name}</span>
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                {getFullPath(e.id)}
                              </span>
                              <Badge variant="outline" className="text-[9px] ml-auto bg-muted/30">
                                {e.type}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                    
                    {/* Filiales sans directions (pour le cas où on sélectionne une Direction mais aucune direction existante) */}
                    {groupedParents.filialesWithoutDirections && groupedParents.filialesWithoutDirections.length > 0 && (
                      <div>
                        <div className="px-2 py-1.5 bg-gray-50 text-muted-foreground text-xs font-semibold flex items-center gap-2 border-t border-[#E8E4DC]">
                          <span>🏢 Filiales sans directions</span>
                        </div>
                        {groupedParents.filialesWithoutDirections.map((f) => (
                          <SelectItem key={f.id} value={f.id} className="pl-8 opacity-60">
                            <div className="flex items-center gap-2 w-full">
                              <span className="truncate">{f.name}</span>
                              <span className="text-[10px] text-muted-foreground">(aucune direction)</span>
                              <Badge variant="outline" className="text-[9px] ml-auto bg-gray-100">
                                FILIALE
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  // Fallback : affichage simple
                  availableParents.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      <div className="flex items-center gap-2 w-full">
                        <span className="truncate">{e.name}</span>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {getFullPath(e.id)}
                        </span>
                        <Badge variant="outline" className="text-[9px] ml-auto bg-muted/30">
                          {e.type}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))
                )}
                
                {/* Option pour sélectionner une entité sans parent (root) */}
                <div className="border-t border-[#E8E4DC] mt-1 pt-1">
                  <SelectItem value="__root__" className="text-muted-foreground italic">
                    — Aucun parent (entité racine) —
                  </SelectItem>
                </div>
              </SelectContent>
            </Select>
          )}
          
          {/* Indicateur de la filiale parente si une entité est sélectionnée */}
          {state.parentId && state.parentId !== "__root__" && (
            <div className="mt-1.5 text-xs text-muted-foreground flex items-center gap-2 bg-[#F8F6F2] p-2 rounded-lg border border-[#E8E4DC]">
              <div className="h-2 w-2 rounded-full bg-[#2A5141] flex-shrink-0"></div>
              <span>
                📍 Chemin : <span className="font-medium text-[#172030]">{getFullPath(state.parentId)}</span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

  // ============================================================
  // MODÈLE EXCEL AVEC MISE EN FORME PROFESSIONNELLE
  // ============================================================
  const downloadTemplate = () => {
    // Créer la première feuille avec les données
    const data = [
      ['Nom', 'Type', 'Pays', 'Référent PCA', 'Coordonnées référent', 'Suppléant', 'Coordonnées suppléant', 'Entité Parente'],
      ['Filiale 1', 'FILIALE', 'France', 'Jean Dupont', 'jean@email.com', 'Marie Martin', 'marie@email.com', ''],
      ['Direction 1', 'DIRECTION', 'France', 'Sophie Leroy', 'sophie@email.com', 'Marc Dubois', 'marc@email.com', 'Filiale 1'],
      ['Service 1', 'SERVICE', 'France', 'Lucie Bernard', 'lucie@email.com', 'Paul Dubois', 'paul@email.com', 'Direction 1'],
      ['Département 1', 'DÉPARTEMENT', 'France', 'Jean Martin', 'jean@email.com', 'Claire Petit', 'claire@email.com', 'Direction 1'],
      ['Filiale 2', 'FILIALE', 'Tunisie', 'Ahmed Ben Ali', 'ahmed@email.com', 'Leila Trabelsi', 'leila@email.com', ''],
      ['Direction 2', 'DIRECTION', 'Tunisie', 'Youssef KAAK', 'youssef@email.com', 'Sami Ben Ammar', 'sami@email.com', 'Filiale 2'],
      ['Service 2', 'SERVICE', 'Tunisie', 'Karim Ben Ali', 'karim@email.com', 'Nadia Gharbi', 'nadia@email.com', 'Direction 2'],
      ['Département 2', 'DÉPARTEMENT', 'Tunisie', 'Mehdi Chaker', 'mehdi@email.com', 'Fatma Ben Amor', 'fatma@email.com', 'Direction 2'],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // Appliquer la mise en forme
    ws['!cols'] = [
      { wch: 20 },  // Nom
      { wch: 15 },  // Type
      { wch: 12 },  // Pays
      { wch: 20 },  // Référent PCA
      { wch: 25 },  // Coordonnées référent
      { wch: 20 },  // Suppléant
      { wch: 25 },  // Coordonnées suppléant
      { wch: 25 },  // Entité Parente
    ];

    // Style pour l'en-tête (fond Navy, texte blanc, gras)
    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "172030" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "172030" } },
        bottom: { style: "thin", color: { rgb: "172030" } },
        left: { style: "thin", color: { rgb: "172030" } },
        right: { style: "thin", color: { rgb: "172030" } }
      }
    };

    // Appliquer le style à la première ligne
    const headerRow = XLSX.utils.sheet_to_json(ws, { header: 1 })[0];
    if (headerRow) {
      for (let col = 0; col < headerRow.length; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
        if (ws[cellRef]) {
          ws[cellRef].s = headerStyle;
        }
      }
    }

    // Style pour les cellules de données (bordures)
    const dataStyle = {
      border: {
        top: { style: "thin", color: { rgb: "CCCCCC" } },
        bottom: { style: "thin", color: { rgb: "CCCCCC" } },
        left: { style: "thin", color: { rgb: "CCCCCC" } },
        right: { style: "thin", color: { rgb: "CCCCCC" } }
      },
      alignment: { vertical: "center" }
    };

    // Appliquer le style aux cellules de données
    for (let row = 1; row < data.length; row++) {
      for (let col = 0; col < data[row].length; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
        if (ws[cellRef]) {
          ws[cellRef].s = dataStyle;
        }
      }
    }

    // --- FEUILLE 2 : INSTRUCTIONS ---
    const instructionsData = [
      ['📋 INSTRUCTIONS POUR L\'IMPORT DE L\'ORGANIGRAMME'],
      [''],
      ['1. HIÉRARCHIE OBLIGATOIRE :'],
      ['   • Niveau 1 : FILIALE (pas de parent)'],
      ['   • Niveau 2 : DIRECTION (parent = Filiale)'],
      ['   • Niveau 3 : SERVICE ou DÉPARTEMENT (parent = Direction)'],
      [''],
      ['2. TYPES D\'ENTITÉS AUTORISÉS :'],
      ['   • FILIALE'],
      ['   • DIRECTION'],
      ['   • SERVICE'],
      ['   • DÉPARTEMENT'],
      [''],
      ['3. COLONNE "ENTITÉ PARENTE" :'],
      ['   • Doit correspondre EXACTEMENT au nom d\'une entité existante dans la colonne "Nom"'],
      ['   • Respecte la hiérarchie ci-dessus'],
      ['   • Laisse vide pour les FILIALE'],
      [''],
      ['4. EXEMPLE DE HIÉRARCHIE VALIDE :'],
      ['   Filiale 1 (FILIALE, parent vide)'],
      ['   └── Direction 1 (DIRECTION, parent = "Filiale 1")'],
      ['       ├── Service 1 (SERVICE, parent = "Direction 1")'],
      ['       └── Département 1 (DÉPARTEMENT, parent = "Direction 1")'],
      [''],
      ['5. REMARQUES :'],
      ['   • Les accents sont supportés (é, è, ê, à, ù, etc.)'],
      ['   • Toutes les colonnes sont optionnelles sauf "Nom" et "Type"'],
      ['   • Les données vides seront remplies automatiquement avec des valeurs par défaut'],
      ['   • La hiérarchie est validée automatiquement avant l\'import'],
    ];

    const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData.map(row => [row]));
    
    // Largeur des colonnes pour les instructions
    wsInstructions['!cols'] = [{ wch: 90 }];

    // Créer le classeur avec les deux feuilles
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Organigramme');
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

    // Télécharger
    XLSX.writeFile(wb, 'modele_organigramme.xlsx');
    toast.success("📊 Modèle Excel téléchargé avec succès !");
  };

  // ============================================================
  // MODÈLE PDF AVEC MISE EN PAGE AMÉLIORÉE
  // ============================================================
  const downloadPdfTemplate = () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      let y = 20;
      const lineHeight = 7;

      // Bandeau Navy en en-tête
      doc.setFillColor(23, 32, 48);
      doc.rect(0, 0, pageWidth, 28, 'F');
      
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(248, 246, 242);
      doc.text("Resillia", margin, 18);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(200, 200, 200);
      doc.text("ORGANIGRAMME DU GROUPE - MODÈLE", pageWidth - margin, 18, { align: "right" });

      y = 38;

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text("Structure hiérarchique des entités", pageWidth / 2, y, { align: "center" });
      y += 10;

      doc.setDrawColor(42, 81, 65);
      doc.setLineWidth(1.5);
      doc.line(margin, y, pageWidth - margin, y);
      doc.setLineWidth(0.2);
      y += 12;

      // Exemple 1
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(23, 32, 48);
      doc.text("Exemple 1 : Filiale 1", margin, y);
      y += lineHeight + 3;
      
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      doc.text("   • Direction Financière", margin + 5, y);
      y += lineHeight;
      doc.text("       • Service Comptabilité", margin + 10, y);
      y += lineHeight;
      doc.text("       • Département Audit", margin + 10, y);
      y += lineHeight;
      doc.text("   • Direction Commerciale", margin + 5, y);
      y += lineHeight;
      doc.text("       • Service Client", margin + 10, y);
      y += lineHeight;
      doc.text("       • Département Marketing", margin + 10, y);
      y += lineHeight + 8;

      // Exemple 2
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(23, 32, 48);
      doc.text("Exemple 2 : Filiale 2", margin, y);
      y += lineHeight + 3;
      
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      doc.text("   • Direction IT", margin + 5, y);
      y += lineHeight;
      doc.text("       • Service Infrastructure", margin + 10, y);
      y += lineHeight;
      doc.text("       • Département Sécurité", margin + 10, y);
      y += lineHeight;
      doc.text("       • Service Développement", margin + 10, y);
      y += lineHeight;
      doc.text("   • Direction RH", margin + 5, y);
      y += lineHeight;
      doc.text("       • Service Recrutement", margin + 10, y);
      y += lineHeight;
      doc.text("       • Département Formation", margin + 10, y);
      y += lineHeight + 10;

      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 10;

      // Bloc INSTRUCTIONS (fond Crème)
      const instructionsY = y;
      const instructionsHeight = 60;
      doc.setFillColor(248, 246, 242);
      doc.rect(margin - 5, instructionsY - 5, pageWidth - margin * 2 + 10, instructionsHeight + 10, 'F');
      
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(23, 32, 48);
      doc.text("INSTRUCTIONS POUR L'IMPORT :", margin, y);
      y += lineHeight + 3;
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      
      const instructions = [
        "1. Utilisez ce modèle pour structurer votre organigramme",
        "2. Remplacez les noms par les vôtres (Filiale 1 → Votre Filiale, etc.)",
        "3. Ajoutez ou supprimez des lignes selon vos besoins",
      ];
      
      for (const line of instructions) {
        doc.text(line, margin + 2, y);
        y += lineHeight;
      }
      y += 3;

      // Bloc AVERTISSEMENT (fond Crème)
      const warningY = y;
      const warningHeight = 30;
      doc.setFillColor(248, 246, 242);
      doc.rect(margin - 5, warningY - 5, pageWidth - margin * 2 + 10, warningHeight + 10, 'F');
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(200, 0, 0);
      doc.text("⚠ IMPORTANT :", margin, y);
      y += lineHeight;
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      const warnings = [
        "   • Les accents sont supportés (é, è, ê, à, ù, etc.)",
        "   • L'IA analysera automatiquement votre document",
        "   • Toutes les entités seront importées avec leur hiérarchie",
      ];
      
      for (const line of warnings) {
        doc.text(line, margin + 2, y);
        y += lineHeight;
      }
      y += 8;

      // Structure hiérarchique
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(23, 32, 48);
      doc.text("STRUCTURE HIÉRARCHIQUE :", margin, y);
      y += lineHeight + 3;
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      
      const structure = [
        "",
        "NIVEAU 1 - FILIALE",
        "  └── Filiale 1",
        "      NIVEAU 2 - DIRECTION",
        "      ├── Direction Financière",
        "      │   NIVEAU 3 - SERVICE / DÉPARTEMENT",
        "      │   ├── Service Comptabilité",
        "      │   └── Département Audit",
        "      └── Direction Commerciale",
        "          ├── Service Client",
        "          └── Département Marketing",
        "",
        "NIVEAU 1 - FILIALE",
        "  └── Filiale 2",
        "      NIVEAU 2 - DIRECTION",
        "      ├── Direction IT",
        "      │   ├── Service Infrastructure",
        "      │   ├── Département Sécurité",
        "      │   └── Service Développement",
        "      └── Direction RH",
        "          ├── Service Recrutement",
        "          └── Département Formation",
      ];

      if (y + structure.length * lineHeight + 30 > pageHeight - 20) {
        doc.addPage();
        y = 25;
      }
      
      for (const line of structure) {
        if (line.startsWith("NIVEAU") || line.startsWith("  └──") || line.startsWith("      ├──") || line.startsWith("      └──") || line.startsWith("      │")) {
          doc.setFont("helvetica", "bold");
          doc.setTextColor(23, 32, 48);
        } else {
          doc.setFont("helvetica", "normal");
          doc.setTextColor(60, 60, 60);
        }
        doc.text(line, margin, y);
        y += lineHeight;
      }
      
      y += 5;

      // Types d'entités
      if (y + 60 > pageHeight - 20) {
        doc.addPage();
        y = 25;
      }
      
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(23, 32, 48);
      doc.text("TYPES D'ENTITÉS AUTORISÉS :", margin, y);
      y += lineHeight + 3;
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      const types = [
        "   • FILIALE      → Niveau 1, pas de parent",
        "   • DIRECTION    → Niveau 2, parent = Filiale",
        "   • SERVICE      → Niveau 3, parent = Direction",
        "   • DÉPARTEMENT  → Niveau 3, parent = Direction",
      ];
      
      for (const line of types) {
        doc.text(line, margin, y);
        y += lineHeight;
      }
      y += 5;

      // Rappel final
      if (y + 30 > pageHeight - 20) {
        doc.addPage();
        y = 25;
      }
      
      doc.setFont("helvetica", "bold");
      doc.setTextColor(23, 32, 48);
      doc.text("🔑 RAPPEL :", margin, y);
      y += lineHeight;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      doc.text("   La colonne \"Entité Parente\" doit correspondre EXACTEMENT au nom d'une ligne précédente.", margin + 2, y);
      y += lineHeight;
      doc.text("   Respectez la hiérarchie : Filiale → Direction → Service/Département.", margin + 2, y);

      // Pied de page
      if (y + 20 > pageHeight - 15) {
        doc.addPage();
        y = 25;
      }
      
      y = pageHeight - 15;
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Document généré automatiquement - ${new Date().toLocaleDateString('fr-FR')}`,
        pageWidth / 2,
        y,
        { align: "center" }
      );
      
      doc.save('modele_organigramme.pdf');
      toast.success("📄 Modèle PDF téléchargé avec succès !");
    } catch (error) {
      console.error("Erreur lors de la génération du PDF:", error);
      toast.error("Erreur lors de la génération du PDF. Vérifiez que la bibliothèque jsPDF est installée.");
    }
  };

  // ============================================================
  // IMPORT EXCEL TRANSACTIONNEL
  // ============================================================
  const importExcel = async (rows: any[]) => {
    console.log("📊 Excel - Lignes:", rows.length);
    
    // 1. VALIDATION DE TOUTES LES LIGNES
    const validationErrors: string[] = [];
    const validRows: any[] = [];
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = row['Nom']?.trim();
      const type = row['Type']?.trim()?.toUpperCase() || 'DIRECTION';
      const parentName = row['Entité Parente']?.trim() || null;
      
      if (!name) {
        validationErrors.push(`Ligne ${i+1}: Nom manquant`);
        continue;
      }
      
      const validTypes = ["FILIALE", "DIRECTION", "SERVICE", "DÉPARTEMENT"];
      if (!validTypes.includes(type)) {
        validationErrors.push(`Ligne ${i+1}: Type "${type}" invalide. Types autorisés: ${validTypes.join(', ')}`);
        continue;
      }
      
      // Vérifier que le parent existe (si spécifié)
      if (parentName) {
        // On vérifiera après avoir les noms de toutes les lignes
        // On stocke juste pour validation ultérieure
      }
      
      validRows.push({
        index: i,
        name,
        type,
        parentName,
        country: row['Pays']?.trim() || 'FR',
        referent: row['Référent PCA']?.trim() || '—',
        referentContact: row['Coordonnées référent']?.trim() || null,
        suppleant: row['Suppléant']?.trim() || '—',
        suppleantContact: row['Coordonnées suppléant']?.trim() || null,
      });
    }
    
    // 2. VÉRIFIER QUE TOUS LES PARENTS EXISTENT
    const allNames = new Set(validRows.map(r => r.name));
    for (const row of validRows) {
      if (row.parentName && !allNames.has(row.parentName)) {
        const existingParent = entities.find(e => e.name === row.parentName);
        if (!existingParent) {
          validationErrors.push(`Ligne ${row.index+1}: Entité parente "${row.parentName}" non trouvée (doit être une ligne existante dans le fichier ou déjà en base)`);
        }
      }
    }
    
    // 3. SI ERREURS → AFFICHER TOUT ET S'ARRÊTER
    if (validationErrors.length > 0) {
      const errorMessage = validationErrors.join('\n');
      toast.error(`❌ ${validationErrors.length} erreur(s) de validation:\n${errorMessage}`, {
        duration: 8000,
        style: { whiteSpace: 'pre-wrap' }
      });
      return;
    }
    
    // 4. TOUT EST VALIDE → INSERTION
    const insertedEntities: any[] = [];
    const errors: string[] = [];
    
    for (const row of validRows) {
      const { data: inserted, error } = await (supabase as any).from('organisations').insert({
        name: row.name,
        type: row.type,
        country_code: row.country,
        parent_id: null,
        pca_referent: row.referent,
        referent_contact: row.referentContact,
        referent_backup: row.suppleant,
        referent_backup_contact: row.suppleantContact,
        pca_status: 'Non démarré',
        maturity: 20,
        sector: 'Général',
        status: 'ACTIVE',
      }).select().single();
      
      if (error) {
        errors.push(`Ligne ${row.index+1}: ${error.message}`);
        continue;
      }
      
      insertedEntities.push({
        ...inserted,
        originalName: row.name,
        originalType: row.type,
        originalParent: row.parentName,
      });
    }
    
    // 5. METTRE À JOUR LES PARENTS
    const allEntitiesForValidation = [
      ...entities,
      ...insertedEntities.map(e => ({
        id: e.id,
        name: e.originalName,
        type: e.originalType,
        parentId: null,
      } as Entity))
    ];
    
    for (const entity of insertedEntities) {
      if (entity.originalParent) {
        let parent = insertedEntities.find(e => e.originalName === entity.originalParent);
        let parentId = parent?.id;
        
        if (!parentId) {
          const existingParent = entities.find(e => e.name === entity.originalParent);
          parentId = existingParent?.id;
        }
        
        if (parentId) {
          const validation = validateHierarchy(entity.originalType, parentId, allEntitiesForValidation);
          if (validation.valid) {
            await (supabase as any).from('organisations')
              .update({ parent_id: parentId })
              .eq('id', entity.id);
            entity.parent_id = parentId;
          } else {
            errors.push(`Ligne pour "${entity.originalName}": ${validation.error}`);
          }
        }
      }
    }
    
    // 6. RECHARGER LES ENTITÉS
    const { data: allEntities } = await (supabase as any).from('organisations').select('*');
    if (allEntities) {
      setEntities(allEntities.map((e: any) => ({
        id: e.id, name: e.name, type: e.type, country: e.country_code,
        parentId: e.parent_id, referent: e.pca_referent || '—',
        referentContact: e.referent_contact, referentBackup: e.referent_backup || '—',
        suppleantContact: e.referent_backup_contact,
        status: 'Actif', pcaStatus: e.pca_status || 'Non démarré', maturity: e.maturity || 20,
      })));
    }
    
    if (errors.length > 0) {
      toast.error(`${insertedEntities.length - errors.length} entités importées, ${errors.length} erreurs: ${errors.join(', ')}`);
    } else {
      toast.success(`${insertedEntities.length} entités importées avec succès !`);
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Stocker le fichier pour réessayer
    setPendingFile(file);
    console.log("📁 Import du fichier:", file.name, "Type:", file.type);
    
    if (file.type === "application/pdf") {
      console.log("📄 Traitement PDF...");
      await processFileWithAI(file);
      e.target.value = '';
      return;
    }
    
    if (file.type.startsWith("image/")) {
      toast.info("Le support des images arrive bientôt.");
      e.target.value = '';
      return;
    }
    
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);
        await importExcel(rows);
      } catch (err: any) { toast.error(err.message || "Erreur import"); }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // ============================================================
  // TRAITEMENT PDF AVEC GROQ (via Supabase Edge Function)
  // ============================================================
  const processFileWithAI = async (file: File) => {
    // État de chargement
    setIsProcessingPdf(true);
    let loadingToast: string | number | undefined;
    
    try {
      // Étape 1: Extraction du texte
      loadingToast = toast.loading("📄 Extraction du texte...");
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = "";
      console.log(`🔵 Nombre de pages: ${pdf.numPages}`);
      
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        console.log(`🔵 Extraction de la page ${pageNum}...`);
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n';
        console.log(`🔵 Page ${pageNum} extraite: ${pageText.length} caractères`);
      }
      
      let extractedText = fullText;
      console.log(`🔵 Texte total extrait: ${extractedText.length} caractères`);
      console.log("🔵 Début du texte:", extractedText.substring(0, 500));
      
      // OCR si pas de texte
      if (!extractedText || extractedText.trim().length < 50) {
        toast.loading("🔍 OCR en cours (document scanné)...", { id: loadingToast });
        console.log("🟡 Texte trop court → OCR sur la page 1...");
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width; canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        const { data: { text } } = await Tesseract.recognize(canvas.toDataURL('image/png'), 'fra');
        extractedText = text;
        console.log(`🟡 OCR terminé, longueur: ${extractedText.length}`);
      }
      
      const cleanText = extractedText
        .replace(/\r/g, ' ')
        .replace(/\t/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      console.log("🔵 Texte nettoyé:", cleanText.substring(0, 800));
      
      // Étape 2: Appel à l'Edge Function Groq
      toast.loading("🧠 Analyse par l'IA en cours...", { id: loadingToast });
      console.log("🔵 Envoi à l'Edge Function Groq...");
      
      const { data, error } = await supabase.functions.invoke('groq-extract', {
        body: { text: cleanText.substring(0, 10000) }
      });

      if (error) {
        console.error("🔴 Erreur Edge Function:", error);
        toast.error("Erreur lors de l'analyse du document : " + error.message, { id: loadingToast });
        setIsProcessingPdf(false);
        setProcessingStep("");
        return;
      }

      if (!data || !data.response) {
        toast.error("Aucune réponse de l'IA. Vérifiez que la Edge Function est bien déployée.", { id: loadingToast });
        setIsProcessingPdf(false);
        setProcessingStep("");
        return;
      }

      const result = { response: data.response };
      console.log("🔵 Réponse brute (début):", result.response?.substring(0, 500));
      
      // Nettoyage du JSON
      let cleanResponse = result.response || '';
      cleanResponse = cleanResponse.replace(/```json\s*/g, '');
      cleanResponse = cleanResponse.replace(/```\s*/g, '');
      
      const jsonMatches = cleanResponse.match(/\{[\s\S]*\}/g);
      if (!jsonMatches) {
        console.error("🔴 Aucun JSON trouvé");
        toast.error("L'IA n'a pas pu structurer ce document. Essayez de reformuler le PDF avec des puces claires ou utilisez le modèle Excel.", { id: loadingToast });
        setIsProcessingPdf(false);
        setProcessingStep("");
        return;
      }
      
      let jsonStr = jsonMatches.reduce((a, b) => a.length > b.length ? a : b, '');
      console.log("🔵 JSON extrait (brut):", jsonStr.substring(0, 500));
      
      jsonStr = jsonStr
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
        .replace(/,(\s*[}\]])/g, '$1')
        .replace(/([{,])(\s*)(\w+)(\s*):/g, '$1"$3":')
        .replace(/'/g, '"')
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'");
      
      console.log("🔵 JSON nettoyé:", jsonStr.substring(0, 500));
      
      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error("🔴 Erreur parsing JSON:", parseError);
        
        // SECOND APPEL EN MODE SIMPLIFIÉ
        toast.loading("🔄 Second essai d'analyse...", { id: loadingToast });
        
        // Appel simplifié pour extraire juste les noms et niveaux
        const { data: fallbackData, error: fallbackError } = await supabase.functions.invoke('groq-extract', {
          body: { 
            text: `Extrais uniquement les noms d'entités et leur niveau hiérarchique du texte suivant. Retourne un JSON avec la liste des entités.

Texte: """${cleanText.substring(0, 5000)}"""

Retourne: {"entities": [{"name": "Nom de l'entité", "level": 1}, ...]}
- level 1 = Filiale (niveau le plus haut)
- level 2 = Direction
- level 3 = Service ou Département

Ne retourne que le JSON.`
          }
        });
        
        if (!fallbackError && fallbackData && fallbackData.response) {
          const fallbackClean = fallbackData.response
            .replace(/```json\s*/g, '')
            .replace(/```\s*/g, '');
          
          try {
            const fallbackParsed = JSON.parse(fallbackClean);
            if (fallbackParsed && fallbackParsed.entities && fallbackParsed.entities.length > 0) {
              // Convertir les niveaux en types
              const entities = fallbackParsed.entities.map((e: any) => {
                let type = "SERVICE";
                if (e.level === 1) type = "FILIALE";
                else if (e.level === 2) type = "DIRECTION";
                else if (e.level === 3) type = "SERVICE";
                return { name: e.name, type, parent: null };
              });
              parsed = { entities };
              console.log("🔵 Entités extraites par fallback:", parsed);
            }
          } catch (e) {
            console.error("🔴 Fallback échoué:", e);
          }
        }
        
        if (!parsed) {
          toast.error("L'IA n'a pas pu structurer ce document. Essayez de reformuler le PDF avec des puces claires ou utilisez le modèle Excel.", { id: loadingToast });
          setIsProcessingPdf(false);
          setProcessingStep("");
          return;
        }
      }
      
      if (parsed && parsed.entities && parsed.entities.length > 0) {
        toast.loading("💾 Import des entités...", { id: loadingToast });
        
        const validEntities = [];
        const errors = [];
        const validTypes = ["FILIALE", "DIRECTION", "SERVICE", "DÉPARTEMENT"];
        
        // Déterminer les parents automatiquement
        let currentFiliale = null;
        let currentDirection = null;
        
        for (const entity of parsed.entities) {
          const normalizedType = (entity.type || "SERVICE").toUpperCase();
          if (!validTypes.includes(normalizedType)) {
            errors.push(`Type "${entity.type}" invalide pour "${entity.name}"`);
            continue;
          }
          if (!entity.name || entity.name.trim() === '') {
            errors.push(`Entité sans nom trouvée`);
            continue;
          }
          
          // Déterminer le parent
          let parent = null;
          if (normalizedType === "FILIALE") {
            currentFiliale = entity.name;
            currentDirection = null;
          } else if (normalizedType === "DIRECTION") {
            parent = currentFiliale;
            currentDirection = entity.name;
          } else if (["SERVICE", "DÉPARTEMENT"].includes(normalizedType)) {
            parent = currentDirection || currentFiliale;
          }
          
          validEntities.push({
            name: entity.name.trim(),
            type: normalizedType,
            parent: entity.parent || parent
          });
        }
        
        if (validEntities.length === 0) {
          toast.error("Aucune entité valide trouvée", { id: loadingToast });
          setIsProcessingPdf(false);
          setProcessingStep("");
          return;
        }
        
        console.log(`🔵 ${validEntities.length} entités valides trouvées`);
        console.log("🔵 Entités:", validEntities.map(e => `${e.name} (${e.type}) -> ${e.parent || 'Racine'}`).join(', '));
        
        // Insertion en base
        const insertedIds = new Map();
        for (const entity of validEntities) {
          const { data, error } = await (supabase as any).from('organisations').insert({
            name: entity.name,
            type: entity.type,
            country_code: 'FR',
            parent_id: null,
            pca_referent: 'À définir',
            referent_contact: null,
            referent_backup: '—',
            referent_backup_contact: null,
            pca_status: 'Non démarré',
            maturity: 20,
            sector: 'Général',
            status: 'ACTIVE',
          }).select().single();
          
          if (error) {
            errors.push(`Erreur insertion ${entity.name}: ${error.message}`);
            console.error(`❌ Erreur insertion ${entity.name}:`, error);
            continue;
          }
          insertedIds.set(entity.name, data.id);
          console.log(`✅ Insertion OK: ${entity.name} → ${data.id}`);
        }
        
        // Mise à jour des parents
        const allEntitiesForValidation = [
          ...entities,
          ...validEntities.map(e => ({
            id: insertedIds.get(e.name),
            name: e.name,
            type: e.type,
            parentId: null,
          } as Entity))
        ];
        
        for (const entity of validEntities) {
          if (entity.parent && insertedIds.has(entity.parent) && insertedIds.has(entity.name)) {
            console.log(`🔗 Liaison: ${entity.name} → ${entity.parent}`);
            const validation = validateHierarchy(
              entity.type, 
              insertedIds.get(entity.parent), 
              allEntitiesForValidation
            );
            if (validation.valid) {
              await (supabase as any).from('organisations')
                .update({ parent_id: insertedIds.get(entity.parent) })
                .eq('id', insertedIds.get(entity.name));
              console.log(`✅ Liaison OK: ${entity.name} → ${entity.parent}`);
            } else {
              errors.push(`Erreur hiérarchie pour "${entity.name}": ${validation.error}`);
              console.error(`❌ Erreur hiérarchie: ${entity.name} → ${entity.parent}: ${validation.error}`);
            }
          } else if (entity.parent && !insertedIds.has(entity.parent)) {
            const existingParent = entities.find(e => e.name === entity.parent);
            if (existingParent) {
              console.log(`🔗 Liaison avec parent existant: ${entity.name} → ${entity.parent}`);
              const validation = validateHierarchy(
                entity.type, 
                existingParent.id, 
                allEntitiesForValidation
              );
              if (validation.valid) {
                await (supabase as any).from('organisations')
                  .update({ parent_id: existingParent.id })
                  .eq('id', insertedIds.get(entity.name));
                console.log(`✅ Liaison OK avec parent existant: ${entity.name} → ${entity.parent}`);
              } else {
                errors.push(`Erreur hiérarchie pour "${entity.name}" avec parent existant: ${validation.error}`);
              }
            }
          }
        }
        
        // Recharger les entités
        const { data: allEntities } = await (supabase as any).from('organisations').select('*');
        if (allEntities) {
          setEntities(allEntities.map((e: any) => ({
            id: e.id,
            name: e.name,
            type: e.type,
            country: e.country_code,
            parentId: e.parent_id,
            referent: e.pca_referent || '—',
            referentContact: e.referent_contact,
            referentBackup: e.referent_backup || '—',
            suppleantContact: e.referent_backup_contact,
            status: 'Actif',
            pcaStatus: e.pca_status || 'Non démarré',
            maturity: e.maturity || 20,
          })));
        }
        
        if (errors.length > 0) {
          toast.warning(`${validEntities.length} entités importées avec ${errors.length} erreurs: ${errors.join(', ')}`, { id: loadingToast });
        } else {
          toast.success(`✅ ${validEntities.length} entités importées avec succès !`, { id: loadingToast });
        }
      } else {
        toast.error("Aucune entité trouvée dans le PDF", { id: loadingToast });
      }
    } catch (err: any) {
      console.error("🔴 ERREUR COMPLÈTE:", err);
      toast.error(`❌ Erreur: ${err.message}`);
    }
    console.log("🔵 === FIN TRAITEMENT PDF ===");
    setIsProcessingPdf(false);
    setProcessingStep("");
  };

  const navigateToInventory = () => {
    if (panelEntity && isLowLevel(panelEntity.type)) {
      if (onNavigate) onNavigate("inventory", panelEntity.id);
      else { localStorage.setItem("currentDepartmentId", panelEntity.id); window.location.href = "/?section=inventory"; }
    }
  };

  // Rendu des enfants dans le panneau de droite
  const renderChildren = (children: Entity[], parentType?: string) => {
    if (children.length === 0) return null;
    
    const services = children.filter(c => c.type?.toUpperCase() === "SERVICE");
    const departments = children.filter(c => c.type?.toUpperCase() === "DÉPARTEMENT");
    const directions = children.filter(c => c.type?.toUpperCase() === "DIRECTION");
    
    if (parentType && isFiliale(parentType)) {
      return (
        <div className="space-y-2">
          {directions.map(d => (
            <div 
              key={d.id} 
              className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/50 cursor-pointer transition-all group"
              onClick={() => openPanel(d.id)}
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <div className="font-medium text-sm">{d.name}</div>
                  <div className="text-xs text-muted-foreground">{d.type}</div>
                </div>
              </div>
              <Badge variant="outline" className="text-xs">
                {d.country || "FR"}
              </Badge>
            </div>
          ))}
        </div>
      );
    }
    
    if (parentType && isDirection(parentType)) {
      return (
        <div className="space-y-3">
          {services.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                <div className="h-1 w-4 rounded-full bg-green-500"></div>
                Services ({services.length})
              </h5>
              <div className="space-y-2">
                {services.map(s => (
                  <div 
                    key={s.id} 
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/50 cursor-pointer transition-all group"
                    onClick={() => openPanel(s.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-emerald-500" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">{s.name}</div>
                        <div className="text-xs text-muted-foreground">Service</div>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400">
                      SERVICE
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {departments.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                <div className="h-1 w-4 rounded-full bg-purple-500"></div>
                Départements ({departments.length})
              </h5>
              <div className="space-y-2">
                {departments.map(d => (
                  <div 
                    key={d.id} 
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/50 cursor-pointer transition-all group"
                    onClick={() => openPanel(d.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-purple-500" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">{d.name}</div>
                        <div className="text-xs text-muted-foreground">Département</div>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400">
                      DÉPARTEMENT
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }
    
    return (
      <div className="space-y-2">
        {children.map(c => (
          <div 
            key={c.id} 
            className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/50 cursor-pointer transition-all"
            onClick={() => openPanel(c.id)}
          >
            <div className="flex items-center gap-3">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">{c.name}</span>
            </div>
            <Badge variant="outline" className="text-xs">{c.type}</Badge>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Organigramme du Groupe</h1>
        <p className="text-muted-foreground mt-1">Cliquez sur une entité pour voir ses détails.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plus className="h-4 w-4 text-primary" /> Importer un organigramme</CardTitle>
          <CardDescription>Importez votre structure depuis un fichier Excel, CSV ou PDF</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <input 
              type="file" 
              accept=".xlsx,.xls,.csv,.pdf" 
              onChange={handleFileImport} 
              disabled={isProcessingPdf}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed" 
            />
            {isProcessingPdf && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {processingStep || "Traitement en cours..."}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Format : Nom | Type | Pays | Référent PCA | Coordonnées référent | Suppléant | Coordonnées suppléant | Entité Parente</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={downloadTemplate} className="flex items-center gap-2">
                📊 Télécharger le modèle Excel
              </Button>
              <Button variant="outline" onClick={downloadPdfTemplate} className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                📄 Télécharger le modèle PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {can("write") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Plus className="h-4 w-4 text-primary" /> Créer une entité</CardTitle>
            <CardDescription>Renseignez les informations de la nouvelle entité</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {renderFormGrid(form, setForm)}
            <div className="flex justify-end"><Button onClick={submitInline}><Plus className="h-4 w-4 mr-1" /> Ajouter l'entité</Button></div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Arborescence des entités</CardTitle>
          <CardDescription>Cliquez sur une entité pour voir ses détails.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="hidden md:grid grid-cols-4 gap-2 px-3 pb-2 ml-12 text-xs font-semibold text-muted-foreground border-b border-border">
            <span>Entité</span><span>Type</span><span>Pays</span><span>Référent PCA</span>
          </div>
          <div className="mt-2">
            {tree.map((n) => <Node key={n.id} node={n} depth={0} onDelete={handleDelete} onSelect={openPanel} />)}
          </div>
        </CardContent>
      </Card>

      <Sheet open={!!panelEntity} onOpenChange={(o) => { if (!o) { setPanelId(null); setEditing(false); } }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {panelEntity && (() => {
            const m = panelEntity.maturity ?? defaultMaturity(panelEntity.pcaStatus);
            const isLow = isLowLevel(panelEntity.type);
            const isDir = isDirection(panelEntity.type);
            const isFil = isFiliale(panelEntity.type);
            
            return (
              <div className="space-y-5">
                <SheetHeader>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center"><Building2 className="h-5 w-5 text-primary" /></div>
                      <div><SheetTitle>{panelEntity.name}</SheetTitle><SheetDescription>{panelEntity.type || "—"}</SheetDescription></div>
                    </div>
                    {!editing && (
                      <div className="flex gap-1">
                        {can("write") && <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5 mr-1" /> Éditer</Button>}
                        {can("admin") && <Button variant="outline" size="sm" className="text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => handleDelete(panelEntity.id)}><Trash2 className="h-3.5 w-3.5 mr-1" /> Supprimer</Button>}
                      </div>
                    )}
                  </div>
                </SheetHeader>

                {editing ? (
                  <div className="space-y-4">
                    {renderFormGrid(editForm, setEditForm, panelEntity.id)}
                    <div className="flex justify-end gap-2 pt-2 border-t border-border">
                      <Button variant="ghost" onClick={() => setEditing(false)}><X className="h-4 w-4 mr-1" /> Annuler</Button>
                      <Button onClick={saveEdit}><Save className="h-4 w-4 mr-1" /> Enregistrer</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase">Détails</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="text-muted-foreground">Type</div><div className="font-medium">{panelEntity.type || "—"}</div>
                        <div className="text-muted-foreground">Pays</div><div className="font-medium">{panelEntity.country}</div>
                        <div className="text-muted-foreground">Entité parente</div><div className="font-medium">{panelParent?.name || "Racine"}</div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase">Référent PCA</h4>
                      <div className="rounded-md border border-border p-3 text-sm space-y-1">
                        <div><span className="text-muted-foreground">Principal :</span> <span className="font-medium">{panelEntity.referent}</span></div>
                        <div><span className="text-muted-foreground">Coordonnées :</span> <span className="font-medium">{(panelEntity as any).referentContact || "—"}</span></div>
                        <div><span className="text-muted-foreground">Suppléant :</span> <span className="font-medium">{panelEntity.referentBackup || "—"}</span></div>
                        <div><span className="text-muted-foreground">Coordonnées suppléant :</span> <span className="font-medium">{(panelEntity as any).suppleantContact || "—"}</span></div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase">Maturité PCA</h4>
                        <span className="text-sm font-bold">{m}%</span>
                      </div>
                      <div className="h-3 w-full rounded-full bg-secondary overflow-hidden">
                        <div className={cn("h-full transition-all", maturityColor(m))} style={{ width: `${m}%` }} />
                      </div>
                      <p className="text-xs text-muted-foreground">{m < 50 ? "Niveau faible — actions urgentes requises" : m < 75 ? "Niveau intermédiaire — améliorations recommandées" : "Niveau élevé — bonne maturité"}</p>
                    </div>

                    {isFil && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <div className="h-1.5 w-6 rounded-full bg-blue-500"></div>
                            Directions
                          </h4>
                          <Badge variant="secondary" className="font-mono">
                            {panelChildren.length}
                          </Badge>
                        </div>
                        {panelChildren.length > 0 ? (
                          renderChildren(panelChildren, panelEntity.type)
                        ) : (
                          <div className="text-sm text-muted-foreground italic p-4 bg-muted/30 rounded-md text-center border border-dashed border-muted">
                            Aucune direction rattachée à cette filiale.
                          </div>
                        )}
                      </div>
                    )}

                    {(isDir) && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <div className="h-1.5 w-6 rounded-full bg-green-500"></div>
                            Services & Départements
                          </h4>
                          <Badge variant="secondary" className="font-mono">
                            {panelChildren.length}
                          </Badge>
                        </div>
                        {panelChildren.length > 0 ? (
                          renderChildren(panelChildren, panelEntity.type)
                        ) : (
                          <div className="text-sm text-muted-foreground italic p-4 bg-muted/30 rounded-md text-center border border-dashed border-muted">
                            Aucun service ou département rattaché à cette direction.
                          </div>
                        )}
                        
                        {panelProcesses.length > 0 && (
                          <div className="mt-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <div className="h-1.5 w-6 rounded-full bg-orange-500"></div>
                                Processus de la Direction
                              </h4>
                              <Badge variant="secondary" className="font-mono">
                                {panelProcesses.length}
                              </Badge>
                            </div>
                            <div className="overflow-auto max-h-48 border rounded-lg">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-muted/30">
                                    <TableHead>Processus</TableHead>
                                    <TableHead>Responsable</TableHead>
                                    <TableHead className="text-center">RTO</TableHead>
                                    <TableHead>Criticité</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {panelProcesses.map(p => {
                                    const criticality = scoreToCriticality(computeMaxScore(p.impacts));
                                    return (
                                      <TableRow key={p.id}>
                                        <TableCell className="font-medium">{p.name}</TableCell>
                                        <TableCell>{p.owner}</TableCell>
                                        <TableCell className="text-center">{p.rto}h</TableCell>
                                        <TableCell><Badge className={criticalityColor(criticality)}>{criticality}</Badge></TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        )}
                        
                        {panelChildren.length === 0 && panelProcesses.length === 0 && (
                          <div className="text-sm text-muted-foreground italic p-4 bg-muted/30 rounded-md text-center border border-dashed border-muted">
                            Aucun service, département ou processus rattaché à cette direction.
                          </div>
                        )}
                      </div>
                    )}

                    {(isLow) && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <div className="h-1.5 w-6 rounded-full bg-orange-500"></div>
                            Processus associés
                          </h4>
                          <Badge variant="secondary" className="font-mono">
                            {panelProcesses.length}
                          </Badge>
                        </div>
                        {panelProcesses.length === 0 ? (
                          <div className="text-sm text-muted-foreground italic bg-amber-50 dark:bg-amber-950/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                            <p>Aucun processus rattaché à ce {panelEntity.type?.toLowerCase()}.</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              💡 Conseil : Le champ "Entité" du processus doit être <strong className="text-amber-700 dark:text-amber-400">"{panelEntity.name}"</strong> ou le processus doit être rattaché à la direction parente.
                            </p>
                          </div>
                        ) : (
                          <div className="overflow-auto max-h-64 border rounded-lg">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/30">
                                  <TableHead>Processus</TableHead>
                                  <TableHead>Responsable</TableHead>
                                  <TableHead className="text-center">RTO</TableHead>
                                  <TableHead>Criticité</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {panelProcesses.map(p => {
                                  const criticality = scoreToCriticality(computeMaxScore(p.impacts));
                                  return (
                                    <TableRow key={p.id}>
                                      <TableCell className="font-medium">{p.name}</TableCell>
                                      <TableCell>{p.owner}</TableCell>
                                      <TableCell className="text-center">{p.rto}h</TableCell>
                                      <TableCell><Badge className={criticalityColor(criticality)}>{criticality}</Badge></TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                        <Button variant="outline" size="sm" className="w-full mt-2 gap-2" onClick={navigateToInventory}>
                          <ExternalLink className="h-4 w-4" />
                          Accéder à l'inventaire
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
};