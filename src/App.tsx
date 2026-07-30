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
import { BcmCopilot } from "./components/chatbot/BcmCopilot";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
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
                        <Route path="/" element={<Index />} />
                        
                        {/* Routes BIA */}
                        <Route path="/bia" element={<Index />} />
                        <Route path="/bia/synthese" element={<Index />} />
                        <Route path="/bia/recovery" element={<Index />} />
                        <Route path="/tenacia-voice" element={<Index />} />
                        
                        {/* Route Référentiel des ressources (CMDB) */}
                        <Route path="/cmdb" element={<Index />} />
                        
                        {/* TOUTES LES AUTRES ROUTES EXISTANTES */}
                        <Route path="/dashboard" element={<Index />} />
                        <Route path="/governance" element={<Index />} />
                        <Route path="/risk" element={<Index />} />
                        <Route path="/plan" element={<Index />} />
                        <Route path="/benchmark" element={<Index />} />
                        <Route path="/exercices" element={<Index />} />
                        <Route path="/ressources" element={<Index />} />
                        <Route path="/rapports" element={<Index />} />
                        <Route path="/scenarios" element={<Index />} />
                        <Route path="/form" element={<Index />} />
                        <Route path="/ai" element={<Index />} />
                        
                        {/* 404 */}
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                      <BcmCopilot />
                    </BrowserRouter>
                  </RoleProvider>
                </StrategyProvider>
            </RiskProvider>
          </BiaProvider>
        </GovernanceProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;