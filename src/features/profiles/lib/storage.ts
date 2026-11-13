import type { CaseContent, SaveSlot } from "../../../shared/types";
import { MAX_SLOTS, parseStoredSlot } from "../model/slots";
const STORAGE_KEY = "midnight-frequency:profiles:v1";
export interface SlotsResult {
  slots: SaveSlot[];
  warning: string | null;
}
export function readSlots(content: CaseContent): SlotsResult {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (!text) return { slots: [], warning: null };
    const raw: unknown = JSON.parse(text);
    if (!Array.isArray(raw)) throw new Error("档案列表损坏");
    const slots: SaveSlot[] = [];
    let skipped = 0;
    for (const item of raw) {
      try {
        const slot = parseStoredSlot(item, content);
        if (
          slots.some((saved) => saved.id === slot.id) ||
          slots.length >= MAX_SLOTS
        )
          throw new Error("重复或超额档案");
        slots.push(slot);
      } catch {
        skipped++;
      }
    }
    return {
      slots,
      warning: skipped ? `${skipped} 份档案无法读取，其他档案已恢复。` : null,
    };
  } catch (error) {
    return {
      slots: [],
      warning: `无法读取本地档案：${error instanceof Error ? error.message : "未知错误"}`,
    };
  }
}
function persist(slots: SaveSlot[]): SaveSlot[] {
  const copy = structuredClone(slots);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(copy));
  return copy;
}
export function writeSlot(slots: SaveSlot[], slot: SaveSlot): SaveSlot[] {
  const exists = slots.some((item) => item.id === slot.id);
  if (!exists && slots.length >= MAX_SLOTS)
    throw new Error("最多保存 8 份档案，请先删除一份");
  return persist(
    exists
      ? slots.map((item) => (item.id === slot.id ? slot : item))
      : [slot, ...slots],
  );
}
export function deleteSlot(slots: SaveSlot[], id: string): SaveSlot[] {
  return persist(slots.filter((slot) => slot.id !== id));
}
