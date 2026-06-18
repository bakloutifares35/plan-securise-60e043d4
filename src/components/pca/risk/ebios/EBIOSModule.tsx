import { useState } from "react";
import { EbiosProvider, useEbios } from "@/contexts/EbiosContext";
import { EBIOSProgress } from "./EBIOSProgress";
import { EBIOSAtelier1 } from "./EBIOSAtelier1";
import { EBIOSAtelier2 } from "./EBIOSAtelier2";
import { EBIOSAtelier3 } from "./EBIOSAtelier3";
import { EBIOSAtelier4 } from "./EBIOSAtelier4";
import { EBIOSAtelier5 } from "./EBIOSAtelier5";
import { EBIOSSummary } from "./EBIOSSummary";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CheckCircle2, FileText } from "lucide-react";

type Props = { onBack: () => void };

const Inner = ({ onBack }: Props) => {
  const { state, markCompleted } = useEbios();
  const [step, setStep] = useState<number>(1);
  const [showSummary, setShowSummary] = useState(false);

  const labels = ["Cadrage", "Sources de risque", "Scénarios stratégiques", "Scénarios opérationnels", "Traitement"];

  return (
    <div className="space-y-6">
      <nav className="text-sm text-muted-foreground flex items-center gap-1 flex-wrap">
        <button onClick={onBack} className="hover:text-foreground">PCA Manager</button>
        <ChevronRight className="h-3 w-3" />
        <button onClick={onBack} className="hover:text-foreground">Analyse des Risques</button>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium">EBIOS RM</span>
        {!showSummary && (<><ChevronRight className="h-3 w-3" /><span className="text-foreground">Atelier {step} — {labels[step - 1]}</span></>)}
        {showSummary && (<><ChevronRight className="h-3 w-3" /><span className="text-foreground">Synthèse</span></>)}
      </nav>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Changer de méthode
        </Button>
        <div className="flex gap-2">
          <Button variant={showSummary ? "default" : "outline"} size="sm" onClick={() => setShowSummary((v) => !v)}>
            <FileText className="h-4 w-4 mr-1" /> {showSummary ? "Retour aux ateliers" : "Voir la synthèse"}
          </Button>
        </div>
      </div>

      {!showSummary && (
        <EBIOSProgress current={step} completed={state.completedSteps} onJump={setStep} />
      )}

      <div className="animate-in fade-in duration-300" key={showSummary ? "sum" : step}>
        {showSummary ? <EBIOSSummary /> : (
          <>
            {step === 1 && <EBIOSAtelier1 />}
            {step === 2 && <EBIOSAtelier2 />}
            {step === 3 && <EBIOSAtelier3 />}
            {step === 4 && <EBIOSAtelier4 />}
            {step === 5 && <EBIOSAtelier5 />}
          </>
        )}
      </div>

      {!showSummary && (
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="outline" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Atelier précédent
          </Button>
          <Button variant="secondary" onClick={() => markCompleted(step)}>
            <CheckCircle2 className="h-4 w-4 mr-1" /> Marquer comme complété
          </Button>
          {step < 5 ? (
            <Button onClick={() => { markCompleted(step); setStep((s) => Math.min(5, s + 1)); }}>
              Atelier suivant <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={() => { markCompleted(5); setShowSummary(true); }}>
              Voir la synthèse <FileText className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export const EBIOSModule = (props: Props) => (
  <EbiosProvider><Inner {...props} /></EbiosProvider>
);
