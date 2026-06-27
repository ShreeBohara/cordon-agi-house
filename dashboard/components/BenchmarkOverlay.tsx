"use client";

import { AnimatePresence, motion } from "motion/react";

type Metrics = {
  attack_success: number;
  containment: number;
  secrets_leaked: number;
  false_positive: number;
  utility_preserved: number;
  mean_decision_ms: number | null;
};
type CaseRow = {
  id: string;
  kind: string;
  content: string;
  reaches_sensitive: boolean;
  cordon: string;
  detector: string;
};
export type BenchmarkData = {
  methodology: string;
  n_attacks: number;
  n_benign: number;
  cordon: Metrics;
  detector: Metrics;
  cases: CaseRow[];
};

const pct = (x: number) => `${Math.round(x * 100)}%`;

// metric rows: [label, key, betterIsLower]
const ROWS: [string, keyof Metrics, boolean][] = [
  ["Attack success", "attack_success", true],
  ["Containment", "containment", false],
  ["Secrets leaked", "secrets_leaked", true],
  ["False positives", "false_positive", true],
  ["Utility preserved", "utility_preserved", false],
];

const fmt = (key: keyof Metrics, v: number | null) => {
  if (v == null) return "—";
  if (key === "secrets_leaked") return String(v);
  return pct(v as number);
};

const outcomeColor = (o: string) =>
  /contained|allowed|caught/.test(o) && !/false positive/.test(o)
    ? "var(--color-healthy)"
    : /missed|leaked/i.test(o)
      ? "var(--color-compromised)"
      : "var(--color-tainted)"; // false positive

export function BenchmarkOverlay({ data, onClose }: { data: BenchmarkData | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {data && (
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
            className="flex max-h-[88vh] w-[920px] max-w-[94vw] flex-col overflow-hidden rounded-xl border border-line2 bg-[#0e1116] shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-line px-5 py-3.5">
              <div>
                <h2 className="font-mono text-[13px] font-semibold uppercase tracking-[0.18em] text-text">
                  Eval — provenance vs. detection
                </h2>
                <p className="mt-1 max-w-[680px] font-mono text-[10px] leading-relaxed text-faint">{data.methodology}</p>
              </div>
              <button onClick={onClose} className="ml-4 shrink-0 text-faint transition-colors hover:text-text">✕</button>
            </div>

            <div className="overflow-y-auto px-5 py-4">
              {/* comparison table */}
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-8 gap-y-2.5 rounded-lg border border-line bg-ink/40 px-4 py-3.5">
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-faint">metric</span>
                <span className="text-right font-mono text-[9px] uppercase tracking-[0.16em] text-healthy">CORDON</span>
                <span className="text-right font-mono text-[9px] uppercase tracking-[0.16em] text-faint">naive detector</span>
                {ROWS.map(([label, key, betterLow]) => {
                  const c = data.cordon[key] as number;
                  const d = data.detector[key] as number;
                  const cBetter = betterLow ? c <= d : c >= d;
                  return (
                    <Fragment3 key={key} label={label} cVal={fmt(key, c)} dVal={fmt(key, d)} cGood={cBetter} dGood={!cBetter} />
                  );
                })}
                <span className="font-mono text-[11px] text-muted">Decision latency</span>
                <span className="text-right font-mono text-[12px] tabular-nums text-healthy">
                  {data.cordon.mean_decision_ms != null ? `${data.cordon.mean_decision_ms} ms` : "—"}
                </span>
                <span className="text-right font-mono text-[12px] tabular-nums text-faint">n/a</span>
              </div>

              <p className="mt-3 font-mono text-[10px] leading-relaxed text-faint">
                CORDON is sound <span className="text-healthy">by construction</span>: taint attaches to the channel,
                not the content — paraphrasing/obfuscating the injection can't evade it, and only sensitive sinks are
                gated. The detector both <span className="text-compromised">misses paraphrased attacks</span> and{" "}
                <span className="text-tainted">false-positives on benign text</span>.
              </p>

              {/* per-case table */}
              <table className="mt-4 w-full border-collapse font-mono text-[10px]">
                <thead>
                  <tr className="border-b border-line text-left text-faint">
                    <th className="py-1.5 pr-2 font-normal">#</th>
                    <th className="py-1.5 pr-2 font-normal">kind</th>
                    <th className="py-1.5 pr-2 font-normal">input</th>
                    <th className="py-1.5 pr-2 font-normal">CORDON</th>
                    <th className="py-1.5 font-normal">detector</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cases.map((c) => (
                    <tr key={c.id} className="border-b border-line/50 align-top">
                      <td className="py-1.5 pr-2 text-faint">{c.id}</td>
                      <td className="py-1.5 pr-2">
                        <span style={{ color: c.kind === "attack" ? "var(--color-compromised)" : "var(--color-muted)" }}>
                          {c.kind}
                        </span>
                      </td>
                      <td className="max-w-[360px] truncate py-1.5 pr-2 text-muted" title={c.content}>{c.content}</td>
                      <td className="py-1.5 pr-2" style={{ color: outcomeColor(c.cordon) }}>{c.cordon}</td>
                      <td className="py-1.5" style={{ color: outcomeColor(c.detector) }}>{c.detector}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="mt-3 font-mono text-[9.5px] leading-relaxed text-faint">
                Honest caveat (case b7): when a <span className="text-tainted">legitimate</span> sensitive action follows
                untrusted input, CORDON denies it too — a bounded, reversible false positive (freeze-not-kill + human
                override), unlike the detector's unbounded, content-based false positives.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Fragment3({
  label, cVal, dVal, cGood, dGood,
}: { label: string; cVal: string; dVal: string; cGood: boolean; dGood: boolean }) {
  return (
    <>
      <span className="font-mono text-[11px] text-muted">{label}</span>
      <span className="text-right font-mono text-[13px] font-semibold tabular-nums"
        style={{ color: cGood ? "var(--color-healthy)" : "var(--color-compromised)" }}>{cVal}</span>
      <span className="text-right font-mono text-[13px] font-semibold tabular-nums"
        style={{ color: dGood ? "var(--color-healthy)" : "var(--color-compromised)" }}>{dVal}</span>
    </>
  );
}
