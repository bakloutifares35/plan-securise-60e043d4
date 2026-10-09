import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, ClipboardCheck, Shield, Target, TriangleAlert, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ResilienceShield } from "@/components/auth/ResilienceShield";
import { ResilliaLogo } from "@/components/brand/ResilliaLogo";
import { completeOnboarding, skipOnboardingForSession } from "@/components/auth/onboardingState";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_LABELS, type Role, useRole } from "@/contexts/RoleContext";

const ROLE_COPY: Record<Role, string> = {
  admin_pca: "Vous pilotez l’administration et la gouvernance de Resillia.",
  referent_entite: "Vous contribuez à la continuité de votre périmètre.",
  auditeur: "Vous analysez les risques, les contrôles et les plans.",
  lecteur: "Vous consultez les informations de résilience disponibles.",
};

const MODULES = [
  { title: "BIA", text: "Comprendre les impacts d’une interruption.", icon: Target },
  { title: "Risques", text: "Identifier et prioriser les menaces.", icon: TriangleAlert },
  { title: "Stratégies et plans", text: "Préparer les réponses et la continuité.", icon: ClipboardCheck },
  { title: "Exercices", text: "Tester la capacité de réaction.", icon: Users },
  { title: "War Room", text: "Piloter les actions pendant une crise.", icon: Shield },
];

const STEPS = ["Bienvenue", "Votre espace", "Votre rôle", "Prochaine action"];

