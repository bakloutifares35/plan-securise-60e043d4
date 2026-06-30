import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Plus, Pencil, Trash2, Search, 
  ChevronDown, ChevronRight, Download, ArrowLeft,
  Building2, Server, Clock, Shield, Users, Package, Handshake, Building, Layers
} from "lucide-react";
import { useBia } from "@/contexts/BiaContext";
import { useGovernance } from "@/contexts/GovernanceContext";
import { useRole } from "@/contexts/RoleContext";
import { computeMaxScore, scoreToCriticality, criticalityColor } from "@/data/bia";
import { toast } from "@/hooks/use-toast";

const AVAILABILITY_PERIODS = [
  { id: "P0_4H", label: "0-4h" },
  { id: "P4_8H", label: "4-8h" },
  { id: "P1D",  label: "1j" },
  { id: "P2D",  label: "2j" },
  { id: "P1W",  label: "1sem" },
  { id: "P2W",  label: "2sem" },
  { id: "P1M",  label: "1mois" },
];

// ── Helper pour récupérer les ressources du département ──
const getDepartmentResources = (processes: any[], deptId: string, deptName: string) => {
  const deptProcesses = processes.filter(p => p.department === deptName || p.entityId === deptId);
  
  const resources = {
    hr: [] as any[],
    equipment: [] as any[],
    suppliers: [] as any[]
  };

  const seen = {
    hr: new Set<string>(),
    equipment: new Set<string>(),
    suppliers: new Set<string>()
  };

  for (const proc of deptProcesses) {
    const procResources = proc.resources || [];
    for (const r of procResources) {
      if (r.type === "HR") {
        if ((r as any).hrPeople) {
          for (const p of (r as any).hrPeople) {
            if (!seen.hr.has(p.name)) {
              seen.hr.add(p.name);
              resources.hr.push({ ...p, id: p.id || `hr_${Date.now()}` });
            }
          }
        } else if (r.name && !seen.hr.has(r.name)) {
          seen.hr.add(r.name);
          resources.hr.push({
            id: r.id || `hr_${Date.now()}`,
            name: r.name,
            role: (r as any).role || "—",
            phone: (r as any).phone || "",
            email: (r as any).email || "",
            availability: (r as any).availability || {}
          });
        }
      } else if (r.type === "Equipement" && !seen.equipment.has(r.name)) {
        seen.equipment.add(r.name);
        resources.equipment.push(r);
      } else if (r.type === "Fournisseur" && !seen.suppliers.has(r.name)) {
        seen.suppliers.add(r.name);
        resources.suppliers.push(r);
      }
    }
  }

  return resources;
};

