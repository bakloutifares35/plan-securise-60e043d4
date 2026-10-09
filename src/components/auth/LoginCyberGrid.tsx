import { useMemo } from "react";
import type { CSSProperties } from "react";
import "./login-cyber-grid.css";

const ROW_COUNTS = [3, 5, 7, 7, 5, 3];

function hexPoints(cx: number, cy: number, radius: number) {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 3) * index - Math.PI / 6;
    return `${(cx + radius * Math.cos(angle)).toFixed(1)},${(cy + radius * Math.sin(angle)).toFixed(1)}`;
  }).join(" ");
}

export function LoginCyberGrid({ staticMode = false }: { staticMode?: boolean }) {
  const cells = useMemo(() => {
    let index = 0;
    return ROW_COUNTS.flatMap((count, row) => Array.from({ length: count }, (_, column) => {
      const cx = 240 + (column - (count - 1) / 2) * 35 + (row % 2 ? 17.5 : 0);
      const cy = 66 + row * 33;
      const distance = Math.hypot(cx - 240, cy - 148);
      const delay = `${(distance / 115).toFixed(2)}s`;
      const key = index++;
      return <polygon key={key} className="cyber-hex" points={hexPoints(cx, cy, 15.5)} style={{ "--cell-delay": delay } as CSSProperties} />;
    }));
  }, []);

  return (
    <div className={`login-cyber-visual${staticMode ? " cyber-static" : ""}`}>
      <svg className="cyber-grid-art" viewBox="0 0 480 280" role="img" aria-label="Grille hexagonale de continuité avec un symbole de validation">
        <defs>
          <radialGradient id="cyber-core-glow">
            <stop offset="0" stopColor="#d5f7e8" stopOpacity=".8" />
            <stop offset=".28" stopColor="#10b981" stopOpacity=".32" />
            <stop offset="1" stopColor="#10b981" stopOpacity="0" />
          </radialGradient>
          <filter id="cyber-check-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <ellipse className="cyber-core-halo" cx="240" cy="148" rx="138" ry="100" fill="url(#cyber-core-glow)" />
        <g className="cyber-circuit-lines" aria-hidden="true">
          <path d="M0 104 H84 L112 132 H151 M0 190 H90 L116 164 H153 M480 104 H396 L368 132 H329 M480 190 H390 L364 164 H327" />
          <path d="M28 78 H95 L121 104 M452 78 H385 L359 104 M28 216 H95 L121 190 M452 216 H385 L359 190" />
          <path d="M64 147 H142 M338 147 H416" />
        </g>
        <g className="cyber-nodes" aria-hidden="true">
          <circle cx="84" cy="104" r="2.2" /><circle cx="90" cy="190" r="2.2" />
          <circle cx="396" cy="104" r="2.2" /><circle cx="390" cy="190" r="2.2" />
          <circle cx="121" cy="104" r="1.8" /><circle cx="359" cy="190" r="1.8" />
        </g>
        <g className="cyber-hex-matrix">{cells}</g>
        <g className="cyber-particles" aria-hidden="true">
          <circle cx="148" cy="82" r="1.4" /><circle cx="325" cy="90" r="1.2" />
          <circle cx="105" cy="158" r="1.1" /><circle cx="370" cy="153" r="1.3" />
          <circle cx="174" cy="222" r="1.1" /><circle cx="307" cy="215" r="1.4" />
          <circle cx="222" cy="43" r="1" /><circle cx="274" cy="245" r="1" />
        </g>
        <path className="cyber-validation" d="M218 148 L234 164 L264 131" />
      </svg>
    </div>
  );
}
