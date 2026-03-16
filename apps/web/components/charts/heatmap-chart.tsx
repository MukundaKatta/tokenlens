"use client";

import { formatCost } from "@tokenlens/shared";

interface HeatmapData {
  hour: number;
  day: number;
  value: number;
}

interface HeatmapChartProps {
  data: HeatmapData[];
  height?: number;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getColor(value: number, max: number): string {
  if (max === 0) return "rgba(99, 102, 241, 0.05)";
  const intensity = value / max;
  if (intensity < 0.2) return "rgba(99, 102, 241, 0.1)";
  if (intensity < 0.4) return "rgba(99, 102, 241, 0.25)";
  if (intensity < 0.6) return "rgba(99, 102, 241, 0.45)";
  if (intensity < 0.8) return "rgba(99, 102, 241, 0.65)";
  return "rgba(99, 102, 241, 0.9)";
}

export function HeatmapChart({ data, height = 200 }: HeatmapChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const cellSize = Math.min(28, (height - 40) / 7);
  const gap = 2;

  return (
    <div className="overflow-x-auto">
      <svg
        width={24 * (cellSize + gap) + 40}
        height={7 * (cellSize + gap) + 30}
        className="text-muted-foreground"
      >
        {/* Day labels */}
        {DAYS.map((day, i) => (
          <text
            key={day}
            x={0}
            y={30 + i * (cellSize + gap) + cellSize / 2}
            fontSize={10}
            fill="currentColor"
            dominantBaseline="middle"
          >
            {day}
          </text>
        ))}

        {/* Hour labels */}
        {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
          <text
            key={hour}
            x={40 + hour * (cellSize + gap) + cellSize / 2}
            y={16}
            fontSize={9}
            fill="currentColor"
            textAnchor="middle"
          >
            {hour % 6 === 0 ? `${hour}h` : ""}
          </text>
        ))}

        {/* Cells */}
        {data.map((d) => (
          <g key={`${d.day}-${d.hour}`}>
            <rect
              x={40 + d.hour * (cellSize + gap)}
              y={24 + d.day * (cellSize + gap)}
              width={cellSize}
              height={cellSize}
              rx={3}
              fill={getColor(d.value, maxValue)}
            >
              <title>{`${DAYS[d.day]} ${d.hour}:00 - ${formatCost(d.value)}`}</title>
            </rect>
          </g>
        ))}
      </svg>
    </div>
  );
}
