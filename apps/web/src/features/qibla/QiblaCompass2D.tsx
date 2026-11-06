/** Kompas kiblat SVG: dial berputar mengikuti heading, jarum menunjuk azimut kiblat. */
export function QiblaCompass2D({ bearing, heading }: { bearing: number; heading: number | null }) {
  const dialRotation = heading === null ? 0 : -heading;
  const ticks = Array.from({ length: 72 }, (_, i) => i * 5);
  return (
    <svg viewBox="-160 -160 320 320" className="h-full w-full" role="img" aria-label={`Kompas. Kiblat ${bearing.toFixed(1)} derajat dari utara${heading === null ? ", sensor tidak aktif" : ""}.`} data-testid="qibla-compass-2d">
      <defs>
        <radialGradient id="dial-bg" cx="0" cy="0" r="1" gradientUnits="objectBoundingBox">
          <stop offset="0" stopColor="#111C2C" />
          <stop offset="1" stopColor="#0B1324" />
        </radialGradient>
      </defs>
      <polygon points="0,-158 -9,-142 9,-142" fill="#E8D6A5" aria-hidden />
      <g style={{ transform: `rotate(${dialRotation}deg)`, transition: "transform 300ms cubic-bezier(0.22,1,0.36,1)" }}>
        <circle r="140" fill="url(#dial-bg)" stroke="#D6B56D" strokeWidth="2" />
        <g stroke="#D6B56D" strokeOpacity="0.15" fill="none">
          <rect x="-70" y="-70" width="140" height="140" />
          <rect x="-70" y="-70" width="140" height="140" transform="rotate(45)" />
        </g>
        {ticks.map((t) => (
          <line key={t} x1="0" y1={t % 45 === 0 ? -126 : -132} x2="0" y2="-138" stroke="#E8D6A5" strokeOpacity={t % 45 === 0 ? 0.9 : 0.4} strokeWidth={t % 45 === 0 ? 2 : 1} transform={`rotate(${t})`} />
        ))}
        {[
          ["U", 0],
          ["T", 90],
          ["S", 180],
          ["B", 270],
        ].map(([label, deg]) => (
          <text key={label} x="0" y="-104" textAnchor="middle" dominantBaseline="middle" fontSize="16" fontWeight="700" fill={label === "U" ? "#e5484d" : "#F8F6EF"} transform={`rotate(${deg})`}>
            {label}
          </text>
        ))}
        <g transform={`rotate(${bearing})`}>
          <line x1="0" y1="10" x2="0" y2="-92" stroke="#D6B56D" strokeWidth="5" strokeLinecap="round" />
          <rect x="-11" y="-118" width="22" height="22" rx="2" fill="#111" stroke="#D6B56D" strokeWidth="2" />
          <rect x="-11" y="-112" width="22" height="3" fill="#D6B56D" />
        </g>
        <circle r="9" fill="#E8D6A5" />
      </g>
    </svg>
  );
}
