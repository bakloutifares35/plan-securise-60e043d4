import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Building2, Trash2, Pencil, Save, X, ExternalLink, FileText } from "lucide-react";
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

const Node = ({ node, depth, onDelete, onSelect }: { 
  node: Entity; depth: number; onDelete: (id: string) => void; onSelect: (id: string) => void;
}) => {
  const [open, setOpen] = useState(true);
  const hasChildren = (node.children?.length ?? 0) > 0;
  const { can } = useRole();
  const m = node.maturity ?? defaultMaturity(node.pcaStatus);
  const isDept = isLowLevel(node.type);

  return (
    <div>
      <div
        className="py-2.5 px-3 rounded-md hover:bg-secondary/60 transition-colors group cursor-pointer"
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
        onClick={() => onSelect(node.id)}
      >
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); setOpen(!open); }} className="text-muted-foreground hover:text-foreground">
            {hasChildren ? (open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : <span className="inline-block w-4" />}
          </button>
          <Building2 className={`h-4 w-4 shrink-0 ${isDept ? "text-muted-foreground" : "text-primary"}`} />
          <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
            <span className="font-medium text-sm truncate">{node.name}</span>
            <span className="text-xs text-muted-foreground">{node.type || "—"}</span>
            <span className="text-xs text-muted-foreground">{node.country}</span>
            <span className="text-xs truncate">{node.referent}</span>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
            {can("admin") && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(node.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
          </div>
        </div>
        <div className="mt-1.5 ml-10 flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-secondary overflow-hidden max-w-xs">
            <div className={cn("h-full transition-all", maturityColor(m))} style={{ width: `${m}%` }} />
          </div>
          <span className="text-[10px] font-medium text-muted-foreground tabular-nums">Maturité {m}%</span>
        </div>
      </div>
      {hasChildren && open && (
        <div>
          {node.children!.map((c) => (
            <Node key={c.id} node={c} depth={depth + 1} onDelete={onDelete} onSelect={onSelect} />
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

  const handleDelete = async (id: string) => {
    if (!can("admin")) { toast.error("Action réservée à l'administrateur"); return; }
    const toRemove = new Set<string>([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const e of entities) if (e.parentId && toRemove.has(e.parentId) && !toRemove.has(e.id)) { toRemove.add(e.id); changed = true; }
    }
    await (supabase as any).from('organisations').delete().in('id', Array.from(toRemove));
    setEntities(entities.filter((e) => !toRemove.has(e.id)));
    if (panelId && toRemove.has(panelId)) { setPanelId(null); setEditing(false); }
    toast.success("Entité supprimée");
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

  const renderFormGrid = (state: FormState, set: (s: FormState) => void, excludeId?: string) => {
    // Filtrer les entités parentes disponibles selon le type sélectionné
    const getAvailableParents = () => {
      if (!state.type) return entities.filter(e => e.id !== excludeId);
      
      const normalizedType = state.type.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      if (normalizedType === "FILIALE") {
        return []; // Aucun parent possible
      }
      if (normalizedType === "DIRECTION") {
        return entities.filter(e => e.id !== excludeId && isFiliale(e.type));
      }
      if (["SERVICE", "DEPARTEMENT"].includes(normalizedType)) {
        return entities.filter(e => e.id !== excludeId && isDirection(e.type));
      }
      return entities.filter(e => e.id !== excludeId);
    };
    
    const availableParents = getAvailableParents();
    const showParentField = state.type && state.type.toUpperCase() !== "FILIALE";
    
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
          <div>
            <Label>Entité parente <span className="text-destructive">*</span></Label>
            <Select value={state.parentId || "__root__"} onValueChange={(v) => set({ ...state, parentId: v === "__root__" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un parent" /></SelectTrigger>
              <SelectContent>
                {availableParents.length === 0 ? (
                  <SelectItem value="__none__" disabled>Aucun parent disponible</SelectItem>
                ) : (
                  <>
                    <SelectItem value="__root__">— Sélectionner —</SelectItem>
                    {availableParents.map((e) => <SelectItem key={e.id} value={e.id}>{e.name} ({e.type})</SelectItem>)}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    );
  };

  // ✅ Télécharger le modèle Excel SIMPLIFIÉ
  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Nom', 'Type', 'Pays', 'Référent PCA', 'Coordonnées référent', 'Suppléant', 'Coordonnées suppléant', 'Entité Parente'],
      ['Filiale 1', 'FILIALE', 'France', 'Jean Dupont', 'jean@email.com', 'Marie Martin', 'marie@email.com', ''],
      ['Direction 1', 'DIRECTION', 'France', 'Sophie Leroy', 'sophie@email.com', 'Marc Dubois', 'marc@email.com', 'Filiale 1'],
      ['Service 1', 'SERVICE', 'France', 'Lucie Bernard', 'lucie@email.com', 'Paul Dubois', 'paul@email.com', 'Direction 1'],
      ['Département 1', 'DÉPARTEMENT', 'France', 'Jean Martin', 'jean@email.com', 'Claire Petit', 'claire@email.com', 'Direction 1'],
      ['Filiale 2', 'FILIALE', 'Tunisie', 'Ahmed Ben Ali', 'ahmed@email.com', 'Leila Trabelsi', 'leila@email.com', ''],
      ['Direction 2', 'DIRECTION', 'Tunisie', 'Youssef KAAK', 'youssef@email.com', 'Sami Ben Ammar', 'sami@email.com', 'Filiale 2'],
      ['Service 2', 'SERVICE', 'Tunisie', 'Karim Ben Ali', 'karim@email.com', 'Nadia Gharbi', 'nadia@email.com', 'Direction 2'],
      ['Département 2', 'DÉPARTEMENT', 'Tunisie', 'Mehdi Chaker', 'mehdi@email.com', 'Fatma Ben Amor', 'fatma@email.com', 'Direction 2'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Organigramme');
    XLSX.writeFile(wb, 'modele_organigramme.xlsx');
    toast.success("📊 Modèle Excel téléchargé avec succès !");
  };

  // ✅ Télécharger le modèle PDF avec jsPDF - VERSION CORRIGÉE ET PROPRE
const downloadPdfTemplate = () => {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let y = 25;
    const lineHeight = 7;

    // Titre principal
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(23, 32, 48);
    doc.text("ORGANIGRAMME DU GROUPE - MODÈLE", pageWidth / 2, y, { align: "center" });
    y += 10;
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("Structure hiérarchique des entités", pageWidth / 2, y, { align: "center" });
    y += 12;
    
    // Ligne de séparation
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    // ===== EXEMPLE 1 =====
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

    // ===== EXEMPLE 2 =====
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

    // ===== SÉPARATEUR =====
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    // ===== INSTRUCTIONS =====
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
      "",
      "HIÉRARCHIE À RESPECTER :",
      "   Filiale (niveau 1) → Direction (niveau 2) → Service / Département (niveau 3)",
      "",
      "TYPES D'ENTITÉS AUTORISÉS :",
      "   • FILIALE      → Niveau 1, pas de parent",
      "   • DIRECTION    → Niveau 2, parent = Filiale",
      "   • SERVICE      → Niveau 3, parent = Direction",
      "   • DÉPARTEMENT  → Niveau 3, parent = Direction",
    ];
    
    for (const line of instructions) {
      if (line.startsWith("HIÉRARCHIE") || line.startsWith("TYPES D'ENTITÉS") || line.startsWith("   •")) {
        doc.setFont("helvetica", "bold");
      } else {
        doc.setFont("helvetica", "normal");
      }
      doc.text(line, margin, y);
      y += lineHeight;
    }
    
    y += 5;

    // ===== STRUCTURE COMPLÈTE =====
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(23, 32, 48);
    doc.text("STRUCTURE COMPLÈTE :", margin, y);
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
      "NIVEAU 1 - FILIALE ",
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

    // ===== AVERTISSEMENT =====
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
      "   • Respectez la hiérarchie Filiale → Direction → Service/Département",
    ];
    
    for (const line of warnings) {
      doc.text(line, margin, y);
      y += lineHeight;
    }

    // ===== PIED DE PAGE =====
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
    
    // Sauvegarder
    doc.save('modele_organigramme.pdf');
    toast.success("📄 Modèle PDF téléchargé avec succès !");
  } catch (error) {
    console.error("Erreur lors de la génération du PDF:", error);
    toast.error("Erreur lors de la génération du PDF. Vérifiez que la bibliothèque jsPDF est installée.");
  }
};
  // ✅ Fonction d'import Excel avec validation hiérarchique
  const importExcel = async (rows: any[]) => {
    console.log("📊 Excel - Lignes:", rows.length);
    const insertedEntities: any[] = [];
    const errors: string[] = [];
    
    // 1. Créer toutes les entités sans parent
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = row['Nom']?.trim();
      const type = row['Type']?.trim()?.toUpperCase() || 'DIRECTION';
      const parentName = row['Entité Parente']?.trim() || null;
      
      if (!name) {
        errors.push(`Ligne ${i+1}: Nom manquant`);
        continue;
      }
      
      // Vérifier que le type est valide
      const validTypes = ["FILIALE", "DIRECTION", "SERVICE", "DÉPARTEMENT"];
      if (!validTypes.includes(type)) {
        errors.push(`Ligne ${i+1}: Type "${type}" invalide. Types autorisés: ${validTypes.join(', ')}`);
        continue;
      }
      
      const { data: inserted, error } = await (supabase as any).from('organisations').insert({
        name: name,
        type: type,
        country_code: row['Pays']?.trim() || 'FR',
        parent_id: null,
        pca_referent: row['Référent PCA']?.trim() || '—',
        referent_contact: row['Coordonnées référent']?.trim() || null,
        referent_backup: row['Suppléant']?.trim() || '—',
        referent_backup_contact: row['Coordonnées suppléant']?.trim() || null,
        pca_status: 'Non démarré', maturity: 20, sector: 'Général', status: 'ACTIVE',
      }).select().single();
      
      if (error) {
        errors.push(`Ligne ${i+1}: ${error.message}`);
        continue;
      }
      
      insertedEntities.push({
        ...inserted,
        originalName: name,
        originalType: type,
        originalParent: parentName,
      });
    }
    
    // 2. Mettre à jour les parents avec la bonne validation
    // Créer une liste complète des entités (existantes + nouvelles)
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
        // Chercher le parent d'abord dans les nouvelles entités, puis dans les existantes
        let parent = insertedEntities.find(e => e.originalName === entity.originalParent);
        let parentId = parent?.id;
        
        if (!parentId) {
          const existingParent = entities.find(e => e.name === entity.originalParent);
          parentId = existingParent?.id;
        }
        
        if (parentId) {
          // Valider la hiérarchie avec toutes les entités
          const validation = validateHierarchy(entity.originalType, parentId, allEntitiesForValidation);
          if (validation.valid) {
            await (supabase as any).from('organisations')
              .update({ parent_id: parentId })
              .eq('id', entity.id);
            entity.parent_id = parentId;
          } else {
            errors.push(`Ligne pour "${entity.originalName}": ${validation.error}`);
          }
        } else {
          errors.push(`Ligne pour "${entity.originalName}": Entité parente "${entity.originalParent}" non trouvée`);
        }
      }
    }
    
    // 3. Recharger les entités
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
    
    // Import Excel
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

  // ✅ Traitement PDF avec extraction COMPLÈTE de TOUTES les entités
  const processFileWithAI = async (file: File) => {
    console.log("🔵 === DÉBUT TRAITEMENT PDF ===");
    console.log("🔵 Fichier:", file.name, "Taille:", file.size);
    const startTime = Date.now();
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      // 🔥 EXTRAIRE LE TEXTE DE TOUTES LES PAGES
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
      console.log("🔵 Fin du texte:", extractedText.substring(Math.max(0, extractedText.length - 500)));
      
      // Si pas assez de texte, essayer l'OCR sur la première page
      if (!extractedText || extractedText.trim().length < 50) {
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
      
      // Nettoyer le texte mais garder la structure
      const cleanText = extractedText
        .replace(/\r/g, ' ')
        .replace(/\t/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      console.log("🔵 Texte nettoyé (début):", cleanText.substring(0, 500));
      
      // 🔥 PROMPT TRÈS PRÉCIS POUR EXTRAIRE TOUTES LES ENTITÉS
      const prompt = `Analyse le texte suivant et extrait TOUTES les entités de l'organigramme.

Texte: "${cleanText.substring(0, 8000)}"

IDENTIFIE CHAQUE ENTITÉ avec son type et son parent:

1. FILIALE: Identifie les entités de niveau 1 (ex: "Filiale 1", "Filiale 2", "Filiale France")
   - Parent = null

2. DIRECTION: Identifie les entités sous une Filiale (ex: "Direction 1", "Direction Financière")
   - Parent = nom de la Filiale

3. SERVICE: Identifie les entités sous une Direction (ex: "Service 1", "Service Comptabilité")
   - Parent = nom de la Direction

4. DÉPARTEMENT: Identifie les entités sous une Direction (ex: "Département 1", "Département Audit")
   - Parent = nom de la Direction

RÈGLES STRICTES:
- Extrais TOUTES les entités sans exception
- Ne manque AUCUNE entité
- Respecte EXACTEMENT les noms
- Chaque entité doit avoir un nom, un type et un parent

Retourne UNIQUEMENT un JSON valide avec TOUTES les entités:
{"entities":[
  {"name":"Filiale 1","type":"FILIALE","parent":null},
  {"name":"Direction 1","type":"DIRECTION","parent":"Filiale 1"},
  {"name":"Service 1","type":"SERVICE","parent":"Direction 1"},
  {"name":"Département 1","type":"DÉPARTEMENT","parent":"Direction 1"},
  {"name":"Filiale 2","type":"FILIALE","parent":null},
  {"name":"Direction 2","type":"DIRECTION","parent":"Filiale 2"},
  {"name":"Service 2","type":"SERVICE","parent":"Direction 2"},
  {"name":"Département 2","type":"DÉPARTEMENT","parent":"Direction 2"}
]}

Ne retourne AUCUN autre texte, seulement le JSON.`;
      
      console.log("🔵 Envoi à Ollama...");
      
      const response = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "mistral",
          prompt: prompt,
          options: { 
            temperature: 0.1,
            num_predict: 3000
          },
          stream: false
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("🔴 Erreur HTTP:", errorText);
        toast.error("Erreur Ollama: " + response.status);
        return;
      }
      
      const result = await response.json();
      console.log("🔵 Réponse brute (début):", result.response?.substring(0, 300));
      
      // 🔧 NETTOYAGE DU JSON
      let cleanResponse = result.response || '';
      
      // 1. Enlever les markdown code blocks
      cleanResponse = cleanResponse.replace(/```json\s*/g, '');
      cleanResponse = cleanResponse.replace(/```\s*/g, '');
      
      // 2. Trouver tout ce qui ressemble à un JSON
      const jsonMatches = cleanResponse.match(/\{[\s\S]*\}/g);
      if (!jsonMatches) {
        console.error("🔴 Aucun JSON trouvé");
        toast.error("Format de réponse invalide - Aucun JSON trouvé");
        return;
      }
      
      // 3. Prendre le plus grand match JSON
      let jsonStr = jsonMatches.reduce((a, b) => a.length > b.length ? a : b, '');
      console.log("🔵 JSON extrait (brut):", jsonStr.substring(0, 300));
      
      // 4. Nettoyer le JSON
      jsonStr = jsonStr
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
        .replace(/,(\s*[}\]])/g, '$1')
        .replace(/([{,])(\s*)(\w+)(\s*):/g, '$1"$3":')
        .replace(/'/g, '"')
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'");
      
      console.log("🔵 JSON nettoyé:", jsonStr.substring(0, 300));
      
      // 5. Parser le JSON
      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error("🔴 Erreur parsing JSON:", parseError);
        console.log("🔵 Tentative de réparation manuelle...");
        
        // Extraction manuelle des entités
        const entityMatches = jsonStr.match(/"name"\s*:\s*"([^"]+)"\s*,\s*"type"\s*:\s*"([^"]+)"\s*,\s*"parent"\s*:\s*([^,}]+)/g);
        if (entityMatches && entityMatches.length > 0) {
          const entities = entityMatches.map(match => {
            const nameMatch = match.match(/"name"\s*:\s*"([^"]+)"/);
            const typeMatch = match.match(/"type"\s*:\s*"([^"]+)"/);
            const parentMatch = match.match(/"parent"\s*:\s*([^,}]+)/);
            return {
              name: nameMatch ? nameMatch[1].trim() : '',
              type: typeMatch ? typeMatch[1].trim().toUpperCase() : 'DIRECTION',
              parent: parentMatch ? (parentMatch[1].trim() === 'null' ? null : parentMatch[1].replace(/"/g, '').trim()) : null
            };
          }).filter(e => e.name);
          
          if (entities.length > 0) {
            parsed = { entities };
            console.log("🔵 Entités extraites manuellement:", parsed);
          } else {
            toast.error("Impossible d'extraire les entités du JSON");
            return;
          }
        } else {
          toast.error("Impossible de parser le JSON: " + parseError.message);
          return;
        }
      }
      
      if (parsed && parsed.entities && parsed.entities.length > 0) {
        // Valider les entités extraites
        const validEntities = [];
        const errors = [];
        const validTypes = ["FILIALE", "DIRECTION", "SERVICE", "DÉPARTEMENT"];
        
        for (const entity of parsed.entities) {
          const normalizedType = (entity.type || "DIRECTION").toUpperCase();
          if (!validTypes.includes(normalizedType)) {
            errors.push(`Type "${entity.type}" invalide pour "${entity.name}"`);
            continue;
          }
          if (!entity.name || entity.name.trim() === '') {
            errors.push(`Entité sans nom trouvée`);
            continue;
          }
          validEntities.push({
            name: entity.name.trim(),
            type: normalizedType,
            parent: entity.parent || null
          });
        }
        
        if (validEntities.length === 0) {
          toast.error("Aucune entité valide trouvée");
          return;
        }
        
        console.log(`🔵 ${validEntities.length} entités valides trouvées`);
        console.log("🔵 Entités:", validEntities.map(e => `${e.name} (${e.type}) -> ${e.parent || 'Racine'}`).join(', '));
        
        // Insérer les entités
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
        
        // Créer une liste complète des entités pour la validation
        const allEntitiesForValidation = [
          ...entities,
          ...validEntities.map(e => ({
            id: insertedIds.get(e.name),
            name: e.name,
            type: e.type,
            parentId: null,
          } as Entity))
        ];
        
        // Mettre à jour les parents avec validation
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
            // Vérifier si le parent existe déjà dans la base
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
          toast.warning(`${validEntities.length} entités importées avec ${errors.length} erreurs: ${errors.join(', ')}`);
        } else {
          toast.success(`✅ ${validEntities.length} entités importées en ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
        }
      } else {
        toast.error("Aucune entité trouvée dans le PDF");
      }
    } catch (err: any) {
      console.error("🔴 ERREUR COMPLÈTE:", err);
      toast.error(`❌ Erreur: ${err.message}`);
    }
    console.log("🔵 === FIN TRAITEMENT PDF ===");
  };

  const navigateToInventory = () => {
    if (panelEntity && isLowLevel(panelEntity.type)) {
      if (onNavigate) onNavigate("inventory", panelEntity.id);
      else { localStorage.setItem("currentDepartmentId", panelEntity.id); window.location.href = "/?section=inventory"; }
    }
  };

  // ✅ Rendu des enfants dans le panneau de droite - VERSION AMÉLIORÉE
  const renderChildren = (children: Entity[], parentType?: string) => {
    if (children.length === 0) return null;
    
    const services = children.filter(c => c.type?.toUpperCase() === "SERVICE");
    const departments = children.filter(c => c.type?.toUpperCase() === "DÉPARTEMENT");
    const directions = children.filter(c => c.type?.toUpperCase() === "DIRECTION");
    
    // Si on est dans une Filiale, on affiche les Directions
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
    
    // Si on est dans une Direction, on affiche Services et Départements
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
    
    // Fallback : affichage générique
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
            <input type="file" accept=".xlsx,.xls,.csv,.pdf" onChange={handleFileImport} className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90" />
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

                    {/* Affichage des enfants selon le type - VERSION AMÉLIORÉE */}
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
                        
                        {/* Processus directement attachés à la Direction */}
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