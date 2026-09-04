// src/components/chatbot/ChatbotWidget.tsx
import { functionsClient } from "@/integrations/supabase/functionsClient";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, X, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/resillia/client";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export const ChatbotWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Bonjour ! Je suis l'Assistant Resillia. Posez-moi une question sur vos processus, risques ou stratégies." }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestions = [
    "Quels processus n'ont pas de stratégie ?",
    "Résume mes risques critiques",
    "Combien de ressources ne sont liées à aucun processus ?"
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const newMessages: Message[] = [...messages, { role: "user" as const, content: text }];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const { data, error } = await functionsClient.functions.invoke('groq-chatbot', {
        body: { messages: [{ role: "user", content: text }], history: messages }
      });

      if (error) throw error;

      setMessages(prev => [...prev, { role: "assistant", content: data.content }]);
    } catch (err) {
      console.error("Erreur chat:", err);
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Désolé, je n'ai pas pu répondre à votre question pour le moment." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Bouton flottant */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50 p-3 rounded-full shadow-lg transition-all duration-300 hover:scale-105",
          isOpen ? "bg-[#172030] text-white" : "bg-[#2A5141] text-white"
        )}
      >
        {isOpen ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>

      {/* Panneau de Chat */}
      {isOpen && (
        <div className="fixed bottom-20 right-6 z-50 w-[360px] h-[560px] bg-white border border-[#E5E2DD] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#E5E2DD] bg-[#F8F6F2]">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#2A5141]" />
              <h3 className="font-serif font-bold text-[#172030] text-base">Assistant Resillia</h3>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-[#172030]/40 hover:text-[#172030]">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Zone de messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
            {messages.map((msg, idx) => (
              <div key={idx} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[85%] rounded-lg p-3 text-sm",
                  msg.role === "user" 
                    ? "bg-[#2A5141] text-white" 
                    : "bg-[#F8F6F2] text-[#172030]"
                )}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-[#F8F6F2] text-[#172030]/60 rounded-lg p-3 text-sm flex items-center gap-2">
                  <span className="animate-pulse">L'assistant réfléchit...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions */}
          {messages.length === 1 && !isLoading && (
            <div className="px-4 py-2 border-t border-[#E5E2DD] bg-[#F8F6F2]">
              <p className="text-xs text-[#172030]/50 mb-2">💡 Suggestions :</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-xs bg-white border border-[#E5E2DD] px-3 py-1 rounded-full hover:bg-[#F8F6F2] transition-colors text-[#172030]/70"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-[#E5E2DD] bg-white">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
                placeholder="Posez votre question..."
                className="flex-1 border-[#E5E2DD] focus-visible:ring-[#2A5141]"
                disabled={isLoading}
              />
              <Button 
                onClick={() => sendMessage(input)} 
                disabled={isLoading || !input.trim()}
                className="bg-[#2A5141] hover:bg-[#1F3E32] text-white h-10 w-10 p-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};