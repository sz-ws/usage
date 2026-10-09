import { useMemo } from "react";

import type { MetricDef } from "../../shared/catalog";
import type { Evaluation, Report } from "../../shared/forecast";
import {
  formatAmount,
  formatChange,
  formatDay,
  formatPercent,
  formatUsd,
} from "../../shared/format";
import { metricText, type Messages } from "../../shared/i18n";
import type { ResourceNames, Snapshot } from "../../shared/types";
import { breakdown, type Breakdown } from "../../shared/breakdown";
import { chartData } from "../lib/detail";
import { useMessages } from "../locale";
import { CycleChart } from "./CycleChart";
import { toneOf } from "./Meter";
import { figures, outlook } from "./MetricList";
import "./detail.css";

interface Props {
  evaluation: Evaluation;
  snapshot: Snapshot;
  report: Report;
  names: ResourceNames;
  /** Names the metric at the top. Left out when the detail opens right under the metric's own row. */
  heading?: boolean;
}

/** What the metric costs: from the first unit, or only past its allowance when it has one. */
function priceText(def: MetricDef, m: Messages): string {
  const usd = `$${def.price.usd}`;
  const per = formatAmount(def.price.per, "count");
  const extra = def.allowance > 0;
  switch (def.unit) {
    case "bytes":
      return m.detail.price.perGbMonth({ usd, extra });
    case "ms":
      return m.detail.price.per({ usd, units: `${per} ms`, extra });
    case "gbs":
      return m.detail.price.per({ usd, units: `${per} GB-s`, extra });
    case "count":
    case "neurons":
      return m.detail.price.per({ usd, units: per, extra });
  }
}

/** The 7 and 30 complete days a pace is measured over. See shared/forecast.ts. */
const SHORT_PACE_DAYS = 7;
const LONG_PACE_DAYS = 30;

/** Resources named one by one before the rest are summed. */
const BREAKDOWN_ROWS = 6;

interface Fact {
  label: string;
  value: string;
  note?: string;
  /** Whether the note sits beside the value instead of under it. */
  inline?: boolean;
}

function withShare(amount: number, evaluation: Evaluation): Pick<Fact, "value" | "note" | "inline"> {
  const { def } = evaluation;
  return {
    value: formatAmount(amount, def.unit),
    note: def.allowance > 0 ? formatPercent(amount / def.allowance) : undefined,
    inline: true,
  };
}

function facts(evaluation: Evaluation, m: Messages): Fact[] {
  const { def, used, rate7, rate30, projected7, projected30, previous, exhaustsOn, overageUsd } = evaluation;
  const words = m.detail.facts;
  const list: Fact[] = [];
  const amount = (value: number) => formatAmount(value, def.unit);

  if (def.mode === "cycle") {
    list.push({ label: words.soFar, ...withShare(used, evaluation) });
    list.push({ label: words.periodEndAtPace({ days: SHORT_PACE_DAYS }), ...withShare(projected7, evaluation) });
    list.push({ label: words.periodEndAtPace({ days: LONG_PACE_DAYS }), ...withShare(projected30, evaluation) });
    if (previous) {
      const change = formatChange(used, previous.samePoint, m);
      list.push({
        label: words.lastPeriodSamePoint,
        value: amount(previous.samePoint),
        note: change ? words.thisPeriod({ change }) : undefined,
      });
      list.push({ label: words.lastPeriodTotal, ...withShare(previous.total, evaluation) });
    }
    if (def.allowance > 0) {
      list.push({ label: words.runsOut, value: exhaustsOn ? formatDay(exhaustsOn, m) : words.notThisPeriod });
    }
  } else if (def.mode === "level") {
    const growth = Math.max(rate7, rate30);
    list.push({ label: words.storedNow, ...withShare(used, evaluation) });
    list.push({ label: words.periodAverage, ...withShare(evaluation.projected, evaluation) });
    list.push({
      label: words.perDay({ days: SHORT_PACE_DAYS }),
      value:
        rate7 === 0
          ? words.unchanged
          : rate7 > 0
            ? words.grew({ amount: amount(rate7) })
            : words.shrank({ amount: amount(Math.abs(rate7)) }),
    });
    if (evaluation.closing !== null) list.push({ label: words.storedAtEnd, value: amount(evaluation.closing) });
    if (previous) list.push({ label: words.endOfLastPeriod, value: amount(previous.total) });
    if (def.allowance > 0 && used < def.allowance) {
      list.push({
        label: words.storedPasses,
        value: exhaustsOn ? formatDay(exhaustsOn, m) : growth > 0 ? words.notWithinYear : words.notGrowing,
      });
    }
  } else {
    const record = evaluation.daily;
    list.push({ label: words.today, ...withShare(used, evaluation) });
    list.push({ label: words.dailyAverage({ days: SHORT_PACE_DAYS }), ...withShare(rate7, evaluation) });
    list.push({ label: words.dailyAverage({ days: LONG_PACE_DAYS }), ...withShare(rate30, evaluation) });
    if (record?.busiestDay) {
      list.push({
        label: words.busiestDay({ day: formatDay(record.busiestDay, m) }),
        ...withShare(record.busiest, evaluation),
      });
    }
    if (record && def.allowance > 0) {
      list.push({
        label: words.daysOver,
        value: record.daysOver > 0 ? words.dayCount({ count: record.daysOver }) : words.none,
      });
    }
  }

  list.push({
    label: def.allowance > 0 ? words.overage : words.costThisPeriod,
    value: formatUsd(overageUsd),
    note: priceText(def, m),
  });
  return list;
}

