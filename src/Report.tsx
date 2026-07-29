import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  SSWTooltip,
  SSWTooltipTrigger,
  SSWTooltipContent,
  SSWTooltipProvider,
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

// A numeric column header with a portaled tooltip showing the exact date.
function HeadTip({ label, date }: { label: string; date: string }) {
  return (
    <SSWTooltip>
      <SSWTooltipTrigger render={<span className="th-tip">{label}</span>} />
      <SSWTooltipContent side="top">As of {date}</SSWTooltipContent>
    </SSWTooltip>
  );
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
  emptyLabel,
}: {
  value: number | null;
  prev: number | null;
  emptyLabel?: ReactNode; // shown when value is null (defaults to a muted dash)
}) {
  if (value === null)
    return (
      <SSWTableCell numeric>
        {emptyLabel ?? <span className="report-meta">—</span>}
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
  const totalStars = org.repos.reduce((s, r) => s + currentStars(r, live), 0);

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
          <SSWCardTitle className="org-title">
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
                <SSWTableHead className="col-num">#</SSWTableHead>
                <SSWTableHead>Repo</SSWTableHead>
                <SSWTableHead>Created on</SSWTableHead>
                <SSWTableHead numeric>
                  <HeadTip label="2 years ago" date={fmtDate(d24)} />
                </SSWTableHead>
                <SSWTableHead numeric>
                  <HeadTip label="1 year ago" date={fmtDate(d12)} />
                </SSWTableHead>
                <SSWTableHead numeric>
                  <HeadTip label="6 months ago" date={fmtDate(d6)} />
                </SSWTableHead>
                <SSWTableHead numeric>
                  <HeadTip label="3 months ago" date={fmtDate(d3)} />
                </SSWTableHead>
                <SSWTableHead numeric>
                  <HeadTip label="Current" date={fmtDate(todayISO)} />
                </SSWTableHead>
              </SSWTableRow>
            </SSWTableHeader>
            <SSWTableBody>
              {repos.map((r, i) => {
                const v2 = valueAt(r, d24);
                const v1 = valueAt(r, d12);
                const v6 = valueAt(r, d6);
                const v3 = valueAt(r, d3);
                const l = live[r.repo];
                // Live value when we have it; otherwise fall back to the last
                // recorded checkpoint (e.g. GitHub's anonymous rate limit — 60/hr
                // per IP — was hit). Private repos have no readable live value on
                // a public page, so they show "private".
                const current =
                  typeof l === "number"
                    ? l
                    : r.private
                    ? null
                    : r.history.at(-1)?.stars ?? null;

                return (
                  <SSWTableRow key={r.repo}>
                    <SSWTableCell className="col-num">
                      <span className="report-meta">{i + 1}</span>
                    </SSWTableCell>
                    <SSWTableCell>
                      <span className="proj-name">
                        <a
                          href={`https://github.com/${r.repo}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {r.name}
                        </a>
                      </span>
                    </SSWTableCell>
                    <SSWTableCell>
                      <span className="report-meta proj-since">
                        {fmtDate(r.created)}
                      </span>
                    </SSWTableCell>
                    <Cell value={v2} prev={null} />
                    <Cell value={v1} prev={v2} />
                    <Cell value={v6} prev={v1} />
                    <Cell value={v3} prev={v6} />
                    <Cell
                      value={current}
                      prev={v3}
                      emptyLabel={
                        r.private ? <span className="tag-private">private</span> : undefined
                      }
                    />
                  </SSWTableRow>
                );
              })}
            </SSWTableBody>
          </SSWTable>
        </div>
        <p className="org-stats report-meta">
          Total Stars: <strong>{totalStars.toLocaleString()}</strong> ⭐
        </p>
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
    <SSWTooltipProvider delay={0}>
    <div className="report-shell">
      <header className="report-head">
        <div className="report-brand">
          <span className="report-emoji" role="img" aria-label="chart increasing">
            📈
          </span>
          <h1>SSW GitHub Star Report</h1>
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

      <p className="mobile-tip">
        💡 <strong>Tip:</strong> Additional information is shown on larger screens.
      </p>

      {error && <p>Could not load report data: {error}</p>}
      {!data && !error && <p>Loading…</p>}
      {data?.orgs.map((org) => (
        <OrgTable key={org.login} org={org} live={live} sortBy={sortBy} />
      ))}

      <footer className="report-footer">
        <a
          className="footer-repo"
          href="https://github.com/SSWConsulting/SSW.GitHub.Stars.Report"
          target="_blank"
          rel="noreferrer"
        >
          <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
            <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
          </svg>
          <span>SSWConsulting/SSW.GitHub.Stars.Report</span>
        </a>
        <div className="footer-brand">
          <SSWLogo />
          <span className="report-meta">
            © 1990–{new Date().getFullYear()} SSW. All rights reserved.
          </span>
        </div>
      </footer>
    </div>
    </SSWTooltipProvider>
  );
}
