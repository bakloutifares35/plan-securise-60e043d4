import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Clock } from "lucide-react";

const steps = [
  {
    phase: "Phase 1 — Préparation",
    items: [
      { title: "Analyse d'impact sur l'activité (BIA)", status: "done", duration: "2 sem.", owner: "RSSI" },
      { title: "Cartographie des processus critiques", status: "done", duration: "1 sem.", owner: "Direction" },
      { title: "Identification des ressources clés", status: "done", duration: "1 sem.", owner: "DSI" },
    ],
  },
  {
    phase: "Phase 2 — Conception",
    items: [
      { title: "Définition des stratégies de continuité", status: "in_progress", duration: "3 sem.", owner: "Comité PCA" },
      { title: "Plans de secours techniques", status: "in_progress", duration: "2 sem.", owner: "DSI" },
      { title: "Procédures de communication de crise", status: "todo", duration: "1 sem.", owner: "Communication" },
    ],
  },
  {
    phase: "Phase 3 — Mise en œuvre",
    items: [
      { title: "Formation des équipes", status: "todo", duration: "2 sem.", owner: "RH" },
      { title: "Déploiement des outils de reprise", status: "todo", duration: "4 sem.", owner: "DSI" },
      { title: "Documentation opérationnelle", status: "todo", duration: "2 sem.", owner: "RSSI" },
    ],
  },
  {
    phase: "Phase 4 — Tests & Maintien",
    items: [
      { title: "Exercices de simulation", status: "todo", duration: "Trimestriel", owner: "Comité PCA" },
      { title: "Audit annuel du PCA", status: "todo", duration: "Annuel", owner: "Audit interne" },
      { title: "Mise à jour continue", status: "todo", duration: "Continu", owner: "RSSI" },
    ],
  },
];

const statusMap = {
  done: { icon: CheckCircle2, label: "Terminé", color: "text-success", badge: "default" },
  in_progress: { icon: Clock, label: "En cours", color: "text-warning", badge: "secondary" },
  todo: { icon: Circle, label: "À faire", color: "text-muted-foreground", badge: "outline" },
} as const;

export const PlanSteps = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Plan de continuité d'activité</h1>
        <p className="text-muted-foreground mt-1">Étapes structurées selon la norme ISO 22301</p>
      </div>

      <div className="space-y-6">
        {steps.map((phase, idx) => (
          <Card key={phase.phase} className="shadow-[var(--shadow-card)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-glow text-primary-foreground text-sm font-semibold">
                  {idx + 1}
                </span>
                {phase.phase}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative pl-6 border-l-2 border-border space-y-5">
                {phase.items.map((item) => {
                  const cfg = statusMap[item.status as keyof typeof statusMap];
                  const Icon = cfg.icon;
                  return (
                    <div key={item.title} className="relative">
                      <span className="absolute -left-[31px] top-0.5 bg-background">
                        <Icon className={`h-5 w-5 ${cfg.color}`} />
                      </span>
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                          <p className="font-medium text-foreground">{item.title}</p>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            Responsable : {item.owner} · Durée : {item.duration}
                          </p>
                        </div>
                        <Badge variant={cfg.badge as any}>{cfg.label}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
