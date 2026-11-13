import { useEffect, useRef, useState } from "react";
import type {
  Episode,
  HeardHistory,
  CapturePort,
  TransportState,
} from "../../../shared/types";
import { bounded } from "../../../shared/time";
import { markHeard } from "../../../shared/heard";
import { captureWindow } from "../model/bookmark";
type View = Omit<TransportState, "loadedId">;
export function useTransport(
  episode: Episode,
  onHeard: (sourceId: string, position: number) => void,
) {
  const loaded = useRef<{ element: HTMLAudioElement; episode: Episode } | null>(
      null,
    ),
    generation = useRef(0),
    seekTarget = useRef<number | null>(null),
    rateTarget = useRef<number | null>(null),
    callback = useRef(onHeard);
  callback.current = onHeard;
  const [view, setView] = useState<View>({
    requestedId: episode.id,
    position: 0,
    duration: episode.duration,
    playing: false,
    loading: true,
    rate: 1,
    volume: 0.8,
    error: null,
  });
  useEffect(() => {
    const token = ++generation.current;
    setView((v) => ({
      ...v,
      requestedId: episode.id,
      loading: true,
      playing: false,
      error: null,
    }));
    const audio = new Audio(episode.audio);
    audio.preload = "auto";
    const valid = () => generation.current === token;
    const commit = () => {
      if (!valid()) return;
      loaded.current?.element.pause();
      const old = loaded.current?.element;
      loaded.current = { element: audio, episode };
      audio.volume = 0.8;
      audio.playbackRate = rateTarget.current ?? 1;
      audio.currentTime = bounded(
        seekTarget.current ?? 0,
        0,
        audio.duration || episode.duration,
      );
      seekTarget.current = null;
      rateTarget.current = null;
      old?.removeAttribute("src");
      setView((v) => ({
        ...v,
        loading: false,
        position: audio.currentTime,
        duration: audio.duration || episode.duration,
        rate: audio.playbackRate,
        volume: 0.8,
        playing: false,
      }));
    };
    const time = () => {
      if (!valid() || loaded.current?.element !== audio) return;
      setView((v) => ({ ...v, position: audio.currentTime }));
      callback.current(
        episode.id,
        bounded(audio.currentTime, 0, episode.duration),
      );
    };
    const playing = () => {
      if (valid()) setView((v) => ({ ...v, playing: !audio.paused }));
    };
    const error = () => {
      if (valid())
        setView((v) => ({
          ...v,
          loading: false,
          playing: false,
          error: "录音暂时无法加载，请重试或切换章节。",
        }));
    };
    audio.addEventListener("loadedmetadata", commit, { once: true });
    audio.addEventListener("timeupdate", time);
    audio.addEventListener("play", playing);
    audio.addEventListener("pause", playing);
    audio.addEventListener("ended", playing);
    audio.addEventListener("error", error);
    audio.load();
    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", time);
      audio.removeEventListener("play", playing);
      audio.removeEventListener("pause", playing);
      audio.removeEventListener("ended", playing);
      audio.removeEventListener("error", error);
      audio.removeAttribute("src");
      audio.load();
    };
  }, [episode.id]);
  const pause = () => loaded.current?.element.pause();
  const seek = (position: number) => {
    const a = loaded.current?.element;
    if (!a || view.loading) {
      seekTarget.current = position;
      return;
    }
    a.currentTime = bounded(position, 0, a.duration || episode.duration);
    setView((v) => ({ ...v, position: a.currentTime }));
    callback.current(
      loaded.current!.episode.id,
      bounded(a.currentTime, 0, loaded.current!.episode.duration),
    );
  };
  const captureRange: CapturePort["captureRange"] = (_sceneId, width) => {
    const actual = loaded.current;
    return actual
      ? captureWindow(
          actual.episode.sceneId,
          actual.element.currentTime,
          actual.element.duration,
          width,
        )
      : null;
  };
  return {
    view,
    captureRange,
    pause,
    seek,
    queueRate: (rate: number) => {
      rateTarget.current = bounded(rate, 0.5, 2);
    },
    queueSeek: (position: number) => {
      seekTarget.current = position;
    },
    toggle: async () => {
      const a = loaded.current?.element;
      if (!a || view.loading) return;
      try {
        if (a.paused) await a.play();
        else a.pause();
      } catch {
        setView((v) => ({
          ...v,
          error: "浏览器未能播放录音，请再次点击播放。",
        }));
      }
    },
    setRate: (rate: number) => {
      const n = bounded(rate, 0.5, 2);
      if (loaded.current) loaded.current.element.playbackRate = n;
      setView((v) => ({ ...v, rate: n }));
    },
    setVolume: (volume: number) => {
      const n = bounded(volume, 0, 1);
      if (loaded.current) loaded.current.element.volume = n;
      setView((v) => ({ ...v, volume: n }));
    },
  };
}
export function recordPosition(
  history: HeardHistory,
  sourceId: string,
  position: number,
) {
  return markHeard(history, sourceId, position);
}
