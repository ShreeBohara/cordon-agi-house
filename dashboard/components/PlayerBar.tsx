"use client";

import { SPEEDS } from "@/lib/useTimelinePlayer";

export function PlayerBar({
  playhead,
  total,
  playing,
  speed,
  currentLabel,
  onPlayPause,
  onStop,
  onStep,
  onStepBack,
  onSeek,
  onSpeed,
}: {
  playhead: number;
  total: number;
  playing: boolean;
  speed: number;
  currentLabel: string;
  onPlayPause: () => void;
  onStop: () => void;
  onStep: () => void;
  onStepBack: () => void;
  onSeek: (i: number) => void;
  onSpeed: (s: number) => void;
}) {
  const idle = total === 0;
  const shown = Math.max(0, playhead + 1);
  return (
    <div className="flex h-12 shrink-0 items-center gap-3 border-t border-line bg-[#0e1116] px-4">
      {/* transport */}
      <div className="flex items-center gap-1">
        <Btn onClick={onStop} title="Stop / reset" disabled={idle}>■</Btn>
        <Btn onClick={onStepBack} title="Step back" disabled={idle}>⏮</Btn>
        <Btn onClick={onPlayPause} title={playing ? "Pause" : "Play"} disabled={idle} primary>
          {playing ? "❚❚" : "▶"}
        </Btn>
        <Btn onClick={onStep} title="Step forward" disabled={idle}>⏭</Btn>
      </div>

      {/* scrubber */}
      <input
        type="range"
        min={-1}
        max={Math.max(total - 1, 0)}
        value={playhead}
        onChange={(e) => onSeek(Number(e.target.value))}
        disabled={idle}
        className="cordon-scrub h-1 flex-1 cursor-pointer appearance-none rounded-full bg-line2 accent-[var(--color-healthy)] disabled:opacity-40"
      />

      {/* step counter + current event */}
      <div className="flex w-[210px] shrink-0 items-center justify-end gap-2 font-mono text-[10.5px]">
        <span className="tabular-nums text-faint">{shown}/{total}</span>
        <span className="truncate text-muted" title={currentLabel}>{currentLabel}</span>
      </div>

      {/* speed */}
      <div className="flex shrink-0 items-center gap-1 rounded-md border border-line2 p-0.5">
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => onSpeed(s)}
            disabled={idle}
            className={`rounded px-1.5 py-0.5 font-mono text-[10px] tabular-nums transition-colors disabled:opacity-40 ${
              speed === s ? "bg-line2 text-text" : "text-faint hover:text-muted"
            }`}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  );
}

function Btn({
  children,
  onClick,
  title,
  disabled,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`flex size-7 items-center justify-center rounded-md border font-mono text-[11px] transition-colors disabled:opacity-40 ${
        primary
          ? "border-healthy/50 text-healthy hover:bg-healthy/10"
          : "border-line2 text-muted hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}
