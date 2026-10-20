'use strict';
const assert = require('assert');
const { main } = require('./run');
const { VARIANTS, parseBirthday, daysUntil, findDue, buildMessage } = require('./birthdays');

let failed = 0;
const queue = [];
const test = (name, fn) => queue.push({ name, fn });
const d = (year, month, day) => ({ year, month, day });
const HEADER = ['', 'First Name', 'Last Name', 'Role', 'Birthday', 'Status'];
const row = (first, last, bday, status = 'Active') => ['', first, last, 'Member', bday, status];

test('parses month/day, with or without a year', () => {
  assert.deepStrictEqual(parseBirthday('12/16'), { month: 12, day: 16 });
  assert.deepStrictEqual(parseBirthday(' 3/7/1999 '), { month: 3, day: 7 });
  assert.deepStrictEqual(parseBirthday('2/29'), { month: 2, day: 29 });
});

test('rejects blanks, words and impossible dates', () => {
  ['', null, undefined, 'March 3', '13/1', '0/5', '4/31', '2/30', '6/0'].forEach((v) => assert.strictEqual(parseBirthday(v), null, String(v)));
});

test('counts days, including across the new year', () => {
  assert.strictEqual(daysUntil(d(2026, 10, 20), { month: 10, day: 20 }), 0);
  assert.strictEqual(daysUntil(d(2026, 10, 20), { month: 10, day: 27 }), 7);
  assert.strictEqual(daysUntil(d(2026, 12, 28), { month: 1, day: 4 }), 7);
  assert.strictEqual(daysUntil(d(2026, 10, 20), { month: 10, day: 19 }), 364);
});

test('a Feb 29 birthday is celebrated on Feb 28 in a non-leap year, Feb 29 in a leap year', () => {
  assert.strictEqual(daysUntil(d(2027, 2, 28), { month: 2, day: 29 }), 0);
  assert.strictEqual(daysUntil(d(2027, 2, 21), { month: 2, day: 29 }), 7);
  assert.strictEqual(daysUntil(d(2028, 2, 29), { month: 2, day: 29 }), 0);
  assert.strictEqual(daysUntil(d(2028, 2, 28), { month: 2, day: 29 }), 1);
});

test('finds today and one-week birthdays among Active members only', () => {
  const rows = [HEADER, row('Ada', 'Test', '10/20'), row('Ben', 'Sample', '10/27'), row('Cy', 'Demo', '10/21'),
    row('Dee', 'Gone', '10/20', 'Inactive'), row('Eli', 'Blank', ''), row('Fay', 'Typo', 'soon')];
  const due = findDue(rows, d(2026, 10, 20));
  assert.deepStrictEqual(due.today, ['Ada Test']);
  assert.deepStrictEqual(due.week, ['Ben Sample']);
  assert.strictEqual(due.skipped, 2);
});

test('finds columns by header name, in any order', () => {
  const rows = [['Status', 'Birthday', 'First Name'], ['Active', '1/4', 'Gus']];
  assert.deepStrictEqual(findDue(rows, d(2026, 12, 28)).week, ['Gus']);
});

test('a Sheet without the needed columns fails loudly', () => {
  assert.throws(() => findDue([['First Name', 'Status'], ['Hal', 'Active']], d(2026, 1, 1)), /Birthday/);
});

test('says nothing on a quiet day', () => {
  assert.strictEqual(buildMessage({ week: [], today: [] }, d(2026, 10, 20)), null);
});

const at = (i) => () => (i + 0.5) / VARIANTS.length; // picks variant i
const EMOJI = /\p{Extended_Pictographic}/gu;
const MIXED = { week: ['Ben Sample', 'Cy Demo'], today: ['Ada Test'] };

test('there are ten variants', () => {
  assert.strictEqual(VARIANTS.length, 10);
});

test('every variant follows the minutes-post shape, with two emojis', () => {
  VARIANTS.forEach((_, i) => {
    const msg = buildMessage(MIXED, d(2026, 10, 20), { test: true, pick: at(i) });
    const lines = msg.split('\n');
    assert.ok(lines[0].startsWith('*Yakkety here!*'), i + ' opener');
    assert.ok(lines[0].includes('(TEST)'), i + ' test tag');
    assert.ok(msg.includes('\u2022 Ada Test'), i + ' today bullet');
    assert.ok(msg.includes('\u2022 Ben Sample (Oct 27)') && msg.includes('\u2022 Cy Demo (Oct 27)'), i + ' week bullets');
    assert.strictEqual((msg.match(EMOJI) || []).length, 2, i + ' two emojis');
    assert.strictEqual((lines[0].match(EMOJI) || []).length, 1, i + ' one in the opener');
    assert.strictEqual((lines[lines.length - 1].match(EMOJI) || []).length, 1, i + ' one in the closer');
    lines.filter((l) => !l.startsWith('\u2022') && l !== lines[0] && l !== lines[lines.length - 1])
      .forEach((l) => assert.ok(l.endsWith(':'), i + ' section line leads into bullets: ' + l));
  });
});

