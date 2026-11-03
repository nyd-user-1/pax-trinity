import "./ClassicSpinner.css";

/** Twelve spokes fading in turn: a product still waking (2026-10-07). 32px; scale it down where it sits small.
 *  Plain CSS since perf round 2 (2026-11-02), the motion version's loop unchanged: each spoke from full to a fifth,
 *  linear, over a second, on repeat, a twelfth of a second after the one before; full until its turn comes. */
export function ClassicSpinner({ className = "" }: { className?: string }) {
  return (
    <div className={`relative h-8 w-8 ${className}`} aria-hidden>
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="classic-spinner-spoke absolute top-0 left-[14px] h-[8px] w-[4px] origin-[2px_16px] rounded-full bg-zinc-400 dark:bg-zinc-200"
          style={{ transform: `rotate(${i * 30}deg)`, animationDelay: `${i / 12}s` }}
        />
      ))}
    </div>
  );
}
