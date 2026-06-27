"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { CordonEvent } from "./events";
import { initialState, reduce } from "./state";

const API = process.env.NEXT_PUBLIC_CORDON_API ?? "http://127.0.0.1:8000";

export function useEventStream() {
  const [state, dispatch] = useReducer(reduce, initialState);
  const [connected, setConnected] = useState(false);
  const [liveRunning, setLiveRunning] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(`${API}/stream`);
    esRef.current = es;
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false); // EventSource auto-reconnects
    es.onmessage = (e) => {
      try {
        dispatch(JSON.parse(e.data) as CordonEvent);
      } catch {
        /* ignore malformed frames (e.g. keepalive pings) */
      }
    };
    return () => {
      es.close();
      esRef.current = null;
    };
  }, []);

  const play = useCallback((mode: "off" | "on", scenario: "deploy" | "payment" = "deploy", speed = 1) => {
    fetch(`${API}/demo/play?mode=${mode}&scenario=${scenario}&speed=${speed}`, { method: "POST" }).catch(() => {});
  }, []);

  const runLive = useCallback(async () => {
    setLiveRunning(true);
    try {
      await fetch(`${API}/live/run`, { method: "POST" }); // blocks until the swarm finishes
    } catch {
      /* events still streamed over SSE; ignore fetch errors */
    } finally {
      setLiveRunning(false);
    }
  }, []);

  const fetchBenchmark = useCallback(async () => {
    const r = await fetch(`${API}/eval/run`, { method: "POST" });
    return r.json();
  }, []);

  const runNetblockProof = useCallback(async () => {
    const r = await fetch(`${API}/daytona/netblock-proof`, { method: "POST" });
    return r.json();
  }, []);

  return { state, connected, play, runLive, liveRunning, fetchBenchmark, runNetblockProof };
}
