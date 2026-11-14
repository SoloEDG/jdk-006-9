import test from "node:test";
import assert from "node:assert/strict";
import {
  CASE_CONTENT,
  createInvestigation,
  applyChoice,
  enterScene,
} from "../src/features/story";
import type {
  CaseSnapshot,
  EvidenceState,
  HeardHistory,
  Investigation,
  ResumePoint,
  SaveSlot,
  SceneId,
} from "../src/shared/types";
import { addNote } from "../src/features/evidence";
import {
  reconstructProgram,
  comparePrograms,
  validateSavedProgram,
  createSavedProgram,
  reconcileProgram,
  readPrograms,
  writeProgram,
  deleteProgram,
} from "../src/features/replay";

function makeSnapshot(
  story: Investigation,
  evidence: EvidenceState,
  heard: HeardHistory,
  resume?: Partial<ResumePoint>,
): CaseSnapshot {
  return {
    version: 1,
    caseId: CASE_CONTENT.id,
    story,
    evidence,
    heard,
    resume: {
      sceneId: story.sceneId,
      position: 0,
      rate: 1,
      ...resume,
    },
  };
}

function makeSlot(
  name: string,
  snapshot: CaseSnapshot,
  id = `slot-${name}`,
): SaveSlot {
  return { id, name, updatedAt: 1_700_000_000_000, snapshot };
}

function decide(
  story: Investigation,
  choiceId: string,
  clues: string[],
): Investigation {
  return applyChoice(CASE_CONTENT, story, choiceId, clues);
}

/** 路线 A：先码头，再守塔人；在到访守塔人之前已取得钟声线索 */
function routeA(): SaveSlot {
  let story = createInvestigation();
  story = decide(story, "visit-harbor", []);
  story = decide(story, "ask-keeper", []);
  let evidence = createEvidenceState();
  // 钟声笔记锚定在 arrival 录音内，时间早于 interview
  evidence = addNote(
    evidence,
    { sceneId: "arrival", start: 15.19, end: 17.19 },
    "三声钟响",
    "声音线索",
  );
  evidence = { ...evidence, clues: [...evidence.clues, "bell"] };
  evidence.notes = evidence.notes.map((n) => ({ ...n, clueId: "bell" }));
  evidence = addNote(
    evidence,
    { sceneId: "harbor", start: 5.182, end: 7.182 },
    "雾笛",
    "声音线索",
  );
  evidence = { ...evidence, clues: [...evidence.clues, "horn"] };
  evidence.notes = evidence.notes.map((n) =>
    n.clueId === null ? { ...n, clueId: "horn" } : n,
  );
  const heard: HeardHistory = {
    "arrival-normal": 20,
    "harbor-normal": 6,
    "interview-aware": 8,
  };
  return makeSlot("路线A", makeSnapshot(story, evidence, heard));
}

/** 路线 B：直接拜访守塔人，且没有钟声取得记录 */
function routeB(): SaveSlot {
  let story = createInvestigation();
  story = decide(story, "visit-keeper", []);
  const evidence = createEvidenceState();
  const heard: HeardHistory = {
    "arrival-normal": 10,
    "interview-normal": 6,
  };
  return makeSlot("路线B", makeSnapshot(story, evidence, heard));
}

function createEvidenceState(): EvidenceState {
  return { notes: [], clues: [], selectedId: null };
}

test("节目单按存档决策顺序串联场景，并累计节目单时间", () => {
  const program = reconstructProgram(CASE_CONTENT, routeA());
  assert.deepEqual(
    program.entries.map((e) => e.sceneId),
    ["arrival", "harbor", "interview"],
  );
  assert.equal(program.entries[0].enteredAt, 0);
  assert.ok(program.entries[1].enteredAt > 0);
  assert.equal(
    program.entries[2].enteredAt,
    CASE_CONTENT.episodes.find((e) => e.id === "arrival-normal")!.duration +
      CASE_CONTENT.episodes.find((e) => e.id === "harbor-normal")!.duration,
  );
  assert.equal(
    program.entries[1].arrivalChoice?.choiceId,
    "visit-harbor",
  );
});

