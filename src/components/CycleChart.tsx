import { useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";

import type { MetricId, Unit } from "../../shared/catalog";
import { addDays } from "../../shared/dates";
import { formatAmount, formatDay, formatShortDay } from "../../shared/format";
import { useWidth } from "../hooks/useWidth";
import { useMessages } from "../locale";
import type { ChartData, Point } from "../lib/detail";
import { niceTicks } from "../lib/scale";
import "./chart.css";

const HEIGHT = 264;
const MARGIN = { top: 14, right: 16, bottom: 26, left: 52 };
/** The allowance is drawn only when usage is within sight of it; otherwise it would flatten the line. */
const LIMIT_IN_SIGHT = 2.5;
/** Room one date label on the x axis needs, in pixels. */
const DAY_LABEL_WIDTH = 52;

interface Props {
  data: ChartData;
  unit: Unit;
  /** The metric the chart is of, to name it for a reader who cannot see it. */
  metric: MetricId;
}

function path(points: readonly Point[], x: (value: number) => number, y: (value: number) => number): string {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${x(point.x).toFixed(1)} ${y(point.y).toFixed(1)}`)
    .join(" ");
}

/** The y of a line at `x`, read along the segment `x` falls on. Null outside the line. */
function valueAt(points: readonly Point[], x: number): number | null {
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    if (!point || point.x < x - 1e-6) continue;
    const before = points[index - 1];
    if (!before || point.x - before.x <= 0) return Math.abs(point.x - x) < 1e-6 ? point.y : null;
    return before.y + ((point.y - before.y) * (x - before.x)) / (point.x - before.x);
  }
  return null;
}

export function CycleChart({ data, unit, metric }: Props) {
  const m = useMessages();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

  const { ticks, top, showLimit } = useMemo(() => {
    const peak = Math.max(0, ...[...data.actual, ...data.projection, ...data.previous].map((point) => point.y));
    const limitVisible = data.limit !== null && data.limit <= peak * LIMIT_IN_SIGHT;
    const reach = Math.max(peak, limitVisible && data.limit !== null ? data.limit : 0) || 1;
    const axis = niceTicks(reach);
    return { ticks: axis, top: axis[axis.length - 1] ?? reach, showLimit: limitVisible };
  }, [data]);

  const x = (value: number) => MARGIN.left + (value / data.span) * plotWidth;
  const y = (value: number) => MARGIN.top + plotHeight - (value / top) * plotHeight;

  // Date labels every five days, or every ten when five days are too narrow to fit one.
  const dayStep = Math.max(1, Math.ceil(DAY_LABEL_WIDTH / Math.max(1, plotWidth / data.span) / 5)) * 5;
  const dayTicks = Array.from({ length: Math.floor(data.span / dayStep) + 1 }, (_, index) => index * dayStep);

  const lastRow = data.rows.length - 1;
  const hovered = hover === null ? null : data.rows[hover];
  const hoverPoint = hover === null ? null : data.actual[data.kind === "running" ? hover + 1 : hover];
  const earlier = hoverPoint ? valueAt(data.previous, hoverPoint.x) : null;

  const onMove = (event: PointerEvent<SVGRectElement>) => {
    if (lastRow < 0 || plotWidth <= 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const day = Math.floor(((event.clientX - bounds.left) / bounds.width) * data.span);
    setHover(Math.max(0, Math.min(lastRow, day)));
  };

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (lastRow < 0) return;
    if (event.key === "ArrowLeft") setHover((current) => Math.max(0, (current ?? lastRow + 1) - 1));
    else if (event.key === "ArrowRight") setHover((current) => Math.min(lastRow, (current ?? -1) + 1));
    else if (event.key === "Escape") setHover(null);
    else return;
    event.preventDefault();
  };

  const tooltipLeft = hoverPoint ? x(hoverPoint.x) : 0;
  const flip = tooltipLeft > width * 0.6;

  return (
    <figure className="chart">
      <figcaption className="chart-legend">
        <span className="chart-key chart-key-actual">{m.chart.thisPeriod}</span>
        {data.projection.length > 0 && <span className="chart-key chart-key-projection">{m.chart.projected}</span>}
        {data.previous.length > 0 && <span className="chart-key chart-key-previous">{m.chart.lastPeriod}</span>}
        {showLimit && <span className="chart-key chart-key-limit">{m.chart.allowance}</span>}
      </figcaption>

      <div
        className="chart-plot"
        ref={ref}
        tabIndex={0}
        role="group"
        aria-label={m.chart.keys({ metric })}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
      >
        {width > 0 && (
          <svg width={width} height={HEIGHT} aria-hidden="true">
            {ticks.map((tick) => (
              <g key={tick}>
                <line className="chart-grid" x1={MARGIN.left} x2={width - MARGIN.right} y1={y(tick)} y2={y(tick)} />
                <text className="chart-tick" x={MARGIN.left - 8} y={y(tick)} dy="0.32em" textAnchor="end">
                  {formatAmount(tick, unit)}
                </text>
              </g>
            ))}
            {dayTicks.map((day) => (
              <text
                key={day}
                className="chart-tick"
                x={x(day)}
                y={HEIGHT - 6}
                textAnchor={day === 0 ? "start" : day >= data.span ? "end" : "middle"}
              >
                {formatShortDay(addDays(data.start, day))}
              </text>
            ))}

            {showLimit && data.limit !== null && (
              <line className="chart-limit" x1={MARGIN.left} x2={width - MARGIN.right} y1={y(data.limit)} y2={y(data.limit)} />
            )}
            {data.previous.length > 1 && <path className="chart-line chart-line-previous" d={path(data.previous, x, y)} />}
            {data.projection.length > 1 && <path className="chart-line chart-line-projection" d={path(data.projection, x, y)} />}
            {data.actual.length > 1 && <path className="chart-line chart-line-actual" d={path(data.actual, x, y)} />}

            {hoverPoint && (
              <>
                <line className="chart-crosshair" x1={x(hoverPoint.x)} x2={x(hoverPoint.x)} y1={MARGIN.top} y2={MARGIN.top + plotHeight} />
                <circle className="chart-dot" cx={x(hoverPoint.x)} cy={y(hoverPoint.y)} r="4" />
              </>
            )}

            <rect
              className="chart-hit"
              x={MARGIN.left}
              y={MARGIN.top}
              width={plotWidth}
              height={plotHeight}
              onPointerMove={onMove}
              onPointerLeave={() => setHover(null)}
            />
          </svg>
        )}

        {hovered && hoverPoint && (
          <div className="chart-tip" data-flip={flip || undefined} style={{ left: tooltipLeft, top: y(hoverPoint.y) }}>
            <p className="chart-tip-day">{formatDay(hovered.day, m)}</p>
            <p className="chart-tip-row">
              <strong>{formatAmount(hovered.plotted, unit)}</strong>
              <span>{data.kind === "running" ? m.chart.running : m.chart.thisPeriod}</span>
            </p>
            {data.kind === "running" && (
              <p className="chart-tip-row">
                <strong>{formatAmount(hovered.value, unit)}</strong>
                <span>{m.chart.thatDay}</span>
              </p>
            )}
            {earlier !== null && (
              <p className="chart-tip-row">
                <strong>{formatAmount(earlier, unit)}</strong>
                <span>{m.chart.sameDayLastPeriod}</span>
              </p>
            )}
          </div>
        )}
      </div>
    </figure>
  );
}
