import { useState, type FormEvent } from "react";

import { MAX_RENEWAL_DAY, MIN_RENEWAL_DAY } from "../../shared/cycle";
import { useMessages } from "../locale";
import "./setup.css";
import "./verdict.css";

interface Props {
  /** True while the chosen day is on its way to the server. */
  saving: boolean;
  onSave: (day: number) => void;
}

const RENEWAL_DAYS = Array.from(
  { length: MAX_RENEWAL_DAY - MIN_RENEWAL_DAY + 1 },
  (_, index) => MIN_RENEWAL_DAY + index,
);

/**
 * Asked once per account, in place of its usage: without the day the bill
 * renews there is no billing period to hold the numbers against, and a token
 * that only reads analytics cannot look it up.
 */
export function Setup({ saving, onSave }: Props) {
  const m = useMessages();
  const [day, setDay] = useState(MIN_RENEWAL_DAY);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave(day);
  };

  return (
    <section className="setup" aria-labelledby="setup-title">
      <h1 id="setup-title">{m.setup.title}</h1>
      <p>{m.setup.lead}</p>
      <form onSubmit={submit}>
        <label className="renewal">
          {m.verdict.renewal.before}
          <span className="renewal-select">
            <select value={day} onChange={(event) => setDay(Number(event.target.value))}>
              {RENEWAL_DAYS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </span>
          {m.verdict.renewal.after}
        </label>
        <button type="submit" disabled={saving}>
          {m.setup.save}
        </button>
      </form>
    </section>
  );
}