test("不拿最终线索重算：依据取得时点，同一场景还原出不同版本", () => {
  const a = reconstructProgram(CASE_CONTENT, routeA());
  const b = reconstructProgram(CASE_CONTENT, routeB());
  const interviewA = a.entries.find((e) => e.sceneId === "interview")!;
  const interviewB = b.entries.find((e) => e.sceneId === "interview")!;
  assert.equal(interviewA.episodeId, "interview-aware");
  assert.equal(interviewB.episodeId, "interview-normal");
  // A、B 的版本都由各自原档的收听记录直接证实
  assert.equal(interviewA.confidence, "recorded");
  assert.equal(interviewB.confidence, "recorded");
  // A 在进入 interview 前，严格只持有更早场景取得的线索
  assert.deepEqual(interviewA.cluesHeldBefore.sort(), ["bell", "horn"]);
  assert.deepEqual(interviewB.cluesHeldBefore, []);
});

test("没有多版本收听记录时，版本依据线索取得时点推断", () => {
  let story = createInvestigation();
  story = decide(story, "visit-keeper", []);
  let evidence = createEvidenceState();
  evidence = addNote(
    evidence,
    { sceneId: "arrival", start: 15.19, end: 17.19 },
    "钟声",
    "声音线索",
  );
  evidence = { ...evidence, clues: ["bell"] };
  evidence.notes = evidence.notes.map((n) => ({ ...n, clueId: "bell" }));
  // 只有 arrival 的收听记录，interview 两版均无记录 → 走推断
  const slot = makeSlot(
    "推断路线",
    makeSnapshot(story, evidence, { "arrival-normal": 20 }),
  );
  const program = reconstructProgram(CASE_CONTENT, slot);
  const interview = program.entries.find((e) => e.sceneId === "interview")!;
  assert.equal(interview.episodeId, "interview-aware");
  assert.equal(interview.confidence, "inferred");
});

test("最终线索列表存在但原档无取得笔记时，相关片段标注来源不确定而非冒充还原", () => {
  let story = createInvestigation();
  story = decide(story, "visit-keeper", ["bell"]);
  const evidence: EvidenceState = {
    notes: [],
    clues: ["bell"],
    selectedId: null,
  };
  const slot = makeSlot(
    "缺时点",
    makeSnapshot(story, evidence, {}),
  );
  const program = reconstructProgram(CASE_CONTENT, slot);
  const interview = program.entries.find((e) => e.sceneId === "interview")!;
  assert.equal(interview.confidence, "uncertain");
  assert.equal(interview.playable, false);
  assert.ok(interview.candidateEpisodeIds.includes("interview-normal"));
  assert.ok(interview.candidateEpisodeIds.includes("interview-aware"));
  assert.ok(program.unknownTimingClues.includes("bell"));
  assert.ok(
    program.warnings.some((w) => w.includes("取得时点无法还原")),
  );
});

test("线索取得时点以场景内时间标注，并区分是否被原档收听记录证实", () => {
  const program = reconstructProgram(CASE_CONTENT, routeA());
  const arrival = program.entries[0];
  const bellEvent = arrival.clueEvents.find((e) => e.clueId === "bell")!;
  assert.equal(bellEvent.cueStart, 15.19);
  assert.equal(bellEvent.reached, true);
  assert.equal(bellEvent.timingConfirmed, true);
  // 未听到声音结束位置的线索 reached 为 false
  const harbor = program.entries[1];
  const hornEvent = harbor.clueEvents.find((e) => e.clueId === "horn")!;
  assert.equal(hornEvent.reached, false);
});

test("共同片段与第一次分歧按同序数音源比较", () => {
  const a = reconstructProgram(CASE_CONTENT, routeA());
  const b = reconstructProgram(CASE_CONTENT, routeB());
  const comparison = comparePrograms(a, b);
  assert.equal(comparison.sharedCount, 1);
  assert.equal(comparison.divergence?.index, 1);
});

test("单音源场景始终标记已证实，决策序列外的到访不影响顺序", () => {
  const program = reconstructProgram(CASE_CONTENT, routeB());
  const arrival = program.entries[0];
  assert.equal(arrival.confidence, "recorded");
  assert.equal(arrival.episodeId, "arrival-normal");
});

