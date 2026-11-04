/** Fallback 2D lintasan matahari (SVG), juga dipakai saat WebGL tidak tersedia. */
export function SunPath2D({ dayProgress, markers }: { dayProgress: number; markers: { key: string; t: number; label: string }[] }) {
  const clamp = (t: number): number => Math.max(0, Math.min(1, t));
  const point = (t: number): [number, number] => {
    const a = Math.PI * (1 - clamp(t));
    return [200 + Math.cos(a) * 170, 170 - Math.sin(a) * 130];
  };
  const night = dayProgress < 0 || dayProgress > 1;
  const [sx, sy] = point(dayProgress);
  return (
    <svg viewBox="0 0 400 200" className="h-full w-full" role="img" aria-label={night ? "Matahari di bawah ufuk" : `Posisi matahari ${Math.round(clamp(dayProgress) * 100)}% dari terbit ke terbenam`}>
      <defs>
        <radialGradient id="sun-glow">
          <stop offset="0" stopColor="#FFD27A" stopOpacity="0.8" />
          <stop offset="1" stopColor="#FFD27A" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d="M30 170 A170 130 0 0 1 370 170" fill="none" stroke="#D6B56D" strokeOpacity="0.45" strokeDasharray="5 6" />
      <line x1="10" y1="170" x2="390" y2="170" stroke="#E8D6A5" strokeOpacity="0.35" />
      {markers.map((m) => {
        const [x, y] = point(m.t);
        return (
          <g key={m.key}>
            <circle cx={x} cy={y} r="3.5" fill="#E8D6A5" />
            <text x={x} y={y - 10} textAnchor="middle" fontSize="11" fill="currentColor" className="text-muted">
              {m.label}
            </text>
          </g>
        );
      })}
      {!night && (
        <>
          <circle cx={sx} cy={sy} r="26" fill="url(#sun-glow)" />
          <circle cx={sx} cy={sy} r="9" fill="#FFD27A" />
        </>
      )}
    </svg>
  );
}
