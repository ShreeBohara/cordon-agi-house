"use client";

import { motion } from "motion/react";
import type { UIState } from "@/lib/state";
import { Empty, Panel } from "./ui/Panel";

const shortRef = (r?: string) => (r ? r.replace(/^op:\/\//, "") : "—");

// friendly name of the sensitive credential, derived from its op:// reference
const heroTitle = (ref?: string) => {
  if (!ref) return "Production Deploy Key";
  const parts = ref.replace(/^op:\/\//, "").split("/");
  return parts[1] || parts[0] || "Sensitive credential";
};

type HeroState = UIState["hero"]["state"];

const HERO: Record<HeroState, { color: string; locked: boolean; sub: (by?: string) => string; line: string | null }> = {
  guarded: { color: "#6b7280", locked: true, sub: () => "sensitive · guarded by Deployer", line: null },
  requested: { color: "#f59e0b", locked: true, sub: (by) => `requested by ${by} …`, line: null },
  denied: { color: "#34d399", locked: true, sub: (by) => `withheld from ${by} (tainted)`, line: "1Password was never queried" },
  released: { color: "#fb3b53", locked: false, sub: (by) => `released to ${by} (tainted)`, line: "secret entered the model's context" },
  leaked: { color: "#fb3b53", locked: false, sub: (by) => `exfiltrated by ${by}`, line: "production secret left the swarm" },
};

export function VaultPanel({ state }: { state: UIState }) {
  const { order, agents, hero } = state;
  return (
    <Panel title="Credential vault">
      {order.length === 0 ? (
        <Empty label="No credentials issued yet" />
      ) : (
        <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
          <HeroCard hero={hero} />
          <div className="space-y-1.5">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-faint">runtime credentials</p>
            {order.map((id) => (
              <CredRow key={id} name={agents[id].name} cred={agents[id].credential} vault={agents[id].vault} />
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

function HeroCard({ hero }: { hero: UIState["hero"] }) {
  const cfg = HERO[hero.state];
  return (
    <motion.div
      key={hero.state}
      initial={{ opacity: 0, scale: 0.93 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 17 }}
      className="rounded-lg border p-3"
      style={{ borderColor: `${cfg.color}66`, background: `${cfg.color}12` }}
    >
      <div className="flex items-center gap-2.5">
        <motion.span
          key={hero.state + "-lock"}
          initial={{ rotate: cfg.locked ? -18 : 0, scale: 0.8 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 14 }}
        >
          <LockBig locked={cfg.locked} color={cfg.color} />
        </motion.span>
        <div className="min-w-0">
          <p className="font-sans text-[12.5px] font-semibold text-text">{heroTitle(hero.secret_ref)}</p>
          <p className="truncate font-mono text-[9.5px]" style={{ color: cfg.color }}>{cfg.sub(hero.by)}</p>
        </div>
      </div>
      {cfg.line && (
        <p
          className="mt-2.5 border-t pt-2 font-mono text-[10.5px] font-medium tracking-wide"
          style={{ color: cfg.color, borderColor: `${cfg.color}33` }}
        >
          {hero.state === "denied" ? "✓ " : "⚠ "}
          {cfg.line}
        </p>
      )}
    </motion.div>
  );
}

function CredRow({ name, cred, vault }: { name: string; cred?: string; vault: string }) {
  const color =
    vault === "issued" ? "#34d399" : vault === "revoked" ? "#4f8cff" : vault === "locked" ? "#9aa3b2" : "#59616f";
  const label = vault === "none" ? "—" : vault;
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-line bg-ink/40 px-2.5 py-1.5">
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="font-sans text-[11px] text-text">{name}</span>
        <span className="truncate font-mono text-[9px] text-faint">{shortRef(cred)}</span>
      </div>
      <span className="cordon-anim flex shrink-0 items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider" style={{ color }}>
        <LockSmall open={vault === "issued"} color={color} />
        {label}
      </span>
    </div>
  );
}

function LockBig({ locked, color }: { locked: boolean; color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      {locked ? <path d="M8 11V8a4 4 0 0 1 8 0v3" /> : <path d="M8 11V7a4 4 0 0 1 8 0" />}
    </svg>
  );
}

function LockSmall({ open, color }: { open: boolean; color: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      {open ? <path d="M8 11V7a4 4 0 0 1 8 0" /> : <path d="M8 11V8a4 4 0 0 1 8 0v3" />}
    </svg>
  );
}
