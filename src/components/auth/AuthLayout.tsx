import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { ShieldCheck, Lock } from "lucide-react";
import { LoginCyberGrid } from "@/components/auth/LoginCyberGrid";

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);
  return reduced;
}

export function AuthLayout({ children, showResiliencePanel = false }: { children: ReactNode; showResiliencePanel?: boolean }) {
  const reducedMotion = useReducedMotion();

  return (
    <div className="auth-shell min-h-screen flex flex-col md:flex-row bg-[#F8F6F2]">
      <aside className={`auth-brand relative isolate order-2 flex flex-col justify-between overflow-hidden px-6 py-6 text-[#F8F6F2] md:order-1 md:w-[45%] md:px-12 md:py-10${showResiliencePanel ? " auth-brand-login" : ""}`}>
        <div className="relative z-10 flex items-center gap-2">
          <ShieldCheck className="h-7 w-7 text-[#8FBFA8]" aria-hidden />
          <span className="font-display text-2xl">Resillia</span>
        </div>
        {showResiliencePanel && <>
          <div className="login-cyber-stage">
            <LoginCyberGrid staticMode={reducedMotion} />
          </div>
          <div className="login-cyber-pillars" aria-label="Piliers de la continuité">
            <span>ANTICIPER</span><span>RÉSISTER</span><span>REBONDIR</span>
          </div>
        </>}
        <div className={`auth-brand-copy relative z-10 w-full py-7 md:py-0${showResiliencePanel ? " auth-brand-login-copy" : " mx-auto max-w-xl"}`}>
          {showResiliencePanel ? <>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D8C28C]">
              RESILLIA · CONTINUITÉ D’ACTIVITÉ
            </p>
            <h1 className="auth-brand-title font-display text-2xl leading-tight md:text-[2.15rem]">
              Votre continuité d’activité commence ici.
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-[#F8F6F2]/75 md:text-base">
              Comprendre les impacts. Décider avec méthode. Reprendre avec confiance.
            </p>
          </> : <>
            <h1 className="font-display text-3xl leading-tight md:text-[2.6rem]">Votre activité continue, même quand tout s’arrête.</h1>
            <p className="mt-4 text-sm text-[#F8F6F2]/75 md:text-base">Un espace dédié au pilotage de la continuité d’activité.</p>
            <p className="mt-6 text-[11px] tracking-wide text-[#F8F6F2]/60 md:text-xs">BIA · Risques · Plans · Exercices · Crise</p>
          </>}
        </div>
        <p className="relative z-10 text-[10px] text-[#F8F6F2]/40">© 2026 Resillia</p>
      </aside>
      <main className="order-1 md:order-2 flex min-h-[72vh] md:min-h-screen flex-1 items-center justify-center px-5 py-9 sm:px-8 md:px-12 lg:px-16">
        <div className="w-full max-w-[460px]">
          {children}
          <p className="mt-8 flex items-center justify-center gap-1.5 text-xs text-[#3B4454]">
            <Lock className="h-3.5 w-3.5" aria-hidden /> Accès réservé aux utilisateurs autorisés
          </p>
        </div>
      </main>
    </div>
  );
}
