"use client";

import { Handle, Position } from "@xyflow/react";
import { motion } from "motion/react";
import type { AgentStatus } from "@/lib/events";
import type { AgentUI } from "@/lib/state";

const COLOR: Record<AgentStatus, string> = {
  healthy: "#34d399",
  tainted: "#f59e0b",
  compromised: "#fb3b53",
  quarantined: "#4f8cff",
};
const LABEL: Record<AgentStatus, string> = {
  healthy: "healthy",
  tainted: "tainted",
  compromised: "breach",
  quarantined: "quarantined",
};

const shortRef = (r?: string) => (r ? r.replace(/^op:\/\//, "") : "—");

type NodeData = AgentUI & { display: AgentStatus };

export function AgentNode({ data }: { data: NodeData }) {
  const c = COLOR[data.display];
  const vaultColor =
    data.vault === "issued" ? "#34d399"
    : data.vault === "revoked" ? "#4f8cff"
    : data.vault === "locked" ? "#9aa3b2"
    : "#5b6472";
  const vaultLabel =
    data.vault === "issued" ? "issued"
    : data.vault === "revoked" ? "revoked"
    : data.vault === "locked" ? "locked"
    : "none";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 240, damping: 22 }}
      className="cordon-anim relative w-[260px] rounded-2xl border-2 bg-[#161b22] px-4 py-3.5"
      style={{ borderColor: `${c}66`, boxShadow: `0 0 0 1px ${c}22, 0 12px 40px ${c}26` }}
    >
      {/* glow pulse that re-fires on every state change */}
      <motion.span
        key={data.display}
        aria-hidden
        className="pointer-events-none absolute -inset-0.5 rounded-2xl"
        initial={{ opacity: 0.8 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 1.1, ease: "easeOut" }}
        style={{ boxShadow: `0 0 0 2px ${c}, 0 0 30px 3px ${c}` }}
      />

      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-transparent" />

      {/* header: status dot + name + status pill */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className="cordon-anim size-3 rounded-full"
            style={{ backgroundColor: c, boxShadow: `0 0 12px ${c}` }}
          />
          <span className="font-sans text-[17px] font-semibold leading-none text-text">{data.name}</span>
        </div>
        <span
          className="cordon-anim shrink-0 rounded-full border px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-[0.12em]"
          style={{ color: c, borderColor: `${c}55`, background: `${c}1a` }}
        >
          {LABEL[data.display]}
        </span>
      </div>

      {/* role */}
      <p className="mt-2 font-sans text-[12px] leading-snug text-muted">{data.role}</p>

      {/* credential sub-block */}
      <div className="mt-3 rounded-lg border border-line bg-black/25 px-2.5 py-2">
        <p className="mb-1 font-mono text-[8.5px] uppercase tracking-[0.18em] text-faint">credential</p>
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <LockGlyph open={data.vault === "issued"} color={vaultColor} />
            <span
              className="cordon-anim truncate font-mono text-[11px]"
              style={{ color: vaultColor }}
              title={data.credential}
            >
              {data.vault === "none" ? "none" : shortRef(data.credential)}
            </span>
          </span>
          <span
            className="cordon-anim shrink-0 font-mono text-[9px] uppercase tracking-wider"
            style={{ color: vaultColor }}
          >
            {vaultLabel}
          </span>
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-transparent" />
    </motion.div>
  );
}

function LockGlyph({ open, color }: { open: boolean; color: string }) {
  return (
    <svg
      width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      className="shrink-0"
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      {open ? <path d="M8 11V7a4 4 0 0 1 8 0" /> : <path d="M8 11V8a4 4 0 0 1 8 0v3" />}
    </svg>
  );
}