test('every variant reads right for one person and for several, today and next week', () => {
  VARIANTS.forEach((_, i) => {
    [{ week: [], today: ['A One'] }, { week: [], today: ['A One', 'B Two'] }, { week: ['A One'], today: [] }, { week: ['A One', 'B Two'], today: [] }]
      .forEach((due) => {
        const msg = buildMessage(due, d(2026, 10, 20), { pick: at(i) });
        assert.ok(msg.includes('\u2022 A One'), i);
        assert.ok(!msg.includes('TEST'), i);
        assert.ok(!msg.includes('undefined'), i);
      });
  });
});

test('different picks give different messages, and the pick is random by default', () => {
  const texts = new Set(VARIANTS.map((_, i) => buildMessage(MIXED, d(2026, 10, 20), { pick: at(i) })));
  assert.strictEqual(texts.size, 10);
  const seen = new Set();
  for (let n = 0; n < 200; n += 1) seen.add(buildMessage(MIXED, d(2026, 10, 20)));
  assert.ok(seen.size > 5);
  assert.ok(buildMessage(MIXED, d(2026, 10, 20), { pick: () => 0.9999999 }));
});

test('only week-ahead people get the closing line for next week, not today', () => {
  VARIANTS.forEach((v, i) => {
    assert.ok(buildMessage({ week: ['A One'], today: [] }, d(2026, 10, 20), { pick: at(i) }).endsWith(v.closeWeek));
    assert.ok(buildMessage({ week: [], today: ['A One'] }, d(2026, 10, 20), { pick: at(i) }).endsWith(v.closeToday));
  });
});

test('a sample dry run touches no Sheet, key or network', async () => {
  const realFetch = global.fetch;
  global.fetch = () => { throw new Error('network used'); };
  try {
    assert.strictEqual(await main({ SAMPLE: 'true', DRY_RUN: 'true' }), 'dry');
  } finally { global.fetch = realFetch; }
});

test('a real sample needs a token and never counts as a real post', async () => {
  await assert.rejects(() => main({ SAMPLE: 'true', DRY_RUN: 'false' }), /GH_TOKEN/);
  const calls = [];
  const realFetch = global.fetch;
  global.fetch = async (url, opts) => { calls.push({ url, body: JSON.parse(opts.body) }); return { status: 204 }; };
  try {
    assert.strictEqual(await main({ SAMPLE: 'true', DRY_RUN: 'false', GH_TOKEN: 'x', SPACE: 'it' }), 'sample');
  } finally { global.fetch = realFetch; }
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].body.inputs.source, 'yac-birthdays');
  assert.strictEqual(calls[0].body.inputs.space, 'it');
  assert.ok(calls[0].body.inputs.text.includes('(TEST)') && calls[0].body.inputs.text.includes('Ada Test'));
});

// A whole run with Google and GitHub stubbed. `sheet` is the rows the Sheet
// returns; `post` is the status yac-chat's dispatch answers with. Captures
// every request and everything logged.
const { generateKeyPairSync } = require('crypto');
const KEY = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' });
const SA = JSON.stringify({ client_email: 'bot@example.iam.gserviceaccount.com', private_key: KEY });
async function fullRun(env, { sheet = [], post = 204, token = { access_token: 'tok' }, sheetStatus = 200 } = {}) {
  const calls = [], logs = [];
  const real = { fetch: global.fetch, log: console.log, now: Date.now };
  global.fetch = async (url, opts = {}) => {
    calls.push({ url, opts });
    if (url.startsWith('https://oauth2.googleapis.com/')) return { json: async () => token };
    if (url.startsWith('https://sheets.googleapis.com/')) return { ok: sheetStatus === 200, status: sheetStatus, json: async () => ({ values: sheet }) };
    if (url.startsWith('https://api.github.com/')) return { status: post };
    throw new Error('unexpected host ' + url);
  };
  console.log = (...a) => logs.push(a.join(' '));
  let result, error;
  try { result = await main({ SA_JSON: SA, SHEET_ID: 'sheet-id', ...env }); } catch (e) { error = e; }
  finally { global.fetch = real.fetch; console.log = real.log; }
  return { result, error, calls, logs };
}
const nyToday = () => require('./birthdays').todayInNewYork();
const md = (plus) => { const t = nyToday(); const x = new Date(Date.UTC(t.year, t.month - 1, t.day + plus)); return (x.getUTCMonth() + 1) + '/' + x.getUTCDate(); };
const DUE_SHEET = () => [HEADER, row('Ada', 'Test', md(0)), row('Ben', 'Sample', md(7) + '/1990')];

