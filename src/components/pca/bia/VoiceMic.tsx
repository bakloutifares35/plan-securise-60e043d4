import { useState, useEffect } from "react";
import { Mic, MicOff, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { processVoiceCommand, resetDialog } from "@/services/voiceHandler";
import { toast } from "@/hooks/use-toast";

interface VoiceMicProps {
  onNameChange?: (name: string) => void;
  onOwnerChange?: (owner: string) => void;
  onEntityChange?: (entity: string) => void;
  onDescriptionChange?: (desc: string) => void;
  onRTOChange?: (rto: number) => void;
  onRPOChange?: (rpo: number) => void;
  onImpactFill?: (score: number) => void;
  onNextStep?: () => void;
  onAddResource?: (resource: { name: string; role: string }) => void;
  currentStep?: number;
}

export const VoiceMic = ({
  onNameChange,
  onOwnerChange,
  onEntityChange,
  onDescriptionChange,
  onRTOChange,
  onRPOChange,
  onImpactFill,
  onNextStep,
  onAddResource,
  currentStep = 0,
}: VoiceMicProps) => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [recognition, setRecognition] = useState<any>(null);
  const [assistantMessage, setAssistantMessage] = useState<string>("");

  const speak = (message: string) => {
    setAssistantMessage(message);
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.lang = 'fr-FR';
      utterance.rate = 0.9;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  };

  useEffect(() => {
    return () => {
      if (recognition) {
        try { recognition.abort(); } catch(e) {}
      }
      window.speechSynthesis.cancel();
    };
  }, [recognition]);

  const processText = async (text: string) => {
    setIsProcessing(true);
    const result = processVoiceCommand(text, currentStep);
    
    for (const action of result.actions) {
      switch (action.type) {
        case "setName": onNameChange?.(action.value); break;
        case "setOwner": onOwnerChange?.(action.value); break;
        case "setEntity": onEntityChange?.(action.value); break;
        case "setDescription": onDescriptionChange?.(action.value); break;
        case "setRTO": onRTOChange?.(action.value); break;
        case "setRPO": onRPOChange?.(action.value); break;
        case "setImpact": onImpactFill?.(action.value); break;
        case "nextStep": onNextStep?.(); break;
        case "addResource": onAddResource?.(action.value); break;
      }
    }

    if (result.askQuestion) {
      speak(result.askQuestion);
    } else if (result.success && result.message) {
      toast({ title: "🎤 Assistant", description: result.message });
      if (!result.askQuestion) speak(result.message);
    } else if (!result.success) {
      toast({ title: "❓", description: result.message, variant: "destructive" });
      speak(result.message);
    }

    setIsProcessing(false);
    setTranscript("");
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast({ title: "⚠️ Navigateur non supporté", description: "Utilisez Chrome ou Edge", variant: "destructive" });
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognitionInstance = new SpeechRecognition();
    recognitionInstance.continuous = false;
    recognitionInstance.interimResults = true;
    recognitionInstance.lang = "fr-FR";

    recognitionInstance.onresult = (event: any) => {
      let finalText = "";
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalText += event.results[i][0].transcript;
      }
      if (finalText) {
        setTranscript(finalText);
        processText(finalText);
        setIsListening(false);
      }
    };

    recognitionInstance.onerror = () => {
      setIsListening(false);
      toast({ title: "❌ Erreur micro", description: "Vérifiez les autorisations", variant: "destructive" });
    };

    recognitionInstance.onend = () => setIsListening(false);
    recognitionInstance.start();
    setRecognition(recognitionInstance);
    setIsListening(true);
    setTranscript("");
  };

  const stopListening = () => {
    if (recognition) {
      try { recognition.abort(); } catch(e) {}
      setIsListening(false);
    }
  };

  const resetAssistant = () => {
    resetDialog();
    speak("Assistant réinitialisé. Dites 'démarrer' pour commencer.");
  };

  return (
    <div className="fixed bottom-24 right-6 z-50">
      <div className="flex flex-col items-end gap-2">
        {assistantMessage && (
          <Card className="max-w-xs bg-primary/10 border-primary/20 mb-2">
            <CardContent className="p-2 text-xs">
              🤖 {assistantMessage}
            </CardContent>
          </Card>
        )}
        <div className="flex gap-2">
          <Button
            onClick={resetAssistant}
            variant="outline"
            size="sm"
            className="rounded-full h-10 w-10 text-xs"
            title="Réinitialiser"
          >
            🔄
          </Button>
          <Button
            onClick={isListening ? stopListening : startListening}
            className={cn(
              "rounded-full h-14 w-14 shadow-lg transition-all",
              isListening ? "bg-red-500 hover:bg-red-600 animate-pulse" : "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            )}
            disabled={isProcessing}
          >
            {isProcessing ? <Loader2 className="h-6 w-6 animate-spin" /> : isListening ? <MicOff className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      {(isListening || transcript) && (
        <Card className="absolute bottom-20 right-0 w-72 shadow-xl border-primary/20 mt-2">
          <CardContent className="p-3 space-y-2">
            {isListening && (
              <div className="flex items-center gap-2 text-green-600">
                <div className="h-2 w-2 rounded-full bg-green-600 animate-pulse" />
                <span className="text-xs font-medium">Écoute en cours...</span>
              </div>
            )}
            {transcript && (
              <div className="text-sm">
                <p className="text-muted-foreground text-xs">Vous avez dit :</p>
                <p className="font-medium mt-0.5 text-sm">"{transcript}"</p>
              </div>
            )}
            {isProcessing && (
              <div className="text-xs text-blue-600 flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Traitement...
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};