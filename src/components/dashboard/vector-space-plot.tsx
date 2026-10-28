/**
 * Interactive 2D vector space plot.
 *
 * - Points are real documents projected with PCA (server-computed).
 * - Zoom with wheel, pan by dragging, hover for details, click to select.
 * - When a search is active, the query vector is drawn with connecting
 *   lines to its nearest neighbors.
 * - Clearly labeled as a 2D projection, not the original 512d space.
 */

import * as React from "react";
import { Orbit, ZoomIn, ZoomOut, Crosshair } from "lucide-react";
import { VectorPoint } from "@/lib/types";
import { categoryStyle } from "@/lib/theme";
import { cn } from "@/lib/utils";

export interface PlotQuery {
  x: number;
  y: number;
  neighbors: string[];
}

interface HoverInfo {
  point: VectorPoint;
  cx: number;
  cy: number;
}

const VIEW_W = 900;
const VIEW_H = 560;
const PAD = 70;

function toSvgCoords(x: number, y: number): [number, number] {
  const cx = PAD + ((x + 1) / 2) * (VIEW_W - 2 * PAD);
  const cy = PAD + ((1 - (y + 1) / 2)) * (VIEW_H - 2 * PAD);
  return [cx, cy];
}

export function VectorSpacePlot({
  points,
  query,
  explainedVariance,
  selectedId,
  onSelect,
  className,
  compact = false,
}: {
  points: VectorPoint[];
  query?: PlotQuery | null;
  explainedVariance?: number[];
  selectedId?: string | null;
  onSelect?: (point: VectorPoint) => void;
  className?: string;
  compact?: boolean;
}) {
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [hover, setHover] = React.useState<HoverInfo | null>(null);
  const dragging = React.useRef<{ x: number; y: number } | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);

  const neighborIds = React.useMemo(
    () => new Set(query?.neighbors ?? []),
    [query],
  );

  const categories = React.useMemo(() => {
    const seen = new Map<string, string>();
    points.forEach((p) => {
      if (!seen.has(p.category)) seen.set(p.category, categoryStyle(p.category).color);
    });
    return Array.from(seen.entries());
  }, [points]);

  const handleWheel = React.useCallback((event: React.WheelEvent) => {
    event.preventDefault();
    setZoom((z) => Math.min(6, Math.max(0.6, z * (event.deltaY < 0 ? 1.12 : 0.89))));
  }, []);

  const handlePointerDown = (event: React.PointerEvent) => {
    if ((event.target as Element).closest(".vx-point")) return;
    dragging.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = event.clientX - dragging.current.x;
    const dy = event.clientY - dragging.current.y;
    dragging.current = { x: event.clientX, y: event.clientY };
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  };

  const handlePointerUp = () => {
    dragging.current = null;
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const querySvg = query ? toSvgCoords(query.x, query.y) : null;

  return (
    <div className={cn("relative w-full", className)}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="h-auto w-full touch-none select-none rounded-xl"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          handlePointerUp();
          setHover(null);
        }}
        role="img"
        aria-label="PCA projection of document embeddings; scroll to zoom, drag to pan"
      >
        <defs>
          <radialGradient id="plot-vignette" cx="50%" cy="42%" r="65%">
            <stop offset="0%" stopColor="rgba(0, 217, 255, 0.05)" />
            <stop offset="100%" stopColor="rgba(8, 11, 20, 0.7)" />
          </radialGradient>
          <pattern id="plot-grid" width="45" height="45" patternUnits="userSpaceOnUse">
            <path d="M 45 0 L 0 0 0 45" fill="none" stroke="rgba(148, 163, 184, 0.06)" strokeWidth="0.6" />
          </pattern>
          <linearGradient id="link-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(0, 217, 255, 0.85)" />
            <stop offset="100%" stopColor="rgba(139, 92, 246, 0.4)" />
          </linearGradient>
        </defs>

        <rect width={VIEW_W} height={VIEW_H} fill="url(#plot-vignette)" rx="12" />
        <rect width={VIEW_W} height={VIEW_H} fill="url(#plot-grid)" rx="12" />

        {/* axes labels: PCA projection notice */}
        <text
          x={VIEW_W / 2}
          y={VIEW_H - 18}
          textAnchor="middle"
          className="tech"
          fontSize="11"
          fill="rgba(148, 163, 184, 0.55)"
        >
          PCA 2D projection
          {explainedVariance && explainedVariance.length >= 2
            ? ` · ${(explainedVariance[0] * 100).toFixed(1)}% + ${(explainedVariance[1] * 100).toFixed(1)}% variance`
            : ""}
        </text>

        <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom}) `} style={{ transformOrigin: "center" }}>
          {/* origin axes cross */}
          <line
            x1={toSvgCoords(-1, 0)[0]}
            y1={toSvgCoords(-1, 0)[1]}
            x2={toSvgCoords(1, 0)[0]}
            y2={toSvgCoords(1, 0)[1]}
            stroke="rgba(148, 163, 184, 0.10)"
            strokeDasharray="3 5"
          />
          <line
            x1={toSvgCoords(0, -1)[0]}
            y1={toSvgCoords(0, -1)[1]}
            x2={toSvgCoords(0, 1)[0]}
            y2={toSvgCoords(0, 1)[1]}
            stroke="rgba(148, 163, 184, 0.10)"
            strokeDasharray="3 5"
          />

          {/* query-to-neighbor connecting lines */}
          {querySvg &&
            points
              .filter((p) => neighborIds.has(p.doc_id))
              .map((p) => {
                const [px, py] = toSvgCoords(p.x, p.y);
                return (
                  <line
                    key={`link-${p.doc_id}`}
                    x1={querySvg[0]}
                    y1={querySvg[1]}
                    x2={px}
                    y2={py}
                    stroke="url(#link-gradient)"
                    strokeWidth={1.4 / zoom}
                    strokeDasharray="4 10"
                    className="vx-link-line"
                    opacity={0.85}
                  />
                );
              })}

          {/* document points */}
          {points.map((p) => {
            const [cx, cy] = toSvgCoords(p.x, p.y);
            const style = categoryStyle(p.category);
            const isNeighbor = neighborIds.has(p.doc_id);
            const isSelected = selectedId === p.doc_id;
            const r = isNeighbor ? 9 : 6.5;
            return (
              <g
                key={p.doc_id}
                className="vx-point"
                transform={`translate(${cx} ${cy})`}
                onMouseEnter={() => setHover({ point: p, cx, cy })}
                onMouseLeave={() => setHover(null)}
                onClick={() => onSelect?.(p)}
              >
                {isNeighbor && (
                  <circle
                    r={r + 6}
                    fill="none"
                    stroke={style.color}
                    strokeWidth={1.2}
                    className="vx-neighbor-ring"
                    opacity={0.8}
                  />
                )}
                {isSelected && (
                  <circle
                    r={r + 9}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth={1}
                    strokeDasharray="2 3"
                    opacity={0.7}
                  />
                )}
                <circle
                  r={r}
                  fill={style.color}
                  fillOpacity={isNeighbor ? 0.95 : 0.62}
                  stroke={isNeighbor ? "#ffffff" : style.border}
                  strokeWidth={isNeighbor ? 1.4 : 0.8}
                  style={{
                    filter: isNeighbor
                      ? `drop-shadow(0 0 7px ${style.color})`
                      : `drop-shadow(0 0 3px ${style.soft})`,
                  }}
                />
              </g>
            );
          })}

          {/* query vector marker */}
          {querySvg && (
            <g transform={`translate(${querySvg[0]} ${querySvg[1]})`} className="vx-query-point">
              <circle r={13} fill="none" stroke="#00d9ff" strokeWidth={1.6} />
              <circle r={5} fill="#00d9ff" style={{ filter: "drop-shadow(0 0 10px #00d9ff)" }} />
              <text
                y={-20}
                textAnchor="middle"
                fontSize="11"
                className="tech"
                fill="#7df3ff"
              >
                query
              </text>
            </g>
          )}
        </g>
      </svg>

      {/* hover tooltip */}
      {hover && (
        <div
          className="pointer-events-none absolute z-10 glass rounded-lg px-3 py-2 text-xs shadow-xl"
          style={{
            left: `${(hover.cx / VIEW_W) * 100}%`,
            top: `${(hover.cy / VIEW_H) * 100}%`,
            transform: "translate(-50%, -135%)",
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{
                backgroundColor: categoryStyle(hover.point.category).color,
                boxShadow: `0 0 6px ${categoryStyle(hover.point.category).color}`,
              }}
            />
            <span className="font-medium text-slate-100">{hover.point.title}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
            <span>{hover.point.category}</span>
            {hover.point.is_neighbor && (
              <span className="text-cyan-300">
                · match #{hover.point.rank ?? "?"} · {(hover.point.score ?? 0).toFixed(1)}% similarity
              </span>
            )}
          </div>
        </div>
      )}

      {/* controls */}
      <div className="absolute right-3 top-3 flex flex-col gap-1.5">
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => setZoom((z) => Math.min(6, z * 1.25))}
          className="glass rounded-lg p-2 text-slate-300 transition-colors hover:text-cyan-300"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => setZoom((z) => Math.max(0.6, z * 0.8))}
          className="glass rounded-lg p-2 text-slate-300 transition-colors hover:text-cyan-300"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Reset view"
          onClick={resetView}
          className="glass rounded-lg p-2 text-slate-300 transition-colors hover:text-cyan-300"
        >
          <Crosshair className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* legend */}
      <div className="absolute bottom-3 left-3 flex max-w-[70%] flex-wrap gap-x-3 gap-y-1">
        {categories.map(([name, color]) => (
          <span key={name} className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 5px ${color}` }} />
            {name}
          </span>
        ))}
        {query && (
          <span className="flex items-center gap-1.5 text-[10px] text-cyan-300">
            <Orbit className="h-3 w-3" /> query vector
          </span>
        )}
      </div>

      {!compact && (
        <p className="mt-2 text-center text-[11px] leading-relaxed text-slate-500">
          This is a 2D PCA projection of the {points.length > 0 ? "512-dimensional" : "high-dimensional"} embedding space —
          distances here approximate, not equal, true vector similarity.
          Scroll to zoom · drag to pan · click a point to select.
        </p>
      )}
    </div>
  );
}