function recommendation(role: Role): { label: string; path: string; description: string } {
  switch (role) {
    case "admin_pca": return { label: "Administrer les utilisateurs", path: "/admin/users", description: "Vérifiez les comptes en attente et attribuez les accès nécessaires." };
    case "referent_entite": return { label: "Commencer une analyse", path: "/form", description: "Ouvrez l’identification des risques pour démarrer votre contribution." };
    case "auditeur": return { label: "Consulter les risques", path: "/risk", description: "Explorez les risques et les informations disponibles dans votre espace." };
    case "lecteur": return { label: "Ouvrir le tableau de bord", path: "/dashboard", description: "Prenez connaissance des informations de résilience disponibles." };
  }
}

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const { user } = useAuth();
  const { role } = useRole();
  const navigate = useNavigate();
  const location = useLocation();
  if (!user || !role) return null;
  const nextAction = recommendation(role);

  const finish = (path = "/dashboard") => {
    completeOnboarding(user.id);
    const from = (location.state as { from?: string } | null)?.from;
    navigate(path === "/dashboard" && from && from !== "/onboarding" ? from : path, { replace: true });
  };
  const skip = () => {
    skipOnboardingForSession(user.id);
    const from = (location.state as { from?: string } | null)?.from;
    navigate(from && from !== "/onboarding" ? from : "/dashboard", { replace: true });
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,_rgba(143,191,168,0.16),_transparent_42%),linear-gradient(180deg,#F8F6F2,#F2F0EA)] px-4 py-6 sm:px-8 md:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between gap-4">
          <ResilliaLogo appearance="light" className="h-9 w-[9.5rem]" />
          <Button variant="ghost" onClick={skip} className="text-sm">Passer pour l’instant</Button>
        </header>

        <div className="mt-8 grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
          <nav aria-label="Étapes de découverte" className="grid grid-cols-4 gap-2 lg:grid-cols-1 lg:gap-3">
            {STEPS.map((label, index) => <div key={label} className={`flex min-w-0 items-center gap-2 rounded-lg px-2 py-3 text-xs sm:text-sm lg:px-3 ${index === step ? "bg-white text-[#172030] shadow-sm" : "text-[#3B4454]/65"}`} aria-current={index === step ? "step" : undefined}>
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${index < step ? "bg-[#2A5141] text-white" : index === step ? "bg-[#172030] text-white" : "bg-[#172030]/5"}`}>{index < step ? <Check className="h-3.5 w-3.5" /> : index + 1}</span>
              <span className="hidden sm:inline lg:inline">{label}</span>
            </div>)}
          </nav>

          <section className="min-h-[34rem] rounded-2xl border border-[#172030]/10 bg-white/90 p-5 shadow-[0_18px_60px_-40px_rgba(23,32,48,0.38)] sm:p-8 md:p-10" aria-live="polite">
            {step === 0 && <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
              <ResilienceShield staticMode />
              <Badge variant="outline" className="mb-4 border-[#2A5141]/25 text-[#2A5141]">Votre espace de résilience</Badge>
              <h1 className="font-display text-3xl text-[#172030] sm:text-4xl">Bienvenue dans Resillia</h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-[#3B4454]">Un espace unique pour comprendre vos impacts, anticiper vos risques et piloter la continuité de vos activités.</p>
            </div>}

            {step === 1 && <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#2A5141]">Votre espace de résilience</p>
              <h1 className="mt-2 font-display text-3xl text-[#172030]">Les repères essentiels</h1>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {MODULES.map(({ title, text, icon: Icon }) => <article key={title} className="flex gap-4 rounded-xl border border-[#172030]/10 bg-[#F8F6F2]/55 p-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#2A5141]/10 text-[#2A5141]"><Icon className="h-5 w-5" /></span>
                  <div><h2 className="font-sans text-sm font-semibold text-[#172030]">{title}</h2><p className="mt-1 text-sm leading-5 text-[#3B4454]">{text}</p></div>
                </article>)}
              </div>
            </div>}

            {step === 2 && <div className="mx-auto max-w-2xl pt-8">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#2A5141]">Un accès adapté à votre mission</p>
              <h1 className="mt-2 font-display text-3xl text-[#172030]">Votre rôle dans Resillia</h1>
              <div className="mt-8 rounded-xl border border-[#2A5141]/20 bg-[#2A5141]/5 p-6">
                <Badge className="bg-[#2A5141] text-white hover:bg-[#2A5141]">{ROLE_LABELS[role]}</Badge>
                <p className="mt-4 text-lg leading-7 text-[#172030]">{ROLE_COPY[role]}</p>
              </div>
              <p className="mt-4 text-sm leading-6 text-[#3B4454]">Cet aperçu présente votre rôle actuel. Vos droits restent définis par votre compte et vos memberships actifs.</p>
            </div>}

            {step === 3 && <div className="mx-auto max-w-2xl pt-8">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#2A5141]">Pour commencer</p>
              <h1 className="mt-2 font-display text-3xl text-[#172030]">Votre prochaine action</h1>
              <div className="mt-8 rounded-xl border border-[#172030]/10 bg-[linear-gradient(135deg,rgba(143,191,168,0.15),rgba(248,246,242,0.85))] p-6 sm:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#2A5141]">Recommandation selon votre rôle</p>
                <h2 className="mt-3 font-display text-2xl text-[#172030]">{nextAction.label}</h2>
                <p className="mt-2 leading-6 text-[#3B4454]">{nextAction.description}</p>
              </div>
              <p className="mt-5 text-sm text-[#3B4454]/80">Vous pourrez retrouver les modules depuis la navigation principale.</p>
            </div>}

            <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[#172030]/10 pt-5">
              <Button variant="ghost" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0} className="text-[#3B4454]"><ArrowLeft className="mr-2 h-4 w-4" />Précédent</Button>
              {step < STEPS.length - 1
                ? <Button onClick={() => setStep((current) => Math.min(STEPS.length - 1, current + 1))} className="bg-[#2A5141] text-white hover:bg-[#1f3d31]">{step === 0 ? "Commencer" : "Continuer"}<ArrowRight className="ml-2 h-4 w-4" /></Button>
                : <Button onClick={() => finish(nextAction.path)} className="bg-[#2A5141] text-white hover:bg-[#1f3d31]">Terminer · {nextAction.label}<ArrowRight className="ml-2 h-4 w-4" /></Button>}
            </footer>
          </section>
        </div>
      </div>
    </main>
  );
}
