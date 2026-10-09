import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AuthLoading } from "@/components/auth/ProtectedRoute";
import { hasDismissedOnboarding } from "@/components/auth/onboardingState";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/contexts/RoleContext";

export function OnboardingGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { loading, role, hasActiveMembership, requiresOrganizationSelection } = useRole();
  const location = useLocation();

  if (loading) return <AuthLoading />;
  if (!user || !role || !hasActiveMembership || requiresOrganizationSelection) return <>{children}</>;
  if (hasDismissedOnboarding(user.id)) return <>{children}</>;
  return <Navigate to="/onboarding" replace state={{ from: location.pathname }} />;
}
