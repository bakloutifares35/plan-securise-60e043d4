import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, UserPlus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/resillia/client";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_LABELS, type Role } from "@/contexts/RoleContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Membership = {
  id: string;
  user_id: string;
  organization_id: string | null;
  role: Role;
  status: "pending" | "active" | "inactive";
};
type Profile = { user_id: string; email: string | null; status: "pending" | "active" | "suspended"; created_at: string; memberships: Membership[] };
type Draft = { role: Role; organization_id: string; status: Membership["status"] };

const ROLES: Role[] = ["admin_pca", "referent_entite", "auditeur", "lecteur"];

export default function AdminUsers() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string }>>([]);
  const [organizationError, setOrganizationError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [newUserId, setNewUserId] = useState("");
  const [newMembership, setNewMembership] = useState<Record<string, Draft>>({});
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const db = supabase;
    const [profileResult, membershipResult, organizationResult] = await Promise.all([
      db.from("profiles").select("user_id,email,status,created_at").order("created_at", { ascending: false }),
      db.from("organization_members").select("id,user_id,organization_id,role,status"),
      db.from("organisations").select("id,name").order("name"),
    ]);
    if (profileResult.error || membershipResult.error) {
      toast.error(`Chargement impossible : ${profileResult.error?.message ?? membershipResult.error?.message}`);
      setLoading(false);
      return;
    }
    const byUser = new Map<string, Membership[]>();
    (membershipResult.data ?? []).forEach((membership: Membership) => {
      byUser.set(membership.user_id, [...(byUser.get(membership.user_id) ?? []), membership]);
    });
    setProfiles((profileResult.data ?? []).map((profile: Omit<Profile, "memberships">) => ({
      ...profile, memberships: byUser.get(profile.user_id) ?? [],
    })));
    if (organizationResult.error) {
      setOrganizationError(`Liste des organisations indisponible : ${organizationResult.error.message}`);
      setOrganizations([]);
    } else {
      setOrganizationError(null);
      setOrganizations(organizationResult.data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visibleProfiles = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return profiles;
    return profiles.filter((profile) => profile.user_id.toLowerCase().includes(query) || (profile.email ?? "").toLowerCase().includes(query));
  }, [profiles, search]);

  const createPendingProfile = async () => {
    const id = newUserId.trim();
    if (!id || id === user?.id) { toast.error("Saisissez l’UUID d’un autre utilisateur Auth."); return; }
    if (!window.confirm("Créer un profil en attente pour cet UUID Auth ? Aucun rôle ni accès ne sera activé.")) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").insert({ user_id: id, status: "pending" });
    setBusy(false);
    if (error) { toast.error(`Création impossible : ${error.message}`); return; }
    setNewUserId("");
    toast.success("Profil en attente créé.");
    await load();
  };

  const updateProfileStatus = async (profile: Profile) => {
    if (profile.user_id === user?.id) { toast.error("Votre propre profil ne peut pas être modifié ici."); return; }
    const next = profile.status === "active" ? "suspended" : "active";
    if (!window.confirm(`Confirmer le passage du profil à « ${next} » pour ${profile.email ?? profile.user_id} ?`)) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ status: next, updated_at: new Date().toISOString() }).eq("user_id", profile.user_id);
    setBusy(false);
    if (error) { toast.error(`Modification refusée : ${error.message}`); return; }
    toast.success("Statut du profil mis à jour.");
    await load();
  };

  const saveMembership = async (profile: Profile, existing: Membership | null) => {
    if (profile.user_id === user?.id) { toast.error("Votre propre accès ne peut pas être modifié ici."); return; }
    const key = existing?.id ?? profile.user_id;
    const draft = existing ? drafts[key] ?? { role: existing.role, organization_id: existing.organization_id ?? "", status: existing.status }
      : newMembership[profile.user_id] ?? { role: "lecteur" as Role, organization_id: "", status: "pending" as const };
    const organizationId = draft.organization_id.trim() || null;
    if (draft.role !== "admin_pca" && !organizationId) { toast.error("Une organisation est obligatoire pour ce rôle."); return; }
    const action = existing ? "Modifier cette membership" : "Créer cette membership";
    if (!window.confirm(`${action} : ${ROLE_LABELS[draft.role]}, ${organizationId ?? "administrateur global"}, statut ${draft.status} ?`)) return;
    setBusy(true);
    const query = existing
      ? supabase.from("organization_members").update({ role: draft.role, organization_id: organizationId, status: draft.status, updated_at: new Date().toISOString() }).eq("id", existing.id).eq("user_id", profile.user_id)
      : supabase.from("organization_members").insert({ user_id: profile.user_id, role: draft.role, organization_id: organizationId, status: draft.status });
    const { error } = await query;
    setBusy(false);
    if (error) { toast.error(`Modification refusée : ${error.message}`); return; }
    toast.success("Membership mise à jour.");
    await load();
  };

  const changeDraft = (key: string, patch: Partial<Draft>, isNew: boolean) => {
    if (isNew) setNewMembership((current) => ({ ...current, [key]: { ...(current[key] ?? { role: "lecteur", organization_id: "", status: "pending" }), ...patch } }));
    else setDrafts((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
  };

  return (
    <main className="min-h-screen bg-background p-5 md:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div><h1 className="text-3xl font-semibold">Gestion des utilisateurs</h1><p className="mt-1 text-sm text-muted-foreground">Comptes Auth existants, profils et memberships.</p></div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Actualiser</Button>
        </header>

        <section className="rounded-lg border bg-card p-4">
          <h2 className="font-medium">Ajouter un profil en attente</h2>
          <p className="mt-1 text-sm text-muted-foreground">L’utilisateur doit déjà exister dans Supabase Auth. Aucun rôle ou organisation n’est attribué par cette action.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Input className="max-w-xl" value={newUserId} onChange={(event) => setNewUserId(event.target.value)} placeholder="UUID Auth de l’utilisateur" aria-label="UUID Auth" />
            <Button onClick={() => void createPendingProfile()} disabled={busy}><UserPlus className="mr-2 h-4 w-4" />Créer le profil pending</Button>
          </div>
        </section>

        <div className="relative max-w-xl"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher par e-mail ou UUID" aria-label="Rechercher un utilisateur" /></div>
        {organizationError && <p role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{organizationError} Vous pouvez saisir un UUID d’organisation manuellement.</p>}
        <datalist id="organization-options">{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</datalist>
        {loading ? <p role="status">Chargement des utilisateurs…</p> : visibleProfiles.length === 0 ? <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Aucun profil trouvé.</p> : (
          <div className="space-y-4">
            {visibleProfiles.map((profile) => {
              const self = profile.user_id === user?.id;
              return <article key={profile.user_id} className="space-y-4 rounded-lg border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0"><h2 className="break-all font-medium">{profile.email || "E-mail indisponible"}</h2><p className="break-all font-mono text-xs text-muted-foreground">{profile.user_id}</p><p className="mt-1 text-xs">Profil : <strong>{profile.status}</strong>{self && " · Votre compte"}</p></div>
                  <Button variant="outline" disabled={busy || self} onClick={() => void updateProfileStatus(profile)}>{profile.status === "active" ? "Suspendre le profil" : "Activer le profil"}</Button>
                </div>
                {profile.memberships.map((membership) => {
                  const draft = drafts[membership.id] ?? { role: membership.role, organization_id: membership.organization_id ?? "", status: membership.status };
                  return <div key={membership.id} className="grid gap-3 border-t pt-4 md:grid-cols-[1fr_1.4fr_1fr_auto] md:items-end">
                    <div><Label>Rôle</Label><select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.role} disabled={self} onChange={(event) => changeDraft(membership.id, { role: event.target.value as Role }, false)}>{ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></div>
                    <div><Label>Organisation (UUID)</Label><Input className="mt-1" list="organization-options" value={draft.organization_id} disabled={self} onChange={(event) => changeDraft(membership.id, { organization_id: event.target.value }, false)} placeholder={draft.role === "admin_pca" ? "Vide = admin global" : "UUID requis"} /></div>
                    <div><Label>Membership</Label><select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.status} disabled={self} onChange={(event) => changeDraft(membership.id, { status: event.target.value as Draft["status"] }, false)}><option value="pending">En attente</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
                    <Button disabled={busy || self} onClick={() => void saveMembership(profile, membership)}>Enregistrer</Button>
                    <p className="md:col-span-4 text-xs text-muted-foreground">{membership.organization_id ? organizations.find((organization) => organization.id === membership.organization_id)?.name ?? membership.organization_id : "Administrateur global"}</p>
                  </div>;
                })}
                {!self && <div className="grid gap-3 border-t pt-4 md:grid-cols-[1fr_1.4fr_1fr_auto] md:items-end">
                  <div><Label>Nouveau rôle</Label><select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={(newMembership[profile.user_id] ?? { role: "lecteur" }).role} onChange={(event) => changeDraft(profile.user_id, { role: event.target.value as Role }, true)}>{ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></div>
                  <div><Label>Organisation (UUID)</Label><Input className="mt-1" list="organization-options" value={newMembership[profile.user_id]?.organization_id ?? ""} onChange={(event) => changeDraft(profile.user_id, { organization_id: event.target.value }, true)} placeholder="UUID requis sauf admin global" /></div>
                  <div><Label>Statut initial</Label><p className="mt-3 text-sm">En attente (activation manuelle)</p></div>
                  <Button variant="outline" disabled={busy} onClick={() => void saveMembership(profile, null)}>Créer membership</Button>
                </div>}
              </article>;
            })}
          </div>
        )}
        <p className="text-xs text-muted-foreground">Les invitations e-mail ne sont pas gérées depuis le navigateur. Le choix d’organisation ne constitue pas encore une isolation multi-organisation des données métier.</p>
      </div>
    </main>
  );
}
