import { useCallback, useState } from "react";
import type { CaseContent, SaveSlot } from "../../../shared/types";
import { newId } from "../../../shared/time";
import type { SavedProgram } from "../types";
import {
  deleteProgram,
  exportProgram,
  readPrograms,
  writeProgram,
  MAX_PROGRAMS,
} from "../lib/storage";
import { createSavedProgram, reconcileProgram } from "./fingerprint";
import { validateSavedProgram } from "./codec";

export function useReplayArchive(content: CaseContent, slots: SaveSlot[]) {
  const [boot] = useState(() => readPrograms());
  const [programs, setPrograms] = useState<SavedProgram[]>(boot.programs);
  const [notice, setNotice] = useState<string | null>(boot.warning);
  const [active, setActive] = useState<SavedProgram | null>(null);

  const run = useCallback(
    (action: () => void, success?: string) => {
      try {
        action();
        if (success) setNotice(success);
      } catch (e) {
        setNotice(e instanceof Error ? e.message : "操作未完成，请重试");
      }
    },
    [],
  );

  const createFromSlots = useCallback(
    (slotAId: string, slotBId: string, name: string) => {
      const a = slots.find((slot) => slot.id === slotAId);
      const b = slots.find((slot) => slot.id === slotBId);
      if (!a || !b) throw new Error("所选存档不存在");
      if (a.id === b.id) throw new Error("请选择两份不同的调查存档");
      const program = createSavedProgram(
        content,
        [a, b],
        name,
        newId(),
        Date.now(),
      );
      setPrograms((current) => writeProgram(current, program));
      setNotice(
        program.divergenceIndex === null
          ? `节目单「${program.name}」已生成：两条路线没有分歧。`
          : `节目单「${program.name}」已生成：共同 ${program.sharedCount} 段，首次分歧在第 ${program.divergenceIndex + 1} 段。`,
      );
    },
    [content, slots],
  );

  const open = useCallback(
    (program: SavedProgram) => {
      const { program: reconciled, drift } = reconcileProgram(program, content);
      setActive(reconciled);
      setNotice(
        drift.length
          ? `已打开节目单，检测到 ${drift.length} 项来源变化，相关片段已标注。`
          : null,
      );
    },
    [content],
  );

  const remove = useCallback((id: string) => {
    setPrograms((current) => deleteProgram(current, id));
    setNotice("节目单已删除，原始调查存档不受影响。");
  }, []);

  const download = useCallback((id: string) => {
    const program = programs.find((item) => item.id === id);
    if (!program) throw new Error("节目单不存在");
    const blob = new Blob([exportProgram(program)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `路线收听档案-${program.name}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [programs]);

  const importText = useCallback((text: string) => {
    const parsed = validateSavedProgram(JSON.parse(text));
    const fresh: SavedProgram = { ...parsed, id: newId() };
    setPrograms((current) => writeProgram(current, fresh));
    setNotice("节目单导入成功，已另存为独立收听档案。");
  }, []);

  return {
    programs,
    notice,
    active,
    maxPrograms: MAX_PROGRAMS,
    createFromSlots: (a: string, b: string, name: string) =>
      run(() => createFromSlots(a, b, name)),
    open,
    close: () => setActive(null),
    remove: (id: string) => run(() => remove(id)),
    download: (id: string) => run(() => download(id)),
    importText: (text: string) => run(() => importText(text)),
    clearNotice: () => setNotice(null),
  };
}
