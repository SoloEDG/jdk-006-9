import { useState } from "react";
import {
  Bookmark,
  Check,
  Headphones,
  Pin,
  Plus,
  Trash2,
  X,
  Pencil,
} from "lucide-react";
import type {
  CaseContent,
  EvidenceNote,
  EvidenceState,
} from "../../../shared/types";
interface Props {
  state: EvidenceState;
  content: CaseContent;
  onJump: (note: EvidenceNote) => void;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onPin: (id: string) => void;
  onNew: () => void;
}
const time = (n: number) =>
  `${Math.floor(n / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(n % 60)
    .toString()
    .padStart(2, "0")}`;
export function EvidencePanel({
  state,
  content,
  onJump,
  onEdit,
  onDelete,
  onPin,
  onNew,
}: Props) {
  const [editing, setEditing] = useState<string | null>(null),
    [draft, setDraft] = useState("");
  const notes = [...state.notes].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned),
  );
  return (
    <aside className="evidence-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">CASE NOTES</span>
          <h2>
            <Bookmark size={18} /> 证据手记
          </h2>
        </div>
        <span className="count-badge">{state.clues.length} 条线索</span>
      </div>
      <p className="panel-description">记录那些不该被忽略的声音。</p>
      <button className="new-note" onClick={onNew}>
        <Plus size={16} /> 添加收听笔记
      </button>
      <div className="evidence-list">
        {notes.length === 0 ? (
          <div className="empty-notes">
            <Headphones size={26} />
            <p>还没有收听笔记</p>
            <small>播放录音，捕捉值得留意的片刻。</small>
          </div>
        ) : (
          notes.map((note) => (
            <article
              className={`evidence-card ${note.pinned ? "is-pinned" : ""}`}
              key={note.id}
            >
              <div className="note-heading">
                <span className="note-kind">
                  {note.clueId ? "声音线索" : "收听笔记"}
                </span>
                <button
                  className={`icon-button ${note.pinned ? "active" : ""}`}
                  aria-label={note.pinned ? "取消置顶" : "置顶笔记"}
                  onClick={() => onPin(note.id)}
                >
                  <Pin size={14} />
                </button>
              </div>
              <h3>
                {note.clueId
                  ? content.clues.find((clue) => clue.id === note.clueId)
                      ?.title || note.title
                  : note.title}
              </h3>
              {editing === note.id ? (
                <>
                  <textarea
                    aria-label="编辑笔记"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                  />
                  <div className="note-actions">
                    <button
                      disabled={!draft.trim()}
                      onClick={() => {
                        onEdit(note.id, draft);
                        setEditing(null);
                      }}
                    >
                      <Check size={13} /> 保存
                    </button>
                    <button onClick={() => setEditing(null)}>
                      <X size={13} /> 取消
                    </button>
                  </div>
                </>
              ) : (
                <p className="note-text">{note.text}</p>
              )}
              <button className="note-play" onClick={() => onJump(note)}>
                <Headphones size={13} />
                {
                  content.scenes.find(
                    (scene) => scene.id === note.anchor.sceneId,
                  )?.title
                }{" "}
                · {time(note.anchor.start)} — {time(note.anchor.end)}
              </button>
              <div className="note-actions">
                <button
                  aria-label="编辑笔记"
                  onClick={() => {
                    setEditing(note.id);
                    setDraft(note.text);
                  }}
                >
                  <Pencil size={13} /> 编辑
                </button>
                <button aria-label="删除笔记" onClick={() => onDelete(note.id)}>
                  <Trash2 size={13} /> 删除
                </button>
              </div>
            </article>
          ))
        )}
      </div>
      <footer className="evidence-footer">所有笔记仅保存在此设备</footer>
    </aside>
  );
}
