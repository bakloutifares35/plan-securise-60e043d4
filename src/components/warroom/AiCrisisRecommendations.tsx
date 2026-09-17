// src/components/warroom/AiCrisisRecommendations.tsx
// Bloc « Recommandations IA » de la fiche crise War Room.
// Appelle l'Edge Function groq-warroom-assist et réutilise addAction / addPlan existants.
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, Plus, Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { functionsClient } from "@/integrations/supabase/functionsClient";
import { COLORS } from "./warroomHelpers";

export type AiProcessContext = { nom: string; criticite?: string | null; rto?: string | null };

type SuggestedAction = { titre: string; description: string };
type SuggestedPlan = { nom: string; raison: string };

export const AiCrisisRecommendations = ({
  incidentId,
  typeIncident,
  severite,
  titre,
  description,
  processus,
  plans,
  disabled,
  onAddAction,
  onAddPlan,
}: {
  incidentId: string;
  typeIncident: string | null;
  severite: string;
  titre: string;
  description: string | null;
  processus: AiProcessContext[];
  plans: { id: string; titre: string }[];
  disabled?: boolean;
  onAddAction: (p: { description: string; statut: string }) => Promise<boolean>;
  onAddPlan: (p: { plan_id?: string | null; libelle?: string | null }) => Promise<boolean>;
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [actions, setActions] = useState<SuggestedAction[]>([]);
  const [plansSuggeres, setPlansSuggeres] = useState<SuggestedPlan[]>([]);
  const [addedActions, setAddedActions] = useState<Record<number, boolean>>({});
  const [addedPlans, setAddedPlans] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const lastIncident = useRef<string | null>(null);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const { data, error: fnError } = await functionsClient.functions.invoke(
        "groq-warroom-assist",
        {
          body: {
            context: {
              type_incident: typeIncident,
              severite,
              titre,
              description,
              processus,
              plans_disponibles: plans.map((p) => ({ titre: p.titre })),
            },
          },
        }
      );

      if (fnError || !data || (data as any).error) {
        setError(true);
        setActions([]);
        setPlansSuggeres([]);
      } else {
        setActions(Array.isArray((data as any).actions) ? (data as any).actions : []);
        setPlansSuggeres(
          Array.isArray((data as any).plans_suggeres) ? (data as any).plans_suggeres : []
        );
        setAddedActions({});
        setAddedPlans({});
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidentId, typeIncident, severite, titre, description, JSON.stringify(processus), plans.length]);

  // Déclenchement automatique à l'ouverture de la fiche crise.
  useEffect(() => {
    if (lastIncident.current === incidentId) return;
    lastIncident.current = incidentId;
    fetchSuggestions();
  }, [incidentId, fetchSuggestions]);

  const handleAddAction = async (a: SuggestedAction, idx: number) => {
    setBusy(`a-${idx}`);
    const text = a.description ? `${a.titre} — ${a.description}` : a.titre;
    const ok = await onAddAction({ description: text, statut: "À faire" });
    setBusy(null);
    if (ok) setAddedActions((prev) => ({ ...prev, [idx]: true }));
  };

  const handleAddPlan = async (p: SuggestedPlan, idx: number) => {
    setBusy(`p-${idx}`);
    const matched = plans.find(
      (x) => x.titre.trim().toLowerCase() === p.nom.trim().toLowerCase()
    );
    const ok = await onAddPlan({ plan_id: matched?.id ?? null, libelle: matched?.titre ?? p.nom });
    setBusy(null);
    if (ok) setAddedPlans((prev) => ({ ...prev, [idx]: true }));
  };

  return (
    <Card
      className="border-0 shadow-sm overflow-hidden"
      style={{ backgroundColor: "#FCFBF8", borderLeft: `3px solid ${COLORS.forest}` }}
    >
      <CardHeader className="pb-2">
        <CardTitle
          className="text-sm flex items-center gap-2"
          style={{ color: COLORS.navy, fontFamily: "'Playfair Display', serif" }}
        >
          <Sparkles className="h-4 w-4" style={{ color: COLORS.forest }} />
          Recommandations IA
          {!loading && (
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto h-6 w-6 p-0"
              onClick={fetchSuggestions}
              disabled={disabled}
              style={{ color: COLORS.forest }}
              title="Régénérer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {loading && (
          <div className="flex items-center gap-2 py-2 text-xs" style={{ color: COLORS.navy + "90" }}>
            <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: COLORS.forest }} />
            Analyse du contexte par l'IA...
          </div>
        )}

        {!loading && error && (
          <p className="text-xs italic py-1" style={{ color: COLORS.navy + "70" }}>
            Recommandations IA indisponibles pour le moment
          </p>
        )}

        {!loading && !error && (
          <>
            {actions.length > 0 && (
              <div className="space-y-1.5">
                <p
                  className="text-[10px] font-semibold uppercase tracking-wide"
                  style={{ color: COLORS.navy + "70" }}
                >
                  Actions initiales suggérées
                </p>
                {actions.map((a, idx) => (
                  <div
                    key={`${a.titre}-${idx}`}
                    className="p-2 rounded-lg flex items-start gap-2"
                    style={{ backgroundColor: "#FFFFFF", border: `1px solid ${COLORS.border}` }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium" style={{ color: COLORS.navy }}>
                        {a.titre}
                      </p>
                      {a.description && (
                        <p className="text-[11px] mt-0.5" style={{ color: COLORS.navy + "80" }}>
                          {a.description}
                        </p>
                      )}
                    </div>
                    {addedActions[idx] ? (
                      <span
                        className="flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1"
                        style={{ backgroundColor: "#E8F5E9", color: COLORS.forest }}
                      >
                        <Check className="h-3 w-3" /> Ajoutée
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[10px] flex-shrink-0"
                        style={{ borderColor: COLORS.forest, color: COLORS.forest }}
                        disabled={disabled || busy === `a-${idx}`}
                        onClick={() => handleAddAction(a, idx)}
                      >
                        {busy === `a-${idx}` ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <Plus className="h-3 w-3 mr-0.5" /> Ajouter
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {plansSuggeres.length > 0 && (
              <div className="space-y-1.5">
                <p
                  className="text-[10px] font-semibold uppercase tracking-wide"
                  style={{ color: COLORS.navy + "70" }}
                >
                  Plans PCA à activer
                </p>
                {plansSuggeres.map((p, idx) => (
                  <div
                    key={`${p.nom}-${idx}`}
                    className="p-2 rounded-lg flex items-start gap-2"
                    style={{ backgroundColor: "#FFFFFF", border: `1px solid ${COLORS.border}` }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium" style={{ color: COLORS.navy }}>
                        {p.nom}
                      </p>
                      {p.raison && (
                        <p className="text-[11px] mt-0.5" style={{ color: COLORS.navy + "80" }}>
                          {p.raison}
                        </p>
                      )}
                    </div>
                    {addedPlans[idx] ? (
                      <span
                        className="flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1"
                        style={{ backgroundColor: "#E8F5E9", color: COLORS.forest }}
                      >
                        <Check className="h-3 w-3" /> Activé
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[10px] flex-shrink-0"
                        style={{ borderColor: COLORS.forest, color: COLORS.forest }}
                        disabled={disabled || busy === `p-${idx}`}
                        onClick={() => handleAddPlan(p, idx)}
                      >
                        {busy === `p-${idx}` ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "Activer"
                        )}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {actions.length === 0 && plansSuggeres.length === 0 && (
              <p className="text-xs italic py-1" style={{ color: COLORS.navy + "70" }}>
                Aucune recommandation pour ce contexte.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AiCrisisRecommendations;
