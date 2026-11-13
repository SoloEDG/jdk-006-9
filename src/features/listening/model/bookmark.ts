import type { AudioBookmark, SceneId } from "../../../shared/types";
import { bounded } from "../../../shared/time";
export function captureWindow(
  sceneId: SceneId,
  position: number,
  duration: number,
  width = 4,
): AudioBookmark | null {
  if (!Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0)
    return null;
  const end = bounded(position, 0, duration),
    start = Math.max(0, end - bounded(width, 0.1, 30));
  return { sceneId, start, end };
}
