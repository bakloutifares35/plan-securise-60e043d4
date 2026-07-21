// ContournementsDeCriseIA.tsx - Version corrigée
import { useState, useCallback, useEffect } from "react";
import { 
  Sparkles, 
  Brain, 
  Loader2,
  Save,
  X,
  Lightbulb,
  Trash2,
  CheckCircle,
  Clock,
  Zap,
  Hourglass,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useBia } from "@/contexts/BiaContext";
import { useGovernance } from "@/contexts/GovernanceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils"; // 👈 IMPORT AJOUTÉ

// Types
interface IARecommendation {
  periode: string;
  description: string;
  actions: string[];
  ressources_necessaires: string[];
  delai_mise_en_oeuvre: string;
  niveau_priorite: "haute" | "moyenne" | "basse";
  justification: string;
}

interface Contournement {
  id: string;
  processus_id: string;
  periode: string;
  description: string;
  actions: string[];
  ressources_necessaires: string[];
  delai_mise_en_oeuvre: string;
  niveau_priorite: "haute" | "moyenne" | "basse";
  statut: "propose" | "valide" | "rejete";
  created_at: string;
}

const PERIODES = [
  { value: "0_4H", label: "0-4h", icon: Zap, color: "#DC2626", bg: "bg-red-50" },
  { value: "4_8H", label: "4-8h", icon: Clock, color: "#EA580C", bg: "bg-orange-50" },
  { value: "P1D", label: "24h", icon: Clock, color: "#D97706", bg: "bg-amber-50" },
  { value: "P2D", label: "48h", icon: Clock, color: "#CA8A04", bg: "bg-yellow-50" },
  { value: "P1W", label: "120h", icon: Clock, color: "#3B82F6", bg: "bg-blue-50" },
];

