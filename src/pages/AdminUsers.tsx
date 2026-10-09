import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, UserPlus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/resillia/client";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_LABELS, type Role } from "@/contexts/RoleContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link } from "react-router-dom";

type Membership = {
  id: string;
  user_id: string;
  organization_id: string | null;
  role: Role;
  status: "pending" | "active" | "inactive";
};
type Profile = { user_id: string; email: string | null; status: "pending" | "active" | "suspended"; created_at: string; memberships: Membership[] };
type Draft = { role: Role; status: Membership["status"] };

const ROLES: Role[] = ["admin_pca", "referent_entite", "auditeur", "lecteur"];
const LAST_ADMIN_MESSAGE = "Action impossible : cet utilisateur est le dernier administrateur actif. Créez ou activez un autre administrateur avant de continuer.";

function OrganizationMultiSelect({ organizations, selectedIds, disabled, onChange }: {
  organizations: Array<{ id: string; name: string }>;
  selectedIds: string[];
  disabled: boolean;
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = organizations.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()));
  const selected = organizations.filter((item) => selectedIds.includes(item.id));
  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" disabled={disabled} className="w-full justify-between font-normal">
            {selectedIds.length === 0 ? "Aucune organisation assignée — isolation prévue en phase B" : `${selectedIds.length} organisation(s) sélectionnée(s)`}
            <span aria-hidden>⌄</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(24rem,calc(100vw-2rem))] p-3">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une organisation" aria-label="Rechercher une organisation" className="mb-2" />
          <div className="max-h-60 space-y-1 overflow-y-auto">
            {filtered.map((organization) => (
              <label key={organization.id} className="flex cursor-pointer items-center gap-3 rounded px-2 py-2 text-sm hover:bg-muted">
                <Checkbox checked={selectedIds.includes(organization.id)} disabled={disabled}
                  onCheckedChange={(checked) => onChange(checked ? [...selectedIds, organization.id] : selectedIds.filter((id) => id !== organization.id))} />
                <span className="truncate">{organization.name}</span>
              </label>
            ))}
            {filtered.length === 0 && <p className="px-2 py-4 text-sm text-muted-foreground">Aucune organisation trouvée.</p>}
          </div>
          <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">La sélection reste facultative. Elle ne constitue pas une isolation de sécurité.</p>
        </PopoverContent>
      </Popover>
      <div className="flex flex-wrap gap-2">
        {selected.map((organization) => <Badge key={organization.id} variant="outline" className="gap-1.5">
          {organization.name}
          {!disabled && <button type="button" aria-label={`Retirer ${organization.name}`} onClick={() => onChange(selectedIds.filter((id) => id !== organization.id))}>×</button>}
        </Badge>)}
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string }>>([]);
  const [organizationError, setOrganizationError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [newUserId, setNewUserId] = useState("");
  const [organizationSelections, setOrganizationSelections] = useState<Record<string, string[]>>({});
  const [newRoles, setNewRoles] = useState<Record<string, Role>>({});
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
      const message = `Chargement impossible : ${profileResult.error?.message ?? membershipResult.error?.message}`;
      setLoadError(message);
      toast.error(message);
      setLoading(false);
      return;
    }
    setLoadError(null);
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

  const activeAdminIds = useMemo(() => new Set(profiles.filter((profile) =>
    profile.status === "active" && profile.memberships.some((membership) => membership.role === "admin_pca" && membership.status === "active")
  ).map((profile) => profile.user_id)), [profiles]);
  const isLastActiveAdmin = (profile: Profile) => activeAdminIds.has(profile.user_id) && activeAdminIds.size <= 1;

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
    if (next !== "active" && isLastActiveAdmin(profile)) { toast.error(LAST_ADMIN_MESSAGE); return; }
    if (!window.confirm(`Confirmer le passage du profil à « ${next} » pour ${profile.email ?? profile.user_id} ?`)) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ status: next, updated_at: new Date().toISOString() }).eq("user_id", profile.user_id);
    setBusy(false);
    if (error) { toast.error(`Modification refusée : ${error.message}`); return; }
    toast.success("Statut du profil mis à jour.");
    await load();
  };

  const saveMembership = async (profile: Profile, existing: Membership) => {
    if (profile.user_id === user?.id) { toast.error("Votre propre accès ne peut pas être modifié ici."); return; }
    const draft = drafts[existing.id] ?? { role: existing.role, status: existing.status };
    if (isLastActiveAdmin(profile) && (draft.role !== "admin_pca" || draft.status !== "active")) { toast.error(LAST_ADMIN_MESSAGE); return; }
    if (!window.confirm(`Confirmer la modification de la membership ${existing.organization_id ? organizations.find((item) => item.id === existing.organization_id)?.name ?? "organisation" : "sans organisation"} : ${ROLE_LABELS[draft.role]}, statut ${draft.status} ?`)) return;
    setBusy(true);
    const { error } = await supabase.from("organization_members").update({ role: draft.role, status: draft.status, updated_at: new Date().toISOString() }).eq("id", existing.id).eq("user_id", profile.user_id);
    setBusy(false);
    if (error) { toast.error(`Modification refusée : ${error.message}`); return; }
    toast.success("Membership mise à jour.");
    await load();
  };

  const saveOrganizations = async (profile: Profile) => {
    if (profile.user_id === user?.id) { toast.error("Votre propre accès ne peut pas être modifié ici."); return; }
    if (organizationError) { toast.error("Impossible d'enregistrer : la liste des organisations n'a pas pu être chargée."); return; }
    const selectedIds = organizationSelections[profile.user_id] ?? profile.memberships.filter((membership) => membership.organization_id && membership.status !== "inactive").map((membership) => membership.organization_id as string);
    const role = newRoles[profile.user_id] ?? profile.memberships.find((membership) => membership.status === "active")?.role ?? "lecteur";
    const currentlyActiveAdmin = isLastActiveAdmin(profile);
    const keepsActiveAdmin = role === "admin_pca" && profile.status === "active";
    if (currentlyActiveAdmin && !keepsActiveAdmin) { toast.error(LAST_ADMIN_MESSAGE); return; }
    if (!window.confirm(`Enregistrer le rôle ${ROLE_LABELS[role]} et ${selectedIds.length} organisation(s) ? Les ajouts resteront en attente d'activation. Les retraits désactiveront les memberships sans supprimer l'historique.`)) return;
    setBusy(true);
    const existingOrgMemberships = profile.memberships.filter((membership) => membership.organization_id !== null);
    const selectedSet = new Set(selectedIds);
    const activeAdminForUser = profile.status === "active" && profile.memberships.some((membership) => membership.role === "admin_pca" && membership.status === "active");
    const nextKeepsAdmin = activeAdminForUser && role === "admin_pca" && (selectedIds.length > 0 || profile.memberships.some((membership) => !membership.organization_id && membership.status === "active"));
    if (currentlyActiveAdmin && !nextKeepsAdmin) { setBusy(false); toast.error(LAST_ADMIN_MESSAGE); return; }
    let errorMessage: string | null = null;
    for (const membership of existingOrgMemberships) {
      const shouldBeAssigned = selectedSet.has(membership.organization_id as string);
      if (shouldBeAssigned && (membership.role !== role || membership.status === "inactive")) {
        const { error } = await supabase.from("organization_members").update({ role, status: membership.status === "inactive" ? "pending" : membership.status, updated_at: new Date().toISOString() }).eq("id", membership.id);
        if (error) { errorMessage = error.message; break; }
      } else if (!shouldBeAssigned && membership.status !== "inactive") {
        const { error } = await supabase.from("organization_members").update({ status: "inactive", updated_at: new Date().toISOString() }).eq("id", membership.id);
        if (error) { errorMessage = error.message; break; }
      }
    }
    if (!errorMessage) for (const organizationId of selectedIds.filter((id) => !existingOrgMemberships.some((membership) => membership.organization_id === id))) {
      const { error } = await supabase.from("organization_members").insert({ user_id: profile.user_id, organization_id: organizationId, role, status: "pending" });
      if (error) { errorMessage = error.message; break; }
    }
    const globalMembership = profile.memberships.find((membership) => membership.organization_id === null);
    if (!errorMessage && (role === "admin_pca" || selectedIds.length === 0)) {
      if (globalMembership) {
        if (globalMembership.role !== role || globalMembership.status === "inactive") {
          const { error } = await supabase.from("organization_members").update({ role, status: globalMembership.status === "inactive" ? "pending" : globalMembership.status, updated_at: new Date().toISOString() }).eq("id", globalMembership.id);
          if (error) errorMessage = error.message;
        }
      } else {
        const { error } = await supabase.from("organization_members").insert({ user_id: profile.user_id, organization_id: null, role, status: "pending" });
        if (error) errorMessage = error.message;
      }
    } else if (!errorMessage && globalMembership && globalMembership.status !== "inactive") {
      const { error } = await supabase.from("organization_members").update({ status: "inactive", updated_at: new Date().toISOString() }).eq("id", globalMembership.id);
      if (error) errorMessage = error.message;
    }
    setBusy(false);
    if (errorMessage) { toast.error(`Enregistrement partiel ou refusé : ${errorMessage}. Actualisez pour vérifier l'état.`); await load(); return; }
    toast.success("Organisations et rôle enregistrés. Toute nouvelle membership reste en attente.");
    await load();
  };

  return (
    <div className="w-full min-w-0">
      <div className="mx-auto w-full max-w-6xl min-w-0 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div><h1 className="text-3xl font-semibold">Gestion des utilisateurs</h1><p className="mt-1 text-sm text-muted-foreground">Comptes Auth existants, profils et memberships.</p></div>
          <div className="flex items-center gap-2"><Button asChild variant="ghost"><Link to="/dashboard">Retour à l’application</Link></Button><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Actualiser</Button></div>
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
        {organizationError && <p role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{organizationError}</p>}
        {loadError && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{loadError} <Button variant="link" className="h-auto p-0" onClick={() => void load()}>Réessayer</Button></p>}
        {loading ? <p role="status">Chargement des utilisateurs…</p> : loadError ? null : visibleProfiles.length === 0 ? <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Aucun profil trouvé.</p> : (
          <div className="space-y-4">
            {visibleProfiles.map((profile) => {
              const self = profile.user_id === user?.id;
              const lastAdmin = isLastActiveAdmin(profile);
              const selectedOrganizationIds = organizationSelections[profile.user_id] ?? profile.memberships.filter((membership) => membership.organization_id && membership.status !== "inactive").map((membership) => membership.organization_id as string);
              return <article key={profile.user_id} className="space-y-4 rounded-lg border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0"><h2 className="break-all font-medium">{profile.email || "E-mail indisponible"}</h2><p className="break-all font-mono text-xs text-muted-foreground">{profile.user_id}</p><p className="mt-1 flex items-center gap-2 text-xs">Profil <Badge variant={profile.status === "active" ? "default" : "secondary"}>{profile.status}</Badge>{self && "Votre compte"}</p></div>
                  <Button variant="outline" disabled={busy || self || (lastAdmin && profile.status === "active")} onClick={() => void updateProfileStatus(profile)}>{profile.status === "active" ? "Désactiver le compte" : "Activer le compte"}</Button>
                </div>
                {lastAdmin && <p role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{LAST_ADMIN_MESSAGE}</p>}
                <section className="space-y-3 border-t pt-4">
                  <div><Label>Organisations — facultatif pour le pilote, isolation prévue en phase B</Label><p className="mt-1 text-xs text-muted-foreground">Les organisations ne limitent pas encore l'accès aux données métier. Les nouvelles memberships restent en attente.</p></div>
                  <OrganizationMultiSelect organizations={organizations} selectedIds={selectedOrganizationIds} disabled={busy || self || !!organizationError} onChange={(ids) => setOrganizationSelections((current) => ({ ...current, [profile.user_id]: ids }))} />
                  <div className="flex flex-wrap items-end gap-3"><div className="min-w-52"><Label>Rôle cible</Label><select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={newRoles[profile.user_id] ?? profile.memberships.find((membership) => membership.status === "active")?.role ?? "lecteur"} disabled={self || lastAdmin} onChange={(event) => setNewRoles((current) => ({ ...current, [profile.user_id]: event.target.value as Role }))}>{ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></div><Button variant="outline" disabled={busy || self || !!organizationError} onClick={() => void saveOrganizations(profile)}>Enregistrer les organisations</Button></div>
                  {selectedOrganizationIds.length === 0 && <p className="text-sm text-muted-foreground">Aucune organisation assignée — isolation prévue en phase B</p>}
                </section>
                {profile.memberships.map((membership) => {
                  const draft = drafts[membership.id] ?? { role: membership.role, status: membership.status };
                  const orgName = membership.organization_id ? organizations.find((organization) => organization.id === membership.organization_id)?.name ?? "Organisation inconnue" : "Aucune organisation assignée — isolation prévue en phase B";
                  const wouldRemoveLastAdmin = lastAdmin && (draft.role !== "admin_pca" || draft.status !== "active");
                  return <div key={membership.id} className="grid gap-3 border-t pt-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
                  <div><Label>Organisation</Label><p className="mt-2 text-sm">{orgName}</p><Badge className="mt-2" variant="outline">{ROLE_LABELS[membership.role]}</Badge></div>
                    <div><Label>Rôle</Label><select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.role} disabled={self} onChange={(event) => setDrafts((current) => ({ ...current, [membership.id]: { ...draft, role: event.target.value as Role } }))}>{ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></div>
                    <div><Label>Membership</Label><div className="mb-1 mt-2"><Badge variant={draft.status === "active" ? "default" : "secondary"}>{draft.status}</Badge></div><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.status} disabled={self} onChange={(event) => setDrafts((current) => ({ ...current, [membership.id]: { ...draft, status: event.target.value as Draft["status"] } }))}><option value="pending">En attente</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
                    <Button disabled={busy || self || wouldRemoveLastAdmin} onClick={() => void saveMembership(profile, membership)}>Enregistrer</Button>
                  </div>;
                })}
                {profile.memberships.length === 0 && <p className="text-sm text-muted-foreground">Aucune membership. Une affectation de rôle reste en attente d'activation.</p>}
              </article>;
            })}
          </div>
        )}
        <p className="text-xs text-muted-foreground">Les invitations e-mail ne sont pas gérées depuis le navigateur. Le choix d’organisation ne constitue pas encore une isolation multi-organisation des données métier.</p>
      </div>
    </div>
  );
}
