"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";

// Rendered as a side-by-side COLUMN next to the graph (not an overlay), so it can
// never cover an agent node on any screen size. Collapses to a thin strip to give
// the graph back its width.
export function EmailCard({ email }: { email?: { content: string; agent: string } }) {
  const [dismissed, setDismissed] = useState(false);
  // default to the slim strip so the graph keeps full width (cards stay big);
  // the presenter expands it to reveal the injection during the demo.
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    setDismissed(false);
    setCollapsed(true);
  }, [email?.content]);

  if (!email || dismissed) return null;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        title="show email"
        className="flex w-9 shrink-0 flex-col items-center gap-2 rounded-lg border border-tainted/50 bg-[#161b22] py-3 text-tainted transition-colors hover:border-tainted"
      >
        <span className="text-[12px]">✉</span>
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] [writing-mode:vertical-rl]">email ▸</span>
      </button>
    );
  }

  return (
    <motion.div
      key={email.content}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 280, damping: 24 }}
      className="flex w-[300px] shrink-0 flex-col overflow-hidden rounded-lg border border-tainted/50 bg-[#161b22]"
    >
      <div className="flex shrink-0 items-center gap-2 px-3 py-2">
        <button
          onClick={() => setCollapsed(true)}
          title="collapse"
          className="font-mono text-[11px] text-faint transition-colors hover:text-text"
        >
          ◂
        </button>
        <span className="flex flex-1 items-center gap-2 truncate font-mono text-[10px] uppercase tracking-[0.14em] text-tainted">
          <span>✉</span> incoming email · {email.agent}
          <span className="rounded border border-tainted/50 px-1 py-px text-[8.5px]">untrusted</span>
        </span>
        <button
          onClick={() => setDismissed(true)}
          title="dismiss"
          className="font-mono text-faint transition-colors hover:text-text"
        >
          ✕
        </button>
      </div>

      <pre className="flex-1 overflow-auto whitespace-pre-wrap border-t border-line px-3 py-2.5 font-mono text-[10px] leading-[1.5] text-muted">
        {renderEmail(email.content)}
      </pre>
    </motion.div>
  );
}

/** Highlight the HTML-comment injection block inside the email body. */
function renderEmail(text: string) {
  const start = text.indexOf("<!--");
  const end = text.indexOf("-->");
  if (start === -1 || end === -1) return text;
  return (
    <>
      {text.slice(0, start)}
      <mark className="rounded bg-compromised/20 px-0.5 text-compromised">{text.slice(start, end + 3)}</mark>
      <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.16em] text-compromised">
        ↑ prompt injection
      </span>
      {text.slice(end + 3)}
    </>
  );
}
