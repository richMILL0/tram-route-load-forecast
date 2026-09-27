import type { LoadLevel } from "../types/route";

export const LOAD_COLORS: Record<LoadLevel, string> = {
  LOW: "#258a52",
  MEDIUM: "#b08b12",
  HIGH: "#b75d1b",
  CRITICAL: "#a92f2a",
};

export const LOAD_LABELS: Record<LoadLevel, string> = {
  LOW: "Низкая",
  MEDIUM: "Средняя",
  HIGH: "Высокая",
  CRITICAL: "Критическая",
};

export const NEUTRAL_ROUTE_COLOR = "#3f4650";

