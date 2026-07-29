import { useEffect, useState } from "react";
import { supabase } from "@/integrations/resillia/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  Plus, Pencil, Trash2, ShieldAlert, Search, Sparkles, Grid3x3, AlertTriangle, CheckCircle2, Clock, FileSearch, Database, FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type Risque = {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  severity: string | null;
  category: string | null;
  owner: string | null;
  method_used: string | null;
  analysis_data: any;
  created_at: string;
  updated_at: string;
};

const SEVERITIES = ["Faible", "Moyen", "Élevé", "Critique"];
const STATUSES = ["À analyser", "En cours", "Analysé", "Traité"];
const CATEGORIES = ["Cyber", "Physique", "Technique", "Humain", "Fournisseur", "Réglementaire", "Stratégique"];

const severityStyle = (s?: string | null) => {
  switch (s) {
    case "Critique": return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900";
    case "Élevé":    return "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900";
    case "Moyen":    return "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-900";
    default:         return "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900";
  }
};

const statusStyle = (s?: string | null) => {
  switch (s) {
    case "Traité":   return "bg-green-100 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900";
    case "Analysé":  return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900";
    case "En cours": return "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900";
    default:         return "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
  }
};

const statusIcon = (s?: string | null) => {
  switch (s) {
    case "Traité":   return <CheckCircle2 className="h-3.5 w-3.5" />;
    case "Analysé":  return <FileSearch className="h-3.5 w-3.5" />;
    case "En cours": return <Clock className="h-3.5 w-3.5" />;
    default:         return <AlertTriangle className="h-3.5 w-3.5" />;
  }
};

const severityIcon = (s?: string | null) => {
  switch (s) {
    case "Critique": return <AlertTriangle className="h-3.5 w-3.5 text-red-500" />;
    case "Élevé":    return <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />;
    case "Moyen":    return <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />;
    default:         return <AlertTriangle className="h-3.5 w-3.5 text-green-500" />;
  }
};

const emptyForm = () => ({
  title: "",
  description: "",
  status: "À analyser",
  severity: "Moyen",
  category: "Cyber",
  owner: "",
});

type Props = {
  onOpenRisk: (r: Risque) => void;
};