// ── Modal détail processus ────────────────────────────────────────────────────
const ProcessDetailModal = ({
  process,
  deptProcesses,
  onClose,
}: {
  process: any;
  deptProcesses: any[];
  onClose: () => void;
}) => {
  const score = computeMaxScore(process.impacts);
  const criticality = scoreToCriticality(score);
  
  const appsCritiques = (() => {
    if (process.appsCritiques && Array.isArray(process.appsCritiques) && process.appsCritiques.length > 0) {
      return process.appsCritiques;
    }
    if (process.applicationsIT && Array.isArray(process.applicationsIT) && process.applicationsIT.length > 0) {
      return process.applicationsIT;
    }
    if (process.apps && Array.isArray(process.apps) && process.apps.length > 0) {
      return process.apps;
    }
    const appsFromResources = (process.resources || []).filter((r: any) => r.type === "APPS" || r.type === "Application");
    if (appsFromResources.length > 0) {
      return appsFromResources;
    }
    return [];
  })();
  
  const deptResources = getDepartmentResources(deptProcesses, process.entityId, process.department);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {process.name}
            <Badge className={criticalityColor(criticality)}>{criticality}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Infos générales */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Responsable</p>
              <p className="font-medium">{process.owner || "—"}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Dernière MAJ</p>
              <p className="font-medium">{process.lastUpdated || "—"}</p>
            </div>
          </div>

          {/* RTO / RPO / MTPD */}
          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> Objectifs de continuité
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "RTO", value: process.rto, unit: "h", color: "bg-red-50 border-red-200 text-red-700" },
                { label: "RPO", value: process.rpo, unit: "h", color: "bg-orange-50 border-orange-200 text-orange-700" },
                { label: "MTPD", value: process.mtpd, unit: "h", color: "bg-blue-50 border-blue-200 text-blue-700" },
              ].map(({ label, value, unit, color }) => (
                <div key={label} className={`rounded-xl border p-3 text-center ${color}`}>
                  <p className="text-xs font-semibold opacity-70">{label}</p>
                  <p className="text-2xl font-bold">{value}<span className="text-sm">{unit}</span></p>
                </div>
              ))}
            </div>
          </div>

          {/* Section A — Applications IT */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-6 w-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold">A</div>
              <h3 className="text-sm font-semibold">Applications IT — spécifiques à ce processus</h3>
              <Badge variant="outline" className="text-xs">{appsCritiques.length}</Badge>
            </div>
            {appsCritiques.length === 0 ? (
              <p className="text-sm text-muted-foreground italic bg-muted/20 rounded-lg p-3 text-center">
                Aucune application IT déclarée.
              </p>
            ) : (
              <div className="border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-purple-50">
                      <TableHead>Application</TableHead>
                      <TableHead className="text-center">RTO</TableHead>
                      <TableHead className="text-center">RPO</TableHead>
                      <TableHead>Remplaçable par</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {appsCritiques.map((app: any, index: number) => (
                      <TableRow key={app.id || `app-${index}`}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Server className="h-3.5 w-3.5 text-purple-500" />
                            {app.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className="bg-red-50 text-red-700 border-red-200">{app.rto_hours || app.rto || 0}h</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className="bg-orange-50 text-orange-700 border-orange-200">{app.rpo_hours || app.rpo || 0}h</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{app.remplacablePar || app.remplacable_par || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Section B — RH du processus */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-6 w-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">B</div>
              <h3 className="text-sm font-semibold">Ressources humaines</h3>
              <Badge variant="outline" className="text-xs">
                {(process.resources || []).filter((r: any) => r.type === "HR").length || 0} personne(s)
              </Badge>
            </div>
            <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-2 mb-3">
              Ces personnes sont affectées à <strong>ce processus</strong>.
            </p>

            {(() => {
              const hrResources = (process.resources || []).filter((r: any) => r.type === "HR");
              
              if (hrResources.length === 0) {
                return (
                  <p className="text-sm text-muted-foreground italic bg-muted/20 rounded-lg p-3 text-center">
                    Aucune ressource humaine affectée à ce processus.
                  </p>
                );
              }

              const hrPeople: any[] = [];
              for (const r of hrResources) {
                if ((r as any).hrPeople) {
                  for (const p of (r as any).hrPeople) {
                    hrPeople.push(p);
                  }
                } else {
                  hrPeople.push(r);
                }
              }

              if (hrPeople.length === 0) {
                return (
                  <p className="text-sm text-muted-foreground italic bg-muted/20 rounded-lg p-3 text-center">
                    Aucune ressource humaine affectée à ce processus.
                  </p>
                );
              }

              return (
                <div className="border rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-blue-50">
                          <TableHead className="min-w-[140px]">Personne / Rôle</TableHead>
                          <TableHead className="min-w-[100px]">Contact</TableHead>
                          {AVAILABILITY_PERIODS.map(p => (
                            <TableHead key={p.id} className="text-center min-w-[50px] text-xs">{p.label}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {hrPeople.map((person, index) => (
                          <TableRow key={person.id || index} className="hover:bg-blue-50/30">
                            <TableCell>
                              <p className="font-medium text-sm">{person.name}</p>
                              <p className="text-xs text-muted-foreground">{person.role || "—"}</p>
                            </TableCell>
                            <TableCell>
                              {person.phone && <p className="text-xs">📞 {person.phone}</p>}
                              {person.email && <p className="text-xs">✉️ {person.email}</p>}
                              {!person.phone && !person.email && <span className="text-xs text-muted-foreground">—</span>}
                            </TableCell>
                            {AVAILABILITY_PERIODS.map((period) => {
                              const isAvailable = person.availability?.[period.id] || false;
                              return (
                                <TableCell key={period.id} className="text-center">
                                  <span className={`text-lg font-bold ${isAvailable ? "text-green-600" : "text-red-400"}`}>
                                    {isAvailable ? "✓" : "✗"}
                                  </span>
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Section C — Équipements et Fournisseurs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-6 rounded-full bg-yellow-500 text-white flex items-center justify-center text-xs font-bold">C</div>
                <h3 className="text-sm font-semibold">Équipements</h3>
                <Badge variant="outline" className="text-xs">{deptResources.equipment.length}</Badge>
              </div>
              {deptResources.equipment.length === 0 ? (
                <p className="text-sm text-muted-foreground italic bg-muted/20 rounded-lg p-3 text-center">Aucun équipement.</p>
              ) : (
                <div className="border rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-yellow-50">
                        <TableHead>Nom</TableHead>
                        <TableHead className="text-center">Quantité</TableHead>
                        <TableHead>Remplaçable par</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deptResources.equipment.map((eq) => (
                        <TableRow key={eq.id}>
                          <TableCell className="font-medium">{eq.name}</TableCell>
                          <TableCell className="text-center">{eq.quantity || 1}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{eq.substitutability || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold">D</div>
                <h3 className="text-sm font-semibold">Fournisseurs</h3>
                <Badge variant="outline" className="text-xs">{deptResources.suppliers.length}</Badge>
              </div>
              {deptResources.suppliers.length === 0 ? (
                <p className="text-sm text-muted-foreground italic bg-muted/20 rounded-lg p-3 text-center">Aucun fournisseur.</p>
              ) : (
                <div className="border rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-orange-50">
                        <TableHead>Nom</TableHead>
                        <TableHead className="text-center">RPO</TableHead>
                        <TableHead>Remplaçable par</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deptResources.suppliers.map((sup) => (
                        <TableRow key={sup.id}>
                          <TableCell className="font-medium">{sup.name}</TableCell>
                          <TableCell className="text-center">
                            {(sup as any).rpo_hours ? <Badge variant="outline" className="text-xs">{(sup as any).rpo_hours}h</Badge> : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{sup.substitutability || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>

          {process.description && (
            <div className="bg-muted/20 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1 font-semibold">Description</p>
              <p className="text-sm">{process.description}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ── Cartes (version grise avec ombres et animations) ──
const EntityCard = ({ 
  entity, 
  onClick,
  type = "enterprise",
  processCount = 0,
  critCount = 0,
  departmentCount = 0, // Nouveau : nombre de départements sous la direction
}: { 
  entity: any; 
  onClick: () => void;
  type?: "enterprise" | "direction" | "department";
  processCount?: number;
  critCount?: number;
  departmentCount?: number; // Ajouté
}) => {
  const icons = {
    enterprise: <Building2 className="h-8 w-8" />,
    direction: <Building className="h-8 w-8" />,
    department: <Layers className="h-8 w-8" />
  };

  const labels = {
    enterprise: "Entreprise",
    direction: "Direction",
    department: "Département"
  };

  // Couleurs grises avec dégradés subtils
  const colors = {
    enterprise: "bg-gradient-to-br from-[#e8ecf1] to-[#d5dbe3] hover:from-[#eef1f6] hover:to-[#dce1ea]",
    direction: "bg-gradient-to-br from-[#e2e7ef] to-[#d0d7e2] hover:from-[#e8ecf4] hover:to-[#d6dde8]",
    department: "bg-gradient-to-br from-[#dce2ec] to-[#c9d1dd] hover:from-[#e2e8f2] hover:to-[#cfd7e3]"
  };

  return (
    <div 
      className={`${colors[type]} rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:shadow-[0_16px_40px_rgb(0,0,0,0.10)] transition-all duration-300 cursor-pointer transform hover:scale-[1.02] hover:-translate-y-1 p-6 text-[#1e293b] flex flex-col items-center justify-center min-h-[140px] border border-white/40 backdrop-blur-sm`}
      onClick={onClick}
    >
      <div className="mb-2 text-[#475569]">
        {icons[type]}
      </div>
      <h3 className="text-lg font-bold text-center text-[#0f172a]">{entity.name}</h3>
      <p className="text-xs text-[#64748b] mt-1">{labels[type]}</p>
      
      {/* Badges d'information */}
      <div className="flex flex-wrap gap-2 mt-3 justify-center">
        {type === "enterprise" && (
          <span className="bg-white/60 px-3 py-0.5 rounded-full text-xs font-medium text-[#334155] shadow-sm border border-white/40">
            {departmentCount || 0} direction(s)
          </span>
        )}
        {type === "direction" && (
          <span className="bg-white/60 px-3 py-0.5 rounded-full text-xs font-medium text-[#334155] shadow-sm border border-white/40">
            {departmentCount || 0} département(s)
          </span>
        )}
        {processCount > 0 && (
          <span className="bg-white/60 px-3 py-0.5 rounded-full text-xs font-medium text-[#334155] shadow-sm border border-white/40">
            {processCount} processus
          </span>
        )}
        {critCount > 0 && (
          <span className="bg-red-200/60 px-3 py-0.5 rounded-full text-xs font-medium text-red-700 shadow-sm border border-red-200/40">
            ⚠️ {critCount} critique(s)
          </span>
        )}
      </div>
    </div>
  );
};

// ── ProcessList (tableau) ─────────────────────────────────────────────────────
const ProcessList = ({ 
  processes, 
  department, 
  onBack, 
  onSelectProcess,
  onEdit,
  onDelete,
  canDelete,
  searchQuery,
  setSearchQuery,
  selectedCriticality,
  setSelectedCriticality,
}: {
  processes: any[];
  department: any;
  onBack: () => void;
  onSelectProcess: (proc: any) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  canDelete: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedCriticality: string;
  setSelectedCriticality: (c: string) => void;
}) => {
  const getDeptResources = (deptId: string, deptName: string) => {
    return getDepartmentResources(processes, deptId, deptName);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>
        <h2 className="text-xl font-bold">{department?.name || "Département"}</h2>
        <Badge variant="outline">{processes.length} processus</Badge>
      </div>

      {/* Filtres */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Rechercher un processus..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            className="pl-9" 
          />
        </div>
        <select 
          value={selectedCriticality} 
          onChange={e => setSelectedCriticality(e.target.value)} 
          className="h-10 px-3 rounded-md border bg-background text-sm"
        >
          <option value="all">Toutes les criticités</option>
          <option value="Critique">Critique</option>
          <option value="Majeur">Majeur</option>
          <option value="Modéré">Modéré</option>
          <option value="Mineur">Mineur</option>
        </select>
      </div>

      {/* Tableau des processus */}
      {processes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>Aucun processus dans ce département.</p>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/10">
                <TableHead>Processus</TableHead>
                <TableHead>Responsable</TableHead>
                <TableHead className="text-center">RTO</TableHead>
                <TableHead className="text-center">RPO</TableHead>
                <TableHead>Criticité</TableHead>
                <TableHead>Apps IT</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processes.map(p => {
                const crit = scoreToCriticality(computeMaxScore(p.impacts));
                const apps = (p as any).appsCritiques || [];
                return (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-primary/5 transition-colors"
                    onClick={() => onSelectProcess(p)}
                  >
                    <TableCell className="font-medium text-primary hover:underline">{p.name}</TableCell>
                    <TableCell className="text-sm">{p.owner}</TableCell>
                    <TableCell className="text-center"><Badge className="bg-red-50 text-red-700 border-red-200 text-xs">{p.rto}h</Badge></TableCell>
                    <TableCell className="text-center"><Badge className="bg-orange-50 text-orange-700 border-orange-200 text-xs">{p.rpo}h</Badge></TableCell>
                    <TableCell><Badge className={criticalityColor(crit)}>{crit}</Badge></TableCell>
                    <TableCell>
                      {apps.length > 0
                        ? <div className="flex flex-wrap gap-1">
                            {apps.map((app: any) => (
                              <Badge key={app.id} className="bg-purple-50 text-purple-700 border-purple-200 text-xs gap-1">
                                <Server className="h-3 w-3" /> {app.name}
                              </Badge>
                            ))}
                          </div>
                        : <span className="text-muted-foreground text-xs">—</span>
                      }
                    </TableCell>
                    <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(p.id)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {canDelete && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDelete(p.id, p.name)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

// ── Composant principal ───────────────────────────────────────────────────────
export const ProcessInventory = ({ onEdit, onCreate }: { onEdit: (id: string) => void; onCreate: () => void }) => {
  const { processes, deleteProcess } = useBia();
  const { entities } = useGovernance();
  const { can } = useRole();

  // États de navigation
  const [selectedRoot, setSelectedRoot] = useState<string | null>(null);
  const [selectedDirection, setSelectedDirection] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [viewLevel, setViewLevel] = useState<"enterprises" | "directions" | "departments" | "processes">("enterprises");
  
  // États de recherche/filtre
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCriticality, setSelectedCriticality] = useState<string>("all");

  const [selectedProcess, setSelectedProcess] = useState<any>(null);
  const [selectedProcessDeptProcs, setSelectedProcessDeptProcs] = useState<any[]>([]);

  const entityName = (id: string) => entities.find((e) => e.id === id)?.name ?? "—";
  const rootEntities = useMemo(() => entities.filter(e => e.parentId === null), [entities]);
  const getChildren = (parentId: string) => entities.filter(e => e.parentId === parentId);

  // Compter les départements d'une direction (enfants directs)
  const getDepartmentCount = (entityId: string) => {
    return getChildren(entityId).length;
  };

  const getProcessesForDept = (deptId: string, deptName: string) => {
    let procs = processes.filter(p => p.department === deptName || p.entityId === deptId);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      procs = procs.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.department.toLowerCase().includes(q) ||
        p.owner.toLowerCase().includes(q) ||
        entityName(p.entityId).toLowerCase().includes(q)
      );
    }
    if (selectedCriticality !== "all") {
      procs = procs.filter(p => scoreToCriticality(computeMaxScore(p.impacts)) === selectedCriticality);
    }
    return procs;
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Supprimer le processus "${name}" ?`)) {
      deleteProcess(id);
      toast({ title: "Processus supprimé", description: name });
    }
  };

  const openProcessModal = (proc: any) => {
    const deptProcs = processes.filter(p => p.department === proc.department || p.entityId === proc.entityId);
    setSelectedProcessDeptProcs(deptProcs);
    setSelectedProcess(proc);
  };

  const getProcessCount = (entityId: string) => {
    const deptIds = getChildren(entityId).map(d => d.id);
    let count = 0;
    for (const dept of getChildren(entityId)) {
      count += processes.filter(p => p.department === dept.name || p.entityId === dept.id).length;
    }
    count += processes.filter(p => p.entityId === entityId).length;
    return count;
  };

  const getCritCount = (entityId: string) => {
    let count = 0;
    for (const dept of getChildren(entityId)) {
      count += processes.filter(p => 
        (p.department === dept.name || p.entityId === dept.id) && 
        computeMaxScore(p.impacts) >= 4
      ).length;
    }
    count += processes.filter(p => p.entityId === entityId && computeMaxScore(p.impacts) >= 4).length;
    return count;
  };

  // Navigation
  const goToRoot = () => {
    setViewLevel("enterprises");
    setSelectedRoot(null);
    setSelectedDirection(null);
    setSelectedDepartment(null);
    setSearchQuery("");
    setSelectedCriticality("all");
  };

  const selectRoot = (id: string) => {
    setSelectedRoot(id);
    setViewLevel("directions");
    setSelectedDirection(null);
    setSelectedDepartment(null);
  };

  const selectDirection = (id: string) => {
    setSelectedDirection(id);
    setViewLevel("departments");
    setSelectedDepartment(null);
  };

  const selectDepartment = (id: string) => {
    setSelectedDepartment(id);
    setViewLevel("processes");
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-7 w-7 text-primary" /> Inventaire des processus
          </h1>
          <p className="text-muted-foreground mt-1">
            {viewLevel === "enterprises" && "Sélectionnez une entreprise pour voir ses directions"}
            {viewLevel === "directions" && "Sélectionnez une direction pour voir ses départements"}
            {viewLevel === "departments" && "Sélectionnez un département pour voir ses processus"}
            {viewLevel === "processes" && `Processus de "${entities.find(e => e.id === selectedDepartment)?.name || ""}"`}
          </p>
        </div>
        <div className="flex gap-2">
          {viewLevel !== "enterprises" && (
            <Button variant="outline" onClick={goToRoot} className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Button>
          )}
          {can("write") && viewLevel === "processes" && (
            <Button onClick={onCreate} className="gap-2">
              <Plus className="h-4 w-4" /> Nouveau processus
            </Button>
          )}
        </div>
      </div>

      {/* Cartes statistiques */}
      <div className="grid gap-3 md:grid-cols-6">
        <Card className="bg-gray-100/60 border-gray-200/50 shadow-sm"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Total</p><p className="text-xl font-bold">{processes.length}</p></CardContent></Card>
        <Card className="bg-gray-100/60 border-gray-200/50 shadow-sm"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Critiques</p><p className="text-xl font-bold text-red-600">{processes.filter(p => computeMaxScore(p.impacts) >= 4).length}</p></CardContent></Card>
        <Card className="bg-gray-100/60 border-gray-200/50 shadow-sm"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Majeurs</p><p className="text-xl font-bold text-orange-600">{processes.filter(p => computeMaxScore(p.impacts) >= 3 && computeMaxScore(p.impacts) < 4).length}</p></CardContent></Card>
        <Card className="bg-gray-100/60 border-gray-200/50 shadow-sm"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Modérés</p><p className="text-xl font-bold text-yellow-600">{processes.filter(p => computeMaxScore(p.impacts) >= 2 && computeMaxScore(p.impacts) < 3).length}</p></CardContent></Card>
        <Card className="bg-gray-100/60 border-gray-200/50 shadow-sm"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Mineurs</p><p className="text-xl font-bold text-green-600">{processes.filter(p => computeMaxScore(p.impacts) < 2).length}</p></CardContent></Card>
        <Card className="bg-gray-100/60 border-gray-200/50 shadow-sm"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Score moyen</p><p className="text-xl font-bold">{processes.length ? (processes.reduce((acc, p) => acc + computeMaxScore(p.impacts), 0) / processes.length).toFixed(1) : "0"}/5</p></CardContent></Card>
      </div>

      {/* Contenu principal */}
      <Card className="border-gray-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.05)]">
        <CardContent className="p-6">
          {/* Écran 1 : Entreprises */}
          {viewLevel === "enterprises" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">🏢 Entreprises</h2>
                <span className="text-sm text-muted-foreground">{rootEntities.length} entreprise(s)</span>
              </div>
              {rootEntities.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto text-muted-foreground/30" />
                  <p className="mt-4">Aucune entreprise trouvée.</p>
                  <p className="text-sm">Créez une entité racine dans Gouvernance M1.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {rootEntities.map(root => (
                    <EntityCard
                      key={root.id}
                      entity={root}
                      type="enterprise"
                      processCount={getProcessCount(root.id)}
                      critCount={getCritCount(root.id)}
                      departmentCount={getDepartmentCount(root.id)} // Nombre de directions
                      onClick={() => selectRoot(root.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Écran 2 : Directions */}
          {viewLevel === "directions" && selectedRoot && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">📊 Directions de {entityName(selectedRoot)}</h2>
                  <Badge variant="outline">{getChildren(selectedRoot).length} direction(s)</Badge>
                </div>
              </div>
              {getChildren(selectedRoot).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Building className="h-12 w-12 mx-auto text-muted-foreground/30" />
                  <p className="mt-4">Aucune direction trouvée.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {getChildren(selectedRoot).map(dir => (
                    <EntityCard
                      key={dir.id}
                      entity={dir}
                      type="direction"
                      processCount={getProcessCount(dir.id)}
                      critCount={getCritCount(dir.id)}
                      departmentCount={getDepartmentCount(dir.id)} // Nombre de départements sous la direction
                      onClick={() => selectDirection(dir.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Écran 3 : Départements */}
          {viewLevel === "departments" && selectedDirection && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">📋 Départements de {entityName(selectedDirection)}</h2>
                  <Badge variant="outline">{getChildren(selectedDirection).length} département(s)</Badge>
                </div>
              </div>
              {getChildren(selectedDirection).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Layers className="h-12 w-12 mx-auto text-muted-foreground/30" />
                  <p className="mt-4">Aucun département trouvé.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {getChildren(selectedDirection).map(dept => {
                    const deptResources = getDepartmentResources(processes, dept.id, dept.name);
                    const procs = getProcessesForDept(dept.id, dept.name);
                    return (
                      <div
                        key={dept.id}
                        className="bg-gradient-to-br from-[#dce2ec] to-[#c9d1dd] hover:from-[#e2e8f2] hover:to-[#cfd7e3] rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:shadow-[0_16px_40px_rgb(0,0,0,0.10)] transition-all duration-300 cursor-pointer transform hover:scale-[1.02] hover:-translate-y-1 p-6 text-[#1e293b] flex flex-col border border-white/40 backdrop-blur-sm"
                        onClick={() => selectDepartment(dept.id)}
                      >
                        <div className="mb-2 text-[#475569]">
                          <Layers className="h-8 w-8" />
                        </div>
                        <h3 className="text-lg font-bold text-[#0f172a]">{dept.name}</h3>
                        <p className="text-xs text-[#64748b] mt-1">Département</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <span className="bg-white/60 px-3 py-0.5 rounded-full text-xs font-medium text-[#334155] shadow-sm border border-white/40">
                            {procs.length} processus
                          </span>
                          {procs.filter(p => computeMaxScore(p.impacts) >= 4).length > 0 && (
                            <span className="bg-red-200/60 px-3 py-0.5 rounded-full text-xs font-medium text-red-700 shadow-sm border border-red-200/40">
                              ⚠️ {procs.filter(p => computeMaxScore(p.impacts) >= 4).length}
                            </span>
                          )}
                        </div>
                        {/* Aperçu des ressources */}
                        <div className="mt-3 text-xs text-[#475569] space-y-0.5">
                          {deptResources.hr.length > 0 && (
                            <div className="bg-white/30 px-2 py-0.5 rounded-full inline-block">👥 {deptResources.hr.map(h => h.name).join(", ")}</div>
                          )}
                          {deptResources.equipment.length > 0 && (
                            <div className="bg-white/30 px-2 py-0.5 rounded-full inline-block ml-1">🖥️ {deptResources.equipment.map(e => e.name).join(", ")}</div>
                          )}
                          {deptResources.suppliers.length > 0 && (
                            <div className="bg-white/30 px-2 py-0.5 rounded-full inline-block ml-1">🤝 {deptResources.suppliers.map(s => s.name).join(", ")}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Écran 4 : Processus (tableau) */}
          {viewLevel === "processes" && selectedDepartment && (
            <ProcessList
              processes={getProcessesForDept(selectedDepartment, entities.find(e => e.id === selectedDepartment)?.name || "")}
              department={entities.find(e => e.id === selectedDepartment)}
              onBack={() => {
                setViewLevel("departments");
                setSelectedDepartment(null);
              }}
              onSelectProcess={openProcessModal}
              onEdit={onEdit}
              onDelete={handleDelete}
              canDelete={can("admin")}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              selectedCriticality={selectedCriticality}
              setSelectedCriticality={setSelectedCriticality}
            />
          )}
        </CardContent>
      </Card>

      {/* Modal détail processus */}
      {selectedProcess && (
        <ProcessDetailModal
          process={selectedProcess}
          deptProcesses={selectedProcessDeptProcs}
          onClose={() => setSelectedProcess(null)}
        />
      )}
    </div>
  );
};