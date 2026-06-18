import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Building2, Trash2, Pencil, Save, X, ExternalLink } from "lucide-react";
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
import { type Entity, type EntityType, ENTITY_TYPES, defaultMaturity } from "@/data/governance";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;

// ✅ FIX: Helper pour détecter un département peu importe la casse
const isDept = (type?: string) => 
  ["département", "departement", "dept"].includes((type || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

const buildTree = (entities: Entity[], parentId: string | null = null): Entity[] =>
  entities.filter((e) => e.parentId === parentId).map((e) => ({ ...e, children: buildTree(entities, e.id) }));

const PcaBadge = ({ s }: { s: Entity["pcaStatus"] }) => {
  const map: Record<Entity["pcaStatus"], string> = {
    "Validé": "bg-success text-success-foreground",
    "En cours": "bg-accent text-accent-foreground",
    "À réviser": "bg-warning text-warning-foreground",
    "Non démarré": "bg-muted text-muted-foreground",
  };
  return <Badge className={cn("hover:opacity-90", map[s])}>{s}</Badge>;
};

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
          <Building2 className={`h-4 w-4 shrink-0 ${isDept(node.type) ? "text-muted-foreground" : "text-primary"}`} />
          <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-5 gap-2 items-center">
            <span className="font-medium text-sm truncate">{node.name}</span>
            <span className="text-xs text-muted-foreground">{node.type || "—"}</span>
            <span className="text-xs text-muted-foreground">{node.country}</span>
            <span className="text-xs truncate">{node.referent}</span>
            <div className="flex gap-1.5 flex-wrap">
              <PcaBadge s={node.pcaStatus} />
            </div>
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

  // ✅ FIX: Utilise isDept() au lieu de === "Département"
  const departmentProcesses = (() => {
    if (!panelEntity || !isDept(panelEntity.type)) return [];
    const byId = processes.filter(p => p.entityId === panelEntity.id);
    const byName = processes.filter(p => p.department === panelEntity.name);
    const byParentDirection = panelParent ? processes.filter(p => p.entityId === panelParent.id) : [];
    const all = [...byId, ...byName, ...byParentDirection];
    return Array.from(new Map(all.map(p => [p.id, p])).values());
  })();

  const submitInline = async () => {
    if (!can("write")) { toast.error("Permissions insuffisantes"); return; }
    if (!form.name || !form.type || !form.country) { toast.error("Champs obligatoires manquants (nom, type, pays)"); return; }
    const entityToInsert = {
      name: form.name,
      type: form.type?.toUpperCase(),
      country_code: form.country,
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
      country: form.country,
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
    if (!editForm.name || !editForm.country) { toast.error("Champs obligatoires manquants"); return; }
    if (editForm.parentId === panelEntity.id) { toast.error("Une entité ne peut pas être son propre parent"); return; }
    await (supabase as any).from('organisations').update({
      name: editForm.name, type: editForm.type?.toUpperCase(),
      country_code: editForm.country, parent_id: editForm.parentId || null,
      pca_referent: editForm.referent, referent_contact: editForm.referentContact || null,
      referent_backup: editForm.suppleant, referent_backup_contact: editForm.suppleantContact || null,
    }).eq('id', panelEntity.id);
    setEntities(entities.map((e) => e.id === panelEntity.id ? {
      ...panelEntity,
      name: editForm.name, type: (editForm.type || undefined) as EntityType | undefined,
      country: editForm.country, referent: editForm.referent || "—",
      referentContact: editForm.referentContact || undefined,
      referentBackup: editForm.suppleant || "—",
      suppleantContact: editForm.suppleantContact || undefined,
      parentId: editForm.parentId || null,
    } as any : e));
    setEditing(false);
    toast.success("Entité mise à jour");
  };

  const renderFormGrid = (state: FormState, set: (s: FormState) => void, excludeId?: string) => (
    <div className="grid md:grid-cols-3 gap-3">
      <div><Label>Nom *</Label><Input value={state.name} onChange={(e) => set({ ...state, name: e.target.value })} placeholder="Direction Marketing" /></div>
      <div><Label>Type</Label><Select value={state.type} onValueChange={(v) => set({ ...state, type: v as EntityType })}><SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger><SelectContent>{ENTITY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>Pays *</Label><Input value={state.country} onChange={(e) => set({ ...state, country: e.target.value })} placeholder="France" /></div>
      <div><Label>Référent PCA</Label><Input value={state.referent} onChange={(e) => set({ ...state, referent: e.target.value })} placeholder="Nom du responsable" /></div>
      <div><Label>Coordonnées référent</Label><Input value={state.referentContact} onChange={(e) => set({ ...state, referentContact: e.target.value })} placeholder="email ou téléphone" /></div>
      <div><Label>Suppléant</Label><Input value={state.suppleant} onChange={(e) => set({ ...state, suppleant: e.target.value })} placeholder="Nom du suppléant" /></div>
      <div><Label>Coordonnées suppléant</Label><Input value={state.suppleantContact} onChange={(e) => set({ ...state, suppleantContact: e.target.value })} placeholder="email ou téléphone" /></div>
      <div><Label>Entité parente</Label><Select value={state.parentId || "__root__"} onValueChange={(v) => set({ ...state, parentId: v === "__root__" ? "" : v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__root__">— Racine —</SelectItem>{entities.filter((e) => e.id !== excludeId).map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select></div>
    </div>
  );

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Nom', 'Type', 'Pays', 'Référent PCA', 'Coordonnées référent', 'Suppléant', 'Coordonnées suppléant', 'Entité Parente'],
      ['Groupe Atlas Holding', 'GROUPE', 'France', 'Marie Dubois', 'marie@email.com', 'Pierre Leroy', 'pierre@email.com', ''],
      ['Direction Financière', 'DIRECTION', 'France', 'Sophie Leroy', 'sophie@email.com', 'Marc Dupont', 'marc@email.com', 'Groupe Atlas Holding'],
      ['Département Comptabilité', 'DEPARTEMENT', 'France', 'Lucie Bernard', 'lucie@email.com', 'Paul Dubois', 'paul@email.com', 'Direction Financière'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Organigramme');
    XLSX.writeFile(wb, 'modele_organigramme.xlsx');
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type === "application/pdf") { await processFileWithAI(file); e.target.value = ''; return; }
    if (file.type.startsWith("image/")) { toast.info("Le support des images arrive bientôt."); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);
        const insertedEntities: any[] = [];
        for (const row of rows) {
          const { data: inserted, error } = await (supabase as any).from('organisations').insert({
            name: row['Nom'] || '',
            type: (row['Type'] || 'DIRECTION').toUpperCase(),
            country_code: row['Pays'] || '',
            parent_id: null,
            pca_referent: row['Référent PCA'] || '—',
            referent_contact: row['Coordonnées référent'] || null,
            referent_backup: row['Suppléant'] || '—',
            referent_backup_contact: row['Coordonnées suppléant'] || null,
            pca_status: 'Non démarré', maturity: 20, sector: 'Général', status: 'ACTIVE',
          }).select().single();
          if (error) { console.error(error); toast.error(error.message); continue; }
          insertedEntities.push({
            id: inserted.id, name: inserted.name, type: inserted.type,
            country: inserted.country_code, parentId: null,
            referent: inserted.pca_referent || '—',
            referentContact: inserted.referent_contact,
            referentBackup: inserted.referent_backup || '—',
            suppleantContact: inserted.referent_backup_contact,
            status: 'Actif', pcaStatus: inserted.pca_status || 'Non démarré', maturity: inserted.maturity || 20,
          });
        }
        for (let i = 0; i < rows.length; i++) {
          const parentName = rows[i]['Entité Parente'];
          if (!parentName) continue;
          const parentEntity = insertedEntities.find((x) => x.name === parentName);
          if (!parentEntity) continue;
          await (supabase as any).from('organisations').update({ parent_id: parentEntity.id }).eq('id', insertedEntities[i].id);
          insertedEntities[i].parentId = parentEntity.id;
        }
        setEntities([...entities, ...insertedEntities]);
        toast.success(`${insertedEntities.length} entités importées avec succès !`);
      } catch (err: any) { toast.error(err.message || "Erreur import"); }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const insertEntitiesFromAI = async (entitiesFromAI: Array<{name: string, type: string, parent: string | null}>) => {
    const insertedIds = new Map();
    for (const entity of entitiesFromAI) {
      const { data, error } = await (supabase as any).from('organisations').insert({
        name: entity.name, type: (entity.type || 'DIRECTION').toUpperCase(),
        country_code: 'FR', parent_id: null, pca_referent: 'À définir',
        referent_contact: null, referent_backup: '—', referent_backup_contact: null,
        pca_status: 'Non démarré', maturity: 20, sector: 'Général', status: 'ACTIVE',
      }).select().single();
      if (error) console.error(`Erreur ${entity.name}:`, error);
      else { insertedIds.set(entity.name, data.id); }
    }
    for (const entity of entitiesFromAI) {
      if (entity.parent && insertedIds.has(entity.parent)) {
        await (supabase as any).from('organisations').update({ parent_id: insertedIds.get(entity.parent) }).eq('id', insertedIds.get(entity.name));
      }
    }
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
  };

  const processFileWithAI = async (file: File) => {
    const startTime = Date.now();
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);
      const textContent = await page.getTextContent();
      let extractedText = textContent.items.map((item: any) => item.str).join(' ');
      if (!extractedText || extractedText.trim().length < 10) {
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width; canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        const { data: { text } } = await Tesseract.recognize(canvas.toDataURL('image/png'), 'fra');
        extractedText = text;
      }
      const response = await fetch("http://localhost:11434/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "mistral",
          prompt: `Extrais l'organigramme de ce texte: "${extractedText}"
RÈGLES: "Niveau 1 : X" → X est la RACINE (parent = null). TOUS les noms après les tirets "-" sont les ENFANTS de la racine.
Retourne UNIQUEMENT le JSON: {"entities":[{"name":"Direction Skillia","type":"DIRECTION","parent":null},{"name":"Direction Financière","type":"DIRECTION","parent":"Direction Skillia"}]}`,
          options: { temperature: 0, num_predict: 500 }, stream: false
        })
      });
      const result = await response.json();
      let cleanResponse = result.response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const jsonStr = cleanResponse.substring(cleanResponse.indexOf('{'), cleanResponse.lastIndexOf('}') + 1);
      const parsed = JSON.parse(jsonStr);
      if (parsed.entities?.length) {
        await insertEntitiesFromAI(parsed.entities);
        toast.success(`✅ ${parsed.entities.length} entités importées en ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
      } else toast.error("Aucune entité trouvée dans le PDF");
    } catch (err: any) { toast.error(`Erreur: ${err.message}`); }
  };

  const navigateToInventory = () => {
    if (panelEntity && isDept(panelEntity.type)) {
      if (onNavigate) onNavigate("inventory", panelEntity.id);
      else { localStorage.setItem("currentDepartmentId", panelEntity.id); window.location.href = "/?section=inventory"; }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Organigramme du Groupe</h1>
        <p className="text-muted-foreground mt-1">Cliquez sur une entité pour voir ses détails. Les départements affichent leurs processus.</p>
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
            <Button variant="outline" onClick={downloadTemplate}>📥 Télécharger le modèle Excel</Button>
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
          <CardDescription>Cliquez sur un département pour voir ses processus dans le panneau de droite.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="hidden md:grid grid-cols-5 gap-2 px-3 pb-2 ml-12 text-xs font-semibold text-muted-foreground border-b border-border">
            <span>Entité</span><span>Type</span><span>Pays</span><span>Référent PCA</span><span>Statut PCA</span>
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
            // ✅ FIX: Utilise isDept() au lieu de === "Département"
            const isDepartment = isDept(panelEntity.type);
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
                        <div className="text-muted-foreground">Statut PCA</div><div><PcaBadge s={panelEntity.pcaStatus} /></div>
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

                    {isDepartment && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-2">
                          Processus associés
                          <Badge variant="secondary">{departmentProcesses.length}</Badge>
                        </h4>
                        {departmentProcesses.length === 0 ? (
                          <div className="text-sm text-muted-foreground italic bg-yellow-50 p-2 rounded border border-yellow-200">
                            Aucun processus rattaché à ce département.
                            <br />
                            <span className="text-xs">Conseil : Le champ "Département" du processus doit être <strong>"{panelEntity.name}"</strong> ou le processus doit être rattaché à la direction parente.</span>
                          </div>
                        ) : (
                          <div className="overflow-auto max-h-64 border rounded-md">
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
                                {departmentProcesses.map(p => {
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
                        <Button variant="outline" size="sm" className="w-full mt-2 gap-1" onClick={navigateToInventory}>
                          <ExternalLink className="h-3 w-3" />
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