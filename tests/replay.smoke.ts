import assert from "node:assert/strict";
import { CASE_CONTENT } from "../src/features/story";
import {
  reconstructProgram,
  comparePrograms,
  createSavedProgram,
  reconcileProgram,
  validateSavedProgram,
} from "../src/features/replay";
import type { CaseContent, CaseSnapshot, SaveSlot } from "../src/shared/types";

function snapshot(overrides: Partial<CaseSnapshot["story"]> = {}): CaseSnapshot {
  return {
    version: 1,
    caseId: CASE_CONTENT.id,
    story: {
      sceneId: "interview",
      visited: ["arrival", "interview"],
      decisions: [{ sceneId: "arrival", choiceId: "visit-keeper" }],
      ending: null,
      ...overrides,
    },
    evidence: { notes: [], clues: [], selectedId: null },
    heard: {},
    resume: { sceneId: "interview", position: 0, rate: 1 },
  };
}

const slot = (id: string, snap: CaseSnapshot): SaveSlot => ({
  id,
  name: id,
  updatedAt: 1,
  snapshot: snap,
});

// 1. 无任何线索取得记录 → interview 版本只能推断
const p1 = reconstructProgram(
  CASE_CONTENT,
  slot("s1", snapshot()),
);
assert.equal(p1.entries.map((e) => e.episodeId).join(","), "arrival-normal,interview-normal");
assert.equal(p1.entries[1].confidence, "inferred");
console.log("smoke 1 ok: 无记录时推断为初次证词版本");

// 2. 案件内容丢失 interview 音源 → 来源不确定且不可播放，但字幕留空而非伪造
const stripped: CaseContent = {
  ...CASE_CONTENT,
  episodes: CASE_CONTENT.episodes.filter((e) => e.sceneId !== "interview"),
};
const p2 = reconstructProgram(stripped, slot("s2", snapshot()));
const missing = p2.entries.find((e) => e.sceneId === "interview")!;
assert.equal(missing.confidence, "uncertain");
assert.equal(missing.playable, false);
assert.equal(missing.cues.length, 0);
console.log("smoke 2 ok: 音源缺失时标注不确定、可跳过、不伪造字幕");

// 3. 两条完全一致的路线 → 无分歧
const same = reconstructProgram(CASE_CONTENT, slot("s3", snapshot()));
const cmp = comparePrograms(same, structuredClone(same));
assert.equal(cmp.divergence, null);
assert.equal(cmp.sharedCount, same.entries.length);
console.log("smoke 3 ok: 相同路线无分歧");

// 4. 保存 → 序列化 → 校验 → 对账（模拟原档被删除）
const saved = createSavedProgram(
  CASE_CONTENT,
  [slot("a", snapshot()), slot("b", snapshot())],
  "冒烟节目单",
  "doc-1",
  Date.now(),
);
const text = JSON.stringify(saved);
const validated = validateSavedProgram(JSON.parse(text));
assert.equal(validated.sources.length, 2);
const { program, drift } = reconcileProgram(validated, stripped);
assert.ok(drift.some((d) => d.includes("移除")));
assert.equal(
  program.programs[0].entries.find((e) => e.sceneId === "interview")!.sourceMissing,
  true,
);
console.log("smoke 4 ok: 自包含节目单在原档删除后保留来源快照与对账说明");

// 5. 损坏文档被拒绝
let rejected = false;
try {
  validateSavedProgram({ version: 2 });
} catch {
  rejected = true;
}
assert.ok(rejected);
console.log("smoke 5 ok: 损坏/不支持的节目单文档被拒绝");

console.log("\n全部冒烟检查通过");
