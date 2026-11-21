# YAC Birthday Trigger (Apps Script)

Starts `daily.yml` (Birthday reminders) right after 8 AM New York time,
because GitHub's own schedule has been running the reminders 7-9 hours late.

- Runs every 15 minutes as `ncssm.yac.yakkety@gmail.com`, so the first try is
  between 8:00 and 8:15 AM. Before 8 AM it does nothing.
- Once a day it makes one `workflow_dispatch` call to `daily.yml` with
  `dry_run` and `caller: apps-script`. It reads no Sheet and no birthdays.
- If GitHub refuses the call, the run fails (Apps Script emails the yakkety
  inbox) and the next 15-minute run tries again.
- The late GitHub schedule stays as a backup. `daily.yml` remembers a day once
  it has posted, so there is never a second post.
- Its runs show in **Actions → Birthday reminders** as
  *Birthday reminders (8 AM trigger)*, with the time they started.

## GitHub is the source of truth

Don't edit the code in the Apps Script editor. The **Apps Script** workflow
(`.github/workflows/apps-script.yml`, which calls YAC's shared deploy in
`ncssm-yac/yac-apps-script-deploy`):

- on a pull request: runs the tests;
- on merge to `main` (or **Run workflow**): tests, `clasp push`, then checks
  that the live code matches the repo;
- every day: the same check. It fails if someone changed the live code in
  the editor, or if the clasp sign-in has stopped working.

The project is called **YAC Birthday Trigger** and is found by that title in
the yakkety account's Drive. The first deploy creates it.

## Setup (one time)

1. **Apps Script API on** for `ncssm.yac.yakkety@gmail.com`:
   script.google.com/home/usersettings. (Done Nov 2026.)
2. **`CLASPRC_JSON`**: the contents of `~/.clasprc.json` after
   `npx.cmd @google/clasp login` as the yakkety account. Since Nov 21, 2026
   it is an **organization** secret shared by every Apps Script repo (setup
   and renewal: the `yac-apps-script-deploy` README); this repo's own copy
   should be deleted so it can't override a renewal.
3. **Merge** the pull request that adds `apps-script/`. The Apps Script
   workflow creates the project and pushes the code. Its run summary links to
   the project.
4. **GitHub token**: a fine-grained token on `ncssm-yac` for
   **`ncssm-yac/yac-birthdays` only**, permission **Actions: Read and write**.
   In the project: Project Settings → Script Properties → add `GITHUB_TOKEN`.
   Never put it in the repo or chat. Put its expiry date on a calendar.
5. In the editor, run **`setup`** once and approve the consent screen (Google
   will say the app is unverified: Advanced → continue). It creates the
   15-minute trigger.
6. Run **`testDispatch`**. A dry run, *Birthday reminders (8 AM trigger, dry
   run)*, should appear under Actions within a minute. It posts nothing.
   To check the whole path to Google Chat, run **`testPostToIT`**: it posts
   the made-up TEST message (Ada Test, Ben Sample) to **YAC IT**, never
   Leadership, and shows in Actions as *Birthday reminders (Apps Script TEST
   to YAC IT)*.
7. `DRY_RUN` is on until you add the Script Property `DRY_RUN` = `false`.
   While it's on, the 8 AM run is a dry run and the late backup schedule
   still posts as before. Set it to `false` to go live.

## When the sign-in breaks

A password change or Google signing the account out ends the clasp login, and
the daily check goes red. On your computer:

```powershell
npx.cmd @google/clasp login
Get-Content $HOME\.clasprc.json -Raw | Set-Clipboard
```

Paste it as the new value of the `CLASPRC_JSON` organization secret, then clear the clipboard
(`Set-Clipboard -Value " "`) and delete `$HOME\.clasprc.json`.

## Tests

```bash
node apps-script/test/run-tests.js   # also part of npm test
```

The tests run `Code.gs` in Node with stubbed Google services: the 8 AM gate,
once a day, dry run by default, retry after a failure, missing token, the
lock, what is sent to GitHub, the trigger, the manifest scopes, and that
`daily.yml` accepts the inputs.
