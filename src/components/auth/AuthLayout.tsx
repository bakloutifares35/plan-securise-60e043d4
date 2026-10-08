import type { ReactNode } from "react";
import { ShieldCheck, Lock } from "lucide-react";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F8F6F2]">
      <aside className="md:w-1/2 bg-[#172030] text-[#F8F6F2] px-6 py-6 md:p-12 flex flex-col justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-7 w-7 text-[#8FBFA8]" aria-hidden />
          <span className="font-display text-2xl">Resillia</span>
        </div>
        <div className="hidden md:block max-w-md">
          <h1 className="font-display text-4xl leading-tight">
            Construisez une organisation plus résiliente, de l’analyse d’impact à la gestion de crise.
          </h1>
          <p className="mt-6 text-[#F8F6F2]/70">
            BIA, risques, stratégies, plans, exercices et War Room dans un espace sécurisé.
          </p>
        </div>
        <p className="hidden md:block text-xs text-[#F8F6F2]/40">© 2026 Resillia</p>
      </aside>
      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">
          {children}
          <p className="mt-8 flex items-center justify-center gap-1.5 text-xs text-[#3B4454]">
            <Lock className="h-3.5 w-3.5" aria-hidden /> Connexion sécurisée
          </p>
        </div>
      </main>
    </div>
  );
}
