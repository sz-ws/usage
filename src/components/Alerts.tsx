import { useRef, useState, type FormEvent } from "react";

import type { AlertEvents, AlertsView } from "../../shared/types";
import { ApiError, saveAlerts, testAlerts, type Delivery } from "../api";
import { useLocale, useMessages } from "../locale";
import "./alerts.css";

interface Props {
  alerts: AlertsView;
  onSaved: (alerts: AlertsView) => void;
}

const EVENTS = ["willExceed", "exceeded", "watch", "token"] as const satisfies readonly (keyof AlertEvents)[];

interface Note {
  lines: string[];
  bad: boolean;
}

/**
 * Where to be told, and about what. Opened from the top bar; everything here
 * is set once and then left alone, so it stays out of the page until asked for.
 */
export function Alerts({ alerts, onSaved }: Props) {
  const m = useMessages();
  const [locale] = useLocale();
  const dialog = useRef<HTMLDialogElement>(null);

  const [events, setEvents] = useState(alerts.events);
  const [ntfyUrl, setNtfyUrl] = useState(alerts.ntfy.url ?? "");
  const [ntfyToken, setNtfyToken] = useState("");
  const [webhookUrl, setWebhookUrl] = useState(alerts.webhook.url ?? "");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note | null>(null);

  /** Saves what is on the form. A credential left empty keeps the one already stored. */
  const persist = async (): Promise<boolean> => {
    try {
      const saved = await saveAlerts({
        events,
        ntfyUrl: ntfyUrl.trim() || null,
        ntfyToken: ntfyToken === "" ? undefined : ntfyToken,
        webhookUrl: webhookUrl.trim() || null,
        webhookSecret: webhookSecret === "" ? undefined : webhookSecret,
        locale,
      });
      onSaved(saved.alerts);
      setNtfyToken("");
      setWebhookSecret("");
      return true;
    } catch (error) {
      const code = error instanceof ApiError ? error.code : "";
      const channel = code === "invalid-ntfy-address" ? "ntfy" : code === "invalid-webhook-address" ? "Webhook" : null;
      setNote({ lines: [channel ? m.alerts.invalidAddress({ channel }) : m.alerts.notSaved], bad: true });
      return false;
    }
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setNote(null);
    if (await persist()) setNote({ lines: [m.alerts.saved], bad: false });
    setBusy(false);
  };

  /** A test goes to what is on the form, so it is saved first. */
  const test = async () => {
    setBusy(true);
    setNote(null);
    if (await persist()) {
      try {
        const result = await testAlerts();
        const say = (channel: string, delivery: Delivery | null) =>
          delivery === null
            ? []
            : [delivery.ok ? m.alerts.delivered({ channel }) : m.alerts.failed({ channel, status: delivery.status })];
        const lines = [...say("ntfy", result.ntfy), ...say("Webhook", result.webhook)];
        const failed = [result.ntfy, result.webhook].some((delivery) => delivery !== null && !delivery.ok);
        setNote({ lines, bad: failed });
      } catch (error) {
        const none = error instanceof ApiError && error.code === "no-channel";
        setNote({ lines: [none ? m.alerts.noChannel : m.alerts.notSaved], bad: true });
      }
    }
    setBusy(false);
  };

  return (
    <>
      <button type="button" className="alerts-open" onClick={() => dialog.current?.showModal()}>
        {m.alerts.title}
      </button>

      <dialog ref={dialog} className="alerts" aria-labelledby="alerts-title" onClose={() => setNote(null)}>
        <form onSubmit={(event) => void save(event)}>
          <h2 id="alerts-title">{m.alerts.title}</h2>
          <p className="alerts-lead">{m.alerts.lead}</p>

          <fieldset>
            <legend>{m.alerts.when}</legend>
            {EVENTS.map((key) => (
              <label key={key} className="alerts-check">
                <input
                  type="checkbox"
                  checked={events[key]}
                  onChange={(event) => setEvents({ ...events, [key]: event.target.checked })}
                />
                {m.alerts.events[key]}
              </label>
            ))}
          </fieldset>

          <label className="alerts-field">
            <span>{m.alerts.ntfy.url}</span>
            <input
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://ntfy.sh/…"
              value={ntfyUrl}
              onChange={(event) => setNtfyUrl(event.target.value)}
            />
            <small>{m.alerts.ntfy.hint}</small>
          </label>
          <label className="alerts-field">
            <span>
              {m.alerts.ntfy.token} <em>{m.alerts.optional}</em>
            </span>
            <input
              type="password"
              autoComplete="off"
              placeholder={alerts.ntfy.hasToken ? m.alerts.kept : ""}
              value={ntfyToken}
              onChange={(event) => setNtfyToken(event.target.value)}
            />
          </label>

          <label className="alerts-field">
            <span>{m.alerts.webhook.url}</span>
            <input
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://…"
              value={webhookUrl}
              onChange={(event) => setWebhookUrl(event.target.value)}
            />
            <small>{m.alerts.webhook.hint}</small>
          </label>
          <label className="alerts-field">
            <span>
              {m.alerts.webhook.secret} <em>{m.alerts.optional}</em>
            </span>
            <input
              type="password"
              autoComplete="off"
              placeholder={alerts.webhook.hasSecret ? m.alerts.kept : ""}
              value={webhookSecret}
              onChange={(event) => setWebhookSecret(event.target.value)}
            />
          </label>

          <div className="alerts-note" role="status" data-bad={note?.bad || undefined}>
            {note?.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>

          <div className="alerts-actions">
            <button type="submit" className="alerts-primary" disabled={busy}>
              {m.alerts.save}
            </button>
            <button type="button" onClick={() => void test()} disabled={busy}>
              {m.alerts.test}
            </button>
            <button type="button" className="alerts-close" onClick={() => dialog.current?.close()}>
              {m.alerts.close}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
