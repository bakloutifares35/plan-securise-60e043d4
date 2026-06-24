import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { initialCampaigns, type Process, type Campaign } from "@/data/bia";
import { supabase } from "@/integrations/supabase/client";

type Ctx = {
  processes: Process[];
  setProcesses: (p: Process[]) => void;
  upsertProcess: (p: Process) => Promise<void>;
  deleteProcess: (id: string) => Promise<void>;
  campaigns: Campaign[];
  refreshProcesses: () => Promise<void>;
};

const BiaContext = createContext<Ctx | null>(null);

export const BiaProvider = ({ children }: { children: ReactNode }) => {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [campaigns] = useState<Campaign[]>(initialCampaigns);

  const loadProcesses = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("processus_metier")
        .select("*") // ✅ Récupère TOUS les champs, y compris apps_critiques
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Erreur chargement processus:", error);
        return;
      }

      if (data && data.length > 0) {
        const mapped: Process[] = data.map((row: any) => ({
          id: row.id,
          name: row.name,
          entityId: row.entity_id || "",
          department: row.direction || "",
          owner: row.owner || "",
          description: row.description || "",
          status: row.status === "ACTIF" ? "Actif" : "Inactif",
          impacts: row.impacts || {},
          rto: row.rto_hours || 24,
          rpo: row.rpo_hours || 4,
          mtpd: row.mtpd_hours || 72,
          mbco: row.mbco_percent || 80,
          resources: row.resources || [],
          dependsOn: row.depends_on || [],
          lastUpdated: row.last_bia_date || new Date().toISOString().slice(0, 10),
          // ✅ AJOUT : récupérer les apps critiques
          appsCritiques: row.apps_critiques || []
        }));
        setProcesses(mapped);
      } else {
        setProcesses([]);
      }
    } catch (err) {
      console.error("Erreur chargement:", err);
    }
  };

  useEffect(() => {
    loadProcesses();
  }, []);

  const refreshProcesses = async () => {
    await loadProcesses();
  };

  const upsertProcess = async (p: Process) => {
    const isNew = p.id.startsWith("proc-") || p.id.startsWith("pr_");

    const payload = {
      entity_id: p.entityId || null,
      name: p.name,
      direction: p.department,
      owner: p.owner,
      description: p.description,
      status: "ACTIF",
      impacts: p.impacts || {},
      rto_hours: p.rto,
      rpo_hours: p.rpo,
      mtpd_hours: p.mtpd,
      mbco_percent: p.mbco,
      resources: p.resources || [],
      depends_on: p.dependsOn || [],
      last_bia_date: p.lastUpdated || new Date().toISOString().slice(0, 10),
      // ✅ AJOUT : sauvegarder les apps critiques
      apps_critiques: p.appsCritiques || []
    };

    if (isNew) {
      // INSERT nouveau processus
      const { data, error } = await (supabase as any)
        .from("processus_metier")
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error("Erreur insertion processus:", JSON.stringify(error));
        return;
      }

      if (data) {
        const mapped: Process = {
          id: data.id,
          name: data.name,
          entityId: data.entity_id || "",
          department: data.direction || "",
          owner: data.owner || "",
          description: data.description || "",
          status: "Actif",
          impacts: data.impacts || {},
          rto: data.rto_hours || 24,
          rpo: data.rpo_hours || 4,
          mtpd: data.mtpd_hours || 72,
          mbco: data.mbco_percent || 80,
          resources: data.resources || [],
          dependsOn: data.depends_on || [],
          lastUpdated: data.last_bia_date || new Date().toISOString().slice(0, 10),
          // ✅ AJOUT
          appsCritiques: data.apps_critiques || []
        };

        setProcesses((prev) => [...prev, mapped]);
      }
      return;
    }

    // UPDATE processus existant
    const { data, error } = await (supabase as any)
      .from("processus_metier")
      .update(payload)
      .eq("id", p.id)
      .select()
      .single();

    if (error) {
      console.error("Erreur mise à jour processus:", JSON.stringify(error));
      return;
    }

    if (data) {
      const mapped: Process = {
        id: data.id,
        name: data.name,
        entityId: data.entity_id || "",
        department: data.direction || "",
        owner: data.owner || "",
        description: data.description || "",
        status: "Actif",
        impacts: data.impacts || {},
        rto: data.rto_hours || 24,
        rpo: data.rpo_hours || 4,
        mtpd: data.mtpd_hours || 72,
        mbco: data.mbco_percent || 80,
        resources: data.resources || [],
        dependsOn: data.depends_on || [],
        lastUpdated: data.last_bia_date || new Date().toISOString().slice(0, 10),
        // ✅ AJOUT
        appsCritiques: data.apps_critiques || []
      };

      setProcesses((prev) => {
        const ix = prev.findIndex((x) => x.id === mapped.id);
        if (ix === -1) return [...prev, mapped];
        const next = [...prev];
        next[ix] = mapped;
        return next;
      });
    }
  };

  const deleteProcess = async (id: string) => {
    const { error } = await (supabase as any)
      .from("processus_metier")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Erreur suppression processus:", error);
      return;
    }

    setProcesses((prev) =>
      prev
        .filter((x) => x.id !== id)
        .map((p) => ({
          ...p,
          dependsOn: (p.dependsOn || []).filter((d) => d !== id),
        }))
    );
  };

  return (
    <BiaContext.Provider value={{ 
      processes, 
      setProcesses, 
      upsertProcess, 
      deleteProcess, 
      campaigns,
      refreshProcesses 
    }}>
      {children}
    </BiaContext.Provider>
  );
};

export const useBia = () => {
  const ctx = useContext(BiaContext);
  if (!ctx) throw new Error("useBia must be used within BiaProvider");
  return ctx;
};