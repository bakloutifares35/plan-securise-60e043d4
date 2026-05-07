import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Building2, Trash2, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGovernance } from "@/contexts/GovernanceContext";
import { useRole } from "@/contexts/RoleContext";
import { type Entity } from "@/data/governance";
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

const Node = ({
  node, depth, onAdd, onDelete, onView,
}: {
  node: Entity; depth: number; onAdd: (parentId: string) => void; onDelete: (id: string) => void; onView: (id: string) => void;
}) => {
  const [open, setOpen] = useState(true);
  const hasChildren = (node.children?.length ?? 0) > 0;
  const { can } = useRole();
  return (
    <div>
      <div
        className="flex items-center gap-2 py-2.5 px-3 rounded-md hover:bg-secondary/60 transition-colors group"
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
      >
        <button onClick={() => setOpen(!open)} className="text-muted-foreground hover:text-foreground">
          {hasChildren ? (open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : <span className="inline-block w-4" />}
        </button>
        <Building2 className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-5 gap-2 items-center">
          <span className="font-medium text-sm truncate">{node.name}</span>
          <span className="text-xs text-muted-foreground">{node.country}</span>
          <span className="text-xs text-muted-foreground truncate">{node.sector}</span>
          <span className="text-xs truncate">{node.referent}</span>
          <div className="flex gap-1.5 flex-wrap">
            <StatusBadge status={node.status} />
            <PcaBadge s={node.pcaStatus} />
          </div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onView(node.id)}><Eye className="h-3.5 w-3.5" /></Button>
          {can("write") && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onAdd(node.id)}><Plus className="h-3.5 w-3.5" /></Button>}
          {can("admin") && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(node.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
        </div>
      </div>
      {hasChildren && open && (
        <div>
          {node.children!.map((c) => (
            <Node key={c.id} node={c} depth={depth + 1} onAdd={onAdd} onDelete={onDelete} onView={onView} />
          ))}
        </div>
      )}
    </div>
  );
};

export const OrgChart = ({ onNavigate }: { onNavigate: (s: Section) => void }) => {
  const { entities, setEntities, setSelectedEntityId } = useGovernance();
  const { can } = useRole();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [parentId, setParentId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Entity>>({ status: "Actif", pcaStatus: "Non démarré" });

  const tree = buildTree(entities);

  const handleAdd = (pid: string | null) => {
    if (!can("write")) { toast.error("Permissions insuffisantes"); return; }
    setParentId(pid);
    setForm({ status: "Actif", pcaStatus: "Non démarré" });
    setDialogOpen(true);
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
    toast.success("Entité supprimée");
  };

  const handleView = (id: string) => { setSelectedEntityId(id); onNavigate("entity"); };

  const submit = () => {
    if (!form.name || !form.country || !form.sector) { toast.error("Champs obligatoires manquants"); return; }
    const newEntity: Entity = {
      id: `e${Date.now()}`,
      name: form.name!, country: form.country!, sector: form.sector!,
      parentId, referent: form.referent || "—", referentBackup: form.referentBackup || "—",
      status: (form.status as Entity["status"]) || "Actif",
      pcaStatus: (form.pcaStatus as Entity["pcaStatus"]) || "Non démarré",
    };
    setEntities([...entities, newEntity]);
    setDialogOpen(false);
    toast.success("Entité créée");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Organigramme du Groupe</h1>
          <p className="text-muted-foreground mt-1">Hiérarchie des entités et filiales</p>
        </div>
        {can("write") && (
          <Button onClick={() => handleAdd(null)}><Plus className="h-4 w-4 mr-1" /> Ajouter une entité racine</Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Arborescence des entités</CardTitle>
          <CardDescription>Cliquez sur une entité pour voir sa fiche détaillée</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="hidden md:grid grid-cols-5 gap-2 px-3 pb-2 ml-12 text-xs font-semibold text-muted-foreground border-b border-border">
            <span>Entité</span><span>Pays</span><span>Secteur</span><span>Référent PCA</span><span>Statut</span>
          </div>
          <div className="mt-2">
            {tree.map((n) => <Node key={n.id} node={n} depth={0} onAdd={handleAdd} onDelete={handleDelete} onView={handleView} />)}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle entité</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Nom *</Label><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Pays *</Label><Input value={form.country || ""} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
              <div><Label>Secteur *</Label><Input value={form.sector || ""} onChange={(e) => setForm({ ...form, sector: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Référent PCA</Label><Input value={form.referent || ""} onChange={(e) => setForm({ ...form, referent: e.target.value })} /></div>
              <div><Label>Suppléant</Label><Input value={form.referentBackup || ""} onChange={(e) => setForm({ ...form, referentBackup: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Statut</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Entity["status"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Actif">Actif</SelectItem><SelectItem value="Inactif">Inactif</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <Label>Statut PCA</Label>
                <Select value={form.pcaStatus} onValueChange={(v) => setForm({ ...form, pcaStatus: v as Entity["pcaStatus"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Validé">Validé</SelectItem>
                    <SelectItem value="En cours">En cours</SelectItem>
                    <SelectItem value="À réviser">À réviser</SelectItem>
                    <SelectItem value="Non démarré">Non démarré</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={submit}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
