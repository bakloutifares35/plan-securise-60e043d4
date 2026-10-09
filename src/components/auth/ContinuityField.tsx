import "./continuity-field.css";

// Abstract "continuity field": fine luminous arcs, slow flows, one progressing light point.
// Purely decorative — no data, no figures, no labels.
const MAIN_PATH = "M-20 250 C 90 120, 200 340, 300 210 S 470 90, 540 170";

export function ContinuityField({ staticMode = false }: { staticMode?: boolean }) {
  return (
    <div className={`continuity-field${staticMode ? " cf-static" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 520 360" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="cf-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#7fd8bf" stopOpacity=".22" />
            <stop offset=".45" stopColor="#1f6f68" stopOpacity=".1" />
            <stop offset="1" stopColor="#0b1320" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="cf-mint" x1="0" x2="1">
            <stop offset="0" stopColor="#5fbfa6" stopOpacity="0" />
            <stop offset=".5" stopColor="#9ee6cf" stopOpacity=".85" />
            <stop offset="1" stopColor="#5fbfa6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="cf-petrol" x1="0" x2="1">
            <stop offset="0" stopColor="#2b7a8a" stopOpacity="0" />
            <stop offset=".5" stopColor="#4fa3a8" stopOpacity=".5" />
            <stop offset="1" stopColor="#2b7a8a" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="cf-amber" x1="0" x2="1">
            <stop offset="0" stopColor="#d8b46a" stopOpacity="0" />
            <stop offset=".6" stopColor="#e2c27e" stopOpacity=".55" />
            <stop offset="1" stopColor="#d8b46a" stopOpacity="0" />
          </linearGradient>
          <filter id="cf-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <ellipse className="cf-halo" cx="270" cy="190" rx="230" ry="160" fill="url(#cf-halo)" />

        <g fill="none" strokeLinecap="round">
          <path className="cf-arc cf-a1" d="M-30 300 C 120 180, 300 360, 560 120" stroke="url(#cf-petrol)" strokeWidth=".8" />
          <path className="cf-arc cf-a2" d="M-30 200 C 110 80, 260 280, 560 60" stroke="url(#cf-petrol)" strokeWidth=".6" />
          <path className="cf-arc cf-a3" d="M-30 330 C 150 260, 330 320, 560 250" stroke="url(#cf-petrol)" strokeWidth=".6" />
          <path className="cf-arc cf-a4" d="M60 -20 C 120 140, 360 120, 470 380" stroke="url(#cf-amber)" strokeWidth=".7" />
          <path className="cf-main" d={MAIN_PATH} stroke="url(#cf-mint)" strokeWidth="1.3" />
          <path className="cf-flow" d={MAIN_PATH} stroke="#c9f3e5" strokeWidth="1.6" filter="url(#cf-glow)" />
        </g>

        <circle className="cf-point" r="3.2" fill="#e9fff6" filter="url(#cf-glow)">
          <animateMotion dur="26s" repeatCount="indefinite" path={MAIN_PATH} keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
        </circle>

        <g className="cf-particles" fill="#cdeee2">
          <circle cx="140" cy="110" r="1" />
          <circle cx="390" cy="260" r="1.1" />
          <circle cx="320" cy="80" r=".9" />
        </g>
      </svg>
    </div>
  );
}
