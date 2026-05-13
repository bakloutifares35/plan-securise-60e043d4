import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Building2, Trash2, Sparkles, Loader2, CheckCircle2 } from "lucide-react";
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
import { type Entity, type EntityType, ENTITY_TYPES, defaultMaturity } from "@/data/governance";
import { emptyImpacts, type Process, type Criticality } from "@/data/bia";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Section = "dashboard" | "form" | "plan" | "benchmark" | "orgchart" | "entity" | "calendar" | "policy" | "committee" | "references";

const buildTree = (entities: Entity[], parentId: string | null = null): Entity[] =>
  entities.filter((e) => e.parentId === parentId).map((e) => ({ ...e, children: buildTree(entities, e.id) }));

const StatusBadge = ({ status }: { status: Entity["status"] }) => (
  <Badge variant={status === "Actif" ? "default" : "secondary"} className={status === "Actif" ? "bg-success text-success-foreground hover:bg-success/90" : ""}>
    {status}
  </Badge>
);

const PcaBadge = ({ s }: { s: Entity["pcaStatus"] }) => {
  const map: Record<Entity["pcaStatus"], string> = {
    "Validé": "bg-success text-success-foreground",
    "En cours": "bg-accent text-accent-foreground",
    "À réviser": "bg-warning text-warning-foreground",
    "Non démarré": "bg-muted text-muted-foreground",
  };
  return <Badge className={cn("hover:opacity-90", map[s])}>{s}</Badge>;
};

