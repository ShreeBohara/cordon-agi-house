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
    : "#59616f";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 240, damping: 22 }}
      className="cordon-anim relative w-[204px] rounded-xl border bg-[#161b22] px-4 py-3"
      style={{ borderColor: `${c}66`, boxShadow: `0 0 0 1px ${c}22, 0 10px 34px ${c}1f` }}
    >
      {/* glow pulse that re-fires on every state change */}
      <motion.span
        key={data.display}
        aria-hidden
        className="pointer-events-none absolute -inset-px rounded-xl"
        initial={{ opacity: 0.75 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 1.1, ease: "easeOut" }}
        style={{ boxShadow: `0 0 0 2px ${c}, 0 0 26px 2px ${c}` }}
      />

      <Handle type="target" position={Position.Left} className="!h-1.5 !w-1.5 !border-0 !bg-transparent" />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="cordon-anim size-2.5 rounded-full"
            style={{ backgroundColor: c, boxShadow: `0 0 10px ${c}` }}
          />
          <span className="font-sans text-[14px] font-semibold text-text">{data.name}</span>
        </div>
        <span
          className="cordon-anim font-mono text-[9px] uppercase tracking-[0.14em]"
          style={{ color: c }}
        >
          {LABEL[data.display]}
        </span>
      </div>

      <p className="mt-1.5 font-mono text-[10px] leading-snug text-faint">{data.role}</p>

      <div className="mt-2.5 flex items-center gap-1.5 border-t border-line pt-2">
        <LockGlyph open={data.vault === "issued"} color={vaultColor} />
        <span
          className="cordon-anim truncate font-mono text-[10px]"
          style={{ color: vaultColor }}
          title={data.credential}
        >
          {data.vault === "none" ? "no credential" : shortRef(data.credential)}
        </span>
      </div>

      <Handle type="source" position={Position.Right} className="!h-1.5 !w-1.5 !border-0 !bg-transparent" />
    </motion.div>
  );
}

function LockGlyph({ open, color }: { open: boolean; color: string }) {
  return (
    <svg
      width="11" height="11" viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      className="shrink-0"
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      {open ? <path d="M8 11V7a4 4 0 0 1 8 0" /> : <path d="M8 11V8a4 4 0 0 1 8 0v3" />}
    </svg>
  );
}
