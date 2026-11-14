import type { SavedProgram } from "../types";
import { validateSavedProgram } from "../model/codec";

const STORAGE_KEY = "midnight-frequency:replay-programs:v1";
export const MAX_PROGRAMS = 8;

export interface ProgramsResult {
  programs: SavedProgram[];
  warning: string | null;
}

export function readPrograms(): ProgramsResult {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (!text) return { programs: [], warning: null };
    const raw: unknown = JSON.parse(text);
    if (!Array.isArray(raw)) throw new Error("节目单列表损坏");
    const programs: SavedProgram[] = [];
    let skipped = 0;
    for (const item of raw) {
      try {
        const program = validateSavedProgram(item);
        if (programs.some((saved) => saved.id === program.id))
          throw new Error("节目单编号重复");
        programs.push(program);
      } catch {
        skipped++;
      }
    }
    return {
      programs,
      warning: skipped
        ? `${skipped} 份节目单无法读取，其他节目单已恢复。`
        : null,
    };
  } catch (error) {
    return {
      programs: [],
      warning: `无法读取本地节目单：${error instanceof Error ? error.message : "未知错误"}`,
    };
  }
}

function persist(programs: SavedProgram[]): SavedProgram[] {
  const copy = structuredClone(programs);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(copy));
  return copy;
}

export function writeProgram(
  programs: SavedProgram[],
  program: SavedProgram,
): SavedProgram[] {
  const exists = programs.some((item) => item.id === program.id);
  if (!exists && programs.length >= MAX_PROGRAMS)
    throw new Error("最多保存 8 份节目单，请先删除一份");
  return persist(
    exists
      ? programs.map((item) => (item.id === program.id ? program : item))
      : [program, ...programs],
  );
}

export function deleteProgram(
  programs: SavedProgram[],
  id: string,
): SavedProgram[] {
  return persist(programs.filter((program) => program.id !== id));
}

export function exportProgram(program: SavedProgram): string {
  return JSON.stringify(program, null, 2);
}
