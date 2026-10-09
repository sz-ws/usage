import { useState, type CSSProperties, type ReactNode } from "react";

import type { MetricId, Product } from "../../shared/catalog";
import { DAY_MS, fromIso } from "../../shared/dates";
import type { Evaluation, Report } from "../../shared/forecast";
import { formatAmount, formatPercent, formatUsd } from "../../shared/format";
import { metricText, type Messages } from "../../shared/i18n";
import { useMessages } from "../locale";
import { Meter, toneOf } from "./Meter";
import "./metric-list.css";

interface Props {
  /** Metrics worth a row of their own, most pressing first. */
  notable: readonly Evaluation[];
  /** Metrics far from their allowance, in catalog order. Listed compactly, and only on request. */
  minor: readonly Evaluation[];
  unused: readonly Evaluation[];
  report: Report;
  days: number;
  selected: string | null;
  /** One line per metric, for the layout that keeps everything on one screen. */
  dense?: boolean;
  onSelect: (id: MetricId) => void;
  /**
   * On a narrow screen the detail of the selected metric opens under its row;
   * on a wide one it has its own column and this is left out.
   */
  inlineDetail?: (evaluation: Evaluation) => ReactNode;
}

/** Used against included, written once per row. */
export function figures(evaluation: Evaluation, m: Messages): string {
  const { def, used } = evaluation;
  const amount = formatAmount(used, def.unit);
  if (def.allowance <= 0) return amount;
  const numbers = { used: amount, allowance: formatAmount(def.allowance, def.unit) };
  return def.mode === "daily" ? m.metricList.figuresDaily(numbers) : m.metricList.figures(numbers);
}

/** The share the bill turns on, and what kind of share it is. */
export function outlook(evaluation: Evaluation, m: Messages): { value: string; caption: string } {
  const { def } = evaluation;
  if (def.allowance <= 0) return { value: formatUsd(evaluation.overageUsd), caption: m.metricList.cost };
  // A daily allowance starts again each day, so its share is today's.
  const share = def.mode === "daily" ? evaluation.ratio : evaluation.projectedRatio;
  return { value: formatPercent(share), caption: m.outlook[def.mode] };
}

function byProduct(evaluations: readonly Evaluation[]): [Product, Evaluation[]][] {
  const groups = new Map<Product, Evaluation[]>();
  for (const evaluation of evaluations) {
    const group = groups.get(evaluation.def.product) ?? [];
    groups.set(evaluation.def.product, [...group, evaluation]);
  }
  return [...groups.entries()];
}

/** How much room a row takes: two lines, one line under its product's name, or one line on its own. */
type RowSize = "roomy" | "compact" | "dense";

interface RowProps {
  evaluation: Evaluation;
  size: RowSize;
  index: number;
  elapsed: number;
  isSelected: boolean;
  onSelect: (id: MetricId) => void;
  inlineDetail?: (evaluation: Evaluation) => ReactNode;
}

function Row({ evaluation, size, index, elapsed, isSelected, onSelect, inlineDetail }: RowProps) {
  const roomy = size === "roomy";
  const m = useMessages();
  const { def } = evaluation;
  const text = metricText(def.id, m);
  const word = m.status[evaluation.status];
  const amounts = figures(evaluation, m);
  const { value, caption } = outlook(evaluation, m);

  return (
    <li data-selected={isSelected || undefined} style={{ "--row-index": index } as CSSProperties}>
      <button
        type="button"
        className="metric"
        data-roomy={roomy || undefined}
        data-dense={size === "dense" || undefined}
        id={`metric-${def.id}`}
        aria-label={m.metricList.row({ metric: def.id, figures: amounts, caption, value })}
        {...(inlineDetail
          ? { "aria-expanded": isSelected, "aria-controls": `detail-${def.id}` }
          : { "aria-pressed": isSelected })}
        onClick={() => onSelect(def.id)}
      >
        <span className="metric-name">
          {size === "compact" ? text.short : text.label}
          {word && (
            <span className="flag" data-tone={toneOf(evaluation.status)}>
              {word}
            </span>
          )}
        </span>
        <Meter evaluation={evaluation} elapsed={elapsed} />
        <span className="metric-figures">{amounts}</span>
        <span className="metric-outlook" title={roomy ? undefined : caption}>
          {roomy && <span>{caption}</span>}
          <strong>{value}</strong>
        </span>
      </button>
      {inlineDetail && isSelected && <div id={`detail-${def.id}`}>{inlineDetail(evaluation)}</div>}
    </li>
  );
}

/**
 * The metrics that matter get a roomy row each, most pressing first. The rest,
 * all under 1% of their allowance, wait behind one line and open as a compact
 * list grouped the way Cloudflare sells them.
 */
export function MetricList({ notable, minor, unused, report, days, selected, dense, onSelect, inlineDetail }: Props) {
  const m = useMessages();
  const [minorShown, setMinorShown] = useState(false);
  // A link that selects one of the small ones has to be able to show it.
  const showMinor = minorShown || minor.some((evaluation) => evaluation.def.id === selected);

  const elapsed = Math.min(
    1,
    Math.max(0, (report.asOfMs - fromIso(report.cycle.start)) / (report.cycle.days * DAY_MS)),
  );
  const row = (evaluation: Evaluation, index: number, size: RowSize) => (
    <Row
      key={evaluation.def.id}
      evaluation={evaluation}
      size={size}
      index={index}
      elapsed={elapsed}
      isSelected={selected === evaluation.def.id}
      onSelect={onSelect}
      inlineDetail={inlineDetail}
    />
  );

  return (
    <section className="metrics" aria-labelledby="metrics-heading">
      <h2 id="metrics-heading">{m.metricList.heading}</h2>

      {notable.length > 0 && <ul className="metric-rows">{notable.map((evaluation, index) => row(evaluation, index, dense ? "dense" : "roomy"))}</ul>}

      {minor.length > 0 && (
        <>
          <button
            type="button"
            className="metrics-more"
            aria-expanded={showMinor}
            aria-controls="metrics-minor"
            onClick={() => setMinorShown(!showMinor)}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M6 3.5 10.5 8 6 12.5" />
            </svg>
            {m.metricList.more({ count: minor.length, others: notable.length > 0 })}
          </button>

          {showMinor && (
            <div id="metrics-minor" className="metric-groups">
              {byProduct(minor).map(([product, evaluations]) => (
                <div key={product} className="metric-group">
                  <h3>{m.products[product]}</h3>
                  <ul className="metric-rows">{evaluations.map((evaluation, index) => row(evaluation, index, "compact"))}</ul>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {unused.length > 0 && (
        <p className="metrics-unused">
          {m.metricList.unused({ days, metrics: unused.map((evaluation) => evaluation.def.id) })}
        </p>
      )}
    </section>
  );
}
