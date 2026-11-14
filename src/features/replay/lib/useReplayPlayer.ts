import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProgramEntry, RouteProgram } from "../types";
import { bounded } from "../../../shared/time";

export type RouteSide = "a" | "b";

export interface ReplayView {
  side: RouteSide;
  entryIndex: number;
  position: number;
  duration: number;
  playing: boolean;
  loading: boolean;
  rate: number;
  volume: number;
  error: string | null;
  programTime: number;
  entry: ProgramEntry;
  otherEntry: ProgramEntry | null;
  program: RouteProgram;
  otherProgram: RouteProgram;
}

export function useReplayPlayer(programs: [RouteProgram, RouteProgram]) {
  const [side, setSide] = useState<RouteSide>("a");
  const [entryIndex, setEntryIndex] = useState(0);
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rate, setRateState] = useState(1);
  const [volume, setVolumeState] = useState(0.8);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const generation = useRef(0);
  const wantPlay = useRef(false);

  const program = side === "a" ? programs[0] : programs[1];
  const otherProgram = side === "a" ? programs[1] : programs[0];
  const entry = program.entries[Math.min(entryIndex, program.entries.length - 1)];
  const otherEntry =
    otherProgram.entries[
      Math.min(entryIndex, otherProgram.entries.length - 1)
    ] ?? null;
  const lastIndexRef = useRef(program.entries.length - 1);
  lastIndexRef.current = program.entries.length - 1;

  // 片段序号或路线变化时重新加载音频；字幕/来源说明不依赖音频，缺失音源也可阅读
  useEffect(() => {
    const token = ++generation.current;
    setError(null);
    setLoading(true);
    setPlaying(false);
    if (!entry.playable || !entry.audio) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPosition(0);
      setLoading(false);
      setError("该片段音源不在当前案件内容中，仅可阅读字幕与来源说明。");
      return;
    }
    const audio = new Audio(entry.audio);
    audio.preload = "auto";
    audio.volume = volume;
    audio.playbackRate = rate;
    const onLoaded = () => {
      if (generation.current !== token) return;
      audioRef.current?.pause();
      audioRef.current = audio;
      setLoading(false);
      setPosition(0);
      if (wantPlay.current) {
        void audio.play().catch(() => {
          wantPlay.current = false;
          setPlaying(false);
          setError("浏览器未能播放该段录音，请再次点击播放。");
        });
      }
    };
    const onTime = () => {
      if (generation.current !== token || audioRef.current !== audio) return;
      setPosition(audio.currentTime);
    };
    const onPlay = () => generation.current === token && setPlaying(true);
    const onPause = () => generation.current === token && setPlaying(false);
    const onEnded = () => {
      if (generation.current !== token) return;
      const last = lastIndexRef.current;
      setEntryIndex((i) => {
        if (i >= last) {
          wantPlay.current = false;
          setPlaying(false);
          return i;
        }
        // 自动续播下一片段：保持播放意图，等待新音源载入
        wantPlay.current = true;
        return i + 1;
      });
    };
    const onError = () => {
      if (generation.current !== token) return;
      setLoading(false);
      setPlaying(false);
      setError("录音暂时无法加载，可跳过该片段继续收听。");
    };
    audio.addEventListener("loadedmetadata", onLoaded, { once: true });
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.load();
    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeAttribute("src");
      audio.load();
      if (audioRef.current === audio) audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.episodeId, entryIndex, side]);

  // 越界保护：切换路线后节目单长度可能不同
  useEffect(() => {
    if (entryIndex >= program.entries.length)
      setEntryIndex(program.entries.length - 1);
  }, [program.entries.length, entryIndex]);

  const pause = useCallback(() => {
    wantPlay.current = false;
    audioRef.current?.pause();
    setPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || loading) {
      if (!entry.playable) {
        setError("该片段音源缺失，无法播放，可跳过。");
        return;
      }
      wantPlay.current = !wantPlay.current;
      return;
    }
    if (audio.paused) {
      wantPlay.current = true;
      void audio.play().catch(() => setError("播放失败，请再次点击。"));
    } else {
      wantPlay.current = false;
      audio.pause();
    }
  }, [loading, entry.playable]);

  const seek = useCallback(
    (time: number) => {
      const audio = audioRef.current;
      const target = bounded(time, 0, entry.duration || 0);
      if (audio) {
        audio.currentTime = target;
        setPosition(target);
      } else {
        setPosition(target);
      }
    },
    [entry.duration],
  );

  const goToEntry = useCallback(
    (index: number) => {
      const target = bounded(index, 0, program.entries.length - 1);
      if (target === entryIndex) {
        const audio = audioRef.current;
        if (audio && audio.paused) {
          wantPlay.current = true;
          void audio.play().catch(() => setError("播放失败，请再次点击。"));
        }
        return;
      }
      wantPlay.current = true;
      setEntryIndex(target);
      setPosition(0);
    },
    [program.entries.length, entryIndex],
  );

  /** 在第一次分歧处（或任意时刻）切换另一条路线续听，同步到同序号片段 */
  const switchSide = useCallback(
    (next: RouteSide) => {
      if (next === side) return;
      // 不同版本录音时长不同，切换后从同序号片段起点续听，
      // 不把另一条路线的播放位置强行套用到本路线。
      wantPlay.current = audioRef.current
        ? !audioRef.current.paused
        : wantPlay.current;
      setSide(next);
      setEntryIndex((i) =>
        Math.min(
          i,
          (next === "a" ? programs[0] : programs[1]).entries.length - 1,
        ),
      );
      setPosition(0);
    },
    [side, programs],
  );

  const setRate = useCallback((n: number) => {
    const value = bounded(n, 0.5, 2);
    setRateState(value);
    if (audioRef.current) audioRef.current.playbackRate = value;
  }, []);

  const setVolume = useCallback((n: number) => {
    const value = bounded(n, 0, 1);
    setVolumeState(value);
    if (audioRef.current) audioRef.current.volume = value;
  }, []);

  const view: ReplayView = useMemo(
    () => ({
      side,
      entryIndex,
      position,
      duration: entry.duration,
      playing,
      loading,
      rate,
      volume,
      error,
      programTime: entry.enteredAt + position,
      entry,
      otherEntry,
      program,
      otherProgram,
    }),
    [
      side,
      entryIndex,
      position,
      playing,
      loading,
      rate,
      volume,
      error,
      entry,
      otherEntry,
      program,
      otherProgram,
    ],
  );

  return {
    view,
    pause,
    toggle,
    seek,
    goToEntry,
    switchSide,
    setRate,
    setVolume,
  };
}
