import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { MetricId } from "../shared/catalog";
import { isRenewalDay } from "../shared/cycle";
import { byUrgency, evaluateSnapshot, isMinor } from "../shared/forecast";
import { errorText, isErrorCode, type Messages } from "../shared/i18n";
import { findings, headline, overallTone, type Tone } from "../shared/insights";
import type { AccountState, AlertsView, AppState, Snapshot } from "../shared/types";
import { ApiError, loadState, refreshAccount, saveRenewalDay } from "./api";
import { Findings } from "./components/Findings";
import { MetricDetail } from "./components/MetricDetail";
import { MetricList } from "./components/MetricList";
import { Setup } from "./components/Setup";
import { TopBar } from "./components/TopBar";
import { Verdict } from "./components/Verdict";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { useNow } from "./hooks/useNow";
import { useQueryParam } from "./hooks/useQueryParam";
import { useMessages } from "./locale";

/** From this width up there is room for the list and one metric's detail side by side. */
const WIDE = "(min-width: 60rem)";

/** Numbers older than this are re-read as soon as the page opens. */
const STALE_AFTER_MS = 30 * 60_000;

type Load =
  | { phase: "loading" }
  | { phase: "failed"; error: unknown }
  | { phase: "ready"; state: AppState };

/** Kept as a function of the dictionary, so a notice on screen follows a change of language. */
interface Notice {
  text: (m: Messages) => string;
  retry?: () => void;
}

/** What went wrong, when the server said. Null when all that is known is that the call failed. */
function explain(error: unknown, m: Messages): string | null {
  if (!(error instanceof ApiError)) return null;
  if (error.code === "unknown" || !isErrorCode(error.code, m)) return null;
  return errorText(error.code, m, error.detail);
}

/** Why a refresh failed: the server's reason, or that the server never answered. */
function refreshFailure(error: unknown, m: Messages): string {
  const reason = error instanceof ApiError ? explain(error, m) : m.app.unreachable;
  return m.app.refreshFailed({ reason });
}

function withAccount(state: AppState, accountId: string, change: Partial<AccountState>): AppState {
  return {
    ...state,
    accounts: state.accounts.map((account) => (account.id === accountId ? { ...account, ...change } : account)),
  };
}

