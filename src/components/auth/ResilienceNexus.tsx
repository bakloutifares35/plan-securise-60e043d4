import "./resilience-nexus.css";

const DUST = [
  [74, 88, 1.1, 0.24], [142, 202, 0.9, 0.31], [212, 76, 1.2, 0.2],
  [294, 151, 0.8, 0.29], [352, 80, 1, 0.2], [461, 124, 1.1, 0.24],
  [548, 73, 0.8, 0.28], [638, 167, 1.2, 0.2], [721, 96, 0.9, 0.23],
  [94, 301, 0.8, 0.22], [180, 282, 1.1, 0.18], [257, 250, 0.8, 0.22],
  [605, 286, 0.9, 0.2], [694, 322, 1.2, 0.18], [753, 255, 0.8, 0.26],
  [122, 468, 1.1, 0.18], [214, 541, 0.8, 0.23], [306, 492, 1.1, 0.18],
  [557, 506, 0.9, 0.2], [657, 451, 1.2, 0.18], [742, 541, 0.8, 0.22],
  [70, 626, 0.9, 0.19], [171, 689, 1.1, 0.2], [282, 641, 0.8, 0.22],
  [493, 667, 0.9, 0.19], [602, 620, 1.1, 0.18], [715, 696, 0.8, 0.21],
] as const;

export function ResilienceNexus({ staticMode = false }: { staticMode?: boolean }) {
  return (
    <div className={`nexus-scene${staticMode ? " nexus-static" : ""}`} aria-hidden="true">
      <svg className="nexus-art" viewBox="0 0 820 760" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="nexus-vignette">
            <stop offset="0" stopColor="#183a3c" stopOpacity=".18" />
            <stop offset=".58" stopColor="#10252f" stopOpacity=".13" />
            <stop offset="1" stopColor="#07111e" stopOpacity=".92" />
          </radialGradient>
          <radialGradient id="nexus-nebula-a">
            <stop offset="0" stopColor="#38a5a0" stopOpacity=".46" />
            <stop offset=".45" stopColor="#287a83" stopOpacity=".2" />
            <stop offset="1" stopColor="#14565d" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nexus-nebula-b">
            <stop offset="0" stopColor="#5bc4c0" stopOpacity=".27" />
            <stop offset=".5" stopColor="#236c76" stopOpacity=".14" />
            <stop offset="1" stopColor="#173d4b" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nexus-heart">
            <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
            <stop offset=".12" stopColor="#d8fff0" stopOpacity=".98" />
            <stop offset=".36" stopColor="#8fe5d0" stopOpacity=".72" />
            <stop offset="1" stopColor="#4aa99e" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="nexus-orbit-mint" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#64c9bd" stopOpacity=".05" />
            <stop offset=".4" stopColor="#c0f6e8" stopOpacity=".8" />
            <stop offset=".62" stopColor="#8be2d1" stopOpacity=".38" />
            <stop offset="1" stopColor="#4d9e9c" stopOpacity=".04" />
          </linearGradient>
          <linearGradient id="nexus-orbit-white" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#a6f5e6" stopOpacity=".05" />
            <stop offset=".48" stopColor="#f4fff9" stopOpacity=".85" />
            <stop offset="1" stopColor="#71c9c0" stopOpacity=".06" />
          </linearGradient>
          <linearGradient id="nexus-amber" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#e5c98c" stopOpacity=".02" />
            <stop offset=".48" stopColor="#f0d49a" stopOpacity=".76" />
            <stop offset="1" stopColor="#e5c98c" stopOpacity=".02" />
          </linearGradient>
          <filter id="nexus-blur-wide" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="34" />
          </filter>
          <filter id="nexus-blur-soft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="12" />
          </filter>
          <filter id="nexus-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <rect className="nexus-base" width="820" height="760" fill="#081421" />
        <ellipse className="nexus-cloud nexus-cloud-a" cx="394" cy="350" rx="310" ry="185" fill="url(#nexus-nebula-a)" filter="url(#nexus-blur-wide)" />
        <ellipse className="nexus-cloud nexus-cloud-b" cx="472" cy="431" rx="246" ry="198" fill="url(#nexus-nebula-b)" filter="url(#nexus-blur-wide)" />
        <path className="nexus-nebula-rim" d="M95 354 C139 203 245 140 354 150 C465 160 548 217 650 229 C735 240 770 322 720 411 C676 489 574 506 519 574 C450 658 337 647 269 590 C193 527 68 471 95 354Z" />

        <g className="nexus-dust">
          {DUST.map(([cx, cy, r, opacity], index) => (
            <circle key={index} cx={cx} cy={cy} r={r} opacity={opacity} />
          ))}
        </g>

        <g className="nexus-trajectories nexus-trajectories-a">
          <ellipse className="nexus-orbit nexus-orbit-soft" cx="410" cy="380" rx="286" ry="103" transform="rotate(-29 410 380)" />
          <ellipse className="nexus-orbit nexus-orbit-mint" cx="410" cy="380" rx="284" ry="100" transform="rotate(-29 410 380)" />
          <ellipse className="nexus-orbit nexus-orbit-flow" cx="410" cy="380" rx="284" ry="100" transform="rotate(-29 410 380)" />
        </g>
        <g className="nexus-trajectories nexus-trajectories-b">
          <ellipse className="nexus-orbit nexus-orbit-soft" cx="410" cy="380" rx="256" ry="92" transform="rotate(34 410 380)" />
          <ellipse className="nexus-orbit nexus-orbit-white" cx="410" cy="380" rx="256" ry="92" transform="rotate(34 410 380)" />
          <ellipse className="nexus-orbit nexus-orbit-flow nexus-flow-delayed" cx="410" cy="380" rx="256" ry="92" transform="rotate(34 410 380)" />
        </g>
        <g className="nexus-trajectories nexus-trajectories-c">
          <ellipse className="nexus-orbit nexus-orbit-amber" cx="410" cy="380" rx="206" ry="61" transform="rotate(-57 410 380)" />
          <ellipse className="nexus-orbit nexus-orbit-mint nexus-orbit-inner" cx="410" cy="380" rx="170" ry="48" transform="rotate(62 410 380)" />
        </g>

        <ellipse className="nexus-core-halo" cx="410" cy="380" rx="116" ry="106" fill="url(#nexus-heart)" filter="url(#nexus-blur-soft)" />
        <circle className="nexus-core" cx="410" cy="380" r="61" fill="url(#nexus-heart)" />
        <circle className="nexus-core-light" cx="410" cy="380" r="8" />
        <rect width="820" height="760" fill="url(#nexus-vignette)" />
      </svg>
    </div>
  );
}