export const ContournementsDeCriseIA = ({ 
  serviceId,
  onSave
}: { 
  serviceId?: string;
  onSave?: () => void;
}) => {
  const { processes } = useBia();
  const { entities } = useGovernance();
  
  const [selectedProcessId, setSelectedProcessId] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationMessage, setGenerationMessage] = useState("");
  const [generationStep, setGenerationStep] = useState("");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [recommendations, setRecommendations] = useState<IARecommendation[]>([]);
  const [savedContournements, setSavedContournements] = useState<Contournement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedRecs, setExpandedRecs] = useState<Set<number>>(new Set());
  const [useFastMode, setUseFastMode] = useState(true);
  
  // Charger les contournements existants
  const loadContournements = useCallback(async () => {
    if (!selectedProcessId) {
      setSavedContournements([]);
      return;
    }
    
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('contournements_crise')
        .select('*')
        .eq('processus_id', selectedProcessId);
      
      if (error) throw error;
      setSavedContournements(data || []);
    } catch (error) {
      console.error('Erreur chargement contournements:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedProcessId]);

  useEffect(() => {
    loadContournements();
  }, [selectedProcessId, loadContournements]);

  // Timer pour l'affichage du temps écoulé
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating) {
      setElapsedTime(0);
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  // Récupérer le processus sélectionné
  const getSelectedProcess = useCallback(() => {
    return processes.find(p => p.id === selectedProcessId);
  }, [processes, selectedProcessId]);

  // Récupérer les ressources d'un processus
  const getProcessResources = useCallback(async (processId: string) => {
    const result = {
      hr: [] as any[],
      equipment: [] as any[],
      apps: [] as any[],
      suppliers: [] as any[]
    };

    try {
      const { data: hrLinks } = await supabase
        .from('processus_ressources_humaines')
        .select('ressource_humaine_id')
        .eq('processus_id', processId);
      
      if (hrLinks && hrLinks.length > 0) {
        const hrIds = hrLinks.map(l => l.ressource_humaine_id);
        const { data: hrData } = await supabase
          .from('ressources_humaines')
          .select('*')
          .in('id', hrIds);
        result.hr = hrData || [];
      }

      const { data: equipLinks } = await supabase
        .from('processus_equipements')
        .select('equipement_id, rto_hours')
        .eq('processus_id', processId);
      
      if (equipLinks && equipLinks.length > 0) {
        const equipIds = equipLinks.map(l => l.equipement_id);
        const { data: equipData } = await supabase
          .from('ressources_equipements')
          .select('*')
          .in('id', equipIds);
        result.equipment = equipData || [];
      }

      const { data: appLinks } = await supabase
        .from('processus_applications')
        .select('application_id, rto_hours, rpo_hours')
        .eq('processus_id', processId);
      
      if (appLinks && appLinks.length > 0) {
        const appIds = appLinks.map(l => l.application_id);
        const { data: appData } = await supabase
          .from('applications_it')
          .select('*')
          .in('id', appIds);
        result.apps = appData || [];
      }

      const { data: suppLinks } = await supabase
        .from('processus_fournisseurs')
        .select('fournisseur_id, rto_hours')
        .eq('processus_id', processId);
      
      if (suppLinks && suppLinks.length > 0) {
        const suppIds = suppLinks.map(l => l.fournisseur_id);
        const { data: suppData } = await supabase
          .from('fournisseurs')
          .select('*')
          .in('id', suppIds);
        result.suppliers = suppData || [];
      }
    } catch (error) {
      console.error('Erreur récupération ressources:', error);
    }

    return result;
  }, []);

  // 📋 Générer des recommandations simulées (instantané)
  const generateMockRecommendations = (process: any): IARecommendation[] => {
    return [
      {
        periode: "0_4H",
        description: `🔴 Contournement immédiat pour "${process.name}" - Basculer sur le plan de secours manuel`,
        actions: [
          "Activer immédiatement le plan de continuité d'activité",
          `Mobiliser l'équipe de crise (${process.owner || 'responsable'})`,
          "Basculer sur les procédures manuelles documentées",
          "Déclencher la communication d'urgence vers les parties prenantes"
        ],
        ressources_necessaires: [
          "📋 Documentation des procédures de secours",
          "👥 Équipe de crise",
          "🏢 Accès au site de repli",
          "📱 Système de communication d'urgence"
        ],
        delai_mise_en_oeuvre: "15 min",
        niveau_priorite: "haute",
        justification: "L'activité doit être reprise dans les 2h maximum pour éviter un impact critique sur l'organisation."
      },
      {
        periode: "4_8H",
        description: `🟠 Mise en place des procédures alternatives pour "${process.name}"`,
        actions: [
          "Déployer les ressources de secours identifiées",
          "Activer les processus manuels de remplacement",
          "Communiquer avec les parties prenantes sur l'état d'avancement",
          "Mettre en place le suivi des opérations de secours"
        ],
        ressources_necessaires: [
          "🛠️ Ressources de secours",
          "👥 Équipe de support",
          "📢 Plan de communication de crise",
          "📊 Outils de suivi"
        ],
        delai_mise_en_oeuvre: "2h",
        niveau_priorite: "haute",
        justification: "La continuité de l'activité nécessite une mise en place rapide des alternatives."
      },
      {
        periode: "P1D",
        description: `🟡 Stabilisation et retour à la normale pour "${process.name}"`,
        actions: [
          "Évaluer l'impact de la crise et documenter les écarts",
          "Rétablir les processus nominaux progressivement",
          "Documenter les enseignements pour améliorer la résilience",
          "Valider la reprise complète avec les parties prenantes"
        ],
        ressources_necessaires: [
          "📋 Équipe de retour à la normale",
          "🔍 Outils de diagnostic",
          "✅ Processus de validation",
          "📝 Documentation des leçons apprises"
        ],
        delai_mise_en_oeuvre: "4h",
        niveau_priorite: "moyenne",
        justification: "La reprise complète doit être effectuée dans les 24h pour minimiser l'impact."
      }
    ];
  };

  // 🚀 Version ultra-rapide de génération
  const generateRecommendationsFast = async (process: any, resources: any) => {
    // Prompt court et optimisé
    const prompt = `
Processus: ${process.name}
RTO: ${process.rto || 0}h
Ressources: HR(${resources.hr.length}), Apps(${resources.apps.length}), Equip(${resources.equipment.length})
Dépendances: ${process.depends_on ? process.depends_on.join(', ') : 'Aucune'}

Génère 3 contournements de crise (0-4h, 4-24h, 24-120h) en JSON:
{
  "recommendations": [
    {
      "periode": "0_4H",
      "description": "Description courte",
      "actions": ["Action1", "Action2", "Action3"],
      "ressources_necessaires": ["Ressource1", "Ressource2"],
      "delai_mise_en_oeuvre": "30 min",
      "niveau_priorite": "haute",
      "justification": "Justification"
    }
  ]
}`;

    try {
      const response = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "mistral",
          prompt: prompt,
          options: { 
            temperature: 0.1,
            num_predict: 600,
            num_ctx: 1024,
            top_k: 10
          },
          stream: false
        })
      });

      if (!response.ok) throw new Error("Erreur Ollama");

      const result = await response.json();
      const cleanResponse = result.response
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();

      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Format invalide");

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Erreur génération rapide:', error);
      return null;
    }
  };

  // 🎯 Génération principale
  const generateRecommendations = async () => {
    const process = getSelectedProcess();
    if (!process) {
      toast.error("Veuillez sélectionner un processus");
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    setGenerationMessage("🚀 Analyse rapide du processus...");
    setGenerationStep("🔍 Analyse en cours");
    setRecommendations([]);

    try {
      // Récupérer les ressources
      setGenerationProgress(20);
      setGenerationMessage("📊 Récupération des ressources...");
      setGenerationStep("📊 Données");
      const resources = await getProcessResources(process.id);

      // 🚀 Mode rapide
      if (useFastMode) {
        setGenerationProgress(40);
        setGenerationMessage("⚡ Génération en cours (mode rapide)...");
        setGenerationStep("⚡ IA rapide");
        
        const result = await generateRecommendationsFast(process, resources);
        
        if (result && result.recommendations && result.recommendations.length > 0) {
          setGenerationProgress(100);
          setGenerationMessage("✅ Analyse terminée !");
          setGenerationStep("✅ Terminé");
          setRecommendations(result.recommendations);
          setExpandedRecs(new Set([0]));
          toast.success(`✅ ${result.recommendations.length} recommandations générées en mode rapide !`);
          
          setTimeout(() => {
            setIsGenerating(false);
            setGenerationProgress(0);
          }, 1000);
          return;
        }
      }

      // Fallback: mode normal
      setGenerationMessage("🔄 Mode normal - analyse complète...");
      setGenerationStep("🧠 IA complète");
      
      const prompt = `
Analyse ce processus et génère des contournements de crise.

PROCESSUS:
- Nom: ${process.name}
- RTO: ${process.rto || 0}h
- RPO: ${process.rpo || 0}h
- Description: ${process.description || 'Non renseigné'}

RESSOURCES:
- Personnel: ${resources.hr.map(h => h.name).join(', ')}
- Équipements: ${resources.equipment.map(e => e.name).join(', ')}
- Applications: ${resources.apps.map(a => a.name).join(', ')}

Pour CHAQUE période (0_4H, 4_8H, P1D), propose un contournement.

Retourne UNIQUEMENT un JSON:
{
  "recommendations": [
    {
      "periode": "0_4H",
      "description": "Description",
      "actions": ["Action 1", "Action 2"],
      "ressources_necessaires": ["Ressource 1"],
      "delai_mise_en_oeuvre": "30 min",
      "niveau_priorite": "haute",
      "justification": "Justification"
    }
  ]
}`;

      setGenerationProgress(50);
      setGenerationMessage("🧠 Génération en cours... (peut prendre 1-2 min)");
      setGenerationStep("⏳ Génération");

      const response = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "mistral",
          prompt: prompt,
          options: { 
            temperature: 0.2,
            num_predict: 3000,
            num_ctx: 2048
          },
          stream: false
        })
      });

      if (!response.ok) throw new Error("Erreur Ollama");

      const result = await response.json();
      const cleanResponse = result.response
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();

      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Format invalide");

      const parsed = JSON.parse(jsonMatch[0]);
      
      setGenerationProgress(100);
      setGenerationMessage("✅ Analyse terminée !");
      setGenerationStep("✅ Terminé");

      if (parsed.recommendations && parsed.recommendations.length > 0) {
        setRecommendations(parsed.recommendations);
        setExpandedRecs(new Set([0]));
        toast.success(`✅ ${parsed.recommendations.length} recommandations générées !`);
      } else {
        toast.warning("Aucune recommandation générée");
        const mockRecs = generateMockRecommendations(process);
        setRecommendations(mockRecs);
        setExpandedRecs(new Set([0]));
        toast.info("📋 Simulation activée - recommandations générées localement");
      }

    } catch (error: any) {
      console.error('Erreur:', error);
      const mockRecs = generateMockRecommendations(process);
      setRecommendations(mockRecs);
      setExpandedRecs(new Set([0]));
      toast.info("📋 Mode simulation - recommandations générées localement");
    } finally {
      setIsGenerating(false);
      setTimeout(() => {
        setGenerationProgress(0);
        setGenerationMessage("");
        setGenerationStep("");
      }, 2000);
    }
  };

  // Sauvegarder une recommandation
  const saveRecommendation = async (rec: IARecommendation) => {
    if (!selectedProcessId) {
      toast.error("Aucun processus sélectionné");
      return;
    }

    try {
      const { data, error } = await supabase
        .from('contournements_crise')
        .insert({
          processus_id: selectedProcessId,
          periode: rec.periode,
          description: rec.description,
          actions: rec.actions,
          ressources_necessaires: rec.ressources_necessaires,
          delai_mise_en_oeuvre: rec.delai_mise_en_oeuvre,
          niveau_priorite: rec.niveau_priorite,
          statut: 'propose'
        })
        .select()
        .single();

      if (error) throw error;
      
      setSavedContournements([...savedContournements, data]);
      setRecommendations(recommendations.filter(r => r !== rec));
      toast.success("✅ Contournement sauvegardé !");
      
      if (onSave) onSave();
    } catch (error: any) {
      console.error('Erreur sauvegarde:', error);
      toast.error("❌ Erreur: " + error.message);
    }
  };

  // Supprimer un contournement
  const deleteContournement = async (id: string) => {
    if (!confirm("Supprimer ce contournement ?")) return;

    try {
      const { error } = await supabase
        .from('contournements_crise')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setSavedContournements(savedContournements.filter(c => c.id !== id));
      toast.success("🗑️ Contournement supprimé");
    } catch (error: any) {
      console.error('Erreur suppression:', error);
      toast.error("❌ Erreur: " + error.message);
    }
  };

  // Mettre à jour le statut
  const updateStatus = async (id: string, statut: 'valide' | 'rejete') => {
    try {
      const { error } = await supabase
        .from('contournements_crise')
        .update({ statut })
        .eq('id', id);

      if (error) throw error;
      
      setSavedContournements(savedContournements.map(c => 
        c.id === id ? { ...c, statut } : c
      ));
      toast.success(`✅ Statut mis à jour: ${statut === 'valide' ? 'Validé' : 'Rejeté'}`);
    } catch (error: any) {
      console.error('Erreur mise à jour:', error);
      toast.error("❌ Erreur: " + error.message);
    }
  };

  // Toggle expansion d'une recommandation
  const toggleExpand = (index: number) => {
    setExpandedRecs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // Helpers d'affichage
  const getPeriodeLabel = (value: string) => {
    return PERIODES.find(p => p.value === value)?.label || value;
  };

  const getPeriodeColor = (value: string) => {
    return PERIODES.find(p => p.value === value)?.color || "#6B7280";
  };

  const getPeriodeBg = (value: string) => {
    return PERIODES.find(p => p.value === value)?.bg || "bg-gray-50";
  };

  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, string> = {
      haute: "bg-red-100 text-red-700 border-red-200",
      moyenne: "bg-orange-100 text-orange-700 border-orange-200",
      basse: "bg-blue-100 text-blue-700 border-blue-200"
    };
    return styles[priority] || styles.moyenne;
  };

  const getPriorityLabel = (priority: string) => {
    const labels: Record<string, string> = {
      haute: "Haute",
      moyenne: "Moyenne",
      basse: "Basse"
    };
    return labels[priority] || priority;
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      propose: "bg-gray-100 text-gray-600 border-gray-200",
      valide: "bg-green-100 text-green-700 border-green-200",
      rejete: "bg-red-100 text-red-700 border-red-200"
    };
    return styles[status] || styles.propose;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      propose: "Proposé",
      valide: "Validé",
      rejete: "Rejeté"
    };
    return labels[status] || status;
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Sélecteur de processus
  const processOptions = processes.map(p => ({
    value: p.id,
    label: p.name,
    entity: entities.find(e => e.id === p.entityId)?.name || '—'
  }));

  return (
    <div className="space-y-4">
      {/* En-tête avec switch mode rapide */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-[#2A5141]" />
          <span className="text-sm font-medium text-[#172030]">Assistant IA de crise</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#172030]/40">⚡ Mode rapide</span>
          <button
            onClick={() => setUseFastMode(!useFastMode)}
            className={cn(
              "relative w-10 h-5 rounded-full transition-colors",
              useFastMode ? "bg-[#2A5141]" : "bg-[#E8E4DC]"
            )}
          >
            <span className={cn(
              "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
              useFastMode ? "translate-x-5" : "translate-x-0.5"
            )} />
          </button>
        </div>
      </div>

      {/* Sélecteur de processus */}
      <Card className="border-[#E8E4DC] shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
            <div className="flex-1 w-full">
              <Label className="text-sm font-medium text-[#172030]">
                Sélectionner un processus
              </Label>
              <div className="mt-1">
                <Select value={selectedProcessId} onValueChange={setSelectedProcessId}>
                  <SelectTrigger className="w-full border-[#E8E4DC] bg-white">
                    <SelectValue placeholder="Choisir un processus..." />
                  </SelectTrigger>
                  <SelectContent>
                    {processOptions.map(p => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label} {p.entity !== '—' && `(${p.entity})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              onClick={generateRecommendations}
              disabled={!selectedProcessId || isGenerating}
              className="gap-2 bg-[#2A5141] hover:bg-[#1a3329] text-white shrink-0"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Génération...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  {useFastMode ? 'Générer (rapide)' : 'Générer (complet)'}
                </>
              )}
            </Button>
          </div>

          {/* Barre de progression */}
          {isGenerating && (
            <div className="mt-4 p-4 bg-[#F8F6F2] rounded-lg border border-[#E8E4DC] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-[#2A5141]/10 flex items-center justify-center">
                    <Brain className="h-4 w-4 text-[#2A5141] animate-pulse" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#172030]">{generationStep || "Analyse en cours..."}</p>
                    <p className="text-xs text-[#172030]/60 flex items-center gap-2">
                      <Hourglass className="h-3 w-3" />
                      {generationMessage || "L'IA analyse votre processus..."}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono text-[#2A5141] font-bold">
                    {generationProgress}%
                  </span>
                  <p className="text-[10px] text-[#172030]/40">
                    ⏱ {formatTime(elapsedTime)}
                  </p>
                </div>
              </div>
              <Progress value={generationProgress} className="h-2 bg-[#E8E4DC]" />
              <div className="flex flex-wrap gap-2 text-[10px] text-[#172030]/40">
                <span className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${generationProgress >= 20 ? 'bg-[#2A5141]' : 'bg-[#E8E4DC]'}`} />
                  Données
                </span>
                <span className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${generationProgress >= 40 ? 'bg-[#2A5141]' : 'bg-[#E8E4DC]'}`} />
                  IA
                </span>
                <span className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${generationProgress >= 85 ? 'bg-[#2A5141]' : 'bg-[#E8E4DC]'}`} />
                  Résultats
                </span>
                {useFastMode && (
                  <span className="flex items-center gap-1 ml-auto text-[#2A5141]">
                    ⚡ Mode rapide
                  </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recommandations IA */}
      {recommendations.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-5 w-5 text-[#2A5141]" />
            <h3 className="text-sm font-semibold text-[#172030]">
              Recommandations IA
            </h3>
            <Badge className="bg-[#2A5141] text-white text-[10px]">
              {recommendations.length}
            </Badge>
          </div>
          <div className="space-y-3">
            {recommendations.map((rec, index) => {
              const isExpanded = expandedRecs.has(index);
              const periodeColor = getPeriodeColor(rec.periode);
              const periodeBg = getPeriodeBg(rec.periode);
              
              return (
                <Card 
                  key={index} 
                  className="border-[#E8E4DC] shadow-sm hover:shadow-md transition-all overflow-hidden"
                  style={{ borderLeft: `4px solid ${periodeColor}` }}
                >
                  <div 
                    className="p-4 cursor-pointer hover:bg-[#FAFAF9] transition-colors"
                    onClick={() => toggleExpand(index)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <Badge className={`${periodeBg} border-0 text-[#172030] flex items-center gap-1`}>
                            <Clock className="h-3 w-3" style={{ color: periodeColor }} />
                            {getPeriodeLabel(rec.periode)}
                          </Badge>
                          <Badge className={getPriorityBadge(rec.niveau_priorite)}>
                            {getPriorityLabel(rec.niveau_priorite)}
                          </Badge>
                          <span className="text-xs text-[#172030]/40 flex items-center gap-1">
                            ⏱ {rec.delai_mise_en_oeuvre}
                          </span>
                        </div>
                        <p className="text-sm text-[#172030] mt-2 line-clamp-2">
                          {rec.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          onClick={(e) => { e.stopPropagation(); saveRecommendation(rec); }}
                          className="gap-1.5 bg-[#2A5141] hover:bg-[#1a3329] text-white"
                          size="sm"
                        >
                          <Save className="h-3.5 w-3.5" />
                          Sauvegarder
                        </Button>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-[#172030]/40" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-[#172030]/40" />
                        )}
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-[#E8E4DC] bg-[#FAFAF9] space-y-3">
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-[#172030]/60">📋 Actions à réaliser :</p>
                        <ul className="space-y-1">
                          {rec.actions.map((action, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-[#172030]/80">
                              <span className="text-[#2A5141] font-bold mt-0.5">{i + 1}.</span>
                              <span>{action}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-medium text-[#172030]/60">🛠 Ressources nécessaires :</p>
                        <div className="flex flex-wrap gap-2">
                          {rec.ressources_necessaires.map((ress, i) => (
                            <Badge key={i} variant="outline" className="text-[10px] border-[#E8E4DC] bg-white">
                              {ress}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-3 border border-[#E8E4DC]">
                        <p className="text-xs text-[#172030]/40 italic flex items-start gap-1">
                          <Lightbulb className="h-3 w-3 mt-0.5 flex-shrink-0 text-[#2A5141]" />
                          <span>{rec.justification}</span>
                        </p>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Contournements sauvegardés */}
      {savedContournements.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="h-5 w-5 text-[#2A5141]" />
            <h3 className="text-sm font-semibold text-[#172030]">
              Contournements sauvegardés
            </h3>
            <Badge className="bg-[#2A5141] text-white text-[10px]">
              {savedContournements.length}
            </Badge>
          </div>
          <div className="space-y-3">
            {savedContournements.map((c) => {
              const periodeColor = getPeriodeColor(c.periode);
              const periodeBg = getPeriodeBg(c.periode);
              
              return (
                <Card key={c.id} className="border-[#E8E4DC] shadow-sm" style={{ borderLeft: `4px solid ${periodeColor}` }}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <Badge className={`${periodeBg} border-0 text-[#172030] flex items-center gap-1`}>
                            <Clock className="h-3 w-3" style={{ color: periodeColor }} />
                            {getPeriodeLabel(c.periode)}
                          </Badge>
                          <Badge className={getPriorityBadge(c.niveau_priorite)}>
                            {getPriorityLabel(c.niveau_priorite)}
                          </Badge>
                          <Badge className={getStatusBadge(c.statut)}>
                            {getStatusLabel(c.statut)}
                          </Badge>
                          <span className="text-xs text-[#172030]/40 flex items-center gap-1">
                            ⏱ {c.delai_mise_en_oeuvre}
                          </span>
                        </div>
                        
                        <p className="text-sm text-[#172030]">{c.description}</p>
                        
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-[#172030]/60">📋 Actions :</p>
                          <ul className="list-disc list-inside text-sm text-[#172030]/80 space-y-0.5">
                            {c.actions.map((action: string, i: number) => (
                              <li key={i}>{action}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {c.ressources_necessaires.map((ress: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-[10px] border-[#E8E4DC]">
                              🛠 {ress}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <div className="flex gap-1">
                          {c.statut === 'propose' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs border-green-200 text-green-600 hover:bg-green-50"
                                onClick={() => updateStatus(c.id, 'valide')}
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Valider
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50"
                                onClick={() => updateStatus(c.id, 'rejete')}
                              >
                                <X className="h-3 w-3 mr-1" />
                                Rejeter
                              </Button>
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-red-400 hover:text-red-600"
                            onClick={() => deleteContournement(c.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Aucune donnée */}
      {!isLoading && !savedContournements.length && !recommendations.length && selectedProcessId && (
        <Card className="border-dashed border-[#E8E4DC] bg-[#F8F6F2]">
          <CardContent className="p-8 text-center">
            <Lightbulb className="h-10 w-10 text-[#172030]/30 mx-auto mb-3" />
            <p className="text-sm text-[#172030]/60">
              Aucun contournement de crise défini pour ce processus.
            </p>
            <p className="text-xs text-[#172030]/40 mt-1">
              Cliquez sur <strong>"Générer avec IA"</strong> pour obtenir des recommandations intelligentes.
            </p>
          </CardContent>
        </Card>
      )}

      {!selectedProcessId && (
        <Card className="border-dashed border-[#E8E4DC] bg-[#F8F6F2]">
          <CardContent className="p-8 text-center">
            <Brain className="h-10 w-10 text-[#172030]/30 mx-auto mb-3" />
            <p className="text-sm text-[#172030]/60">
              Sélectionnez un processus pour générer des contournements de crise.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ContournementsDeCriseIA;