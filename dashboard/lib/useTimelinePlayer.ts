"use client";

// Client-side timeline player for the scripted demo. Fetches the full event list
// once, then plays it locally with play / pause / stop / step / step-back / scrub /
// speed. State at any playhead is derived by folding the pure reducer over
// events[0..playhead] — which is what makes instant scrub/rewind possible.
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CordonEvent } from "./events";
import { initialState, reduce, type UIState } from "./state";
import { STANDALONE, getTimeline } from "./demoData";

const API = process.env.NEXT_PUBLIC_CORDON_API ?? "http://127.0.0.1:8000";

export interface TimelineEntry {
  delay_ms: number;
  event: CordonEvent["event"];
  data: CordonEvent["data"];
}

export const SPEEDS = [0.5, 1, 2, 4] as const;

export function useTimelinePlayer() {
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [playhead, setPlayhead] = useState(-1); // index of last-applied event (-1 = nothing yet)
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const load = useCallback(async (scenario: "deploy" | "payment", mode: "on" | "off", autoplay = true) => {
    let events: TimelineEntry[];
    if (STANDALONE) {
      events = getTimeline(scenario, mode);
    } else {
      const r = await fetch(`${API}/demo/timeline?scenario=${scenario}&mode=${mode}`);
      events = (await r.json()).events ?? [];
    }
    setTimeline(events);
    setPlayhead(-1);
    setPlaying(autoplay);
  }, []);

  // Derive UI state by folding the reducer up to the playhead. Pure → instant scrub.
  const state: UIState = useMemo(() => {
    let s = initialState;
    const base = Date.now() - 60_000;
    let acc = 0;
    for (let i = 0; i <= playhead && i < timeline.length; i++) {
      const e = timeline[i];
      acc += e.delay_ms || 0;
      s = reduce(s, { event: e.event, seq: i + 1, ts: new Date(base + acc).toISOString(), data: e.data } as CordonEvent);
    }
    return s;
  }, [timeline, playhead]);

  // Auto-advance while playing, honoring each event's delay / speed.
  useEffect(() => {
    if (!playing || timeline.length === 0) return;
    if (playhead >= timeline.length - 1) {
      setPlaying(false);
      return;
    }
    const next = timeline[playhead + 1];
    const ms = Math.max((next.delay_ms || 0) / speed, 16);
    const t = setTimeout(() => setPlayhead((p) => p + 1), ms);
    return () => clearTimeout(t);
  }, [playing, playhead, speed, timeline]);

  const atEnd = playhead >= timeline.length - 1 && timeline.length > 0;

  const playPause = useCallback(() => {
    setPlaying((p) => {
      if (!p && (playhead >= timeline.length - 1)) setPlayhead(-1); // replay from start if at end
      return !p;
    });
  }, [playhead, timeline.length]);
  const stop = useCallback(() => { setPlaying(false); setPlayhead(-1); }, []);
  const step = useCallback(() => { setPlaying(false); setPlayhead((p) => Math.min(p + 1, timeline.length - 1)); }, [timeline.length]);
  const stepBack = useCallback(() => { setPlaying(false); setPlayhead((p) => Math.max(p - 1, -1)); }, []);
  const seek = useCallback((i: number) => { setPlaying(false); setPlayhead(Math.max(-1, Math.min(i, timeline.length - 1))); }, [timeline.length]);

  const currentLabel = playhead >= 0 && playhead < timeline.length ? timeline[playhead].event : "ready";

  return {
    state, timeline, playhead, playing, speed, atEnd, currentLabel,
    load, playPause, stop, step, stepBack, seek, setSpeed,
  };
}
