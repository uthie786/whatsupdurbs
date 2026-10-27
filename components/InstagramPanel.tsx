"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, Instagram, Loader2, Pause, Play, Plus, RefreshCw, Stethoscope, Trash2, XCircle } from "lucide-react";
import { errorMessage } from "@/lib/errors";

interface AccountRow {
  username: string;
  active: boolean;
  last_checked_at: string | null;
  last_error: string | null;
  checked: number;
  events: number;
}

interface Check {
  step: string;
  ok: boolean;
  detail: string;
}

function ago(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 48 ? `${hours}h ago` : `${Math.round(hours / 24)} days ago`;
}

/** Admin tools for following Instagram accounts and pulling event posts into Pending. */
export default function InstagramPanel({
  getToken,
  onSynced,
}: {
  getToken: () => Promise<string>;
  onSynced: () => void;
}) {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [newNames, setNewNames] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [testName, setTestName] = useState("");
  // The parent recreates getToken each render; keep the latest without re-running effects.
  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;

  const api = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const res = await fetch(path, {
        ...init,
        headers: { ...(init.headers ?? {}), Authorization: `Bearer ${await tokenRef.current()}`, "Content-Type": "application/json" },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.ok === false) throw new Error(body.error || `Request failed (${res.status})`);
      return body;
    },
    [],
  );

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const body = await api("/api/instagram/accounts");
      setAccounts(body.accounts ?? []);
      setConfigured(Boolean(body.configured));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const addAccounts = (e: FormEvent) => {
    e.preventDefault();
    if (!newNames.trim()) return;
    void run("add", async () => {
      const body = await api("/api/instagram/accounts", { method: "POST", body: JSON.stringify({ usernames: newNames }) });
      setStatus(`Following ${body.added.map((u: string) => `@${u}`).join(", ")}.`);
      setNewNames("");
      await loadAccounts();
    });
  };

  const toggle = (a: AccountRow) =>
    run(a.username, async () => {
      await api("/api/instagram/accounts", { method: "PATCH", body: JSON.stringify({ username: a.username, active: !a.active }) });
      await loadAccounts();
    });

  const remove = (a: AccountRow) => {
    if (!window.confirm(`Stop following @${a.username}? Events already added stay on the site.`)) return;
    void run(a.username, async () => {
      await api(`/api/instagram/accounts?username=${encodeURIComponent(a.username)}`, { method: "DELETE" });
      await loadAccounts();
    });
  };

  const test = () =>
    run("test", async () => {
      const name = testName.trim() || accounts[0]?.username || "";
      const res = await fetch(`/api/instagram/test${name ? `?username=${encodeURIComponent(name)}` : ""}`, {
        headers: { Authorization: `Bearer ${await tokenRef.current()}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok && !body.checks) throw new Error(body.error || `Test failed (${res.status})`);
      setChecks(body.checks ?? []);
    });

  const syncNow = () =>
    run("sync", async () => {
      setStatus("Checking Instagram… this can take up to a minute.");
      const r = await api("/api/sync/instagram");
      const parts = [
        `${r.accountsChecked} account${r.accountsChecked === 1 ? "" : "s"} checked`,
        `${r.postsChecked} new post${r.postsChecked === 1 ? "" : "s"} read`,
        `${r.eventsAdded} event${r.eventsAdded === 1 ? "" : "s"} added to Pending`,
      ];
      if (r.outcomes?.["not-event"]) parts.push(`${r.outcomes["not-event"]} not events`);
      if (r.incomplete) parts.push("more left for the next run");
      setStatus(parts.join(" · ") + (r.accountErrors?.length ? ` · ${r.accountErrors.length} problem(s), see below` : ""));
      if (r.accountErrors?.length) {
        setError(r.accountErrors.map((e: { username: string; error: string }) => `@${e.username}: ${e.error}`).join(" | "));
      }
      await loadAccounts();
      onSynced();
    });

  return (
    <section className="space-y-4 border-4 border-black bg-white p-4 shadow-brutal-lg">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-xl uppercase">
          <Instagram className="h-5 w-5" /> Instagram accounts
        </h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={test} disabled={busy !== null} className="brutal-btn bg-white !py-1.5 !text-xs">
            {busy === "test" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stethoscope className="h-4 w-4" />} Test connection
          </button>
          <button
            type="button"
            onClick={syncNow}
            disabled={busy !== null || !accounts.some((a) => a.active)}
            className="brutal-btn bg-durbs-cyan !py-1.5 !text-xs"
          >
            {busy === "sync" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Check Instagram now
          </button>
        </div>
      </div>

      <p className="text-sm font-semibold text-neutral-700">
        New posts from these accounts are read by the AI every hour. Posts that look like upcoming events land in
        <strong> Pending</strong> with a link to the original post. Accounts must be Instagram business or creator accounts.
      </p>

      {!configured && (
        <p className="border-3 border-black bg-durbs-yellow px-3 py-2 text-sm font-bold">
          META_ACCESS_TOKEN and INSTAGRAM_USER_ID aren&apos;t both set in Vercel yet, so checks will fail.
        </p>
      )}
      {status && <p className="border-3 border-black bg-durbs-cyan px-3 py-2 text-sm font-bold">{status}</p>}
      {error && (
        <p role="alert" className="border-3 border-black bg-red-500 px-3 py-2 text-sm font-bold text-white">
          {error}
        </p>
      )}

      {checks && (
        <div className="space-y-2 border-3 border-black p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-sm uppercase">Connection test</span>
            <input
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              placeholder={accounts[0] ? `@${accounts[0].username}` : "@account to test"}
              className="brutal-input w-48 !py-1 text-sm"
            />
            <button type="button" onClick={test} disabled={busy !== null} className="brutal-btn bg-white !py-1 !text-xs">
              Re-test
            </button>
          </div>
          <ul className="space-y-1 text-sm">
            {checks.map((c) => (
              <li key={c.step} className="flex items-start gap-2">
                {c.ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                )}
                <span>
                  <strong>{c.step}:</strong> {c.detail}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={addAccounts} className="flex flex-col gap-2 sm:flex-row">
        <input
          value={newNames}
          onChange={(e) => setNewNames(e.target.value)}
          placeholder="@venue, @promoter, instagram.com/market (comma-separated)"
          className="brutal-input flex-1 !py-1.5 text-sm"
          aria-label="Instagram accounts to follow"
        />
        <button type="submit" disabled={busy !== null || !newNames.trim()} className="brutal-btn bg-durbs-pink !py-1.5 text-white">
          {busy === "add" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Follow
        </button>
      </form>

      {loading ? (
        <p className="text-sm font-bold">Loading accounts…</p>
      ) : accounts.length === 0 ? (
        <p className="border-3 border-dashed border-black p-4 text-center text-sm font-bold">
          Not following any accounts yet. Add Durban venues, promoters and markets above.
        </p>
      ) : (
        <ul className="divide-y-2 divide-black border-3 border-black">
          {accounts.map((a) => (
            <li key={a.username} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <a
                  href={`https://www.instagram.com/${a.username}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`font-display text-sm uppercase hover:underline ${a.active ? "" : "text-neutral-400 line-through"}`}
                >
                  @{a.username}
                </a>
                <p className="text-xs font-semibold text-neutral-600">
                  Checked {ago(a.last_checked_at)} · {a.checked} posts read · {a.events} events (30 days)
                  {!a.active && " · paused"}
                </p>
                {a.last_error && <p className="text-xs font-bold text-red-600">{a.last_error}</p>}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => toggle(a)}
                  disabled={busy !== null}
                  aria-label={a.active ? `Pause @${a.username}` : `Resume @${a.username}`}
                  className="brutal-btn bg-white !px-2 !py-1"
                >
                  {busy === a.username ? <Loader2 className="h-4 w-4 animate-spin" /> : a.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => remove(a)}
                  disabled={busy !== null}
                  aria-label={`Stop following @${a.username}`}
                  className="brutal-btn bg-white !px-2 !py-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
