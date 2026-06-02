// src/config/processusConfig.ts

export interface ProcessusMetier {
  name: string;
  description: string;
  criticality: "Critique" | "Majeur" | "Modéré";
  rto_hours: number;
  rpo_hours: number;
  mtpd_hours: number;
  mbco_percent: number;
}

export const PROCESSUS_PAR_DIRECTION: Record<string, ProcessusMetier[]> = {
  "Direction Générale": [
    {
      name: "Pilotage stratégique et décision",
      description: "Prise de décisions critiques, validation des plans de continuité, communication avec les parties prenantes externes (régulateurs, investisseurs).",
      criticality: "Critique",
      rto_hours: 2,
      rpo_hours: 0.5,
      mtpd_hours: 4,
      mbco_percent: 100
    },
    {
      name: "Communication de crise",
      description: "Gestion de la communication interne et externe, relations presse, messages aux collaborateurs et parties prenantes.",
      criticality: "Critique",
      rto_hours: 1,
      rpo_hours: 0.25,
      mtpd_hours: 2,
      mbco_percent: 100
    },
    {
      name: "Relations institutionnelles",
      description: "Maintien des relations avec les autorités de tutelle, régulateurs financiers et partenaires institutionnels.",
      criticality: "Majeur",
      rto_hours: 24,
      rpo_hours: 4,
      mtpd_hours: 48,
      mbco_percent: 50
    }
  ],

  "Direction Financière": [
    {
      name: "Paie et administration du personnel",
      description: "Calcul et traitement des salaires, déclarations sociales, gestion des absences et notes de frais.",
      criticality: "Critique",
      rto_hours: 4,
      rpo_hours: 1,
      mtpd_hours: 8,
      mbco_percent: 100
    },
    {
      name: "Trésorerie et gestion des flux",
      description: "Gestion des comptes bancaires, prévisions de trésorerie, validation des paiements fournisseurs et recouvrement.",
      criticality: "Critique",
      rto_hours: 2,
      rpo_hours: 0.5,
      mtpd_hours: 4,
      mbco_percent: 100
    },
    {
      name: "Comptabilité générale et réglementaire",
      description: "Tenue des comptes, déclarations fiscales et sociales, production des états financiers.",
      criticality: "Critique",
      rto_hours: 8,
      rpo_hours: 2,
      mtpd_hours: 16,
      mbco_percent: 80
    },
    {
      name: "Facturation clients",
      description: "Émission des factures, suivi des créances, gestion des avoirs et relances clients.",
      criticality: "Majeur",
      rto_hours: 24,
      rpo_hours: 4,
      mtpd_hours: 48,
      mbco_percent: 60
    },
    {
      name: "Gestion budgétaire et reporting financier",
      description: "Élaboration et suivi des budgets, reporting mensuel pour la direction et le conseil d'administration.",
      criticality: "Modéré",
      rto_hours: 72,
      rpo_hours: 24,
      mtpd_hours: 144,
      mbco_percent: 30
    }
  ],

  "Direction Commerciale": [
    {
      name: "Traitement des commandes clients",
      description: "Prise de commandes, validation, création des bons de livraison et suivi d'exécution.",
      criticality: "Critique",
      rto_hours: 4,
      rpo_hours: 1,
      mtpd_hours: 8,
      mbco_percent: 100
    },
    {
      name: "Support client et hotline",
      description: "Gestion des demandes clients, résolution des incidents, traitement des réclamations.",
      criticality: "Majeur",
      rto_hours: 8,
      rpo_hours: 2,
      mtpd_hours: 16,
      mbco_percent: 70
    },
    {
      name: "Gestion des contrats et renouvellements",
      description: "Suivi des contrats clients, relances, avenants et gestion des renouvellements.",
      criticality: "Majeur",
      rto_hours: 24,
      rpo_hours: 4,
      mtpd_hours: 48,
      mbco_percent: 50
    },
    {
      name: "Force de vente et prospection",
      description: "Développement commercial, gestion des opportunités, propositions commerciales.",
      criticality: "Modéré",
      rto_hours: 48,
      rpo_hours: 12,
      mtpd_hours: 96,
      mbco_percent: 30
    },
    {
      name: "Gestion des devis et offres",
      description: "Création et envoi des devis, suivi des validations, transformation en commandes.",
      criticality: "Modéré",
      rto_hours: 48,
      rpo_hours: 8,
      mtpd_hours: 96,
      mbco_percent: 40
    }
  ],

  "Direction IT": [
    {
      name: "Infrastructure réseau et connectivité",
      description: "Maintien du réseau local (LAN/WAN), accès internet, VPN, connectivité inter-sites.",
      criticality: "Critique",
      rto_hours: 2,
      rpo_hours: 0.5,
      mtpd_hours: 4,
      mbco_percent: 100
    },
    {
      name: "Sauvegarde et restauration des données",
      description: "Backup quotidien des données critiques, tests de restauration, politique de rétention.",
      criticality: "Critique",
      rto_hours: 4,
      rpo_hours: 1,
      mtpd_hours: 8,
      mbco_percent: 100
    },
    {
      name: "Support utilisateur (Service Desk)",
      description: "Assistance technique aux utilisateurs, résolution des incidents niveau 1 et 2.",
      criticality: "Majeur",
      rto_hours: 8,
      rpo_hours: 2,
      mtpd_hours: 16,
      mbco_percent: 60
    },
    {
      name: "Gestion des identités et accès (IAM)",
      description: "Création/suppression des comptes, gestion des droits d'accès, authentification MFA.",
      criticality: "Critique",
      rto_hours: 2,
      rpo_hours: 0.25,
      mtpd_hours: 4,
      mbco_percent: 100
    },
    {
      name: "Base de données critiques",
      description: "Maintien des bases de données (SQL, NoSQL), sauvegarde, optimisation et haute disponibilité.",
      criticality: "Critique",
      rto_hours: 4,
      rpo_hours: 1,
      mtpd_hours: 8,
      mbco_percent: 100
    },
    {
      name: "Messagerie et collaboration",
      description: "Accès aux emails, agendas partagés, outils collaboratifs (Teams/Slack), partage de fichiers.",
      criticality: "Majeur",
      rto_hours: 12,
      rpo_hours: 4,
      mtpd_hours: 24,
      mbco_percent: 50
    }
  ],

  "Direction Cyber (Sécurité SI)": [
    {
      name: "Sécurité des accès et authentification",
      description: "Gestion des mots de passe, MFA, SSO, détection des accès suspects.",
      criticality: "Critique",
      rto_hours: 2,
      rpo_hours: 0.25,
      mtpd_hours: 4,
      mbco_percent: 100
    },
    {
      name: "Détection et réponse aux incidents (SOC)",
      description: "Surveillance 24/7, analyse des alertes, qualification des incidents de sécurité.",
      criticality: "Critique",
      rto_hours: 1,
      rpo_hours: 0.25,
      mtpd_hours: 2,
      mbco_percent: 100
    },
    {
      name: "Réponse à incident cyber (IR)",
      description: "Containment, éradication, recovery, analyse forensique et reporting post-incident.",
      criticality: "Critique",
      rto_hours: 2,
      rpo_hours: 0.5,
      mtpd_hours: 4,
      mbco_percent: 100
    },
    {
      name: "Gestion des vulnérabilités (VM)",
      description: "Scanning, priorisation, plan de correction des vulnérabilités identifiées.",
      criticality: "Majeur",
      rto_hours: 24,
      rpo_hours: 4,
      mtpd_hours: 48,
      mbco_percent: 70
    },
    {
      name: "Sensibilisation à la sécurité",
      description: "Campagnes de phishing simulées, formations, ateliers de sensibilisation.",
      criticality: "Modéré",
      rto_hours: 72,
      rpo_hours: 24,
      mtpd_hours: 144,
      mbco_percent: 30
    }
  ],

  "Direction RH": [
    {
      name: "Gestion administrative du personnel",
      description: "Contrats de travail, déclarations DPAE, certificats de travail, suivi des carrières.",
      criticality: "Critique",
      rto_hours: 8,
      rpo_hours: 2,
      mtpd_hours: 16,
      mbco_percent: 80
    },
    {
      name: "Recrutement et onboarding",
      description: "Processus de recrutement, intégration des nouveaux collaborateurs, gestion des offres.",
      criticality: "Modéré",
      rto_hours: 72,
      rpo_hours: 24,
      mtpd_hours: 144,
      mbco_percent: 30
    },
    {
      name: "Formation et développement",
      description: "Plan de formation, évaluations, suivi des compétences, budget formation.",
      criticality: "Modéré",
      rto_hours: 96,
      rpo_hours: 48,
      mtpd_hours: 192,
      mbco_percent: 20
    }
  ],

  "Direction Juridique": [
    {
      name: "Gestion des contrats",
      description: "Rédaction, validation et archivage des contrats clients/fournisseurs.",
      criticality: "Majeur",
      rto_hours: 24,
      rpo_hours: 4,
      mtpd_hours: 48,
      mbco_percent: 60
    },
    {
      name: "Conformité réglementaire",
      description: "Veille juridique, mise à jour des politiques, réponse aux autorités.",
      criticality: "Critique",
      rto_hours: 8,
      rpo_hours: 2,
      mtpd_hours: 16,
      mbco_percent: 90
    },
    {
      name: "Gestion des litiges",
      description: "Suivi des contentieux, relation avocats, constitution des dossiers.",
      criticality: "Majeur",
      rto_hours: 48,
      rpo_hours: 12,
      mtpd_hours: 96,
      mbco_percent: 50
    }
  ]
};

