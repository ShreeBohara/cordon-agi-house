const ITEMS = [
  ["healthy", "Healthy"],
  ["tainted", "Tainted"],
  ["compromised", "Breach"],
  ["quarantined", "Quarantined"],
  ["locked", "Locked"],
] as const;

export function Legend() {
  return (
    <div className="flex items-center gap-3.5">
      {ITEMS.map(([key, label]) => (
        <span key={key} className="flex items-center gap-1.5">
          <span
            className="size-2 rounded-full"
            style={{ background: `var(--color-${key})` }}
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
            {label}
          </span>
        </span>
      ))}
    </div>
  );
}
