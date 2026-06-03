import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, ArrowRight, Check, AlertTriangle, Plus, Trash2, ShieldAlert, TrendingUp, Server } from "lucide-react";
import { useBia } from "@/contexts/BiaContext";
import { useGovernance } from "@/contexts/GovernanceContext";
import {
  PERIODS, AXIS_LABELS, RESOURCE_LABELS, emptyImpacts, computeMaxScore, periodMaxScore,
  scoreToCriticality, criticalityColor, scoreCellColor,
  type Process, type ImpactAxis, type TimePeriod, type Resource, type ResourceType,
} from "@/data/bia";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";

// ==================== DESCRIPTIONS DES SCORES POUR CHAQUE AXE ====================
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

// ==================== MATRICE D'IMPACT STATIQUE (dans une modale) ====================
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

// ==================== COMPOSANT TOOLTIP ====================
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

// ==================== TYPE POUR LES APPLICATIONS IT CRITIQUES ====================
type AppCritique = {
  id: string;
  name: string;
  rto_hours: number;
  rpo_hours: number;
  remplacablePar: string;
};

// Configuration des étapes
const STEPS = [
  { id: "general", label: "Général", icon: "📋" },
  { id: "impact", label: "Impact métier", icon: "🎯" },
  { id: "rto", label: "Délais & RTO/RPO", icon: "⏱️" },
  { id: "resources", label: "Ressources", icon: "🛠️" },
  { id: "validation", label: "Validation", icon: "✅" }
];

// ========== FONCTIONS DE SUGGESTION CORRIGÉES (période la plus courte) ==========
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
  appsCritiques: [] as any, // Correction temporaire : attendre l'ajout dans le type Process
  lastUpdated: new Date().toISOString().slice(0, 10),
});

