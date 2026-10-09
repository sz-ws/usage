import type { CSSProperties } from "react";

import type { Evaluation, Status } from "../../shared/forecast";
import { formatPercent } from "../../shared/format";
import { useMessages } from "../locale";
import "./meter.css";

type Tone = "ok" | "watch" | "over";

export function toneOf(status: Status): Tone {
  if (status === "exceeded" || status === "will-exceed") return "over";
  return status === "watch" ? "watch" : "ok";
}

interface Props {
  evaluation: Evaluation;
  /** How much of the billing period has passed, 0 to 1. */
  elapsed: number;
}

/**
 * Used so far (solid), where it is heading (lighter), and, for usage that adds
 * up over the period, a tick at "today": a bar that ends left of the tick is
 * running under an even pace.
 */
export function Meter({ evaluation, elapsed }: Props) {
  const m = useMessages();
  const { def, ratio, projectedRatio, status } = evaluation;
  if (def.allowance <= 0) return <span className="meter meter-none" aria-hidden="true" />;

  const used = Math.min(1, ratio);
  const ahead = Math.min(1, Math.max(ratio, projectedRatio));
  const style = { "--used": used, "--ahead": ahead, "--pace": elapsed } as CSSProperties;

  return (
    <span
      className="meter"
      data-tone={toneOf(status)}
      style={style}
      role="img"
      aria-label={m.meter[def.mode]({ used: formatPercent(ratio), projected: formatPercent(projectedRatio) })}
    >
      <span className="meter-ahead" />
      <span className="meter-used" data-empty={ratio <= 0 || undefined} />
      {def.mode === "cycle" && <span className="meter-pace" />}
    </span>
  );
}
