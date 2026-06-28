"use client";

import { useState } from "react";
import { TopBar, type Mode } from "@/components/TopBar";
import { Legend } from "@/components/Legend";
import { Panel } from "@/components/ui/Panel";
import { EventStreamPanel } from "@/components/EventStreamPanel";
import { AgentGraph } from "@/components/AgentGraph";
import { VaultPanel } from "@/components/VaultPanel";
import { RecorderPanel } from "@/components/RecorderPanel";
import { EmailCard } from "@/components/EmailCard";
import { PlayerBar } from "@/components/PlayerBar";
import { BenchmarkOverlay, type BenchmarkData } from "@/components/BenchmarkOverlay";
import { NetblockOverlay, type NetblockData } from "@/components/NetblockOverlay";
import { useEventStream } from "@/lib/useEventStream";
import { useTimelinePlayer } from "@/lib/useTimelinePlayer";
import { STANDALONE } from "@/lib/demoData";

export default function Page() {
  const { state: liveState, connected, runLive, liveRunning, fetchBenchmark, runNetblockProof } = useEventStream();
  const player = useTimelinePlayer();

  // "player" = scripted demo (full play/pause/step/scrub); "live" = real-time SSE swarm
  const [source, setSource] = useState<"player" | "live">("player");
  const [mode, setMode] = useState<Mode>("on");
  const [scenario, setScenario] = useState<"deploy" | "payment">("deploy");
  const [bench, setBench] = useState<BenchmarkData | null>(null);
  const [benchLoading, setBenchLoading] = useState(false);
  const [netblock, setNetblock] = useState<NetblockData | null>(null);
  const [netblockLoading, setNetblockLoading] = useState(false);

  const state = source === "player" ? player.state : liveState;

  const onMode = (m: Mode) => {
    setMode(m);
    setSource("player");
    player.load(scenario, m); // load the timeline + autoplay locally
  };
  const onScenario = (s: "deploy" | "payment") => {
    setScenario(s);
    setSource("player");
    player.load(s, mode);
  };
  const onRunLive = () => {
    setSource("live");
    runLive();
  };

  const openBench = async () => {
    setBenchLoading(true);
    try {
      setBench(await fetchBenchmark());
    } finally {
      setBenchLoading(false);
    }
  };
  const openNetblock = async () => {
    setNetblock(null);
    setNetblockLoading(true);
    try {
      setNetblock(await runNetblockProof());
    } finally {
      setNetblockLoading(false);
    }
  };

  return (
    <div className="flex h-screen flex-col">
      <TopBar
        mode={mode}
        onMode={onMode}
        counters={state.counters}
        contained={state.contained}
        connected={STANDALONE ? true : connected}
        onRunLive={STANDALONE ? undefined : onRunLive}
        liveRunning={liveRunning}
        scenario={scenario}
        onScenario={onScenario}
        onBenchmark={openBench}
        benchLoading={benchLoading}
        onNetblock={STANDALONE ? undefined : openNetblock}
        netblockLoading={netblockLoading}
      />

      <main className="grid min-h-0 flex-1 grid-cols-[1fr_400px] gap-3 p-3">
        {/* left — contact graph (email sits beside the graph, never over it) */}
        <Panel title="Contact graph — agent swarm" right={<Legend />}>
          <div className="flex h-full gap-3 p-3">
            <EmailCard email={state.incomingEmail} />
            <div className="relative flex-1">
              {state.order.length === 0 ? <EmptyGraph /> : <AgentGraph state={state} />}
            </div>
          </div>
        </Panel>

        {/* right — three stacked panels */}
        <div className="grid min-h-0 grid-rows-[1.1fr_1fr_1.2fr] gap-3">
          <VaultPanel state={state} />
          <Panel title="Live event stream">
            <EventStreamPanel log={state.log} />
          </Panel>
          <RecorderPanel entries={state.recorder} />
        </div>
      </main>

      {source === "player" && (
        <PlayerBar
          playhead={player.playhead}
          total={player.timeline.length}
          playing={player.playing}
          speed={player.speed}
          currentLabel={player.currentLabel}
          onPlayPause={player.playPause}
          onStop={player.stop}
          onStep={player.step}
          onStepBack={player.stepBack}
          onSeek={player.seek}
          onSpeed={player.setSpeed}
        />
      )}

      <BenchmarkOverlay data={bench} onClose={() => setBench(null)} />
      <NetblockOverlay data={netblock} loading={netblockLoading} onClose={() => { setNetblock(null); setNetblockLoading(false); }} />
    </div>
  );
}

function EmptyGraph() {
  return (
    <div
      className="absolute inset-0 grid place-items-center"
      style={{
        backgroundImage: "radial-gradient(var(--color-line) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
      }}
    >
      <div className="text-center">
        <p className="font-mono text-[12px] uppercase tracking-[0.2em] text-faint">
          contact graph renders here
        </p>
        <p className="mt-3 font-mono text-[11px] text-muted">
          ▶ flip <span className="text-text">CORDON OFF / ON</span> to load the scenario, then use the player below to step through it
        </p>
      </div>
    </div>
  );
}
