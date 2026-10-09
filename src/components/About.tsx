import { useRef } from "react";

import type { AccountState } from "../../shared/types";
import { useMessages } from "../locale";
import "./about.css";

interface Props {
  account: AccountState;
}

/**
 * What the numbers are, where else to read them, and the way out. Opened from
 * the top bar, like the alerts beside it: nobody needs it on screen while
 * reading usage.
 */
export function About({ account }: Props) {
  const m = useMessages();
  const dialog = useRef<HTMLDialogElement>(null);
  const warnings = account.snapshot?.warnings ?? [];

  return (
    <>
      <button type="button" className="alerts-open" onClick={() => dialog.current?.showModal()}>
        {m.about}
      </button>

      <dialog ref={dialog} className="alerts about" aria-labelledby="about-title">
        <div className="about-body">
          <h2 id="about-title">{m.about}</h2>

          <p>
            {m.footer.estimate} {m.footer.prices.before}
            <a href="https://developers.cloudflare.com/workers/platform/pricing/" rel="noreferrer">
              Workers
            </a>
            {m.footer.prices.between}
            <a href="https://developers.cloudflare.com/r2/pricing/" rel="noreferrer">
              R2
            </a>
            {m.footer.prices.after}
          </p>
          {warnings.length > 0 && (
            <ul>
              {warnings.map((warning, index) => (
                <li key={`${warning.kind}:${index}`}>{m.warning(warning)}</li>
              ))}
            </ul>
          )}
          <p>
            {m.footer.json.before}
            <a href={`/api/v1/usage?account=${encodeURIComponent(account.name)}`} target="_blank" rel="noreferrer">
              {account.name}
            </a>
            {m.footer.json.between}
            <a href="/api/v1/usage" target="_blank" rel="noreferrer">
              {m.footer.json.all}
            </a>
          </p>
          <p>
            {m.footer.agent.before}
            <code>{`${window.location.origin}/mcp`}</code>
            {m.footer.agent.after}
          </p>

          <div className="alerts-actions">
            <form method="post" action="/signout">
              <button type="submit">{m.footer.signOut}</button>
            </form>
            <button type="button" className="alerts-close" onClick={() => dialog.current?.close()}>
              {m.alerts.close}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
