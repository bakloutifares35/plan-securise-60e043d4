import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, ArrowRight, Check, Plus, Trash2, ShieldAlert, TrendingUp, Server, Users, Building2, Package, Edit2 } from "lucide-react";
import { useBia } from "@/contexts/BiaContext";
import { useGovernance } from "@/contexts/GovernanceContext";
import {
  PERIODS, AXIS_LABELS, emptyImpacts, computeMaxScore,
  scoreToCriticality, criticalityColor,
  type Process, type ImpactAxis, type TimePeriod, type Resource, type ResourceType,
} from "@/data/bia";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { VoiceMic } from "./VoiceMic";

// ==================== CONSTANTES GLOBALES ====================
const AVAILABILITY_PERIODS = [
  { id: "P0_4H", label: "0-4h" },
  { id: "P4_8H", label: "4-8h" },
  { id: "P1D", label: "1j" },
  { id: "P2D", label: "2j" },
  { id: "P1W", label: "1sem" },
  { id: "P2W", label: "2sem" },
  { id: "P1M", label: "1mois" },
];

// ==================== DESCRIPTIONS DES SCORES ====================
const impactDescriptions: Record<ImpactAxis, Record<number, string>> = {
  financial: {
    1: "Aucune perte financière",
    2: "Perte marginale, sans impact significatif",
    3: "Perte tolérable, visible dans les résultats",
    4: "Perte élevée, nettement visible",
    5: "Perte majeure pouvant mettre l'entreprise en danger",
  },
  regulatory: {
    1: "Aucun risque juridique",
    2: "Infraction mineure, pas d'amende significative",
    3: "Infraction avec amende modérée ou plainte",
    4: "Amende importante, poursuites possibles",
    5: "Perte de licence d'exploitation, prison",
  },
  reputation: {
    1: "Aucun impact",
    2: "Impact marginal, pas de couverture médiatique",
    3: "Impact tolérable, petit article local",
    4: "Impact significatif, couverture nationale",
    5: "Impact sévère, perte de confiance irréversible",
  },
  client: {
    1: "Aucun impact client",
    2: "Mécontentement mineur",
    3: "Perte de quelques clients",
    4: "Perte significative de clients",
    5: "Perte massive de clients, défiance généralisée",
  },
  operational: {
    1: "Aucune interruption",
    2: "Gêne mineure, processus ralentis",
    3: "Dégradation acceptable de l'efficacité",
    4: "Interruption significative de plusieurs processus",
    5: "Arrêt complet des activités critiques",
  },
};

