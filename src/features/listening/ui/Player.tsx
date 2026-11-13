import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  LoaderCircle,
  BookmarkPlus,
} from "lucide-react";
import type { Episode, TransportState } from "../../../shared/types";
import { formatTime } from "../../../shared/time";
export function Player({
  episode,
  state,
  onToggle,
  onSeek,
  onRate,
  onVolume,
  onNote,
}: {
  episode: Episode;
  state: Omit<TransportState, "loadedId">;
  onToggle: () => void;
  onSeek: (n: number) => void;
  onRate: (n: number) => void;
  onVolume: (n: number) => void;
  onNote: () => void;
}) {
  return (
    <section className="player">
      <div
        className="waveform"
        role="slider"
        tabIndex={0}
        aria-label="录音波形定位"
        aria-valuemin={0}
        aria-valuemax={state.duration}
        aria-valuenow={state.position}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          onSeek(((e.clientX - r.left) / r.width) * state.duration);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") onSeek(state.position + 2);
          if (e.key === "ArrowLeft") onSeek(state.position - 2);
        }}
      >
        {episode.wave.map((v, i) => (
          <i
            key={i}
            className={
              i / episode.wave.length <= state.position / state.duration
                ? "played"
                : ""
            }
            style={{ height: `${Math.max(8, Math.min(52, v * 43))}px` }}
          />
        ))}
        <span
          className="playhead"
          style={{ left: `${(state.position / state.duration) * 100}%` }}
        />
      </div>
      <div className="player-time">
        <span>{formatTime(state.position)}</span>
        <span>{formatTime(state.duration)}</span>
      </div>
      <input
        className="seek-range"
        type="range"
        min="0"
        max={state.duration}
        step="0.05"
        value={state.position}
        aria-label="音频进度"
        onChange={(e) => onSeek(Number(e.target.value))}
      />
      <div className="player-controls">
        <div className="speed">
          <select
            aria-label="播放速度"
            value={state.rate}
            onChange={(e) => onRate(Number(e.target.value))}
          >
            {[0.75, 1, 1.25, 1.5, 2].map((n) => (
              <option value={n} key={n}>
                {n}×
              </option>
            ))}
          </select>
        </div>
        <div className="transport-buttons">
          <button
            aria-label="后退五秒"
            onClick={() => onSeek(state.position - 5)}
          >
            <SkipBack size={17} />
          </button>
          <button
            className="play-button"
            aria-label={state.playing ? "暂停录音" : "播放录音"}
            onClick={onToggle}
            disabled={state.loading}
          >
            {state.loading ? (
              <LoaderCircle size={22} />
            ) : state.playing ? (
              <Pause size={21} fill="currentColor" />
            ) : (
              <Play size={21} fill="currentColor" />
            )}
          </button>
          <button
            aria-label="前进五秒"
            onClick={() => onSeek(state.position + 5)}
          >
            <SkipForward size={17} />
          </button>
        </div>
        <div className="volume">
          <Volume2 size={14} />
          <input
            type="range"
            min="0"
            max="1"
            step=".05"
            value={state.volume}
            aria-label="音量"
            onChange={(e) => onVolume(Number(e.target.value))}
          />
        </div>
      </div>
      {state.error && (
        <p role="alert" className="player-error">
          {state.error}
        </p>
      )}
      <div className="player-bottom">
        <span>
          <span className="live-dot" /> 本地无损音频 · 中文对白
        </span>
        <button onClick={onNote}>
          <BookmarkPlus size={13} /> 标记此刻
        </button>
      </div>
    </section>
  );
}
