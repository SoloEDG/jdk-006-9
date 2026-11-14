import type {
  CaseSnapshot,
  Cue,
  SceneId,
} from "../../shared/types";

/**
 * 片段来源可信度：
 * - recorded  已证实：原档收听记录或唯一音源可确定版本
 * - inferred  推断：原档未直接记录音源，但依据线索取得时点可唯一推断
 * - uncertain 来源不确定：原档信息不足以确定版本，允许跳过，不得冒充还原
 */
export type SourceConfidence = "recorded" | "inferred" | "uncertain";

export interface ProgramClueEvent {
  clueId: string;
  title: string;
  /** 片段内时间（秒） */
  cueStart: number;
  cueEnd: number;
  /** 整张节目单的累计时间（秒） */
  programStart: number;
  programEnd: number;
  /** 原档收听记录是否证明听到了该声音结束位置 */
  reached: boolean;
  /** 原档中对应的线索笔记编号（无则表示未收集或时点未知） */
  noteId: string | null;
  /** 取得时点是否来自原档可证实的记录 */
  timingConfirmed: boolean;
}

export interface ProgramEntry {
  index: number;
  sceneId: SceneId;
  sceneTitle: string;
  chapter: string;
  /** 解析出的音源编号；当前案件内容缺失时为空字符串 */
  episodeId: string;
  episodeTitle: string;
  versionLabel: string;
  audio: string;
  duration: number;
  wave: number[];
  cues: Cue[];
  confidence: SourceConfidence;
  confidenceReason: string;
  /** 该片段在整张节目单中的起点（秒） */
  enteredAt: number;
  /** 进入该片段前，依据原档可证实已掌握的线索 */
  cluesHeldBefore: string[];
  clueEvents: ProgramClueEvent[];
  /** 引导进入该片段的决策（首个片段为 null） */
  arrivalChoice: {
    sceneId: SceneId;
    choiceId: string;
    label: string;
  } | null;
  /** 原档收听记录中该音源听到的位置（秒），无记录为 null */
  heardThrough: number | null;
  /** 音源在当前案件内容中是否仍可播放 */
  playable: boolean;
  /** 该场景当前案件内容中的候选音源编号（来源不确定时用于说明范围） */
  candidateEpisodeIds: string[];
  /** 节目单保存后，原音源已从当前案件内容中移除（字幕与来源说明仍保留） */
  sourceMissing?: boolean;
}

export interface RouteProgram {
  slotId: string;
  slotName: string;
  slotUpdatedAt: number;
  caseId: string;
  entries: ProgramEntry[];
  totalDuration: number;
  /** 重建过程中产生的告警（原档矛盾、缺失等） */
  warnings: string[];
  /** 已在最终线索列表但原档无法确定取得时点的线索 */
  unknownTimingClues: string[];
}

export interface DivergencePoint {
  /** 第一条不一致片段的序号 */
  index: number;
  reason: string;
}

export interface ReplayComparison {
  a: RouteProgram;
  b: RouteProgram;
  /** 序数一致的共同片段数量 */
  sharedCount: number;
  /** 第一次分歧；两条节目单完全一致时为 null */
  divergence: DivergencePoint | null;
}

export interface ContentFingerprintEpisode {
  id: string;
  sceneId: SceneId;
  version: string;
  duration: number;
  audio: string;
}

export interface ContentFingerprint {
  caseId: string;
  episodes: ContentFingerprintEpisode[];
  sceneIds: SceneId[];
  clueIds: string[];
}

/** 保存后的节目单是自包含文档：内嵌原档快照与字幕，原档删除后仍可解释来源 */
export interface SavedProgram {
  version: 1;
  id: string;
  name: string;
  createdAt: number;
  caseId: string;
  fingerprint: ContentFingerprint;
  sources: Array<{
    slotId: string;
    slotName: string;
    slotUpdatedAt: number;
    snapshot: CaseSnapshot;
  }>;
  programs: [RouteProgram, RouteProgram];
  sharedCount: number;
  divergenceIndex: number | null;
}

export function entryMatchKey(entry: ProgramEntry): string {
  return `${entry.sceneId}@${entry.episodeId || "missing"}`;
}

export function confidenceLabel(confidence: SourceConfidence): string {
  switch (confidence) {
    case "recorded":
      return "已证实";
    case "inferred":
      return "版本推断";
    case "uncertain":
      return "来源不确定";
  }
}