// Mapping des noms approximatifs
export const getProcessusForDirection = (dirName: string): ProcessusMetier[] => {
  const name = dirName.toLowerCase();
  
  if (name.includes("financi") || name.includes("compta") || name.includes("trésorerie"))
    return PROCESSUS_PAR_DIRECTION["Direction Financière"];
  if (name.includes("commercial") || name.includes("vente") || name.includes("client"))
    return PROCESSUS_PAR_DIRECTION["Direction Commerciale"];
  if (name.includes("it") || name.includes("informat") || name.includes("tech") || name.includes("système"))
    return PROCESSUS_PAR_DIRECTION["Direction IT"];
  if (name.includes("cyber") || name.includes("sécurité") || name.includes("secu"))
    return PROCESSUS_PAR_DIRECTION["Direction Cyber (Sécurité SI)"];
  if (name.includes("rh") || name.includes("ressource") || name.includes("personnel"))
    return PROCESSUS_PAR_DIRECTION["Direction RH"];
  if (name.includes("jurid") || name.includes("legal") || name.includes("droit"))
    return PROCESSUS_PAR_DIRECTION["Direction Juridique"];
  if (name.includes("générale") || name.includes("direction générale") || name.includes("dg"))
    return PROCESSUS_PAR_DIRECTION["Direction Générale"];
  
  // Fallback : processus génériques
  return [
    {
      name: "Gestion opérationnelle",
      description: "Gestion quotidienne des activités, coordination des équipes, reporting hiérarchique.",
      criticality: "Majeur",
      rto_hours: 24,
      rpo_hours: 4,
      mtpd_hours: 48,
      mbco_percent: 60
    },
    {
      name: "Planification et reporting",
      description: "Élaboration des plans d'action, suivi des indicateurs, reporting à la direction.",
      criticality: "Modéré",
      rto_hours: 72,
      rpo_hours: 24,
      mtpd_hours: 144,
      mbco_percent: 40
    }
  ];
};