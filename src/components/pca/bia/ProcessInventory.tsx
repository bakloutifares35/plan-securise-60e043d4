import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Plus, Pencil, Trash2, Search, 
  ChevronDown, ChevronRight, Download, 
  Building2, Server, Clock, Shield, Users, Package, Handshake
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
  
  // ✅ Récupération robuste des apps critiques
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

          {/* Section A — Applications IT avec RTO/RPO */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-6 w-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold">A</div>
              <h3 className="text-sm font-semibold">Applications IT — spécifiques à ce processus</h3>
              <Badge variant="outline" className="text-xs">{appsCritiques.length}</Badge>
            </div>
            {appsCritiques.length === 0 ? (
              <p className="text-sm text-muted-foreground italic bg-muted/20 rounded-lg p-3 text-center">
                Aucune application IT déclarée.
                <br />
                <span className="text-xs text-muted-foreground/70">Ajoutez-en dans le BIA Wizard → Étape 4 → Applications IT</span>
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

          {/* ✅ Section B — RH UNIQUEMENT AFFECTÉES À CE PROCESSUS (version tableau) */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-6 w-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">B</div>
              <h3 className="text-sm font-semibold">Ressources humaines</h3>
              <Badge variant="outline" className="text-xs">
                {(process.resources || []).filter((r: any) => r.type === "HR").length || 0} personne(s)
              </Badge>
            </div>
            <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-2 mb-3">
              Ces personnes sont affectées à <strong>ce processus</strong>. Les ✓/✗ montrent leurs disponibilités par période.
            </p>

            {(() => {
              // ✅ Récupérer UNIQUEMENT les RH de ce processus
              const hrResources = (process.resources || []).filter((r: any) => r.type === "HR");
              
              if (hrResources.length === 0) {
                return (
                  <p className="text-sm text-muted-foreground italic bg-muted/20 rounded-lg p-3 text-center">
                    Aucune ressource humaine affectée à ce processus.
                    <br />
                    <span className="text-xs text-muted-foreground/70">Ajoutez-en dans le BIA Wizard → Étape 4 → RH</span>
                  </p>
                );
              }

              // Extraire les personnes des ressources HR
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
            {/* Équipements */}
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

            {/* Fournisseurs */}
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

          {/* Description */}
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

// ── Composant principal ───────────────────────────────────────────────────────
export const ProcessInventory = ({ onEdit, onCreate }: { onEdit: (id: string) => void; onCreate: () => void }) => {
  const { processes, deleteProcess } = useBia();
  const { entities } = useGovernance();
  const { can } = useRole();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCriticality, setSelectedCriticality] = useState<string>("all");
  const [expandedRoots, setExpandedRoots] = useState<Set<string>>(new Set());
  const [expandedDirections, setExpandedDirections] = useState<Set<string>>(new Set());
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"hierarchy" | "table">("hierarchy");
  const [selectedProcess, setSelectedProcess] = useState<any>(null);
  const [selectedProcessDeptProcs, setSelectedProcessDeptProcs] = useState<any[]>([]);

  const entityName = (id: string) => entities.find((e) => e.id === id)?.name ?? "—";
  const rootEntities = useMemo(() => entities.filter(e => e.parentId === null), [entities]);
  const getChildren = (parentId: string) => entities.filter(e => e.parentId === parentId);

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

  const filteredProcesses = useMemo(() => {
    let procs = [...processes];
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
  }, [processes, searchQuery, selectedCriticality, entities]);

  const stats = {
    total: processes.length,
    filtered: filteredProcesses.length,
    critiques: filteredProcesses.filter(p => computeMaxScore(p.impacts) >= 4).length,
    majeurs: filteredProcesses.filter(p => computeMaxScore(p.impacts) >= 3 && computeMaxScore(p.impacts) < 4).length,
    moderes: filteredProcesses.filter(p => computeMaxScore(p.impacts) >= 2 && computeMaxScore(p.impacts) < 3).length,
    mineurs: filteredProcesses.filter(p => computeMaxScore(p.impacts) < 2).length,
    avgScore: filteredProcesses.length ? filteredProcesses.reduce((acc, p) => acc + computeMaxScore(p.impacts), 0) / filteredProcesses.length : 0
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Supprimer le processus "${name}" ?`)) {
      deleteProcess(id);
      toast({ title: "Processus supprimé", description: name });
    }
  };

  const openProcessModal = (proc: any, deptId: string, deptName: string) => {
    const deptProcs = processes.filter(p => p.department === deptName || p.entityId === deptId);
    setSelectedProcessDeptProcs(deptProcs);
    setSelectedProcess(proc);
  };

  const toggleRoot = (id: string) => { const s = new Set(expandedRoots); s.has(id) ? s.delete(id) : s.add(id); setExpandedRoots(s); };
  const toggleDirection = (id: string) => { const s = new Set(expandedDirections); s.has(id) ? s.delete(id) : s.add(id); setExpandedDirections(s); };
  const toggleDept = (id: string) => { const s = new Set(expandedDepts); s.has(id) ? s.delete(id) : s.add(id); setExpandedDepts(s); };
  const expandAll = () => { setExpandedRoots(new Set(rootEntities.map(e => e.id))); setExpandedDirections(new Set(entities.filter(e => e.parentId !== null).map(e => e.id))); setExpandedDepts(new Set(entities.filter(e => e.parentId !== null).map(e => e.id))); };
  const collapseAll = () => { setExpandedRoots(new Set()); setExpandedDirections(new Set()); setExpandedDepts(new Set()); };

  const exportToCSV = () => {
    const headers = ["Nom", "Direction", "Département", "Responsable", "Criticité", "RTO", "RPO", "MTPD", "MBCO", "Statut"];
    const rows = filteredProcesses.map(p => {
      const dept = entities.find(e => e.id === p.entityId || e.name === p.department);
      const dir = dept ? entities.find(e => e.id === dept.parentId) : null;
      return [p.name, dir?.name || "—", p.department, p.owner, scoreToCriticality(computeMaxScore(p.impacts)), p.rto, p.rpo, p.mtpd, p.mbco, p.status];
    });
    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "inventaire_processus.csv"; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export CSV", description: `${filteredProcesses.length} processus exportés` });
  };

  const getDeptAvgScore = (procs: typeof processes) => {
    if (!procs.length) return 0;
    return (procs.reduce((acc, p) => acc + computeMaxScore(p.impacts), 0) / procs.length).toFixed(1);
  };

  // ── Render département avec ressources ──
  const renderDepartmentWithResources = (dept: any, procs: any[]) => {
    const isDeptExpanded = expandedDepts.has(dept.id);
    const avgScore = getDeptAvgScore(procs);
    const critCount = procs.filter(p => computeMaxScore(p.impacts) >= 4).length;
    const deptResources = getDepartmentResources(processes, dept.id, dept.name);

    return (
      <div key={dept.id} className="border-b last:border-b-0">
        <button onClick={() => toggleDept(dept.id)} className="w-full flex items-center justify-between p-3 bg-muted/10 hover:bg-muted/20 transition-colors">
          <div className="flex items-center gap-2">
            {isDeptExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span className="font-medium">{dept.name}</span>
            <Badge variant="outline" className="text-xs">{procs.length} processus</Badge>
            {critCount > 0 && <Badge className="bg-red-100 text-red-700 text-xs">⚠️ {critCount}</Badge>}
          </div>
          <span className="text-xs text-muted-foreground">Score moyen: {avgScore}/5</span>
        </button>

        {isDeptExpanded && (
          <div className="pl-6 pb-2">
            {/* Ressources du département */}
            <div className="flex flex-wrap gap-4 p-3 bg-amber-50/50 rounded-lg border border-amber-200 mb-3">
              <div className="flex items-center gap-1 text-sm">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-700">RH :</span>
                <span className="text-sm">
                  {deptResources.hr.length > 0 
                    ? deptResources.hr.map(p => p.name).join(", ")
                    : "Aucune"}
                </span>
              </div>
              <div className="flex items-center gap-1 text-sm">
                <Package className="h-4 w-4 text-yellow-600" />
                <span className="font-medium text-yellow-700">Équipements :</span>
                <span className="text-sm">
                  {deptResources.equipment.length > 0
                    ? deptResources.equipment.map(e => e.name).join(", ")
                    : "Aucun"}
                </span>
              </div>
              <div className="flex items-center gap-1 text-sm">
                <Handshake className="h-4 w-4 text-orange-600" />
                <span className="font-medium text-orange-700">Fournisseurs :</span>
                <span className="text-sm">
                  {deptResources.suppliers.length > 0
                    ? deptResources.suppliers.map(s => s.name).join(", ")
                    : "Aucun"}
                </span>
              </div>
            </div>

            {/* Processus */}
            {procs.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">Aucun processus</div>
            ) : (
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
                  {procs.map(p => {
                    const crit = scoreToCriticality(computeMaxScore(p.impacts));
                    const apps = (p as any).appsCritiques || [];
                    return (
                      <TableRow
                        key={p.id}
                        className="cursor-pointer hover:bg-primary/5 transition-colors"
                        onClick={() => openProcessModal(p, dept.id, dept.name)}
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
                                    <Server className="h-3 w-3" /> {app.name} <span className="text-[10px] opacity-70">(RTO {app.rto_hours}h)</span>
                                  </Badge>
                                ))}
                              </div>
                            : <span className="text-muted-foreground text-xs">—</span>
                          }
                        </TableCell>
                        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(p.id)}><Pencil className="h-3.5 w-3.5" /></Button>
                            {can("admin") && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(p.id, p.name)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-7 w-7 text-primary" /> Inventaire des processus
          </h1>
          <p className="text-muted-foreground mt-1">Hiérarchie : Entreprise → Direction → Département → Processus</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCSV} className="gap-2"><Download className="h-4 w-4" /> Exporter CSV</Button>
          {can("write") && <Button onClick={onCreate} className="gap-2"><Plus className="h-4 w-4" /> Nouveau processus</Button>}
        </div>
      </div>

      {/* Cartes statistiques */}
      <div className="grid gap-3 md:grid-cols-6">
        <Card className="bg-blue-500/10"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Total</p><p className="text-xl font-bold">{stats.filtered}</p></CardContent></Card>
        <Card className="bg-red-500/10"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Critiques</p><p className="text-xl font-bold text-red-600">{stats.critiques}</p></CardContent></Card>
        <Card className="bg-orange-500/10"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Majeurs</p><p className="text-xl font-bold text-orange-600">{stats.majeurs}</p></CardContent></Card>
        <Card className="bg-yellow-500/10"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Modérés</p><p className="text-xl font-bold text-yellow-600">{stats.moderes}</p></CardContent></Card>
        <Card className="bg-green-500/10"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Mineurs</p><p className="text-xl font-bold text-green-600">{stats.mineurs}</p></CardContent></Card>
        <Card className="bg-purple-500/10"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Score moyen</p><p className="text-xl font-bold">{stats.avgScore.toFixed(1)}/5</p></CardContent></Card>
      </div>

      {/* Filtres */}
      <Card><CardContent className="p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher par processus, département, responsable..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
          <select value={selectedCriticality} onChange={e => setSelectedCriticality(e.target.value)} className="h-10 px-3 rounded-md border bg-background text-sm">
            <option value="all">Toutes les criticités</option>
            <option value="Critique">Critique</option>
            <option value="Majeur">Majeur</option>
            <option value="Modéré">Modéré</option>
            <option value="Mineur">Mineur</option>
          </select>
          <div className="flex gap-1 flex-wrap">
            <Button variant={viewMode === "hierarchy" ? "default" : "outline"} size="sm" onClick={() => setViewMode("hierarchy")}>Vue hiérarchique</Button>
            <Button variant={viewMode === "table" ? "default" : "outline"} size="sm" onClick={() => setViewMode("table")}>Vue tableau</Button>
            <Button variant="outline" size="sm" onClick={expandAll}>Tout développer</Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>Tout réduire</Button>
          </div>
        </div>
      </CardContent></Card>

      {/* Contenu principal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {viewMode === "hierarchy" ? "Hiérarchie par Entreprise → Direction → Département → Processus" : "Inventaire détaillé des processus"}
          </CardTitle>
          <p className="text-xs text-muted-foreground">Cliquez sur un processus pour voir ses détails.</p>
        </CardHeader>
        <CardContent>
          {viewMode === "hierarchy" ? (
            <div className="space-y-4">
              {rootEntities.map(root => {
                const isRootExpanded = expandedRoots.has(root.id);
                const directions = getChildren(root.id);
                const visibleDirections = directions.filter(dir => {
                  if (!searchQuery && selectedCriticality === "all") return true;
                  const depts = getChildren(dir.id);
                  return depts.some(dept => getProcessesForDept(dept.id, dept.name).length > 0);
                });
                if (visibleDirections.length === 0 && (searchQuery || selectedCriticality !== "all")) return null;
                const totalProcesses = directions.reduce((acc, dir) => acc + getChildren(dir.id).reduce((sum, dept) => sum + getProcessesForDept(dept.id, dept.name).length, 0), 0);
                const totalCritiques = directions.reduce((acc, dir) => acc + getChildren(dir.id).reduce((sum, dept) => sum + getProcessesForDept(dept.id, dept.name).filter(p => computeMaxScore(p.impacts) >= 4).length, 0), 0);

                return (
                  <div key={root.id} className="border rounded-xl overflow-hidden">
                    <button onClick={() => toggleRoot(root.id)} className="w-full flex items-center justify-between p-4 bg-primary/10 hover:bg-primary/15 transition-colors">
                      <div className="flex items-center gap-3">
                        {isRootExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                        <Building2 className="h-5 w-5 text-primary" />
                        <span className="font-bold text-lg">{root.name}</span>
                        <Badge variant="outline">{totalProcesses} processus</Badge>
                        {totalCritiques > 0 && <Badge className="bg-red-100 text-red-700">⚠️ {totalCritiques} critique(s)</Badge>}
                      </div>
                    </button>

                    {isRootExpanded && (
                      <div className="border-t">
                        {visibleDirections.length === 0 ? (
                          <div className="p-4 text-center text-muted-foreground text-sm">Aucune direction</div>
                        ) : visibleDirections.map(dir => {
                          const isDirExpanded = expandedDirections.has(dir.id);
                          const departments = getChildren(dir.id);
                          const visibleDepts = departments.filter(dept => {
                            if (!searchQuery && selectedCriticality === "all") return true;
                            return getProcessesForDept(dept.id, dept.name).length > 0;
                          });
                          const dirTotalProcs = departments.reduce((acc, dept) => acc + getProcessesForDept(dept.id, dept.name).length, 0);
                          const dirCritiques = departments.reduce((acc, dept) => acc + getProcessesForDept(dept.id, dept.name).filter(p => computeMaxScore(p.impacts) >= 4).length, 0);

                          return (
                            <div key={dir.id} className="border-b last:border-b-0">
                              <button onClick={() => toggleDirection(dir.id)} className="w-full flex items-center justify-between p-3 bg-muted/20 pl-10 hover:bg-muted/30 transition-colors">
                                <div className="flex items-center gap-2">
                                  {isDirExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                  <span className="font-semibold">{dir.name}</span>
                                  <Badge variant="outline" className="text-xs">{dirTotalProcs} processus</Badge>
                                  {dirCritiques > 0 && <Badge className="bg-red-100 text-red-700 text-xs">⚠️ {dirCritiques}</Badge>}
                                </div>
                              </button>

                              {isDirExpanded && (
                                <div className="pl-10">
                                  {visibleDepts.length === 0 ? (
                                    <div className="p-4 text-center text-muted-foreground text-sm">Aucun département</div>
                                  ) : visibleDepts.map(dept => {
                                    const procs = getProcessesForDept(dept.id, dept.name);
                                    return renderDepartmentWithResources(dept, procs);
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              {rootEntities.length === 0 && (
                <p className="text-center text-muted-foreground py-8 text-sm">Aucune entreprise racine trouvée. Créez d'abord votre organigramme dans Gouvernance M1.</p>
              )}
            </div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Processus</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Département</TableHead>
                    <TableHead>Responsable</TableHead>
                    <TableHead className="text-center">RTO</TableHead>
                    <TableHead className="text-center">RPO</TableHead>
                    <TableHead>Criticité</TableHead>
                    <TableHead>Apps IT</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProcesses.map(p => {
                    const dept = entities.find(e => e.id === p.entityId || e.name === p.department);
                    const dir = dept ? entities.find(e => e.id === dept?.parentId) : null;
                    const crit = scoreToCriticality(computeMaxScore(p.impacts));
                    const apps = (p as any).appsCritiques || [];
                    return (
                      <TableRow
                        key={p.id}
                        className="cursor-pointer hover:bg-primary/5"
                        onClick={() => openProcessModal(p, dept?.id || "", dept?.name || p.department)}
                      >
                        <TableCell className="font-medium text-primary hover:underline">{p.name}</TableCell>
                        <TableCell className="text-sm">{dir?.name || "—"}</TableCell>
                        <TableCell className="text-sm">{p.department}</TableCell>
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
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(p.id)}><Pencil className="h-3.5 w-3.5" /></Button>
                            {can("admin") && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(p.id, p.name)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredProcesses.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Aucun processus trouvé</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
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