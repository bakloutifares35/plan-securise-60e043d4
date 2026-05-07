import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Users, Calendar, ClipboardList, Trash2 } from "lucide-react";
import { useGovernance } from "@/contexts/GovernanceContext";
import { useRole } from "@/contexts/RoleContext";
import { type Committee } from "@/data/governance";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUS_COLORS = {
  "Ouvert": "bg-warning text-warning-foreground",
  "En cours": "bg-accent text-accent-foreground",
  "Clôturé": "bg-success text-success-foreground",
};

export const SteeringCommittee = () => {
  const { committees, setCommittees } = useGovernance();
  const { can } = useRole();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Committee>>({});
  const [agendaText, setAgendaText] = useState("");
  const [attendeesText, setAttendeesText] = useState("");

  const submit = () => {
    if (!form.title || !form.date) { toast.error("Titre et date obligatoires"); return; }
    const c: Committee = {
      id: `co${Date.now()}`,
      title: form.title!,
      date: form.date!,
      attendees: attendeesText.split(",").map((s) => s.trim()).filter(Boolean),
      agenda: agendaText.split("\n").map((s) => s.trim()).filter(Boolean),
      minutes: form.minutes || "",
      decisions: [],
    };
    setCommittees([c, ...committees]);
    setOpen(false);
    setForm({}); setAgendaText(""); setAttendeesText("");
    toast.success("Comité créé");
  };

  const updateDecisionStatus = (cid: string, did: string, status: Committee["decisions"][0]["status"]) => {
    setCommittees(committees.map((c) => c.id === cid ? { ...c, decisions: c.decisions.map((d) => d.id === did ? { ...d, status } : d) } : c));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Comité de pilotage</h1>
          <p className="text-muted-foreground mt-1">Réunions, ordres du jour, comptes-rendus et décisions</p>
        </div>
        {can("write") && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Nouveau comité</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Nouveau comité de pilotage</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div><Label>Titre *</Label><Input value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div><Label>Date *</Label><Input type="date" value={form.date || ""} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                <div><Label>Participants (séparés par virgule)</Label><Input value={attendeesText} onChange={(e) => setAttendeesText(e.target.value)} /></div>
                <div><Label>Ordre du jour (un par ligne)</Label><Textarea rows={4} value={agendaText} onChange={(e) => setAgendaText(e.target.value)} /></div>
                <div><Label>Compte-rendu</Label><Textarea rows={4} value={form.minutes || ""} onChange={(e) => setForm({ ...form, minutes: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
                <Button onClick={submit}>Créer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="space-y-4">
        {committees.map((c) => (
          <Card key={c.id}>
            <CardHeader>
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <CardTitle className="text-lg">{c.title}</CardTitle>
                  <CardDescription className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {c.date}</span>
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {c.attendees.length} participants</span>
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><ClipboardList className="h-3.5 w-3.5" /> Ordre du jour</p>
                  <ul className="space-y-1 text-sm list-disc list-inside">
                    {c.agenda.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Participants</p>
                  <div className="flex flex-wrap gap-1.5">
                    {c.attendees.map((a, i) => <Badge key={i} variant="secondary">{a}</Badge>)}
                  </div>
                </div>
              </div>
              {c.minutes && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Compte-rendu</p>
                  <p className="text-sm bg-secondary/40 p-3 rounded-md border border-border">{c.minutes}</p>
                </div>
              )}
              {c.decisions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Décisions & actions</p>
                  <div className="space-y-2">
                    {c.decisions.map((d) => (
                      <div key={d.id} className="flex items-center justify-between p-2.5 border border-border rounded-md text-sm gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{d.text}</p>
                          <p className="text-xs text-muted-foreground">{d.owner} · échéance {d.dueDate}</p>
                        </div>
                        {can("write") ? (
                          <Select value={d.status} onValueChange={(v) => updateDecisionStatus(c.id, d.id, v as any)}>
                            <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Ouvert">Ouvert</SelectItem>
                              <SelectItem value="En cours">En cours</SelectItem>
                              <SelectItem value="Clôturé">Clôturé</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge className={cn(STATUS_COLORS[d.status])}>{d.status}</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
