/**
 * Birthday reminders: 8 AM trigger.
 *
 * GitHub starts the daily.yml schedule hours late (1-3 PM Eastern in
 * November 2026), so the reminders landed in the afternoon. This Apps Script
 * starts the workflow at 8 AM New York time instead, through
 * workflow_dispatch, which GitHub runs within about a minute. The GitHub
 * schedule stays as a backup; the workflow's cache stops a second post.
 *
 * Lives in ncssm.yac.yakkety@gmail.com, next to the notes trigger. Plain
 * code: no Google data is read and nothing about any person is sent. The
 * only call is the dispatch, with dry_run=false.
 *
 * Setup (once):
 *   1. Script properties: GITHUB_TOKEN = a fine-grained token with
 *      Actions: read and write on ncssm-yac/yac-birthdays only.
 *   2. Project settings: time zone America/New_York.
 *   3. Run install() once from the editor. It replaces any earlier trigger.
 *
 * Scopes: script.external_request (UrlFetchApp), script.scriptapp (triggers).
 */

var REPO = 'ncssm-yac/yac-birthdays';
var WORKFLOW = 'daily.yml';
var HOUR = 8;

/** Creates the daily 8 AM trigger. Safe to run again. */
function install() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'dispatch') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dispatch')
    .timeBased()
    .atHour(HOUR)
    .nearMinute(0)
    .everyDays(1)
    .inTimezone('America/New_York')
    .create();
}

/** Asks GitHub to run the reminders now, for real. Retries twice. */
function dispatch() {
  var token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('GITHUB_TOKEN script property is not set.');
  var url = 'https://api.github.com/repos/' + REPO + '/actions/workflows/' + WORKFLOW + '/dispatches';
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    payload: JSON.stringify({ ref: 'main', inputs: { dry_run: 'false', sample: 'false' } }),
    muteHttpExceptions: true
  };
  var code = 0;
  for (var attempt = 1; attempt <= 3; attempt++) {
    code = UrlFetchApp.fetch(url, options).getResponseCode();
    if (code === 204) {
      console.log('Dispatched ' + WORKFLOW + ' (attempt ' + attempt + ').');
      return code;
    }
    console.warn('Dispatch got HTTP ' + code + ' (attempt ' + attempt + ').');
    if (attempt < 3) Utilities.sleep(30000);
  }
  // A thrown error makes Apps Script email the script owner; the GitHub
  // schedule still runs later as a backup.
  throw new Error('Could not start ' + WORKFLOW + ': HTTP ' + code);
}

if (typeof module !== 'undefined') module.exports = { install: install, dispatch: dispatch, REPO: REPO, WORKFLOW: WORKFLOW, HOUR: HOUR };
