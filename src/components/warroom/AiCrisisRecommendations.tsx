// src/components/warroom/AiCrisisRecommendations.tsx
// Bloc « Copilote IA » — version compacte avec onglets internes.
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, Plus, Check, RefreshCw, Target, Layers } from "lucide-react";
import { functionsClient } from "@/integrations/supabase/functionsClient";
import { COLORS } from "./warroomHelpers";
import { cn } from "@/lib/utils";

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
  const [activeTab, setActiveTab] = useState<"actions" | "plans">("actions");
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
        setActiveTab("actions");
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidentId, typeIncident, severite, titre, description, JSON.stringify(processus), plans.length]);

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

  const hasContent = actions.length > 0 || plansSuggeres.length > 0;
  const totalSuggestions = actions.length + plansSuggeres.length;

  // Onglet actif par défaut : si pas d'actions, afficher les plans
  useEffect(() => {
    if (!loading && !error) {
      if (actions.length === 0 && plansSuggeres.length > 0) setActiveTab("plans");
    }
  }, [loading, error, actions.length, plansSuggeres.length]);

  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col"
      style={{
        border: `1px solid ${COLORS.border}`,
        backgroundColor: "#FFFFFF",
        boxShadow: "0 1px 3px rgba(23,32,48,0.05)",
      }}
    >
      {/* Header harmonisé avec les autres blocs */}
      <div
        className="flex items-center gap-2.5 px-4 py-3 border-b"
        style={{ borderColor: COLORS.border + "99", backgroundColor: COLORS.forest + "06" }}
      >
        <span
          className="flex h-6 w-6 items-center justify-center rounded-md flex-shrink-0"
          style={{ backgroundColor: COLORS.forest, color: "#FFFFFF" }}
        >
          <Sparkles className="h-3 w-3" />
        </span>
        <span
          className="text-[13.5px] font-semibold flex-1 truncate"
          style={{ color: COLORS.navy, fontFamily: "'Playfair Display', serif" }}
        >
          Copilote IA
        </span>
        {totalSuggestions > 0 && !loading && (
          <span
            className="text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-full"
            style={{ backgroundColor: COLORS.forest + "15", color: COLORS.forest }}
          >
            {totalSuggestions}
          </span>
        )}
        {!loading && (
          <button
            type="button"
            onClick={fetchSuggestions}
            disabled={disabled}
            className={cn(
              "h-7 w-7 p-0 rounded-md flex items-center justify-center transition-colors",
              disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-white"
            )}
            style={{ color: COLORS.navy + "80" }}
            title="Régénérer les suggestions"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Corps */}
      <div className="flex-1 flex flex-col min-h-0">
        {loading && (
          <div className="flex items-center gap-2 py-3 px-4">
            <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" style={{ color: COLORS.forest }} />
            <span className="text-[11px] italic" style={{ color: COLORS.navy + "70" }}>
              Analyse du contexte par l'IA...
            </span>
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center gap-2 py-3 px-4">
            <span className="h-1.5 w-1.5 rounded-full flex-shrink-0 bg-[#C0C5CC]" />
            <span className="text-[11px] italic" style={{ color: COLORS.navy + "60" }}>
              Recommandations IA indisponibles pour le moment
            </span>
          </div>
        )}

        {!loading && !error && hasContent && (
          <>
            {/* Onglets internes */}
            <div
              className="flex items-center gap-0 px-3 pt-2 border-b"
              style={{ borderColor: COLORS.border + "70" }}
            >
              <button
                type="button"
                onClick={() => setActiveTab("actions")}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-2 text-[11px] font-semibold transition-all border-b-2 -mb-px",
                  activeTab === "actions" ? "border-b-[#2A5141]" : "border-b-transparent"
                )}
                style={{
                  color: activeTab === "actions" ? COLORS.forest : COLORS.navy + "50",
                }}
              >
                <Target className="h-3 w-3" />
                Actions
                <span
                  className="text-[9px] font-bold tabular-nums px-1.5 py-0.5 rounded-full"
                  style={{
                    backgroundColor: activeTab === "actions" ? COLORS.forest + "15" : "#F1EFE8",
                    color: activeTab === "actions" ? COLORS.forest : COLORS.navy + "60",
                  }}
                >
                  {actions.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("plans")}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-2 text-[11px] font-semibold transition-all border-b-2 -mb-px",
                  activeTab === "plans" ? "border-b-[#2A5141]" : "border-b-transparent"
                )}
                style={{
                  color: activeTab === "plans" ? COLORS.forest : COLORS.navy + "50",
                }}
              >
                <Layers className="h-3 w-3" />
                Plans
                <span
                  className="text-[9px] font-bold tabular-nums px-1.5 py-0.5 rounded-full"
                  style={{
                    backgroundColor: activeTab === "plans" ? COLORS.forest + "15" : "#F1EFE8",
                    color: activeTab === "plans" ? COLORS.forest : COLORS.navy + "60",
                  }}
                >
                  {plansSuggeres.length}
                </span>
              </button>
            </div>

            {/* Liste compacte avec scroll interne */}
            <div
              className="overflow-y-auto"
              style={{ maxHeight: "180px" }}
            >
              {activeTab === "actions" && (
                <div className="py-1">
                  {actions.length === 0 ? (
                    <p className="text-[11px] italic py-3 px-4 text-center" style={{ color: COLORS.navy + "50" }}>
                      Aucune action suggérée
                    </p>
                  ) : (
                    actions.map((a, idx) => {
                      const isAdded = addedActions[idx];
                      const isBusy = busy === `a-${idx}`;
                      return (
                        <div
                          key={`${a.titre}-${idx}`}
                          className="group flex items-center gap-2 px-3 py-1.5 transition-colors hover:bg-[#FAF9F6]"
                          title={a.description ? `${a.titre} — ${a.description}` : a.titre}
                        >
                          <span
                            className="flex items-center justify-center h-4 w-4 rounded-full flex-shrink-0 text-[9px] font-bold"
                            style={{
                              backgroundColor: isAdded ? COLORS.forest : "#F1EFE8",
                              color: isAdded ? "#FFFFFF" : COLORS.navy + "70",
                            }}
                          >
                            {isAdded ? <Check className="h-2.5 w-2.5" /> : idx + 1}
                          </span>

                          <p
                            className="flex-1 min-w-0 text-[11.5px] font-medium leading-snug truncate"
                            style={{ color: COLORS.navy }}
                          >
                            {a.titre}
                          </p>

                          {isAdded ? (
                            <span
                              className="flex-shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-0.5"
                              style={{ backgroundColor: "#E8F5E9", color: COLORS.forest }}
                            >
                              <Check className="h-2.5 w-2.5" />
                              Ajoutée
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAddAction(a, idx)}
                              disabled={disabled || isBusy}
                              className={cn(
                                "flex-shrink-0 h-6 px-2 rounded-md text-[10px] font-medium flex items-center gap-0.5 border transition-all",
                                disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-[#E8F0EC]"
                              )}
                              style={{ borderColor: COLORS.forest + "40", color: COLORS.forest }}
                            >
                              {isBusy ? (
                                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                              ) : (
                                <>
                                  <Plus className="h-2.5 w-2.5" />
                                  Ajouter
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {activeTab === "plans" && (
                <div className="py-1">
                  {plansSuggeres.length === 0 ? (
                    <p className="text-[11px] italic py-3 px-4 text-center" style={{ color: COLORS.navy + "50" }}>
                      Aucun plan suggéré
                    </p>
                  ) : (
                    plansSuggeres.map((p, idx) => {
                      const isAdded = addedPlans[idx];
                      const isBusy = busy === `p-${idx}`;
                      return (
                        <div
                          key={`${p.nom}-${idx}`}
                          className="group flex items-center gap-2 px-3 py-1.5 transition-colors hover:bg-[#FAF9F6]"
                          title={p.raison ? `${p.nom} — ${p.raison}` : p.nom}
                        >
                          <span
                            className="flex items-center justify-center h-4 w-4 rounded-full flex-shrink-0"
                            style={{
                              backgroundColor: isAdded ? COLORS.forest : COLORS.forest + "15",
                              color: isAdded ? "#FFFFFF" : COLORS.forest,
                            }}
                          >
                            {isAdded ? <Check className="h-2.5 w-2.5" /> : <Layers className="h-2.5 w-2.5" />}
                          </span>

                          <p
                            className="flex-1 min-w-0 text-[11.5px] font-medium leading-snug truncate"
                            style={{ color: COLORS.navy }}
                          >
                            {p.nom}
                          </p>

                          {isAdded ? (
                            <span
                              className="flex-shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-0.5"
                              style={{ backgroundColor: "#E8F5E9", color: COLORS.forest }}
                            >
                              <Check className="h-2.5 w-2.5" />
                              Activé
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAddPlan(p, idx)}
                              disabled={disabled || isBusy}
                              className={cn(
                                "flex-shrink-0 h-6 px-2 rounded-md text-[10px] font-medium flex items-center gap-0.5 border transition-all",
                                disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-[#E8F0EC]"
                              )}
                              style={{ borderColor: COLORS.forest + "40", color: COLORS.forest }}
                            >
                              {isBusy ? (
                                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                              ) : (
                                "Activer"
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {!loading && !error && !hasContent && (
          <p className="text-[11px] italic py-3 px-4 text-center" style={{ color: COLORS.navy + "60" }}>
            Aucune recommandation pour ce contexte.
          </p>
        )}
      </div>
    </div>
  );
};

export default AiCrisisRecommendations;