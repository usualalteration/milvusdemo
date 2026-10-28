/** Animated circular similarity gauge (pure SVG + CSS transitions). */

import * as React from "react";
import { scoreColor } from "@/lib/theme";
import { useCountUp } from "@/hooks/use-count-up";

const SIZE = 180;
const STROKE = 12;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function SimilarityGauge({
  score,
  label = "cosine similarity",
  size = SIZE,
}: {
  score: number;
  label?: string;
  size?: number;
}) {
  const display = useCountUp(score, 900);
  const percent = Math.max(0, Math.min(100, score));
  const offset = CIRCUMFERENCE * (1 - percent / 100);
  const color = scoreColor(percent);

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="meter"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="gauge-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00d9ff" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
          <filter id="gauge-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="5" result="blur">
              <animate attributeName="stdDeviation" values="3;6;3" dur="2.4s" repeatCount="indefinite" />
            </feGaussianBlur>
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={RADIUS}
          fill="none"
          stroke="rgba(148, 163, 184, 0.12)"
          strokeWidth={STROKE}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={RADIUS}
          fill="none"
          stroke="url(#gauge-grad)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          filter="url(#gauge-glow)"
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tech text-4xl font-bold" style={{ color }}>
          {display.toFixed(1)}
          <span className="text-2xl">%</span>
        </span>
        <span className="mt-1 text-[10px] uppercase tracking-[0.22em] text-slate-500">
          {label}
        </span>
      </div>
    </div>
  );
}