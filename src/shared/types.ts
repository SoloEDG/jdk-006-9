export type SceneId = "arrival" | "harbor" | "interview" | "tower" | "finale";
export interface Cue {
  id: string;
  start: number;
  end: number;
  speaker: string;
  text: string;
  sound?: { clueId: string; start: number; end: number; description: string };
}
export interface Episode {
  id: string;
  sceneId: SceneId;
  title: string;
  version: string;
  description: string;
  audio: string;
  duration: number;
  cues: Cue[];
  wave: number[];
}
export interface ClueDefinition {
  id: string;
  title: string;
  kind: string;
  description: string;
}
export interface Choice {
  id: string;
  label: string;
  target: SceneId;
  requires: string[];
  description: string;
}
export interface Scene {
  id: SceneId;
  title: string;
  location: string;
  chapter: string;
  description: string;
  choices: Choice[];
}
export interface CaseContent {
  id: string;
  title: string;
  scenes: Scene[];
  episodes: Episode[];
  clues: ClueDefinition[];
}
export interface Investigation {
  sceneId: SceneId;
  visited: SceneId[];
  decisions: { sceneId: SceneId; choiceId: string }[];
  ending: string | null;
}
export type HeardHistory = Record<string, number>;
export interface AudioBookmark {
  sceneId: SceneId;
  start: number;
  end: number;
}
export interface EvidenceNote {
  id: string;
  clueId: string | null;
  title: string;
  text: string;
  anchor: AudioBookmark;
  createdAt: number;
  pinned: boolean;
}
export interface EvidenceState {
  notes: EvidenceNote[];
  clues: string[];
  selectedId: string | null;
}
export interface ResumePoint {
  sceneId: SceneId;
  position: number;
  rate: number;
}
export interface CaseSnapshot {
  version: 1;
  caseId: string;
  story: Investigation;
  evidence: EvidenceState;
  heard: HeardHistory;
  resume: ResumePoint;
}
export interface SaveSlot {
  id: string;
  name: string;
  updatedAt: number;
  snapshot: CaseSnapshot;
}
export interface TransportState {
  requestedId: string;
  loadedId: string | null;
  position: number;
  duration: number;
  playing: boolean;
  loading: boolean;
  rate: number;
  volume: number;
  error: string | null;
}
export interface CapturePort {
  captureRange: (sceneId: SceneId, width?: number) => AudioBookmark | null;
}
