import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { useBia } from "@/contexts/BiaContext";
import { useGovernance } from "@/contexts/GovernanceContext";
import { useRole } from "@/contexts/RoleContext";
import { computeMaxScore, scoreToCriticality, criticalityColor } from "@/data/bia";
import { toast } from "@/hooks/use-toast";

export const ProcessInventory = ({ onEdit, onCreate }: { onEdit: (id: string) => void; onCreate: () => void }) => {
  const { processes, deleteProcess } = useBia();
  const { entities } = useGovernance();
  const { can } = useRole();
  const [q, setQ] = useState("");

  const entityName = (id: string) => entities.find((e) => e.id === id)?.name ?? "—";

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return processes;
    return processes.filter((p) =>
      [p.id, p.name, p.department, p.owner, entityName(p.entityId)].some((v) => v.toLowerCase().includes(s))
    );
  }, [processes, q, entities]);

  const handleDelete = (id: string, name: string) => {
    deleteProcess(id);
    toast({ title: "Processus supprimé", description: name });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Inventaire des processus</h1>
          <p className="text-muted-foreground mt-1">Liste structurée des processus métiers par entité et département.</p>
        </div>
        {can("write") && (
          <Button onClick={onCreate}>
            <Plus className="h-4 w-4 mr-2" /> Nouveau processus
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-sm mb-4">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher..." className="pl-9" />
          </div>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Processus</TableHead>
                  <TableHead>Entité</TableHead>
                  <TableHead>Département</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Criticité</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const c = scoreToCriticality(computeMaxScore(p.impacts));
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.id}</TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{entityName(p.entityId)}</TableCell>
                      <TableCell>{p.department}</TableCell>
                      <TableCell>{p.owner}</TableCell>
                      <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${criticalityColor(c)}`}>{c}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => onEdit(p.id)} aria-label="Modifier">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {can("admin") && (
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(p.id, p.name)} aria-label="Supprimer">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">Aucun processus trouvé.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
