// src/components/warroom/IncidentTimeline.tsx — Timeline chronologique (lecture seule)
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, MessageSquare, Target, Megaphone, Layers } from "lucide-react";
import {
  RESILLIA, ENTRY_TYPE_COLORS, formatDateTime,
  type Incident, type MainCouranteEntry, type IncidentAction,
  type IncidentCommunication, type IncidentPlan,
} from "./types";

type TimelineItem = {
  id: string;
  ts: string;
  kind: "mc" | "action" | "comm" | "plan";
  type?: string;
  author?: string;
  title: string;
  body?: string;
};

export const IncidentTimeline = ({
  incident,
  entries,
  actions,
  communications,
  plansLies,
  onBack,
}: {
  incident: Incident;
  entries: MainCouranteEntry[];
  actions: IncidentAction[];
  communications: IncidentCommunication[];
  plansLies: IncidentPlan[];
  onBack: () => void;
}) => {
  const items = useMemo<TimelineItem[]>(() => {
    const out: TimelineItem[] = [];

    for (const mc of entries) {
      out.push({
        id: `mc-${mc.id}`,
        ts: mc.horodatage,
        kind: "mc",
        type: mc.type,
        author: mc.auteur || undefined,
        title: mc.type,
        body: mc.contenu,
      });
    }
    for (const a of actions) {
      out.push({
        id: `act-${a.id}`,
        ts: a.echeance || incident.date_heure_debut,
        kind: "action",
        author: a.responsable || undefined,
        title: `Action — ${a.statut}`,
        body: a.description,
      });
    }
    for (const c of communications) {
      out.push({
        id: `comm-${c.id}`,
        ts: c.created_at,
        kind: "comm",
        author: c.auteur || undefined,
        title: `Communication — ${c.statut}`,
        body: `${c.objet}${c.message ? "\n" + c.message : ""}`,
      });
    }
    for (const p of plansLies) {
      out.push({
        id: `plan-${p.id}`,
        ts: incident.date_heure_debut,
        kind: "plan",
        title: "Plan activé",
        body: p.libelle || (p.plan_id ? `Référence ${p.plan_id}` : "Plan référencé"),
      });
    }

    return out.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  }, [entries, actions, communications, plansLies, incident.date_heure_debut]);

  const icon = (k: TimelineItem["kind"]) => {
    switch (k) {
      case "mc": return <MessageSquare className="h-4 w-4" />;
      case "action": return <Target className="h-4 w-4" />;
      case "comm": return <Megaphone className="h-4 w-4" />;
      case "plan": return <Layers className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} style={{ color: RESILLIA.forest }}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Retour à la war room
        </Button>
      </div>

      <div>
        <h2 className="text-xl font-bold" style={{ color: RESILLIA.navy, fontFamily: "'Playfair Display', serif" }}>
          Timeline — {incident.titre}
        </h2>
        <p className="text-sm mt-1" style={{ color: RESILLIA.navy + "80" }}>
          {items.length} événement{items.length > 1 ? "s" : ""} · vue lecture seule
        </p>
      </div>

      <Card style={{ backgroundColor: "#FFF", borderColor: RESILLIA.border }}>
        <CardContent className="p-5">
          {items.length === 0 ? (
            <p className="text-sm italic text-center py-8" style={{ color: RESILLIA.navy + "60" }}>
              Aucun événement
            </p>
          ) : (
            <ol className="relative border-l-2 pl-6 space-y-5" style={{ borderColor: RESILLIA.border }}>
              {items.map((it) => {
                const color = it.type
                  ? ENTRY_TYPE_COLORS[it.type as keyof typeof ENTRY_TYPE_COLORS] || RESILLIA.forest
                  : RESILLIA.forest;
                return (
                  <li key={it.id} className="relative">
                    <span
                      className="absolute -left-[34px] top-0.5 flex items-center justify-center h-6 w-6 rounded-full text-white"
                      style={{ backgroundColor: color }}
                    >
                      {icon(it.kind)}
                    </span>
                    <div className="text-xs font-mono mb-1" style={{ color: RESILLIA.navy + "80" }}>
                      {formatDateTime(it.ts)}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px]" style={{ borderColor: RESILLIA.border, color: RESILLIA.navy }}>
                        {it.title}
                      </Badge>
                      {it.author && (
                        <span className="text-xs font-medium" style={{ color: RESILLIA.navy }}>
                          {it.author}
                        </span>
                      )}
                    </div>
                    {it.body && (
                      <p className="text-sm mt-1 whitespace-pre-wrap break-words" style={{ color: RESILLIA.navy }}>
                        {it.body}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default IncidentTimeline;