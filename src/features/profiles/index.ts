export { createSnapshot } from "./model/snapshot";
export { validateSnapshot } from "./lib/codec";
export {
  createSlot,
  exportSlot,
  parseImported,
  MAX_SLOTS,
} from "./model/slots";
export { readSlots, writeSlot, deleteSlot } from "./lib/storage";
export type { SlotsResult } from "./lib/storage";
export { ProfilesDialog } from "./ui/ProfilesDialog";
