import { createContext, useContext, useState, ReactNode } from "react";
import {
  initialEntities, initialEvents, initialPolicies, initialCommittees, initialRefs,
  type Entity, type CalendarEvent, type PolicyVersion, type Committee,
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
  const [entities, setEntities] = useState<Entity[]>(initialEntities);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [policies, setPolicies] = useState<PolicyVersion[]>(initialPolicies);
  const [committees, setCommittees] = useState<Committee[]>(initialCommittees);
  const [refs, setRefs] = useState(initialRefs);
  return (
    <GovernanceContext.Provider value={{ entities, setEntities, selectedEntityId, setSelectedEntityId, events, setEvents, policies, setPolicies, committees, setCommittees, refs, setRefs }}>
      {children}
    </GovernanceContext.Provider>
  );
};

export const useGovernance = () => {
  const ctx = useContext(GovernanceContext);
  if (!ctx) throw new Error("useGovernance must be used within GovernanceProvider");
  return ctx;
};
