import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Grid3x3, ShieldAlert, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type RiskMethod = "matrix" | "ebios";

type Props = {
  active: RiskMethod | null;
  onSelect: (m: RiskMethod) => void;
};

export const RiskMethodSelection = ({ active, onSelect }: Props) => {
  const methods: {
    id: RiskMethod;
    title: string;
    desc: string;
    icon: typeof Grid3x3;
    tags: string[];
  }[] = [
    {
      id: "matrix",
      title: "Méthode Cartographique 5×5",
      desc: "Cartographie classique des risques par croisement Probabilité × Impact. Idéale pour une vision synthétique et rapide des risques critiques.",
      icon: Grid3x3,
      tags: ["Rapide", "Synthétique", "ISO 31000"],
    },
    {
      id: "ebios",
      title: "EBIOS Risk Manager",
      desc: "Méthode française de l'ANSSI structurée en 5 ateliers : cadrage, sources de risque, scénarios stratégiques, scénarios opérationnels et traitement.",
      icon: ShieldAlert,
      tags: ["ANSSI", "5 ateliers", "Cyber"],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analyse des Risques</h1>
        <p className="text-muted-foreground mt-1">
          Choisissez la méthode d'analyse adaptée à votre besoin.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {methods.map((m) => {
          const Icon = m.icon;
          const isActive = active === m.id;
          return (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              className={cn(
                "text-left transition-all rounded-xl group",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              )}
            >
              <Card
                className={cn(
                  "h-full transition-all border-2 hover:shadow-lg hover:-translate-y-0.5",
                  isActive ? "border-primary shadow-md" : "border-border"
                )}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Icon className="h-6 w-6" />
                    </div>
                    {isActive && <Badge>Actif</Badge>}
                  </div>
                  <CardTitle className="mt-4">{m.title}</CardTitle>
                  <CardDescription>{m.desc}</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1.5">
                    {m.tags.map((t) => (
                      <Badge key={t} variant="secondary">{t}</Badge>
                    ))}
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>
    </div>
  );
};
