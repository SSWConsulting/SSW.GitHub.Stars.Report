"""Append a quarterly star checkpoint to every repo in stars-history.json,
then write an email-safe HTML snapshot (email.html) for the quarterly email.

The repo list lives in the JSON itself (grouped by org), so adding a repo just
means adding it there. Runs from the cron workflow on 1 Jan/Apr/Jul/Oct. The
first entry per repo is the baseline and is never overwritten.
"""

import calendar
import json
import os
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path

TOKEN = os.environ["GH_TOKEN"]
REPORT_URL = os.environ.get(
    "REPORT_URL", "https://sswconsulting.github.io/SSW.GitHub.Stars.Report/"
)
HISTORY = Path("public/stars-history.json")
EMAIL_OUT = Path("email.html")
TODAY_DATE = date.today()
TODAY = TODAY_DATE.isoformat()

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def fmt_date(iso: str) -> str:
    y, m, d = (int(x) for x in iso.split("-"))
    return f"{d:02d} {MONTHS[m - 1]} {y}"


def months_ago(n: int) -> str:
    """ISO date n months before today (clamped to a valid day-of-month)."""
    total = (TODAY_DATE.year * 12 + TODAY_DATE.month - 1) - n
    y, m = divmod(total, 12)
    m += 1
    d = min(TODAY_DATE.day, calendar.monthrange(y, m)[1])
    return date(y, m, d).isoformat()


def as_of(history, target):
    """Stars as of a target date = latest checkpoint on or before it."""
    found = None
    for e in history:
        if e["date"] <= target:
            found = e
        else:
            break
    return found


def value_at(repo, target):
    """Stars at target date, or None if the repo did not exist yet then."""
    if repo.get("created", "") > target:
        return None
    e = as_of(repo["history"], target)
    return e["stars"] if e else None


def stargazers(repo: str) -> "int | None":
    """Current star count, or None if the repo can't be read (e.g. a private
    repo when only GITHUB_TOKEN is available — no ORG_READ_TOKEN secret set)."""
    req = urllib.request.Request(
        f"https://api.github.com/repos/{repo}",
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Accept": "application/vnd.github+json",
            "User-Agent": "ssw-star-report",
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.load(resp)["stargazers_count"]
    except urllib.error.HTTPError as e:
        print(f"WARN {repo}: cannot read ({e.code}) — skipping this run")
        return None


# --- email rendering (inline styles only; email clients strip external CSS) ---

def cell(value) -> str:
    txt = "&mdash;" if value is None else str(value)
    return f'<td style="padding:8px 10px;text-align:right;border-bottom:1px solid #eee;">{txt}</td>'


def current_cell(value, three_mo) -> str:
    if value is None:
        return cell(None)
    delta = ""
    if three_mo is not None:
        d = value - three_mo
        if d > 0:
            delta = f' <span style="color:#1a7f37;font-size:12px;">(+{d})</span>'
        elif d < 0:
            delta = f' <span style="color:#cf222e;font-size:12px;">({d})</span>'
    return (
        '<td style="padding:8px 10px;text-align:right;border-bottom:1px solid #eee;">'
        f'<b>{value}</b>{delta}</td>'
    )


def org_table(org, d6, d3) -> str:
    th = ('padding:8px 10px;border-bottom:2px solid #cc4141;'
          'font-size:13px;color:#57606a;text-align:right;')
    rows = ""
    for r in org["repos"]:
        current = r["history"][-1]["stars"] if r.get("history") else None
        v3 = value_at(r, d3)
        name = r["name"] + (
            ' <span style="color:#999;font-size:11px;">(private)</span>'
            if r.get("private") else ""
        )
        rows += (
            '<tr>'
            f'<td style="padding:8px 10px;border-bottom:1px solid #eee;">'
            f'<a href="https://github.com/{r["repo"]}" '
            f'style="color:#1f2430;text-decoration:none;">{name}</a></td>'
            f'{cell(value_at(r, d6))}{cell(v3)}'
            f'{current_cell(current, v3)}'
            '</tr>'
        )
    return (
        f'<h3 style="margin:22px 0 6px;font-size:16px;">{org["name"]}</h3>'
        '<table cellspacing="0" cellpadding="0" '
        'style="border-collapse:collapse;width:100%;font-size:14px;">'
        '<tr style="background:#f6f8fa;">'
        f'<th style="{th}text-align:left;">Repo</th>'
        f'<th style="{th}">6 months ago</th>'
        f'<th style="{th}">3 months ago</th>'
        f'<th style="{th}">Current</th>'
        f'</tr>{rows}</table>'
    )


def build_email(data) -> str:
    d6, d3 = months_ago(6), months_ago(3)
    tables = "".join(org_table(o, d6, d3) for o in data["orgs"])
    btn = (
        'background:#cc4141;color:#fff;padding:10px 18px;border-radius:6px;'
        'text-decoration:none;font-size:14px;display:inline-block;'
    )
    return (
        '<div style="font-family:Arial,Helvetica,sans-serif;color:#1f2430;'
        'max-width:760px;margin:0 auto;">'
        '<h3 style="color:#cc4141;font-size:16px;margin:0 0 12px;">Hi Adam,</h3>'
        f'<p style="color:#555;font-size:14px;margin:0 0 16px;">'
        f'Below is a snapshot of the GitHub &ldquo;star&rdquo; numbers as of today '
        f'(<b>{fmt_date(TODAY)}</b>).<br>'
        f'The live version always shows the latest numbers.</p>'
        f'<p style="margin:0 0 20px;"><a href="{REPORT_URL}" style="{btn}">'
        'View the live report &rarr;</a></p>'
        '<hr style="border:none;border-top:1px solid #e5e5e5;margin:20px 0 16px;">'
        '<h2 style="font-size:15px;margin:0 0 4px;">&#128200; GitHub Stars Report</h2>'
        f'{tables}'
        '<p style="color:#888;font-size:12px;margin:22px 0 0;">'
        'Sent automatically every quarter.</p>'
        '<p style="margin:12px 0 0;">Cheers,</p>'
        '</div>'
    )


def main() -> None:
    data = json.loads(HISTORY.read_text())

    for org in data["orgs"]:
        for r in org["repos"]:
            count = stargazers(r["repo"])
            if count is None:
                continue  # leave this repo's history untouched
            hist = r.setdefault("history", [])
            if hist and hist[-1]["date"] == TODAY:
                hist[-1]["stars"] = count  # idempotent re-run
            else:
                hist.append({"date": TODAY, "stars": count})
            print(f"{r['repo']}: {count} stars recorded for {TODAY}")

    HISTORY.write_text(json.dumps(data, indent=2) + "\n")
    EMAIL_OUT.write_text(build_email(data))
    print(f"wrote {EMAIL_OUT}")

    with open(os.environ["GITHUB_OUTPUT"], "a") as f:
        f.write(f"date={TODAY}\n")


if __name__ == "__main__":
    main()
