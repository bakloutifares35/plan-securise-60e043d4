import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AlertTriangle, CalendarPlus, Calendar as CalIcon } from "lucide-react";
import { useGovernance } from "@/contexts/GovernanceContext";
import { useRole } from "@/contexts/RoleContext";
import { type CalendarEvent } from "@/data/governance";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const TYPE_COLORS: Record<CalendarEvent["type"], string> = {
  "Revue": "bg-primary text-primary-foreground",
  "Test": "bg-accent text-accent-foreground",
  "Comité": "bg-success text-success-foreground",
  "Audit": "bg-warning text-warning-foreground",
};

export const AnnualCalendar = () => {
  const { events, setEvents, entities } = useGovernance();
  const { can } = useRole();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<CalendarEvent>>({ type: "Revue" });

  const today = new Date();
  const sorted = useMemo(() => [...events].sort((a, b) => a.startDate.localeCompare(b.startDate)), [events]);

  const upcoming = sorted.filter((e) => {
    const d = new Date(e.startDate);
    const diff = (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  });

  // Gantt: build per-month grid for current year
  const year = today.getFullYear();
  const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));

  const eventBar = (e: CalendarEvent) => {
    const start = new Date(e.startDate);
    const end = new Date(e.endDate);
    if (start.getFullYear() !== year && end.getFullYear() !== year) return null;
    const startDay = (start.getMonth() * 30) + start.getDate();
    const endDay = (end.getMonth() * 30) + Math.max(end.getDate(), start.getDate());
    const left = (startDay / 360) * 100;
    const width = Math.max(((endDay - startDay + 1) / 360) * 100, 0.8);
    return { left: `${left}%`, width: `${width}%` };
  };

  const submit = () => {
    if (!form.title || !form.startDate || !form.entityId) { toast.error("Champs requis manquants"); return; }
    const ev: CalendarEvent = {
      id: `c${Date.now()}`,
      title: form.title!,
      type: (form.type as CalendarEvent["type"]) || "Revue",
      startDate: form.startDate!,
      endDate: form.endDate || form.startDate!,
      entityId: form.entityId!,
      responsible: form.responsible || "—",
    };
    setEvents([...events, ev]);
    setOpen(false);
    setForm({ type: "Revue" });
    toast.success("Événement ajouté");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Calendrier annuel PCA</h1>
          <p className="text-muted-foreground mt-1">Revues, tests, comités et audits planifiés</p>
        </div>
        {can("write") && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><CalendarPlus className="h-4 w-4 mr-1" /> Ajouter un événement</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nouvel événement</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div><Label>Titre *</Label><Input value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Type</Label>
                    <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as CalendarEvent["type"] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(["Revue", "Test", "Comité", "Audit"] as const).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Entité *</Label>
                    <Select value={form.entityId} onValueChange={(v) => setForm({ ...form, entityId: v })}>
                      <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                      <SelectContent>{entities.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Début *</Label><Input type="date" value={form.startDate || ""} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
                  <div><Label>Fin</Label><Input type="date" value={form.endDate || ""} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
                </div>
                <div><Label>Responsable</Label><Input value={form.responsible || ""} onChange={(e) => setForm({ ...form, responsible: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
                <Button onClick={submit}>Ajouter</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {upcoming.length > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-warning"><AlertTriangle className="h-4 w-4" /> Alertes — échéances dans les 30 prochains jours</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.map((e) => {
              const days = Math.ceil((new Date(e.startDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              return (
                <div key={e.id} className="flex items-center justify-between p-2.5 rounded-md bg-card border border-border text-sm">
                  <div className="flex items-center gap-3">
                    <Badge className={TYPE_COLORS[e.type]}>{e.type}</Badge>
                    <span className="font-medium">{e.title}</span>
                  </div>
                  <span className="text-muted-foreground">Dans {days} jour{days > 1 ? "s" : ""} · {e.startDate}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalIcon className="h-4 w-4 text-primary" /> Vue Gantt {year}</CardTitle>
          <CardDescription>Visualisation annuelle des activités PCA</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              <div className="grid grid-cols-12 border-b border-border pb-2 mb-3 ml-48">
                {months.map((m) => (
                  <div key={m.getMonth()} className="text-xs font-semibold text-center text-muted-foreground">
                    {m.toLocaleDateString("fr-FR", { month: "short" })}
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {sorted.map((e) => {
                  const bar = eventBar(e);
                  const entity = entities.find((x) => x.id === e.entityId);
                  return (
                    <div key={e.id} className="flex items-center gap-3">
                      <div className="w-48 shrink-0 text-sm">
                        <p className="font-medium truncate">{e.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{entity?.name}</p>
                      </div>
                      <div className="flex-1 relative h-7 bg-secondary/40 rounded">
                        {bar && (
                          <div className={cn("absolute top-1 bottom-1 rounded text-xs font-medium px-2 flex items-center", TYPE_COLORS[e.type])} style={bar} title={`${e.startDate} → ${e.endDate}`}>
                            <span className="truncate">{e.type}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Agenda complet</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {sorted.map((e) => {
            const entity = entities.find((x) => x.id === e.entityId);
            return (
              <div key={e.id} className="flex items-center justify-between p-3 rounded-md border border-border text-sm hover:bg-secondary/40 transition-colors">
                <div className="flex items-center gap-3">
                  <Badge className={TYPE_COLORS[e.type]}>{e.type}</Badge>
                  <div>
                    <p className="font-medium">{e.title}</p>
                    <p className="text-xs text-muted-foreground">{entity?.name} · {e.responsible}</p>
                  </div>
                </div>
                <span className="text-muted-foreground">{e.startDate}{e.endDate !== e.startDate && ` → ${e.endDate}`}</span>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};
