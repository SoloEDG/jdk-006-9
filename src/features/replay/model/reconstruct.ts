import type {
  CaseContent,
  CaseSnapshot,
  Episode,
  SaveSlot,
  SceneId,
} from "../../../shared/types";
import { resolveEpisode } from "../../story/lib/resolveEpisode";
import type {
  DivergencePoint,
  ProgramClueEvent,
  ProgramEntry,
  ReplayComparison,
  RouteProgram,
  SourceConfidence,
} from "../types";
import { entryMatchKey } from "../types";

interface ClueTiming {
  sceneId: SceneId;
  start: number;
  end: number;
  noteId: string;
  /** 当前案件内容中仍能找到对应声音片段 */
  contentMatch: boolean;
}

const HEARD_TOLERANCE = 0.08;

/**
 * 当前案件中，同一场景存在多版录音时，版本分别依赖哪些线索。
 * 这是对 resolveEpisode 规则的显式声明，用于判断原档是否足以确定版本。
 */
function versionSensitiveClues(
  content: CaseContent,
  sceneId: SceneId,
): string[] {
  const candidates = content.episodes.filter((e) => e.sceneId === sceneId);
  if (candidates.length <= 1) return [];
  return sceneId === "interview" ? ["bell"] : [];
}

function clueTitle(content: CaseContent, clueId: string): string {
  return content.clues.find((c) => c.id === clueId)?.title ?? clueId;
}

/**
 * 只依据原档中的线索笔记锚点还原「线索取得时点」。
 * 最终线索列表里找不到对应笔记的线索，视为时点未知——
 * 绝不假定它在更早的片段已经掌握。
 */
function buildClueTiming(
  content: CaseContent,
  snapshot: CaseSnapshot,
  warnings: string[],
): Map<string, ClueTiming> {
  const timing = new Map<string, ClueTiming>();
  for (const note of snapshot.evidence.notes) {
    if (!note.clueId) continue;
    const sceneEpisodes = content.episodes.filter(
      (e) => e.sceneId === note.anchor.sceneId,
    );
    const match = sceneEpisodes.some((e) =>
      e.cues.some((c) => c.sound?.clueId === note.clueId),
    );
    const known = timing.get(note.clueId);
    const next: ClueTiming = {
      sceneId: note.anchor.sceneId,
      start: note.anchor.start,
      end: note.anchor.end,
      noteId: note.id,
      contentMatch: match,
    };
    if (!known || note.anchor.start < known.start) timing.set(note.clueId, next);
  }
  for (const clueId of snapshot.evidence.clues) {
    const known = timing.get(clueId);
    if (!known) {
      warnings.push(
        `线索「${clueTitle(content, clueId)}」在原档中没有取得笔记，取得时点无法还原。`,
      );
    } else if (!known.contentMatch) {
      warnings.push(
        `线索「${clueTitle(content, clueId)}」的笔记锚点在当前案件音源中找不到对应声音。`,
      );
    }
  }
  return timing;
}

/** 按存档中的决策顺序重放出访场景序列，不做任何新的选择。 */
function replaySceneSequence(
  content: CaseContent,
  snapshot: CaseSnapshot,
  warnings: string[],
): SceneId[] {
  const sequence: SceneId[] = ["arrival"];
  let current: SceneId = "arrival";
  for (const decision of snapshot.story.decisions) {
    const scene = content.scenes.find((s) => s.id === decision.sceneId);
    const choice = scene?.choices.find((c) => c.id === decision.choiceId);
    if (!scene || !choice) {
      warnings.push(
        `原档决策（${decision.sceneId} / ${decision.choiceId}）在当前案件内容中无法识别，节目单在此截断。`,
      );
      break;
    }
    if (decision.sceneId !== current) {
      warnings.push(
        `原档决策顺序与到访场景不一致：预期停留在 ${current}，却记录了 ${decision.sceneId} 的选择，已按原档目标续接。`,
      );
    }
    sequence.push(choice.target);
    current = choice.target;
  }
  if (sequence[sequence.length - 1] !== snapshot.story.sceneId) {
    warnings.push(
      `原档当前场景为 ${snapshot.story.sceneId}，决策序列终点为 ${current}，以决策序列为准重建。`,
    );
  }
  return sequence;
}

