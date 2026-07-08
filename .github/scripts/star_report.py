"""Append a quarterly star checkpoint to every repo in stars-history.json.

The repo list lives in the JSON itself (grouped by org), so adding a repo just
means adding it there. Runs from the cron workflow on 1 Jan/Apr/Jul/Oct. The
first entry per repo is the baseline and is never overwritten.
"""

import json
import os
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path

TOKEN = os.environ["GH_TOKEN"]
HISTORY = Path("public/stars-history.json")
TODAY = date.today().isoformat()


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

    with open(os.environ["GITHUB_OUTPUT"], "a") as f:
        f.write(f"date={TODAY}\n")


if __name__ == "__main__":
    main()
