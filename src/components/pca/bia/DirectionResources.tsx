import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Building2, Users, Package, Truck, Edit } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useGovernance } from "@/contexts/GovernanceContext";
import { useBia } from "@/contexts/BiaContext";
import { type Resource, type ResourceType } from "@/data/bia";
import { toast } from "@/hooks/use-toast";

const availabilityPeriods = [
  { id: "P0_4H", label: "0-4h" },
  { id: "P4_8H", label: "4-8h" },
  { id: "P1D", label: "1j" },
  { id: "P2D", label: "2j" },
  { id: "P1W", label: "1sem" },
  { id: "P2W", label: "2sem" },
  { id: "P1M", label: "1mois" },
];

const categories: { type: ResourceType; label: string; icon: React.ReactNode; color: string }[] = [
  { type: "HR", label: "Ressources humaines", icon: <Users className="h-4 w-4" />, color: "bg-blue-100 text-blue-700" },
  { type: "Equipement", label: "Équipements", icon: <Package className="h-4 w-4" />, color: "bg-yellow-100 text-yellow-700" },
  { type: "Fournisseur", label: "Fournisseurs", icon: <Truck className="h-4 w-4" />, color: "bg-orange-100 text-orange-700" },
];

const personColors = [
  "bg-red-100 text-red-700", "bg-green-100 text-green-700", "bg-purple-100 text-purple-700",
  "bg-pink-100 text-pink-700", "bg-indigo-100 text-indigo-700", "bg-teal-100 text-teal-700",
];

const getPersonColor = (personId: string) => {
  let hash = 0;
  for (let i = 0; i < personId.length; i++) hash = ((hash << 5) - hash) + personId.charCodeAt(i);
  return personColors[Math.abs(hash) % personColors.length];
};

