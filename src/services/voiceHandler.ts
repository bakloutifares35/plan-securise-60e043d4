export interface VoiceCommandResult {
  success: boolean;
  message: string;
  actions: Array<{
    type: "setName" | "setOwner" | "setEntity" | "setDescription" | "setRTO" | "setRPO" | "setImpact" | "nextStep" | "answer";
    value: any;
  }>;
  askQuestion?: string;
  expectedAnswer?: string;
}

type DialogState = {
  waitingFor: "name" | "owner" | "entity" | "description" | "impact" | "rto" | "rpo" | "nextStepConfirm" | null;
  step: number;
};

let dialogState: DialogState = { waitingFor: null, step: 0 };

export const resetDialog = () => {
  dialogState = { waitingFor: null, step: 0 };
};

export const processVoiceCommand = (text: string, currentStep: number = 0): VoiceCommandResult => {
  const lower = text.toLowerCase();
  const actions: VoiceCommandResult["actions"] = [];
  const feedback: string[] = [];

  console.log("🔍 Commande reçue:", text);
  console.log("📌 État du dialogue:", dialogState);

  // ========== MODE GUIDÉ : on attend une réponse spécifique ==========
  if (dialogState.waitingFor) {
    const answer = text.trim();
    switch (dialogState.waitingFor) {
      case "name":
        actions.push({ type: "setName", value: answer });
        feedback.push(`📋 Nom du processus: "${answer}"`);
        dialogState.waitingFor = "owner";
        return {
          success: true,
          message: `✅ Nom enregistré. Quel est le responsable ?`,
          actions,
          askQuestion: "Quel est le responsable ?",
          expectedAnswer: "owner"
        };
      case "owner":
        actions.push({ type: "setOwner", value: answer });
        feedback.push(`👤 Responsable: "${answer}"`);
        dialogState.waitingFor = "entity";
        return {
          success: true,
          message: `✅ Responsable enregistré. Quelle est l'entité (département) ?`,
          actions,
          askQuestion: "Quelle est l'entité (département) ?",
          expectedAnswer: "entity"
        };
      case "entity":
        actions.push({ type: "setEntity", value: answer });
        feedback.push(`🏢 Entité: "${answer}"`);
        dialogState.waitingFor = "description";
        return {
          success: true,
          message: `✅ Entité enregistrée. Donnez une description du processus.`,
          actions,
          askQuestion: "Donnez une description du processus.",
          expectedAnswer: "description"
        };
      case "description":
        actions.push({ type: "setDescription", value: answer });
        feedback.push(`📝 Description: "${answer}"`);
        dialogState.waitingFor = "nextStepConfirm";
        return {
          success: true,
          message: `✅ Description enregistrée. On passe à l'étape suivante (impact métier) ? Dites "oui" ou "non".`,
          actions,
          askQuestion: "On passe à l'étape suivante ?",
          expectedAnswer: "nextStepConfirm"
        };
      case "nextStepConfirm":
        if (lower.includes("oui") || lower.includes("yes") || lower.includes("ok") || lower.includes("passe")) {
          actions.push({ type: "nextStep", value: true });
          feedback.push(`⏩ Passage à l'étape suivante`);
          dialogState.waitingFor = null;
          return {
            success: true,
            message: `✅ On passe à l'étape suivante.`,
            actions,
            askQuestion: null
          };
        } else {
          dialogState.waitingFor = null;
          return {
            success: true,
            message: `❌ Je n'ai pas compris. On reste sur cette étape.`,
            actions: [],
            askQuestion: null
          };
        }
      case "impact":
        const score = parseInt(answer);
        if (!isNaN(score) && score >= 1 && score <= 5) {
          actions.push({ type: "setImpact", value: score });
          feedback.push(`🎯 Score: ${score}/5`);
          dialogState.waitingFor = "nextStepConfirm2";
          return {
            success: true,
            message: `✅ Score ${score}/5 enregistré. On passe à l'étape suivante (RTO/RPO) ? Dites "oui" ou "non".`,
            actions,
            askQuestion: "On passe à l'étape suivante ?",
            expectedAnswer: "nextStepConfirm2"
          };
        }
        break;
      case "nextStepConfirm2":
        if (lower.includes("oui") || lower.includes("yes") || lower.includes("ok") || lower.includes("passe")) {
          actions.push({ type: "nextStep", value: true });
          feedback.push(`⏩ Passage à l'étape suivante`);
          dialogState.waitingFor = "rto";
          return {
            success: true,
            message: `✅ On passe à l'étape RTO/RPO. Quel est le RTO en heures ?`,
            actions,
            askQuestion: "Quel est le RTO en heures ?",
            expectedAnswer: "rto"
          };
        }
        break;
      case "rto":
        const rto = parseInt(answer);
        if (!isNaN(rto) && rto > 0) {
          actions.push({ type: "setRTO", value: rto });
          feedback.push(`⏱️ RTO: ${rto} heures`);
          dialogState.waitingFor = "rpo";
          return {
            success: true,
            message: `✅ RTO ${rto}h enregistré. Quel est le RPO en heures ?`,
            actions,
            askQuestion: "Quel est le RPO en heures ?",
            expectedAnswer: "rpo"
          };
        }
        break;
      case "rpo":
        const rpo = parseInt(answer);
        if (!isNaN(rpo) && rpo > 0) {
          actions.push({ type: "setRPO", value: rpo });
          feedback.push(`💾 RPO: ${rpo} heures`);
          dialogState.waitingFor = "nextStepConfirm3";
          return {
            success: true,
            message: `✅ RPO ${rpo}h enregistré. On passe à l'étape suivante (Ressources) ? Dites "oui" ou "non".`,
            actions,
            askQuestion: "On passe à l'étape suivante ?",
            expectedAnswer: "nextStepConfirm3"
          };
        }
        break;
      case "nextStepConfirm3":
        if (lower.includes("oui") || lower.includes("yes") || lower.includes("ok") || lower.includes("passe")) {
          actions.push({ type: "nextStep", value: true });
          feedback.push(`⏩ Passage à l'étape suivante`);
          dialogState.waitingFor = null;
          return {
            success: true,
            message: `✅ On passe à l'étape Ressources.`,
            actions,
            askQuestion: null
          };
        }
        break;
    }
    dialogState.waitingFor = null;
    return {
      success: false,
      message: "❌ Je n'ai pas compris votre réponse. Recommençons.",
      actions: []
    };
  }

  // ========== COMMANDES LIBRES (hors mode guidé) ==========
  
  // Commande "démarrer" ou "nouveau processus"
  if (lower.includes("démarrer") || lower.includes("commencer") || lower.includes("nouveau processus")) {
    dialogState.waitingFor = "name";
    return {
      success: true,
      message: "🎤 Je vais vous guider. Quel est le nom du processus ?",
      actions: [],
      askQuestion: "Quel est le nom du processus ?",
      expectedAnswer: "name"
    };
  }

  // Commande "arrêter" ou "reset"
  if (lower.includes("arrêter") || lower.includes("stop") || lower.includes("reset")) {
    resetDialog();
    return {
      success: true,
      message: "🛑 Assistant arrêté. Dites 'démarrer' pour recommencer.",
      actions: []
    };
  }

  // Commande "aide"
  if (lower.includes("aide") || lower.includes("help")) {
    return {
      success: true,
      message: "📢 Commandes: 'démarrer' pour l'assistant guidé, 'processus X', 'responsable Y', 'score 4', 'suivant'",
      actions: []
    };
  }

  // Commandes simples (si pas en mode guidé)
  const nameMatch = text.match(/processus\s+["']?(.+?)["']?/i);
  if (nameMatch) {
    actions.push({ type: "setName", value: nameMatch[1].trim() });
    feedback.push(`📋 Nom: "${nameMatch[1].trim()}"`);
  }

  const ownerMatch = text.match(/responsable\s+["']?(.+?)["']?/i);
  if (ownerMatch) {
    actions.push({ type: "setOwner", value: ownerMatch[1].trim() });
    feedback.push(`👤 Responsable: "${ownerMatch[1].trim()}"`);
  }

  const entityMatch = text.match(/entité\s+["']?(.+?)["']?/i);
  if (entityMatch) {
    actions.push({ type: "setEntity", value: entityMatch[1].trim() });
    feedback.push(`🏢 Entité: "${entityMatch[1].trim()}"`);
  }

  const descMatch = text.match(/description\s+["']?(.+?)["']?/i);
  if (descMatch) {
    actions.push({ type: "setDescription", value: descMatch[1].trim() });
    feedback.push(`📝 Description: "${descMatch[1].trim()}"`);
  }

  const rtoMatch = text.match(/(?:rto\s*:?\s*)?(\d+)\s*(?:h|heures?)/i);
  if (rtoMatch) {
    actions.push({ type: "setRTO", value: parseFloat(rtoMatch[1]) });
    feedback.push(`⏱️ RTO: ${rtoMatch[1]} heures`);
  }

  const rpoMatch = text.match(/(?:rpo\s*:?\s*)?(\d+)\s*(?:h|heures?)/i);
  if (rpoMatch) {
    actions.push({ type: "setRPO", value: parseFloat(rpoMatch[1]) });
    feedback.push(`💾 RPO: ${rpoMatch[1]} heures`);
  }

  const scoreMatch = text.match(/(?:score|impact)\s*:?\s*(\d+)/i);
  if (scoreMatch) {
    const score = parseInt(scoreMatch[1]);
    if (score >= 1 && score <= 5) {
      actions.push({ type: "setImpact", value: score });
      feedback.push(`🎯 Score: ${score}/5`);
    }
  }

  if (lower.includes("suivant") || lower.includes("étape suivante")) {
    actions.push({ type: "nextStep", value: true });
    feedback.push(`⏩ Étape suivante`);
  }

  if (actions.length === 0) {
    return {
      success: false,
      message: "❌ Commande non reconnue. Dites 'aide' ou 'démarrer'.",
      actions: []
    };
  }

  return {
    success: true,
    message: `✅ ${feedback.join(" · ")}`,
    actions
  };
};