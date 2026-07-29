import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertTriangle, CalendarPlus, Calendar as CalIcon, MapPin, Users, Edit, Trash2, X, UserPlus } from "lucide-react";
import { useRole } from "@/contexts/RoleContext";
import { supabase } from "@/integrations/resillia/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type CalendarEvent = {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  location: string;
  participants: string[];
  created_at: string;
  updated_at: string;
};

export const AnnualCalendar = () => {
  const { can } = useRole();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<Partial<CalendarEvent>>({
    title: "",
    start_date: "",
    end_date: "",
    location: "",
    participants: [],
  });
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [participantInput, setParticipantInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const today = new Date();

  // Charger les événements depuis Supabase
  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      console.log("🔵 Chargement des événements depuis Supabase...");
      
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .order('start_date', { ascending: true });

      if (error) {
        console.error("🔴 Erreur Supabase:", error);
        throw error;
      }
      
      console.log(`✅ ${data?.length || 0} événements chargés`);
      setEvents(data || []);
    } catch (error: any) {
      console.error("🔴 Erreur chargement événements:", error);
      toast.error("Erreur lors du chargement des événements: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Ouvrir le dialog pour créer
  const openCreateDialog = () => {
    resetForm();
    setIsEditing(false);
    setOpen(true);
  };

  // Ouvrir le dialog pour éditer
  const openEditDialog = (event: CalendarEvent) => {
    setEditingEvent(event);
    setForm({
      title: event.title,
      start_date: event.start_date,
      end_date: event.end_date,
      location: event.location,
      participants: event.participants || [],
    });
    setSelectedParticipants(event.participants || []);
    setIsEditing(true);
    setOpen(true);
  };

  // Créer un événement
  const handleCreate = async () => {
    console.log("🔵 Création d'un événement...");
    console.log("📝 Formulaire:", form);
    
    if (!form.title || !form.start_date) {
      toast.error("Le titre et la date de début sont obligatoires");
      return;
    }

    if (new Date(form.start_date) > new Date(form.end_date || form.start_date)) {
      toast.error("La date de fin doit être postérieure à la date de début");
      return;
    }

    setIsSubmitting(true);

    const newEvent = {
      title: form.title,
      start_date: form.start_date,
      end_date: form.end_date || form.start_date,
      location: form.location || "Non spécifié",
      participants: form.participants || [],
    };

    console.log("📤 Envoi à Supabase:", newEvent);

    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .insert(newEvent)
        .select()
        .single();

      if (error) {
        console.error("🔴 Erreur Supabase:", error);
        throw error;
      }

      console.log("✅ Événement créé:", data);
      setEvents([...events, data]);
      setOpen(false);
      resetForm();
      toast.success("Événement créé avec succès !");
    } catch (error: any) {
      console.error("🔴 Erreur création:", error);
      toast.error("Erreur lors de la création de l'événement: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Modifier un événement
  const handleUpdate = async () => {
    if (!editingEvent) return;
    if (!form.title || !form.start_date) {
      toast.error("Le titre et la date de début sont obligatoires");
      return;
    }

    if (new Date(form.start_date) > new Date(form.end_date || form.start_date)) {
      toast.error("La date de fin doit être postérieure à la date de début");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('calendar_events')
        .update({
          title: form.title,
          start_date: form.start_date,
          end_date: form.end_date || form.start_date,
          location: form.location || "Non spécifié",
          participants: form.participants || [],
        })
        .eq('id', editingEvent.id);

      if (error) throw error;

      setEvents(events.map(e => 
        e.id === editingEvent.id 
          ? { ...e, ...form, end_date: form.end_date || form.start_date }
          : e
      ));
      setOpen(false);
      setIsEditing(false);
      resetForm();
      toast.success("Événement modifié avec succès !");
    } catch (error: any) {
      console.error("🔴 Erreur mise à jour:", error);
      toast.error("Erreur lors de la modification: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Supprimer un événement
  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cet événement ?")) return;

    try {
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setEvents(events.filter(e => e.id !== id));
      toast.success("Événement supprimé avec succès !");
    } catch (error: any) {
      console.error("🔴 Erreur suppression:", error);
      toast.error("Erreur lors de la suppression: " + error.message);
    }
  };

  const resetForm = () => {
    setForm({ title: "", start_date: "", end_date: "", location: "", participants: [] });
    setSelectedParticipants([]);
    setEditingEvent(null);
    setIsEditing(false);
    setParticipantInput("");
  };

  // Gestion des participants
  const addParticipant = () => {
    if (!participantInput.trim()) {
      toast.warning("Veuillez saisir un nom");
      return;
    }
    if (selectedParticipants.includes(participantInput.trim())) {
      toast.warning("Ce participant est déjà dans la liste");
      return;
    }
    const newParticipants = [...selectedParticipants, participantInput.trim()];
    setSelectedParticipants(newParticipants);
    setForm({ ...form, participants: newParticipants });
    setParticipantInput("");
  };

  const removeParticipant = (participant: string) => {
    const newParticipants = selectedParticipants.filter(p => p !== participant);
    setSelectedParticipants(newParticipants);
    setForm({ ...form, participants: newParticipants });
  };

  const sorted = useMemo(() => [...events].sort((a, b) => a.start_date.localeCompare(b.start_date)), [events]);

  const upcoming = sorted.filter((e) => {
    const d = new Date(e.start_date);
    const diff = (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  });

  // Vue Gantt - Version originale
  const year = today.getFullYear();
  const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));

  const eventBar = (e: CalendarEvent) => {
    const start = new Date(e.start_date);
    const end = new Date(e.end_date || e.start_date);
    if (start.getFullYear() !== year && end.getFullYear() !== year) return null;
    const startDay = (start.getMonth() * 30) + start.getDate();
    const endDay = (end.getMonth() * 30) + Math.max(end.getDate(), start.getDate());
    const left = (startDay / 360) * 100;
    const width = Math.max(((endDay - startDay + 1) / 360) * 100, 0.8);
    return { left: `${left}%`, width: `${width}%` };
  };

  // Couleurs pour les événements
  const getEventColor = (title: string) => {
    const colors = [
      "bg-blue-500 text-white",
      "bg-emerald-500 text-white",
      "bg-violet-500 text-white",
      "bg-amber-500 text-white",
      "bg-rose-500 text-white",
      "bg-cyan-500 text-white",
      "bg-indigo-500 text-white",
      "bg-teal-500 text-white",
    ];
    const index = title.length % colors.length;
    return colors[index];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Chargement des événements...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Calendrier annuel PCA</h1>
          <p className="text-muted-foreground mt-1">Revues, tests, comités et audits planifiés</p>
        </div>
        {can("write") && (
          <Button onClick={openCreateDialog}>
            <CalendarPlus className="h-4 w-4 mr-1" /> Ajouter un événement
          </Button>
        )}
      </div>

      {/* Dialog pour créer/modifier */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Modifier l'événement" : "Nouvel événement"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <Label>Titre *</Label>
              <Input 
                value={form.title || ""} 
                onChange={(e) => setForm({ ...form, title: e.target.value })} 
                placeholder="Titre de l'événement"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date de début *</Label>
                <Input 
                  type="date" 
                  value={form.start_date || ""} 
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })} 
                />
              </div>
              <div>
                <Label>Date de fin</Label>
                <Input 
                  type="date" 
                  value={form.end_date || ""} 
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })} 
                />
              </div>
            </div>
            <div>
              <Label>Lieu</Label>
              <Input 
                value={form.location || ""} 
                onChange={(e) => setForm({ ...form, location: e.target.value })} 
                placeholder="Salle, Visio-conférence, etc."
              />
            </div>
            <div>
              <Label>Participants</Label>
              <div className="flex gap-2 mb-3">
                <Input 
                  value={participantInput} 
                  onChange={(e) => setParticipantInput(e.target.value)} 
                  placeholder="Nom du participant"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addParticipant(); } }}
                  className="flex-1"
                />
                <Button variant="outline" onClick={addParticipant} type="button" className="shrink-0">
                  <UserPlus className="h-4 w-4 mr-1" /> Ajouter
                </Button>
              </div>
              {selectedParticipants.length > 0 ? (
                <div className="flex flex-wrap gap-2 p-3 bg-secondary/30 rounded-lg border border-border min-h-[40px]">
                  {selectedParticipants.map((p) => (
                    <Badge key={p} variant="secondary" className="flex items-center gap-1.5 py-1.5 px-3 text-sm">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      {p}
                      <X 
                        className="h-3.5 w-3.5 cursor-pointer hover:text-destructive transition-colors ml-1" 
                        onClick={() => removeParticipant(p)}
                      />
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground italic p-3 bg-secondary/30 rounded-lg border border-dashed border-border text-center">
                  Aucun participant ajouté
                </div>
              )}
              <div className="text-xs text-muted-foreground mt-1.5">
                {selectedParticipants.length} participant{selectedParticipants.length > 1 ? "s" : ""}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>
              Annuler
            </Button>
            <Button onClick={isEditing ? handleUpdate : handleCreate} disabled={isSubmitting}>
              {isSubmitting ? "En cours..." : (isEditing ? "Modifier" : "Ajouter")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {upcoming.length > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-warning">
              <AlertTriangle className="h-4 w-4" /> Alertes — échéances dans les 30 prochains jours
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.map((e) => {
              const days = Math.ceil((new Date(e.start_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              return (
                <div key={e.id} className="flex items-center justify-between p-2.5 rounded-md bg-card border border-border text-sm">
                  <div className="flex items-center gap-3">
                    <Badge className={getEventColor(e.title)}>{e.title.split(' ')[0]}</Badge>
                    <span className="font-medium">{e.title}</span>
                    {e.participants && e.participants.length > 0 && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {e.participants.length}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground">Dans {days} jour{days > 1 ? "s" : ""} · {e.start_date}</span>
                    {can("write") && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(e)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(e.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Vue Gantt - Version originale */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalIcon className="h-4 w-4 text-primary" /> Vue Gantt {year}
          </CardTitle>
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
                  return (
                    <div key={e.id} className="flex items-center gap-3 group">
                      <div className="w-48 shrink-0 text-sm">
                        <p className="font-medium truncate">{e.title}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {e.location || "Non spécifié"}
                        </p>
                      </div>
                      <div className="flex-1 relative h-7 bg-secondary/40 rounded">
                        {bar && (
                          <div 
                            className={cn("absolute top-1 bottom-1 rounded text-xs font-medium px-2 flex items-center", getEventColor(e.title))} 
                            style={bar} 
                            title={`${e.start_date} → ${e.end_date}`}
                          >
                            <span className="truncate">{e.title}</span>
                          </div>
                        )}
                      </div>
                      {can("write") && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditDialog(e)}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDelete(e.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {sorted.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Aucun événement planifié pour cette année
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agenda complet */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalIcon className="h-4 w-4 text-primary" /> Agenda complet
          </CardTitle>
          <CardDescription>Tous les événements planifiés</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {sorted.map((e) => (
            <div key={e.id} className="flex items-center justify-between p-3 rounded-md border border-border text-sm hover:bg-secondary/40 transition-colors group">
              <div className="flex items-center gap-3">
                <Badge className={getEventColor(e.title)}>{e.title.split(' ')[0]}</Badge>
                <div>
                  <p className="font-medium">{e.title}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {e.location || "Non spécifié"}
                    </span>
                    {e.participants && e.participants.length > 0 && (
                      <>
                        <span className="text-border">|</span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {e.participants.length} participant{e.participants.length > 1 ? "s" : ""}
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground text-xs">
                  {new Date(e.start_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                  {e.end_date !== e.start_date && 
                    ` → ${new Date(e.end_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`
                  }
                </span>
                {can("write") && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(e)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(e.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {sorted.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Aucun événement planifié
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};