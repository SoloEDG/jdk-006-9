import type { Cue, Episode, HeardHistory } from "../../../shared/types";
import { hasHeardThrough } from "../../../shared/heard";
export function currentCue(episode: Episode, position: number): Cue | null {
  return (
    episode.cues.find((c) => position >= c.start && position < c.end) ?? null
  );
}
export function isCueHeard(history: HeardHistory, episode: Episode, cue: Cue) {
  return hasHeardThrough(history, episode.id, cue.end);
}
export function searchCues(
  episode: Episode,
  query: string,
  history: HeardHistory,
) {
  const q = query.trim().toLocaleLowerCase();
  return episode.cues.filter(
    (c) =>
      !q ||
      (isCueHeard(history, episode, c) &&
        `${c.speaker}${c.text}`.toLocaleLowerCase().includes(q)),
  );
}
