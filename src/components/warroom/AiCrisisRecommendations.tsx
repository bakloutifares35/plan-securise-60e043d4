// src/components/warroom/AiCrisisRecommendations.tsx
import { useMemo } from "react";
import type { Severite } from "./warroomHelpers";

// ============================================================
// TYPES PARTAGÉS
// ============================================================
export type AiProcessContext = {
  id?: string;
  nom?: string;
  libelle?: string;
  titre?: string;
};

export type SuggestedAction = {
  description: string;
  priorite?: "Critique" | "Haute" | "Normale" | null;
};

export type SuggestedPlan = {
  plan_id?: string | null;
  libelle?: string | null;
  raison?: string | null;
};

export type AiSuggestions = {
  actions: SuggestedAction[];
  plans: SuggestedPlan[];
};

// ============================================================
// HOOK PUR — génère les suggestions IA (aucun JSX)
// Utilisé directement par WarRoomView pour alimenter
// les onglets "Suggestions IA" des blocs Actions et Plans.
// ============================================================
export const useAiSuggestions = ({
  incidentId,
  typeIncident,
  severite,
  titre,
  description,
  processus,
  plans,
}: {
  incidentId: string;
  typeIncident: string | null;
  severite: Severite;
  titre: string;
  description: string | null;
  processus: AiProcessContext[];
  plans: { id: string; titre: string }[];
}): AiSuggestions => {
  // Le hook ne fait AUCUN appel réseau pour l'instant — la logique
  // de génération est entièrement locale et déterministe.
  // Remplacer le contenu ci-dessous par un appel serveur plus tard
  // ne changera pas la signature ni le contrat de retour.
  return useMemo<AiSuggestions>(() => {
    const actions: SuggestedAction[] = [
      {
        description: `Évaluer l'étendue de l'incident${
          typeIncident ? ` de type « ${typeIncident} »` : ""
        } et sécuriser les actifs concernés`,
        priorite: severite === "P1" ? "Critique" : "Haute",
      },
      {
        description:
          "Informer la cellule de crise et déclencher une première réunion de coordination sous 30 minutes",
        priorite: "Haute",
      },
      {
        description:
          "Vérifier l'impact sur les processus métier critiques et identifier les contournements possibles",
        priorite: "Normale",
      },
      {
        description:
          "Préparer un premier point de situation à destination de la direction",
        priorite: "Normale",
      },
    ];

    const suggestedPlans: SuggestedPlan[] = plans.slice(0, 3).map((p) => ({
      plan_id: p.id,
      libelle: p.titre,
      raison: "Plan cohérent avec le périmètre impacté",
    }));

    return { actions, plans: suggestedPlans };
  }, [incidentId, typeIncident, severite, titre, description, processus, plans]);
};

// ============================================================
// COMPOSANT LEGACY — conservé pour compatibilité d'import
// (n'est plus utilisé dans WarRoomView mais peut rester
// importé ailleurs dans l'app).
// Affiche simplement un résumé minimal des suggestions.
// ============================================================
export const AiCrisisRecommendations = (props: {
  incidentId: string;
  typeIncident: string | null;
  severite: Severite;
  titre: string;
  description: string | null;
  processus: AiProcessContext[];
  plans: { id: string; titre: string }[];
  disabled: boolean;
  onAddAction: (p: Partial<any>) => Promise<boolean>;
  onAddPlan: (p: { plan_id?: string | null; libelle?: string | null }) => Promise<boolean>;
}) => {
  const { actions, plans } = useAiSuggestions(props);
  return (
    <div className="text-[11.5px]" style={{ color: "#172030" }}>
      <p className="font-semibold">
        Copilote IA — {actions.length} action{actions.length > 1 ? "s" : ""} suggérée
        {actions.length > 1 ? "s" : ""}, {plans.length} plan{plans.length > 1 ? "s" : ""} suggéré
        {plans.length > 1 ? "s" : ""}
      </p>
      <p className="text-[10px] mt-0.5" style={{ color: "#17203080" }}>
        Les suggestions sont désormais consommées directement dans les blocs Actions et Plans de la War Room.
      </p>
    </div>
  );
};

export default AiCrisisRecommendations;