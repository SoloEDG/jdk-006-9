import type { CaseContent, Episode, SceneId } from "../../../shared/types";
export function resolveEpisode(
  content: CaseContent,
  sceneId: SceneId,
  clues: string[],
): Episode {
  const id =
    sceneId === "interview" && clues.includes("bell")
      ? "interview-aware"
      : `${sceneId}-normal`;
  const episode = content.episodes.find((e) => e.id === id);
  if (!episode) throw new Error("该段录音无法读取");
  return episode;
}
export function sceneProgress(content: CaseContent, visited: SceneId[]) {
  return Math.round(
    (new Set(visited.filter((id) => content.scenes.some((s) => s.id === id)))
      .size /
      content.scenes.length) *
      100,
  );
}