function Heading({ evaluation }: { evaluation: Evaluation }) {
  const m = useMessages();
  const word = m.status[evaluation.status];
  const { value, caption } = outlook(evaluation, m);

  return (
    <header className="detail-head">
      <h2>
        {metricText(evaluation.def.id, m).label}
        {word && (
          <span className="flag" data-tone={toneOf(evaluation.status)}>
            {word}
          </span>
        )}
      </h2>
      <p>
        <strong>{value}</strong> {caption}
        <span>{figures(evaluation, m)}</span>
      </p>
    </header>
  );
}

/** The days a resource's recent usage is compared across. See shared/breakdown.ts. */
const COMPARED_DAYS = 7;

function BreakdownTable({ data, evaluation }: { data: Breakdown; evaluation: Evaluation }) {
  const m = useMessages();
  const { def } = evaluation;
  if (data.rows.length === 0) return null;
  const words = m.detail.breakdown;
  const isLevel = def.mode === "level";
  const hasAside = data.rows.some((row) => row.aside !== null);

  return (
    <table className="breakdown">
      <thead>
        <tr>
          <th scope="col">{m.resources[def.resource]}</th>
          <th scope="col" className="num">{isLevel ? words.now : words.thisPeriod}</th>
          <th scope="col">{words.share}</th>
          <th scope="col" className="num">
            {isLevel
              ? words.againstDaysAgo({ days: COMPARED_DAYS })
              : words.againstDaysBefore({ days: COMPARED_DAYS })}
          </th>
          {hasAside && <th scope="col" className="num breakdown-aside" />}
        </tr>
      </thead>
      <tbody>
        {data.rows.map((row) => (
          <tr key={row.key}>
            <th scope="row">{row.name}</th>
            <td className="num">{formatAmount(row.amount, def.unit)}</td>
            <td>
              <span className="share">
                <span className="share-bar" style={{ transform: `scaleX(${Math.max(row.share, 0.004)})` }} />
              </span>
              <span className="share-figure">{formatPercent(row.share)}</span>
            </td>
            <td className="num">
              {formatChange(row.recent, row.before, m) ?? (row.recent > 0 ? words.appeared : "—")}
            </td>
            {hasAside && <td className="num breakdown-aside">{row.aside ?? ""}</td>}
          </tr>
        ))}
      </tbody>
      {data.rest && (
        <tfoot>
          <tr>
            <th scope="row">{data.rest.count === null ? words.other : words.more({ count: data.rest.count })}</th>
            <td className="num">{formatAmount(data.rest.amount, def.unit)}</td>
            <td colSpan={hasAside ? 3 : 2} />
          </tr>
        </tfoot>
      )}
    </table>
  );
}

export function MetricDetail({ evaluation, snapshot, report, names, heading = false }: Props) {
  const m = useMessages();
  const { def } = evaluation;
  const { note } = metricText(def.id, m);
  const series = snapshot.metrics[def.id];

  const chart = useMemo(
    () => chartData(evaluation, snapshot.days, series?.total ?? [], report),
    [evaluation, snapshot.days, series, report],
  );
  const who = useMemo(
    () => breakdown(evaluation, snapshot, report, names, BREAKDOWN_ROWS, m),
    [evaluation, snapshot, report, names, m],
  );

  return (
    <div className="detail">
      {heading && <Heading evaluation={evaluation} />}
      {note && <p className="detail-note">{note}</p>}

      <div className="detail-main">
        <CycleChart data={chart} unit={def.unit} metric={def.id} />
        <dl className="facts">
          {facts(evaluation, m).map((fact) => (
            <div key={fact.label} className="fact">
              <dt>{fact.label}</dt>
              <dd>
                {fact.value}
                {fact.note && (
                  <span className="fact-note" data-inline={fact.inline || undefined}>
                    {fact.note}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <BreakdownTable data={who} evaluation={evaluation} />

      <details className="daily">
        <summary>{m.detail.daily.summary}</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">{m.detail.daily.date}</th>
              <th scope="col" className="num">{def.mode === "level" ? m.detail.daily.stored : m.detail.daily.thatDay}</th>
              {chart.kind === "running" && <th scope="col" className="num">{m.detail.daily.running}</th>}
            </tr>
          </thead>
          <tbody>
            {chart.rows.map((row) => (
              <tr key={row.day}>
                <th scope="row">{formatDay(row.day, m)}</th>
                <td className="num">{formatAmount(row.value, def.unit)}</td>
                {chart.kind === "running" && <td className="num">{formatAmount(row.plotted, def.unit)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
