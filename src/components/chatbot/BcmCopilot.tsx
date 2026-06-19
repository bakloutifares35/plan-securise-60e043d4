// src/components/chatbot/BcmCopilot.tsx
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, Send, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatMessage } from "./ChatMessage";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  suggestions?: string[];
  timestamp: Date;
};

// ==================== DONNÉES SECTORIELLES ENRICHIES ====================
type ProcessTemplate = {
  name: string;
  description: string;
  suggested_rto_hours: number;
  suggested_rpo_hours: number;
  criticality: "Critique" | "Majeur" | "Modéré" | "Mineur";
};

const sectorBenchmarks: Record<string, {
  rto_typical: string;
  rpo_typical: string;
  recommended_rto_hours: number;
  processes: ProcessTemplate[];
}> = {
  "Banque & Finance": {
    rto_typical: "2h à 4h pour les processus critiques",
    rpo_typical: "0.5h à 1h",
    recommended_rto_hours: 2,
    processes: [
      { name: "Paiements SEPA", description: "Traitement des virements et prélèvements", suggested_rto_hours: 2, suggested_rpo_hours: 0.5, criticality: "Critique" },
      { name: "Gestion des crédits", description: "Instruction et validation des demandes de crédit", suggested_rto_hours: 4, suggested_rpo_hours: 1, criticality: "Critique" },
      { name: "Trading", description: "Opérations de marché", suggested_rto_hours: 1, suggested_rpo_hours: 0.25, criticality: "Critique" },
      { name: "Conformité réglementaire", description: "Déclarations aux autorités", suggested_rto_hours: 8, suggested_rpo_hours: 2, criticality: "Majeur" },
      { name: "Trésorerie", description: "Gestion des flux et positions de trésorerie", suggested_rto_hours: 2, suggested_rpo_hours: 0.5, criticality: "Critique" },
      { name: "Comptabilité", description: "Tenue des comptes", suggested_rto_hours: 24, suggested_rpo_hours: 4, criticality: "Modéré" }
    ]
  },
  Assurance: {
    rto_typical: "4h à 8h pour la gestion des sinistres",
    rpo_typical: "1h à 2h",
    recommended_rto_hours: 4,
    processes: [
      { name: "Gestion des sinistres", description: "Déclaration et traitement des sinistres", suggested_rto_hours: 4, suggested_rpo_hours: 1, criticality: "Critique" },
      { name: "Souscription", description: "Émission de contrats d'assurance", suggested_rto_hours: 8, suggested_rpo_hours: 2, criticality: "Majeur" },
      { name: "Indemnisation", description: "Calcul et versement des indemnités", suggested_rto_hours: 4, suggested_rpo_hours: 1, criticality: "Critique" },
      { name: "Service client", description: "Relation client", suggested_rto_hours: 6, suggested_rpo_hours: 2, criticality: "Majeur" }
    ]
  },
  Industrie: {
    rto_typical: "24h à 48h pour la production",
    rpo_typical: "4h à 8h",
    recommended_rto_hours: 24,
    processes: [
      { name: "Production", description: "Chaîne de fabrication", suggested_rto_hours: 24, suggested_rpo_hours: 4, criticality: "Critique" },
      { name: "Logistique", description: "Gestion des stocks et expéditions", suggested_rto_hours: 12, suggested_rpo_hours: 2, criticality: "Majeur" },
      { name: "Approvisionnement", description: "Achats et gestion des fournisseurs", suggested_rto_hours: 24, suggested_rpo_hours: 8, criticality: "Modéré" },
      { name: "Maintenance", description: "Maintenance des équipements", suggested_rto_hours: 8, suggested_rpo_hours: 1, criticality: "Majeur" }
    ]
  },
  Santé: {
    rto_typical: "2h à 4h pour les soins critiques",
    rpo_typical: "0.5h à 1h",
    recommended_rto_hours: 2,
    processes: [
      { name: "Consultations", description: "Prises de rendez-vous et suivi patients", suggested_rto_hours: 4, suggested_rpo_hours: 1, criticality: "Majeur" },
      { name: "Chirurgie", description: "Planification et réalisation des interventions", suggested_rto_hours: 2, suggested_rpo_hours: 0.5, criticality: "Critique" },
      { name: "Pharmacie", description: "Gestion des stocks et délivrance", suggested_rto_hours: 2, suggested_rpo_hours: 0.5, criticality: "Critique" },
      { name: "Dossiers patients", description: "Accès et mise à jour des dossiers médicaux", suggested_rto_hours: 2, suggested_rpo_hours: 0.5, criticality: "Critique" }
    ]
  },
  Retail: {
    rto_typical: "4h à 8h pour les paiements et commandes",
    rpo_typical: "1h à 2h",
    recommended_rto_hours: 4,
    processes: [
      { name: "Ventes en magasin", description: "Encaissement et service client", suggested_rto_hours: 4, suggested_rpo_hours: 1, criticality: "Critique" },
      { name: "E-commerce", description: "Gestion des commandes en ligne", suggested_rto_hours: 4, suggested_rpo_hours: 1, criticality: "Critique" },
      { name: "Logistique", description: "Préparation et expédition des commandes", suggested_rto_hours: 8, suggested_rpo_hours: 2, criticality: "Majeur" },
      { name: "Gestion des stocks", description: "Inventaire et réapprovisionnement", suggested_rto_hours: 12, suggested_rpo_hours: 4, criticality: "Modéré" }
    ]
  },
  Technologie: {
    rto_typical: "2h à 6h pour les services cloud critiques",
    rpo_typical: "0.5h à 2h",
    recommended_rto_hours: 2,
    processes: [
      { name: "Infrastructure cloud", description: "Hébergement et services cloud", suggested_rto_hours: 2, suggested_rpo_hours: 0.5, criticality: "Critique" },
      { name: "Support applicatif", description: "Assistance aux utilisateurs", suggested_rto_hours: 4, suggested_rpo_hours: 1, criticality: "Majeur" },
      { name: "Sécurité", description: "Surveillance et protection des données", suggested_rto_hours: 2, suggested_rpo_hours: 0.5, criticality: "Critique" },
      { name: "Sauvegardes", description: "Backup et restauration", suggested_rto_hours: 4, suggested_rpo_hours: 1, criticality: "Critique" }
    ]
  },
  Général: {
    rto_typical: "8h à 24h selon la criticité",
    rpo_typical: "2h à 4h",
    recommended_rto_hours: 8,
    processes: [
      { name: "Gestion administrative", description: "Tâches administratives courantes", suggested_rto_hours: 24, suggested_rpo_hours: 4, criticality: "Modéré" },
      { name: "Comptabilité", description: "Tenue des comptes", suggested_rto_hours: 24, suggested_rpo_hours: 4, criticality: "Modéré" },
      { name: "RH", description: "Gestion du personnel", suggested_rto_hours: 12, suggested_rpo_hours: 2, criticality: "Majeur" },
      { name: "Marketing", description: "Communication et promotion", suggested_rto_hours: 48, suggested_rpo_hours: 12, criticality: "Mineur" }
    ]
  }
};

