"use client";

import { useEffect, useRef } from "react";
import type { LogEntry, LogTone } from "@/lib/state";
import { Empty } from "./ui/Panel";

const TONE: Record<LogTone, string> = {
  muted: "text-faint",
  info: "text-muted",
  taint: "text-tainted",
  danger: "text-compromised",
  quarantine: "text-quarantined",
  ok: "text-healthy",
};

function fmt(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString("en-US", { hour12: false });
  } catch {
    return "--:--:--";
  }
}

export function EventStreamPanel({ log }: { log: LogEntry[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [log.length]);

  if (log.length === 0) return <Empty label="Awaiting events…" />;

  return (
    <div ref={ref} className="h-full overflow-y-auto px-3 py-2 font-mono text-[11px] leading-[1.7]">
      {log.map((e) => (
        <div key={e.key} className="flex gap-2.5 py-px">
          <span className="shrink-0 tabular-nums text-faint">{fmt(e.ts)}</span>
          <span className={TONE[e.tone]}>{e.text}</span>
        </div>
      ))}
    </div>
  );
}
