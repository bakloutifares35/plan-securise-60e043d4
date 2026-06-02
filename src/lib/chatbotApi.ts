// lib/chatbotApi.ts
export const askChatbot = async (
  userMessage: string,
  context: any
): Promise<string> => {
  const prompt = `Tu es un assistant expert en continuité d'activité (BCM), intégré à une plateforme de gestion PCA/BIA.
Contexte actuel de l'application : ${JSON.stringify(context)}.

L'utilisateur dit : "${userMessage}"

Réponds de manière naturelle, professionnelle et utile.
Si l'utilisateur demande une action (ex: "remplis tous les impacts à 4", "liste les risques critiques", "vérifie la cohérence du BIA"),
tu peux retourner un JSON d'action à la fin de ta réponse, sous la forme :
\`\`\`json
{ "action": "nomAction", "params": { ... } }
\`\`\`
Les actions disponibles sont :
- "fillAllImpacts" : params { "score": number }
- "checkBiaCoherence" : pas de params
- "listHighResidualRisks" : pas de params
- "suggestRtoRpo" : pas de params (utilise l'algorithme existant)
- "showDefinition" : params { "term": "RTO" } (termes : RTO, RPO, MTPD, MBCO)

Ne retourne que le JSON si c'est une action, ou un texte clair sinon.`;

  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "mistral",
        prompt,
        stream: false,
        options: { temperature: 0, num_predict: 500 }
      })
    });
    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error("Chatbot API error:", error);
    return "Désolé, le service IA est momentanément indisponible. Veuillez réessayer plus tard.";
  }
};