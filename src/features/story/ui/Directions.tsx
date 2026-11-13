import { ArrowUpRight, Lock, Compass } from "lucide-react";
import type { CaseContent, Investigation } from "../../../shared/types";
export function Directions({
  content,
  story,
  clues,
  onChoose,
}: {
  content: CaseContent;
  story: Investigation;
  clues: string[];
  onChoose: (id: string) => void;
}) {
  const s = content.scenes.find((s) => s.id === story.sceneId)!;
  return (
    <section className="directions">
      <div className="section-title">
        <span>
          <Compass size={15} /> 下一步调查
        </span>
        <small>你的选择，将改变故事的回声。</small>
      </div>
      <div className="direction-grid">
        {s.choices.map((c) => {
          const locked = !c.requires.every((id) => clues.includes(id));
          return (
            <button key={c.id} disabled={locked} onClick={() => onChoose(c.id)}>
              <span className="direction-icon">
                {locked ? <Lock size={16} /> : <ArrowUpRight size={17} />}
              </span>
              <span>
                <strong>{c.label}</strong>
                <small>
                  {locked
                    ? "缺少证据：" +
                      c.requires
                        .filter((id) => !clues.includes(id))
                        .map(
                          (id) => content.clues.find((c) => c.id === id)?.title,
                        )
                        .join("、")
                    : c.description}
                </small>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
