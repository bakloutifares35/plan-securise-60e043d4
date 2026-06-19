import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  Plus, Pencil, Trash2, ShieldAlert, Search, Sparkles, Grid3x3, AlertTriangle, CheckCircle2, Clock, FileSearch,
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
    case "Critique": return "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900";
    case "Élevé":    return "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900";
    case "Moyen":    return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900";
    default:         return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900";
  }
};
const statusStyle = (s?: string | null) => {
  switch (s) {
    case "Traité":   return "bg-emerald-600 text-white";
    case "Analysé":  return "bg-blue-600 text-white";
    case "En cours": return "bg-violet-600 text-white";
    default:         return "bg-slate-500 text-white";
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
    analyzed: items.filter((r) => r.method_used).length,
    pending: items.filter((r) => !r.method_used).length,
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-2xl p-6 md:p-8 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-blue-100 text-sm">
              <ShieldAlert className="h-4 w-4" />
              Analyse des Risques
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mt-1">Inventaire des risques</h1>
            <p className="text-blue-100 mt-1 max-w-2xl">
              Centralisez tous vos risques, puis choisissez la méthode d'analyse adaptée (5×5 ou EBIOS RM) sur chaque fiche.
            </p>
          </div>
          <Button onClick={openCreate} size="lg" className="bg-white text-indigo-700 hover:bg-blue-50 shadow">
            <Plus className="h-4 w-4 mr-2" /> Nouveau risque
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          {[
            { label: "Total", value: stats.total, icon: ShieldAlert },
            { label: "Critiques", value: stats.critical, icon: AlertTriangle },
            { label: "Analysés", value: stats.analyzed, icon: CheckCircle2 },
            { label: "À analyser", value: stats.pending, icon: Clock },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-white/15 backdrop-blur rounded-xl p-3 border border-white/20">
                <div className="flex items-center gap-2 text-blue-50 text-xs"><Icon className="h-3.5 w-3.5" /> {s.label}</div>
                <div className="text-2xl font-bold mt-1">{s.value}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un risque, une catégorie, un propriétaire…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterSev} onValueChange={setFilterSev}>
          <SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="Sévérité" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes sévérités</SelectItem>
            {SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="Statut" /></SelectTrigger>
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
            <Card key={i} className="animate-pulse"><CardHeader><div className="h-5 bg-muted rounded w-2/3" /></CardHeader><CardContent><div className="h-16 bg-muted rounded" /></CardContent></Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <ShieldAlert className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="mt-3 font-medium">Aucun risque pour le moment</p>
            <p className="text-sm text-muted-foreground">Commencez par créer votre premier risque.</p>
            <Button className="mt-4" onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Créer un risque</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <Card
              key={r.id}
              className="group relative overflow-hidden border-2 hover:border-blue-400 hover:shadow-xl transition-all cursor-pointer"
              onClick={() => onOpenRisk(r)}
            >
              <div className={cn(
                "absolute top-0 left-0 right-0 h-1",
                r.severity === "Critique" ? "bg-rose-500"
                : r.severity === "Élevé" ? "bg-orange-500"
                : r.severity === "Moyen" ? "bg-amber-500"
                : "bg-emerald-500"
              )} />
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base group-hover:text-blue-700 transition-colors line-clamp-2">{r.title}</CardTitle>
                    {r.category && (
                      <Badge variant="outline" className="mt-2 text-xs">{r.category}</Badge>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openEdit(r); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50" onClick={(e) => { e.stopPropagation(); setToDelete(r); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {r.description && (
                  <CardDescription className="line-clamp-2">{r.description}</CardDescription>
                )}
                <div className="flex flex-wrap gap-1.5">
                  <Badge className={cn("border", severityStyle(r.severity))} variant="outline">
                    {r.severity ?? "Moyen"}
                  </Badge>
                  <Badge className={cn("gap-1", statusStyle(r.status))}>
                    {statusIcon(r.status)} {r.status ?? "À analyser"}
                  </Badge>
                  {r.method_used && (
                    <Badge variant="secondary" className="gap-1">
                      {r.method_used === "ebios" ? <Sparkles className="h-3 w-3" /> : <Grid3x3 className="h-3 w-3" />}
                      {r.method_used === "ebios" ? "EBIOS RM" : "5×5"}
                    </Badge>
                  )}
                </div>
                {r.owner && (
                  <div className="text-xs text-muted-foreground">👤 {r.owner}</div>
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
              <Label>Titre *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Cyberattaque ransomware" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Décrivez le risque…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Catégorie</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Sévérité</Label>
                <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Statut</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Propriétaire</Label>
                <Input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} placeholder="Ex: RSSI" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
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
            <AlertDialogAction onClick={confirmDelete} className="bg-rose-600 hover:bg-rose-700">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
