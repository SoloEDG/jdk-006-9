import { useCallback, useRef, useState } from "react";
import type {
  HeardHistory,
  SaveSlot,
  SceneId,
  EvidenceNote,
  Cue,
} from "../shared/types";
import {
  CASE_CONTENT,
  createInvestigation,
  enterScene,
  applyChoice,
  resolveEpisode,
} from "../features/story";
import { useTransport, recordPosition } from "../features/listening";
import {
  createEvidence,
  addNote,
  collectClue,
  editNote,
  deleteNote,
  togglePinned,
} from "../features/evidence";
import {
  readSlots,
  createSnapshot,
  createSlot,
  writeSlot,
  deleteSlot,
  parseImported,
  exportSlot,
  validateSnapshot,
} from "../features/profiles";
export function useCase() {
  const [boot] = useState(() => readSlots(CASE_CONTENT));
  const [story, setStory] = useState(createInvestigation),
    [evidence, setEvidence] = useState(createEvidence),
    [heard, setHeard] = useState<HeardHistory>({}),
    [slots, setSlots] = useState<SaveSlot[]>(boot.slots),
    [activeId, setActiveId] = useState<string | null>(null),
    [notice, setNotice] = useState(
      boot.warning || "戴上耳机，从第一通来电开始调查。",
    ),
    [dirty, setDirty] = useState(false);
  const episode = resolveEpisode(CASE_CONTENT, story.sceneId, evidence.clues);
  const onHeard = useCallback((id: string, position: number) => {
    setHeard((h) => recordPosition(h, id, position));
  }, []);
  const audio = useTransport(episode, onHeard);
  const run = (fn: () => void) => {
    try {
      fn();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "操作未完成，请重试");
    }
  };
  const go = (id: SceneId, position = 0) => {
    audio.pause();
    if (id === story.sceneId) {
      audio.seek(position);
    } else {
      audio.queueSeek(position);
    }
    if (id !== story.sceneId) setStory((s) => enterScene(CASE_CONTENT, s, id));
    setDirty(true);
  };
  const choose = (id: string) =>
    run(() => {
      const next = applyChoice(CASE_CONTENT, story, id, evidence.clues);
      audio.pause();
      audio.queueSeek(0);
      setStory(next);
      setDirty(true);
      setNotice(
        next.ending
          ? "你已还原案件。仍可回听录音、整理证据。"
          : "调查方向已更新，点击播放继续收听。",
      );
    });
  const note = () => {
    const anchor = audio.captureRange(story.sceneId, 5);
    if (!anchor) {
      setNotice("请等待录音载入后再标记");
      return;
    }
    setEvidence((s) => addNote(s, anchor, "在这里写下你的观察…", "声音标记"));
    setDirty(true);
    setNotice("已记录最近五秒，可在笔记中编辑或回听。");
  };
  const collect = (cue: Cue) => {
    const anchor = audio.captureRange(
      story.sceneId,
      Math.max(
        1,
        (cue.sound?.end || cue.end) - (cue.sound?.start || cue.start),
      ),
    );
    if (!anchor) return;
    const sound = cue.sound;
    const result = collectClue(evidence, episode, cue, heard, {
      ...anchor,
      start: sound?.start ?? cue.start,
      end: sound?.end ?? cue.end,
    });
    if (!result) {
      setNotice("请先听完这段声音，或检查是否已收集。");
      return;
    }
    audio.pause();
    setEvidence(result);
    setDirty(true);
    setNotice("声音线索已归档，对话可能因此发生变化。");
  };
  const jump = (n: EvidenceNote) => {
    go(n.anchor.sceneId, n.anchor.start);
    setNotice(`已定位到「${n.title}」对应声音，点击播放回听。`);
  };
  const save = (name: string) =>
    run(() => {
      const snapshot = createSnapshot(CASE_CONTENT, story, evidence, heard, {
        sceneId: story.sceneId,
        position: audio.view.position,
        rate: audio.view.rate,
      });
      const old = slots.find((s) => s.id === activeId);
      const slot =
        old && name === old.name
          ? { ...old, updatedAt: Date.now(), snapshot }
          : createSlot(name, snapshot);
      const next = writeSlot(slots, slot);
      setSlots(next);
      setActiveId(slot.id);
      setDirty(false);
      setNotice(`调查进度「${slot.name}」已保存。`);
    });
  const load = (id: string) =>
    run(() => {
      const slot = slots.find((s) => s.id === id);
      if (!slot) throw new Error("存档不存在");
      const snap = validateSnapshot(slot.snapshot, CASE_CONTENT);
      audio.pause();
      const nextEpisode = resolveEpisode(
        CASE_CONTENT,
        snap.story.sceneId,
        snap.evidence.clues,
      );
      if (nextEpisode.id !== episode.id) {
        audio.queueSeek(snap.resume.position);
        audio.queueRate(snap.resume.rate);
      }
      setStory(snap.story);
      setEvidence(snap.evidence);
      setHeard(snap.heard);
      setActiveId(id);
      setDirty(false);
      setNotice(`已载入「${slot.name}」，点击播放继续调查。`);
      if (nextEpisode.id === episode.id) {
        audio.seek(snap.resume.position);
      }
      if (nextEpisode.id === episode.id) audio.setRate(snap.resume.rate);
    });
  const importText = (text: string) =>
    run(() => {
      const slot = parseImported(text, CASE_CONTENT);
      setSlots(writeSlot(slots, slot));
      setNotice("导入成功，已另存为独立调查进度。");
    });
  const download = (id: string) =>
    run(() => {
      const s = slots.find((s) => s.id === id);
      if (!s) throw new Error("存档不存在");
      const blob = new Blob([exportSlot(s)], { type: "application/json" }),
        url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = `雾港来电-${s.name}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  return {
    story,
    evidence,
    heard,
    slots,
    activeId,
    notice,
    dirty,
    episode,
    audio,
    go,
    choose,
    note,
    collect,
    jump,
    save,
    load,
    importText,
    download,
    edit: (id: string, text: string) => {
      setEvidence((s) => editNote(s, id, text));
      setDirty(true);
    },
    remove: (id: string) => {
      setEvidence((s) => deleteNote(s, id));
      setDirty(true);
    },
    pin: (id: string) => {
      setEvidence((s) => togglePinned(s, id));
      setDirty(true);
    },
    removeSlot: (id: string) =>
      run(() => {
        setSlots(deleteSlot(slots, id));
        if (activeId === id) setActiveId(null);
      }),
    reset: () => {
      audio.pause();
      if (story.sceneId !== "arrival") audio.queueSeek(0);
      setStory(createInvestigation());
      setEvidence(createEvidence());
      setHeard({});
      setActiveId(null);
      setDirty(false);
      if (story.sceneId === "arrival") audio.seek(0);
      setNotice("已开始一条独立调查路线，已有存档保持不变。");
    },
  };
}
