"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MarkerType,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from "@xyflow/react";
import { displayStatus } from "@/lib/events";
import type { UIState } from "@/lib/state";
import { AgentNode } from "./AgentNode";

// Left→right infection spine with a gentle wave, positioned by index so ANY
// roster (deploy swarm, finance swarm, …) lays out cleanly. fitView scales it.
const pos = (i: number) => ({ x: i * 250, y: i % 2 === 0 ? 0 : 86 });

const nodeTypes = { agent: AgentNode };

const TAINT = "#f59e0b";
const GREY = "#454d5a";

export function AgentGraph({ state }: { state: UIState }) {
  const rf = useRef<ReactFlowInstance | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  // Re-fit whenever the container resizes (email column appears/collapses, window
  // resize, layout settle). This is what keeps the graph correctly sized on any screen.
  useEffect(() => {
    if (!wrap.current) return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => rf.current?.fitView({ padding: 0.18, maxZoom: 1.1, duration: 200 }));
    });
    ro.observe(wrap.current);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  const nodes = useMemo<Node[]>(
    () =>
      state.order.map((id, i) => {
        const a = state.agents[id];
        return {
          id,
          type: "agent",
          position: pos(i),
          draggable: false,
          data: { ...a, display: displayStatus(a.status, state.mode) },
        };
      }),
    [state.agents, state.order, state.mode],
  );

  const edges = useMemo<Edge[]>(
    () =>
      state.edges.map((e) => {
        const taint = e.carried_taint;
        return {
          id: e.id,
          source: e.from,
          target: e.to,
          animated: taint,
          markerEnd: { type: MarkerType.ArrowClosed, color: taint ? TAINT : GREY, width: 16, height: 16 },
          style: { stroke: taint ? TAINT : GREY, strokeWidth: taint ? 2 : 1.5 },
        };
      }),
    [state.edges],
  );

  return (
    <div ref={wrap} className="absolute inset-0 z-0">
      <ReactFlow
        onInit={(inst) => { rf.current = inst; }}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.18, maxZoom: 1.1 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        minZoom={0.2}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#2a313c" />
      </ReactFlow>
    </div>
  );
}
