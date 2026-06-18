import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type EbiosValeurMetier = { id: string; nom: string; description: string; impact: number };
export type EbiosBienSupport = { id: string; nom: string; type: string; proprietaire: string };
export type EbiosEvenementRedoute = { id: string; nom: string; severite: number };
export type EbiosMesureSocle = { id: string; libelle: string; applique: boolean };

export type EbiosSourceRisque = { id: string; nom: string; motivation: string; capacite: number };
export type EbiosObjectifVise = { id: string; nom: string; description: string };
export type EbiosCoupleSROV = { id: string; sourceId: string; objectifId: string; pertinence: number };

export type EbiosPartiePrenante = {
  id: string; nom: string; type: string; menace: number; dependance: number; confiance: number;
};
export type EbiosScenarioStrategique = { id: string; nom: string; description: string; severite: number };

export type EbiosKillChainEtape = "Reconnaissance" | "Intrusion" | "Exploitation" | "Exfiltration";
export type EbiosScenarioOperationnel = {
  id: string; nom: string; etape: EbiosKillChainEtape; modeOperatoire: string; vraisemblance: number;
};

export type EbiosStrategieTraitement = "Réduire" | "Transférer" | "Accepter" | "Éviter";
export type EbiosMesureSecurite = {
  id: string; libelle: string; strategie: EbiosStrategieTraitement; risqueResiduel: number;
};

export type EbiosState = {
  atelier1: {
    valeursMetier: EbiosValeurMetier[];
    biensSupports: EbiosBienSupport[];
    evenementsRedoutes: EbiosEvenementRedoute[];
    socle: EbiosMesureSocle[];
    participants: string[];
  };
  atelier2: {
    sources: EbiosSourceRisque[];
    objectifs: EbiosObjectifVise[];
    couples: EbiosCoupleSROV[];
  };
  atelier3: {
    partiesPrenantes: EbiosPartiePrenante[];
    scenarios: EbiosScenarioStrategique[];
  };
  atelier4: {
    scenarios: EbiosScenarioOperationnel[];
  };
  atelier5: {
    mesures: EbiosMesureSecurite[];
  };
  completedSteps: number[];
};

const STORAGE_KEY = "ebios-rm-state-v1";

const defaultState: EbiosState = {
  atelier1: {
    valeursMetier: [],
    biensSupports: [],
    evenementsRedoutes: [],
    socle: [
      { id: "s1", libelle: "Politique de sécurité du SI", applique: true },
      { id: "s2", libelle: "Gestion des identités et des accès", applique: true },
      { id: "s3", libelle: "Sauvegardes et plan de reprise", applique: false },
      { id: "s4", libelle: "Sensibilisation des collaborateurs", applique: false },
    ],
    participants: ["Direction", "Métiers", "RSSI", "DSI"],
  },
  atelier2: { sources: [], objectifs: [], couples: [] },
  atelier3: { partiesPrenantes: [], scenarios: [] },
  atelier4: { scenarios: [] },
  atelier5: { mesures: [] },
  completedSteps: [],
};

type Ctx = {
  state: EbiosState;
  update: <K extends keyof EbiosState>(key: K, value: EbiosState[K]) => void;
  markCompleted: (step: number) => void;
  reset: () => void;
};

const EbiosContext = createContext<Ctx | null>(null);

export const EbiosProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<EbiosState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...defaultState, ...JSON.parse(raw) };
    } catch {}
    return defaultState;
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }, [state]);

  const update: Ctx["update"] = (key, value) =>
    setState((prev) => ({ ...prev, [key]: value }));

  const markCompleted = (step: number) =>
    setState((prev) =>
      prev.completedSteps.includes(step)
        ? prev
        : { ...prev, completedSteps: [...prev.completedSteps, step].sort() }
    );

  const reset = () => setState(defaultState);

  return (
    <EbiosContext.Provider value={{ state, update, markCompleted, reset }}>
      {children}
    </EbiosContext.Provider>
  );
};

export const useEbios = () => {
  const ctx = useContext(EbiosContext);
  if (!ctx) throw new Error("useEbios must be used within EbiosProvider");
  return ctx;
};

export const uid = () => Math.random().toString(36).slice(2, 10);
