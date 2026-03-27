"use client";

interface RadarChartProps {
  data: { label: string; value: number }[]; // value 0–100
  size?: number;
  accentColor?: string;
}

export default function RadarChart({ data, size = 240, accentColor = "#F0EDE8" }: RadarChartProps) {
  if (data.length < 3) return null;

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.36;
  const n = data.length;
  const levels = 4;

  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;

  const point = (i: number, r: number) => ({
    x: cx + r * Math.cos(angle(i)),
    y: cy + r * Math.sin(angle(i)),
  });

  // Grid polygons
  const gridPolygons = Array.from({ length: levels }, (_, l) => {
    const r = (radius * (l + 1)) / levels;
    return Array.from({ length: n }, (__, i) => point(i, r))
      .map(p => `${p.x},${p.y}`)
      .join(" ");
  });

  // Data polygon
  const dataPoints = data.map((d, i) => point(i, (d.value / 100) * radius));
  const dataPolygon = dataPoints.map(p => `${p.x},${p.y}`).join(" ");

  // Label positions (slightly outside radius)
  const labelRadius = radius + 20;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Grid rings */}
      {gridPolygons.map((poly, i) => (
        <polygon key={i} points={poly} fill="none" stroke="#2a2a2a" strokeWidth="1" />
      ))}

      {/* Axis lines */}
      {data.map((_, i) => {
        const p = point(i, radius);
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#2a2a2a" strokeWidth="1" />;
      })}

      {/* Data area */}
      <polygon
        points={dataPolygon}
        fill={accentColor}
        fillOpacity="0.15"
        stroke={accentColor}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Data points */}
      {dataPoints.map((p, i) => (
        data[i].value > 0 && (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill={accentColor} />
        )
      ))}

      {/* Labels */}
      {data.map((d, i) => {
        const p = point(i, labelRadius);
        const ang = angle(i);
        const textAnchor = Math.abs(Math.cos(ang)) < 0.1 ? "middle" : Math.cos(ang) > 0 ? "start" : "end";
        return (
          <text
            key={i}
            x={p.x}
            y={p.y}
            textAnchor={textAnchor}
            dominantBaseline="middle"
            fontSize="9"
            fill={d.value >= 40 ? "#F0EDE8" : "#555555"}
            fontFamily="Inter, sans-serif"
          >
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}