export function App() {
  const m = useMessages();
  const [load, setLoad] = useState<Load>({ phase: "loading" });
  const [accountParam, setAccountParam] = useQueryParam("account");
  const [open, setOpen] = useQueryParam("open");
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const now = useNow(60_000);

  useEffect(() => {
    loadState()
      .then((state) => setLoad({ phase: "ready", state }))
      .catch((error: unknown) => setLoad({ phase: "failed", error }));
  }, []);

  const accounts = load.phase === "ready" ? load.state.accounts : [];
  const account = accounts.find((entry) => entry.name === accountParam) ?? accounts[0] ?? null;

  const tones = useMemo(() => {
    const byAccount: Record<string, Tone> = {};
    for (const entry of accounts) {
      if (entry.snapshot && entry.renewalDay !== null) {
        byAccount[entry.id] = overallTone(evaluateSnapshot(entry.snapshot, entry.renewalDay).evaluations);
      }
    }
    return byAccount;
  }, [accounts]);

  const update = useCallback((accountId: string, change: Partial<AccountState>) => {
    setLoad((current) =>
      current.phase === "ready" ? { phase: "ready", state: withAccount(current.state, accountId, change) } : current,
    );
  }, []);

  const refresh = useCallback(
    async (accountId: string) => {
      setRefreshing(accountId);
      setNotice(null);
      try {
        const { snapshot, names } = await refreshAccount(accountId);
        update(accountId, { snapshot, names });
      } catch (error) {
        setNotice({
          text: (words) => refreshFailure(error, words),
          retry: () => void refresh(accountId),
        });
      } finally {
        setRefreshing(null);
      }
    },
    [update],
  );

  // Stale numbers are re-read when the page opens and again as it stays open,
  // so a tab left up overnight does not keep showing yesterday's period. One
  // attempt per account per interval, and none while the tab is in the background.
  const lastAttempt = useRef(new Map<string, number>());
  useEffect(() => {
    if (!account || refreshing !== null || document.visibilityState !== "visible") return;
    const age = account.snapshot ? now - Date.parse(account.snapshot.fetchedAt) : Infinity;
    const sinceAttempt = now - (lastAttempt.current.get(account.id) ?? 0);
    if (age > STALE_AFTER_MS && sinceAttempt > STALE_AFTER_MS) {
      lastAttempt.current.set(account.id, now);
      void refresh(account.id);
    }
  }, [account, refresh, refreshing, now]);

  const [saving, setSaving] = useState<string | null>(null);
  const changeRenewalDay = useCallback(
    async (target: AccountState, day: number) => {
      if (!isRenewalDay(day) || day === target.renewalDay) return;
      const before = target.renewalDay;
      update(target.id, { renewalDay: day });
      setNotice(null);
      setSaving(target.id);
      try {
        await saveRenewalDay(target.id, day);
      } catch {
        update(target.id, { renewalDay: before });
        setNotice({ text: (words) => words.app.renewalNotSaved({ day: before }) });
      } finally {
        setSaving(null);
      }
    },
    [update],
  );

  const select = useCallback((id: MetricId | null) => setOpen(id), [setOpen]);

  const setAlerts = useCallback((alerts: AlertsView) => {
    setLoad((current) => (current.phase === "ready" ? { phase: "ready", state: { ...current.state, alerts } } : current));
  }, []);

  if (load.phase === "loading") return <p className="status">{m.app.loading}</p>;
  if (load.phase === "failed") {
    return (
      <p className="status" role="alert">
        {explain(load.error, m) ?? m.app.loadFailed}
      </p>
    );
  }

  const problems = load.state.problems.map((problem) => (
    <p key={problem.token} className="notice" role="alert">
      {m.tokenProblem(problem)}
    </p>
  ));
  if (load.state.reconnect) {
    problems.unshift(
      <p key="reconnect" className="notice" role="alert">
        {m.errors.reconnect} <a href="/signin?again=1">{m.reconnect}</a>
      </p>,
    );
  }

  if (!account) {
    return (
      <div className="page">
        {problems.length > 0 ? <div className="page-top">{problems}</div> : <p className="status">{m.app.noAccounts}</p>}
        <SignOut />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-top">
        <TopBar
          accounts={accounts}
          tones={tones}
          current={account}
          onAccount={(next) => {
            setAccountParam(next.id === accounts[0]?.id ? null : next.name);
            setOpen(null);
          }}
          nowMs={now}
          refreshing={refreshing === account.id}
          onRefresh={() => void refresh(account.id)}
          alerts={load.state.alerts}
          onAlerts={setAlerts}
        />
        {problems}
        {notice && (
          <p className="notice" role="alert">
            {notice.text(m)}
            {notice.retry && (
              <button type="button" onClick={notice.retry}>
                {m.app.retry}
              </button>
            )}
          </p>
        )}
      </div>

      {account.renewalDay === null ? (
        <main className="page-body">
          <Setup
            key={account.id}
            accountId={account.id}
            saving={saving === account.id}
            onSave={(day) => void changeRenewalDay(account, day)}
          />
        </main>
      ) : account.snapshot ? (
        <Account
          key={account.id}
          account={account}
          renewalDay={account.renewalDay}
          snapshot={account.snapshot}
          now={now}
          stale={refreshing === account.id}
          open={open}
          onSelect={select}
          onRenewalDay={(day) => void changeRenewalDay(account, day)}
        />
      ) : (
        <p className="status">{refreshing ? m.app.firstRead : m.app.noData}</p>
      )}
    </div>
  );
}

/** Ends the session on this browser. A plain form, so it works whatever state the page is in. */
function SignOut() {
  const m = useMessages();
  return (
    <form className="sign-out" method="post" action="/signout">
      <button type="submit">{m.footer.signOut}</button>
    </form>
  );
}

interface AccountProps {
  account: AccountState;
  renewalDay: number;
  snapshot: Snapshot;
  now: number;
  stale: boolean;
  open: string | null;
  onSelect: (id: MetricId | null) => void;
  onRenewalDay: (day: number) => void;
}

function Account({ account, renewalDay, snapshot, now, stale, open, onSelect, onRenewalDay }: AccountProps) {
  const m = useMessages();
  const wide = useMediaQuery(WIDE);

  const report = useMemo(() => evaluateSnapshot(snapshot, renewalDay), [snapshot, renewalDay]);
  const verdict = useMemo(() => headline(report, now, m), [report, now, m]);
  const found = useMemo(() => findings(snapshot, report, account.names, m), [snapshot, report, account.names, m]);
  const active = useMemo(() => report.evaluations.filter((entry) => entry.active), [report]);
  const unused = useMemo(() => report.evaluations.filter((entry) => !entry.active), [report]);
  const notable = useMemo(() => byUrgency(active.filter((entry) => !isMinor(entry))), [active]);
  const minor = useMemo(() => active.filter(isMinor), [active]);

  // With room for it, a detail is always showing: the metric that was picked, or the most pressing one.
  const picked = active.find((entry) => entry.def.id === open) ?? null;
  const shown = picked ?? (wide ? (notable[0] ?? null) : null);

  const detailOf = (evaluation: (typeof active)[number], heading: boolean) => (
    <MetricDetail
      key={evaluation.def.id}
      evaluation={evaluation}
      snapshot={snapshot}
      report={report}
      names={account.names}
      heading={heading}
    />
  );

  const reveal = (id: MetricId) => {
    onSelect(id);
    if (wide) return;
    // On a narrow screen the detail opens under its row, which may be off screen.
    requestAnimationFrame(() => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.getElementById(`metric-${id}`)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    });
  };

  const verdictPart = (
    <Verdict headline={verdict} cycle={report.cycle} nowMs={now} renewalDay={renewalDay} onRenewalDay={onRenewalDay} />
  );
  const findingsPart = <Findings findings={found} onOpen={reveal} />;
  const listPart = (
    <MetricList
      notable={notable}
      minor={minor}
      unused={unused}
      report={report}
      days={snapshot.days.length}
      selected={shown?.def.id ?? null}
      dense={wide}
      onSelect={(id) => onSelect(!wide && id === open ? null : id)}
      inlineDetail={wide ? undefined : (evaluation) => <div className="inline-detail">{detailOf(evaluation, false)}</div>}
    />
  );
  // With the width for it, everything stays on one screen: the answer and every
  // metric down the left, the selected one's detail on the right. Each side
  // scrolls on its own when it has more than fits; the page does not. What the
  // numbers are and the way out are behind "About" in the top bar.
  if (wide) {
    return (
      <main className="page-body desk" data-stale={stale || undefined}>
        <div className="desk-side">
          {verdictPart}
          <div className="desk-scroll">{listPart}</div>
        </div>
        <div className="desk-stage">
          {findingsPart}
          {shown && (
            <aside className="pane" aria-label={m.detail.pane({ metric: shown.def.id })}>
              {detailOf(shown, true)}
            </aside>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="page-body" data-stale={stale || undefined}>
      {verdictPart}
      {findingsPart}
      <div className="board">{listPart}</div>
    </main>
  );
}