// ==================== COMPOSANT RESSOURCES CRITIQUES ====================
const ResourcesEditor = ({ resources, onChange, appsCritiques, onAppsChange }: { 
  resources: Resource[]; 
  onChange: (r: Resource[]) => void;
  appsCritiques: AppCritique[];
  onAppsChange: (apps: AppCritique[]) => void;
}) => {
  const [newResource, setNewResource] = useState<any>({
    type: "HR",
    name: "",
    quantity: 1,
    substitutability: "",
  });
  const [activeCategory, setActiveCategory] = useState<ResourceType | "APPS">("HR");

  const availabilityPeriods = [
    { id: "P0_4H", label: "0-4h", hours: 4 },
    { id: "P4_8H", label: "4-8h", hours: 8 },
    { id: "P1D", label: "1j", hours: 24 },
    { id: "P2D", label: "2j", hours: 48 },
    { id: "P1W", label: "1sem", hours: 168 },
    { id: "P2W", label: "2sem", hours: 336 },
    { id: "P1M", label: "1mois", hours: 720 },
  ];

  const [hrPeople, setHrPeople] = useState<{ 
    id: string; 
    name: string; 
    role: string; 
    phone: string;
    email: string;
    selected: boolean;
    availability: Record<string, boolean>;
  }[]>([
    { 
      id: `p_${Date.now()}`, 
      name: "", 
      role: "", 
      phone: "",
      email: "",
      selected: false,
      availability: {
        P0_4H: false, P4_8H: false, P1D: false, P2D: false, P1W: false, P2W: false, P1M: false
      }
    }
  ]);

  const [newApp, setNewApp] = useState<Omit<AppCritique, "id">>({
    name: "",
    rto_hours: 4,
    rpo_hours: 1,
    remplacablePar: "",
  });
  const [showAppForm, setShowAppForm] = useState(false);

  const addApp = () => {
    if (!newApp.name.trim()) {
      toast({ title: "Champ requis", description: "Veuillez saisir un nom d'application" });
      return;
    }
    onAppsChange([...appsCritiques, { ...newApp, id: `app_${Date.now()}` }]);
    setNewApp({ name: "", rto_hours: 4, rpo_hours: 1, remplacablePar: "" });
    setShowAppForm(false);
  };

  const removeApp = (id: string) => onAppsChange(appsCritiques.filter(a => a.id !== id));

  const categories: { type: ResourceType | "APPS"; label: string; icon: string; color: string }[] = [
    { type: "HR", label: "Ressources humaines", icon: "👥", color: "bg-blue-100 text-blue-700 border-blue-200" },
    { type: "APPS", label: "Applications IT", icon: "💻", color: "bg-purple-100 text-purple-700 border-purple-200" },
    { type: "Locaux", label: "Locaux", icon: "🏢", color: "bg-green-100 text-green-700 border-green-200" },
    { type: "Equipement", label: "Équipements", icon: "🖨️", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
    { type: "Fournisseur", label: "Fournisseurs", icon: "🤝", color: "bg-orange-100 text-orange-700 border-orange-200" },
  ];

  const addResource = () => {
    if (activeCategory === "HR") {
      const selectedPeople = hrPeople.filter(p => p.selected && p.name.trim());
      if (selectedPeople.length === 0) {
        toast({ title: "Aucune personne sélectionnée", description: "Veuillez cocher au moins une personne" });
        return;
      }
      onChange([...resources, { 
        ...newResource, 
        id: `r_${Date.now()}`,
        type: "HR",
        hrPeople: selectedPeople
      } as any]);
      setHrPeople([{ 
        id: `p_${Date.now()}`, 
        name: "", 
        role: "", 
        phone: "",
        email: "",
        selected: false,
        availability: { P0_4H: false, P4_8H: false, P1D: false, P2D: false, P1W: false, P2W: false, P1M: false }
      }]);
    } else if (activeCategory !== "APPS") {
      if (!newResource.name.trim()) {
        toast({ title: "Champ requis", description: "Veuillez saisir un nom" });
        return;
      }
      onChange([...resources, { 
        ...newResource, 
        id: `r_${Date.now()}`,
        type: activeCategory as ResourceType
      }]);
      setNewResource({ type: activeCategory as ResourceType, name: "", quantity: 1, substitutability: "" });
    }
  };

  const removeResource = (id: string) => onChange(resources.filter(r => r.id !== id));

  const getResourcesByCategory = (type: ResourceType) => resources.filter(r => r.type === type);

  const addHrRow = () => {
    setHrPeople([...hrPeople, { 
      id: `p_${Date.now()}`, 
      name: "", 
      role: "", 
      phone: "",
      email: "",
      selected: false,
      availability: { P0_4H: false, P4_8H: false, P1D: false, P2D: false, P1W: false, P2W: false, P1M: false }
    }]);
  };

  const removeHrRow = (index: number) => {
    if (hrPeople.length === 1) {
      toast({ title: "Impossible", description: "Gardez au moins une ligne" });
      return;
    }
    setHrPeople(hrPeople.filter((_, i) => i !== index));
  };

  const updateHrRow = (index: number, field: string, value: any) => {
    const updated = [...hrPeople];
    updated[index] = { ...updated[index], [field]: value };
    setHrPeople(updated);
  };

  const updateAvailability = (personIndex: number, periodId: string, checked: boolean) => {
    const updated = [...hrPeople];
    updated[personIndex].availability[periodId] = checked;
    setHrPeople(updated);
  };

  const toggleSelectAll = () => {
    const allSelected = hrPeople.length > 0 && hrPeople.every(p => p.selected);
    setHrPeople(hrPeople.map(p => ({ ...p, selected: !allSelected })));
  };

  const hasAvailability = (person: any) => {
    return Object.values(person.availability).some(v => v === true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="font-semibold">Ressources critiques</Label>
          <p className="text-xs text-muted-foreground">Éléments nécessaires au fonctionnement du processus</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {categories.map((cat) => {
          let count = 0;
          if (cat.type === "APPS") {
            count = appsCritiques.length;
          } else {
            count = getResourcesByCategory(cat.type as ResourceType).length;
          }
          return (
            <button
              key={cat.type}
              onClick={() => setActiveCategory(cat.type)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${
                activeCategory === cat.type
                  ? `${cat.color} ring-2 ring-offset-1 ring-primary/30`
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              {count > 0 && (
                <Badge variant="secondary" className="text-xs h-5 w-5 p-0 flex items-center justify-center rounded-full">
                  {count}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      <div className="bg-muted/20 rounded-lg p-4">
        {activeCategory === "HR" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">📋 Personnel / Équipe de crise</Label>
              <Button onClick={addHrRow} variant="outline" size="sm" className="gap-1">
                <Plus className="h-3 w-3" />
                Ajouter une personne
              </Button>
            </div>
            
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-10 text-center">
                      <input type="checkbox" checked={hrPeople.length > 0 && hrPeople.every(p => p.selected)} onChange={toggleSelectAll} className="h-4 w-4 rounded" />
                    </TableHead>
                    <TableHead className="min-w-[120px]">Nom complet</TableHead>
                    <TableHead className="min-w-[120px]">Rôle</TableHead>
                    <TableHead className="min-w-[100px]">Téléphone</TableHead>
                    <TableHead className="min-w-[120px]">Email</TableHead>
                    {availabilityPeriods.map((period) => (<TableHead key={period.id} className="text-center min-w-[45px] text-[10px]">{period.label}</TableHead>))}
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hrPeople.map((person, idx) => (
                    <TableRow key={person.id} className={person.selected ? "bg-primary/5" : ""}>
                      <TableCell className="text-center">
                        <input type="checkbox" checked={person.selected} onChange={(e) => updateHrRow(idx, "selected", e.target.checked)} className="h-4 w-4 rounded" />
                      </TableCell>
                      <TableCell><Input value={person.name} onChange={(e) => updateHrRow(idx, "name", e.target.value)} placeholder="Jean Dupont" className="h-8 text-sm" /></TableCell>
                      <TableCell><Input value={person.role} onChange={(e) => updateHrRow(idx, "role", e.target.value)} placeholder="Responsable" className="h-8 text-sm" /></TableCell>
                      <TableCell><Input value={person.phone} onChange={(e) => updateHrRow(idx, "phone", e.target.value)} placeholder="+33 6 12 34 56 78" className="h-8 text-sm" type="tel" /></TableCell>
                      <TableCell><Input value={person.email} onChange={(e) => updateHrRow(idx, "email", e.target.value)} placeholder="nom@email.com" className="h-8 text-sm" type="email" /></TableCell>
                      {availabilityPeriods.map((period) => (
                        <TableCell key={period.id} className="text-center">
                          <input type="checkbox" checked={person.availability[period.id]} onChange={(e) => updateAvailability(idx, period.id, e.target.checked)} className="h-4 w-4 rounded" />
                        </TableCell>
                      ))}
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeHrRow(idx)} disabled={hrPeople.length === 1}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            {hrPeople.some(p => p.name.trim() && !hasAvailability(p)) && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-xs text-yellow-700">
                ⚠️ Certaines personnes n'ont aucune période de disponibilité cochée
              </div>
            )}
            
            <div className="flex justify-end pt-2">
              <Button onClick={addResource} size="sm" className="gap-1 bg-primary">
                <Plus className="h-3 w-3" />
                Enregistrer l'équipe sélectionnée
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              💡 Cochez les personnes et leurs périodes de disponibilité
            </p>
          </div>
        )}

        {activeCategory === "APPS" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">💻 Applications IT critiques</Label>
              <Button variant="outline" size="sm" onClick={() => setShowAppForm(!showAppForm)}>
                <Plus className="h-3 w-3 mr-1" />
                Ajouter une application
              </Button>
            </div>

            {showAppForm && (
              <div className="mb-4 p-3 bg-muted/30 rounded-lg">
                <div className="grid grid-cols-4 gap-3">
                  <div className="col-span-1">
                    <Label className="text-xs">Nom de l'application</Label>
                    <Input value={newApp.name} onChange={(e) => setNewApp({ ...newApp, name: e.target.value })} placeholder="Ex: SWIFT, SAP..." className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs">RTO (heures)</Label>
                    <Input type="number" value={newApp.rto_hours} onChange={(e) => setNewApp({ ...newApp, rto_hours: Number(e.target.value) })} className="h-8 text-sm" min={0} step={0.5} />
                  </div>
                  <div>
                    <Label className="text-xs">RPO (heures)</Label>
                    <Input type="number" value={newApp.rpo_hours} onChange={(e) => setNewApp({ ...newApp, rpo_hours: Number(e.target.value) })} className="h-8 text-sm" min={0} step={0.5} />
                  </div>
                  <div>
                    <Label className="text-xs">Remplaçable par</Label>
                    <Input value={newApp.remplacablePar} onChange={(e) => setNewApp({ ...newApp, remplacablePar: e.target.value })} placeholder="Ex: Application X, solution manuelle..." className="h-8 text-sm" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-3">
                  <Button variant="ghost" size="sm" onClick={() => setShowAppForm(false)}>Annuler</Button>
                  <Button size="sm" onClick={addApp}>Ajouter</Button>
                </div>
              </div>
            )}

            {appsCritiques.length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center py-4">Aucune application critique. Cliquez sur "Ajouter" pour en ajouter.</p>
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
                      <TableCell className="font-medium">{app.name}</TableCell>
                      <TableCell className="text-center"><Badge className="bg-red-50 text-red-700">{app.rto_hours}h</Badge></TableCell>
                      <TableCell className="text-center"><Badge className="bg-orange-50 text-orange-700">{app.rpo_hours}h</Badge></TableCell>
                      <TableCell>{app.remplacablePar || "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeApp(app.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}

        {activeCategory === "Locaux" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><Label className="text-xs">Nom du local</Label><Input value={newResource.name} onChange={(e) => setNewResource({ ...newResource, name: e.target.value, type: "Locaux" })} placeholder="Ex: Bâtiment A, Salle serveur..." className="h-9 text-sm" /></div>
            <div><Label className="text-xs">Quantité</Label><Input type="number" min={1} value={newResource.quantity} onChange={(e) => setNewResource({ ...newResource, quantity: Number(e.target.value), type: "Locaux" })} className="h-9 text-sm" /></div>
            <div><Label className="text-xs">Remplaçable par</Label><Input value={newResource.substitutability} onChange={(e) => setNewResource({ ...newResource, substitutability: e.target.value, type: "Locaux" })} placeholder="Ex: Site de secours..." className="h-9 text-sm" /></div>
          </div>
        )}
        
        {activeCategory === "Equipement" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><Label className="text-xs">Nom de l'équipement</Label><Input value={newResource.name} onChange={(e) => setNewResource({ ...newResource, name: e.target.value, type: "Equipement" })} placeholder="Ex: Scanner, Imprimante 3D..." className="h-9 text-sm" /></div>
            <div><Label className="text-xs">Quantité</Label><Input type="number" min={1} value={newResource.quantity} onChange={(e) => setNewResource({ ...newResource, quantity: Number(e.target.value), type: "Equipement" })} className="h-9 text-sm" /></div>
            <div><Label className="text-xs">Remplaçable par</Label><Input value={newResource.substitutability} onChange={(e) => setNewResource({ ...newResource, substitutability: e.target.value, type: "Equipement" })} placeholder="Ex: Équipement de secours..." className="h-9 text-sm" /></div>
          </div>
        )}

        {activeCategory === "Fournisseur" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><Label className="text-xs">Nom du fournisseur</Label><Input value={newResource.name} onChange={(e) => setNewResource({ ...newResource, name: e.target.value, type: "Fournisseur" })} placeholder="Ex: AWS, OVH, Salesforce..." className="h-9 text-sm" /></div>
            <div><Label className="text-xs">Quantité</Label><Input type="number" min={1} value={newResource.quantity} onChange={(e) => setNewResource({ ...newResource, quantity: Number(e.target.value), type: "Fournisseur" })} className="h-9 text-sm" /></div>
            <div><Label className="text-xs">Remplaçable par</Label><Input value={newResource.substitutability} onChange={(e) => setNewResource({ ...newResource, substitutability: e.target.value, type: "Fournisseur" })} placeholder="Ex: Fournisseur alternatif..." className="h-9 text-sm" /></div>
          </div>
        )}
        
        {(activeCategory === "Locaux" || activeCategory === "Equipement" || activeCategory === "Fournisseur") && (
          <div className="flex justify-end mt-3">
            <Button onClick={addResource} size="sm" className="gap-1">
              <Plus className="h-3 w-3" />
              Ajouter
            </Button>
          </div>
        )}
      </div>

      {/* Affichage des ressources par catégorie */}
      <div className="space-y-4">
        {categories.map((cat) => {
          let categoryResources = [];
          let isApps = cat.type === "APPS";
          
          if (isApps) {
            if (appsCritiques.length === 0) return null;
            categoryResources = appsCritiques;
          } else {
            categoryResources = getResourcesByCategory(cat.type as ResourceType);
            if (categoryResources.length === 0) return null;
          }
          
          return (
            <div key={cat.type} className="border rounded-lg overflow-hidden">
              <div className={`px-3 py-2 ${cat.color} border-b flex items-center gap-2`}>
                <span>{cat.icon}</span>
                <span className="font-semibold text-sm">{cat.label}</span>
                <Badge variant="outline" className="ml-auto text-xs">{categoryResources.length} ressource(s)</Badge>
              </div>
              <div className="p-2">
                {categoryResources.map((r) => (
                  <div key={(r as any).id} className="p-2 hover:bg-muted/20 rounded-lg transition-colors">
                    {cat.type === "HR" && (r as any).hrPeople ? (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">✓ Personnel sélectionné ({ (r as any).hrPeople.length })</span>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeResource((r as any).id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                        <div className="overflow-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Nom</TableHead>
                                <TableHead>Rôle</TableHead>
                                <TableHead>Téléphone</TableHead>
                                <TableHead>Email</TableHead>
                                {availabilityPeriods.map((period) => (<TableHead key={period.id} className="text-center text-[10px]">{period.label}</TableHead>))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(r as any).hrPeople.map((person: any) => (
                                <TableRow key={person.id} className="bg-green-50/30">
                                  <TableCell className="py-1 font-medium text-sm">{person.name || "—"}</TableCell>
                                  <TableCell className="py-1 text-sm">{person.role || "—"}</TableCell>
                                  <TableCell className="py-1 text-sm">{person.phone || "—"}</TableCell>
                                  <TableCell className="py-1 text-sm">{person.email || "—"}</TableCell>
                                  {availabilityPeriods.map((period) => (
                                    <TableCell key={period.id} className="text-center py-1">
                                      {person.availability?.[period.id] ? <span className="text-green-600">✓</span> : <span className="text-gray-300">—</span>}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ) : cat.type === "APPS" ? (
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <span className="font-medium text-sm">{(r as AppCritique).name}</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            <Badge className="bg-red-50 text-red-700 text-xs">RTO: {(r as AppCritique).rto_hours}h</Badge>
                            <Badge className="bg-orange-50 text-orange-700 text-xs">RPO: {(r as AppCritique).rpo_hours}h</Badge>
                            {(r as AppCritique).remplacablePar && <Badge className="bg-blue-50 text-blue-700 text-xs">🔄 {(r as AppCritique).remplacablePar}</Badge>}
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeApp((r as AppCritique).id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <span className="font-medium text-sm">{(r as Resource).name}</span>
                          <div className="flex gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">{(r as Resource).quantity} unité{(r as Resource).quantity > 1 ? 's' : ''}</Badge>
                            {(r as Resource).substitutability && <Badge className="bg-blue-50 text-blue-700 text-xs">🔄 {(r as Resource).substitutability}</Badge>}
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeResource((r as Resource).id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {resources.length === 0 && appsCritiques.length === 0 && (
        <div className="text-center py-6 text-muted-foreground border border-dashed rounded-lg">
          <p className="text-sm">Aucune ressource ajoutée</p>
          <p className="text-xs">Utilisez les formulaires ci-dessus pour ajouter des ressources</p>
        </div>
      )}
    </div>
  );
};

// ==================== SUMMARY VIEW (SANS DÉPARTEMENT) ====================
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
    Locaux: data.resources.filter(r => r.type === "Locaux"),
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
            {/* Ligne Département supprimée */}
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
            {resourcesByType.HR.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-blue-100 text-blue-700 px-3 py-2 border-b flex items-center gap-2">
                  <span>👥</span>
                  <span className="font-semibold text-sm">Ressources humaines</span>
                  <Badge variant="outline" className="ml-auto text-xs">{resourcesByType.HR.length}</Badge>
                </div>
                <div className="p-2 space-y-2 max-h-64 overflow-y-auto">
                  {resourcesByType.HR.map((r) => (
                    (r as any).hrPeople ? (
                      (r as any).hrPeople.map((person: any) => (
                        <div key={person.id} className="p-2 bg-muted/20 rounded-lg">
                          <p className="font-medium text-sm">{person.name || "—"}</p>
                          <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground mt-1">
                            <span>👔 {person.role || "—"}</span>
                            <span>📞 {person.phone || "—"}</span>
                            <span className="col-span-2">✉️ {person.email || "—"}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div key={r.id} className="p-2 bg-muted/20 rounded-lg">
                        <p className="font-medium text-sm">{r.name}</p>
                        <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{r.quantity} unité(s)</span>
                          {r.substitutability && <span>🔄 {r.substitutability}</span>}
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}

            {resourcesByType.Locaux.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-green-100 text-green-700 px-3 py-2 border-b flex items-center gap-2">
                  <span>🏢</span>
                  <span className="font-semibold text-sm">Locaux</span>
                  <Badge variant="outline" className="ml-auto text-xs">{resourcesByType.Locaux.length}</Badge>
                </div>
                <div className="p-2 space-y-2 max-h-64 overflow-y-auto">
                  {resourcesByType.Locaux.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-2 bg-muted/20 rounded-lg">
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

            {resourcesByType.Equipement.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-yellow-100 text-yellow-700 px-3 py-2 border-b flex items-center gap-2">
                  <span>🖨️</span>
                  <span className="font-semibold text-sm">Équipements</span>
                  <Badge variant="outline" className="ml-auto text-xs">{resourcesByType.Equipement.length}</Badge>
                </div>
                <div className="p-2 space-y-2 max-h-64 overflow-y-auto">
                  {resourcesByType.Equipement.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-2 bg-muted/20 rounded-lg">
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
                  <span>🤝</span>
                  <span className="font-semibold text-sm">Fournisseurs</span>
                  <Badge variant="outline" className="ml-auto text-xs">{resourcesByType.Fournisseur.length}</Badge>
                </div>
                <div className="p-2 space-y-2 max-h-64 overflow-y-auto">
                  {resourcesByType.Fournisseur.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-2 bg-muted/20 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{r.name}</p>
                        <p className="text-xs text-muted-foreground">{r.quantity} fournisseur(s)</p>
                      </div>
                      {r.substitutability && <Badge variant="outline" className="text-xs">🔄 {r.substitutability}</Badge>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {appsCritiques && appsCritiques.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-purple-100 text-purple-700 px-3 py-2 border-b flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  <span className="font-semibold text-sm">Applications IT</span>
                  <Badge variant="outline" className="ml-auto text-xs">{appsCritiques.length}</Badge>
                </div>
                <div className="p-2 space-y-2 max-h-64 overflow-y-auto">
                  {appsCritiques.map((app) => (
                    <div key={app.id} className="p-2 bg-muted/20 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-sm">{app.name}</p>
                        <Badge variant="outline" className="text-xs bg-red-50 text-red-700">
                          RTO: {app.rto_hours}h
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm mt-1">
                        <div>
                          <p className="text-xs text-muted-foreground">RPO</p>
                          <p className="text-sm font-medium">{app.rpo_hours} heures</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Remplaçable par</p>
                          <p className="text-sm truncate">{app.remplacablePar || "—"}</p>
                        </div>
                      </div>
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

// ==================== BIA WIZARD (SANS DÉPARTEMENT) AVEC AJOUT POUR CHATBOT ====================
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

  // ========== AJOUT POUR LE CHATBOT (stocke le processus en cours) ==========
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
  // ========== FIN AJOUT ==========

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
    await upsertProcess({ ...data, lastUpdated: new Date().toISOString().slice(0, 10) });
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
          {data.name && (<div className="mt-2 flex items-center gap-2 bg-primary/10 rounded-lg px-4 py-2 border border-primary/20"><div className="h-3 w-3 rounded-full bg-primary animate-pulse" /><p className="text-sm">Processus en cours : <span className="font-bold text-primary">{data.name}</span></p></div>)}
          <p className="text-muted-foreground mt-2">Remplissez les étapes pour évaluer la criticité de votre processus</p>
        </div>
        <Button variant="outline" onClick={onDone}><ArrowLeft className="h-4 w-4 mr-2" />Retour</Button>
      </div>

      <div className="bg-secondary/20 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium">Progression</span><span className="text-sm text-muted-foreground">Étape {step + 1} / {STEPS.length}</span></div>
        <div className="flex gap-2">{STEPS.map((s, i) => (<button key={s.id} onClick={() => i <= step && setStep(i)} className={`flex-1 h-2 rounded-full transition-all ${i < step ? "bg-success" : i === step ? "bg-primary" : "bg-secondary"}`} title={s.label} />))}</div>
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">{STEPS.map((s, i) => (<span key={s.id} className={i === step ? "text-primary font-medium" : ""}>{s.icon} {s.label}</span>))}</div>
        {data.name && (<div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between"><span className="text-xs text-muted-foreground">Processus actuel</span><span className="text-xs font-medium text-primary truncate max-w-[200px]">{data.name}</span></div>)}
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
                {/* Champ Département supprimé */}
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

              {/* 5 boutons Mode rapide avec libellés */}
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

              {/* Matrice complète toujours affichée */}
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
    </div>
  );
};