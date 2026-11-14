import type { CaseContent } from "../../../shared/types";
import type {
  ContentFingerprint,
  RouteProgram,
  SavedProgram,
} from "../types";
import { comparePrograms, reconstructProgram } from "./reconstruct";
import type { SaveSlot } from "../../../shared/types";

export function buildFingerprint(content: CaseContent): ContentFingerprint {
  return {
    caseId: content.id,
    episodes: content.episodes.map((e) => ({
      id: e.id,
      sceneId: e.sceneId,
      version: e.version,
      duration: e.duration,
      audio: e.audio,
    })),
    sceneIds: content.scenes.map((s) => s.id),
    clueIds: content.clues.map((c) => c.id),
  };
}

export interface ReconcileResult {
  program: SavedProgram;
  /** 节目单保存后，案件内容与保存时指纹之间的差异说明 */
  drift: string[];
}

/**
 * 打开已保存节目单时与当前案件内容对账。
 * 节目单本身自包含：原档删除后字幕、波形、来源说明仍然可解释，
 * 仅音频播放能力与可证实性需要重新判定。
 */
export function reconcileProgram(
  program: SavedProgram,
  content: CaseContent,
): ReconcileResult {
  const drift: string[] = [];
  if (content.id !== program.caseId) {
    drift.push("节目单来自其他案件，音频与字幕仅供只读对照。");
  }
  const currentIds = new Set(content.episodes.map((e) => e.id));
  const savedIds = new Set(program.fingerprint.episodes.map((e) => e.id));
  for (const id of savedIds) {
    if (!currentIds.has(id)) {
      drift.push(`保存时存在的音源「${id}」已从当前案件内容中移除。`);
    }
  }
  for (const id of currentIds) {
    if (!savedIds.has(id)) {
      drift.push(`当前案件新增了音源「${id}」，节目单不会自动重算。`);
    }
  }
  const cloned: SavedProgram = structuredClone(program);
  for (const route of cloned.programs) {
    for (const entry of route.entries) {
      const exists = entry.episodeId !== "" && currentIds.has(entry.episodeId);
      entry.sourceMissing = !exists;
      entry.playable = exists;
    }
  }
  return { program: cloned, drift };
}

export function createSavedProgram(
  content: CaseContent,
  slots: [SaveSlot, SaveSlot],
  name: string,
  id: string,
  createdAt: number,
): SavedProgram {
  const programs: [RouteProgram, RouteProgram] = [
    reconstructProgram(content, slots[0]),
    reconstructProgram(content, slots[1]),
  ];
  const comparison = comparePrograms(programs[0], programs[1]);
  return {
    version: 1,
    id,
    name: name.trim(),
    createdAt,
    caseId: content.id,
    fingerprint: buildFingerprint(content),
    sources: slots.map((slot) => ({
      slotId: slot.id,
      slotName: slot.name,
      slotUpdatedAt: slot.updatedAt,
      snapshot: structuredClone(slot.snapshot),
    })) as SavedProgram["sources"],
    programs,
    sharedCount: comparison.sharedCount,
    divergenceIndex: comparison.divergence?.index ?? null,
  };
}
