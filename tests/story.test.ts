import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveEpisode,
  CASE_CONTENT,
  createInvestigation,
  applyChoice,
} from "../src/features/story";
test("known bell changes interview recording without advancing scene", () => {
  assert.equal(
    resolveEpisode(CASE_CONTENT, "interview", []).id,
    "interview-normal",
  );
  assert.equal(
    resolveEpisode(CASE_CONTENT, "interview", ["bell"]).id,
    "interview-aware",
  );
});
test("locked final choice cannot be forced by id", () => {
  const s = createInvestigation();
  s.sceneId = "tower";
  assert.throws(() => applyChoice(CASE_CONTENT, s, "solve", []));
});