function pickByHeard(
  candidates: Episode[],
  heard: Record<string, number>,
): { episode: Episode; reason: string } | null {
  const withHeard = candidates.filter((e) => (heard[e.id] ?? 0) > 0);
  if (withHeard.length === 0) return null;
  if (withHeard.length === 1) {
    return {
      episode: withHeard[0],
      reason: "原档收听记录明确指向该版本录音。",
    };
  }
  const best = withHeard.reduce((a, b) =>
    (heard[a.id] ?? 0) >= (heard[b.id] ?? 0) ? a : b,
  );
  return {
    episode: best,
    reason: "原档含多版本收听记录，按收听进度最长的版本还原。",
  };
}

function buildClueEvents(
  content: CaseContent,
  entry: Pick<ProgramEntry, "sceneId" | "episodeId" | "enteredAt">,
  episode: Episode | null,
  timing: Map<string, ClueTiming>,
  heardThrough: number | null,
): ProgramClueEvent[] {
  const events: ProgramClueEvent[] = [];
  for (const [clueId, t] of timing) {
    if (t.sceneId !== entry.sceneId) continue;
    const cue = episode?.cues.find((c) => c.sound?.clueId === clueId);
    const cueStart = cue?.sound?.start ?? t.start;
    const cueEnd = cue?.sound?.end ?? t.end;
    events.push({
      clueId,
      title: clueTitle(content, clueId),
      cueStart,
      cueEnd,
      programStart: entry.enteredAt + cueStart,
      programEnd: entry.enteredAt + cueEnd,
      reached:
        heardThrough !== null && heardThrough >= cueEnd - HEARD_TOLERANCE,
      noteId: t.noteId,
      timingConfirmed: t.contentMatch,
    });
  }
  return events.sort((a, b) => a.cueStart - b.cueStart);
}

/**
 * 依据一份历史存档重建连续节目单。
 * 只回放存档中真实发生过的决策与笔记，线索持有状态按时点推进，
 * 不会用存档最终掌握的线索倒推早期对白版本。
 */
