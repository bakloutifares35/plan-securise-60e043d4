import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BiaProvider } from "@/contexts/BiaContext";
import { GovernanceProvider } from "@/contexts/GovernanceContext";
import { RiskProvider } from "@/contexts/RiskContext";
import { RoleProvider } from "@/contexts/RoleContext";
import { StrategyProvider } from "@/contexts/StrategyContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import { Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

const P = () => <ProtectedRoute><Index /></ProtectedRoute>;
function AuthedChatbot() { const { session } = useAuth(); return session ? <ChatbotWidget /> : null; }
// 🔥 IMPORT DU CHATBOT WIDGET
import { ChatbotWidget } from "./components/chatbot/ChatbotWidget";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
      <TooltipProvider>
        <GovernanceProvider>
          <BiaProvider>
            <RiskProvider>
                <StrategyProvider>
                  <RoleProvider>
                    <Toaster />
                    <Sonner />
                    <BrowserRouter>
                      <Routes>
                        {/* Route principale */}
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/reset-password" element={<ResetPassword />} />
                        
                        {/* Routes BIA */}
                        <Route path="/bia" element={<P />} />
                        <Route path="/bia/synthese" element={<P />} />
                        <Route path="/bia/recovery" element={<P />} />
                        <Route path="/tenacia-voice" element={<P />} />
                        
                        {/* Route Référentiel des ressources (CMDB) */}
                        <Route path="/cmdb" element={<P />} />
                        
                        {/* TOUTES LES AUTRES ROUTES EXISTANTES */}
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
                        
                        {/* Route Stratégies */}
                        <Route path="/strategies" element={<P />} />
                        
                        {/* ✅ Route War Room (module M6) */}
                        <Route path="/warroom" element={<P />} />
                        
                        {/* 404 */}
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                      
                      {/* 🔥 LE WIDGET EST ICI, VISIBLE SUR TOUTES LES PAGES */}
                      <AuthedChatbot />
                      
                    </BrowserRouter>
                  </RoleProvider>
                </StrategyProvider>
            </RiskProvider>
          </BiaProvider>
        </GovernanceProvider>
      </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;