export const RisksInventory = ({ onOpenRisk }: Props) => {
  const [items, setItems] = useState<Risque[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filterSev, setFilterSev] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Risque | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const [toDelete, setToDelete] = useState<Risque | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("risques")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Erreur de chargement", description: error.message, variant: "destructive" });
    } else {
      setItems((data || []) as Risque[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };
  const openEdit = (r: Risque) => {
    setEditing(r);
    setForm({
      title: r.title,
      description: r.description ?? "",
      status: r.status ?? "À analyser",
      severity: r.severity ?? "Moyen",
      category: r.category ?? "Cyber",
      owner: r.owner ?? "",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) {
      toast({ title: "Titre requis", variant: "destructive" });
      return;
    }
    setSaving(true);
    if (editing) {
      const { error } = await supabase.from("risques").update(form).eq("id", editing.id);
      if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
      else toast({ title: "Risque mis à jour" });
    } else {
      const { error } = await supabase.from("risques").insert(form);
      if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
      else toast({ title: "Risque créé" });
    }
    setSaving(false);
    setDialogOpen(false);
    await load();
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const { error } = await supabase.from("risques").delete().eq("id", toDelete.id);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else toast({ title: "Risque supprimé" });
    setToDelete(null);
    await load();
  };

  const filtered = items.filter((r) => {
    const q = query.trim().toLowerCase();
    if (q && !`${r.title} ${r.description ?? ""} ${r.category ?? ""} ${r.owner ?? ""}`.toLowerCase().includes(q)) return false;
    if (filterSev !== "all" && r.severity !== filterSev) return false;
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    return true;
  });

  const stats = {
    total: items.length,
    critical: items.filter((r) => r.severity === "Critique").length,
    analyzed: items.filter((r) => r.method_used !== null && r.method_used !== "").length,
    pending: items.filter((r) => !r.method_used || r.method_used === "").length,
  };

  return (
    <div className="space-y-6">
      {/* Header avec stats - Style comme l'image */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Analyse des Risques</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Centralisez tous vos risques, puis choisissez la méthode d'analyse adaptée (5×5 ou EBIOS RM) sur chaque fiche.
            </p>
          </div>
          <Button 
            onClick={openCreate} 
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" /> Nouveau risque
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 border border-blue-100 dark:border-blue-900/30">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm">
              <Database className="h-4 w-4" />
              <span>Total</span>
            </div>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">{stats.total}</div>
          </div>
          <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-4 border border-red-100 dark:border-red-900/30">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span>Critiques</span>
            </div>
            <div className="text-2xl font-bold text-red-700 dark:text-red-300 mt-1">{stats.critical}</div>
          </div>
          <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4 border border-green-100 dark:border-green-900/30">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
              <CheckCircle2 className="h-4 w-4" />
              <span>Analysés</span>
            </div>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300 mt-1">{stats.analyzed}</div>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-950/30 rounded-lg p-4 border border-yellow-100 dark:border-yellow-900/30">
            <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 text-sm">
              <Clock className="h-4 w-4" />
              <span>À analyser</span>
            </div>
            <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-300 mt-1">{stats.pending}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Rechercher un risque, une catégorie, un propriétaire..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 border-gray-200 dark:border-gray-800"
          />
        </div>
        <Select value={filterSev} onValueChange={setFilterSev}>
          <SelectTrigger className="w-full md:w-[180px] border-gray-200 dark:border-gray-800">
            <SelectValue placeholder="Sévérité" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes sévérités</SelectItem>
            {SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full md:w-[180px] border-gray-200 dark:border-gray-800">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse"><CardHeader><div className="h-5 bg-gray-200 dark:bg-gray-800 rounded w-2/3" /></CardHeader><CardContent><div className="h-16 bg-gray-200 dark:bg-gray-800 rounded" /></CardContent></Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-gray-300 dark:border-gray-700">
          <CardContent className="py-16 text-center">
            <ShieldAlert className="h-12 w-12 mx-auto text-gray-400" />
            <p className="mt-3 font-medium text-gray-700 dark:text-gray-300">Aucun risque pour le moment</p>
            <p className="text-sm text-gray-500 dark:text-gray-500">Commencez par créer votre premier risque.</p>
            <Button className="mt-4 bg-blue-600 hover:bg-blue-700 text-white" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" /> Créer un risque
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <Card
              key={r.id}
              className="group relative overflow-hidden border border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-lg transition-all cursor-pointer bg-white dark:bg-gray-900"
              onClick={() => onOpenRisk(r)}
            >
              {/* Barre de couleur selon sévérité - comme dans l'image */}
              <div className={cn(
                "absolute top-0 left-0 right-0 h-1",
                r.severity === "Critique" ? "bg-red-500"
                : r.severity === "Élevé" ? "bg-orange-500"
                : r.severity === "Moyen" ? "bg-yellow-500"
                : "bg-green-500"
              )} />
              
              <CardHeader className="pb-2 pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {severityIcon(r.severity)}
                    <CardTitle className="text-base font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {r.title}
                    </CardTitle>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="icon" variant="ghost" className="h-7 w-7 hover:bg-gray-100 dark:hover:bg-gray-800" onClick={(e) => { e.stopPropagation(); openEdit(r); }}>
                      <Pencil className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={(e) => { e.stopPropagation(); setToDelete(r); }}>
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
                {r.category && (
                  <Badge variant="outline" className="mt-1 text-xs border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400">
                    {r.category}
                  </Badge>
                )}
              </CardHeader>
              
              <CardContent className="space-y-3 pt-0">
                {r.description && (
                  <CardDescription className="line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
                    {r.description}
                  </CardDescription>
                )}
                
                <div className="flex flex-wrap gap-2">
                  <Badge 
                    className={cn("border text-xs font-normal", severityStyle(r.severity))} 
                    variant="outline"
                  >
                    {r.severity ?? "Moyen"}
                  </Badge>
                  <Badge 
                    className={cn("text-xs font-normal border", statusStyle(r.status))}
                    variant="outline"
                  >
                    {statusIcon(r.status)} {r.status ?? "À analyser"}
                  </Badge>
                  {r.method_used && (
                    <Badge variant="outline" className="text-xs font-normal border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                      {r.method_used === "EBIOS RM" || r.method_used === "ebios" ? (
                        <><Sparkles className="h-3 w-3 mr-1 text-purple-500" /> EBIOS RM</>
                      ) : (
                        <><Grid3x3 className="h-3 w-3 mr-1 text-blue-500" /> 5×5</>
                      )}
                    </Badge>
                  )}
                </div>
                
                {r.owner && (
                  <div className="text-xs text-gray-500 dark:text-gray-500 flex items-center gap-1">
                    <span className="text-gray-400">👤</span> {r.owner}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le risque" : "Nouveau risque"}</DialogTitle>
            <DialogDescription>
              Renseignez les informations du risque. Vous pourrez ensuite choisir une méthode d'analyse.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Titre *</Label>
              <Input 
                value={form.title} 
                onChange={(e) => setForm({ ...form, title: e.target.value })} 
                placeholder="Ex: Cyberattaque ransomware" 
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Description</Label>
              <Textarea 
                value={form.description} 
                onChange={(e) => setForm({ ...form, description: e.target.value })} 
                rows={3} 
                placeholder="Décrivez le risque…"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Catégorie</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium">Sévérité</Label>
                <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium">Statut</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium">Propriétaire</Label>
                <Input 
                  value={form.owner} 
                  onChange={(e) => setForm({ ...form, owner: e.target.value })} 
                  placeholder="Ex: RSSI"
                  className="mt-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
              {saving ? "Enregistrement…" : editing ? "Mettre à jour" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce risque ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le risque « {toDelete?.title} » et son analyse seront supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};