test("收听记录与线索推断冲突时以收听记录为准，并留下告警", () => {
  const slot = routeB();
  // 构造矛盾：没有任何钟声取得记录，却有 aware 版本的收听记录
  slot.snapshot.heard = {
    "arrival-normal": 10,
    "interview-aware": 5,
  };
  const program = reconstructProgram(CASE_CONTENT, slot);
  const interview = program.entries.find((e) => e.sceneId === "interview")!;
  assert.equal(interview.episodeId, "interview-aware");
  assert.equal(interview.confidence, "recorded");
  assert.ok(program.warnings.some((w) => w.includes("收听记录为准")));
});

test("保存的节目单是自包含文档，通过结构校验且原档删除后仍可解释来源", () => {
  const saved = createSavedProgram(
    CASE_CONTENT,
    [routeA(), routeB()],
    "对照一",
    "program-1",
    1_700_000_000_001,
  );
  const reparsed = validateSavedProgram(JSON.parse(JSON.stringify(saved)));
  assert.equal(reparsed.id, "program-1");
  assert.equal(reparsed.sources.length, 2);
  assert.equal(reparsed.programs[0].entries.length, 3);
  // 内嵌快照包含完整字幕与波形
  assert.ok(reparsed.programs[0].entries[0].cues.length > 0);
  assert.ok(reparsed.programs[0].entries[0].wave.length > 0);
  assert.equal(reparsed.divergenceIndex, 1);
});

test("对账时把已移除音源标记为来源缺失，但保留字幕快照", () => {
  const saved = createSavedProgram(
    CASE_CONTENT,
    [routeA(), routeB()],
    "对照二",
    "program-2",
    1_700_000_000_002,
  );
  const trimmed = {
    ...CASE_CONTENT,
    episodes: CASE_CONTENT.episodes.filter(
      (e) => e.id !== "interview-aware",
    ),
  };
  const { program, drift } = reconcileProgram(saved, trimmed);
  assert.ok(drift.some((d) => d.includes("interview-aware")));
  const interview = program.programs[0].entries.find(
    (e) => e.episodeId === "interview-aware",
  )!;
  assert.equal(interview.playable, false);
  assert.equal(interview.sourceMissing, true);
  assert.ok(interview.cues.length > 0);
});

test("节目单存储独立于调查存档，损坏项可跳过且有数量上限", () => {
  const memory = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, val: string) => memory.set(key, val),
    },
  });
  const saved = createSavedProgram(
    CASE_CONTENT,
    [routeA(), routeB()],
    "对照三",
    "program-3",
    1_700_000_000_003,
  );
  let list = writeProgram([], saved);
  assert.equal(readPrograms().programs.length, 1);
  assert.equal(deleteProgram(list, saved.id).length, 0);
  for (let i = 0; i < 8; i++) {
    list = writeProgram(
      i === 0 ? [] : list,
      { ...saved, id: `p-${i}`, name: `节目单 ${i}` },
    );
  }
  assert.throws(() => writeProgram(list, { ...saved, id: "ninth" }), /8/);
  for (const key of memory.keys()) memory.set(key, "corrupt");
  assert.ok(readPrograms().warning);
});

test("来源快照中的场景顺序异常时产生告警但不抛错", () => {
  const slot = routeB();
  // 人为制造一条与当前场景不一致的决策记录
  slot.snapshot.story.decisions.unshift({
    sceneId: "tower" as SceneId,
    choiceId: "solve",
  });
  const program = reconstructProgram(CASE_CONTENT, slot);
  assert.ok(program.warnings.length > 0);
  assert.ok(program.entries.length >= 2);
});

test("长度不同的路线：分歧点落在较短路线终点，且不越界", () => {
  const short = reconstructProgram(CASE_CONTENT, routeB());
  const long = reconstructProgram(CASE_CONTENT, routeA());
  const comparison = comparePrograms(long, short);
  // short 在第 2 段（index 1）之后没有更多片段
  assert.equal(comparison.divergence?.index, 1);
  assert.ok(long.entries.length > short.entries.length);
});

test("重建过程不修改输入存档", () => {
  const slot = routeA();
  const snapshotBefore = JSON.stringify(slot.snapshot);
  reconstructProgram(CASE_CONTENT, slot);
  assert.equal(JSON.stringify(slot.snapshot), snapshotBefore);
});

test("enterScene 仍保持原有序列语义（回归保护）", () => {
  const story = enterScene(CASE_CONTENT, createInvestigation(), "harbor");
  assert.deepEqual(story.visited, ["arrival", "harbor"]);
});
