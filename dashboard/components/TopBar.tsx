"use client";

import { motion } from "motion/react";
import { Pill } from "./ui/Pill";

export type Mode = "off" | "on";
export type Counters = { exposed: number; leaked: number; breached: number };

export function TopBar({
  mode,
  onMode,
  counters,
  contained,
  connected = false,
  onRunLive,
  liveRunning = false,
  scenario = "deploy",
  onScenario,
  onBenchmark,
  benchLoading = false,
  onNetblock,
  netblockLoading = false,
}: {
  mode: Mode;
  onMode: (m: Mode) => void;
  counters: Counters;
  contained: boolean | null;
  connected?: boolean;
  onRunLive?: () => void;
  liveRunning?: boolean;
  scenario?: "deploy" | "payment";
  onScenario?: (s: "deploy" | "payment") => void;
  onBenchmark?: () => void;
  benchLoading?: boolean;
  onNetblock?: () => void;
  netblockLoading?: boolean;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-line px-5">
      {/* ── brand + status ── */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[16px] font-bold tracking-[0.3em] text-text">CORDON</span>
          <span
            className="size-1.5 rounded-full"
            title={connected ? "connected to control plane" : "offline"}
            style={{ background: connected ? "var(--color-healthy)" : "var(--color-faint)" }}
          />
        </div>

        <Divider />

        <div className="flex items-center gap-3.5">
          <Stat label="exposed" value={counters.exposed} tone="tainted" />
          <Stat label="leaked" value={counters.leaked} tone="compromised" />
          <Stat label="breached" value={counters.breached} tone="compromised" />
        </div>

        <Pill tone={contained == null ? "neutral" : contained ? "healthy" : "compromised"}>
          {contained == null ? "IDLE" : contained ? "CONTAINED" : "BREACH"}
        </Pill>
      </div>

      {/* ── controls ── */}
      <div className="flex items-center gap-3">
        {onScenario && (
          <Segmented
            options={[["deploy", "deploy"], ["payment", "payment"]]}
            value={scenario}
            onChange={(v) => onScenario(v as "deploy" | "payment")}
          />
        )}
        <Segmented
          options={[["off", "off"], ["on", "on"]]}
          value={mode}
          onChange={(v) => onMode(v as Mode)}
          accent
        />

        <Divider />

        <div className="flex items-center overflow-hidden rounded-md border border-line2 font-mono text-[10.5px] uppercase tracking-wider">
          {onRunLive && (
            <Action onClick={onRunLive} loading={liveRunning} label="run live" busy="running" dot first />
          )}
          {onBenchmark && (
            <Action onClick={onBenchmark} loading={benchLoading} label="benchmark" busy="running" />
          )}
          {onNetblock && (
            <Action onClick={onNetblock} loading={netblockLoading} label="netblock" busy="proving" />
          )}
        </div>
      </div>
    </header>
  );
}

function Divider() {
  return <span className="h-5 w-px shrink-0 bg-line" />;
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "tainted" | "compromised" }) {
  return (
    <span className="flex items-baseline gap-1 font-mono leading-none">
      <motion.span
        key={value}
        initial={{ scale: 1.3, opacity: 0.5 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 18 }}
        className="text-[15px] font-semibold tabular-nums"
        style={{ color: value > 0 ? `var(--color-${tone})` : "var(--color-muted)" }}
      >
        {value}
      </motion.span>
      <span className="text-[9px] uppercase tracking-[0.14em] text-faint">{label}</span>
    </span>
  );
}

function Segmented({
  options,
  value,
  onChange,
  accent,
}: {
  options: [string, string][];
  value: string;
  onChange: (v: string) => void;
  accent?: boolean;
}) {
  return (
    <div className="flex rounded-md border border-line2 bg-ink p-0.5 font-mono text-[11px]">
      {options.map(([val, label]) => {
        const active = value === val;
        const activeColor = accent ? (val === "on" ? "text-healthy" : "text-compromised") : "text-text";
        return (
          <button
            key={val}
            onClick={() => onChange(val)}
            className={`rounded px-2.5 py-1 uppercase tracking-wider transition-colors ${
              active ? `${activeColor} bg-panel2` : "text-faint hover:text-muted"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function Action({
  onClick,
  loading,
  label,
  busy,
  dot,
  first,
}: {
  onClick: () => void;
  loading: boolean;
  label: string;
  busy: string;
  dot?: boolean;
  first?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-muted transition-colors hover:bg-panel2 hover:text-text disabled:opacity-60 ${
        first ? "" : "border-l border-line2"
      }`}
    >
      {dot && <span className={`size-1.5 rounded-full ${loading ? "animate-pulse bg-healthy" : "bg-faint"}`} />}
      {loading ? `${busy}…` : label}
    </button>
  );
}
