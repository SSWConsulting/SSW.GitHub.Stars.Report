import { useEffect, useState } from "react";
import {
  SSWCard,
  SSWCardHeader,
  SSWCardTitle,
  SSWCardContent,
  SSWTable,
  SSWTableHeader,
  SSWTableBody,
  SSWTableRow,
  SSWTableHead,
  SSWTableCell,
  SSWBadge,
  SSWLogo,
} from "@sswconsulting/design-system";

type Entry = { date: string; stars: number };
type Repo = {
  repo: string;
  name: string;
  private: boolean;
  created: string;
  history: Entry[];
};
type Org = { name: string; login: string; repos: Repo[] };
type Data = { orgs: Org[] };

// null = not loaded yet, "error" = live fetch failed (fall back to last checkpoint)
type Live = Record<string, number | "error" | null>;

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Strict "DD MMM YYYY", locale-independent (e.g. 01 Jul 2026).
function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${MONTHS[m - 1]} ${y}`;
}

// Local YYYY-MM-DD (avoids UTC off-by-one from toISOString in +10/+11 zones).
function toLocalISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// ISO date N months before today — recomputed on every load, so the columns
// naturally point at different checkpoints depending on the current semester.
function monthsAgoISO(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return toLocalISO(d);
}

// Value as of a target date = the most recent checkpoint on or before it.
function asOf(history: Entry[], target: string): Entry | null {
  let found: Entry | null = null;
  for (const e of history) {
    if (e.date <= target) found = e;
    else break;
  }
  return found;
}

function Delta({ from, to }: { from: number | null; to: number | null }) {
  if (from === null || to === null) return null;
  const d = to - from;
  if (d === 0) return <span className="delta-zero">0</span>;
  return (
    <SSWBadge variant={d > 0 ? "success" : "destructive"}>
      {d > 0 ? `+${d}` : d}
    </SSWBadge>
  );
}

function Cell({
  value,
  prev,
  loading,
}: {
  value: number | null;
  prev: number | null;
  loading?: boolean;
}) {
  if (value === null)
    return (
      <SSWTableCell numeric>
        <span className="report-meta">{loading ? "…" : "—"}</span>
      </SSWTableCell>
    );
  return (
    <SSWTableCell numeric>
      <div className="cell-stack">
        <strong>{value}</strong>
        <Delta from={prev} to={value} />
      </div>
    </SSWTableCell>
  );
}

// Value as of a target date, or null if the repo didn't exist yet then.
function valueAt(r: Repo, target: string): number | null {
  if (r.created > target) return null; // created after the target date
  const e = asOf(r.history, target);
  return e ? e.stars : null;
}

function OrgTable({ org, live }: { org: Org; live: Live }) {
  const d24 = monthsAgoISO(24);
  const d12 = monthsAgoISO(12);
  const d6 = monthsAgoISO(6);
  const d3 = monthsAgoISO(3);
  const todayISO = toLocalISO(new Date());

  return (
    <SSWCard>
      <SSWCardHeader>
        <div className="org-head">
          <a
            href={`https://github.com/${org.login}`}
            target="_blank"
            rel="noreferrer"
            className="org-logo-link"
          >
            <img
              className="org-logo"
              src={`https://github.com/${org.login}.png`}
              alt={`${org.name} logo`}
            />
          </a>
          <SSWCardTitle>
            <a href={`https://github.com/${org.login}`} target="_blank" rel="noreferrer">
              {org.name}
            </a>
          </SSWCardTitle>
        </div>
      </SSWCardHeader>
      <SSWCardContent>
        <div className="table-scroll">
          <SSWTable>
            <SSWTableHeader>
              <SSWTableRow>
                <SSWTableHead>Repo</SSWTableHead>
                <SSWTableHead numeric>
                  <span className="th-tip" data-tip={`As of ${fmtDate(d24)}`}>2 years ago</span>
                </SSWTableHead>
                <SSWTableHead numeric>
                  <span className="th-tip" data-tip={`As of ${fmtDate(d12)}`}>1 year ago</span>
                </SSWTableHead>
                <SSWTableHead numeric>
                  <span className="th-tip" data-tip={`As of ${fmtDate(d6)}`}>6 months ago</span>
                </SSWTableHead>
                <SSWTableHead numeric>
                  <span className="th-tip" data-tip={`As of ${fmtDate(d3)}`}>3 months ago</span>
                </SSWTableHead>
                <SSWTableHead numeric>
                  <span className="th-tip" data-tip={`As of ${fmtDate(todayISO)}`}>Current</span>
                </SSWTableHead>
              </SSWTableRow>
            </SSWTableHeader>
            <SSWTableBody>
              {org.repos.map((r) => {
                const v2 = valueAt(r, d24);
                const v1 = valueAt(r, d12);
                const v6 = valueAt(r, d6);
                const v3 = valueAt(r, d3);
                const l = live[r.repo];
                // Only show a live number. If it can't be read (e.g. private
                // repo on a public page), show a dash rather than a stale value.
                const current = typeof l === "number" ? l : null;
                const liveLoading = l === undefined;

                return (
                  <SSWTableRow key={r.repo}>
                    <SSWTableCell>
                      <div className="proj-cell">
                        <span className="proj-name">
                          <a
                            href={`https://github.com/${r.repo}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {r.name}
                          </a>
                          {r.private && <span className="tag-private">private</span>}
                        </span>
                        <span className="report-meta proj-since">
                          Since {fmtDate(r.created)}
                        </span>
                      </div>
                    </SSWTableCell>
                    <Cell value={v2} prev={null} />
                    <Cell value={v1} prev={v2} />
                    <Cell value={v6} prev={v1} />
                    <Cell value={v3} prev={v6} />
                    <Cell value={current} prev={v3} loading={liveLoading} />
                  </SSWTableRow>
                );
              })}
            </SSWTableBody>
          </SSWTable>
        </div>
      </SSWCardContent>
    </SSWCard>
  );
}

export default function Report() {
  const [data, setData] = useState<Data | null>(null);
  const [live, setLive] = useState<Live>({});
  const [error, setError] = useState<string | null>(null);

  // 1. Load the saved checkpoint history (written by the 6-monthly cron).
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}stars-history.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  // 2. Read the CURRENT star count live from GitHub for every repo.
  useEffect(() => {
    if (!data) return;
    for (const org of data.orgs)
      for (const r of org.repos)
        fetch(`https://api.github.com/repos/${r.repo}`)
          .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
          .then((d) => setLive((s) => ({ ...s, [r.repo]: d.stargazers_count })))
          .catch(() => setLive((s) => ({ ...s, [r.repo]: "error" })));
  }, [data]);

  return (
    <div className="report-shell">
      <header className="report-head">
        <div className="report-brand">
          <SSWLogo />
          <h1>GitHub Star Report</h1>
        </div>
      </header>

      {error && <p>Could not load report data: {error}</p>}
      {!data && !error && <p>Loading…</p>}
      {data?.orgs.map((org) => (
        <OrgTable key={org.login} org={org} live={live} />
      ))}

      <footer className="report-footer">
        <SSWLogo />
        <span className="report-meta">
          © 1990–{new Date().getFullYear()} SSW. All rights reserved.
        </span>
      </footer>
    </div>
  );
}
