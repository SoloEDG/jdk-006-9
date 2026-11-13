import type {
  AudioBookmark,
  Cue,
  Episode,
  EvidenceState,
  HeardHistory,
} from "../../../shared/types";
import { canCollectSound } from "./eligibility";
import { addNote } from "./notes";
export function collectClue(
  state: EvidenceState,
  episode: Episode,
  cue: Cue,
  heard: HeardHistory,
  bookmark: AudioBookmark,
): EvidenceState | null {
  if (
    !cue.sound ||
    state.clues.includes(cue.sound.clueId) ||
    !canCollectSound(heard, episode, cue)
  )
    return null;
  const next = addNote(state, bookmark, cue.sound.description, "声音线索");
  return {
    ...next,
    clues: [...state.clues, cue.sound.clueId],
    notes: next.notes.map((note) =>
      note.id === next.selectedId
        ? { ...note, clueId: cue.sound!.clueId }
        : note,
    ),
  };
}