test('a real run posts once to yac-chat as yac-birthdays, marked TEST by default', async () => {
  const { result, error, calls } = await fullRun({ GH_TOKEN: 'gh' }, { sheet: DUE_SHEET() });
  assert.ifError(error);
  assert.strictEqual(result, 'posted');
  const posts = calls.filter((c) => c.url.startsWith('https://api.github.com/'));
  assert.strictEqual(posts.length, 1);
  assert.strictEqual(posts[0].url, 'https://api.github.com/repos/ncssm-yac/yac-chat/actions/workflows/post.yml/dispatches');
  const body = JSON.parse(posts[0].opts.body);
  assert.deepStrictEqual([body.ref, body.inputs.source, body.inputs.space], ['main', 'yac-birthdays', 'it']);
  assert.ok(body.inputs.text.includes('(TEST)') && body.inputs.text.includes('• Ada Test') && body.inputs.text.includes('• Ben Sample ('));
});

test('only TEST=false drops the TEST tag', async () => {
  const off = await fullRun({ GH_TOKEN: 'gh', TEST: 'false' }, { sheet: DUE_SHEET() });
  const on = await fullRun({ GH_TOKEN: 'gh', TEST: 'no' }, { sheet: DUE_SHEET() });
  const text = (r) => JSON.parse(r.calls.find((c) => c.url.startsWith('https://api.github.com/')).opts.body).inputs.text;
  assert.ok(!text(off).includes('TEST'));
  assert.ok(text(on).includes('(TEST)'));
});

test('logs show counts only: no names, birthdays, message or secrets', async () => {
  for (const env of [{ GH_TOKEN: 'gh-secret' }, { DRY_RUN: 'true' }]) {
    const { logs } = await fullRun(env, { sheet: DUE_SHEET() });
    const out = logs.join('\n');
    ['Ada', 'Test', 'Ben', 'Sample', md(0), md(7), 'Yakkety here', 'gh-secret', 'tok', 'PRIVATE KEY'].forEach((s) => assert.ok(!out.includes(s), JSON.stringify(env) + ' leaked ' + s));
    assert.ok(/Today: 1, one week out: 1\./.test(out));
  }
});

