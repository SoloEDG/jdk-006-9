import type {
  ProgramEntry,
  RouteProgram,
  SavedProgram,
  SourceConfidence,
} from "../types";

type Obj = Record<string, unknown>;

function object(value: unknown, label: string): Obj {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label}格式无效`);
  return value as Obj;
}
function string(value: unknown, label: string): string {
  if (typeof value !== "string" || !value) throw new Error(`${label}必须是文字`);
  return value;
}
function number(value: unknown, label: string, min = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min)
    throw new Error(`${label}数值无效`);
  return value;
}
function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label}必须是列表`);
  return value;
}
function optionalStringArray(value: unknown, label: string): string[] {
  return array(value, label).map((item) => string(item, label));
}

const CONFIDENCE: SourceConfidence[] = ["recorded", "inferred", "uncertain"];

/**
 * 节目单文档的结构校验只依赖文档自身，
 * 因此原档或当前案件音源被删除后，文档仍可被读取与解释。
 */
export function validateSavedProgram(input: unknown): SavedProgram {
  const root = object(input, "节目单");
  if (root.version !== 1) throw new Error("不支持的节目单版本");
  const id = string(root.id, "节目单编号");
  const name = string(root.name, "节目单名称");
  const createdAt = number(root.createdAt, "保存时间");
  const caseId = string(root.caseId, "案件编号");
  const fingerprintObj = object(root.fingerprint, "内容指纹");
  string(fingerprintObj.caseId, "指纹案件编号");
  array(fingerprintObj.episodes, "指纹音源").forEach((value) => {
    const e = object(value, "指纹音源");
    string(e.id, "音源编号");
    string(e.sceneId, "场景编号");
    string(e.version, "音源版本");
    number(e.duration, "音源时长");
    string(e.audio, "音源路径");
  });
  optionalStringArray(fingerprintObj.sceneIds, "指纹场景");
  optionalStringArray(fingerprintObj.clueIds, "指纹线索");

  const sources = array(root.sources, "来源存档").map((value) => {
    const s = object(value, "来源存档");
    const snapshot = object(s.snapshot, "来源快照");
    if (snapshot.version !== 1) throw new Error("来源快照版本不支持");
    string(snapshot.caseId, "快照案件编号");
    object(snapshot.story, "快照调查进度");
    object(snapshot.evidence, "快照手记");
    object(snapshot.heard, "快照收听记录");
    object(snapshot.resume, "快照播放进度");
    return {
      slotId: string(s.slotId, "来源档案编号"),
      slotName: string(s.slotName, "来源档案名称"),
      slotUpdatedAt: number(s.slotUpdatedAt, "来源档案时间"),
      snapshot: snapshot as unknown as SavedProgram["sources"][number]["snapshot"],
    };
  });
  if (sources.length !== 2) throw new Error("节目单必须包含两份来源存档");

  const programs = array(root.programs, "路线节目单").map((value) =>
    validateRoute(value),
  );
  if (programs.length !== 2) throw new Error("节目单必须包含两条路线");

  const sharedCount = number(root.sharedCount, "共同片段数");
  const divergenceIndex =
    root.divergenceIndex === null
      ? null
      : number(root.divergenceIndex, "分歧位置");

  return {
    version: 1,
    id,
    name,
    createdAt,
    caseId,
    fingerprint: fingerprintObj as unknown as SavedProgram["fingerprint"],
    sources: sources as SavedProgram["sources"],
    programs: programs as [RouteProgram, RouteProgram],
    sharedCount,
    divergenceIndex,
  };
}

function validateRoute(input: unknown): RouteProgram {
  const root = object(input, "路线节目单");
  const entries = array(root.entries, "节目片段").map(validateEntry);
  return {
    slotId: string(root.slotId, "路线档案编号"),
    slotName: string(root.slotName, "路线档案名称"),
    slotUpdatedAt: number(root.slotUpdatedAt, "路线档案时间"),
    caseId: string(root.caseId, "路线案件编号"),
    entries,
    totalDuration: number(root.totalDuration, "节目单总时长"),
    warnings: optionalStringArray(root.warnings, "重建告警"),
    unknownTimingClues: optionalStringArray(
      root.unknownTimingClues,
      "时点未知线索",
    ),
  };
}

