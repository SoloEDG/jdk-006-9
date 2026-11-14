import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Flag,
  GitCompare,
  HelpCircle,
  Layers,
  Pause,
  Play,
  SkipForward,
  X,
} from "lucide-react";
import type { Episode } from "../../../shared/types";
import { formatTime } from "../../../shared/time";
import { Player } from "../../listening";
import { currentCue } from "../../transcript";
import type { ProgramEntry, SavedProgram, SourceConfidence } from "../types";
import { confidenceLabel, entryMatchKey } from "../types";
import { useReplayPlayer, type RouteSide } from "../lib/useReplayPlayer";

function pseudoEpisode(entry: ProgramEntry): Episode {
  return {
    id: entry.episodeId || `missing-${entry.sceneId}`,
    sceneId: entry.sceneId,
    title: entry.episodeTitle,
    version: entry.versionLabel,
    description: entry.confidenceReason,
    audio: entry.audio,
    duration: entry.duration,
    cues: entry.cues,
    wave: entry.wave,
  };
}

const CONFIDENCE_STYLE: Record<SourceConfidence, string> = {
  recorded: "conf-recorded",
  inferred: "conf-inferred",
  uncertain: "conf-uncertain",
};
const CONFIDENCE_ICON = {
  recorded: CheckCircle2,
  inferred: HelpCircle,
  uncertain: CircleHelp,
} as const;

