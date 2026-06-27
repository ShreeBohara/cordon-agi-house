import type { ReactNode } from "react";

export function Panel({
  title,
  right,
  children,
  className = "",
  bodyClassName = "",
}: {
  title?: string;
  right?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`flex min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-panel/80 ${className}`}
    >
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-2.5">
          <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
            {title}
          </h2>
          {right}
        </header>
      )}
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

export function Empty({ label }: { label: string }) {
  return (
    <div className="grid h-full place-items-center p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
        {label}
      </p>
    </div>
  );
}
