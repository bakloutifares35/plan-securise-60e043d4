import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

import {
  initialEvents,
  initialPolicies,
  initialCommittees,
  initialRefs,
  type Entity,
  type CalendarEvent,
  type PolicyVersion,
  type Committee,
} from "@/data/governance";

type Ctx = {
  entities: Entity[];
  setEntities: (e: Entity[]) => void;
  selectedEntityId: string | null;
  setSelectedEntityId: (id: string | null) => void;
  events: CalendarEvent[];
  setEvents: (e: CalendarEvent[]) => void;
  policies: PolicyVersion[];
  setPolicies: (p: PolicyVersion[]) => void;
  committees: Committee[];
  setCommittees: (c: Committee[]) => void;
  refs: typeof initialRefs;
  setRefs: (r: typeof initialRefs) => void;
};

const GovernanceContext = createContext<Ctx | null>(null);

export const GovernanceProvider = ({ children }: { children: ReactNode }) => {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [policies, setPolicies] = useState<PolicyVersion[]>(initialPolicies);
  const [committees, setCommittees] = useState<Committee[]>(initialCommittees);
  const [refs, setRefs] = useState(initialRefs);

  // 🔥 Charger les entités depuis Supabase
  const fetchEntities = async () => {
    const { data, error } = await (supabase as any)
      .from("organisations")
      .select("*");

    if (error) {
      console.error("Erreur chargement organisations:", error);
      return;
    }

    const mappedEntities: Entity[] = data.map((item: any) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      country: item.country_code,
      sector: item.sector,
      parentId: item.parent_id,
      referent: item.pca_referent || "—",
      referentBackup: "—",
      contact: "",
      status: item.status || "ACTIVE",
      pcaStatus: "Non démarré",
      maturity: 20,
    }));

    setEntities(mappedEntities);
  };

  // 🔥 Chargement automatique au démarrage
  useEffect(() => {
    fetchEntities();
  }, []);

  return (
    <GovernanceContext.Provider
      value={{
        entities,
        setEntities,
        selectedEntityId,
        setSelectedEntityId,
        events,
        setEvents,
        policies,
        setPolicies,
        committees,
        setCommittees,
        refs,
        setRefs,
      }}
    >
      {children}
    </GovernanceContext.Provider>
  );
};

export const useGovernance = () => {
  const ctx = useContext(GovernanceContext);

  if (!ctx) {
    throw new Error("useGovernance must be used within GovernanceProvider");
  }

  return ctx;
};