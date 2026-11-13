import type {
  CaseContent,
  CaseSnapshot,
  EvidenceState,
  HeardHistory,
  Investigation,
  ResumePoint,
} from "../../../shared/types";
import { validateSnapshot } from "../lib/codec";
export function createSnapshot(
  content: CaseContent,
  story: Investigation,
  evidence: EvidenceState,
  heard: HeardHistory,
  resume: ResumePoint,
): CaseSnapshot {
  return validateSnapshot(
    { version: 1, caseId: content.id, story, evidence, heard, resume },
    content,
  );
}