export function ReplayStage({
  program,
  onExit,
}: {
  program: SavedProgram;
  onExit: () => void;
}) {
  const player = useReplayPlayer(program.programs);
  const { view } = player;
  const entry = view.entry;
  const other = view.otherEntry;
  const activeCue = currentCue(pseudoEpisode(entry), view.position);
  const divergenceIndex = program.divergenceIndex;
  const isDivergenceHere = divergenceIndex === view.entryIndex;
  const sameHere = other
    ? entryMatchKey(entry) === entryMatchKey(other)
    : false;

  const sideName = (side: RouteSide) =>
    (side === "a" ? program.programs[0] : program.programs[1]).slotName;

  return (
    <div className="replay-stage">
      <header className="replay-topbar">
        <div className="replay-title">
          <GitCompare size={18} />
          <div>
            <strong>{program.name}</strong>
            <small>只读对照 · 暂停或退出都会回到原调查位置，不会改动存档</small>
          </div>
        </div>
        <div className="replay-legend">
          <span className="conf-recorded">
            <CheckCircle2 size={12} /> 已证实
          </span>
          <span className="conf-inferred">
            <HelpCircle size={12} /> 版本推断
          </span>
          <span className="conf-uncertain">
            <CircleHelp size={12} /> 来源不确定
          </span>
        </div>
        <button className="replay-exit" onClick={onExit}>
          <X size={16} /> 退出对照
        </button>
      </header>

      <div className="replay-route-tabs" role="tablist" aria-label="切换路线">
        {(["a", "b"] as RouteSide[]).map((side) => {
          const route = side === "a" ? program.programs[0] : program.programs[1];
          const active = view.side === side;
          return (
            <button
              key={side}
              role="tab"
              aria-selected={active}
              className={`replay-route-tab ${active ? "active" : ""}`}
              onClick={() => player.switchSide(side)}
            >
              <span>
                路线 {side.toUpperCase()} · {route.slotName}
              </span>
              <small>{route.entries.length} 段 · {formatTime(route.totalDuration)}</small>
            </button>
          );
        })}
      </div>

      <nav className="replay-track" aria-label="节目单片段">
        {view.program.entries.map((item) => {
          const counterpart = view.otherProgram.entries[item.index];
          const shared = counterpart
            ? entryMatchKey(item) === entryMatchKey(counterpart)
            : false;
          const divergent = divergenceIndex !== null && item.index >= divergenceIndex;
          return (
            <button
              key={item.index}
              className={`replay-chip ${item.index === view.entryIndex ? "current" : ""} ${shared ? "shared" : ""} ${divergent ? "divergent" : ""} ${CONFIDENCE_STYLE[item.confidence]}`}
              onClick={() => player.goToEntry(item.index)}
              title={`${item.sceneTitle} · ${confidenceLabel(item.confidence)}`}
            >
              <span className="replay-chip-index">{item.index + 1}</span>
              <span className="replay-chip-name">{item.sceneTitle}</span>
              <span className="replay-chip-flags">
                {item.clueEvents.length > 0 && (
                  <Layers size={10} aria-label="含线索取得" />
                )}
                {divergenceIndex === item.index && (
                  <Flag size={10} aria-label="第一次分歧" />
                )}
              </span>
            </button>
          );
        })}
      </nav>

      {isDivergenceHere && (
        <div className="replay-divergence-banner" role="status">
          <Flag size={15} />
          <div>
            <strong>第一次分歧 · 第 {view.entryIndex + 1} 段</strong>
            <p>
              {!other
                ? "另一条路线在这一步之前已经结束。"
                : sameHere
                  ? "两份存档在此之后走向了不同片段。"
                  : `本路线听到「${entry.versionLabel}」，另一条路线为「${other.versionLabel}」。`}
            </p>
          </div>
          <button
            className="replay-switch"
            onClick={() =>
              player.switchSide(view.side === "a" ? "b" : "a")
            }
          >
            <GitCompare size={14} /> 切换到路线 {view.side === "a" ? "B" : "A"} 续听
          </button>
        </div>
      )}

      {entry.confidence === "uncertain" && (
        <div className="replay-uncertain-banner" role="alert">
          <AlertTriangle size={15} />
          <div>
            <strong>来源不确定，不做冒充还原</strong>
            <p>{entry.confidenceReason}</p>
            {entry.candidateEpisodeIds.length > 0 && (
              <small>当前案件中的候选音源：{entry.candidateEpisodeIds.join("、")}</small>
            )}
          </div>
          <button
            className="replay-skip"
            disabled={view.entryIndex >= view.program.entries.length - 1}
            onClick={() => player.goToEntry(view.entryIndex + 1)}
          >
            <SkipForward size={14} /> 跳过该片段
          </button>
        </div>
      )}
      {entry.sourceMissing && (
        <div className="replay-missing-banner" role="status">
          <AlertTriangle size={14} />
          原音源已从当前案件内容中移除，字幕、波形与来源说明仍来自保存时的自包含快照。
        </div>
      )}

      <div className="replay-main-grid">
        <section className="replay-player-col">
          <div className="replay-entry-head">
            <span className="chapter-badge">CH. {entry.chapter}</span>
            <div>
              <h3>{entry.episodeTitle}</h3>
              <small>
                {entry.versionLabel} · 节目单时间 {formatTime(view.programTime)}
              </small>
            </div>
            <span className={`replay-conf-tag ${CONFIDENCE_STYLE[entry.confidence]}`}>
              {(() => {
                const Icon = CONFIDENCE_ICON[entry.confidence];
                return <Icon size={12} />;
              })()}
              {confidenceLabel(entry.confidence)}
            </span>
          </div>
          {entry.arrivalChoice && (
            <p className="replay-choice-line">
              承接决策：在「{entry.arrivalChoice.sceneId}」选择了「
              {entry.arrivalChoice.label}」
            </p>
          )}
          <p className="replay-reason-line">{entry.confidenceReason}</p>

          {entry.playable ? (
            <Player
              episode={pseudoEpisode(entry)}
              state={{
                requestedId: entry.episodeId,
                position: view.position,
                duration: view.duration,
                playing: view.playing,
                loading: view.loading,
                rate: view.rate,
                volume: view.volume,
                error: view.error,
              }}
              onToggle={() => void player.toggle()}
              onSeek={player.seek}
              onRate={player.setRate}
              onVolume={player.setVolume}
              onNote={() => undefined}
              hideNoteButton
            />
          ) : (
            <div className="replay-no-audio">
              <Play size={22} />
              <p>该片段没有可播放音源</p>
              <small>可阅读下方字幕，或跳过到下一段。</small>
              <button
                disabled={view.entryIndex >= view.program.entries.length - 1}
                onClick={() => player.goToEntry(view.entryIndex + 1)}
              >
                <SkipForward size={14} /> 跳到下一段
              </button>
            </div>
          )}

          <div className="replay-clue-timeline">
            <h4>
              <Layers size={13} /> 线索取得时点（依据原档笔记还原）
            </h4>
            {entry.clueEvents.length === 0 ? (
              <p className="replay-small-muted">本片段没有线索取得记录。</p>
            ) : (
              entry.clueEvents.map((event) => (
                <div
                  key={event.clueId}
                  className={`replay-clue-row ${event.timingConfirmed ? "" : "unconfirmed"}`}
                >
                  <button
                    disabled={!entry.playable}
                    onClick={() => player.seek(event.cueStart)}
                  >
                    {formatTime(entry.enteredAt + event.cueStart)}
                  </button>
                  <span>{event.title}</span>
                  <small>
                    {event.timingConfirmed
                      ? event.reached
                        ? "原档证明已听到"
                        : "原档有笔记锚点"
                      : "时点无法证实"}
                  </small>
                </div>
              ))
            )}
          </div>
        </section>

        <aside className="replay-side-col">
          <div className="replay-subtitle-block">
            <h4>
              {sideName(view.side)} · 同步字幕
              {view.playing ? (
                <Pause size={11} className="replay-live-icon" />
              ) : (
                <Play size={11} className="replay-live-icon" />
              )}
            </h4>
            <div className="replay-cue-list">
              {entry.cues.map((cue) => (
                <div
                  key={cue.id}
                  className={`replay-cue ${activeCue?.id === cue.id ? "current" : ""}`}
                >
                  <button
                    className="cue-time"
                    disabled={!entry.playable}
                    onClick={() => player.seek(cue.start)}
                  >
                    {formatTime(cue.start)}
                  </button>
                  <div>
                    <span className="cue-speaker">{cue.speaker}</span>
                    <p>{cue.text}</p>
                    {cue.sound && (
                      <small className="replay-sound-tag">
                        声音线索 · {cue.sound.description}
                      </small>
                    )}
                  </div>
                </div>
              ))}
              {entry.cues.length === 0 && (
                <p className="replay-small-muted">
                  原档未保存该片段字幕，且当前案件内容无法补全。
                </p>
              )}
            </div>
          </div>

          <div className="replay-subtitle-block other">
            <h4>
              {view.otherProgram.slotName} · 同序号片段字幕
            </h4>
            <div className="replay-cue-list compact">
              {!other || other.cues.length === 0 ? (
                <p className="replay-small-muted">
                  {other
                    ? "该路线此片段来源不确定，无字幕快照。"
                    : "另一条路线没有这一序号的片段。"}
                </p>
              ) : (
                other.cues.map((cue) => (
                  <div key={cue.id} className="replay-cue compact">
                    <span className="cue-time static">{formatTime(cue.start)}</span>
                    <div>
                      <span className="cue-speaker">{cue.speaker}</span>
                      <p>{cue.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <button
              className="replay-switch ghost"
              onClick={() =>
                player.switchSide(view.side === "a" ? "b" : "a")
              }
            >
              <GitCompare size={13} /> 改听 {view.otherProgram.slotName}
            </button>
          </div>

          {view.program.warnings.length > 0 && (
            <div className="replay-warnings">
              <h4>
                <AlertTriangle size={13} /> 重建告警（{view.program.warnings.length}）
              </h4>
              {view.program.warnings.map((warning, i) => (
                <p key={i}>{warning}</p>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
