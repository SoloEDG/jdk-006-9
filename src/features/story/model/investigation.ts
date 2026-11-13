import type {
  CaseContent,
  Investigation,
  SceneId,
} from "../../../shared/types";
export function createInvestigation(): Investigation {
  return {
    sceneId: "arrival",
    visited: ["arrival"],
    decisions: [],
    ending: null,
  };
}
export function enterScene(
  content: CaseContent,
  state: Investigation,
  sceneId: SceneId,
): Investigation {
  if (!content.scenes.some((s) => s.id === sceneId))
    throw new Error("调查地点不存在");
  return {
    ...state,
    sceneId,
    visited: state.visited.includes(sceneId)
      ? state.visited
      : [...state.visited, sceneId],
  };
}
export function applyChoice(
  content: CaseContent,
  state: Investigation,
  id: string,
  clues: string[],
): Investigation {
  const scene = content.scenes.find((s) => s.id === state.sceneId),
    choice = scene?.choices.find((c) => c.id === id);
  if (!choice) throw new Error("调查方向不存在");
  if (!choice.requires.every((c) => clues.includes(c)))
    throw new Error("声音证据不足，请先补充调查");
  const next = enterScene(content, state, choice.target);
  return {
    ...next,
    decisions: [...state.decisions, { sceneId: state.sceneId, choiceId: id }],
    ending: choice.target === "finale" ? "灯塔的真相" : state.ending,
  };
}
