/** Shared visual primitives for the Vector Intelligence Lab dashboard. */

import * as React from "react";
import { cn } from "@/lib/utils";
import { categoryStyle } from "@/lib/theme";

/* ------------------------------------------------------------------ */
/* Glass panel                                                          */
/* ------------------------------------------------------------------ */

export function GlassCard({
  className,
  children,
  edgeGlow = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { edgeGlow?: boolean }) {
  return (
    <div
      className={cn(
        "glass rounded-2xl",
        edgeGlow && "edge-glow",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Category badge                                                       */
/* ------------------------------------------------------------------ */

export function CategoryBadge({
  category,
  className,
  dot = true,
}: {
  category: string;
  className?: string;
  dot?: boolean;
}) {
  const style = categoryStyle(category);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide",
        className,
      )}
      style={{
        color: style.text,
        backgroundColor: style.bg,
        borderColor: style.border,
      }}
    >
      {dot && (
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: style.color, boxShadow: `0 0 6px ${style.color}` }}
        />
      )}
      {category}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Concept chip                                                         */
/* ------------------------------------------------------------------ */

export function ConceptChip({ name }: { name: string }) {
  return (
    <span className="tech rounded-md border border-violet-400/25 bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-200">
      {name}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Animated similarity score bar                                        */
/* ------------------------------------------------------------------ */

export function ScoreBar({
  score,
  className,
  delayMs = 0,
}: {
  score: number;
  className?: string;
  delayMs?: number;
}) {
  const [width, setWidth] = React.useState(0);
  React.useEffect(() => {
    const timer = window.setTimeout(() => setWidth(score), delayMs);
    return () => window.clearTimeout(timer);
  }, [score, delayMs]);
  return (
    <div
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-white/6",
        className,
      )}
      role="meter"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Similarity score"
    >
      <div
        className="score-bar-fill h-full rounded-full"
        style={{ width: `${Math.max(2, Math.min(100, width))}%` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Embedding strip - visual slice of the raw vector                     */
/* ------------------------------------------------------------------ */

export function EmbeddingStrip({
  values,
  dim,
  className,
  cellCount = 12,
}: {
  values: number[];
  dim?: number;
  className?: string;
  cellCount?: number;
}) {
  const cells = React.useMemo(() => {
    const source = values && values.length ? values : [];
    const out: { value: number; color: string }[] = [];
    for (let i = 0; i < cellCount; i += 1) {
      const value = source[i] ?? 0;
      const alpha = Math.min(Math.abs(value) * 4 + 0.08, 0.85);
      const color =
        value >= 0 ? `rgba(0, 217, 255, ${alpha})` : `rgba(244, 114, 182, ${alpha})`;
      out.push({ value, color });
    }
    return out;
  }, [values, cellCount]);

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-end gap-[3px]">
        {cells.map((cell, index) => (
          <div
            key={index}
            className="h-5 w-2 rounded-[2px] border border-white/10"
            style={{
              backgroundColor: cell.color,
              boxShadow: `0 0 ${Math.min(Math.abs(cell.value) * 30, 8)}px ${cell.color}`,
            }}
            title={`dim[${index}] = ${cell.value.toFixed(4)}`}
          />
        ))}
      </div>
      {dim !== undefined && (
        <span className="tech text-[10px] text-slate-500">
          [{dim}d vector · first {cells.length} values]
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stat tile for the technical dashboards                               */
/* ------------------------------------------------------------------ */

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  accent = "cyan",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: "cyan" | "violet" | "emerald" | "amber" | "slate";
  className?: string;
}) {
  const accents: Record<string, { text: string; glow: string }> = {
    cyan: { text: "text-cyan-300", glow: "bg-cyan-400/10" },
    violet: { text: "text-violet-300", glow: "bg-violet-400/10" },
    emerald: { text: "text-emerald-300", glow: "bg-emerald-400/10" },
    amber: { text: "text-amber-300", glow: "bg-amber-400/10" },
    slate: { text: "text-slate-300", glow: "bg-slate-400/10" },
  };
  const tone = accents[accent] ?? accents.cyan;
  return (
    <div className={cn("glass glass-hover rounded-xl p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
          {label}
        </span>
        {Icon && (
          <span className={cn("rounded-lg p-1.5", tone.glow)}>
            <Icon className={cn("h-3.5 w-3.5", tone.text)} />
          </span>
        )}
      </div>
      <div className={cn("tech mt-2 text-lg font-semibold", tone.text)}>
        {value}
      </div>
      {hint && <div className="mt-1 text-[11px] text-slate-500">{hint}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Loading skeletons                                                    */
/* ------------------------------------------------------------------ */

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("vx-skeleton rounded-lg", className)} />;
}

export function ResultSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading results">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <SkeletonBlock className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <SkeletonBlock className="h-3.5 w-2/3" />
              <SkeletonBlock className="h-2.5 w-1/3" />
            </div>
            <SkeletonBlock className="h-8 w-16 rounded-full" />
          </div>
          <SkeletonBlock className="mt-4 h-2 w-full" />
          <SkeletonBlock className="mt-3 h-2.5 w-full" />
          <SkeletonBlock className="mt-1.5 h-2.5 w-5/6" />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Empty state                                                          */
/* ------------------------------------------------------------------ */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
        className,
      )}
    >
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <Icon className="h-7 w-7 text-cyan-400/80" />
      </div>
      <h3 className="font-display text-lg font-semibold text-slate-100">{title}</h3>
      <p className="max-w-md text-sm leading-relaxed text-slate-400">{description}</p>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Error panel                                                         */
/* ------------------------------------------------------------------ */

export function ErrorPanel({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5"
    >
      <div className="flex items-start gap-3">
        <svg viewBox="0 0 20 20" className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-5a1 1 0 112 0 1 1 0 01-2 0zm.25-7.25a.75.75 0 001.5 0v4.5a.75.75 0 01-1.5 0v-4.5z" clipRule="evenodd" />
        </svg>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-rose-200">Operation failed</p>
          <p className="text-sm text-rose-300/80">{message}</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Highlight content: mark matched terms                                */
/* ------------------------------------------------------------------ */

export function HighlightedText({
  text,
  terms,
  limit = 0,
}: {
  text: string;
  terms: string[];
  limit?: number;
}) {
  const body = limit > 0 && text.length > limit ? `${text.slice(0, limit).trim()}…` : text;
  const clean = terms
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (clean.length === 0) return <>{body}</>;
  const re = new RegExp(`\\b(${clean.join("|")})\\b`, "gi");
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    if (match.index > last) parts.push(body.slice(last, match.index));
    parts.push(
      <mark key={match.index} className="vx-hit">
        {match[0]}
      </mark>,
    );
    last = match.index + match[0].length;
    if (parts.length > 60) break;
  }
  parts.push(body.slice(last));
  return <>{parts}</>;
}