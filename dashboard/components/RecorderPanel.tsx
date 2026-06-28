"use client";

import { useState } from "react";
import { motion } from "motion/react";
import type { RecorderRow } from "@/lib/state";
import { Empty, Panel } from "./ui/Panel";

const GENESIS = "0".repeat(64);
const short = (h: string, n = 10) => h.slice(0, n);

const TONE: Record<string, string> = {
  tainted: "#f59e0b",
  credential_denied: "#fb3b53",
  patient_zero_confirmed: "#fb3b53",
  quarantine_started: "#4f8cff",
  quarantine_complete: "#4f8cff",
};

/** Real, client-side hash-chain integrity check: each entry's prev_hash must
 *  equal the previous entry's entry_hash. Tampering breaks a link. */
function verifyChain(entries: RecorderRow[], tamperIdx: number | null): boolean {
  let prev = GENESIS;
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].prev_hash !== prev) return false;
    const eh = i === tamperIdx ? "deadbeef" + entries[i].entry_hash.slice(8) : entries[i].entry_hash;
    prev = eh;
  }
  return true;
}

export function RecorderPanel({ entries }: { entries: RecorderRow[] }) {
  const [tamper, setTamper] = useState<number | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  const verified = verifyChain(entries, tamper);
  const tamperIdx = tamper !== null && tamper < entries.length ? tamper : null;

  const right =
    entries.length === 0 ? (
      <span className="font-mono text-[10.5px] text-faint">verify —</span>
    ) : (
      <div className="flex items-center gap-2.5">
        <button
          onClick={() => setTamper((t) => (t === null ? Math.min(1, entries.length - 1) : null))}
          className="font-mono text-[9px] uppercase tracking-wider text-faint transition-colors hover:text-muted"
        >
          {tamper === null ? "tamper" : "restore"}
        </button>
        <motion.span
          key={String(verified)}
          initial={{ scale: 0.85 }}
          animate={{ scale: 1 }}
          className="font-mono text-[10.5px] font-medium"
          style={{ color: verified ? "#34d399" : "#fb3b53" }}
        >
          {verified ? "verify ✓" : "verify ✗"}
        </motion.span>
      </div>
    );

  return (
    <Panel title="Flight recorder — signed & hash-chained" right={right}>
      {entries.length === 0 ? (
        <Empty label="No entries yet" />
      ) : (
        <div className="h-full overflow-y-auto px-2.5 py-2">
          {entries.map((e, i) => {
            const broken = tamperIdx !== null && i === tamperIdx;
            const color = TONE[e.event_type] ?? "#9aa3b2";
            return (
              <div
                key={e.seq}
                className="cursor-pointer border-b border-line/60 py-2 last:border-0"
                onClick={() => setOpen((o) => (o === i ? null : i))}
              >
                <div className="flex items-center gap-2 font-mono text-[12px]">
                  <span className="text-faint tabular-nums">#{String(e.seq).padStart(2, "0")}</span>
                  <span style={{ color }}>{e.event_type}</span>
                  <span className="text-faint">·</span>
                  <span className="text-muted">{e.actor}</span>
                  <span className="ml-auto flex items-center gap-1">
                    <HashChip label="hash" value={short(e.entry_hash)} broken={broken} />
                    <HashChip label="sig" value={short(e.signature.replace(/^ed25519:/, ""), 8)} />
                  </span>
                </div>
                {open === i && (
                  <div className="mt-1.5 space-y-0.5 rounded bg-ink/50 p-2 font-mono text-[9.5px] text-faint">
                    <Line k="prev" v={e.prev_hash} />
                    <Line k="hash" v={broken ? "deadbeef" + e.entry_hash.slice(8) : e.entry_hash} broken={broken} />
                    <Line k="sig" v={e.signature} />
                    <Line k="key" v={e.pubkey_id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function HashChip({ label, value, broken }: { label: string; value: string; broken?: boolean }) {
  return (
    <code
      className="rounded border px-1 py-0.5 text-[10px]"
      style={{
        borderColor: broken ? "#fb3b5366" : "var(--color-line)",
        color: broken ? "#fb3b53" : "var(--color-faint)",
        background: broken ? "#fb3b531a" : "transparent",
      }}
    >
      {label}:{value}…
    </code>
  );
}

function Line({ k, v, broken }: { k: string; v: string; broken?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="w-8 shrink-0 text-faint">{k}</span>
      <span className="break-all" style={{ color: broken ? "#fb3b53" : undefined }}>{v}</span>
    </div>
  );
}
