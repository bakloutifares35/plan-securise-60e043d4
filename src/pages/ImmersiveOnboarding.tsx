import { useState, type CSSProperties } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowDown, ArrowLeft, ArrowRight, Check, ClipboardCheck, Crosshair, Activity, Network, Shield, Siren, Target, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { completeOnboarding, skipOnboardingForSession } from "@/components/auth/onboardingState";
import { UserAccountMenu } from "@/components/auth/UserAccountMenu";
import { ResilliaLogo } from "@/components/brand/ResilliaLogo";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_LABELS, type Role, useRole } from "@/contexts/RoleContext";
import "./onboarding-journey.css";

const JOURNEY = [
  {
    key: "bia", eyebrow: "01 · COMPRENDRE", nav: "BIA", title: "Comprendre ce qui est critique",
    description: "La BIA aide à identifier les activités essentielles, leurs impacts et les priorités de continuité.",
    icon: Activity, diagram: "impact",
  },
  {
    key: "risk", eyebrow: "02 · ANTICIPER", nav: "Risques", title: "Anticiper les risques",
    description: "Identifiez, évaluez et priorisez les risques susceptibles d’affecter vos activités.",
    icon: TriangleAlert, diagram: "risks",
  },
  {
    key: "protect", eyebrow: "03 · PROTÉGER", nav: "Plans PCA", title: "Préparer les réponses",
    description: "Transformez vos analyses en stratégies, plans PCA et actions concrètes.",
    icon: Shield, diagram: "protect",
  },
  {
    key: "exercise", eyebrow: "04 · TESTER", nav: "Exercices", title: "Vérifier votre préparation",
    description: "Les exercices permettent de tester les plans et d’identifier les améliorations nécessaires.",
    icon: ClipboardCheck, diagram: "exercise",
  },
  {
    key: "warroom", eyebrow: "05 · PILOTER", nav: "War Room", title: "Garder le contrôle en situation de crise",
    description: "La War Room centralise les décisions, les actions et les communications lorsque chaque minute compte.",
    icon: Siren, diagram: "warroom",
  },
];

const ROLE_ACTION: Record<Role, { label: string; path: string; description: string }> = {
  admin_pca: { label: "Ouvrir l’administration", path: "/admin/users", description: "Consultez les accès et gérez les utilisateurs autorisés." },
  referent_entite: { label: "Explorer mon périmètre", path: "/governance", description: "Retrouvez les espaces de gouvernance et de contribution disponibles pour votre rôle." },
  auditeur: { label: "Consulter les risques", path: "/risk", description: "Accédez à l’analyse des risques disponible dans votre espace." },
  lecteur: { label: "Découvrir le tableau de bord", path: "/dashboard", description: "Consultez les informations de résilience accessibles à votre compte." },
};