export const DirectionResources = () => {
  const { entities } = useGovernance();
  const { processes } = useBia();
  
  const [selectedEntityId, setSelectedEntityId] = useState<string>("");
  const [resources, setResources] = useState<Resource[]>([]);
  const [assignments, setAssignments] = useState<Record<string, Record<string, string[]>>>({});
  
  const [newResource, setNewResource] = useState<Omit<Resource, "id">>({
    type: "HR",
    name: "",
    quantity: 1,
    substitutability: "",
    rto: 24, // utilisé uniquement pour les fournisseurs
  });
  const [hrPeople, setHrPeople] = useState<{ id: string; name: string; role: string; phone: string; email: string; perimetre: string; selected: boolean }[]>([
    { id: `p_${Date.now()}`, name: "", role: "", phone: "", email: "", perimetre: "", selected: false }
  ]);
  const [activeCategory, setActiveCategory] = useState<ResourceType>("HR");
  
  const [editingProcessId, setEditingProcessId] = useState<string | null>(null);
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [tempSelectedPeople, setTempSelectedPeople] = useState<string[]>([]);
  
  const getDescendantIds = (parentId: string): string[] => {
    const children = entities.filter(e => e.parentId === parentId);
    const childIds = children.map(c => c.id);
    const grandChildren = children.flatMap(c => getDescendantIds(c.id));
    return [...childIds, ...grandChildren];
  };
  
  const entityProcesses = useMemo(() => {
    if (!selectedEntityId) return [];
    const descendantIds = getDescendantIds(selectedEntityId);
    const allEntityIds = [selectedEntityId, ...descendantIds];
    const descendantNames = entities.filter(e => descendantIds.includes(e.id)).map(d => d.name);
    const filtered = processes.filter(p => 
      allEntityIds.includes(p.entityId) || descendantNames.includes(p.department)
    );
    return filtered;
  }, [processes, selectedEntityId, entities]);
  
  const allPeople = useMemo(() => {
    const people: any[] = [];
    resources.forEach(r => {
      if (r.type === "HR" && (r as any).hrPeople) {
        people.push(...(r as any).hrPeople);
      }
    });
    return people;
  }, [resources]);
  
  const addResource = () => {
    if (activeCategory === "HR") {
      const selectedPeople = hrPeople.filter(p => p.selected && p.name.trim());
      if (selectedPeople.length === 0) {
        toast({ title: "Aucune personne sélectionnée", description: "Veuillez cocher au moins une personne" });
        return;
      }
      const newHrResource: Resource = {
        id: `r_${Date.now()}`,
        type: "HR",
        name: "Équipe de crise",
        quantity: selectedPeople.length,
        substitutability: "",
        hrPeople: selectedPeople,
      };
      setResources([...resources, newHrResource]);
      setHrPeople([{ id: `p_${Date.now()}`, name: "", role: "", phone: "", email: "", perimetre: "", selected: false }]);
      toast({ title: "Équipe enregistrée", description: `${selectedPeople.length} personne(s) ajoutée(s)` });
    } else {
      if (!newResource.name.trim()) {
        toast({ title: "Champ requis", description: "Veuillez saisir un nom" });
        return;
      }
      const newRes: Resource = {
        ...newResource,
        id: `r_${Date.now()}`,
        type: activeCategory,
      };
      // Si c'est un fournisseur, on garde le RTO, sinon on l'ignore
      if (activeCategory !== "Fournisseur") {
        delete (newRes as any).rto;
      }
      setResources([...resources, newRes]);
      setNewResource({ type: activeCategory, name: "", quantity: 1, substitutability: "", rto: 24 });
      toast({ title: "Ressource ajoutée", description: newResource.name });
    }
  };
  
  const removeResource = (id: string) => {
    const toRemove = resources.find(r => r.id === id);
    if (toRemove?.type === "HR" && (toRemove as any).hrPeople) {
      const personIds = (toRemove as any).hrPeople.map((p: any) => p.id);
      const newAssignments = { ...assignments };
      for (const procId of Object.keys(newAssignments)) {
        for (const periodId of Object.keys(newAssignments[procId])) {
          newAssignments[procId][periodId] = newAssignments[procId][periodId].filter(pid => !personIds.includes(pid));
        }
      }
      setAssignments(newAssignments);
    }
    setResources(resources.filter(r => r.id !== id));
    toast({ title: "Ressource supprimée" });
  };
  
  const getResourcesByCategory = (type: ResourceType) => resources.filter(r => r.type === type);
  
  const openEditDialog = (processId: string, periodId: string) => {
    setEditingProcessId(processId);
    setEditingPeriodId(periodId);
    const current = assignments[processId]?.[periodId] || [];
    setTempSelectedPeople([...current]);
  };
  
  const saveCellAssignments = () => {
    if (editingProcessId && editingPeriodId) {
      const newAssignments = { ...assignments };
      if (!newAssignments[editingProcessId]) newAssignments[editingProcessId] = {};
      newAssignments[editingProcessId][editingPeriodId] = tempSelectedPeople;
      setAssignments(newAssignments);
      setEditingProcessId(null);
      setEditingPeriodId(null);
      toast({ title: "Affectation mise à jour" });
    }
  };
  
  const togglePersonSelection = (personId: string) => {
    setTempSelectedPeople(prev => prev.includes(personId) ? prev.filter(id => id !== personId) : [...prev, personId]);
  };
  
  const getCellDisplay = (processId: string, periodId: string) => {
    const personIds = assignments[processId]?.[periodId] || [];
    if (personIds.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
    const persons = allPeople.filter(p => personIds.includes(p.id));
    return (
      <div className="flex flex-wrap gap-1">
        {persons.map(p => (
          <Badge key={p.id} className={cn("text-xs", getPersonColor(p.id))}>{p.name}</Badge>
        ))}
      </div>
    );
  };
  
  const addHrRow = () => setHrPeople([...hrPeople, { id: `p_${Date.now()}`, name: "", role: "", phone: "", email: "", perimetre: "", selected: false }]);
  const removeHrRow = (index: number) => {
    if (hrPeople.length === 1) { toast({ title: "Impossible", description: "Gardez au moins une ligne" }); return; }
    setHrPeople(hrPeople.filter((_, i) => i !== index));
  };
  const updateHrRow = (index: number, field: string, value: any) => {
    const updated = [...hrPeople];
    updated[index] = { ...updated[index], [field]: value };
    setHrPeople(updated);
  };
  const toggleSelectAll = () => {
    const allSelected = hrPeople.length > 0 && hrPeople.every(p => p.selected);
    setHrPeople(hrPeople.map(p => ({ ...p, selected: !allSelected })));
  };
  
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><Building2 className="h-7 w-7 text-primary" /> Ressources critiques par direction</h1><p className="text-muted-foreground mt-1">Gérez les ressources humaines, équipements et fournisseurs partagés au niveau de chaque direction</p></div>
      
      <Card><CardHeader><CardTitle className="text-lg">Sélectionnez une direction</CardTitle></CardHeader><CardContent>
        <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
          <SelectTrigger className="w-[300px]"><SelectValue placeholder="Choisir une direction..." /></SelectTrigger>
          <SelectContent>{entities.filter(e => e.type?.toUpperCase() === "DIRECTION").map(dir => <SelectItem key={dir.id} value={dir.id}>{dir.name}</SelectItem>)}</SelectContent>
        </Select>
      </CardContent></Card>

      {selectedEntityId && (
        <>
          <div className="flex flex-wrap gap-2 border-b pb-2">
            {categories.map(cat => {
              const count = getResourcesByCategory(cat.type).length;
              return (<button key={cat.type} onClick={() => setActiveCategory(cat.type)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${activeCategory === cat.type ? `${cat.color} ring-2 ring-offset-1 ring-primary/30` : "bg-muted/30 text-muted-foreground hover:bg-muted/50"}`}>{cat.icon}<span>{cat.label}</span>{count > 0 && <Badge variant="secondary" className="text-xs h-5 w-5 p-0 rounded-full">{count}</Badge>}</button>);
            })}
          </div>

          <Card><CardHeader><CardTitle className="text-md">Ajouter une ressource</CardTitle></CardHeader><CardContent>
            {activeCategory === "HR" && (
              <div className="space-y-4">
                <div className="flex justify-end"><Button onClick={addHrRow} variant="outline" size="sm"><Plus className="h-3 w-3" /> Ajouter une personne</Button></div>
                <div className="overflow-auto">
                  <Table><TableHeader><TableRow><TableHead className="w-10"><input type="checkbox" checked={hrPeople.length > 0 && hrPeople.every(p => p.selected)} onChange={toggleSelectAll} /></TableHead><TableHead>Nom complet</TableHead><TableHead>Rôle</TableHead><TableHead>Téléphone</TableHead><TableHead>Email</TableHead><TableHead>Périmètre</TableHead><TableHead></TableHead></TableRow></TableHeader>
                  <TableBody>{hrPeople.map((p, idx) => (<TableRow key={p.id}><TableCell><input type="checkbox" checked={p.selected} onChange={(e) => updateHrRow(idx, "selected", e.target.checked)} /></TableCell><TableCell><Input value={p.name} onChange={(e) => updateHrRow(idx, "name", e.target.value)} placeholder="Jean Dupont" /></TableCell><TableCell><Input value={p.role} onChange={(e) => updateHrRow(idx, "role", e.target.value)} placeholder="Responsable" /></TableCell><TableCell><Input value={p.phone} onChange={(e) => updateHrRow(idx, "phone", e.target.value)} placeholder="+33 6..." /></TableCell><TableCell><Input value={p.email} onChange={(e) => updateHrRow(idx, "email", e.target.value)} placeholder="email@example.com" /></TableCell><TableCell><Input value={p.perimetre} onChange={(e) => updateHrRow(idx, "perimetre", e.target.value)} placeholder="Ex: Finance, IT..." /></TableCell><TableCell><Button variant="ghost" size="icon" onClick={() => removeHrRow(idx)} disabled={hrPeople.length === 1}><Trash2 className="h-3 w-3 text-destructive" /></Button></TableCell></TableRow>))}</TableBody></Table>
                </div>
                <Button onClick={addResource} className="bg-primary">Enregistrer l'équipe sélectionnée</Button>
                <p className="text-xs text-muted-foreground text-center">💡 Cochez les personnes à inclure dans l'équipe de crise.</p>
              </div>
            )}
            {activeCategory === "Equipement" && (
              <div className="grid grid-cols-3 gap-4">
                <div><Label>Nom</Label><Input value={newResource.name} onChange={(e) => setNewResource({ ...newResource, name: e.target.value })} placeholder="Ex: Scanner" /></div>
                <div><Label>Quantité</Label><Input type="number" min={1} value={newResource.quantity} onChange={(e) => setNewResource({ ...newResource, quantity: Number(e.target.value) })} /></div>
                <div><Label>Remplaçable par</Label><Input value={newResource.substitutability} onChange={(e) => setNewResource({ ...newResource, substitutability: e.target.value })} placeholder="Alternative..." /></div>
                <div className="col-span-3"><Button onClick={addResource}><Plus className="h-3 w-3 mr-1" /> Ajouter</Button></div>
              </div>
            )}
            {activeCategory === "Fournisseur" && (
              <div className="grid grid-cols-4 gap-4">
                <div><Label>Nom</Label><Input value={newResource.name} onChange={(e) => setNewResource({ ...newResource, name: e.target.value })} placeholder="Ex: AWS" /></div>
                <div><Label>Quantité</Label><Input type="number" min={1} value={newResource.quantity} onChange={(e) => setNewResource({ ...newResource, quantity: Number(e.target.value) })} /></div>
                <div><Label>RTO (heures)</Label><Input type="number" min={0} step={0.5} value={newResource.rto} onChange={(e) => setNewResource({ ...newResource, rto: Number(e.target.value) })} placeholder="24" /></div>
                <div><Label>Remplaçable par</Label><Input value={newResource.substitutability} onChange={(e) => setNewResource({ ...newResource, substitutability: e.target.value })} placeholder="Alternative..." /></div>
                <div className="col-span-4"><Button onClick={addResource}><Plus className="h-3 w-3 mr-1" /> Ajouter</Button></div>
              </div>
            )}
          </CardContent></Card>
          
          <div className="space-y-4">
            {categories.map(cat => {
              const catResources = getResourcesByCategory(cat.type);
              if (catResources.length === 0) return null;
              return (
                <Card key={cat.type}>
                  <CardHeader className={`${cat.color} rounded-t-lg`}>
                    <CardTitle className="text-md flex items-center gap-2">{cat.icon} {cat.label}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-2 space-y-2">
                    {catResources.map(r => (
                      <div key={r.id} className="flex justify-between items-center p-2 border rounded-lg">
                        <div>
                          {cat.type === "HR" && (r as any).hrPeople ? (
                            <div><p className="font-medium">Équipe de crise ({ (r as any).hrPeople.length } personnes)</p>
                            <div className="text-xs text-muted-foreground">
                              {(r as any).hrPeople.map((p: any) => `${p.name} (${p.role}) - ${p.perimetre || "Tous"}`).join(', ')}
                            </div></div>
                          ) : (
                            <><p className="font-medium">{r.name}</p>
                            <div className="flex flex-wrap gap-2 text-xs mt-1">
                              <Badge variant="outline">{r.quantity} unité(s)</Badge>
                              {cat.type === "Fournisseur" && (r as any).rto && <Badge variant="outline">RTO: {(r as any).rto}h</Badge>}
                              {r.substitutability && <Badge variant="outline">🔄 {r.substitutability}</Badge>}
                            </div></>
                          )}
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => removeResource(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          
          {allPeople.length > 0 && entityProcesses.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-md">Affectation des personnes aux périodes par processus</CardTitle>
                <p className="text-xs text-muted-foreground">Cliquez sur une cellule pour affecter des personnes à cette période pour ce processus</p>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[150px]">Processus</TableHead>
                      {availabilityPeriods.map(period => (
                        <TableHead key={period.id} className="text-center min-w-[120px]">{period.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entityProcesses.map(proc => (
                      <TableRow key={proc.id}>
                        <TableCell className="font-medium">{proc.name}</TableCell>
                        {availabilityPeriods.map(period => (
                          <TableCell key={period.id} className="cursor-pointer hover:bg-muted/30 align-top" onClick={() => openEditDialog(proc.id, period.id)}>
                            <div className="flex items-center justify-between gap-1">
                              <div className="flex-1">{getCellDisplay(proc.id, period.id)}</div>
                              <Edit className="h-3 w-3 text-muted-foreground shrink-0" />
                            </div>
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
          {allPeople.length === 0 && <p className="text-center text-muted-foreground mt-4">Aucune personne enregistrée. Ajoutez d'abord des ressources humaines.</p>}
          {entityProcesses.length === 0 && <p className="text-center text-muted-foreground mt-4">Aucun processus trouvé pour cette direction (ou ses départements). Vérifiez que des processus existent et sont rattachés.</p>}
        </>
      )}
      
      <Dialog open={editingProcessId !== null} onOpenChange={(open) => !open && setEditingProcessId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Affecter des personnes – Période {availabilityPeriods.find(p => p.id === editingPeriodId)?.label}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-4">
            {allPeople.length === 0 ? <p className="text-sm text-muted-foreground">Aucune personne enregistrée. Ajoutez d'abord des ressources humaines.</p> : allPeople.map(person => (
              <div key={person.id} className="flex items-center space-x-2">
                <Checkbox id={`person-${person.id}`} checked={tempSelectedPeople.includes(person.id)} onCheckedChange={() => togglePersonSelection(person.id)} />
                <Label htmlFor={`person-${person.id}`} className="text-sm">{person.name} {person.role && <span className="text-xs text-muted-foreground">({person.role})</span>}{person.perimetre && <span className="text-xs text-muted-foreground ml-1">- {person.perimetre}</span>}</Label>
              </div>
            ))}
          </div>
          <div className="flex justify-end"><Button onClick={saveCellAssignments} disabled={allPeople.length === 0}>Enregistrer</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
};