function validateEntry(input: unknown): ProgramEntry {
  const root = object(input, "节目片段");
  const confidence = string(root.confidence, "来源可信度") as SourceConfidence;
  if (!CONFIDENCE.includes(confidence)) throw new Error("来源可信度取值无效");
  const entry: ProgramEntry = {
    index: number(root.index, "片段序号"),
    sceneId: string(root.sceneId, "场景编号") as ProgramEntry["sceneId"],
    sceneTitle: string(root.sceneTitle, "场景标题"),
    chapter: string(root.chapter, "章节编号"),
    episodeId:
      typeof root.episodeId === "string" ? root.episodeId : "",
    episodeTitle: string(root.episodeTitle, "音源标题"),
    versionLabel: string(root.versionLabel, "版本标签"),
    audio: typeof root.audio === "string" ? root.audio : "",
    duration: number(root.duration, "片段时长"),
    wave: array(root.wave, "波形").map((v) =>
      number(v, "波形值", -Infinity),
    ),
    cues: array(root.cues, "字幕").map((value) => {
      const c = object(value, "字幕");
      const cue = {
        id: string(c.id, "字幕编号"),
        start: number(c.start, "字幕起点"),
        end: number(c.end, "字幕终点"),
        speaker: string(c.speaker, "说话人"),
        text: string(c.text, "字幕文本"),
      };
      if (c.sound && typeof c.sound === "object") {
        const s = c.sound as Obj;
        return {
          ...cue,
          sound: {
            clueId: string(s.clueId, "声音线索编号"),
            start: number(s.start, "声音起点"),
            end: number(s.end, "声音终点"),
            description: string(s.description, "声音描述"),
          },
        };
      }
      return cue;
    }),
    confidence,
    confidenceReason: string(root.confidenceReason, "来源说明"),
    enteredAt: number(root.enteredAt, "节目单时间"),
    cluesHeldBefore: optionalStringArray(root.cluesHeldBefore, "进入时线索"),
    clueEvents: array(root.clueEvents, "线索时点").map((value) => {
      const e = object(value, "线索时点");
      return {
        clueId: string(e.clueId, "线索编号"),
        title: string(e.title, "线索标题"),
        cueStart: number(e.cueStart, "线索起点"),
        cueEnd: number(e.cueEnd, "线索终点"),
        programStart: number(e.programStart, "节目内起点"),
        programEnd: number(e.programEnd, "节目内终点"),
        reached: typeof e.reached === "boolean" ? e.reached : false,
        noteId: e.noteId === null ? null : string(e.noteId, "笔记编号"),
        timingConfirmed:
          typeof e.timingConfirmed === "boolean"
            ? e.timingConfirmed
            : false,
      };
    }),
    arrivalChoice:
      root.arrivalChoice === null || root.arrivalChoice === undefined
        ? null
        : (() => {
            const a = object(root.arrivalChoice, "来源决策");
            return {
              sceneId: string(a.sceneId, "决策场景") as ProgramEntry["sceneId"],
              choiceId: string(a.choiceId, "决策选项"),
              label: string(a.label, "决策标签"),
            };
          })(),
    heardThrough:
      root.heardThrough === null ? null : number(root.heardThrough, "收听位置"),
    playable: typeof root.playable === "boolean" ? root.playable : false,
    candidateEpisodeIds: optionalStringArray(
      root.candidateEpisodeIds ?? [],
      "候选音源",
    ),
    sourceMissing:
      typeof root.sourceMissing === "boolean" ? root.sourceMissing : undefined,
  };
  return entry;
}
