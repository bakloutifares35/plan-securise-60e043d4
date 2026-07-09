import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  ArrowLeft, ArrowRight, Check, ShieldAlert, TrendingUp, Building2, 
  ChevronDown, AlertCircle, Info, X, Loader2
} from "lucide-react";
import { useBia } from "@/contexts/BiaContext";
import { useGovernance } from "@/contexts/GovernanceContext";
import {
  PERIODS, AXIS_LABELS, emptyImpacts, computeMaxScore,
  scoreToCriticality, criticalityColor,
  type Process, type ImpactAxis, type TimePeriod,
} from "@/data/bia";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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

// Ordre des périodes pour la cascade (du plus court au plus long)
const TIME_PERIODS_ORDERED = ["P0_4H", "P4_8H", "P1D", "P2D", "P1W", "P2W", "P1M"];

// ==================== STYLES PASTEL POUR LES SCORES ====================
const SEVERITY_PASTEL_STYLES: Record<number, { bg: string; text: string; border: string; label: string }> = {
  0: { bg: "#F5F5F5", text: "#9E9E9E", border: "#E0E0E0", label: "Aucun" },
  1: { bg: "#E8F5E9", text: "#2E7D32", border: "#A5D6A7", label: "Mineur" },
  2: { bg: "#FFF8E1", text: "#F57F17", border: "#FFE082", label: "Modéré" },
  3: { bg: "#FFF3E0", text: "#E65100", border: "#FFCC80", label: "Majeur" },
  4: { bg: "#FBE9E7", text: "#D84315", border: "#FFAB91", label: "Sévère" },
  5: { bg: "#FFEBEE", text: "#C62828", border: "#EF9A9A", label: "Très sévère" },
};

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

// ==================== COMPOSANT MATRICE STATIQUE ====================
const StaticImpactMatrix = () => {
  const severityLevels = [
    { label: "Très sévère", color: "bg-red-800 text-white", border: "border-red-900" },
    { label: "Sévère", color: "bg-red-600 text-white", border: "border-red-700" },
    { label: "Majeur", color: "bg-orange-500 text-white", border: "border-orange-600" },
    { label: "Modéré", color: "bg-yellow-500 text-black", border: "border-yellow-600" },
    { label: "Mineur", color: "bg-green-600 text-white", border: "border-green-700" },
  ];

  const rows = [
    {
      category: "💰 Impact financier",
      descriptions: [
        "Perte financière significative pouvant mener à un résultat négatif.",
        "Perte financière élevée, remarquable dans les résultats.",
        "Perte financière tolérable.",
        "Perte financière marginale.",
        "Aucune perte financière.",
      ],
    },
    {
      category: "⚖️ Conformité / Légal",
      descriptions: [
        "Plainte administrative menant à une perte de licence.",
        "Violations légales / plaintes entraînant des amendes significatives et possiblement des peines de prison.",
        "Violations légales / plaintes entraînant des demandes de dommages ou amendes.",
        "Violations légales / plaintes sans amendes significatives.",
        "Aucun dommage légal.",
      ],
    },
    {
      category: "⚙️ Impact opérationnel",
      descriptions: [
        "Interruption sévère des processus métier.",
        "Interruption significative des processus métier.",
        "Dégradation acceptable de l'efficacité opérationnelle.",
        "Impact marginal sur les processus métier.",
        "Aucun impact significatif sur les processus.",
      ],
    },
    {
      category: "📢 Impact réputationnel",
      descriptions: [
        "Impact réputationnel sévère. Confiance des clients/partenaires irrémédiablement endommagée.",
        "Impact réputationnel significatif. Couverture médiatique nationale.",
        "Impact réputationnel tolérable. Petit article local.",
        "Impact réputationnel marginal, sans couverture médiatique.",
        "Aucun impact réputationnel.",
      ],
    },
  ];

  return (
    <div className="border rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/50">
              <th className="border p-2 text-left font-semibold">Évaluation d'impact métier</th>
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
        Mineur (0-0,075%) | Modéré (0,076-0,30%) | Majeur (0,31-1,20%) | Sévère (1,21-4,80%) | Très sévère (4,81%+)
      </div>
    </div>
  );
};

