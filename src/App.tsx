import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RoleProvider, useRole } from "@/contexts/RoleContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AdminUsers from "./pages/AdminUsers";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/ImmersiveOnboarding";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { OnboardingGate } from "@/components/auth/OnboardingGate";
import { ChatbotWidget } from "./components/chatbot/ChatbotWidget";
import { ApplicationShell } from "@/components/layout/ApplicationShell";

const P = () => <ProtectedRoute><OnboardingGate><Index /></OnboardingGate></ProtectedRoute>;
function AuthedChatbot() {
  const { session } = useAuth();
  const { loading, hasActiveMembership } = useRole();
  return session && !loading && hasActiveMembership ? <ChatbotWidget /> : null;
}

function AdminUsersRoute() {
  const { role, loading } = useRole();
  if (loading) return <div className="min-h-screen grid place-items-center">Chargement des permissions…</div>;
  if (role !== "admin_pca") return <main className="min-h-screen grid place-items-center p-6"><section className="max-w-md rounded-lg border bg-card p-6 text-center"><h1 className="text-xl font-semibold">Accès réservé à l’administration</h1><p className="mt-2 text-sm text-muted-foreground">Votre rôle ne permet pas de gérer les utilisateurs.</p></section></main>;
  return <ApplicationShell active="admin-users" onChange={() => undefined}><AdminUsers /></ApplicationShell>;
}

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <RoleProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
                <Route path="/admin/users" element={<ProtectedRoute><OnboardingGate><AdminUsersRoute /></OnboardingGate></ProtectedRoute>} />
                <Route path="/bia" element={<P />} />
                <Route path="/bia/synthese" element={<P />} />
                <Route path="/bia/recovery" element={<P />} />
                <Route path="/tenacia-voice" element={<P />} />
                <Route path="/cmdb" element={<P />} />
                <Route path="/dashboard" element={<P />} />
                <Route path="/governance" element={<P />} />
                <Route path="/risk" element={<P />} />
                <Route path="/plan" element={<P />} />
                <Route path="/benchmark" element={<P />} />
                <Route path="/exercices" element={<P />} />
                <Route path="/ressources" element={<P />} />
                <Route path="/rapports" element={<P />} />
                <Route path="/form" element={<P />} />
                <Route path="/ai" element={<P />} />
                <Route path="/strategies" element={<P />} />
                <Route path="/warroom" element={<P />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              <AuthedChatbot />
            </BrowserRouter>
          </RoleProvider>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
