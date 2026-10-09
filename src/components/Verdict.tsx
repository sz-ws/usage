import type { CSSProperties } from "react";

import { MAX_RENEWAL_DAY, MIN_RENEWAL_DAY, type Cycle } from "../../shared/cycle";
import { DAY_MS, addDays, fromIso } from "../../shared/dates";
import { formatShortDay } from "../../shared/format";
import type { Headline } from "../../shared/insights";
import { useMessages } from "../locale";
import "./verdict.css";

interface Props {
  headline: Headline;
  cycle: Cycle;
  nowMs: number;
  renewalDay: number;
  onRenewalDay: (day: number) => void;
}

const RENEWAL_DAYS = Array.from(
  { length: MAX_RENEWAL_DAY - MIN_RENEWAL_DAY + 1 },
  (_, index) => MIN_RENEWAL_DAY + index,
);

/** One mark per day of the billing period: the days behind, today, and the days left. */
function CycleTimeline({ cycle, nowMs }: { cycle: Cycle; nowMs: number }) {
  const m = useMessages();
  const today = Math.min(cycle.days - 1, Math.max(0, Math.floor((nowMs - fromIso(cycle.start)) / DAY_MS)));

  return (
    <div className="timeline" style={{ "--days": cycle.days } as CSSProperties}>
      <div className="timeline-days" aria-hidden="true">
        {Array.from({ length: cycle.days }, (_, index) => (
          <span key={index} data-state={index < today ? "past" : index === today ? "today" : "ahead"} />
        ))}
      </div>
      <p>
        {m.verdict.timeline({
          start: formatShortDay(cycle.start, m),
          end: formatShortDay(addDays(cycle.end, -1), m),
          day: today + 1,
          days: cycle.days,
        })}
      </p>
    </div>
  );
}

/** The answer in one line, with where the billing period stands beside it. */
export function Verdict({ headline, cycle, nowMs, renewalDay, onRenewalDay }: Props) {
  const m = useMessages();

  return (
    <section className="verdict" data-tone={headline.tone} aria-labelledby="verdict-title">
      <div className="verdict-text">
        <h1 id="verdict-title">{headline.title}</h1>
        <p>{headline.detail}</p>
      </div>

      <CycleTimeline cycle={cycle} nowMs={nowMs} />

      <label className="renewal">
        {m.verdict.renewal.before}
        <span className="renewal-select">
          <select value={renewalDay} onChange={(event) => onRenewalDay(Number(event.target.value))}>
            {RENEWAL_DAYS.map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
        </span>
        {m.verdict.renewal.after}
      </label>
    </section>
  );
}