const StaticImpactMatrix = () => {
  const severityLevels = [
    { label: "Very Severe", color: "bg-red-800 text-white", border: "border-red-900" },
    { label: "Severe", color: "bg-red-600 text-white", border: "border-red-700" },
    { label: "Major", color: "bg-orange-500 text-white", border: "border-orange-600" },
    { label: "Moderate", color: "bg-yellow-500 text-black", border: "border-yellow-600" },
    { label: "Minor", color: "bg-green-600 text-white", border: "border-green-700" },
  ];

  const rows = [
    {
      category: "💰 Financial Impact",
      descriptions: [
        "Significant financial loss which might lead to a negative business result.",
        "High financial loss which is remarkable in the company's results.",
        "Financial loss is tolerable.",
        "Financial loss is marginal.",
        "No financial loss.",
      ],
    },
    {
      category: "⚖️ Compliance / Legal Impact",
      descriptions: [
        "Administrative complaint leads to loss of business license.",
        "Legal violations / complaints result in significant fines for the company and may cause jail or suspended sentences.",
        "Legal violations / complaints result in claims for compensation or company fines.",
        "Legal violations / complaints result in no significant fines for the company.",
        "No legal harm.",
      ],
    },
    {
      category: "⚙️ Operational Impact",
      descriptions: [
        "Severe disruption of the business processes.",
        "Significant disruption of the business processes.",
        "Acceptable impairment of the business processes (e.g., inefficient processes or parts of the business operations).",
        "Marginal impact on the business processes.",
        "No significant impact on the business processes.",
      ],
    },
    {
      category: "📢 Reputational Impact",
      descriptions: [
        "Severe reputational impact. Customers’ or business partners’ trust is irreparably damaged.",
        "Significant reputational impact (e.g., customers, business partners). Event causes media headlines or even negative publicity.",
        "Tolerable reputational impact (e.g., customers, business partners). Event causes small media headlines.",
        "Marginal reputational impact which are negligible. No media notes.",
        "No reputational impact (e.g. media notes).",
      ],
    },
  ];

  return (
    <div className="border rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/50">
              <th className="border p-2 text-left font-semibold">Business Impact Assessment</th>
              {severityLevels.map((s) => (
                <th key={s.label} className={`border p-2 text-center font-semibold ${s.color}`}>
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className="hover:bg-muted/20">
                <td className="border p-2 font-medium">{row.category}</td>
                {row.descriptions.map((desc, i) => (
                  <td key={i} className="border p-2 text-xs">
                    {desc}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-muted/30 p-3 text-xs text-muted-foreground border-t">
        📊 <strong>Fourchettes d'impact financier (% de l'assiette IFRS sur 3 ans)</strong> :
        Minor (0-0,075%) | Moderate (0,076-0,30%) | Major (0,31-1,20%) | Severe (1,21-4,80%) | Very Severe (4,81%+)
      </div>
    </div>
  );
};

const ImpactTooltip = ({ axis }: { axis: ImpactAxis }) => {
  const descriptions = impactDescriptions[axis];
  return (
    <Tooltip.Provider>
      <Tooltip.Root delayDuration={200}>
        <Tooltip.Trigger asChild>
          <button className="ml-1 text-muted-foreground hover:text-foreground cursor-help focus:outline-none">
            ℹ️
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="z-50 max-w-xs rounded-md bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md border border-border"
            sideOffset={5}
          >
            <p className="font-semibold mb-1">{AXIS_LABELS[axis]}</p>
            {Object.entries(descriptions).map(([score, desc]) => (
              <div key={score} className="mb-0.5">
                <span className="font-medium">{score} :</span> {desc}
              </div>
            ))}
            <Tooltip.Arrow className="fill-border" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
};

type AppCritique = {
  id: string;
  name: string;
  rto_hours: number;
  rpo_hours: number;
  remplacablePar: string;
};

const STEPS = [
  { id: "general", label: "Général", icon: "📋" },
  { id: "impact", label: "Impact métier", icon: "🎯" },
  { id: "rto", label: "Délais & RTO/RPO", icon: "⏱️" },
  { id: "resources", label: "Ressources", icon: "🛠️" },
  { id: "validation", label: "Validation", icon: "✅" }
];

const getFirstCriticalPeriod = (impacts: any): { periodId: TimePeriod; hours: number; maxScore: number } | null => {
  const candidates: { periodId: TimePeriod; hours: number; maxScore: number }[] = [];
  for (const period of PERIODS) {
    const periodData = impacts[period.id];
    if (!periodData) continue;
    let maxScore = 0;
    for (const axis of Object.keys(AXIS_LABELS) as ImpactAxis[]) {
      const score = periodData[axis] || 0;
      if (score > maxScore) maxScore = score;
    }
    if (maxScore >= 3) {
      candidates.push({ periodId: period.id, hours: period.hours, maxScore });
    }
  }
  if (candidates.length === 0) return null;
  return candidates.reduce((min, curr) => (curr.hours < min.hours ? curr : min));
};

const getSuggestedRTOFromImpacts = (impacts: any): number => {
  const criticalPeriod = getFirstCriticalPeriod(impacts);
  if (!criticalPeriod) return 72;
  const hours = criticalPeriod.hours;
  const maxScore = criticalPeriod.maxScore;
  if (maxScore >= 5) {
    if (hours <= 4) return 2;
    if (hours <= 8) return 4;
    if (hours <= 24) return 8;
    if (hours <= 48) return 24;
    if (hours <= 168) return 72;
    return 168;
  }
  if (maxScore >= 4) {
    if (hours <= 4) return 4;
    if (hours <= 8) return 8;
    if (hours <= 24) return 24;
    if (hours <= 48) return 48;
    return 72;
  }
  if (maxScore >= 3) {
    if (hours <= 24) return 24;
    if (hours <= 48) return 48;
    return 72;
  }
  return 72;
};

const getSuggestedRPOFromImpacts = (impacts: any): number => {
  const criticalPeriod = getFirstCriticalPeriod(impacts);
  if (!criticalPeriod) return 12;
  const hours = criticalPeriod.hours;
  const maxScore = criticalPeriod.maxScore;
  if (maxScore >= 5) {
    if (hours <= 4) return 0.5;
    if (hours <= 8) return 1;
    if (hours <= 24) return 2;
    if (hours <= 48) return 4;
    if (hours <= 168) return 12;
    return 24;
  }
  if (maxScore >= 4) {
    if (hours <= 4) return 1;
    if (hours <= 8) return 2;
    if (hours <= 24) return 4;
    return 8;
  }
  if (maxScore >= 3) {
    return 8;
  }
  return 12;
};

const getSafeImpacts = (impacts: any) => {
  if (!impacts || typeof impacts !== 'object') {
    return emptyImpacts();
  }
  const firstKey = Object.keys(impacts)[0];
  if (firstKey && (firstKey === "P0_4H" || firstKey === "P4_8H" || firstKey === "P1D")) {
    const safeImpacts = emptyImpacts();
    for (const p of PERIODS) {
      const periodData = impacts[p.id];
      if (periodData && typeof periodData === 'object') {
        for (const a of Object.keys(AXIS_LABELS) as ImpactAxis[]) {
          safeImpacts[p.id][a] = typeof periodData[a] === 'number' ? periodData[a] : 0;
        }
      }
    }
    return safeImpacts;
  }
  const safeImpacts = emptyImpacts();
  const simpleScores = {
    financial: impacts.financial || 0,
    reputational: impacts.reputational || 0,
    regulatory: impacts.regulatory || 0,
    operational: impacts.operational || 0,
    client: impacts.client || 0
  };
  for (const p of PERIODS) {
    for (const a of Object.keys(AXIS_LABELS) as ImpactAxis[]) {
      safeImpacts[p.id][a] = simpleScores[a as keyof typeof simpleScores] || 0;
    }
  }
  return safeImpacts;
};

const newProcess = (): Process => ({
  id: `pr_${Date.now()}`,
  name: "",
  entityId: "",
  department: "",
  owner: "",
  description: "",
  status: "Actif",
  impacts: emptyImpacts(),
  rto: 24,
  rpo: 4,
  mtpd: 72,
  mbco: 80,
  resources: [],
  dependsOn: [],
  appsCritiques: [] as any,
  lastUpdated: new Date().toISOString().slice(0, 10),
});

// ==================== RESSOURCES EDITOR COMPLET ====================
const ResourcesEditor = ({ 
  resources, 
  onChange, 
  appsCritiques, 
  onAppsChange,
  allProcesses,
  departmentId,
  processName,
  currentStep,
}: { 
  resources: Resource[]; 
  onChange: (r: Resource[]) => void;
  appsCritiques: AppCritique[];
  onAppsChange: (apps: AppCritique[]) => void;
  allProcesses: Process[];
  departmentId: string;
  processName: string;
  currentStep: number;
}) => {
  // ════════════════════════════════════════════════════
  // ✅ ONGLETS PRINCIPAUX : "Apps IT" et "Ressources partagées"
  // ════════════════════════════════════════════════════
  const [activeTab, setActiveTab] = useState<"apps" | "shared">("apps");
  
  // Sous-onglets pour les ressources partagées
  const [sharedSubTab, setSharedSubTab] = useState<"HR" | "Equipement" | "Fournisseur">("HR");

  // États pour les formulaires d'ajout
  const [showAppForm, setShowAppForm] = useState(false);
  const [showHRForm, setShowHRForm] = useState(false);
  const [showEquipmentForm, setShowEquipmentForm] = useState(false);
  const [showSupplierForm, setShowSupplierForm] = useState(false);

  // États pour l'édition
  const [editingResource, setEditingResource] = useState<any>(null);
  const [editingApp, setEditingApp] = useState<any>(null);

  // Nouvelle application IT
  const [newApp, setNewApp] = useState<Omit<AppCritique, "id">>({
    name: "",
    rto_hours: 4,
    rpo_hours: 1,
    remplacablePar: "",
  });

  // Nouvelle ressource HR (avec disponibilités)
  const [newHR, setNewHR] = useState({
    name: "",
    role: "",
    phone: "",
    email: "",
    availability: {
      P0_4H: false,
      P4_8H: false,
      P1D: false,
      P2D: false,
      P1W: false,
      P2W: false,
      P1M: false
    }
  });

  // Nouvel équipement
  const [newEquipment, setNewEquipment] = useState({
    name: "",
    quantity: 1,
    substitutability: ""
  });

  // Nouveau fournisseur (avec RTO/RPO)
  const [newSupplier, setNewSupplier] = useState({
    name: "",
    rpo_hours: 1,
    substitutability: ""
  });

  // ✅ Récupérer TOUTES les ressources du département (depuis tous les processus)
  const departmentResources = useMemo(() => {
    const deptProcesses = allProcesses.filter(p => p.entityId === departmentId);
    const allResources: Resource[] = [];
    const seen = new Set<string>();

    for (const proc of deptProcesses) {
      for (const r of proc.resources || []) {
        const key = r.type + r.name;
        if (!seen.has(key)) {
          seen.add(key);
          allResources.push(r);
        }
      }
    }
    return allResources;
  }, [allProcesses, departmentId]);

  // Filtrer les ressources du département par type
  const getDepartmentResourcesByType = (type: ResourceType) => 
    departmentResources.filter(r => r.type === type);

  // ============ APPLICATIONS IT ============
  const addApp = () => {
    if (!newApp.name.trim()) {
      toast({ title: "Champ requis", description: "Veuillez saisir un nom d'application" });
      return;
    }
    onAppsChange([...appsCritiques, { ...newApp, id: `app_${Date.now()}` }]);
    setNewApp({ name: "", rto_hours: 4, rpo_hours: 1, remplacablePar: "" });
    setShowAppForm(false);
    toast({ title: "Application ajoutée", description: newApp.name });
  };

  const removeApp = (id: string) => {
    onAppsChange(appsCritiques.filter(a => a.id !== id));
    toast({ title: "Application supprimée" });
  };

  const startEditApp = (app: any) => {
    setEditingApp({ ...app });
  };

  const saveEditApp = () => {
    if (!editingApp) return;
    if (!editingApp.name.trim()) {
      toast({ title: "Champ requis", description: "Veuillez saisir un nom" });
      return;
    }
    onAppsChange(appsCritiques.map(a => a.id === editingApp.id ? editingApp : a));
    setEditingApp(null);
    toast({ title: "Application modifiée", description: editingApp.name });
  };

  // ============ RESSOURCES HUMAINES ============
  const addHR = () => {
    if (!newHR.name.trim()) {
      toast({ title: "Champ requis", description: "Veuillez saisir un nom" });
      return;
    }
    const hasAvailability = Object.values(newHR.availability).some(v => v === true);
    if (!hasAvailability) {
      toast({ title: "Attention", description: "Veuillez sélectionner au moins une période de disponibilité" });
      return;
    }
    const newResourceItem: any = {
      id: `hr_${Date.now()}`,
      type: "HR",
      name: newHR.name,
      role: newHR.role || "—",
      phone: newHR.phone || "",
      email: newHR.email || "",
      availability: newHR.availability,
      quantity: 1,
    };
    onChange([...resources, newResourceItem]);
    setNewHR({
      name: "",
      role: "",
      phone: "",
      email: "",
      availability: { P0_4H: false, P4_8H: false, P1D: false, P2D: false, P1W: false, P2W: false, P1M: false }
    });
    setShowHRForm(false);
    toast({ title: "Ressource RH ajoutée", description: newHR.name });
  };

  // ============ ÉQUIPEMENTS ============
  const addEquipment = () => {
    if (!newEquipment.name.trim()) {
      toast({ title: "Champ requis", description: "Veuillez saisir un nom d'équipement" });
      return;
    }
    const newResourceItem: any = {
      id: `eq_${Date.now()}`,
      type: "Equipement",
      name: newEquipment.name,
      quantity: newEquipment.quantity || 1,
      substitutability: newEquipment.substitutability || "",
    };
    onChange([...resources, newResourceItem]);
    setNewEquipment({ name: "", quantity: 1, substitutability: "" });
    setShowEquipmentForm(false);
    toast({ title: "Équipement ajouté", description: newEquipment.name });
  };

  // ============ FOURNISSEURS (avec RPO uniquement) ============
  const addSupplier = () => {
    if (!newSupplier.name.trim()) {
      toast({ title: "Champ requis", description: "Veuillez saisir un nom de fournisseur" });
      return;
    }
    const newResourceItem: any = {
      id: `sup_${Date.now()}`,
      type: "Fournisseur",
      name: newSupplier.name,
      rpo_hours: newSupplier.rpo_hours || 1,
      substitutability: newSupplier.substitutability || "",
      quantity: 1,
    };
    onChange([...resources, newResourceItem]);
    setNewSupplier({ name: "", rpo_hours: 1, substitutability: "" });
    setShowSupplierForm(false);
    toast({ title: "Fournisseur ajouté", description: newSupplier.name });
  };

  // ============ SUPPRESSION (supprime même si la ressource est dans d'autres processus) ============
  const removeResource = (id: string) => {
    const resource = resources.find(r => r.id === id);
    onChange(resources.filter(r => r.id !== id));
    toast({ title: "Ressource supprimée du processus", description: resource?.name });
  };

  // ============ ÉDITION RESSOURCE ============
  const startEditResource = (resource: any) => {
    setEditingResource({ ...resource });
  };

  const saveEditResource = () => {
    if (!editingResource) return;
    if (!editingResource.name.trim()) {
      toast({ title: "Champ requis", description: "Veuillez saisir un nom" });
      return;
    }
    onChange(resources.map(r => r.id === editingResource.id ? editingResource : r));
    setEditingResource(null);
    toast({ title: "Ressource modifiée", description: editingResource.name });
  };

  // ============ RENDU ============
  return (
    <div className="space-y-6">
      {/* ════════════════════════════════════════════════ */}
      {/* ✅ TITRE DU PROCESSUS - taille moyenne, sans badge */}
      {/* ════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20">
        <div className="flex items-center gap-3">
          <div className="h-10 w-1 rounded-full bg-primary" />
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Processus en cours</p>
            <h2 className="text-xl md:text-2xl font-bold text-primary tracking-tight">
              {processName || "Nouveau processus"}
            </h2>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════ */}
      {/* ✅ ONGLETS PRINCIPAUX */}
      {/* ════════════════════════════════════════════════ */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        <button
          onClick={() => setActiveTab("apps")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "apps"
              ? "bg-purple-100 text-purple-700 ring-2 ring-purple-300"
              : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
          }`}
        >
          <Server className="h-4 w-4" />
          Applications IT
          <Badge variant="secondary" className="text-xs">{appsCritiques.length}</Badge>
        </button>
        <button
          onClick={() => setActiveTab("shared")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "shared"
              ? "bg-blue-100 text-blue-700 ring-2 ring-blue-300"
              : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
          }`}
        >
          <Users className="h-4 w-4" />
          Ressources partagées
          <Badge variant="secondary" className="text-xs">{departmentResources.length}</Badge>
        </button>
      </div>

      {/* ════════════════════════════════════════════════ */}
      {/* ✅ SECTION A — APPLICATIONS IT */}
      {/* ════════════════════════════════════════════════ */}
      {activeTab === "apps" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Applications UNIQUEMENT utilisées par ce processus avec leurs RTO/RPO spécifiques.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowAppForm(!showAppForm)}>
              <Plus className="h-3 w-3 mr-1" />
              Ajouter
            </Button>
          </div>

          {showAppForm && (
            <div className="mb-4 p-4 bg-white/50 rounded-lg border border-purple-200">
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-1">
                  <Label className="text-xs">Nom *</Label>
                  <Input value={newApp.name} onChange={(e) => setNewApp({ ...newApp, name: e.target.value })} placeholder="Ex: SWIFT, SAP..." className="h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">RTO (h)</Label>
                  <Input type="number" value={newApp.rto_hours} onChange={(e) => setNewApp({ ...newApp, rto_hours: Number(e.target.value) })} className="h-8 text-sm" min={0} step={0.5} />
                </div>
                <div>
                  <Label className="text-xs">RPO (h)</Label>
                  <Input type="number" value={newApp.rpo_hours} onChange={(e) => setNewApp({ ...newApp, rpo_hours: Number(e.target.value) })} className="h-8 text-sm" min={0} step={0.5} />
                </div>
                <div>
                  <Label className="text-xs">Remplaçable par</Label>
                  <Input value={newApp.remplacablePar} onChange={(e) => setNewApp({ ...newApp, remplacablePar: e.target.value })} placeholder="Ex: solution manuelle..." className="h-8 text-sm" />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <Button variant="ghost" size="sm" onClick={() => setShowAppForm(false)}>Annuler</Button>
                <Button size="sm" onClick={addApp}>Ajouter</Button>
              </div>
            </div>
          )}

          {appsCritiques.length === 0 ? (
            <p className="text-sm text-muted-foreground italic text-center py-6 border border-dashed rounded-lg">Aucune application IT critique pour ce processus.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Application</TableHead>
                  <TableHead className="text-center">RTO</TableHead>
                  <TableHead className="text-center">RPO</TableHead>
                  <TableHead>Remplaçable par</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appsCritiques.map((app) => (
                  <TableRow key={app.id}>
                    {editingApp?.id === app.id ? (
                      <>
                        <TableCell><Input value={editingApp.name} onChange={(e) => setEditingApp({ ...editingApp, name: e.target.value })} className="h-8 text-sm" /></TableCell>
                        <TableCell className="text-center"><Input type="number" value={editingApp.rto_hours} onChange={(e) => setEditingApp({ ...editingApp, rto_hours: Number(e.target.value) })} className="h-8 text-sm w-20 mx-auto" min={0} step={0.5} /></TableCell>
                        <TableCell className="text-center"><Input type="number" value={editingApp.rpo_hours} onChange={(e) => setEditingApp({ ...editingApp, rpo_hours: Number(e.target.value) })} className="h-8 text-sm w-20 mx-auto" min={0} step={0.5} /></TableCell>
                        <TableCell><Input value={editingApp.remplacablePar} onChange={(e) => setEditingApp({ ...editingApp, remplacablePar: e.target.value })} className="h-8 text-sm" /></TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="h-7 w-7 text-green-600" onClick={saveEditApp}><Check className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7" onClick={() => setEditingApp(null)}>✕</Button>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="font-medium">{app.name}</TableCell>
                        <TableCell className="text-center"><Badge className="bg-red-50 text-red-700">{app.rto_hours}h</Badge></TableCell>
                        <TableCell className="text-center"><Badge className="bg-orange-50 text-orange-700">{app.rpo_hours}h</Badge></TableCell>
                        <TableCell>{app.remplacablePar || "—"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditApp(app)}><Edit2 className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeApp(app.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════ */}
      {/* ✅ SECTION B — RESSOURCES PARTAGÉES */}
      {/* ════════════════════════════════════════════════ */}
      {activeTab === "shared" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Toutes les ressources partagées par les processus du département.</p>

          {/* Sous-onglets */}
          <div className="flex flex-wrap gap-2 border-b border-border pb-2">
            <button
              onClick={() => setSharedSubTab("HR")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${
                sharedSubTab === "HR"
                  ? "bg-blue-100 text-blue-700 ring-2 ring-blue-300"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
              }`}
            >
              <Users className="h-4 w-4" /> RH <Badge variant="secondary" className="text-xs">{getDepartmentResourcesByType("HR").length}</Badge>
            </button>
            <button
              onClick={() => setSharedSubTab("Equipement")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${
                sharedSubTab === "Equipement"
                  ? "bg-yellow-100 text-yellow-700 ring-2 ring-yellow-300"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
              }`}
            >
              <Package className="h-4 w-4" /> Équipements <Badge variant="secondary" className="text-xs">{getDepartmentResourcesByType("Equipement").length}</Badge>
            </button>
            <button
              onClick={() => setSharedSubTab("Fournisseur")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${
                sharedSubTab === "Fournisseur"
                  ? "bg-orange-100 text-orange-700 ring-2 ring-orange-300"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
              }`}
            >
              <Building2 className="h-4 w-4" /> Fournisseurs <Badge variant="secondary" className="text-xs">{getDepartmentResourcesByType("Fournisseur").length}</Badge>
            </button>
          </div>

          {/* ── RESSOURCES HUMAINES ── */}
          {sharedSubTab === "HR" && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowHRForm(!showHRForm)}>
                  <Plus className="h-3 w-3 mr-1" /> Ajouter une RH
                </Button>
              </div>

              {showHRForm && (
                <div className="p-4 bg-white/50 rounded-lg border border-blue-200">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs">Nom *</Label><Input value={newHR.name} onChange={(e) => setNewHR({ ...newHR, name: e.target.value })} placeholder="Jean Dupont" className="h-8 text-sm" /></div>
                    <div><Label className="text-xs">Rôle</Label><Input value={newHR.role} onChange={(e) => setNewHR({ ...newHR, role: e.target.value })} placeholder="Responsable" className="h-8 text-sm" /></div>
                    <div><Label className="text-xs">Téléphone</Label><Input value={newHR.phone} onChange={(e) => setNewHR({ ...newHR, phone: e.target.value })} placeholder="+33 6..." className="h-8 text-sm" /></div>
                    <div><Label className="text-xs">Email</Label><Input value={newHR.email} onChange={(e) => setNewHR({ ...newHR, email: e.target.value })} placeholder="nom@email.com" className="h-8 text-sm" /></div>
                  </div>
                  <div className="mt-3">
                    <Label className="text-xs font-medium">Périodes de disponibilité</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {AVAILABILITY_PERIODS.map((period) => (
                        <label key={period.id} className="flex items-center gap-1 text-xs">
                          <input type="checkbox" checked={newHR.availability[period.id]} onChange={(e) => setNewHR({ ...newHR, availability: { ...newHR.availability, [period.id]: e.target.checked } })} className="rounded" /> {period.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-3">
                    <Button variant="ghost" size="sm" onClick={() => setShowHRForm(false)}>Annuler</Button>
                    <Button size="sm" onClick={addHR}>Ajouter</Button>
                  </div>
                </div>
              )}

              {getDepartmentResourcesByType("HR").length === 0 ? (
                <p className="text-sm text-muted-foreground italic text-center py-6 border border-dashed rounded-lg">Aucune ressource humaine dans ce département.</p>
              ) : (
                <div className="space-y-2">
                  {getDepartmentResourcesByType("HR").map((r) => (
                    <div key={r.id} className="p-3 bg-blue-50/30 rounded-lg border border-blue-100/50">
                      {editingResource?.id === r.id ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div><Label className="text-xs">Nom</Label><Input value={editingResource.name} onChange={(e) => setEditingResource({ ...editingResource, name: e.target.value })} className="h-8 text-sm" /></div>
                            <div><Label className="text-xs">Rôle</Label><Input value={editingResource.role} onChange={(e) => setEditingResource({ ...editingResource, role: e.target.value })} className="h-8 text-sm" /></div>
                            <div><Label className="text-xs">Téléphone</Label><Input value={editingResource.phone} onChange={(e) => setEditingResource({ ...editingResource, phone: e.target.value })} className="h-8 text-sm" /></div>
                            <div><Label className="text-xs">Email</Label><Input value={editingResource.email} onChange={(e) => setEditingResource({ ...editingResource, email: e.target.value })} className="h-8 text-sm" /></div>
                          </div>
                          <div className="mt-2">
                            <Label className="text-xs font-medium">Périodes de disponibilité</Label>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {AVAILABILITY_PERIODS.map((period) => (
                                <label key={period.id} className="flex items-center gap-1 text-xs">
                                  <input 
                                    type="checkbox" 
                                    checked={editingResource.availability?.[period.id] || false} 
                                    onChange={(e) => setEditingResource({ 
                                      ...editingResource, 
                                      availability: { ...editingResource.availability, [period.id]: e.target.checked } 
                                    })} 
                                    className="rounded" 
                                  /> {period.label}
                                </label>
                              ))}
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 mt-2">
                            <Button variant="ghost" size="sm" onClick={() => setEditingResource(null)}>Annuler</Button>
                            <Button size="sm" onClick={saveEditResource}>Enregistrer</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{r.name}</p>
                            <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                              <span>👔 {(r as any).role || "—"}</span>
                              {(r as any).phone && <span>📞 {(r as any).phone}</span>}
                              {(r as any).email && <span>✉️ {(r as any).email}</span>}
                            </div>
                            {(r as any).availability && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {AVAILABILITY_PERIODS.map((period) => (
                                  <Badge key={period.id} variant={(r as any).availability[period.id] ? "default" : "outline"} className="text-[10px]">{period.label}</Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditResource(r)}><Edit2 className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeResource(r.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── ÉQUIPEMENTS ── */}
          {sharedSubTab === "Equipement" && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowEquipmentForm(!showEquipmentForm)}>
                  <Plus className="h-3 w-3 mr-1" /> Ajouter un équipement
                </Button>
              </div>

              {showEquipmentForm && (
                <div className="p-4 bg-white/50 rounded-lg border border-yellow-200">
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label className="text-xs">Nom *</Label><Input value={newEquipment.name} onChange={(e) => setNewEquipment({ ...newEquipment, name: e.target.value })} placeholder="Scanner, Serveur..." className="h-8 text-sm" /></div>
                    <div><Label className="text-xs">Quantité</Label><Input type="number" min={1} value={newEquipment.quantity} onChange={(e) => setNewEquipment({ ...newEquipment, quantity: Number(e.target.value) })} className="h-8 text-sm" /></div>
                    <div><Label className="text-xs">Remplaçable par</Label><Input value={newEquipment.substitutability} onChange={(e) => setNewEquipment({ ...newEquipment, substitutability: e.target.value })} placeholder="Équipement de secours..." className="h-8 text-sm" /></div>
                  </div>
                  <div className="flex justify-end gap-2 mt-3">
                    <Button variant="ghost" size="sm" onClick={() => setShowEquipmentForm(false)}>Annuler</Button>
                    <Button size="sm" onClick={addEquipment}>Ajouter</Button>
                  </div>
                </div>
              )}

              {getDepartmentResourcesByType("Equipement").length === 0 ? (
                <p className="text-sm text-muted-foreground italic text-center py-6 border border-dashed rounded-lg">Aucun équipement dans ce département.</p>
              ) : (
                <div className="space-y-2">
                  {getDepartmentResourcesByType("Equipement").map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-3 bg-yellow-50/30 rounded-lg border border-yellow-100/50">
                      {editingResource?.id === r.id ? (
                        <div className="w-full space-y-2">
                          <div className="grid grid-cols-3 gap-2">
                            <div><Label className="text-xs">Nom</Label><Input value={editingResource.name} onChange={(e) => setEditingResource({ ...editingResource, name: e.target.value })} className="h-8 text-sm" /></div>
                            <div><Label className="text-xs">Quantité</Label><Input type="number" value={editingResource.quantity} onChange={(e) => setEditingResource({ ...editingResource, quantity: Number(e.target.value) })} className="h-8 text-sm" min={1} /></div>
                            <div><Label className="text-xs">Remplaçable par</Label><Input value={editingResource.substitutability} onChange={(e) => setEditingResource({ ...editingResource, substitutability: e.target.value })} className="h-8 text-sm" /></div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setEditingResource(null)}>Annuler</Button>
                            <Button size="sm" onClick={saveEditResource}>Enregistrer</Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div>
                            <p className="font-medium text-sm">{r.name}</p>
                            <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                              <span>📦 {r.quantity} unité(s)</span>
                              {r.substitutability && <span>🔄 {r.substitutability}</span>}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditResource(r)}><Edit2 className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeResource(r.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── FOURNISSEURS (avec RPO uniquement) ── */}
          {sharedSubTab === "Fournisseur" && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowSupplierForm(!showSupplierForm)}>
                  <Plus className="h-3 w-3 mr-1" /> Ajouter un fournisseur
                </Button>
              </div>

              {showSupplierForm && (
                <div className="p-4 bg-white/50 rounded-lg border border-orange-200">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1"><Label className="text-xs">Nom *</Label><Input value={newSupplier.name} onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })} placeholder="AWS, OVH..." className="h-8 text-sm" /></div>
                    <div><Label className="text-xs">RPO (h)</Label><Input type="number" value={newSupplier.rpo_hours} onChange={(e) => setNewSupplier({ ...newSupplier, rpo_hours: Number(e.target.value) })} className="h-8 text-sm" min={0} step={0.5} /></div>
                    <div><Label className="text-xs">Remplaçable par</Label><Input value={newSupplier.substitutability} onChange={(e) => setNewSupplier({ ...newSupplier, substitutability: e.target.value })} placeholder="Fournisseur alternatif..." className="h-8 text-sm" /></div>
                  </div>
                  <div className="flex justify-end gap-2 mt-3">
                    <Button variant="ghost" size="sm" onClick={() => setShowSupplierForm(false)}>Annuler</Button>
                    <Button size="sm" onClick={addSupplier}>Ajouter</Button>
                  </div>
                </div>
              )}

              {getDepartmentResourcesByType("Fournisseur").length === 0 ? (
                <p className="text-sm text-muted-foreground italic text-center py-6 border border-dashed rounded-lg">Aucun fournisseur dans ce département.</p>
              ) : (
                <div className="space-y-2">
                  {getDepartmentResourcesByType("Fournisseur").map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-3 bg-orange-50/30 rounded-lg border border-orange-100/50">
                      {editingResource?.id === r.id ? (
                        <div className="w-full space-y-2">
                          <div className="grid grid-cols-3 gap-2">
                            <div><Label className="text-xs">Nom</Label><Input value={editingResource.name} onChange={(e) => setEditingResource({ ...editingResource, name: e.target.value })} className="h-8 text-sm" /></div>
                            <div><Label className="text-xs">RPO (h)</Label><Input type="number" value={editingResource.rpo_hours} onChange={(e) => setEditingResource({ ...editingResource, rpo_hours: Number(e.target.value) })} className="h-8 text-sm" min={0} step={0.5} /></div>
                            <div><Label className="text-xs">Remplaçable par</Label><Input value={editingResource.substitutability} onChange={(e) => setEditingResource({ ...editingResource, substitutability: e.target.value })} className="h-8 text-sm" /></div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setEditingResource(null)}>Annuler</Button>
                            <Button size="sm" onClick={saveEditResource}>Enregistrer</Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div>
                            <p className="font-medium text-sm">{r.name}</p>
                            <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                              {(r as any).rpo_hours && <span>📊 RPO: {(r as any).rpo_hours}h</span>}
                              {r.substitutability && <span>🔄 {r.substitutability}</span>}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditResource(r)}><Edit2 className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeResource(r.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============ SUMMARY VIEW ============
const SummaryView = ({ data, entityName, criticality, score, appsCritiques }: { 
  data: Process; 
  entityName: string; 
  criticality: ReturnType<typeof scoreToCriticality>; 
  score: number;
  appsCritiques: AppCritique[];
}) => {
  const scorePercentage = Math.round((score / 5) * 100);
  const getScoreColor = () => {
    if (score >= 4) return "bg-red-500";
    if (score >= 3) return "bg-orange-500";
    if (score >= 2) return "bg-yellow-500";
    return "bg-green-500";
  };
  const getRecommendation = () => {
    if (score >= 4) return { title: "Action urgente requise", message: "Ce processus est CRITIQUE. Un PCA détaillé doit être mis en place immédiatement.", icon: "🚨", color: "text-red-700 bg-red-50 border-red-200" };
    if (score >= 3) return { title: "Priorité haute", message: "Ce processus est MAJEUR. Planifiez la mise en place d'un PCA dans les 30 jours.", icon: "⚠️", color: "text-orange-700 bg-orange-50 border-orange-200" };
    if (score >= 2) return { title: "À surveiller", message: "Ce processus est MODÉRÉ. Une documentation de continuité est recommandée.", icon: "📋", color: "text-yellow-700 bg-yellow-50 border-yellow-200" };
    return { title: "Non critique", message: "Ce processus est MINEUR. Aucune action immédiate requise.", icon: "✅", color: "text-green-700 bg-green-50 border-green-200" };
  };
  const recommendation = getRecommendation();

  const resourcesByType = {
    HR: data.resources.filter(r => r.type === "HR"),
    Equipement: data.resources.filter(r => r.type === "Equipement"),
    Fournisseur: data.resources.filter(r => r.type === "Fournisseur"),
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary/10 mb-4">
          <span className="text-3xl font-bold text-primary">{scorePercentage}%</span>
        </div>
        <h2 className="text-xl font-bold text-foreground">Validation du BIA</h2>
        <p className="text-sm text-muted-foreground">Vérifiez les informations avant validation</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <span className="text-base">📋</span> Identification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between py-1 border-b">
              <span className="text-muted-foreground">Nom du processus</span>
              <span className="font-medium">{data.name || "—"}</span>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span className="text-muted-foreground">Entité</span>
              <span className="font-medium">{entityName || "—"}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Responsable</span>
              <span className="font-medium">{data.owner || "—"}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <span className="text-base">⏱️</span> Objectifs de continuité
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/30 rounded-lg p-2 text-center">
                <p className="text-xs text-muted-foreground">RTO</p>
                <p className="text-lg font-bold text-primary">{data.rto} <span className="text-xs">heures</span></p>
              </div>
              <div className="bg-muted/30 rounded-lg p-2 text-center">
                <p className="text-xs text-muted-foreground">RPO</p>
                <p className="text-lg font-bold text-primary">{data.rpo} <span className="text-xs">heures</span></p>
              </div>
              <div className="bg-muted/30 rounded-lg p-2 text-center">
                <p className="text-xs text-muted-foreground">MTPD</p>
                <p className="text-lg font-bold text-primary">{data.mtpd} <span className="text-xs">heures</span></p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <span className="text-base">🎯</span> Niveau de criticité
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-3">
            <div className={`px-3 py-1 rounded-full text-sm font-semibold ${criticalityColor(criticality)}`}>
              {criticality}
            </div>
            <div className="flex-1">
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div className={`h-full ${getScoreColor()} transition-all duration-500`} style={{ width: `${scorePercentage}%` }} />
              </div>
            </div>
            <span className="text-sm font-medium">{score}/5</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Score calculé automatiquement à partir de l'évaluation des impacts.
          </p>
        </CardContent>
      </Card>

      <Card className={recommendation.color}>
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">{recommendation.icon}</span>
            <div>
              <p className="font-semibold text-sm">{recommendation.title}</p>
              <p className="text-sm mt-0.5">{recommendation.message}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {data.description && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <span className="text-base">📝</span> Description
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{data.description}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <span className="text-base">🛠️</span> Ressources & Applications critiques
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {appsCritiques && appsCritiques.length > 0 && (
              <div className="border rounded-lg overflow-hidden md:col-span-2">
                <div className="bg-purple-100 text-purple-700 px-3 py-2 border-b flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  <span className="font-semibold text-sm">Applications IT (ce processus)</span>
                  <Badge variant="outline" className="ml-auto text-xs">{appsCritiques.length}</Badge>
                </div>
                <div className="p-2 space-y-2 max-h-64 overflow-y-auto">
                  {appsCritiques.map((app) => (
                    <div key={app.id} className="p-2 bg-purple-50/30 rounded-lg border border-purple-100/50">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-sm">{app.name}</p>
                        <div className="flex gap-1">
                          <Badge className="bg-red-50 text-red-700 text-xs">RTO: {app.rto_hours}h</Badge>
                          <Badge className="bg-orange-50 text-orange-700 text-xs">RPO: {app.rpo_hours}h</Badge>
                        </div>
                      </div>
                      {app.remplacablePar && (
                        <p className="text-xs text-muted-foreground">🔄 Remplaçable par : {app.remplacablePar}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {resourcesByType.HR.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-blue-100 text-blue-700 px-3 py-2 border-b flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="font-semibold text-sm">Ressources humaines</span>
                  <Badge variant="outline" className="ml-auto text-xs">{resourcesByType.HR.length}</Badge>
                </div>
                <div className="p-2 space-y-2 max-h-64 overflow-y-auto">
                  {resourcesByType.HR.map((r) => (
                    <div key={r.id} className="p-2 bg-blue-50/30 rounded-lg border border-blue-100/50">
                      <p className="font-medium text-sm">{r.name}</p>
                      <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground mt-1">
                        <span>👔 {(r as any).role || "—"}</span>
                        <span>📞 {(r as any).phone || "—"}</span>
                        <span className="col-span-2">✉️ {(r as any).email || "—"}</span>
                      </div>
                      {(r as any).availability && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {AVAILABILITY_PERIODS.map((period) => (
                            <Badge
                              key={period.id}
                              variant={(r as any).availability[period.id] ? "default" : "outline"}
                              className="text-[10px]"
                            >
                              {period.label}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {resourcesByType.Equipement.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-yellow-100 text-yellow-700 px-3 py-2 border-b flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  <span className="font-semibold text-sm">Équipements</span>
                  <Badge variant="outline" className="ml-auto text-xs">{resourcesByType.Equipement.length}</Badge>
                </div>
                <div className="p-2 space-y-2 max-h-64 overflow-y-auto">
                  {resourcesByType.Equipement.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-2 bg-yellow-50/30 rounded-lg border border-yellow-100/50">
                      <div>
                        <p className="font-medium text-sm">{r.name}</p>
                        <p className="text-xs text-muted-foreground">{r.quantity} unité(s)</p>
                      </div>
                      {r.substitutability && <Badge variant="outline" className="text-xs">🔄 {r.substitutability}</Badge>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {resourcesByType.Fournisseur.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-orange-100 text-orange-700 px-3 py-2 border-b flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  <span className="font-semibold text-sm">Fournisseurs</span>
                  <Badge variant="outline" className="ml-auto text-xs">{resourcesByType.Fournisseur.length}</Badge>
                </div>
                <div className="p-2 space-y-2 max-h-64 overflow-y-auto">
                  {resourcesByType.Fournisseur.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-2 bg-orange-50/30 rounded-lg border border-orange-100/50">
                      <div>
                        <p className="font-medium text-sm">{r.name}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-1">
                          {(r as any).rpo_hours && <Badge variant="outline" className="text-[10px]">RPO: {(r as any).rpo_hours}h</Badge>}
                          {r.substitutability && <span>🔄 {r.substitutability}</span>}
                        </div>
                      </div>
                      {r.substitutability && <Badge variant="outline" className="text-xs">🔄 {r.substitutability}</Badge>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {data.resources.length === 0 && appsCritiques.length === 0 && (
            <p className="text-sm text-muted-foreground italic text-center py-4">Aucune ressource ou application déclarée.</p>
          )}
        </CardContent>
      </Card>

      {data.dependsOn && data.dependsOn.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <span className="text-base">🔗</span> Dépendances ({data.dependsOn.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.dependsOn.map((depId, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  Dépendance {idx + 1}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          ↑ Revoir le formulaire
        </Button>
      </div>
    </div>
  );
};

// ============ COMPOSANT PRINCIPAL BiaWizard ============
export const BiaWizard = ({ processId, onDone }: { processId?: string; onDone: () => void }) => {
  const { processes, upsertProcess } = useBia();
  const { entities } = useGovernance();
  const initial = useMemo(() => {
    const found = processes.find((p) => p.id === processId);
    if (found) {
      return { ...found, impacts: getSafeImpacts(found.impacts), appsCritiques: (found as any).appsCritiques || [] };
    }
    return newProcess();
  }, [processId, processes]);
  
  const [step, setStep] = useState(0);
  const [data, setData] = useState<any>(initial);

  useEffect(() => {
    if (data.id) {
      localStorage.setItem("currentProcessId", data.id);
      localStorage.setItem("currentProcessName", data.name);
      const entity = entities.find(e => e.id === data.entityId);
      if (entity) {
        localStorage.setItem("currentEntitySector", entity.sector || "Général");
      }
    }
  }, [data.id, data.name, data.entityId, entities]);

  const update = (key: string, value: any) => {
    setData((d: any) => ({ ...d, [key]: value }));
  };
  const setImpact = (period: TimePeriod, axis: ImpactAxis, value: number) => {
    const newImpacts = { ...data.impacts, [period]: { ...data.impacts[period], [axis]: value } };
    update("impacts", newImpacts);
  };

  const globalScore = computeMaxScore(data.impacts);
  const criticality = scoreToCriticality(globalScore);
  const rtoExceedsMtpd = data.rto > data.mtpd;
  const requiresPca = globalScore >= 3;
  const scorePercentage = Math.round((globalScore / 5) * 100);
  const suggestedRTO = getSuggestedRTOFromImpacts(data.impacts);
  const suggestedRPO = getSuggestedRPOFromImpacts(data.impacts);

  const fillAllImpacts = (score: number) => {
    const newImpacts = emptyImpacts();
    for (const p of PERIODS) {
      for (const a of Object.keys(AXIS_LABELS) as ImpactAxis[]) {
        newImpacts[p.id][a] = score;
      }
    }
    update("impacts", newImpacts);
    toast({ title: "Impacts mis à jour", description: `Score ${score}/5 appliqué à toutes les périodes` });
  };

  const canNext = () => {
    if (step === 0) return data.name && data.entityId && data.owner;
    if (step === 2) return !rtoExceedsMtpd;
    return true;
  };

  const submit = async () => {
    const processToSave = {
      ...data,
      lastUpdated: new Date().toISOString().slice(0, 10),
      appsCritiques: data.appsCritiques || []
    };
    
    console.log("💾 Sauvegarde du processus:", processToSave.name);
    console.log("📱 Apps critiques:", processToSave.appsCritiques);
    
    await upsertProcess(processToSave);
    toast({ title: "BIA enregistré", description: `${data.name} — Criticité: ${criticality}` });
    onDone();
  };

  const applySuggestions = () => {
    update("rto", suggestedRTO);
    update("rpo", suggestedRPO);
    toast({ title: "Suggestions appliquées", description: `RTO: ${suggestedRTO}h, RPO: ${suggestedRPO}h` });
  };
  
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">{processId ? "Modifier l'analyse d'impact" : "Nouvelle analyse d'impact métier"}</h1>
          <p className="text-muted-foreground mt-2">Remplissez les étapes pour évaluer la criticité de votre processus</p>
        </div>
        <Button variant="outline" onClick={onDone}><ArrowLeft className="h-4 w-4 mr-2" />Retour</Button>
      </div>

      <div className="bg-secondary/20 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium">Progression</span><span className="text-sm text-muted-foreground">Étape {step + 1} / {STEPS.length}</span></div>
        <div className="flex gap-2">{STEPS.map((s, i) => (<button key={s.id} onClick={() => i <= step && setStep(i)} className={`flex-1 h-2 rounded-full transition-all ${i < step ? "bg-success" : i === step ? "bg-primary" : "bg-secondary"}`} title={s.label} />))}</div>
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">{STEPS.map((s, i) => (<span key={s.id} className={i === step ? "text-primary font-medium" : ""}>{s.icon} {s.label}</span>))}</div>
        {data.name && (
          <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Processus actuel</span>
            <span className="text-sm font-bold text-primary truncate max-w-[200px]">{data.name}</span>
          </div>
        )}
      </div>

      <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-4 border border-primary/20">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3"><div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center"><TrendingUp className="h-6 w-6 text-primary" /></div><div><p className="text-xs text-muted-foreground">Score de criticité</p><div className="flex items-baseline gap-2"><span className="text-3xl font-bold">{scorePercentage}%</span><Badge className={criticalityColor(criticality)}>{criticality}</Badge></div></div></div>
          {requiresPca && (<div className="flex items-center gap-2 text-warning"><ShieldAlert className="h-4 w-4" /><span className="text-sm">Nécessite un PCA dédié</span></div>)}
        </div>
        <div className="mt-3 h-2 bg-secondary rounded-full overflow-hidden"><div className="h-full bg-primary transition-all duration-300" style={{ width: `${scorePercentage}%` }} /></div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          {step === 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4"><div className="flex items-center gap-2"><div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center text-primary">1</div><h2 className="text-lg font-semibold">Informations générales</h2></div>{data.name && <Badge variant="outline" className="text-xs">📋 {data.name}</Badge>}</div>
              <div className="grid gap-4 md:grid-cols-2">
                <div><Label>Nom du processus *</Label><Input value={data.name} onChange={(e) => update("name", e.target.value)} placeholder="Ex: Traitement des commandes" /></div>
                <div><Label>Entité *</Label><Select value={data.entityId} onValueChange={(v) => update("entityId", v)}><SelectTrigger><SelectValue placeholder="Sélectionner une entité" /></SelectTrigger><SelectContent>{entities.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Responsable *</Label><Input value={data.owner} onChange={(e) => update("owner", e.target.value)} placeholder="Nom du responsable" /></div>
                <div className="md:col-span-2"><Label>Description</Label><Textarea value={data.description} onChange={(e) => update("description", e.target.value)} rows={3} placeholder="Décrivez le processus..." /></div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center text-primary">2</div>
                  <h2 className="text-lg font-semibold">Évaluation de l'impact métier</h2>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1">
                      <span className="text-base">📊</span> Voir la matrice d'impact
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogTitle className="text-lg font-semibold mb-2">Matrice d'évaluation des impacts</DialogTitle>
                    <StaticImpactMatrix />
                  </DialogContent>
                </Dialog>
              </div>
              <p className="text-sm text-muted-foreground">
                Évaluez l'impact (1 = négligeable, 5 = catastrophique) pour chaque axe et période d'indisponibilité.
              </p>

              <div className="flex flex-wrap gap-2">
                {[
                  { score: 1, label: "Mineur", color: "bg-green-500" },
                  { score: 2, label: "Modéré", color: "bg-yellow-500" },
                  { score: 3, label: "Majeur", color: "bg-orange-500" },
                  { score: 4, label: "Critique", color: "bg-red-500" },
                  { score: 5, label: "Extrême", color: "bg-red-700" }
                ].map((item) => (
                  <Button
                    key={item.score}
                    onClick={() => fillAllImpacts(item.score)}
                    className={`flex-1 ${item.color} text-white hover:opacity-90`}
                    variant="default"
                  >
                    Mode rapide {item.score} – {item.label}
                  </Button>
                ))}
              </div>

              <div className="bg-muted/30 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">
                  Score actuel : <strong className="text-primary">{globalScore}/5</strong> ({criticality})
                </p>
              </div>

              <div className="overflow-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-36">
                        Axe / Période
                        <Tooltip.Provider>
                          <Tooltip.Root>
                            <Tooltip.Trigger asChild>
                              <button className="ml-1 text-muted-foreground hover:text-foreground">ℹ️</button>
                            </Tooltip.Trigger>
                            <Tooltip.Portal>
                              <Tooltip.Content className="z-50 max-w-xs rounded-md bg-popover px-3 py-2 text-xs shadow-md border border-border">
                                Les scores 1 à 5 sont détaillés pour chaque axe (passez la souris sur ℹ️ à côté du nom).
                                <Tooltip.Arrow className="fill-border" />
                              </Tooltip.Content>
                            </Tooltip.Portal>
                          </Tooltip.Root>
                        </Tooltip.Provider>
                      </TableHead>
                      {PERIODS.map((p) => (
                        <TableHead key={p.id} className="text-center min-w-[70px]">
                          <div className="text-xs font-medium">{p.label}</div>
                          <div className="text-[10px] text-muted-foreground font-normal">
                            {p.hours <= 24 ? `${p.hours}h` : `${Math.round(p.hours/24)}j`}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(Object.keys(AXIS_LABELS) as ImpactAxis[]).map((axis) => (
                      <TableRow key={axis} className="hover:bg-muted/30">
                        <TableCell className="font-medium text-sm">
                          {AXIS_LABELS[axis]}
                          <ImpactTooltip axis={axis} />
                        </TableCell>
                        {PERIODS.map((p) => {
                          const currentValue = data.impacts[p.id]?.[axis] ?? 0;
                          let bgClass = "bg-gray-50 border-gray-200";
                          if (currentValue >= 5) bgClass = "bg-red-700 border-red-800 text-white font-bold";
                          else if (currentValue >= 4) bgClass = "bg-red-500 border-red-600 text-white";
                          else if (currentValue >= 3) bgClass = "bg-orange-500 border-orange-600 text-white";
                          else if (currentValue >= 2) bgClass = "bg-yellow-500 border-yellow-600";
                          else if (currentValue >= 1) bgClass = "bg-green-500 border-green-600 text-white";
                          return (
                            <TableCell key={p.id} className="text-center p-1">
                              <Select value={String(currentValue)} onValueChange={(v) => setImpact(p.id, axis, Number(v))}>
                                <SelectTrigger className={cn("h-10 w-14 mx-auto transition-all font-bold", bgClass)}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="0">0 - Aucun</SelectItem>
                                  <SelectItem value="1">1 - Négligeable</SelectItem>
                                  <SelectItem value="2">2 - Mineur</SelectItem>
                                  <SelectItem value="3">3 - Modéré</SelectItem>
                                  <SelectItem value="4">4 - Majeur</SelectItem>
                                  <SelectItem value="5">5 - Catastrophique</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center text-primary">3</div>
                  <h2 className="text-lg font-semibold">Délais de reprise &amp; RTO/RPO</h2>
                </div>
                {data.name && <Badge variant="outline">⏱️ {data.name}</Badge>}
              </div>
              <div className="bg-muted/30 rounded-lg p-4 border border-border">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-sm font-medium">RTO / RPO suggérés</p>
                    <p className="text-xs text-muted-foreground">Basés sur la première période d'impact significatif</p>
                    <div className="flex gap-4 mt-2">
                      <div className="bg-background rounded-lg px-3 py-1"><span className="text-xs text-muted-foreground">RTO suggéré</span><p className="text-xl font-bold text-primary">{suggestedRTO} heures</p></div>
                      <div className="bg-background rounded-lg px-3 py-1"><span className="text-xs text-muted-foreground">RPO suggéré</span><p className="text-xl font-bold text-primary">{suggestedRPO} heure{suggestedRPO > 1 ? 's' : ''}</p></div>
                    </div>
                  </div>
                  <Button onClick={applySuggestions} variant="outline" size="sm">Appliquer les suggestions</Button>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div><Label>RTO — Recovery Time Objective (heures)</Label><Input type="number" min={0} value={data.rto} onChange={(e) => update("rto", Number(e.target.value))} /><p className="text-xs text-muted-foreground mt-1">Délai maximal de reprise visé.</p></div>
                <div><Label>RPO — Recovery Point Objective (heures)</Label><Input type="number" min={0} value={data.rpo} onChange={(e) => update("rpo", Number(e.target.value))} /><p className="text-xs text-muted-foreground mt-1">Perte de données maximale acceptée.</p></div>
                <div><Label>MTPD — Maximum Tolerable Period of Disruption (heures)</Label><Input type="number" min={0} value={data.mtpd} onChange={(e) => update("mtpd", Number(e.target.value))} /></div>
              </div>
              {rtoExceedsMtpd && (<div className="text-destructive text-sm">Erreur : le RTO ({data.rto}h) ne peut pas être supérieur au MTPD ({data.mtpd}h)</div>)}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center text-primary">4</div>
                  <h2 className="text-lg font-semibold">Ressources critiques</h2>
                </div>
                {data.name && <Badge variant="outline">🛠️ {data.name}</Badge>}
              </div>
              <ResourcesEditor 
                resources={data.resources} 
                onChange={(r) => update("resources", r)} 
                appsCritiques={data.appsCritiques || []}
                onAppsChange={(apps) => update("appsCritiques", apps)}
                allProcesses={processes}
                departmentId={data.entityId}
                processName={data.name}
                currentStep={step}
              />
            </div>
          )}

          {step === 4 && (
            <SummaryView 
              data={data} 
              entityName={entities.find(e => e.id === data.entityId)?.name ?? "—"} 
              criticality={criticality} 
              score={globalScore}
              appsCritiques={data.appsCritiques || []}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep(s => s - 1)}><ArrowLeft className="h-4 w-4 mr-2" />Précédent</Button>
        {step < STEPS.length - 1 ? <Button onClick={() => setStep(s => s + 1)} disabled={!canNext()}>Suivant <ArrowRight className="h-4 w-4 ml-2" /></Button> : <Button onClick={submit} className="bg-success hover:bg-success/90"><Check className="h-4 w-4 mr-2" />Enregistrer le BIA</Button>}
      </div>

      {/* Assistant vocal avec mode guidé */}
      {step < 4 && (
        <VoiceMic
          onNameChange={(name) => update("name", name)}
          onOwnerChange={(owner) => update("owner", owner)}
          onEntityChange={(entity) => {
            const found = entities.find(e => e.name === entity || e.id === entity);
            if (found) update("entityId", found.id);
            else toast({ title: "Entité non trouvée", description: `"${entity}" n'existe pas dans la liste`, variant: "destructive" });
          }}
          onDescriptionChange={(desc) => update("description", desc)}
          onRTOChange={(rto) => update("rto", rto)}
          onRPOChange={(rpo) => update("rpo", rpo)}
          onImpactFill={(score) => fillAllImpacts(score)}
          onNextStep={() => {
            if (step < STEPS.length - 1) setStep(step + 1);
          }}
          onAddResource={(resource) => {
            const newResource = {
              id: `r_${Date.now()}`,
              type: "HR",
              name: resource.name,
              quantity: 1,
              hrPeople: [{
                id: `p_${Date.now()}`,
                name: resource.name,
                role: resource.role,
                phone: "",
                email: "",
                selected: true,
                availability: { P0_4H: false, P4_8H: false, P1D: false, P2D: false, P1W: false, P2W: false, P1M: false }
              }]
            };
            update("resources", [...data.resources, newResource]);
            toast({ title: "Ressource ajoutée", description: `${resource.name} (${resource.role})` });
          }}
          currentStep={step}
        />
      )}
    </div>
  );
};