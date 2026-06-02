// src/components/chatbot/BcmCopilot.tsx
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, Send, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  suggestions?: string[];
  timestamp: Date;
};

const predefinedAnswers: Record<string, string> = {
  rto: "Le **RTO (Recovery Time Objective)** est le délai maximal acceptable pour restaurer un processus après une interruption. Exemple : un RTO de 4h signifie que l’activité doit être reprise dans les 4 heures.",
  rpo: "Le **RPO (Recovery Point Objective)** est la perte de données maximale acceptable, exprimée en durée. Exemple : un RPO de 1h signifie qu’on peut perdre au maximum 1 heure de données.",
  mtpd: "Le **MTPD (Maximum Tolerable Period of Disruption)** est la durée maximale d’interruption au-delà de laquelle l’organisation ne peut plus survivre.",
  mbco: "Le **MBCO (Minimum Business Continuity Objective)** est le niveau de service minimal à maintenir pendant une crise.",
  "iso 22301": "L’**ISO 22301** est la norme internationale pour les systèmes de management de la continuité d’activité (SMCA).",
  criticité: "La **criticité** d’un processus se détermine en fonction de l’impact d’une interruption. Utilisez une échelle de 1 à 5.",
  impact: "Pour évaluer l’impact, considérez les axes : financier, réglementaire, réputation, client, opérationnel.",
};

const getContextualSuggestions = (lastAssistantMessage: string): string[] => {
  const lower = lastAssistantMessage.toLowerCase();
  if (lower.includes("rto")) return ["Voir les standards par secteur", "Comment calculer mon RTO ?"];
  if (lower.includes("criticité")) return ["Grille d'évaluation", "Exemples par secteur"];
  return ["En savoir plus", "Autre question", "Aide pour mon BIA"];
};

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
    let answer: string | undefined = undefined;
    for (const [key, value] of Object.entries(predefinedAnswers)) {
      if (lowerText.includes(key)) {
        answer = value;
        break;
      }
    }

    if (answer) {
      addMessage("assistant", answer, getContextualSuggestions(answer));
      setIsLoading(false);
      return;
    }

    const context = getCurrentProcessContext();
    const processInfo = context.processName ? ` (Processus actuel: ${context.processName}, secteur: ${context.entitySector})` : "";
    const prompt = `Tu es un expert BCM certifié ISO 22301. Tu aides un consultant à remplir un BIA.${processInfo} Réponds en français, concis (max 3 phrases). Question: ${text}`;

    try {
      const response = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "mistral",
          prompt,
          stream: false,
          options: { temperature: 0, num_predict: 300 },
        }),
      });
      const data = await response.json();
      let ollamaAnswer = data.response || "Désolé, je n'ai pas pu générer de réponse.";
      addMessage("assistant", ollamaAnswer, getContextualSuggestions(ollamaAnswer));
    } catch (error) {
      console.error("Ollama error:", error);
      addMessage("assistant", "⚠️ Service IA indisponible. Réessayez plus tard.", ["Réessayer", "Aide"]);
    }
    setIsLoading(false);
  };

  const handleWelcome = () => {
    if (messages.length === 0) {
      const context = getCurrentProcessContext();
      let welcomeMsg = "Bonjour ! Je suis votre assistant BCM Copilot. Je peux vous aider pour le BIA, l'ISO 22301, et détecter des anomalies. Comment puis-je vous aider ?";
      if (context.processName) {
        welcomeMsg = `Bonjour ! Je vois que vous travaillez sur **${context.processName}** (secteur ${context.entitySector}). Je suis votre assistant BCM Copilot. Que voulez-vous savoir ?`;
      }
      addMessage("assistant", welcomeMsg, ["Qu'est-ce que le RTO ?", "Comment évaluer l'impact ?", "ISO 22301"]);
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    setUnreadCount(0);
    if (messages.length === 0) handleWelcome();
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
      <Card className="w-[420px] h-[600px] flex flex-col shadow-2xl rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between border-b">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">BCM Copilot</CardTitle>
              <p className="text-xs text-muted-foreground">Assistant ISO 22301</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}><X className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[85%] rounded-lg px-4 py-2 text-sm", msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")}>
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          ))}
          {isLoading && <div className="text-muted-foreground text-sm">●●●</div>}
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
            <Input ref={inputRef} placeholder="Posez votre question..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage(input)} disabled={isLoading} />
            <Button size="icon" onClick={() => sendMessage(input)} disabled={isLoading}><Send className="h-4 w-4" /></Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};