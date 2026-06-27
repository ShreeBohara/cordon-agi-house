"use client";

import { AnimatePresence, motion } from "motion/react";

export type NetblockData = {
  configured: boolean;
  sandbox_id?: string;
  url?: string;
  before?: { raw: string; reachable: boolean };
  after?: { raw: string; blocked: boolean };
};

export function NetblockOverlay({
  data,
  loading,
  onClose,
}: {
  data: NetblockData | null;
  loading: boolean;
  onClose: () => void;
}) {
  const open = loading || !!data;
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="w-[520px] max-w-[94vw] overflow-hidden rounded-xl border border-line2 bg-[#0e1116] shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-line px-5 py-3.5">
              <div>
                <h2 className="font-mono text-[13px] font-semibold uppercase tracking-[0.18em] text-text">
                  Daytona network isolation — live proof
                </h2>
                <p className="mt-1 font-mono text-[10px] text-faint">
                  a real sandbox, created &amp; destroyed for this test
                </p>
              </div>
              <button onClick={onClose} className="ml-4 shrink-0 text-faint transition-colors hover:text-text">✕</button>
            </div>

            <div className="px-5 py-4">
              {loading && !data ? (
                <LoadingView />
              ) : data && !data.configured ? (
                <p className="font-mono text-[12px] text-tainted">Daytona not configured (set DAYTONA_API_KEY).</p>
              ) : data ? (
                <Result data={data} />
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function LoadingView() {
  const steps = ["creating real Daytona sandbox", "curl out (network open)", "network_block_all = true", "curl out again"];
  return (
    <div className="space-y-2 py-2">
      {steps.map((s, i) => (
        <motion.div
          key={s}
          initial={{ opacity: 0.3 }}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.35 }}
          className="flex items-center gap-2 font-mono text-[11px] text-muted"
        >
          <span className="size-1.5 rounded-full bg-healthy" /> {s}…
        </motion.div>
      ))}
    </div>
  );
}

function Result({ data }: { data: NetblockData }) {
  return (
    <div className="space-y-3">
      <div className="font-mono text-[10px] text-faint">
        sandbox <span className="text-muted">{data.sandbox_id}</span> · target <span className="text-muted">{data.url}</span>
      </div>

      <Step
        n={1}
        label="network OPEN"
        sub={`curl → ${data.before?.raw}`}
        verdict={data.before?.reachable ? "exfiltration possible" : "unreachable"}
        tone={data.before?.reachable ? "compromised" : "muted"}
      />
      <Step
        n={2}
        label="network_block_all = true"
        sub={`curl → ${data.after?.raw || "blocked"}`}
        verdict={data.after?.blocked ? "exfiltration BLOCKED" : "still reachable"}
        tone={data.after?.blocked ? "healthy" : "compromised"}
      />

      <p className="border-t border-line pt-3 font-mono text-[10px] leading-relaxed text-faint">
        On quarantine, CORDON calls this same <span className="text-text">update_network_settings(network_block_all=True)</span>{" "}
        on every exposed agent's sandbox — real infrastructure, not a mock.
      </p>
    </div>
  );
}

function Step({
  n, label, sub, verdict, tone,
}: { n: number; label: string; sub: string; verdict: string; tone: "healthy" | "compromised" | "muted" }) {
  const color = `var(--color-${tone})`;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-ink/40 px-3.5 py-2.5">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-line2 font-mono text-[10px] text-faint">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[11px] text-text">{label}</p>
        <p className="font-mono text-[10px] text-faint">{sub}</p>
      </div>
      <span className="shrink-0 font-mono text-[10px] font-medium uppercase tracking-wider" style={{ color }}>
        {verdict}
      </span>
    </div>
  );
}
