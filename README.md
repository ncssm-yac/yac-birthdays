# yac-birthdays

Tells YAC leadership when a member's birthday is a week away and on the day.
A deterministic tool for Yakkety, the YAC AI Secretary: no model calls.

**Live in YAC Leadership** since Nov 6, 2026 (owner's decision). Made-up
samples still go to **YAC IT**, marked TEST.

## How it works

1. `daily.yml` runs every day from 8 AM Eastern. GitHub delays scheduled
   runs by hours, so it tries several times and posts on the first try at
   8 AM or later; it skips if today's already done. If the day's last try
   (18:17 UTC) ends without reminding, the run fails, so the monitor sees it.
2. `run.js` reads the **YAC Member Directory** Sheet with the yakkety service
   account. It finds columns by header name: `First Name`, `Last Name`,
   `Birthday` (month/day, like `12/16`; a year is ignored) and `Status`.
   Only `Active` members count.
3. `birthdays.js` picks people whose birthday is **today** or **7 days
   away**. Feb 29 birthdays are celebrated on Feb 28 in non-leap years.
4. One message, worded by one of ten goofy variants picked at random, goes to `ncssm-yac/yac-chat` as source
   `yac-birthdays`. From Yakkety (AI). No birthdays that day means no post.

Birthdays are personal data: they stay in the Sheet. Logs show counts only.

## Secrets (repository)

| Secret | What |
| --- | --- |
| `YAKKETY_GOOGLE_KEY` | The yakkety service account key. Viewer on the Member Directory. The Google Sheets API must be on in its project. |
| `YAC_REPOS_TOKEN` | Fine-grained token: Actions write on `ncssm-yac/yac-chat`. |

## Trying it

Actions → **Birthday reminders** → Run workflow. *Dry run* (the default)
prints counts and sends nothing. Untick it to send the real reminder to YAC Leadership.

**Check the posting path:** tick *Skip the Sheet and post a made-up sample* and untick *dry run*. It skips the
Sheet and posts a made-up TEST message (Ada Test, Ben Sample) to YAC IT, so the
token, `yac-chat` and the webhook are checked without a real birthday.

## Where it posts

YAC Leadership (`SPACE` in `daily.yml`), unmarked. A sample run goes to YAC IT
instead and is always marked TEST. `yac-chat`'s `spaces.json` allows the
`yac-birthdays` source in `leadership` and `it` only; changing that is the
owner's decision.

```bash
npm test     # no network, no secrets
```
