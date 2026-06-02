import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Building2, Trash2, Sparkles, Loader2, CheckCircle2, Pencil, Save, X, Rocket } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGovernance } from "@/contexts/GovernanceContext";
import { useRole } from "@/contexts/RoleContext";
import { useBia } from "@/contexts/BiaContext";
import { type Entity, type EntityType, type EntityStatus, ENTITY_TYPES, ENTITY_STATUSES, SECTORS, defaultMaturity } from "@/data/governance";
import { type Process, type Criticality } from "@/data/bia";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;

const SUB_TYPES: EntityType[] = ["Filiale", "Direction", "Service", "Département"];
const COMPANY_SIZES = ["Moins de 50", "50-200", "200-500", "500-2000", "Plus de 2000 employés"] as const;

const buildTree = (entities: Entity[], parentId: string | null = null): Entity[] =>
  entities.filter((e) => e.parentId === parentId).map((e) => ({ ...e, children: buildTree(entities, e.id) }));

const StatusBadge = ({ status }: { status: EntityStatus }) => {
  const cls =
    status === "Actif" ? "bg-success text-success-foreground hover:bg-success/90"
    : status === "En cours de création" ? "bg-accent text-accent-foreground"
    : "bg-muted text-muted-foreground";
  return <Badge className={cls}>{status}</Badge>;
};

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

type SubForm = {
  name: string; type: EntityType; country: string; sector: string;
  referent: string; referentBackup: string; status: EntityStatus;
};
const emptySubForm = (): SubForm => ({
  name: "", type: "Direction", country: "", sector: "", referent: "", referentBackup: "", status: "Actif",
});

