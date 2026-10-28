/** Visual theme helpers: neon category palette and score utilities. */

export interface CategoryStyle {
  color: string;
  soft: string;
  bg: string;
  border: string;
  text: string;
}

const FALLBACK: CategoryStyle = {
  color: "#94a3b8",
  soft: "rgba(148, 163, 184, 0.14)",
  bg: "rgba(148, 163, 184, 0.10)",
  border: "rgba(148, 163, 184, 0.35)",
  text: "#cbd5e1",
};

const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  Technology: {
    color: "#00d9ff",
    soft: "rgba(0, 217, 255, 0.16)",
    bg: "rgba(0, 217, 255, 0.10)",
    border: "rgba(0, 217, 255, 0.38)",
    text: "#7df3ff",
  },
  Science: {
    color: "#f59e0b",
    soft: "rgba(245, 158, 11, 0.16)",
    bg: "rgba(245, 158, 11, 0.10)",
    border: "rgba(245, 158, 11, 0.38)",
    text: "#fcd34d",
  },
  Astronomy: {
    color: "#8b5cf6",
    soft: "rgba(139, 92, 246, 0.16)",
    bg: "rgba(139, 92, 246, 0.12)",
    border: "rgba(139, 92, 246, 0.40)",
    text: "#c4b5fd",
  },
  "Artificial Intelligence": {
    color: "#f472b6",
    soft: "rgba(244, 114, 182, 0.16)",
    bg: "rgba(244, 114, 182, 0.10)",
    border: "rgba(244, 114, 182, 0.38)",
    text: "#f9a8d4",
  },
  Music: {
    color: "#2dd4bf",
    soft: "rgba(45, 212, 191, 0.16)",
    bg: "rgba(45, 212, 191, 0.10)",
    border: "rgba(45, 212, 191, 0.38)",
    text: "#5eead4",
  },
  Nature: {
    color: "#10b981",
    soft: "rgba(16, 185, 129, 0.16)",
    bg: "rgba(16, 185, 129, 0.10)",
    border: "rgba(16, 185, 129, 0.38)",
    text: "#34d399",
  },
};

export const KNOWN_CATEGORIES = Object.keys(CATEGORY_STYLES);

export function categoryStyle(category: string): CategoryStyle {
  return CATEGORY_STYLES[category] ?? FALLBACK;
}

export function scoreColor(score: number): string {
  if (score >= 60) return "#10b981";
  if (score >= 35) return "#00d9ff";
  if (score >= 15) return "#8b5cf6";
  return "#f472b6";
}

export function formatNumber(value: number | null | undefined, fallback = "—"): string {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback;
  return new Intl.NumberFormat("en-US").format(value);
}