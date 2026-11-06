# CLAUDE.md

Birthday reminders for YAC leadership. Deterministic tool, called on a
schedule; no model calls or agent logic here (those live in
`ncssm-yac/yakkety`).

- **Birthdays are personal data.** They live only in the YAC Member Directory
  Sheet (Birthday column), read at run time. Never put a real birthday or
  name in a file, commit, test, issue, PR or log. Tests use made-up names.
  Logs print counts only.
- Month and day only. Ignore any year in the Sheet.
- Posts go through `ncssm-yac/yac-chat` as source `yac-birthdays`, which
  that repo's allowlist limits to YAC Leadership (real reminders, since
  Nov 6, 2026) and YAC IT (TEST samples). Posting anywhere else is a
  decision for the owner.
- Webhook URLs and the Google key are secrets. Never print or commit them.
- Workflow inputs reach scripts only as environment variables.
- `npm test` before every push.
