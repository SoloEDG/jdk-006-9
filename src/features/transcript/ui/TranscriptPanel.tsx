import { useEffect, useRef } from "react";
import { Search, AudioLines, Check, ScanLine } from "lucide-react";
import type { Cue, Episode, HeardHistory } from "../../../shared/types";
import { formatTime } from "../../../shared/time";
import { currentCue, isCueHeard, searchCues } from "../lib/cues";
import { useTranscript } from "../model/useTranscript";
export function TranscriptPanel({
  episode,
  position,
  history,
  clues,
  onSeek,
  onCollect,
  canCollect,
}: {
  episode: Episode;
  position: number;
  history: HeardHistory;
  clues: string[];
  onSeek: (time: number) => void;
  onCollect: (cue: Cue) => void;
  canCollect: (cue: Cue) => boolean;
}) {
  const { query, setQuery, follow, setFollow } = useTranscript(episode.id),
    active = currentCue(episode, position),
    list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (follow)
      list.current
        ?.querySelector('[data-active="true"]')
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [active?.id, follow]);
  return (
    <section className="transcript-panel">
      <div className="transcript-heading">
        <span>
          <AudioLines size={15} /> 同步字幕
        </span>
        <button
          className={follow ? "follow active" : "follow"}
          onClick={() => setFollow(!follow)}
        >
          <ScanLine size={12} />
          {follow ? "自动跟随" : "手动浏览"}
        </button>
      </div>
      <div className="transcript-search">
        <Search size={13} />
        <input
          aria-label="搜索已听字幕"
          placeholder="搜索已听过的对白…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="cue-list" ref={list}>
        {searchCues(episode, query, history).map((c) => {
          const heard = isCueHeard(history, episode, c),
            live = c.id === active?.id,
            known = heard || live;
          return (
            <div
              className={`cue ${live ? "current" : ""} ${heard ? "heard" : ""}`}
              data-active={live}
              key={c.id}
            >
              <button
                className="cue-time"
                onClick={() => onSeek(c.start)}
                aria-label={`跳到 ${formatTime(c.start)}`}
              >
                {formatTime(c.start)}
              </button>
              <div className="cue-body">
                <div className="cue-speaker">
                  {c.speaker}
                  <span>{live ? "正在播放" : heard ? "已听" : ""}</span>
                </div>
                <p>{known ? c.text : "尚未收听 · 这段对白还藏在声音里"}</p>
                {c.sound && (
                  <button
                    className={`sound-clue ${clues.includes(c.sound.clueId) ? "collected" : ""}`}
                    disabled={!canCollect(c) || clues.includes(c.sound.clueId)}
                    onClick={() => onCollect(c)}
                  >
                    {clues.includes(c.sound.clueId) ? (
                      <Check size={12} />
                    ) : (
                      <AudioLines size={12} />
                    )}{" "}
                    {clues.includes(c.sound.clueId)
                      ? "已收集"
                      : canCollect(c)
                        ? `收集 · ${c.sound.description}`
                        : "听见这段声音后可收集"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {!searchCues(episode, query, history).length && (
          <p className="empty-small">没有找到已听过的对白。</p>
        )}
      </div>
      <div className="transcript-foot">
        对白与声音来自当前录音 · 点击时间码回听
      </div>
    </section>
  );
}
