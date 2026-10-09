import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/contexts/RoleContext";
import { Button } from "@/components/ui/button";

export function AuthLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background" role="status" aria-live="polite">
      <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
      <span className="sr-only">Chargement de la session…</span>
    </div>
  );
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const { loading: roleLoading, hasActiveMembership, requiresOrganizationSelection, memberships, selectMembership } = useRole();
  const location = useLocation();
  if (loading) return <AuthLoading />;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roleLoading) return <AuthLoading />;
  if (requiresOrganizationSelection) return <OrganizationSelection memberships={memberships} onSelect={selectMembership} />;
  if (!hasActiveMembership) return <PendingActivation />;
  return <>{children}</>;
}

function OrganizationSelection({ memberships, onSelect }: {
  memberships: Array<{ id: string; role: string; organization_id: string | null; organization_name: string | null }>;
  onSelect: (membershipId: string) => void;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <section className="w-full max-w-md space-y-4 rounded-lg border bg-card p-8">
        <h1 className="text-2xl font-semibold">Sélection d’organisation requise</h1>
        <p className="text-sm text-muted-foreground">Plusieurs memberships sont actives. Choisissez explicitement celle à utiliser. Cette sélection ne constitue pas encore l’isolation des données métier par organisation.</p>
        <div className="space-y-2">
          {memberships.map((membership) => (
            <Button key={membership.id} variant="outline" className="w-full justify-start" onClick={() => onSelect(membership.id)}>
              {membership.organization_name ?? "Aucune organisation assignée — isolation prévue en phase B"} · {membership.role}
            </Button>
          ))}
        </div>
      </section>
    </main>
  );
}

function PendingActivation() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <section className="w-full max-w-md space-y-4 rounded-lg border bg-card p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold">Compte en attente d’activation</h1>
        <p className="text-muted-foreground">Votre compte doit être activé par l’administrateur avant d’accéder à Resillia.</p>
        <Button variant="outline" onClick={async () => { await signOut(); navigate("/login", { replace: true }); }}>
          Se déconnecter
        </Button>
      </section>
    </main>
  );
}