const critColor = (c: Criticality) => {
  switch (c) {
    case "Critique": return "bg-destructive/15 text-destructive border-destructive/30";
    case "Majeur": return "bg-warning/15 text-warning border-warning/30";
    case "Modéré": return "bg-accent/15 text-accent border-accent/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
};

const maturityColor = (m: number) => {
  if (m < 50) return "bg-destructive";
  if (m < 75) return "bg-warning";
  return "bg-success";
};

const Node = ({
  node, depth, onAdd, onDelete, onSelect,
}: {
  node: Entity; depth: number; onAdd: (parentId: string) => void; onDelete: (id: string) => void; onSelect: (id: string) => void;
}) => {
  const [open, setOpen] = useState(true);
  const hasChildren = (node.children?.length ?? 0) > 0;
  const { can } = useRole();
  return (
    <div>
      <div
        className="flex items-center gap-2 py-2.5 px-3 rounded-md hover:bg-secondary/60 transition-colors group cursor-pointer"
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
        onClick={() => onSelect(node.id)}
      >
        <button onClick={(e) => { e.stopPropagation(); setOpen(!open); }} className="text-muted-foreground hover:text-foreground">
          {hasChildren ? (open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : <span className="inline-block w-4" />}
        </button>
        <Building2 className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-6 gap-2 items-center">
          <span className="font-medium text-sm truncate">{node.name}</span>
          <span className="text-xs text-muted-foreground">{node.type || "—"}</span>
          <span className="text-xs text-muted-foreground">{node.country}</span>
          <span className="text-xs text-muted-foreground truncate">{node.sector}</span>
          <span className="text-xs truncate">{node.referent}</span>
          <div className="flex gap-1.5 flex-wrap">
            <StatusBadge status={node.status} />
            <PcaBadge s={node.pcaStatus} />
          </div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          {can("write") && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onAdd(node.id)}><Plus className="h-3.5 w-3.5" /></Button>}
          {can("admin") && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(node.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
        </div>
      </div>
      {hasChildren && open && (
        <div>
          {node.children!.map((c) => (
            <Node key={c.id} node={c} depth={depth + 1} onAdd={onAdd} onDelete={onDelete} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
};

type Suggestion = { entityId: string; entityName: string; processes: { name: string; criticality: Criticality }[] };

export const OrgChart = ({ onNavigate: _onNavigate }: { onNavigate?: (s: Section) => void }) => {
  const { entities, setEntities, setSelectedEntityId } = useGovernance();
  const { upsertProcess, processes } = useBia();
  const { can } = useRole();

  const [panelId, setPanelId] = useState<string | null>(null);
  const [subDialogParent, setSubDialogParent] = useState<string | null>(null);
  const [subForm, setSubForm] = useState<Partial<Entity>>({ status: "Actif", pcaStatus: "Non démarré" });

  // Inline create form state
  const [form, setForm] = useState<{ name: string; type: EntityType | ""; country: string; sector: string; referent: string; parentId: string }>({
    name: "", type: "", country: "", sector: "", referent: "", parentId: "",
  });

  // AI state
  const [aiLoading, setAiLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [picked, setPicked] = useState<Record<string, boolean>>({});

  const tree = buildTree(entities);
  const panelEntity = entities.find((e) => e.id === panelId) || null;
  const panelProcesses = panelEntity ? processes.filter((p) => p.entityId === panelEntity.id) : [];

  const submitInline = () => {
    if (!can("write")) { toast.error("Permissions insuffisantes"); return; }
    if (!form.name || !form.type || !form.country || !form.sector) { toast.error("Champs obligatoires manquants"); return; }
    const e: Entity = {
      id: `e${Date.now()}`,
      name: form.name, type: form.type as EntityType, country: form.country, sector: form.sector,
      parentId: form.parentId || null,
      referent: form.referent || "—", referentBackup: "—",
      status: "Actif", pcaStatus: "Non démarré", maturity: 20,
    };
    setEntities([...entities, e]);
    setForm({ name: "", type: "", country: "", sector: "", referent: "", parentId: "" });
    toast.success("Entité créée");
  };

  const handleAddChild = (pid: string | null) => {
    if (!can("write")) { toast.error("Permissions insuffisantes"); return; }
    setSubDialogParent(pid ?? "__root__");
    setSubForm({ status: "Actif", pcaStatus: "Non démarré" });
  };

  const handleDelete = (id: string) => {
    if (!can("admin")) { toast.error("Action réservée à l'administrateur"); return; }
    const toRemove = new Set<string>([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const e of entities) if (e.parentId && toRemove.has(e.parentId) && !toRemove.has(e.id)) { toRemove.add(e.id); changed = true; }
    }
    setEntities(entities.filter((e) => !toRemove.has(e.id)));
    if (panelId && toRemove.has(panelId)) setPanelId(null);
    toast.success("Entité supprimée");
  };

  const submitSub = () => {
    if (!subForm.name || !subForm.country || !subForm.sector) { toast.error("Champs obligatoires manquants"); return; }
    const newEntity: Entity = {
      id: `e${Date.now()}`,
      name: subForm.name!, country: subForm.country!, sector: subForm.sector!,
      type: subForm.type as EntityType | undefined,
      parentId: subDialogParent === "__root__" ? null : subDialogParent,
      referent: subForm.referent || "—", referentBackup: subForm.referentBackup || "—",
      status: (subForm.status as Entity["status"]) || "Actif",
      pcaStatus: (subForm.pcaStatus as Entity["pcaStatus"]) || "Non démarré",
      maturity: 20,
    };
    setEntities([...entities, newEntity]);
    setSubDialogParent(null);
    toast.success("Entité créée");
  };

  const generateAi = async () => {
    setAiLoading(true);
    setSuggestions(null);
    try {
      const payload = entities.map((e) => ({ id: e.id, name: e.name, type: e.type, sector: e.sector, country: e.country }));
      const { data, error } = await supabase.functions.invoke("org-process-suggester", { body: { entities: payload } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const groups: Suggestion[] = (data as any).groups || [];
      setSuggestions(groups);
      const init: Record<string, boolean> = {};
      groups.forEach((g, gi) => g.processes.forEach((_, pi) => { init[`${gi}-${pi}`] = true; }));
      setPicked(init);
      toast.success("Processus suggérés générés");
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de la génération");
    } finally {
      setAiLoading(false);
    }
  };

  const importToBia = () => {
    if (!suggestions) return;
    let count = 0;
    suggestions.forEach((g, gi) => {
      const entity = entities.find((e) => e.id === g.entityId);
      g.processes.forEach((p, pi) => {
        if (!picked[`${gi}-${pi}`]) return;
        const rto = p.criticality === "Critique" ? 4 : p.criticality === "Majeur" ? 24 : p.criticality === "Modéré" ? 72 : 168;
        const proc: Process = {
          id: `pai-${Date.now()}-${gi}-${pi}`,
          name: p.name,
          entityId: entity?.id || entities[0]?.id || "e1",
          department: g.entityName,
          owner: entity?.referent || "—",
          description: `Processus suggéré par l'IA pour ${g.entityName}`,
          status: "Actif",
          impacts: emptyImpacts(),
          rto, rpo: Math.max(1, Math.round(rto / 4)), mtpd: rto * 2, mbco: 60,
          resources: [], dependsOn: [],
          lastUpdated: new Date().toISOString().slice(0, 10),
        };
        upsertProcess(proc);
        count++;
      });
    });
    toast.success(`${count} processus importés dans le BIA`);
    setSuggestions(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Organigramme du Groupe</h1>
        <p className="text-muted-foreground mt-1">Hiérarchie des entités, filiales, directions et services</p>
      </div>

      {/* 1. Inline creation form */}
      {can("write") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Plus className="h-4 w-4 text-primary" /> Créer une entité</CardTitle>
            <CardDescription>Ajoutez une nouvelle entité à l'organigramme</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-6 gap-3 items-end">
              <div className="md:col-span-2">
                <Label>Nom *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Direction Marketing" />
              </div>
              <div>
                <Label>Type *</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as EntityType })}>
                  <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Pays *</Label>
                <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="France" />
              </div>
              <div>
                <Label>Secteur *</Label>
                <Input value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} placeholder="Banque" />
              </div>
              <div>
                <Label>Référent PCA</Label>
                <Input value={form.referent} onChange={(e) => setForm({ ...form, referent: e.target.value })} placeholder="Nom" />
              </div>
              <div className="md:col-span-5">
                <Label>Entité parente</Label>
                <Select value={form.parentId || "__root__"} onValueChange={(v) => setForm({ ...form, parentId: v === "__root__" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__root__">— Racine —</SelectItem>
                    {entities.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={submitInline}><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tree */}
      <Card>
        <CardHeader>
          <CardTitle>Arborescence des entités</CardTitle>
          <CardDescription>Cliquez sur une entité pour ouvrir sa fiche</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="hidden md:grid grid-cols-6 gap-2 px-3 pb-2 ml-12 text-xs font-semibold text-muted-foreground border-b border-border">
            <span>Entité</span><span>Type</span><span>Pays</span><span>Secteur</span><span>Référent PCA</span><span>Statut</span>
          </div>
          <div className="mt-2">
            {tree.map((n) => <Node key={n.id} node={n} depth={0} onAdd={handleAddChild} onDelete={handleDelete} onSelect={(id) => { setPanelId(id); setSelectedEntityId(id); }} />)}
          </div>
        </CardContent>
      </Card>

      {/* 3. AI button */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Assistant IA — processus métiers</h3>
                <p className="text-sm text-muted-foreground">L'IA analyse votre organigramme et suggère automatiquement les processus métiers pour chaque direction.</p>
              </div>
            </div>
            <Button size="lg" onClick={generateAi} disabled={aiLoading} className="bg-primary hover:bg-primary/90">
              {aiLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {aiLoading ? "Analyse de votre structure organisationnelle..." : "🤖 Générer les processus avec l'IA"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 4. AI results */}
      {suggestions && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Processus suggérés par l'IA</CardTitle>
            <CardDescription>Cochez les processus à importer dans le module BIA</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {suggestions.map((g, gi) => (
              <div key={gi} className="border border-border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">{g.entityName}</span>
                  <Badge variant="outline" className="text-xs">{g.processes.length}</Badge>
                </div>
                <div className="space-y-1.5">
                  {g.processes.map((p, pi) => {
                    const key = `${gi}-${pi}`;
                    return (
                      <label key={pi} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-secondary/60 cursor-pointer">
                        <Checkbox checked={!!picked[key]} onCheckedChange={(c) => setPicked({ ...picked, [key]: !!c })} />
                        <span className="text-sm flex-1">{p.name}</span>
                        <Badge variant="outline" className={cn("text-xs", critColor(p.criticality))}>{p.criticality}</Badge>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="flex justify-end pt-2 border-t border-border">
              <Button onClick={importToBia} className="bg-success text-success-foreground hover:bg-success/90">
                <CheckCircle2 className="h-4 w-4 mr-1" /> Valider et importer dans le BIA
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Side panel: entity card */}
      <Sheet open={!!panelEntity} onOpenChange={(o) => { if (!o) setPanelId(null); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {panelEntity && (() => {
            const m = panelEntity.maturity ?? defaultMaturity(panelEntity.pcaStatus);
            return (
              <div className="space-y-5">
                <SheetHeader>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center"><Building2 className="h-5 w-5 text-primary" /></div>
                    <div>
                      <SheetTitle>{panelEntity.name}</SheetTitle>
                      <SheetDescription>{panelEntity.type || "—"} · {panelEntity.sector}</SheetDescription>
                    </div>
                  </div>
                </SheetHeader>

                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase">Détails</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Type</div><div className="font-medium">{panelEntity.type || "—"}</div>
                    <div className="text-muted-foreground">Pays</div><div className="font-medium">{panelEntity.country}</div>
                    <div className="text-muted-foreground">Secteur</div><div className="font-medium">{panelEntity.sector}</div>
                    <div className="text-muted-foreground">Statut</div><div><StatusBadge status={panelEntity.status} /></div>
                    <div className="text-muted-foreground">Statut PCA</div><div><PcaBadge s={panelEntity.pcaStatus} /></div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase">Référent PCA</h4>
                  <div className="rounded-md border border-border p-3 text-sm space-y-1">
                    <div><span className="text-muted-foreground">Principal:</span> <span className="font-medium">{panelEntity.referent}</span></div>
                    <div><span className="text-muted-foreground">Suppléant:</span> <span className="font-medium">{panelEntity.referentBackup}</span></div>
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
                  <p className="text-xs text-muted-foreground">
                    {m < 50 ? "Niveau faible — actions urgentes requises" : m < 75 ? "Niveau intermédiaire — améliorations recommandées" : "Niveau élevé — bonne maturité"}
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase">Processus associés ({panelProcesses.length})</h4>
                  {panelProcesses.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Aucun processus associé. Utilisez l'assistant IA pour en générer.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {panelProcesses.map((p) => (
                        <div key={p.id} className="flex items-center justify-between p-2 rounded border border-border text-sm">
                          <span className="truncate">{p.name}</span>
                          <Badge variant="outline" className="text-xs">RTO {p.rto}h</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Sub-entity dialog (kept) */}
      <Sheet open={!!subDialogParent} onOpenChange={(o) => { if (!o) setSubDialogParent(null); }}>
        <SheetContent>
          <SheetHeader><SheetTitle>Nouvelle sous-entité</SheetTitle></SheetHeader>
          <div className="grid gap-3 mt-4">
            <div><Label>Nom *</Label><Input value={subForm.name || ""} onChange={(e) => setSubForm({ ...subForm, name: e.target.value })} /></div>
            <div>
              <Label>Type</Label>
              <Select value={subForm.type as string} onValueChange={(v) => setSubForm({ ...subForm, type: v as EntityType })}>
                <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>{ENTITY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Pays *</Label><Input value={subForm.country || ""} onChange={(e) => setSubForm({ ...subForm, country: e.target.value })} /></div>
              <div><Label>Secteur *</Label><Input value={subForm.sector || ""} onChange={(e) => setSubForm({ ...subForm, sector: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Référent PCA</Label><Input value={subForm.referent || ""} onChange={(e) => setSubForm({ ...subForm, referent: e.target.value })} /></div>
              <div><Label>Suppléant</Label><Input value={subForm.referentBackup || ""} onChange={(e) => setSubForm({ ...subForm, referentBackup: e.target.value })} /></div>
            </div>
            <Button onClick={submitSub}>Créer</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
