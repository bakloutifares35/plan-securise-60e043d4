import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  current: number;
  completed: number[];
  onJump: (step: number) => void;
};

const STEPS = [
  { n: 1, label: "Cadrage & Socle" },
  { n: 2, label: "Sources de risque" },
  { n: 3, label: "Scénarios stratégiques" },
  { n: 4, label: "Scénarios opérationnels" },
  { n: 5, label: "Traitement du risque" },
];

export const EBIOSProgress = ({ current, completed, onJump }: Props) => {
  const pct = (completed.length / 5) * 100;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Progression EBIOS RM</span>
        <span>{completed.length}/5 ateliers complétés</span>
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {STEPS.map((s) => {
          const done = completed.includes(s.n);
          const active = current === s.n;
          return (
            <button
              key={s.n}
              onClick={() => onJump(s.n)}
              className={cn(
                "flex items-start gap-2 p-3 rounded-lg border text-left transition-all",
                active
                  ? "border-primary bg-primary/5"
                  : done
                  ? "border-success/40 bg-success/5 hover:border-success"
                  : "border-border hover:border-primary/40"
              )}
            >
              {done ? (
                <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
              ) : (
                <Circle className={cn("h-4 w-4 shrink-0 mt-0.5", active ? "text-primary" : "text-muted-foreground")} />
              )}
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Atelier {s.n}</div>
                <div className="text-sm font-medium truncate">{s.label}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
