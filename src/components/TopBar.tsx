import { formatAgo } from "../../shared/format";
import type { Tone } from "../../shared/insights";
import type { AccountState, AlertsView } from "../../shared/types";
import { useMessages } from "../locale";
import { About } from "./About";
import { Alerts } from "./Alerts";
import { LanguageSwitch } from "./LanguageSwitch";
import "./topbar.css";

interface Props {
  accounts: readonly AccountState[];
  /** How each account stands, by id. Missing for an account with no data yet. */
  tones: Readonly<Record<string, Tone>>;
  current: AccountState;
  onAccount: (account: AccountState) => void;
  nowMs: number;
  refreshing: boolean;
  onRefresh: () => void;
  alerts: AlertsView;
  onAlerts: (alerts: AlertsView) => void;
}

export function TopBar({ accounts, tones, current, onAccount, nowMs, refreshing, onRefresh, alerts, onAlerts }: Props) {
  const m = useMessages();
  const fetchedAt = current.snapshot ? Date.parse(current.snapshot.fetchedAt) : null;

  return (
    <header className="topbar">
      <p className="topbar-place">{m.title}</p>

      {accounts.length > 1 && (
        <div className="accounts" role="tablist" aria-label={m.topbar.accounts}>
          {accounts.map((account) => {
            const tone = tones[account.id];
            const word = tone ? m.topbar.accountTone[tone] : null;
            return (
              <button
                key={account.id}
                type="button"
                role="tab"
                aria-selected={account.id === current.id}
                onClick={() => onAccount(account)}
              >
                {account.name}
                {word && (
                  <>
                    <span className="account-mark" data-tone={tone} aria-hidden="true" />
                    <span className="visually-hidden">{word}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="topbar-fresh">
        <span aria-live="polite">
          {refreshing
            ? m.topbar.updating
            : fetchedAt === null
              ? m.topbar.noData
              : m.topbar.updated({ ago: formatAgo(nowMs - fetchedAt, m) })}
        </span>
        <button type="button" className="refresh" onClick={onRefresh} disabled={refreshing} data-busy={refreshing || undefined}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3h-3" />
          </svg>
          {m.topbar.refresh}
        </button>
      </div>

      <div className="topbar-more">
        <Alerts alerts={alerts} onSaved={onAlerts} />
        <About account={current} />
        <LanguageSwitch />
      </div>
    </header>
  );
}
