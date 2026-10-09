import type { CSSProperties } from "react";
import "./resilience-shield.css";

const ROW_COUNTS = [5, 7, 9, 11, 11, 11, 9, 9, 7, 5, 3];
const CELL_RADIUS = 11.3;

function hexPoints(cx: number, cy: number, radius: number) {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 3) * index - Math.PI / 6;
    return `${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`;
  }).join(" ");
}

export function ResilienceShield({ staticMode = false }: { staticMode?: boolean }) {
  let cellIndex = 0;
  const cells = ROW_COUNTS.flatMap((count, row) => Array.from({ length: count }, (_, column) => {
    const cx = 210 + (column - (count - 1) / 2) * 25 + (row % 2 ? -12.5 : 0);
    const cy = 70 + row * 24;
    const progress = Math.min(1, ((cx - 56) / 308) * 0.42 + ((cy - 58) / 282) * 0.58);
    const delay = `${(progress * 2.35).toFixed(3)}s`;
    const key = cellIndex++;
    return (
      <polygon
        key={key}
        className="shield-hex"
        points={hexPoints(cx, cy, CELL_RADIUS)}
        style={{ "--cell-delay": delay } as CSSProperties}
      />
    );
  }));

  return (
    <div className={`shield-visual${staticMode ? " shield-static" : ""}`}>
      <svg className="shield-art" viewBox="0 0 420 390" role="img" aria-label="Bouclier de résilience composé de 87 alvéoles, traversé par une perturbation puis régénéré">
        <defs>
          <radialGradient id="shield-halo-gradient">
            <stop offset="0" stopColor="#8FBFA8" stopOpacity=".22" />
            <stop offset=".64" stopColor="#2A5141" stopOpacity=".1" />
            <stop offset="1" stopColor="#172030" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="shield-outline-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8FBFA8" stopOpacity=".72" />
            <stop offset=".52" stopColor="#6F9D88" stopOpacity=".44" />
            <stop offset="1" stopColor="#D8C28C" stopOpacity=".34" />
          </linearGradient>
          <filter id="shield-check-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2.4" result="soft" />
            <feMerge><feMergeNode in="soft" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <ellipse className="shield-halo" cx="210" cy="191" rx="178" ry="166" fill="url(#shield-halo-gradient)" />
        <path className="shield-outline" d="M210 19 C267 20 320 38 354 59 L354 193 C354 269 304 320 210 369 C116 320 66 269 66 193 L66 59 C100 38 153 20 210 19Z" />
        <g className="shield-cells">{cells}</g>
        <path className="shield-wave shield-wave-amber" d="M82 77 C126 103 144 136 185 159 C226 182 253 211 291 233 C320 251 335 270 347 294" />
        <path className="shield-wave shield-wave-mint" d="M82 77 C126 103 144 136 185 159 C226 182 253 211 291 233 C320 251 335 270 347 294" />
        <path className="shield-check" d="M169 194 L197 221 L253 163" />
      </svg>
      <div className="shield-stages" aria-label="Étapes de résilience">
        <span className="shield-stage-anticiper">ANTICIPER</span>
        <span className="shield-stage-resister">RÉSISTER</span>
        <span className="shield-stage-rebondir">REBONDIR</span>
      </div>
    </div>
  );
}