function ConceptDiagram({ kind }: { kind: string }) {
  if (kind === "impact") return (
    <div className="journey-diagram journey-impact" role="img" aria-label="Parcours conceptuel : activité, impact et priorité">
      <svg viewBox="0 0 600 190" aria-hidden="true">
        <path className="journey-flow" d="M100 95 H500" />
        <circle className="journey-pulse" cx="100" cy="95" r="8" />
        {[100, 300, 500].map((x, index) => <g key={x} className="journey-node" style={{ "--node-order": index } as CSSProperties}><circle cx={x} cy="95" r="29" /><circle className="journey-node-core" cx={x} cy="95" r="8" /></g>)}
      </svg>
      <div className="journey-diagram-labels"><span>Activité essentielle</span><ArrowRight /><span>Impact</span><ArrowRight /><span>Priorité de continuité</span></div>
    </div>
  );
  if (kind === "risks") return (
    <div className="journey-diagram journey-risks" role="img" aria-label="Réseau conceptuel reliant une activité à des signaux de risque">
      <svg viewBox="0 0 600 230" aria-hidden="true">
        <path className="journey-connector" d="M150 115 320 58 M150 115 350 115 M150 115 320 172 M320 58 480 88 M350 115 480 115 M320 172 480 142" />
        <circle className="journey-node-base" cx="150" cy="115" r="30" />
        {[[320,58],[350,115],[320,172]].map(([x,y], index) => <circle key={index} className="journey-risk-point" cx={x} cy={y} r={index === 1 ? 13 : 10} style={{ "--node-order": index } as CSSProperties} />)}
        {[[480,88],[480,115],[480,142]].map(([x,y], index) => <circle key={index} className="journey-node-end" cx={x} cy={y} r="7" style={{ "--node-order": index + 3 } as CSSProperties} />)}
      </svg>
      <div className="journey-diagram-labels"><span>Activité</span><Network /><span>Menaces · impacts · priorités</span></div>
    </div>
  );
  if (kind === "protect") return (
    <div className="journey-diagram journey-protect" role="img" aria-label="Chaîne conceptuelle du risque à la stratégie puis au plan PCA">
      {[
        { title: "Risque", icon: TriangleAlert, tone: "amber" },
        { title: "Stratégie", icon: Crosshair, tone: "mint" },
        { title: "Plan PCA", icon: ClipboardCheck, tone: "green" },
      ].map(({ title, icon: Icon, tone }, index) => <div className="journey-protect-step" key={title} style={{ "--node-order": index } as CSSProperties}>
        <span className={"journey-icon " + tone}><Icon aria-hidden /></span><strong>{title}</strong>
        {index < 2 && <ArrowRight className="journey-protect-arrow" aria-hidden />}
      </div>)}
    </div>
  );
  if (kind === "exercise") return (
    <div className="journey-diagram journey-exercise" role="img" aria-label="Étapes conceptuelles d’un exercice : scénario, réponse et amélioration">
      <div className="exercise-track"><span className="exercise-track-progress" /></div>
      {[
        { title: "Scénario", icon: Siren, note: "Mettre à l’épreuve" },
        { title: "Réponse", icon: Activity, note: "Observer les actions" },
        { title: "Amélioration", icon: Check, note: "Capitaliser" },
      ].map(({ title, icon: Icon, note }, index) => <div className="exercise-node" key={title} style={{ "--node-order": index } as CSSProperties}>
        <span className="journey-icon"><Icon aria-hidden /></span><strong>{title}</strong><small>{note}</small>
      </div>)}
    </div>
  );
  return (
    <div className="journey-diagram journey-warroom" role="img" aria-label="Frise conceptuelle de crise : décision, action et reprise">
      <svg viewBox="0 0 600 180" aria-hidden="true">
        <path className="journey-flow" d="M74 90 H526" />
        <path className="journey-flow-recovery" d="M74 90 H526" />
        {[90, 300, 510].map((x, index) => <g key={x} className="journey-node" style={{ "--node-order": index } as CSSProperties}><circle cx={x} cy="90" r="24" /><circle className="journey-node-core" cx={x} cy="90" r="7" /></g>)}
      </svg>
      <div className="journey-diagram-labels"><span>Décision</span><ArrowRight /><span>Action coordonnée</span><ArrowRight /><span>Reprise</span></div>
    </div>
  );
}

