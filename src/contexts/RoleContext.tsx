import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/resillia/client";
import { useAuth } from "@/contexts/AuthContext";

export type Role = "admin_pca" | "referent_entite" | "auditeur" | "lecteur";
export const ROLE_LABELS: Record<Role, string> = {
  admin_pca: "Administrateur PCA",
  referent_entite: "Référent PCA d'entité",
  auditeur: "Auditeur / Risk Manager",
  lecteur: "Lecteur",
};
export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin_pca: "Accès administrateur PCA",
  referent_entite: "Accès de contribution PCA",
  auditeur: "Lecture seule",
  lecteur: "Lecture seule",
};
type Permission = "read" | "write" | "admin";
const PERMISSIONS: Record<Role, Permission> = {
  admin_pca: "admin",
  referent_entite: "write",
  auditeur: "read",
  lecteur: "read",
};
type Ctx = {
  role: Role | null;
  loading: boolean;
  hasActiveMembership: boolean;
  requiresOrganizationSelection: boolean;
  activeOrganizationId: string | null;
  activeOrganizationName: string | null;
  memberships: Array<{ id: string; role: Role; organization_id: string | null; organization_name: string | null }>;
  selectMembership: (membershipId: string) => void;
  can: (action: Permission) => boolean;
};
const RoleContext = createContext<Ctx | null>(null);

export const RoleProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [profileActive, setProfileActive] = useState(false);
  const [memberships, setMemberships] = useState<Array<{ id: string; role: Role; organization_id: string | null; organization_name: string | null }>>([]);
  const [selectedMembershipId, setSelectedMembershipId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadRole = async () => {
      if (authLoading) return;
      setProfileActive(false);
      setMemberships([]);
      setSelectedMembershipId(null);
      if (!user) { setLoading(false); return; }
      setLoading(true);
      const [{ data: profile, error: profileError }, { data: memberships, error: membershipError }, { data: organizations }] = await Promise.all([
        supabase.from("profiles").select("status").eq("user_id", user.id).maybeSingle(),
        supabase.from("organization_members").select("id, role, status, organization_id").eq("user_id", user.id).eq("status", "active"),
        supabase.from("organisations").select("id, name"),
      ]);
      if (cancelled) return;
      const organizationNames = new Map((organizations ?? []).map((organization) => [organization.id, organization.name]));
      const validMemberships = !membershipError ? (memberships ?? []).filter((item) =>
        Object.prototype.hasOwnProperty.call(PERMISSIONS, item.role)
      ).map((item) => ({
        id: item.id, role: item.role as Role, organization_id: item.organization_id,
        organization_name: item.organization_id ? organizationNames.get(item.organization_id) ?? null : null,
      })) : [];
      setProfileActive(!profileError && profile?.status === "active");
      setMemberships(validMemberships);
      if (validMemberships.length === 1) {
        setSelectedMembershipId(validMemberships[0].id);
      }
      setLoading(false);
    };
    void loadRole();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  const globalAdmin = profileActive && memberships.some((item) => item.role === "admin_pca");
  const selectedMembership = memberships.find((item) => item.id === selectedMembershipId);
  const activeOrganizationId = globalAdmin ? null : selectedMembership?.organization_id ?? null;
  const activeOrganizationName = globalAdmin ? null : selectedMembership?.organization_name ?? null;
  const role = profileActive ? (globalAdmin ? "admin_pca" : selectedMembership?.role ?? null) : null;
  const hasActiveMembership = !!role && (globalAdmin || !!selectedMembership);
  const requiresOrganizationSelection = profileActive && !globalAdmin && memberships.length > 1 && !selectedMembership;

  const can = (action: Permission) => {
    if (!role || !hasActiveMembership) return false;
    const permission = PERMISSIONS[role];
    if (action === "read") return true;
    if (action === "write") return permission === "write" || permission === "admin";
    return permission === "admin";
  };
  return <RoleContext.Provider value={{
    role, loading, hasActiveMembership, requiresOrganizationSelection,
    activeOrganizationId, activeOrganizationName, memberships, selectMembership: setSelectedMembershipId, can,
  }}>{children}</RoleContext.Provider>;
};

export const useRole = () => {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
};
