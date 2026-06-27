import type { ReactNode } from "react";

type Tone = "neutral" | "healthy" | "tainted" | "compromised" | "quarantined";

const TONE: Record<Tone, string> = {
  neutral: "border-line text-muted",
  healthy: "border-healthy/40 bg-healthy/10 text-healthy",
  tainted: "border-tainted/40 bg-tainted/10 text-tainted",
  compromised: "border-compromised/40 bg-compromised/10 text-compromised",
  quarantined: "border-quarantined/40 bg-quarantined/10 text-quarantined",
};

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] tracking-wide ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}
