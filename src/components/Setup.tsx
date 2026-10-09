import { useState, type FormEvent } from "react";

import { MAX_RENEWAL_DAY, MIN_RENEWAL_DAY } from "../../shared/cycle";
import { useMessages } from "../locale";
import "./setup.css";

interface Props {
  /** The account being asked about, so the link opens its own subscriptions. */
  accountId: string;
  /** True while the chosen day is on its way to the server. */
  saving: boolean;
  onSave: (day: number) => void;
}

const RENEWAL_DAYS = Array.from(
  { length: MAX_RENEWAL_DAY - MIN_RENEWAL_DAY + 1 },
  (_, index) => MIN_RENEWAL_DAY + index,
);

/** Where the dashboard shows the date, as every language's sentence names it. It becomes the link. */
const DASHBOARD_PATH = "Manage Account → Billing → Subscriptions";

/**
 * Asked once per account, in place of its usage: without the day the bill
 * renews there is no billing period to hold the numbers against, and access
 * that only reads analytics cannot look it up.
 *
 * No day is chosen to begin with. A day already filled in is one a person
 * saves without looking, and every figure on the page would then be counted
 * from the wrong date.
 */
export function Setup({ accountId, saving, onSave }: Props) {
  const m = useMessages();
  const [day, setDay] = useState<number | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (day !== null) onSave(day);
  };

  const at = m.setup.lead.indexOf(DASHBOARD_PATH);
  const lead =
    at === -1 ? (
      m.setup.lead
    ) : (
      <>
        {m.setup.lead.slice(0, at)}
        <a href={`https://dash.cloudflare.com/${accountId}/billing/subscriptions`} target="_blank" rel="noreferrer">
          {DASHBOARD_PATH}
        </a>
        {m.setup.lead.slice(at + DASHBOARD_PATH.length)}
      </>
    );

  return (
    <section className="setup" aria-labelledby="setup-title">
      <h1 id="setup-title">{m.setup.title}</h1>
      <p className="setup-lead">{lead}</p>
      <form onSubmit={submit}>
        <div className="setup-days" role="radiogroup" aria-labelledby="setup-title">
          {RENEWAL_DAYS.map((option) => (
            <label key={option} className="setup-day">
              <input
                type="radio"
                name="renewal-day"
                value={option}
                checked={day === option}
                onChange={() => setDay(option)}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
        <button type="submit" disabled={saving || day === null}>
          {m.setup.save}
        </button>
      </form>
    </section>
  );
}
