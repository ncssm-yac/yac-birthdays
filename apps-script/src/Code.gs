/**
 * YAC Birthday Trigger -- starts yac-birthdays' "Birthday reminders" workflow
 * (daily.yml) right after 8 AM New York time, instead of waiting for
 * GitHub's best-effort cron, which has been running 7-9 hours late.
 *
 * Runs every 15 minutes (see setup()) as ncssm.yac.yakkety@gmail.com, so the
 * first try is between 8:00 and 8:15 AM. Plain code, no model. It reads no
 * Sheet and no birthdays: the only thing it sends out is one workflow_dispatch
 * call a day to GitHub. The workflow does the rest.
 *
 * Deployed from GitHub (apps-script/ in ncssm-yac/yac-birthdays) by the
 * "Apps Script" workflow. Do not edit it in the Apps Script editor: the daily
 * drift check fails if the live code and the repo differ.
 *
 * Entry points: remindBirthdays (the trigger), setup (run once), testDispatch.
 *
 * Script Properties (Project Settings; never commit values):
 *   GITHUB_TOKEN   fine-grained token: ncssm-yac/yac-birthdays only, Actions: read and write
 *   DRY_RUN        anything but 'false' = start the workflow as a dry run (default)
 *   LAST_DISPATCH  written by the script: the day and mode last handed to GitHub
 *
 * Why this is safe: the workflow remembers a day once it has posted and skips
 * any later run that day, so the late GitHub schedule stays as a backup and
 * never makes a second post.
 */

var REPO = 'ncssm-yac/yac-birthdays';
var WORKFLOW = 'daily.yml';
var REF = 'main';
var TZ = 'America/New_York';
var FROM_HOUR = 8; // reminders go out from 8 AM New York time

/** The trigger. */
function remindBirthdays() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) { Logger.log('Another run is in progress; skipping.'); return; }
  try {
    var now = new Date();
    var hour = Number(Utilities.formatDate(now, TZ, 'H'));
    if (hour < FROM_HOUR) { Logger.log('It is ' + hour + ':xx in New York; reminders go out from ' + FROM_HOUR + ' AM.'); return; }

    var props = PropertiesService.getScriptProperties();
    var live = props.getProperty('DRY_RUN') === 'false';
    var mark = Utilities.formatDate(now, TZ, 'yyyy-MM-dd') + (live ? ' live' : ' dry');
    if (props.getProperty('LAST_DISPATCH') === mark) { Logger.log('Already handed to GitHub today (' + mark + ').'); return; }

    // Throws unless GitHub accepts it; Apps Script then emails the failure to
    // the account, and the next 15-minute run tries again.
    dispatch_(props.getProperty('GITHUB_TOKEN'), !live);
    props.setProperty('LAST_DISPATCH', mark); // only after GitHub accepted it
    Logger.log('Birthday reminders started on GitHub (' + (live ? 'live' : 'dry run') + ').');
  } finally {
    lock.releaseLock();
  }
}

/** Start daily.yml. Throws unless GitHub answers 204. */
function dispatch_(token, dryRun) {
  if (!token) throw new Error('GITHUB_TOKEN is not set');
  var url = 'https://api.github.com/repos/' + REPO + '/actions/workflows/' + WORKFLOW + '/dispatches';
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    payload: JSON.stringify({ ref: REF, inputs: { dry_run: String(dryRun), caller: 'apps-script' } }),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 204) throw new Error('GitHub dispatch returned HTTP ' + res.getResponseCode());
}

/** Run once from the editor: replaces any old trigger with one every 15 minutes. */
function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'remindBirthdays') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('remindBirthdays').timeBased().everyMinutes(15).create();
  Logger.log('Trigger set: remindBirthdays every 15 minutes. DRY_RUN stays on until you set it to false.');
}

/** Check the token and the workflow from the editor: starts one dry run, which posts nothing. */
function testDispatch() {
  dispatch_(PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN'), true);
  Logger.log('GitHub accepted the dispatch. Look for a dry run under Actions > Birthday reminders.');
}