export function reconstructProgram(
  content: CaseContent,
  slot: SaveSlot,
): RouteProgram {
  const snapshot = slot.snapshot;
  const warnings: string[] = [];
  const timing = buildClueTiming(content, snapshot, warnings);
  const sequence = replaySceneSequence(content, snapshot, warnings);
  const unknownTimingClues = snapshot.evidence.clues.filter(
    (id) => !timing.has(id),
  );

  const entries: ProgramEntry[] = [];
  let enteredAt = 0;
  const visitedScenes: SceneId[] = [];

  sequence.forEach((sceneId, index) => {
    const scene = content.scenes.find((s) => s.id === sceneId);
    const candidates = content.episodes.filter((e) => e.sceneId === sceneId);
    // 严格的时点语义：只有在更早片段取得的线索才算「进入时已掌握」
    const cluesHeldBefore = [...timing.entries()]
      .filter(([, t]) => visitedScenes.includes(t.sceneId))
      .map(([id]) => id);

    let episodeId = "";
    let episode: Episode | null = null;
    let confidence: SourceConfidence;
    let confidenceReason = "";
    let candidateIds: string[] = candidates.map((e) => e.id);

    if (candidates.length === 0) {
      confidence = "uncertain";
      confidenceReason = "当前案件内容缺少该场景的音源，原档无法确定具体录音。";
    } else if (candidates.length === 1) {
      episode = candidates[0];
      episodeId = episode.id;
      confidence = "recorded";
      confidenceReason = "该场景只收录了一版录音，版本由案件内容本身确定。";
    } else {
      const heardPick = pickByHeard(candidates, snapshot.heard);
      const sensitive = versionSensitiveClues(content, sceneId);
      const blockedByUnknown = sensitive.some((id) =>
        unknownTimingClues.includes(id),
      );
      if (heardPick) {
        episode = heardPick.episode;
        episodeId = episode.id;
        confidence = "recorded";
        confidenceReason = heardPick.reason;
        // 收听记录是直接证据；若与时点推断冲突，以记录为准并留痕
        const inferred = resolveEpisode(content, sceneId, cluesHeldBefore);
        if (inferred.id !== episode.id) {
          warnings.push(
            `第 ${index + 1} 片段的收听记录与线索时点推断版本不一致，已以收听记录为准。`,
          );
        }
      } else if (blockedByUnknown) {
        confidence = "uncertain";
        confidenceReason = `原档缺少线索「${sensitive
          .filter((id) => unknownTimingClues.includes(id))
          .map((id) => clueTitle(content, id))
          .join("、")}」的取得时点，无法确定该场景当时播放的版本。`;
      } else {
        episode = resolveEpisode(content, sceneId, cluesHeldBefore);
        episodeId = episode.id;
        confidence = "inferred";
        const held = sensitive.filter((id) => cluesHeldBefore.includes(id));
        confidenceReason = held.length
          ? `原档笔记显示进入前已掌握「${held
              .map((id) => clueTitle(content, id))
              .join("、")}」，版本可唯一推断。`
          : `原档中没有更早取得「${sensitive
              .map((id) => clueTitle(content, id))
              .join("、")}」的记录，按初次到访版本推断。`;
      }
    }

    const heardThrough = episodeId ? (snapshot.heard[episodeId] ?? null) : null;
    const base = {
      index,
      sceneId,
      sceneTitle: scene?.title ?? sceneId,
      chapter: scene?.chapter ?? "—",
      episodeId,
      episodeTitle: episode?.title ?? scene?.title ?? "缺失音源",
      versionLabel: episode?.version ?? "版本未知",
      audio: episode?.audio ?? "",
      duration: episode?.duration ?? 0,
      wave: episode?.wave ?? [],
      cues: episode?.cues ?? [],
      enteredAt,
      cluesHeldBefore,
      arrivalChoice: null as ProgramEntry["arrivalChoice"],
      heardThrough,
      playable: Boolean(episode),
      candidateEpisodeIds: candidateIds,
    };
    const clueEvents = buildClueEvents(
      content,
      base,
      episode,
      timing,
      heardThrough,
    );
    entries.push({
      ...base,
      confidence,
      confidenceReason,
      clueEvents,
    });
    enteredAt += base.duration;
    visitedScenes.push(sceneId);
  });

  // 回填每个片段的来源决策标签
  entries.forEach((entry, index) => {
    if (index === 0) return;
    const decision = snapshot.story.decisions[index - 1];
    if (!decision) return;
    const choice = content.scenes
      .find((s) => s.id === decision.sceneId)
      ?.choices.find((c) => c.id === decision.choiceId);
    entry.arrivalChoice = choice
      ? {
          sceneId: decision.sceneId,
          choiceId: choice.id,
          label: choice.label,
        }
      : null;
  });

  return {
    slotId: slot.id,
    slotName: slot.name,
    slotUpdatedAt: slot.updatedAt,
    caseId: content.id,
    entries,
    totalDuration: enteredAt,
    warnings,
    unknownTimingClues,
  };
}

export function comparePrograms(
  a: RouteProgram,
  b: RouteProgram,
): ReplayComparison {
  const limit = Math.min(a.entries.length, b.entries.length);
  let sharedCount = 0;
  let divergence: DivergencePoint | null = null;
  for (let i = 0; i < limit; i++) {
    if (entryMatchKey(a.entries[i]) !== entryMatchKey(b.entries[i])) {
      divergence = {
        index: i,
        reason: "两份存档在这一步选择了不同的调查方向或听到了不同版本的录音。",
      };
      break;
    }
    sharedCount = i + 1;
  }
  if (!divergence && a.entries.length !== b.entries.length) {
    divergence = {
      index: limit,
      reason: "一条路线在此转入了其他场景，另一条路线继续向前。",
    };
  }
  return { a, b, sharedCount, divergence };
}
