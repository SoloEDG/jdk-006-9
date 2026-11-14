import { useMemo, useRef, useState } from "react";
import {
  ArrowLeftRight,
  Download,
  GitCompare,
  Play,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { SaveSlot } from "../../../shared/types";
import type { SavedProgram } from "../types";
import { MAX_PROGRAMS } from "../lib/storage";
import { reconcileProgram } from "../model/fingerprint";
import { validateSavedProgram } from "../model/codec";
import type { CaseContent } from "../../../shared/types";

interface Props {
  content: CaseContent;
  slots: SaveSlot[];
  programs: SavedProgram[];
  notice: string | null;
  onCreate: (slotAId: string, slotBId: string, name: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string) => void;
  onImport: (text: string) => void;
  onOpen: (program: SavedProgram) => void;
  onClose: () => void;
}

export function ReplayCenterDialog({
  content,
  slots,
  programs,
  notice,
  onCreate,
  onDelete,
  onExport,
  onImport,
  onOpen,
  onClose,
}: Props) {
  const [aId, setAId] = useState("");
  const [bId, setBId] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);

  const selectableB = useMemo(
    () => slots.filter((slot) => slot.id !== aId),
    [slots, aId],
  );
  const selectableA = useMemo(
    () => slots.filter((slot) => slot.id !== bId),
    [slots, bId],
  );

  const run = (action: () => void) => {
    try {
      action();
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="profiles-dialog replay-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="replay-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="dialog-header">
          <div>
            <span className="eyebrow">ROUTE REPLAY ARCHIVE</span>
            <h2 id="replay-title">
              <GitCompare size={20} /> 路线收听档案
            </h2>
          </div>
          <button className="icon-button" aria-label="关闭收听档案" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <p className="panel-description">
          从两份调查存档生成连续节目单：按各自当时的决策顺序串联场景录音，
          标出共同片段与第一次分歧。重建只依据原档历史，不会用最终线索重算旧对白。
        </p>

        <form
          className="replay-create-form"
          onSubmit={(event) => {
            event.preventDefault();
            run(() => {
              if (!aId || !bId) throw new Error("请选择两份不同的调查存档");
              if (aId === bId) throw new Error("请选择两份不同的调查存档");
              const label = name.trim() || "路线对照节目单";
              onCreate(aId, bId, label);
              setName("");
            });
          }}
        >
          <div className="replay-pick-grid">
            <label>
              路线 A
              <select value={aId} onChange={(e) => setAId(e.target.value)}>
                <option value="">选择存档…</option>
                {selectableA.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {slot.name} · {slot.snapshot.evidence.clues.length} 条线索
                  </option>
                ))}
              </select>
            </label>
            <span className="replay-pick-swap" aria-hidden>
              <ArrowLeftRight size={16} />
            </span>
            <label>
              路线 B
              <select value={bId} onChange={(e) => setBId(e.target.value)}>
                <option value="">选择存档…</option>
                {selectableB.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {slot.name} · {slot.snapshot.evidence.clues.length} 条线索
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="profile-save-row">
            <input
              placeholder="节目单名称（可留空使用默认名）"
              maxLength={24}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <button className="primary-button" disabled={!aId || !bId || programs.length >= MAX_PROGRAMS}>
              <Plus size={15} /> 生成节目单
            </button>
          </div>
          <small>{programs.length}/{MAX_PROGRAMS} 份节目单 · 自包含快照，仅保存在当前浏览器</small>
        </form>

        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        {notice && !error && <p className="replay-notice">{notice}</p>}

        <div className="profile-list">
          {programs.length === 0 ? (
            <div className="empty-notes">
              <GitCompare size={28} />
              <p>还没有路线节目单</p>
              <small>选择两份存档，听出选择顺序怎样改变了广播。</small>
            </div>
          ) : (
            programs.map((program) => {
              const { drift } = reconcileProgram(program, content);
              return (
                <article className="profile-card replay-card" key={program.id}>
                  <div>
                    <h3>{program.name}</h3>
                    <p>
                      {new Date(program.createdAt).toLocaleString("zh-CN")} ·{" "}
                      {program.programs[0].entries.length} 段 ×{" "}
                      {program.programs[1].entries.length} 段 · 共同{" "}
                      {program.sharedCount} 段
                      {program.divergenceIndex === null
                        ? " · 无分歧"
                        : ` · 首次分歧在第 ${program.divergenceIndex + 1} 段`}
                    </p>
                    <p className="replay-source-line">
                      {program.sources[0].slotName} ⇄ {program.sources[1].slotName}
                    </p>
                    {drift.length > 0 && (
                      <p className="replay-drift">
                        来源变化：{drift[0]}
                        {drift.length > 1 ? `（共 ${drift.length} 项）` : ""}
                      </p>
                    )}
                  </div>
                  <div className="profile-actions">
                    <button onClick={() => run(() => onOpen(program))}>
                      <Play size={15} /> 收听对照
                    </button>
                    <button
                      aria-label={`导出 ${program.name}`}
                      onClick={() => run(() => onExport(program.id))}
                    >
                      <Download size={15} />
                    </button>
                    <button
                      aria-label={`删除 ${program.name}`}
                      onClick={() => run(() => onDelete(program.id))}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>

        <footer className="dialog-footer">
          <input
            ref={file}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={async (event) => {
              const selected = event.target.files?.[0];
              if (!selected) return;
              try {
                const parsed = validateSavedProgram(JSON.parse(await selected.text()));
                onImport(JSON.stringify(parsed));
                setError("");
              } catch (e) {
                setError(e instanceof Error ? e.message : "无法导入节目单");
              } finally {
                event.target.value = "";
              }
            }}
          />
          <button className="secondary-button" onClick={() => file.current?.click()}>
            <Upload size={15} /> 导入节目单
          </button>
          <span>节目单内嵌原档快照与字幕，原档删除后仍保留可解释的来源说明</span>
        </footer>
      </section>
    </div>
  );
}
