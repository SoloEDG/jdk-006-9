import type { HeardHistory } from "./types";
export function hasHeardThrough(
  history: HeardHistory,
  sourceId: string,
  end: number,
): boolean {
  return (
    Number.isFinite(end) && end >= 0 && (history[sourceId] || 0) >= end - 0.08
  );
}
export function markHeard(
  history: HeardHistory,
  sourceId: string,
  position: number,
): HeardHistory {
  if (!Number.isFinite(position) || position < 0) return history;
  return { ...history, [sourceId]: Math.max(history[sourceId] || 0, position) };
}