const allSectors = Object.keys(sectorBenchmarks);

// Détection du secteur mentionné
const detectSectorFromQuestion = (question: string): string | null => {
  const lower = question.toLowerCase();
  for (const sector of allSectors) {
    if (lower.includes(sector.toLowerCase())) {
      return sector;
    }
  }
  return null;
};

// Obtenir des informations générales sur un secteur
const getSectorInfo = (sector: string): string => {
  const data = sectorBenchmarks[sector] || sectorBenchmarks["Général"];
  return `🔍 **Secteur ${sector}**\n- RTO typique : ${data.rto_typical}\n- RPO typique : ${data.rpo_typical}\n- RTO recommandé pour processus critique : ${data.recommended_rto_hours}h\n- Nombre de processus types : ${data.processes.length}`;
};

// Lister les processus critiques d'un secteur
const listProcessesForSector = (sector: string): string => {
  const data = sectorBenchmarks[sector] || sectorBenchmarks["Général"];
  if (!data.processes.length) return `Aucun processus prédéfini pour le secteur ${sector}.`;
  let msg = `🏭 **Processus critiques recommandés pour ${sector}**\n\n`;
  data.processes.forEach((p, idx) => {
    msg += `${idx+1}. **${p.name}** (${p.criticality})\n   - Description : ${p.description}\n   - RTO suggéré : ${p.suggested_rto_hours}h\n   - RPO suggéré : ${p.suggested_rpo_hours}h\n\n`;
  });
  msg += `💡 Pour ajouter l’un de ces processus, rendez-vous dans le module BIA et cliquez sur "Nouveau BIA".`;
  return msg;
};

