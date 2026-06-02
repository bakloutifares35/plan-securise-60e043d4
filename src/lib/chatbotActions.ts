// lib/chatbotActions.ts
import { emptyImpacts, PERIODS, AXIS_LABELS, type ImpactAxis } from "@/data/bia";

// ========== FONCTIONS DE SUGGESTION RTO/RPO (recopiées depuis ton BiaWizard) ==========
const getFirstCriticalPeriod = (impacts: any): { period: any; hours: number; maxScore: number } | null => {
  const candidates: { period: any; hours: number; maxScore: number }[] = [];
  for (const period of PERIODS) {
    const periodData = impacts[period.id];
    if (!periodData) continue;
    let maxScore = 0;
    for (const axis of Object.keys(AXIS_LABELS) as ImpactAxis[]) {
      const score = periodData[axis] || 0;
      if (score > maxScore) maxScore = score;
    }
    if (maxScore >= 3) {
      candidates.push({ period, hours: period.hours, maxScore });
    }
  }
  if (candidates.length === 0) return null;
  return candidates.reduce((min, curr) => (curr.hours < min.hours ? curr : min));
};

const getSuggestedRTOFromImpacts = (impacts: any): number => {
  const criticalPeriod = getFirstCriticalPeriod(impacts);
  if (!criticalPeriod) return 72;
  const hours = criticalPeriod.hours;
  const maxScore = criticalPeriod.maxScore;
  if (maxScore >= 5) {
    if (hours <= 4) return 2;
    if (hours <= 8) return 4;
    if (hours <= 24) return 8;
    if (hours <= 48) return 24;
    if (hours <= 168) return 72;
    return 168;
  }
  if (maxScore >= 4) {
    if (hours <= 4) return 4;
    if (hours <= 8) return 8;
    if (hours <= 24) return 24;
    if (hours <= 48) return 48;
    return 72;
  }
  if (maxScore >= 3) {
    if (hours <= 24) return 24;
    if (hours <= 48) return 48;
    return 72;
  }
  return 72;
};

const getSuggestedRPOFromImpacts = (impacts: any): number => {
  const criticalPeriod = getFirstCriticalPeriod(impacts);
  if (!criticalPeriod) return 12;
  const hours = criticalPeriod.hours;
  const maxScore = criticalPeriod.maxScore;
  if (maxScore >= 5) {
    if (hours <= 4) return 0.5;
    if (hours <= 8) return 1;
    if (hours <= 24) return 2;
    if (hours <= 48) return 4;
    if (hours <= 168) return 12;
    return 24;
  }
  if (maxScore >= 4) {
    if (hours <= 4) return 1;
    if (hours <= 8) return 2;
    if (hours <= 24) return 4;
    return 8;
  }
  if (maxScore >= 3) {
    return 8;
  }
  return 12;
};
// ========== FIN DES FONCTIONS DE SUGGESTION ==========

export const executeAction = async (
  action: string,
  params: any,
  context: any
): Promise<{ success: boolean; message: string }> => {
  const { updateBiaImpacts, globalScore, processes, riskScenarios, updateRisk, currentProcess } = context;

  switch (action) {
    case "fillAllImpacts":
      if (updateBiaImpacts && params.score) {
        const newImpacts = emptyImpacts();
        for (const p of Object.keys(newImpacts)) {
          for (const a of Object.keys(newImpacts[p])) {
            newImpacts[p][a] = params.score;
          }
        }
        updateBiaImpacts(newImpacts);
        return { success: true, message: `Tous les impacts ont été mis à jour avec le score ${params.score}.` };
      }
      return { success: false, message: "Impossible de mettre à jour les impacts." };

    case "checkBiaCoherence":
      const alerts = [];
      if (globalScore >= 3 && !context.hasPca) alerts.push("⚠️ Ce processus critique n'a pas de PCA associé.");
      if (context.rto > context.mtpd) alerts.push(`❌ Le RTO (${context.rto}h) dépasse le MTPD (${context.mtpd}h).`);
      if (context.stale) alerts.push("📅 Le BIA n'a pas été mis à jour depuis plus de 12 mois.");
      if (alerts.length === 0) return { success: true, message: "✅ Aucune incohérence détectée. BIA valide." };
      return { success: true, message: `Alertes :\n${alerts.join("\n")}` };

    case "listHighResidualRisks":
      if (!riskScenarios) return { success: false, message: "Module risques non disponible." };
      const highRisks = riskScenarios.filter((r: any) => (r.residualScore || r.probability * r.impact) >= 12);
      if (highRisks.length === 0) return { success: true, message: "Aucun risque résiduel élevé." };
      return {
        success: true,
        message: `Risques résiduels élevés (score ≥ 12) :\n${highRisks.map((r: any) => `- ${r.name} (${r.residualScore || r.probability * r.impact}/25)`).join("\n")}`
      };

    case "suggestRtoRpo":
      if (!currentProcess || !currentProcess.impacts) {
        return { success: false, message: "Aucun processus actif pour suggérer RTO/RPO." };
      }
      const suggestedRTO = getSuggestedRTOFromImpacts(currentProcess.impacts);
      const suggestedRPO = getSuggestedRPOFromImpacts(currentProcess.impacts);
      return { success: true, message: `RTO suggéré : ${suggestedRTO}h, RPO suggéré : ${suggestedRPO}h. Vous pouvez les appliquer manuellement.` };

    case "showDefinition":
      const definitions: Record<string, string> = {
        RTO: "Le Recovery Time Objective (RTO) est le délai maximal acceptable pour restaurer un processus après une interruption.",
        RPO: "Le Recovery Point Objective (RPO) est la perte de données maximale acceptable, exprimée en durée.",
        MTPD: "Le Maximum Tolerable Period of Disruption (MTPD) est la durée au-delà de laquelle l'organisation ne peut plus survivre.",
        MBCO: "Le Minimum Business Continuity Objective (MBCO) est le niveau de service minimal à maintenir pendant une crise."
      };
      return { success: true, message: definitions[params.term] || "Terme non reconnu." };

    default:
      return { success: false, message: "Action non reconnue." };
  }
};