// ==================== TOOLTIP D'IMPACT ====================
const ImpactTooltip = ({ axis }: { axis: ImpactAxis }) => {
  const descriptions = impactDescriptions[axis];
  return (
    <Tooltip.Provider>
      <Tooltip.Root delayDuration={200}>
        <Tooltip.Trigger asChild>
          <button className="ml-1 text-muted-foreground hover:text-foreground cursor-help focus:outline-none">
            <Info className="h-3.5 w-3.5" />
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

// ==================== COMPOSANT CELLULE D'IMPACT AVEC POPOVER ====================
const ImpactCell = ({
  value,
  axis,
  periodId,
  onValueChange,
}: {
  value: number;
  axis: ImpactAxis;
  periodId: string;
  onValueChange: (axis: ImpactAxis, periodId: string, value: number) => void;
}) => {
  const [open, setOpen] = useState(false);
  const style = SEVERITY_PASTEL_STYLES[value] || SEVERITY_PASTEL_STYLES[0];

  const handleSelect = (val: number) => {
    onValueChange(axis, periodId, val);
    setOpen(false);
  };

  const options = [
    { score: 1, label: "Mineur", bg: "#E8F5E9", text: "#2E7D32", border: "#A5D6A7" },
    { score: 2, label: "Modéré", bg: "#FFF8E1", text: "#F57F17", border: "#FFE082" },
    { score: 3, label: "Majeur", bg: "#FFF3E0", text: "#E65100", border: "#FFCC80" },
    { score: 4, label: "Sévère", bg: "#FBE9E7", text: "#D84315", border: "#FFAB91" },
    { score: 5, label: "Très sévère", bg: "#FFEBEE", text: "#C62828", border: "#EF9A9A" },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "relative w-full min-w-[80px] px-2 py-2.5 rounded-lg border-2 text-center transition-all duration-200",
            "hover:shadow-md hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-[#2A5141]/40 cursor-pointer",
            "border-solid"
          )}
          style={{
            backgroundColor: style.bg,
            color: style.text,
            borderColor: style.border,
          }}
        >
          <div className="flex flex-col items-center">
            <span className="text-xs font-medium">{style.label}</span>
            <span className="text-[10px] opacity-60">{value}/5</span>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-48 p-1.5 bg-white border-[#E8E4DC] shadow-lg rounded-lg" 
        align="center"
        sideOffset={8}
      >
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-[#172030]/50 uppercase tracking-wider px-2 pb-1 border-b border-[#E8E4DC]">
            {AXIS_LABELS[axis]} — Choisir un niveau
          </p>
          {options.map((opt) => {
            const isSelected = value === opt.score;
            return (
              <button
                key={opt.score}
                onClick={() => handleSelect(opt.score)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all",
                  "hover:shadow-sm hover:scale-[1.02]",
                  isSelected && "ring-2 ring-[#2A5141] ring-offset-1"
                )}
                style={{
                  backgroundColor: opt.bg,
                  color: opt.text,
                }}
              >
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: opt.text }} />
                <span className="flex-1 text-left font-medium">{opt.label}</span>
                <span className="text-xs opacity-50">{opt.score}/5</span>
                {isSelected && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};

// ════════════════════════════════════════════════════════════════════
// ✅ STEPS - SEULEMENT 3 ÉTAPES
// ════════════════════════════════════════════════════════════════════
const STEPS = [
  { id: "general", label: "Général", icon: "📋" },
  { id: "impact", label: "Impact métier", icon: "🎯" },
  { id: "rto", label: "Délais & RTO/RPO", icon: "⏱️" }
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

// ════════════════════════════════════════════════════════════════════
// ✅ COMPOSANT PRINCIPAL - 3 ÉTAPES UNIQUEMENT
// ════════════════════════════════════════════════════════════════════
export const BiaWizard = ({ processId, initialEntityId, onDone }: { processId?: string; initialEntityId?: string; onDone: () => void }) => {
  const { processes, upsertProcess } = useBia();
  const { entities } = useGovernance();
  const [isSaving, setIsSaving] = useState(false);
  
  const initial = useMemo(() => {
    const found = processes.find((p) => p.id === processId);
    if (found) {
      return { ...found, impacts: getSafeImpacts(found.impacts), appsCritiques: (found as any).appsCritiques || [] };
    }
    return newProcess();
  }, [processId, processes]);
  
  const [step, setStep] = useState(0);
  
  const [data, setData] = useState<any>(() => {
    if (processId && initial.entityId) {
      return initial;
    }
    if (!processId && initialEntityId) {
      const entityExists = entities.some(e => e.id === initialEntityId);
      if (entityExists) {
        return { ...initial, entityId: initialEntityId };
      }
    }
    return initial;
  });

  const updateImpactWithCascade = (axis: ImpactAxis, periodId: string, newValue: number) => {
    setData((prev: any) => {
      const newImpacts = { ...prev.impacts };
      const startIndex = TIME_PERIODS_ORDERED.indexOf(periodId);

      newImpacts[periodId] = { ...newImpacts[periodId], [axis]: newValue };

      for (let i = startIndex + 1; i < TIME_PERIODS_ORDERED.length; i++) {
        const period = TIME_PERIODS_ORDERED[i];
        const currentValue = newImpacts[period]?.[axis] ?? 0;
        if (newValue > currentValue) {
          newImpacts[period] = { ...newImpacts[period], [axis]: newValue };
        }
      }

      return { ...prev, impacts: newImpacts };
    });
  };

  const update = (key: string, value: any) => {
    setData((d: any) => ({ ...d, [key]: value }));
  };

  const globalScore = computeMaxScore(data.impacts);
  const criticality = scoreToCriticality(globalScore);
  const rtoExceedsMtpd = data.rto > data.mtpd;
  const requiresPca = globalScore >= 3;
  const scorePercentage = Math.round((globalScore / 5) * 100);
  const suggestedRTO = getSuggestedRTOFromImpacts(data.impacts);
  const suggestedRPO = getSuggestedRPOFromImpacts(data.impacts);

  const canNext = () => {
    if (step === 0) return data.name && data.entityId && data.owner;
    if (step === 2) return !rtoExceedsMtpd;
    return true;
  };

  // ✅ Sauvegarde optimisée
  const submit = async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    const processToSave = {
      ...data,
      lastUpdated: new Date().toISOString().slice(0, 10),
      appsCritiques: data.appsCritiques || [],
      resources: []
    };
    
    console.log("💾 Sauvegarde du processus:", processToSave.name);
    
    try {
      await upsertProcess(processToSave);
      toast({ title: "BIA enregistré", description: `${data.name} — Criticité: ${criticality}` });
      // ✅ Fermer immédiatement après sauvegarde
      onDone();
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error);
      toast({ title: "Erreur", description: "Impossible d'enregistrer le BIA", variant: "destructive" });
      setIsSaving(false);
    }
  };

  const applySuggestions = () => {
    update("rto", suggestedRTO);
    update("rpo", suggestedRPO);
    toast({ title: "Suggestions appliquées", description: `RTO: ${suggestedRTO}h, RPO: ${suggestedRPO}h` });
  };
  
  const isLastStep = step === STEPS.length - 1;

  const rtoOptions = [0.5, 1, 2, 4, 6, 8, 12, 24, 48, 72, 96, 120, 168];
  const rpoOptions = [0.25, 0.5, 1, 2, 4, 6, 8, 12, 24, 48, 72];
  const mtpdOptions = [8, 12, 24, 48, 72, 96, 120, 168, 336, 720];
  
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground" style={{ fontFamily: "Playfair Display, serif" }}>
            {processId ? "Modifier l'analyse d'impact" : "Nouvelle analyse d'impact métier"}
          </h1>
          <p className="text-muted-foreground mt-2">Remplissez les étapes pour évaluer la criticité de votre processus</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onDone} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Retour à la fiche
          </Button>
        </div>
      </div>

      <div className="bg-secondary/20 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Progression</span>
          <span className="text-sm text-muted-foreground">Étape {step + 1} / {STEPS.length}</span>
        </div>
        <div className="flex gap-2">
          {STEPS.map((s, i) => (
            <button 
              key={s.id} 
              onClick={() => i <= step && setStep(i)} 
              className={`flex-1 h-2 rounded-full transition-all ${i < step ? "bg-success" : i === step ? "bg-primary" : "bg-secondary"}`} 
              title={s.label} 
            />
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          {STEPS.map((s, i) => (
            <span key={s.id} className={i === step ? "text-primary font-medium" : ""}>
              {s.icon} {s.label}
            </span>
          ))}
        </div>
        {data.name && (
          <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Processus actuel</span>
            <span className="text-sm font-bold text-primary truncate max-w-[200px]">{data.name}</span>
          </div>
        )}
      </div>

      <div className="bg-gradient-to-r from-[#2A5141]/10 to-[#2A5141]/5 rounded-xl p-6 border border-[#2A5141]/20">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-[#2A5141]/20 flex items-center justify-center">
              <TrendingUp className="h-7 w-7 text-[#2A5141]" />
            </div>
            <div>
              <p className="text-xs font-medium text-[#172030]/50 uppercase tracking-wider">Score de criticité</p>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold text-[#172030]" style={{ fontFamily: "Playfair Display, serif" }}>
                  {scorePercentage}%
                </span>
                <Badge className={cn("text-sm px-3 py-1", criticalityColor(criticality))}>
                  {criticality}
                </Badge>
              </div>
            </div>
          </div>
          {requiresPca && (
            <div className="flex items-center gap-2 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg border border-amber-200">
              <ShieldAlert className="h-4 w-4" />
              <span className="text-sm font-medium">Nécessite un PCA dédié</span>
            </div>
          )}
        </div>
        <div className="mt-4 h-2.5 bg-[#E8E4DC] rounded-full overflow-hidden">
          <div 
            className="h-full rounded-full transition-all duration-500"
            style={{ 
              width: `${scorePercentage}%`,
              backgroundColor: globalScore >= 4 ? "#C62828" : globalScore >= 3 ? "#E65100" : globalScore >= 2 ? "#F57F17" : "#2E7D32"
            }}
          />
        </div>
        <p className="text-xs text-[#172030]/40 mt-2">
          Score basé sur le maximum de tous les impacts évalués (1 = Mineur, 5 = Très sévère)
        </p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          {/* ÉTAPE 1 - GÉNÉRAL */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-[#2A5141]/15 flex items-center justify-center text-[#2A5141]">1</div>
                  <h2 className="text-lg font-semibold" style={{ fontFamily: "Playfair Display, serif" }}>Informations générales</h2>
                </div>
                {data.name && <Badge variant="outline" className="text-xs">📋 {data.name}</Badge>}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Nom du processus *</Label>
                  <Input value={data.name} onChange={(e) => update("name", e.target.value)} placeholder="Ex: Traitement des commandes" />
                </div>
                <div>
                  <Label>Entité *</Label>
                  <Select 
                    value={data.entityId} 
                    onValueChange={(v) => update("entityId", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une entité" />
                    </SelectTrigger>
                    <SelectContent>
                      {entities.filter(e => e.parentId !== null).map((entity) => (
                        <SelectItem key={entity.id} value={entity.id}>
                          <span className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            {entity.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sélectionnez le département ou service concerné.
                  </p>
                </div>
                <div>
                  <Label>Responsable *</Label>
                  <Input value={data.owner} onChange={(e) => update("owner", e.target.value)} placeholder="Nom du responsable" />
                </div>
                <div className="md:col-span-2">
                  <Label>Description</Label>
                  <Textarea value={data.description} onChange={(e) => update("description", e.target.value)} rows={3} placeholder="Décrivez le processus..." />
                </div>
              </div>
            </div>
          )}

          {/* ÉTAPE 2 - IMPACT */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-[#2A5141]/15 flex items-center justify-center text-[#2A5141]">2</div>
                  <h2 className="text-lg font-semibold" style={{ fontFamily: "Playfair Display, serif" }}>Évaluation de l'impact métier</h2>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1">
                      <span className="text-base">📊</span> Voir la matrice
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogTitle className="text-lg font-semibold mb-2" style={{ fontFamily: "Playfair Display, serif" }}>
                      Matrice d'évaluation des impacts
                    </DialogTitle>
                    <StaticImpactMatrix />
                  </DialogContent>
                </Dialog>
              </div>
              <p className="text-sm text-muted-foreground">
                Évaluez l'impact (1 = négligeable, 5 = catastrophique) pour chaque axe et période d'indisponibilité.
                <span className="block text-xs text-[#2A5141] mt-1">
                  ⚡ La sévérité se propage automatiquement vers l'avant : quand vous mettez une valeur, les périodes suivantes s'ajustent si elles sont moins graves. Vous pouvez modifier n'importe quelle cellule à tout moment.
                </span>
                <span className="block text-xs text-amber-600 mt-1">
                  ⚠️ Si vous baissez une valeur sur une période, les périodes suivantes conservent leur valeur (pas de baisse automatique).
                </span>
              </p>

              <div className="bg-[#F8F6F2] rounded-lg p-3 text-center border border-[#E8E4DC]">
                <p className="text-sm text-[#172030]">
                  Score actuel : <strong className="text-[#2A5141]">{globalScore}/5</strong> ({criticality})
                </p>
              </div>

              <div className="overflow-auto border border-[#E8E4DC] rounded-xl bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#F8F6F2] border-b border-[#E8E4DC]">
                      <TableHead className="w-36 py-3 px-4 text-xs font-semibold text-[#172030]/60 uppercase tracking-wider">
                        Axe / Période
                      </TableHead>
                      {PERIODS.map((p) => (
                        <TableHead key={p.id} className="text-center min-w-[100px] py-3 px-2">
                          <div className="text-xs font-semibold text-[#172030]">{p.label}</div>
                          <div className="text-[10px] text-[#172030]/40 font-normal">
                            {p.hours <= 24 ? `${p.hours}h` : `${Math.round(p.hours/24)}j`}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(Object.keys(AXIS_LABELS) as ImpactAxis[]).map((axis, rowIdx) => (
                      <TableRow 
                        key={axis} 
                        className={cn(
                          "border-b border-[#E8E4DC]",
                          rowIdx % 2 === 0 ? "bg-white" : "bg-[#FAFAF9]"
                        )}
                      >
                        <TableCell className="font-medium text-sm text-[#172030] py-3 px-4">
                          <div className="flex items-center gap-1">
                            {AXIS_LABELS[axis]}
                            <ImpactTooltip axis={axis} />
                          </div>
                        </TableCell>
                        {PERIODS.map((p) => {
                          const currentValue = data.impacts[p.id]?.[axis] ?? 0;
                          return (
                            <TableCell key={p.id} className="text-center p-2">
                              <ImpactCell
                                value={currentValue}
                                axis={axis}
                                periodId={p.id}
                                onValueChange={updateImpactWithCascade}
                              />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              <div className="flex items-center gap-4 text-xs text-[#172030]/50">
                <span className="flex items-center gap-1 text-[#2A5141]">
                  <span>💡</span>
                  Cliquez sur n'importe quelle cellule pour modifier la valeur
                </span>
                <span className="flex items-center gap-1">
                  <span>⚡</span>
                  La cascade s'applique automatiquement vers la droite
                </span>
              </div>
            </div>
          )}

          {/* ÉTAPE 3 - DÉLAIS & RTO/RPO */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-[#2A5141]/15 flex items-center justify-center text-[#2A5141]">3</div>
                  <h2 className="text-lg font-semibold" style={{ fontFamily: "Playfair Display, serif" }}>Délais de reprise &amp; RTO/RPO</h2>
                </div>
                {data.name && <Badge variant="outline">⏱️ {data.name}</Badge>}
              </div>
              <div className="bg-[#F8F6F2] rounded-lg p-4 border border-[#E8E4DC]">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-sm font-medium text-[#172030]">RTO / RPO suggérés</p>
                    <p className="text-xs text-[#172030]/50">Basés sur la première période d'impact significatif</p>
                    <div className="flex gap-4 mt-2">
                      <div className="bg-white rounded-lg px-3 py-1.5 border border-[#E8E4DC]">
                        <span className="text-xs text-[#172030]/50">RTO suggéré</span>
                        <p className="text-xl font-bold text-[#2A5141]">{suggestedRTO}h</p>
                      </div>
                      <div className="bg-white rounded-lg px-3 py-1.5 border border-[#E8E4DC]">
                        <span className="text-xs text-[#172030]/50">RPO suggéré</span>
                        <p className="text-xl font-bold text-[#2A5141]">{suggestedRPO}h</p>
                      </div>
                    </div>
                  </div>
                  <Button onClick={applySuggestions} variant="outline" size="sm" className="border-[#2A5141] text-[#2A5141] hover:bg-[#2A5141]/10">
                    Appliquer les suggestions
                  </Button>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>RTO — Recovery Time Objective (heures)</Label>
                  <Select 
                    value={String(data.rto)} 
                    onValueChange={(v) => update("rto", Number(v))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sélectionner un RTO" />
                    </SelectTrigger>
                    <SelectContent>
                      {rtoOptions.map((val) => (
                        <SelectItem key={val} value={String(val)}>
                          {val}h
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Délai maximal de reprise visé.</p>
                </div>
                <div>
                  <Label>RPO — Recovery Point Objective (heures)</Label>
                  <Select 
                    value={String(data.rpo)} 
                    onValueChange={(v) => update("rpo", Number(v))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sélectionner un RPO" />
                    </SelectTrigger>
                    <SelectContent>
                      {rpoOptions.map((val) => (
                        <SelectItem key={val} value={String(val)}>
                          {val}h
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Perte de données maximale acceptée.</p>
                </div>
                <div className="md:col-span-2">
                  <Label>MTPD — Maximum Tolerable Period of Disruption (heures)</Label>
                  <Select 
                    value={String(data.mtpd)} 
                    onValueChange={(v) => update("mtpd", Number(v))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sélectionner un MTPD" />
                    </SelectTrigger>
                    <SelectContent>
                      {mtpdOptions.map((val) => (
                        <SelectItem key={val} value={String(val)}>
                          {val}h
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Durée maximale d'indisponibilité acceptable avant de mettre en danger l'entreprise.</p>
                </div>
              </div>
              {rtoExceedsMtpd && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>Erreur : le RTO ({data.rto}h) ne peut pas être supérieur au MTPD ({data.mtpd}h).</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" disabled={step === 0 || isSaving} onClick={() => setStep(s => s - 1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />Précédent
        </Button>
        {!isLastStep ? (
          <Button onClick={() => setStep(s => s + 1)} disabled={!canNext() || isSaving} className="bg-[#2A5141] hover:bg-[#1a3329] text-white">
            Suivant <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={submit} disabled={!canNext() || isSaving} className="bg-[#2A5141] hover:bg-[#1a3329] text-white">
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Enregistrer le BIA
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};