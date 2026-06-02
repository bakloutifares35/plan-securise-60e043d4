import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BiaProvider } from "@/contexts/BiaContext";
import { GovernanceProvider } from "@/contexts/GovernanceContext";
import { RiskProvider } from "@/contexts/RiskContext";
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
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
                {/* Chatbot flottant disponible sur toutes les pages */}
                <BcmCopilot />
              </BrowserRouter>
            </RiskProvider>
          </BiaProvider>
        </GovernanceProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;