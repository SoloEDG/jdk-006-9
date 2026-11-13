import type { Cue, Episode, HeardHistory } from "../../../shared/types";
import { hasHeardThrough } from "../../../shared/heard";
export function canCollectSound(
  history: HeardHistory,
  episode: Episode,
  cue: Cue,
): boolean {
  return (
    !!cue.sound &&
    episode.cues.some((item) => item.id === cue.id) &&
    hasHeardThrough(history, episode.id, cue.sound.end)
  );
}
