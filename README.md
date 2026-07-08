# SSW GitHub Stars Report

A small dashboard that tracks **GitHub star counts** for SSW and TinaCMS
repositories over time, styled with the [SSW Design System](https://design.ssw.com.au/)
and published to GitHub Pages.

**Live page:** https://sswconsulting.github.io/SSW.GitHub.Stars.Report/

Each repo is shown across five points in time — **2 years ago, 1 year ago,
6 months ago, 3 months ago, and Current** — with the change between columns.
The "ago" columns are relative to the day you open the page, so they roll
forward automatically. **Current** is read **live** from the GitHub API in your
browser; the other columns come from saved quarterly checkpoints.

## How it works

```
Quarterly cron (1 Jan/Apr/Jul/Oct, 10am Sydney)
  └─ .github/scripts/star_report.py
       ├─ reads current star counts for every repo
       ├─ appends a checkpoint to public/stars-history.json
       └─ commits it
            └─ triggers the Pages deploy → site rebuilds
            └─ posts a card to Microsoft Teams (@mentions the team)
```

- **Data** lives in [`public/stars-history.json`](public/stars-history.json),
  grouped by org. Each repo has its `created` date and a list of
  `{ date, stars }` checkpoints. The page reads this file, then fetches each
  repo's live count for the `Current` column.
- **Historical checkpoints** were seeded by reconstructing counts from each
  repo's stargazer timestamps (the same technique star-history.com uses).
  These are close but approximate — they can't see anyone who starred and
  later un-starred. Every checkpoint recorded by the cron from now on is an
  exact reading.
- A cell shows a **dash (—)** when the repo did not exist yet at that point
  (based on its creation date).

## Adding or removing a repo

Edit [`public/stars-history.json`](public/stars-history.json): add an entry
under the right org with `repo`, `name`, `private`, `created`, and a `history`
array. The list of repos the cron tracks is driven entirely by this file.

## Local development

```bash
npm install
npm run dev      # local dev server
npm run build    # production build (set BASE_PATH for a subpath deploy)
```

Stack: Vite + React + TypeScript, `@sswconsulting/design-system`.

## Deployment

Pushing to `main` runs [`.github/workflows/pages.yml`](.github/workflows/pages.yml),
which builds the site and deploys it to GitHub Pages (source: GitHub Actions).
The Vite `base` path is set from the repo name at build time.

## Automation & secrets

[`.github/workflows/star-report.yml`](.github/workflows/star-report.yml) runs
quarterly at **10am Sydney** on 1 Jan / 1 Apr / 1 Jul / 1 Oct. It records a
checkpoint, commits it, and notifies Microsoft Teams.

| Secret | Required? | Purpose |
| --- | --- | --- |
| `TEAMS_WEBHOOK_URL` | for notifications | A Teams **Workflows** webhook ("Send webhook alerts to a channel"). If unset, the notification step is skipped. |
| `ORG_READ_TOKEN` | optional | A PAT with read access to the **private** repos, so their checkpoints keep updating. Falls back to the default token (public repos only). |

Scheduled runs @mention the full team; manual runs (`workflow_dispatch`) mention
only one person, so testing never spams the channel.

## ⚠️ Limitations with private repositories

Private repos (e.g. `SSW.YakShaver`, `SSW.EagleEye`) work differently from
public ones, for two reasons:

1. **No live `Current` value.** The `Current` column is fetched by the
   visitor's browser using the *unauthenticated* GitHub API. Private repos
   return `404` to an anonymous request, so their `Current` cell shows a
   **dash (—)** — the page never displays a stale/guessed value.

2. **Checkpoints need an org-scoped token.** The quarterly cron can only read a
   private repo's star count if an **`ORG_READ_TOKEN`** secret (a PAT with read
   access) is configured. Without it the repo is **skipped** each run (the run
   still succeeds for everything else) and its historical columns simply stop
   updating.

3. **Public page = public numbers.** This site is deployed to a **public**
   GitHub Pages URL, so any private-repo data baked into
   `stars-history.json` (name + star history) is visible to anyone with the
   link. Keep that in mind before adding sensitive repos.

In short: private repos can show **historical** columns (from committed data,
if a token is available when the cron runs) but never a **live** `Current`
value on the public page.