export default function ImmersiveOnboarding() {
  const [activeStep, setActiveStep] = useState(0);
  const { user } = useAuth();
  const { role } = useRole();
  const navigate = useNavigate();
  const location = useLocation();
  if (!user || !role) return null;

  const action = ROLE_ACTION[role];
  const isFinal = activeStep === JOURNEY.length;
  const finish = () => {
    completeOnboarding(user.id);
    navigate(action.path, { replace: true });
  };
  const skip = () => {
    skipOnboardingForSession(user.id);
    const from = (location.state as { from?: string } | null)?.from;
    navigate(from && from !== "/onboarding" ? from : "/dashboard", { replace: true });
  };

  return (
    <main className="journey-page min-h-screen px-4 py-5 sm:px-7 md:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3"><ResilliaLogo appearance="light" className="h-9 w-[9.5rem]" /><span className="hidden border-l border-[#172030]/15 pl-3 text-xs text-[#3B4454]/65 sm:inline">Le cycle de résilience</span></div>
          <div className="flex items-center gap-1"><Button variant="ghost" onClick={skip} className="min-h-10 px-2 text-xs sm:px-3 sm:text-sm">Passer pour l’instant</Button><UserAccountMenu compact /></div>
        </header>

        <div className="journey-shell mt-6 md:mt-9">
          <nav className="journey-nav" aria-label="Parcours de résilience">
            {JOURNEY.map(({ nav, icon: Icon }, index) => <button key={nav} type="button" onClick={() => setActiveStep(index)} aria-current={activeStep === index ? "step" : undefined} className={"journey-nav-step " + (activeStep === index ? "active " : "") + (activeStep > index ? "complete" : "")}>
              <span className="journey-nav-node">{activeStep > index ? <Check aria-hidden /> : <Icon aria-hidden />}</span><span>{nav}</span>
            </button>)}
            <button type="button" onClick={() => setActiveStep(JOURNEY.length)} aria-current={isFinal ? "step" : undefined} className={"journey-nav-step " + (isFinal ? "active" : "")}>
              <span className="journey-nav-node">{isFinal ? <Check aria-hidden /> : <Target aria-hidden />}</span><span>À vous</span>
            </button>
          </nav>

          <section className="journey-content" aria-live="polite" aria-atomic="true">
            <div className="journey-stage" key={activeStep}>
            {!isFinal ? <>
              {(() => {
                const stage = JOURNEY[activeStep];
                const Icon = stage.icon;
                return <>
                  <div className="journey-copy">
                    <Badge variant="outline" className="border-[#2A5141]/25 text-[#2A5141]">{stage.eyebrow}</Badge>
                    <h1 className="mt-4 font-display text-3xl leading-tight text-[#172030] sm:text-4xl">{stage.title}</h1>
                    <p className="mt-4 max-w-2xl text-base leading-7 text-[#3B4454]">{stage.description}</p>
                    <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#172030]/[.04] px-3 py-2 text-xs font-medium text-[#3B4454]"><Icon className="h-4 w-4 text-[#2A5141]" aria-hidden />{stage.nav}</div>
                  </div>
                  <div className="journey-visual-wrap"><ConceptDiagram kind={stage.diagram} /></div>
                </>;
              })()}
            </> : <div className="journey-final">
              <div className="journey-final-mark"><Check aria-hidden /></div>
              <Badge variant="outline" className="border-[#2A5141]/25 text-[#2A5141]">Votre espace, votre rôle</Badge>
              <h1 className="mt-5 font-display text-3xl leading-tight text-[#172030] sm:text-4xl">Votre résilience se construit étape après étape.</h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-[#3B4454]">Votre accès est défini par votre rôle <strong>{ROLE_LABELS[role]}</strong>. Vous pourrez parcourir les étapes du cycle depuis votre espace.</p>
              <div className="mt-7 rounded-xl border border-[#2A5141]/15 bg-[#2A5141]/[.04] p-5 text-left sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#2A5141]">Prochaine action recommandée</p>
                <p className="mt-2 text-sm leading-6 text-[#3B4454]">{action.description}</p>
              </div>
            </div>}
            </div>

            <footer className="journey-footer">
              <Button variant="ghost" onClick={() => setActiveStep((current) => Math.max(0, current - 1))} disabled={activeStep === 0} className="text-[#3B4454]"><ArrowLeft className="mr-2 h-4 w-4" />Précédent</Button>
              {!isFinal
                ? <Button onClick={() => setActiveStep((current) => Math.min(JOURNEY.length, current + 1))} className="min-h-11 bg-[#2A5141] px-5 text-white hover:bg-[#1f3d31]">Continuer<ArrowRight className="ml-2 h-4 w-4" /></Button>
                : <Button onClick={finish} className="min-h-11 bg-[#2A5141] px-5 text-white hover:bg-[#1f3d31]">{action.label}<ArrowRight className="ml-2 h-4 w-4" /></Button>}
            </footer>
          </section>
        </div>
        <p className="mt-5 flex items-center justify-center gap-2 text-xs text-[#3B4454]/65"><ArrowDown className="h-3.5 w-3.5 md:hidden" aria-hidden />BIA · Risques · Stratégies · Plans PCA · Exercices · War Room</p>
      </div>
    </main>
  );
}
