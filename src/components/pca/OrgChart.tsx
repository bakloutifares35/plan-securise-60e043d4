import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Building2, Trash2, Sparkles, Loader2, CheckCircle2, Pencil, Save, X } from "lucide-react";
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
import { emptyImpacts, type Process, type Criticality } from "@/data/bia";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Section = "dashboard" | "form" | "plan" | "benchmark" | "orgchart" | "entity" | "calendar" | "policy" | "committee" | "references";

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
  node, depth, onDelete, onSelect,
}: {
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
            {can("admin") && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(node.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
          </div>
        </div>
        {/* Maturity bar under each entity */}
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

type Suggestion = { entityId: string; entityName: string; processes: { name: string; criticality: Criticality }[] };

type FormState = {
  name: string; type: EntityType | ""; country: string; sector: string;
  referent: string; referentBackup: string; contact: string;
  parentId: string; status: EntityStatus;
};

const emptyForm: FormState = {
  name: "", type: "", country: "", sector: "",
  referent: "", referentBackup: "", contact: "",
  parentId: "", status: "Actif",
};

export const OrgChart = ({ onNavigate: _onNavigate }: { onNavigate?: (s: Section) => void }) => {
  const { entities, setEntities, setSelectedEntityId } = useGovernance();
  const { upsertProcess, processes } = useBia();
  const { can } = useRole();

  const [panelId, setPanelId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);

  const [form, setForm] = useState<FormState>(emptyForm);

  // AI state
  const [aiLoading, setAiLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [picked, setPicked] = useState<Record<string, boolean>>({});

  const tree = buildTree(entities);
  const panelEntity = entities.find((e) => e.id === panelId) || null;
  const panelProcesses = panelEntity ? processes.filter((p) => p.entityId === panelEntity.id) : [];
  const panelParent = panelEntity ? entities.find((e) => e.id === panelEntity.parentId) : null;

  const submitInline = () => {
    if (!can("write")) { toast.error("Permissions insuffisantes"); return; }
    if (!form.name || !form.type || !form.country || !form.sector) { toast.error("Champs obligatoires manquants"); return; }
    const e: Entity = {
      id: `e${Date.now()}`,
      name: form.name, type: form.type as EntityType, country: form.country, sector: form.sector,
      parentId: form.parentId || null,
      referent: form.referent || "—", referentBackup: form.referentBackup || "—",
      contact: form.contact || undefined,
      status: form.status, pcaStatus: "Non démarré", maturity: 20,
    };
    setEntities([...entities, e]);
    setForm(emptyForm);
    toast.success("Entité créée");
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

  const saveEdit = () => {
    if (!panelEntity) return;
    if (!can("write")) { toast.error("Permissions insuffisantes"); return; }
    if (!editForm.name || !editForm.country || !editForm.sector) { toast.error("Champs obligatoires manquants"); return; }
    if (editForm.parentId === panelEntity.id) { toast.error("Une entité ne peut pas être son propre parent"); return; }
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

  const renderFormGrid = (state: FormState, set: (s: FormState) => void, excludeId?: string) => (
    <div className="grid md:grid-cols-3 gap-3">
      <div>
        <Label>Nom *</Label>
        <Input value={state.name} onChange={(e) => set({ ...state, name: e.target.value })} placeholder="Direction Marketing" />
      </div>
      <div>
        <Label>Type</Label>
        <Select value={state.type} onValueChange={(v) => set({ ...state, type: v as EntityType })}>
          <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>{ENTITY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <Label>Pays *</Label>
        <Input value={state.country} onChange={(e) => set({ ...state, country: e.target.value })} placeholder="France" />
      </div>
      <div>
        <Label>Secteur d'activité *</Label>
        <Select value={state.sector} onValueChange={(v) => set({ ...state, sector: v })}>
          <SelectTrigger><SelectValue placeholder="Secteur" /></SelectTrigger>
          <SelectContent>{SECTORS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <Label>Référent PCA</Label>
        <Input value={state.referent} onChange={(e) => set({ ...state, referent: e.target.value })} placeholder="Nom du responsable" />
      </div>
      <div>
        <Label>Référent backup</Label>
        <Input value={state.referentBackup} onChange={(e) => set({ ...state, referentBackup: e.target.value })} placeholder="Contact suppléant" />
      </div>
      <div>
        <Label>Coordonnées référent</Label>
        <Input value={state.contact} onChange={(e) => set({ ...state, contact: e.target.value })} placeholder="email ou téléphone" />
      </div>
      <div>
        <Label>Entité parente</Label>
        <Select value={state.parentId || "__root__"} onValueChange={(v) => set({ ...state, parentId: v === "__root__" ? "" : v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__root__">— Racine —</SelectItem>
            {entities.filter((e) => e.id !== excludeId).map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Statut</Label>
        <Select value={state.status} onValueChange={(v) => set({ ...state, status: v as EntityStatus })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{ENTITY_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Organigramme du Groupe</h1>
        <p className="text-muted-foreground mt-1">Hiérarchie des entités, filiales, directions et services</p>
      </div>

      {/* Creation form */}
      {can("write") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Plus className="h-4 w-4 text-primary" /> Créer une entité</CardTitle>
            <CardDescription>Renseignez les informations de la nouvelle entité</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {renderFormGrid(form, setForm)}
            <div className="flex justify-end">
              <Button onClick={submitInline}><Plus className="h-4 w-4 mr-1" /> Ajouter l'entité</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tree */}
      <Card>
        <CardHeader>
          <CardTitle>Arborescence des entités</CardTitle>
          <CardDescription>Cliquez sur une entité pour ouvrir sa fiche détaillée</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="hidden md:grid grid-cols-6 gap-2 px-3 pb-2 ml-12 text-xs font-semibold text-muted-foreground border-b border-border">
            <span>Entité</span><span>Type</span><span>Pays</span><span>Secteur</span><span>Référent PCA</span><span>Statut</span>
          </div>
          <div className="mt-2">
            {tree.map((n) => <Node key={n.id} node={n} depth={0} onDelete={handleDelete} onSelect={openPanel} />)}
          </div>
        </CardContent>
      </Card>

      {/* AI button */}
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

      {/* AI results */}
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

      {/* Side panel: entity details */}
      <Sheet open={!!panelEntity} onOpenChange={(o) => { if (!o) { setPanelId(null); setEditing(false); } }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {panelEntity && (() => {
            const m = panelEntity.maturity ?? defaultMaturity(panelEntity.pcaStatus);
            return (
              <div className="space-y-5">
                <SheetHeader>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center"><Building2 className="h-5 w-5 text-primary" /></div>
                      <div>
                        <SheetTitle>{panelEntity.name}</SheetTitle>
                        <SheetDescription>{panelEntity.type || "—"} · {panelEntity.sector}</SheetDescription>
                      </div>
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
                        <div className="text-muted-foreground">Secteur</div><div className="font-medium">{panelEntity.sector}</div>
                        <div className="text-muted-foreground">Entité parente</div><div className="font-medium">{panelParent?.name || "Racine"}</div>
                        <div className="text-muted-foreground">Statut</div><div><StatusBadge status={panelEntity.status} /></div>
                        <div className="text-muted-foreground">Statut PCA</div><div><PcaBadge s={panelEntity.pcaStatus} /></div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase">Référent PCA</h4>
                      <div className="rounded-md border border-border p-3 text-sm space-y-1">
                        <div><span className="text-muted-foreground">Principal:</span> <span className="font-medium">{panelEntity.referent}</span></div>
                        <div><span className="text-muted-foreground">Suppléant:</span> <span className="font-medium">{panelEntity.referentBackup}</span></div>
                        <div><span className="text-muted-foreground">Coordonnées:</span> <span className="font-medium">{panelEntity.contact || "—"}</span></div>
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