test('reads the Sheet read-only and calls only Google sign-in, Sheets and yac-chat', async () => {
  const { calls } = await fullRun({ GH_TOKEN: 'gh' }, { sheet: DUE_SHEET() });
  calls.forEach((c) => assert.ok(/^https:\/\/(oauth2\.googleapis\.com\/token$|sheets\.googleapis\.com\/v4\/spreadsheets\/sheet-id\/values\/|api\.github\.com\/repos\/ncssm-yac\/yac-chat\/)/.test(c.url), c.url));
  const sheetCall = calls.find((c) => c.url.startsWith('https://sheets.googleapis.com/'));
  assert.ok(!sheetCall.opts.method || sheetCall.opts.method === 'GET', 'the Sheet is only read');
  const jwt = new URLSearchParams(calls[0].opts.body).get('assertion');
  assert.strictEqual(JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url')).scope, 'https://www.googleapis.com/auth/spreadsheets.readonly');
});

test('a dry run reads the Sheet but never posts', async () => {
  const { result, calls } = await fullRun({ DRY_RUN: 'true', GH_TOKEN: 'gh' }, { sheet: DUE_SHEET() });
  assert.strictEqual(result, 'dry');
  assert.ok(!calls.some((c) => c.url.startsWith('https://api.github.com/')));
});

test('a quiet day posts nothing and is not reported as posted', async () => {
  const { result, calls } = await fullRun({ GH_TOKEN: 'gh' }, { sheet: [HEADER, row('Cy', 'Demo', md(3))] });
  assert.strictEqual(result, 'quiet');
  assert.ok(!calls.some((c) => c.url.startsWith('https://api.github.com/')));
});

test('an empty Sheet fails loudly instead of passing as a quiet day', async () => {
  const { error, calls } = await fullRun({ GH_TOKEN: 'gh' }, { sheet: [] });
  assert.ok(error && /Birthday/.test(error.message));
  assert.ok(!calls.some((c) => c.url.startsWith('https://api.github.com/')));
});

test('failures stop the run with a plain reason and no post', async () => {
  const missing = await fullRun({ SA_JSON: '', GH_TOKEN: 'gh' });
  assert.ok(/SA_JSON and SHEET_ID/.test(missing.error.message) && !missing.calls.length);
  const signIn = await fullRun({ GH_TOKEN: 'gh' }, { token: { error: 'invalid_grant' } });
  assert.ok(/Google sign-in failed: invalid_grant/.test(signIn.error.message));
  const sheet = await fullRun({ GH_TOKEN: 'gh' }, { sheetStatus: 403 });
  assert.ok(/Member Directory failed: 403/.test(sheet.error.message));
  [signIn, sheet].forEach((r) => assert.ok(!r.calls.some((c) => c.url.startsWith('https://api.github.com/'))));
  const noToken = await fullRun({}, { sheet: DUE_SHEET() });
  assert.ok(/GH_TOKEN/.test(noToken.error.message));
  const refused = await fullRun({ GH_TOKEN: 'gh' }, { sheet: DUE_SHEET(), post: 403 });
  assert.ok(/yac-chat failed: 403/.test(refused.error.message) && refused.result === undefined, 'a refused post is not "posted"');
});

test('Status is matched case-insensitively; rows with no first name are left out', () => {
  const rows = [HEADER, row('Ada', 'Test', '10/20', ' ACTIVE '), row('', 'Nofirst', '10/20'), row('Ben', '', '10/20')];
  const due = findDue(rows, d(2026, 10, 20));
  assert.deepStrictEqual(due.today, ['Ada Test', 'Ben']);
  assert.strictEqual(due.considered, 2);
});

test('works without a Last Name column', () => {
  assert.deepStrictEqual(findDue([['First Name', 'Birthday', 'Status'], ['Gus', '10/20', 'Active']], d(2026, 10, 20)).today, ['Gus']);
});

test('the week-ahead date is right across month and year ends', () => {
  const msg = (today) => buildMessage({ week: ['A One'], today: [] }, today, { pick: at(0) });
  assert.ok(msg(d(2026, 12, 28)).includes('• A One (Jan 4)'));
  assert.ok(msg(d(2027, 2, 25)).includes('• A One (Mar 4)'));
  assert.ok(msg(d(2028, 2, 25)).includes('• A One (Mar 3)'));
});

test('today is the New York date, not the UTC one', () => {
  const { todayInNewYork } = require('./birthdays');
  assert.deepStrictEqual(todayInNewYork(new Date('2026-10-21T02:30:00Z')), d(2026, 10, 20));
  assert.deepStrictEqual(todayInNewYork(new Date('2026-12-31T23:30:00Z')), d(2026, 12, 31));
  assert.deepStrictEqual(todayInNewYork(new Date('2027-01-01T05:30:00Z')), d(2027, 1, 1));
});

test('workflow: posts as TEST to YAC IT, and only a real post marks the day done', () => {
  const wf = require('fs').readFileSync(require('path').join(__dirname, '.github', 'workflows', 'daily.yml'), 'utf8');
  assert.ok(/^\s*SPACE: it$/m.test(wf) && /^\s*TEST: 'true'$/m.test(wf), 'test phase: YAC IT, marked TEST');
  const saves = wf.split('\n').filter((l) => /if: .*steps\.remind\.outputs\.result/.test(l));
  assert.strictEqual(saves.length, 2);
  saves.forEach((l) => assert.ok(l.trim() === "if: steps.remind.outputs.result == 'posted'", l));
  assert.ok(/DRY_RUN: \$\{\{ github\.event_name == 'workflow_dispatch' && inputs\.dry_run \|\| 'false' \}\}/.test(wf));
});

(async () => {
  for (const { name, fn } of queue) {
    try { await fn(); console.log('PASS ' + name); } catch (e) { failed += 1; console.log('FAIL ' + name + '\n  ' + e.message); }
  }
  console.log('\n' + (queue.length - failed) + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
