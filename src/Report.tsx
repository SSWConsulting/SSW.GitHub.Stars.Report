import { useEffect, useMemo, useState } from "react";
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
  SSWSelect,
  SSWSelectTrigger,
  SSWSelectValue,
  SSWSelectContent,
  SSWSelectItem,
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

type SortKey = "created" | "alpha" | "stars" | "new3mo";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "stars", label: "Most stars" },
  { value: "new3mo", label: "Most new stars (last 3 months)" },
  { value: "created", label: "Date created (oldest first)" },
  { value: "alpha", label: "Alphabetical" },
];

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

// Best-known current star count: live value if loaded, else last checkpoint.
function currentStars(r: Repo, live: Live): number {
  const l = live[r.repo];
  if (typeof l === "number") return l;
  return r.history.at(-1)?.stars ?? 0;
}

function sortRepos(repos: Repo[], sortBy: SortKey, live: Live, d3: string): Repo[] {
  const arr = [...repos];
  switch (sortBy) {
    case "alpha":
      return arr.sort((a, b) => a.name.localeCompare(b.name));
    case "created": // oldest repo first
      return arr.sort((a, b) => a.created.localeCompare(b.created));
    case "stars":
      return arr.sort((a, b) => currentStars(b, live) - currentStars(a, live));
    case "new3mo": {
      const gain = (r: Repo) => currentStars(r, live) - (valueAt(r, d3) ?? 0);
      return arr.sort((a, b) => gain(b) - gain(a));
    }
  }
}

function OrgTable({
  org,
  live,
  sortBy,
}: {
  org: Org;
  live: Live;
  sortBy: SortKey;
}) {
  const d24 = monthsAgoISO(24);
  const d12 = monthsAgoISO(12);
  const d6 = monthsAgoISO(6);
  const d3 = monthsAgoISO(3);
  const todayISO = toLocalISO(new Date());
  const repos = useMemo(
    () => sortRepos(org.repos, sortBy, live, d3),
    [org.repos, sortBy, live, d3]
  );

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
              {repos.map((r) => {
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
  const [sortBy, setSortBy] = useState<SortKey>("stars");

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
        <div className="sort-control">
          <span className="report-meta">Sort by</span>
          <SSWSelect
            value={sortBy}
            onValueChange={(v) => setSortBy(v as SortKey)}
          >
            <SSWSelectTrigger size="sm" className="sort-trigger">
              <SSWSelectValue>
                {(value: string) =>
                  SORT_OPTIONS.find((o) => o.value === value)?.label
                }
              </SSWSelectValue>
            </SSWSelectTrigger>
            <SSWSelectContent>
              {SORT_OPTIONS.map((o) => (
                <SSWSelectItem key={o.value} value={o.value}>
                  {o.label}
                </SSWSelectItem>
              ))}
            </SSWSelectContent>
          </SSWSelect>
        </div>
      </header>

      {error && <p>Could not load report data: {error}</p>}
      {!data && !error && <p>Loading…</p>}
      {data?.orgs.map((org) => (
        <OrgTable key={org.login} org={org} live={live} sortBy={sortBy} />
      ))}

      <footer className="report-footer">
        <a
          href="https://github.com/SSWConsulting/SSW.GitHub.Stars.Report"
          target="_blank"
          rel="noreferrer"
        >
          See how it works on GitHub
        </a>
        <div className="footer-brand">
          <SSWLogo />
          <span className="report-meta">
            © 1990–{new Date().getFullYear()} SSW. All rights reserved.
          </span>
        </div>
      </footer>
    </div>
  );
}
