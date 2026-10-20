#!/usr/bin/env node
// Daily run: read the Member Directory, work out whose birthday is today or
// a week away, and hand one message to yac-chat. Inputs come from the
// environment:
//   SA_JSON    the yakkety service account key (secret)
//   SHEET_ID   the YAC Member Directory spreadsheet
//   SHEET_RANGE  optional, default Sheet1!A1:Z1000
//   SPACE      yac-chat space key, default "it"
//   TEST       "true" (default) marks the message TEST
//   DRY_RUN    "true" to work it out and print counts, sending nothing
//   GH_TOKEN   token that can dispatch post.yml in ncssm-yac/yac-chat
// Logs counts only, never names, dates or the message.
'use strict';

const crypto = require('crypto');
const { findDue, buildMessage, todayInNewYork } = require('./birthdays');

async function accessToken(saJson) {
  const sa = JSON.parse(saJson);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const jwt = unsigned + '.' + crypto.sign('RSA-SHA256', Buffer.from(unsigned), sa.private_key).toString('base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt
  });
  const j = await res.json();
  if (!j.access_token) throw new Error('Google sign-in failed: ' + (j.error_description || j.error));
  return j.access_token;
}

async function readRows(token, id, range) {
  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(id) + '/values/' + encodeURIComponent(range), {
    headers: { Authorization: 'Bearer ' + token }
  });
  if (!res.ok) throw new Error('Reading the Member Directory failed: ' + res.status);
  return (await res.json()).values || [];
}

async function dispatch(env, space, text) {
  const res = await fetch('https://api.github.com/repos/ncssm-yac/yac-chat/actions/workflows/post.yml/dispatches', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.GH_TOKEN, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: 'main', inputs: { space, source: 'yac-birthdays', text } })
  });
  if (res.status !== 204) throw new Error('Handing the post to yac-chat failed: ' + res.status);
}

async function main(env) {
  if (!env.SA_JSON || !env.SHEET_ID) throw new Error('SA_JSON and SHEET_ID are required.');
  const today = todayInNewYork();
  const rows = await readRows(await accessToken(env.SA_JSON), env.SHEET_ID, env.SHEET_RANGE || 'Sheet1!A1:Z1000');
  const due = findDue(rows, today);
  const text = buildMessage(due, today, { test: String(env.TEST || 'true') !== 'false' });
  console.log('Active members with a birthday: ' + (due.considered - due.skipped) + ' (' + due.skipped + ' active without a readable one).');
  console.log('Today: ' + due.today.length + ', one week out: ' + due.week.length + '.');
  if (!text) { console.log('Nothing to announce.'); return 'quiet'; }
  if (String(env.DRY_RUN) === 'true') { console.log('Dry run: would post, sending nothing.'); return 'dry'; }
  if (!env.GH_TOKEN) throw new Error('GH_TOKEN is required to post.');
  await dispatch(env, env.SPACE || 'it', text);
  console.log('Handed to yac-chat for ' + (env.SPACE || 'it') + '.');
  return 'posted';
}

if (require.main === module) {
  main(process.env).then((r) => {
    if (process.env.GITHUB_OUTPUT) require('fs').appendFileSync(process.env.GITHUB_OUTPUT, 'result=' + r + '\n');
  }, (e) => { console.error(e.message); process.exit(1); });
}

module.exports = { main };
