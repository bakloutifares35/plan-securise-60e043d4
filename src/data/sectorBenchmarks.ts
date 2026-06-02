// src/data/sectorBenchmarks.ts
export const sectorBenchmarks: Record<string, Record<string, string>> = {
  "Banque & Finance": {
    "paiement": "Dans le secteur bancaire, 85% des entreprises définissent un RTO inférieur à 4h pour les processus de paiement.",
    "trésorerie": "Le RTO standard pour la trésorerie est de 2h à 4h.",
    "comptabilité": "La comptabilité générale tolère généralement un RTO de 8h à 24h.",
    "default": "Dans le secteur bancaire, les processus critiques ont un RTO médian de 4h."
  },
  "Assurance": {
    "sinistre": "Pour la gestion des sinistres, le RTO typique est de 4h à 8h.",
    "default": "Dans l'assurance, les processus critiques ont un RTO médian de 8h."
  },
  "Industrie": {
    "production": "En industrie, le RTO pour la production est souvent de 24h à 48h.",
    "default": "Dans l'industrie, les processus critiques ont un RTO médian de 24h."
  },
  "Santé": {
    "soins": "Dans le secteur de la santé, le RTO pour les soins critiques est souvent inférieur à 2h.",
    "default": "Dans la santé, les processus critiques ont un RTO médian de 4h."
  },
  "Retail": {
    "paiement": "Dans le retail, le RTO pour les paiements est souvent de 4h.",
    "default": "Dans le retail, les processus critiques ont un RTO médian de 8h."
  }
};

export const getSectorAdvice = (sector: string, processName: string): string => {
  const sectorData = sectorBenchmarks[sector];
  if (!sectorData) return "Aucune donnée sectorielle disponible. Contactez un expert BCM.";
  const lowerProcess = processName.toLowerCase();
  for (const [key, message] of Object.entries(sectorData)) {
    if (lowerProcess.includes(key)) return message;
  }
  return sectorData.default || "Aucune donnée sectorielle spécifique pour ce processus.";
};