// Recommander un RTO personnalisé
const recommendRTO = (sector: string, processName?: string): string => {
  const data = sectorBenchmarks[sector] || sectorBenchmarks["Général"];
  
  let matchedProcess: ProcessTemplate | undefined;
  if (processName) {
    const lowerName = processName.toLowerCase();
    matchedProcess = data.processes.find(p => 
      p.name.toLowerCase().includes(lowerName) || 
      lowerName.includes(p.name.toLowerCase())
    );
  }
  
  if (matchedProcess) {
    return `📊 **Recommandation RTO pour "${matchedProcess.name}"**\n- RTO suggéré : ${matchedProcess.suggested_rto_hours}h\n- RPO suggéré : ${matchedProcess.suggested_rpo_hours}h\n- Criticité : ${matchedProcess.criticality}\n\n💡 Ce RTO est adapté à ce type de processus dans le secteur ${sector}. Assurez-vous que RTO ≤ MTPD.`;
  } else {
    let baseRTO = data.recommended_rto_hours;
    let advice = "";
    if (processName) {
      const lower = processName.toLowerCase();
      if (lower.includes("paiement") || lower.includes("trésorerie") || lower.includes("trading")) {
        baseRTO = Math.max(1, baseRTO - 1);
        advice = ` (processus financier → RTO plus strict)`;
      } else if (lower.includes("rh") || lower.includes("paie")) {
        baseRTO = baseRTO + 2;
        advice = ` (processus RH → RTO légèrement plus souple)`;
      } else if (lower.includes("reporting") || lower.includes("budget")) {
        baseRTO = baseRTO + 12;
        advice = ` (reporting → délais plus longs acceptables)`;
      }
    }
    return `📊 **Recommandation RTO pour ${sector}**${advice}\n- RTO suggéré : ${baseRTO}h\n- RPO suggéré : ${Math.max(0.5, baseRTO / 2)}h\n\n💡 Pour un processus spécifique, précisez son nom (ex: "quel RTO pour la paie ?").`;
  }
};

// Réponses prédéfinies
const predefinedAnswers: Record<string, string> = {
  rto: "Le **RTO (Recovery Time Objective)** est le délai maximal acceptable pour restaurer un processus après une interruption. Exemple : un RTO de 4h signifie que l’activité doit être reprise dans les 4 heures.",
  rpo: "Le **RPO (Recovery Point Objective)** est la perte de données maximale acceptable, exprimée en durée. Exemple : un RPO de 1h signifie qu’on peut perdre au maximum 1 heure de données.",
  mtpd: "Le **MTPD (Maximum Tolerable Period of Disruption)** est la durée maximale d’interruption au-delà de laquelle l’organisation ne peut plus survivre.",
  mbco: "Le **MBCO (Minimum Business Continuity Objective)** est le niveau de service minimal à maintenir pendant une crise.",
  "iso 22301": "L’**ISO 22301** est la norme internationale pour les systèmes de management de la continuité d’activité (SMCA).",
  criticité: "La **criticité** d’un processus se détermine en fonction de l’impact d’une interruption. Utilisez une échelle de 1 à 5 (1 = mineur, 5 = catastrophique) sur plusieurs axes : financier, réglementaire, réputation, client, opérationnel.",
  impact: "Pour évaluer l’impact, considérez les axes : financier (perte directe), réglementaire (amendes), réputation (image), client (fidélité), opérationnel (productivité). Chaque axe est noté de 1 à 5.",
};

// Suggestions contextuelles améliorées
const getContextualSuggestions = (lastAssistantMessage: string, currentSector?: string): string[] => {
  const lower = lastAssistantMessage.toLowerCase();
  if (lower.includes("rto")) return ["Recommande-moi un RTO", "Voir les standards par secteur", "Comparer avec un autre secteur"];
  if (lower.includes("rpo")) return ["Différence RTO/RPO", "Recommande-moi un RPO", "Bonnes pratiques"];
  if (lower.includes("criticité")) return ["Grille d'évaluation détaillée", "Exemples par secteur"];
  if (lower.includes("impact")) return ["Axe financier", "Axe réglementaire", "Axe réputationnel", "Axe client", "Axe opérationnel"];
  if (lower.includes("iso 22301")) return ["Exigences clés", "Processus de certification"];
  if (lower.includes("liste") || lower.includes("processus")) return ["Liste des processus critiques", "Ajouter un processus", "Recommande-moi un RTO"];
  if (lower.includes("secteur") || lower.includes("benchmark")) {
    const otherSectors = allSectors.filter(s => s !== currentSector);
    const suggestions = otherSectors.slice(0, 3).map(s => `Comparer avec ${s}`);
    return [...suggestions, "Voir les bonnes pratiques"];
  }
  return ["En savoir plus", "Autre question", "Aide pour mon BIA"];
};

