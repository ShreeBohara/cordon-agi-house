import type { ReactNode } from "react";

export function Chip({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <code
      title={title}
      className="rounded border border-line bg-ink/60 px-1.5 py-0.5 font-mono text-[10.5px] text-muted"
    >
      {children}
    </code>
  );
}