const Node = ({
  node, depth, onDelete, onSelect, onAddSub, canWrite, canAdmin,
}: {
  node: Entity; depth: number;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
  onAddSub: (parentId: string, form: SubForm) => void;
  canWrite: boolean; canAdmin: boolean;
}) => {
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const [sub, setSub] = useState<SubForm>(emptySubForm());
  const hasChildren = (node.children?.length ?? 0) > 0;
  const m = node.maturity ?? defaultMaturity(node.pcaStatus);

  const submitSub = () => {
    if (!sub.name || !sub.country || !sub.sector) { toast.error("Champs obligatoires manquants"); return; }
    onAddSub(node.id, sub);
    setSub(emptySubForm());
    setAdding(false);
  };

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
          <Building2 className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-6 gap-2 items-center">
            <span className="font-medium text-sm truncate">{node.name}</span>
            <Badge variant="outline" className="text-xs w-fit">{node.type || "—"}</Badge>
            <span className="text-xs text-muted-foreground">{node.country}</span>
            <span className="text-xs text-muted-foreground truncate">{node.sector}</span>
            <span className="text-xs truncate">{node.referent}</span>
            <div className="flex gap-1.5 flex-wrap">
              <StatusBadge status={node.status} />
              <PcaBadge s={node.pcaStatus} />
            </div>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
            {canWrite && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAdding((v) => !v)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Sous-entité
              </Button>
            )}
            {canWrite && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onSelect(node.id)}><Pencil className="h-3.5 w-3.5" /></Button>}
            {canAdmin && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(node.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
          </div>
        </div>
        <div className="mt-1.5 ml-10 flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-secondary overflow-hidden max-w-xs">
            <div className={cn("h-full transition-all", maturityColor(m))} style={{ width: `${m}%` }} />
          </div>
          <span className="text-[10px] font-medium text-muted-foreground tabular-nums">Maturité {m}%</span>
        </div>
      </div>

      {adding && (
        <div className="mx-3 my-2 p-3 border border-primary/30 bg-primary/5 rounded-lg" style={{ marginLeft: `${depth * 24 + 36}px` }} onClick={(e) => e.stopPropagation()}>
          <div className="text-xs font-semibold text-foreground mb-2">Nouvelle sous-entité de « {node.name} »</div>
          <div className="grid md:grid-cols-3 gap-2">
            <div><Label className="text-xs">Nom *</Label><Input className="h-8" value={sub.name} onChange={(e) => setSub({ ...sub, name: e.target.value })} /></div>
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={sub.type} onValueChange={(v) => setSub({ ...sub, type: v as EntityType })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>{SUB_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Pays *</Label><Input className="h-8" value={sub.country} onChange={(e) => setSub({ ...sub, country: e.target.value })} /></div>
            <div>
              <Label className="text-xs">Secteur *</Label>
              <Select value={sub.sector} onValueChange={(v) => setSub({ ...sub, sector: v })}>
                <SelectTrigger className="h-8"><SelectValue placeholder="Secteur" /></SelectTrigger>
                <SelectContent>{SECTORS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Référent PCA</Label><Input className="h-8" value={sub.referent} onChange={(e) => setSub({ ...sub, referent: e.target.value })} /></div>
            <div><Label className="text-xs">Référent backup</Label><Input className="h-8" value={sub.referentBackup} onChange={(e) => setSub({ ...sub, referentBackup: e.target.value })} /></div>
            <div>
              <Label className="text-xs">Statut</Label>
              <Select value={sub.status} onValueChange={(v) => setSub({ ...sub, status: v as EntityStatus })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>{ENTITY_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setSub(emptySubForm()); }}>Annuler</Button>
            <Button size="sm" onClick={submitSub}><Plus className="h-3.5 w-3.5 mr-1" /> Ajouter</Button>
          </div>
        </div>
      )}

      {hasChildren && open && (
        <div>
          {node.children!.map((c) => (
            <Node key={c.id} node={c} depth={depth + 1} onDelete={onDelete} onSelect={onSelect} onAddSub={onAddSub} canWrite={canWrite} canAdmin={canAdmin} />
          ))}
        </div>
      )}
    </div>
  );
};

type SuggestionProc = { name: string; criticality: Criticality; checked: boolean };
type SuggestionGroup = { entityId: string; entityName: string; processes: SuggestionProc[] };

type EditFormState = {
  name: string; type: EntityType | ""; country: string; sector: string;
  referent: string; referentBackup: string; contact: string;
  parentId: string; status: EntityStatus;
};
const emptyEditForm: EditFormState = {
  name: "", type: "", country: "", sector: "",
  referent: "", referentBackup: "", contact: "",
  parentId: "", status: "Actif",
};

export const OrgChart = () => {
  const { entities, setEntities, setSelectedEntityId } = useGovernance();
  const { processes } = useBia();
  const { can } = useRole();

  const [panelId, setPanelId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState>(emptyEditForm);

  // Setup form (step 1)
  const [setup, setSetup] = useState({ name: "", sector: "", country: "", size: "", subsidiaries: 0 });

  // Track entities created since last AI generation
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  // AI state
  const [aiLoading, setAiLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionGroup[] | null>(null);

  const tree = buildTree(entities);
  const panelEntity = entities.find((e) => e.id === panelId) || null;
  const panelProcesses = panelEntity ? processes.filter((p) => p.entityId === panelEntity.id) : [];
  const panelParent = panelEntity ? entities.find((e) => e.id === panelEntity.parentId) : null;

  const addEntity = (e: Entity) => {
    setEntities([...entities, e]);
    setPendingIds((prev) => { const n = new Set(prev); n.add(e.id); return n; });
  };

  const createCompany = () => {
    if (!can("write")) { toast.error("Permissions insuffisantes"); return; }
    if (!setup.name || !setup.sector || !setup.country || !setup.size) { toast.error("Champs obligatoires manquants"); return; }
    const root: Entity = {
      id: `e${Date.now()}`,
      name: setup.name, type: "Groupe", country: setup.country, sector: setup.sector,
      parentId: null, referent: "—", referentBackup: "—",
      status: "Actif", pcaStatus: "Non démarré", maturity: 20,
    };
    const all: Entity[] = [root];
    const n = Math.max(0, Math.min(20, Number(setup.subsidiaries) || 0));
    for (let i = 1; i <= n; i++) {
      all.push({
        id: `e${Date.now()}-f${i}`,
        name: `Filiale ${i}`, type: "Filiale", country: setup.country, sector: setup.sector,
        parentId: root.id, referent: "—", referentBackup: "—",
        status: "En cours de création", pcaStatus: "Non démarré", maturity: 20,
      });
    }
    setEntities(all);
    setPendingIds(new Set(all.map((e) => e.id)));
    toast.success(`Entreprise « ${setup.name} » créée avec ${n} filiale(s)`);
  };

  const addSubEntity = (parentId: string, sub: SubForm) => {
    if (!can("write")) { toast.error("Permissions insuffisantes"); return; }
    const e: Entity = {
      id: `e${Date.now()}`,
      name: sub.name, type: sub.type, country: sub.country, sector: sub.sector,
      parentId, referent: sub.referent || "—", referentBackup: sub.referentBackup || "—",
      status: sub.status, pcaStatus: "Non démarré", maturity: 20,
    };
    addEntity(e);
    toast.success("Sous-entité ajoutée");
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
    setPendingIds((prev) => { const n = new Set(prev); toRemove.forEach((x) => n.delete(x)); return n; });
    if (panelId && toRemove.has(panelId)) { setPanelId(null); setEditing(false); }
    toast.success("Entité supprimée");
  };

  const openPanel = (id: string) => {
    setPanelId(id); setSelectedEntityId(id); setEditing(false);
    const e = entities.find((x) => x.id === id);
    if (e) {
      setEditForm({
        name: e.name, type: e.type || "", country: e.country, sector: e.sector,
        referent: e.referent, referentBackup: e.referentBackup, contact: e.contact || "",
        parentId: e.parentId || "", status: e.status,
      });
    }
  };

  const saveEdit = async () => {
    if (!panelEntity) return;
    if (!can("write")) { toast.error("Permissions insuffisantes"); return; }
    if (!editForm.name || !editForm.country || !editForm.sector) { toast.error("Champs obligatoires manquants"); return; }
    if (editForm.parentId === panelEntity.id) { toast.error("Une entité ne peut pas être son propre parent"); return; }
    await (supabase as any)
      .from('organisations')
      .update({
        name: editForm.name,
        type: editForm.type?.toUpperCase(),
        country_code: editForm.country,
        sector: editForm.sector,
        parent_id: editForm.parentId || null,
        pca_referent: editForm.referent,
      })
      .eq('id', panelEntity.id);
    setEntities(entities.map((e) => e.id === panelEntity.id ? {
      ...e,
      name: editForm.name,
      type: (editForm.type || undefined) as EntityType | undefined,
      country: editForm.country, sector: editForm.sector,
      referent: editForm.referent || "—", referentBackup: editForm.referentBackup || "—",
      contact: editForm.contact || undefined,
      parentId: editForm.parentId || null,
      status: editForm.status,
    } : e));
    setEditing(false);
    toast.success("Entité mise à jour");
  };

  const generateAi = async () => {
    const targets = entities.filter((e) => pendingIds.has(e.id));
    if (targets.length === 0) {
      toast.info("Aucune nouvelle entité depuis la dernière génération. Ajoutez des entités pour générer des processus.");
      return;
    }
    setAiLoading(true);
    setSuggestions(null);
    try {
      const payload = targets.map((e) => ({ id: e.id, name: e.name, type: e.type, sector: e.sector, country: e.country }));
      const { data, error } = await supabase.functions.invoke("org-process-suggester", { body: { entities: payload } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const groups = ((data as any).groups || []) as { entityId: string; entityName: string; processes: { name: string; criticality: Criticality }[] }[];
      setSuggestions(groups.map((g) => ({
        entityId: g.entityId, entityName: g.entityName,
        processes: g.processes.map((p) => ({ name: p.name, criticality: p.criticality, checked: true })),
      })));
      toast.success(`Processus générés pour ${targets.length} entité(s)`);
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de la génération");
    } finally {
      setAiLoading(false);
    }
  };

  const updateSuggestion = (gi: number, pi: number, patch: Partial<SuggestionProc>) => {
    setSuggestions((prev) => {
      if (!prev) return prev;
      const next = prev.map((g) => ({ ...g, processes: g.processes.map((p) => ({ ...p })) }));
      next[gi].processes[pi] = { ...next[gi].processes[pi], ...patch };
      return next;
    });
  };

  const addCustomProcess = (gi: number) => {
    setSuggestions((prev) => {
      if (!prev) return prev;
      const next = prev.map((g) => ({ ...g, processes: g.processes.map((p) => ({ ...p })) }));
      next[gi].processes.push({ name: "Nouveau processus", criticality: "Modéré", checked: true });
      return next;
    });
  };

  // ============================================================
  // ANCIENNE FONCTION D'IMPORT IA - DÉSACTIVÉE (plus utilisée)
  // ============================================================
  /*
  const importToBia = () => {
    if (!suggestions) return;
    let count = 0;
    suggestions.forEach((g, gi) => {
      const entity = entities.find((e) => e.id === g.entityId);
      g.processes.forEach((p, pi) => {
        if (!p.checked) return;
        if (!p.name.trim()) return;
        const rto = p.criticality === "Critique" ? 4 : p.criticality === "Majeur" ? 24 : p.criticality === "Modéré" ? 72 : 168;
        const proc: Process = {
          id: `pai-${Date.now()}-${gi}-${pi}`,
          name: p.name.trim(),
          entityId: entity?.id || entities[0]?.id || "e1",
          department: g.entityName,
          owner: entity?.referent || "—",
          description: `Processus importé depuis l'organigramme pour ${g.entityName}`,
          status: "Nouveau",
          impacts: emptyImpacts(),  // ← nécessite import depuis bia.ts
          rto, rpo: Math.max(1, Math.round(rto / 4)), mtpd: rto * 2, mbco: 60,
          resources: [], dependsOn: [],
          lastUpdated: new Date().toISOString().slice(0, 10),
        };
        upsertProcess(proc); // ← fonction manquante
        count++;
      });
    });
    toast.success(`${count} processus importés dans le BIA`);
    setSuggestions(null);
    setPendingIds(new Set());
  };
  */

  // STEP 1 — Setup wizard if no entity exists
  if (entities.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Organigramme du Groupe</h1>
          <p className="text-muted-foreground mt-1">Démarrez par la configuration de votre entreprise</p>
        </div>
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5 max-w-3xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center"><Rocket className="h-5 w-5 text-primary" /></div>
              <div>
                <CardTitle>Configurer votre entreprise</CardTitle>
                <CardDescription>Ces informations créeront l'entité racine de votre organigramme</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-3">
              <div className="md:col-span-2"><Label>Nom de l'entreprise *</Label><Input value={setup.name} onChange={(e) => setSetup({ ...setup, name: e.target.value })} placeholder="Ex. Groupe Atlas Holding" /></div>
              <div>
                <Label>Secteur d'activité *</Label>
                <Select value={setup.sector} onValueChange={(v) => setSetup({ ...setup, sector: v })}>
                  <SelectTrigger><SelectValue placeholder="Choisir un secteur" /></SelectTrigger>
                  <SelectContent>{SECTORS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Pays *</Label><Input value={setup.country} onChange={(e) => setSetup({ ...setup, country: e.target.value })} placeholder="Ex. France" /></div>
              <div>
                <Label>Taille *</Label>
                <Select value={setup.size} onValueChange={(v) => setSetup({ ...setup, size: v })}>
                  <SelectTrigger><SelectValue placeholder="Effectif" /></SelectTrigger>
                  <SelectContent>{COMPANY_SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Nombre de filiales</Label><Input type="number" min={0} value={setup.subsidiaries} onChange={(e) => setSetup({ ...setup, subsidiaries: Number(e.target.value) })} /></div>
            </div>
            <div className="flex justify-end">
              <Button size="lg" onClick={createCompany}><Rocket className="h-4 w-4 mr-2" /> Créer mon entreprise</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pendingCount = pendingIds.size;

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Nom', 'Type', 'Pays', 'Secteur', 'Référent PCA', 'Référent Backup', 'Entité Parente'],
      ['Groupe Atlas Holding', 'GROUPE', 'France', 'Banque & Finance', 'Marie Dubois', 'Pierre Leroy', ''],
      ['Direction IT', 'DIRECTION', 'France', 'Banque & Finance', 'Thomas Robert', 'Jean Martin', 'Groupe Atlas Holding'],
      ['Direction Finance', 'DIRECTION', 'France', 'Banque & Finance', 'Sophie Leroy', 'Marc Dupont', 'Groupe Atlas Holding'],
    ]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Organigramme'); XLSX.writeFile(wb, 'modele_organigramme.xlsx');
  };

  // ==================== IMPORT PDF AVEC OCR ====================
  const insertEntitiesFromAI = async (entitiesFromAI: Array<{name: string, type: string, parent: string | null}>) => {
    const insertedIds = new Map();
    for (const entity of entitiesFromAI) {
      const { data, error } = await (supabase as any)
        .from('organisations')
        .insert({
          name: entity.name,
          type: (entity.type || 'DEPARTMENT').toUpperCase(),
          country_code: 'FR',
          sector: 'Général',
          parent_id: null,
          pca_referent: 'À définir',
          status: 'ACTIVE'
        })
        .select()
        .single();
      if (error) console.error(`Erreur ${entity.name}:`, error);
      else { insertedIds.set(entity.name, data.id); console.log(`✅ Inséré: ${entity.name}`); }
    }
    for (const entity of entitiesFromAI) {
      if (entity.parent && insertedIds.has(entity.parent)) {
        const entityId = insertedIds.get(entity.name);
        const parentId = insertedIds.get(entity.parent);
        await (supabase as any).from('organisations').update({ parent_id: parentId }).eq('id', entityId);
        console.log(`🔗 Lié: ${entity.name} → ${entity.parent}`);
      }
    }
    const { data: allEntities } = await (supabase as any).from('organisations').select('*');
    if (allEntities) {
      const formatted = allEntities.map((e: any) => ({
        id: e.id,
        name: e.name,
        type: e.type,
        country: e.country_code,
        sector: e.sector || 'Général',
        parentId: e.parent_id,
        referent: e.pca_referent || '—',
        referentBackup: '—',
        status: 'Actif',
        pcaStatus: 'Non démarré',
        maturity: 20,
      }));
      setEntities(formatted);
    }
  };

  const processFileWithAI = async (file: File) => {
    const startTime = Date.now();
    try {
      if (file.type !== "application/pdf") { toast.error("Format non supporté. Utilisez un PDF."); return; }
      console.log("📄 Analyse du PDF...");
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);
      const textContent = await page.getTextContent();
      let extractedText = textContent.items.map((item: any) => item.str).join(' ');
      if (!extractedText || extractedText.trim().length < 10) {
        console.log("📄 Texte non trouvé, tentative d'OCR...");
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: context, viewport }).promise;
        const imageData = canvas.toDataURL('image/png');
        const { data: { text } } = await Tesseract.recognize(imageData, 'fra', { logger: (m) => console.log(m) });
        extractedText = text;
        console.log("📝 OCR extrait :", extractedText);
      }
      console.log("📝 Texte extrait:", extractedText);
      const response = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "mistral",
          prompt: `Extrais l'organigramme de ce texte: "${extractedText}"
RÈGLES:
- "Niveau 1 : X" → X est la RACINE (parent = null)
- TOUS les noms après les tirets "-" sont les ENFANTS de la racine
Retourne UNIQUEMENT le JSON: {"entities":[{"name":"Direction Skillia","type":"DIRECTION","parent":null},{"name":"Direction Financière","type":"DIRECTION","parent":"Direction Skillia"}]}`,
          options: { temperature: 0, num_predict: 500 },
          stream: false
        })
      });
      const result = await response.json();
      let cleanResponse = result.response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const firstBrace = cleanResponse.indexOf('{');
      const lastBrace = cleanResponse.lastIndexOf('}');
      const jsonStr = cleanResponse.substring(firstBrace, lastBrace + 1);
      const parsed = JSON.parse(jsonStr);
      if (parsed.entities && Array.isArray(parsed.entities)) {
        await insertEntitiesFromAI(parsed.entities);
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        toast.success(`✅ ${parsed.entities.length} entités importées en ${duration}s`);
      } else {
        toast.error("Aucune entité trouvée dans le PDF");
      }
    } catch (err: any) {
      console.error("Erreur détaillée:", err);
      toast.error(`Erreur: ${err.message}`);
    }
  };

  // ==================== IMPORT EXCEL ====================
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type === "application/pdf") { await processFileWithAI(file); e.target.value = ''; return; }
    if (file.type.startsWith("image/")) { toast.info("Le support des images arrive bientôt. Veuillez utiliser un PDF pour l'instant."); e.target.value = ''; return; }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);
        const insertedEntities: Entity[] = [];

        // Étape 1: Insérer toutes les entités sans parent
        for (const row of rows) {
          const entityToInsert = {
            name: row['Nom'] || '',
            type: (row['Type'] || 'DIRECTION').toUpperCase(),
            country_code: row['Pays'] || '',
            sector: row['Secteur'] || '',
            parent_id: null,
            pca_referent: row['Référent PCA'] || '—',
            status: 'ACTIVE'
          };
          const { data: inserted, error } = await (supabase as any)
            .from('organisations')
            .insert(entityToInsert)
            .select()
            .single();
          if (error) {
            console.error(error);
            toast.error(error.message);
            continue;
          }
          insertedEntities.push({
            id: inserted.id,
            name: inserted.name,
            type: inserted.type,
            country: inserted.country_code,
            sector: inserted.sector,
            parentId: null,
            referent: inserted.pca_referent || '—',
            referentBackup: '—',
            status: 'Actif',
            pcaStatus: 'Non démarré',
            maturity: 20,
          });
        }

        // Étape 2: Assigner les parents (après toutes les insertions)
        for (let i = 0; i < rows.length; i++) {
          const parentName = rows[i]['Entité Parente'];
          if (!parentName) continue;
          const currentEntity = insertedEntities[i];
          const parentEntity = insertedEntities.find((x) => x.name === parentName);
          if (!parentEntity) continue;
          await (supabase as any)
            .from('organisations')
            .update({ parent_id: parentEntity.id })
            .eq('id', currentEntity.id);
          currentEntity.parentId = parentEntity.id;
        }

        // Étape 3: Mettre à jour l'état local
        setEntities([...entities, ...insertedEntities]);
        toast.success(`${insertedEntities.length} entités importées avec succès !`);
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || "Erreur import");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Organigramme du Groupe</h1>
        <p className="text-muted-foreground mt-1">Hiérarchie des entités, filiales, directions et services</p>
      </div>

      {/* Tree */}
      <Card>
        <CardHeader>
          <CardTitle>Arborescence des entités</CardTitle>
          <CardDescription>Cliquez sur une entité pour voir ses détails. Survolez pour ajouter une sous-entité, éditer ou supprimer.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="hidden md:grid grid-cols-6 gap-2 px-3 pb-2 ml-12 text-xs font-semibold text-muted-foreground border-b border-border">
            <span>Entité</span><span>Type</span><span>Pays</span><span>Secteur</span><span>Référent PCA</span><span>Statut</span>
          </div>
          <div className="mt-2">
            {tree.map((n) => <Node key={n.id} node={n} depth={0} onDelete={handleDelete} onSelect={openPanel} onAddSub={addSubEntity} canWrite={can("write")} canAdmin={can("admin")} />)}
          </div>
        </CardContent>
      </Card>

      {/* Assistant IA – désactivé (commenté) */}
      {/*
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Assistant IA — processus métiers</h3>
                <p className="text-sm text-muted-foreground">
                  L'IA génère les processus uniquement pour les <strong>nouvelles entités</strong> ajoutées depuis la dernière génération.
                  {pendingCount > 0 ? ` (${pendingCount} entité(s) en attente)` : " (aucune entité en attente)"}
                </p>
              </div>
            </div>
            <Button size="lg" onClick={generateAi} disabled={aiLoading || pendingCount === 0} className="bg-primary hover:bg-primary/90">
              {aiLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {aiLoading ? "Analyse de votre structure organisationnelle..." : "🤖 Générer les processus avec l'IA"}
            </Button>
          </div>
        </CardContent>
      </Card>
      */}

      {/* Suggestions IA (commentées) */}
      {/*
      {suggestions && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Processus suggérés par l'IA</CardTitle>
            <CardDescription>Validez, éditez ou ajoutez des processus avant import dans le BIA</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {suggestions.length === 0 && <p className="text-sm text-muted-foreground italic">Aucune suggestion retournée par l'IA.</p>}
            {suggestions.map((g, gi) => (
              <div key={gi} className="border border-border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">{g.entityName}</span>
                  <Badge variant="outline" className="text-xs">{g.processes.length}</Badge>
                </div>
                <div className="space-y-1.5">
                  {g.processes.map((p, pi) => (
                    <div key={pi} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-secondary/60">
                      <Checkbox checked={p.checked} onCheckedChange={(c) => updateSuggestion(gi, pi, { checked: !!c })} />
                      <Input
                        value={p.name}
                        onChange={(e) => updateSuggestion(gi, pi, { name: e.target.value })}
                        className="h-8 text-sm flex-1"
                      />
                      <Select value={p.criticality} onValueChange={(v) => updateSuggestion(gi, pi, { criticality: v as Criticality })}>
                        <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(["Critique", "Majeur", "Modéré", "Mineur"] as Criticality[]).map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Badge variant="outline" className={cn("text-[10px]", critColor(p.criticality))}>{p.criticality}</Badge>
                    </div>
                  ))}
                </div>
                <div className="mt-2">
                  <Button size="sm" variant="outline" onClick={() => addCustomProcess(gi)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter un processus
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="ghost" onClick={() => setSuggestions(null)}>Annuler</Button>
              <Button onClick={importToBia} className="bg-success text-success-foreground hover:bg-success/90">
                <CheckCircle2 className="h-4 w-4 mr-1" /> Valider et importer dans le BIA
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      */}

      {/* Fiche détail */}
      <Sheet open={!!panelEntity} onOpenChange={(o) => { if (!o) { setPanelId(null); setEditing(false); } }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {panelEntity && (() => {
            const m = panelEntity.maturity ?? defaultMaturity(panelEntity.pcaStatus);
            return (
              <div className="space-y-5">
                <SheetHeader>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center"><Building2 className="h-5 w-5 text-primary" /></div><div><SheetTitle>{panelEntity.name}</SheetTitle><SheetDescription>{panelEntity.type || "—"} · {panelEntity.sector}</SheetDescription></div></div>
                    {!editing && (<div className="flex gap-1">{can("write") && <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5 mr-1" /> Éditer</Button>}{can("admin") && <Button variant="outline" size="sm" className="text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => handleDelete(panelEntity.id)}><Trash2 className="h-3.5 w-3.5 mr-1" /> Supprimer</Button>}</div>)}
                  </div>
                </SheetHeader>
                {editing ? (
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-3">
                      <div><Label>Nom *</Label><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></div>
                      <div>
                        <Label>Type</Label>
                        <Select value={editForm.type} onValueChange={(v) => setEditForm({ ...editForm, type: v as EntityType })}>
                          <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                          <SelectContent>{ENTITY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div><Label>Pays *</Label><Input value={editForm.country} onChange={(e) => setEditForm({ ...editForm, country: e.target.value })} /></div>
                      <div>
                        <Label>Secteur *</Label>
                        <Select value={editForm.sector} onValueChange={(v) => setEditForm({ ...editForm, sector: v })}>
                          <SelectTrigger><SelectValue placeholder="Secteur" /></SelectTrigger>
                          <SelectContent>{SECTORS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div><Label>Référent PCA</Label><Input value={editForm.referent} onChange={(e) => setEditForm({ ...editForm, referent: e.target.value })} /></div>
                      <div><Label>Référent backup</Label><Input value={editForm.referentBackup} onChange={(e) => setEditForm({ ...editForm, referentBackup: e.target.value })} /></div>
                      <div><Label>Coordonnées</Label><Input value={editForm.contact} onChange={(e) => setEditForm({ ...editForm, contact: e.target.value })} /></div>
                      <div>
                        <Label>Entité parente</Label>
                        <Select value={editForm.parentId || "__root__"} onValueChange={(v) => setEditForm({ ...editForm, parentId: v === "__root__" ? "" : v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__root__">— Racine —</SelectItem>
                            {entities.filter((e) => e.id !== panelEntity.id).map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Statut</Label>
                        <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v as EntityStatus })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{ENTITY_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-border">
                      <Button variant="ghost" onClick={() => setEditing(false)}><X className="h-4 w-4 mr-1" /> Annuler</Button>
                      <Button onClick={saveEdit}><Save className="h-4 w-4 mr-1" /> Enregistrer</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2"><h4 className="text-xs font-semibold text-muted-foreground uppercase">Détails</h4><div className="grid grid-cols-2 gap-2 text-sm"><div className="text-muted-foreground">Type</div><div className="font-medium">{panelEntity.type || "—"}</div><div className="text-muted-foreground">Pays</div><div className="font-medium">{panelEntity.country}</div><div className="text-muted-foreground">Secteur</div><div className="font-medium">{panelEntity.sector}</div><div className="text-muted-foreground">Entité parente</div><div className="font-medium">{panelParent?.name || "Racine"}</div><div className="text-muted-foreground">Statut</div><div><StatusBadge status={panelEntity.status} /></div><div className="text-muted-foreground">Statut PCA</div><div><PcaBadge s={panelEntity.pcaStatus} /></div></div></div>
                    <div className="space-y-2"><h4 className="text-xs font-semibold text-muted-foreground uppercase">Référent PCA</h4><div className="rounded-md border border-border p-3 text-sm space-y-1"><div><span className="text-muted-foreground">Principal:</span> <span className="font-medium">{panelEntity.referent}</span></div><div><span className="text-muted-foreground">Suppléant:</span> <span className="font-medium">{panelEntity.referentBackup}</span></div><div><span className="text-muted-foreground">Coordonnées:</span> <span className="font-medium">{panelEntity.contact || "—"}</span></div></div></div>
                    <div className="space-y-2"><div className="flex items-center justify-between"><h4 className="text-xs font-semibold text-muted-foreground uppercase">Maturité PCA</h4><span className="text-sm font-bold">{m}%</span></div><div className="h-3 w-full rounded-full bg-secondary overflow-hidden"><div className={cn("h-full transition-all", maturityColor(m))} style={{ width: `${m}%` }} /></div><p className="text-xs text-muted-foreground">{m < 50 ? "Niveau faible — actions urgentes requises" : m < 75 ? "Niveau intermédiaire — améliorations recommandées" : "Niveau élevé — bonne maturité"}</p></div>
                    <div className="space-y-2"><h4 className="text-xs font-semibold text-muted-foreground uppercase">Processus associés ({panelProcesses.length})</h4>{panelProcesses.length === 0 ? <p className="text-sm text-muted-foreground italic">Aucun processus associé. Utilisez l'assistant IA pour en générer.</p> : <div className="space-y-1.5">{panelProcesses.map((p) => (<div key={p.id} className="flex items-center justify-between p-2 rounded border border-border text-sm"><span className="truncate">{p.name}</span><Badge variant="outline" className="text-xs">RTO {p.rto}h</Badge></div>))}</div>}</div>
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