// Récupération du contexte depuis localStorage
const getCurrentProcessContext = () => {
  try {
    const processName = localStorage.getItem("currentProcessName") || "";
    const entitySector = localStorage.getItem("currentEntitySector") || "Général";
    return { processName, entitySector };
  } catch {
    return { processName: "", entitySector: "Général" };
  }
};

export const BcmCopilot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addMessage = (role: "user" | "assistant", content: string, suggestions?: string[]) => {
    setMessages(prev => [...prev, { id: Date.now().toString(), role, content, suggestions, timestamp: new Date() }]);
    if (role === "assistant" && !isOpen) setUnreadCount(prev => prev + 1);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    addMessage("user", text);
    setInput("");
    setIsLoading(true);

    const lowerText = text.toLowerCase();
    const { processName, entitySector } = getCurrentProcessContext();

    // 1. Réponse prédéfinie (définitions)
    let answer = Object.entries(predefinedAnswers).find(([key]) => lowerText.includes(key))?.[1];
    if (answer) {
      addMessage("assistant", answer, getContextualSuggestions(answer, entitySector));
      setIsLoading(false);
      return;
    }

    // 2. Recommander un RTO
    if (lowerText.includes("recommande") || (lowerText.includes("rto") && (lowerText.includes("quel") || lowerText.includes("pour")))) {
      const rtoRecommendation = recommendRTO(entitySector, processName || undefined);
      addMessage("assistant", rtoRecommendation, getContextualSuggestions(rtoRecommendation, entitySector));
      setIsLoading(false);
      return;
    }

    // 3. Lister les processus critiques
    if (lowerText.includes("liste") || (lowerText.includes("processus") && (lowerText.includes("critique") || lowerText.includes("tous") || lowerText.includes("propose")))) {
      let targetSector = detectSectorFromQuestion(text);
      if (!targetSector) targetSector = entitySector;
      const processList = listProcessesForSector(targetSector);
      addMessage("assistant", processList, ["Recommande-moi un RTO", "Ajouter un processus", "Comparer avec un autre secteur"]);
      setIsLoading(false);
      return;
    }

    // 4. Demande sur le secteur actuel
    if (lowerText.includes("secteur") || lowerText.includes("benchmark") || lowerText.includes("informations sur le secteur")) {
      const sectorInfo = getSectorInfo(entitySector);
      addMessage("assistant", sectorInfo, getContextualSuggestions(sectorInfo, entitySector));
      setIsLoading(false);
      return;
    }

    // 5. Comparaison avec un autre secteur
    if (lowerText.includes("compar") || lowerText.includes("autre secteur")) {
      const mentionedSector = detectSectorFromQuestion(text);
      if (mentionedSector && mentionedSector !== entitySector) {
        const currentInfo = sectorBenchmarks[entitySector] || sectorBenchmarks["Général"];
        const otherInfo = sectorBenchmarks[mentionedSector] || sectorBenchmarks["Général"];
        const comparisonMsg = `📊 **Comparaison : ${entitySector} vs ${mentionedSector}**\n\n` +
          `**${entitySector}**\n- RTO typique : ${currentInfo.rto_typical}\n- RPO typique : ${currentInfo.rpo_typical}\n- RTO recommandé : ${currentInfo.recommended_rto_hours}h\n\n` +
          `**${mentionedSector}**\n- RTO typique : ${otherInfo.rto_typical}\n- RPO typique : ${otherInfo.rpo_typical}\n- RTO recommandé : ${otherInfo.recommended_rto_hours}h\n\n` +
          `💡 Les RTO dans ${mentionedSector} sont généralement ${otherInfo.recommended_rto_hours < currentInfo.recommended_rto_hours ? "plus stricts" : "plus souples"} que dans ${entitySector}.`;
        addMessage("assistant", comparisonMsg, ["Comparer avec un autre secteur", "Voir les processus", "Recommande-moi un RTO"]);
        setIsLoading(false);
        return;
      } else {
        const otherSectors = allSectors.filter(s => s !== entitySector);
        const suggestionMsg = `🔍 **Avec quel secteur souhaitez-vous comparer ?**\n\nSecteurs disponibles :\n${otherSectors.map(s => `- ${s}`).join("\n")}\n\nExemple : "Compare avec Banque & Finance"`;
        addMessage("assistant", suggestionMsg, otherSectors.slice(0, 4).map(s => `Comparer avec ${s}`));
        setIsLoading(false);
        return;
      }
    }

    // 6. Appel à Ollama pour les autres questions
    let prompt = `Tu es un consultant senior BCM certifié ISO 22301. Réponds toujours en français, concis (max 3 phrases).`;
    if (processName) {
      prompt = `Tu es un consultant senior BCM certifié ISO 22301.
Réponds toujours en français, concis (max 3 phrases).
Contexte :
- Processus : ${processName}
- Secteur : ${entitySector}

Question : ${text}`;
    } else {
      prompt += `\n\nQuestion : ${text}`;
    }

    try {
      const response = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "mistral",
          prompt,
          stream: false,
          options: { temperature: 0, num_predict: 300 }
        }),
      });
      const data = await response.json();
      let ollamaAnswer = data.response || "Je n’ai pas compris la question.";
      addMessage("assistant", ollamaAnswer, getContextualSuggestions(ollamaAnswer, entitySector));
    } catch (error) {
      console.error("Ollama error:", error);
      addMessage("assistant", "⚠️ Service IA indisponible. Vérifiez qu’Ollama tourne (localhost:11434).", ["Réessayer", "Aide"]);
    }
    setIsLoading(false);
  };

  const handleOpen = () => {
    setIsOpen(true);
    setUnreadCount(0);
    if (messages.length === 0) {
      const { processName, entitySector } = getCurrentProcessContext();
      let welcomeMsg = "";
      if (processName) {
        welcomeMsg = `📋 **Processus :** ${processName}\n🏢 **Secteur :** ${entitySector}\n\nComment puis-je vous aider ?\n\n💡 **Commandes utiles :**\n- "Recommande-moi un RTO" → suggestion personnalisée\n- "Liste les processus critiques" → exemples pour ce secteur\n- "Compare avec Banque & Finance" → comparaison sectorielle\n- "Parle moi de ce secteur" → benchmarks`;
      } else {
        welcomeMsg = `Bonjour ! Je suis votre assistant BCM. Ouvrez un BIA pour que je puisse vous conseiller.\n\n💡 **Commandes utiles :**\n- "Liste les processus critiques pour Banque & Finance"\n- "Recommande-moi un RTO"\n- "Compare avec Assurance"`;
      }
      addMessage("assistant", welcomeMsg, ["Qu'est-ce que le RTO ?", "ISO 22301", "Liste les processus critiques"]);
    }
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button onClick={handleOpen} className="h-14 w-14 rounded-full shadow-lg bg-primary relative">
          <Sparkles className="h-6 w-6 text-primary-foreground" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 bg-destructive text-white text-xs">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Card className="w-[420px] h-[580px] flex flex-col shadow-2xl rounded-xl border bg-background">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 border-b bg-gradient-to-r from-primary/10 to-background">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">BCM Copilot</CardTitle>
              <p className="text-xs text-muted-foreground">Assistant ISO 22301</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-4 py-2 text-sm text-muted-foreground">
                <span className="animate-pulse">●●●</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </CardContent>
        <CardFooter className="pt-3 border-t flex flex-col gap-2">
          {messages.length > 0 && messages[messages.length - 1].suggestions && (
            <div className="flex flex-wrap gap-2 w-full">
              {messages[messages.length - 1].suggestions!.map((sug, idx) => (
                <Button key={idx} variant="outline" size="sm" className="text-xs h-7" onClick={() => sendMessage(sug)}>
                  {sug}
                </Button>
              ))}
            </div>
          )}
          <div className="flex w-full gap-2">
            <Input
              ref={inputRef}
              placeholder="Posez votre question..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isLoading && sendMessage(input)}
              disabled={isLoading}
            />
            <Button size="icon" onClick={() => sendMessage(input)} disabled={isLoading}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};