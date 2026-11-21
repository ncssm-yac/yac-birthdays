// Runs the Apps Script code in Node with stubbed Google services. No dependencies.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const SRC = path.join(__dirname, '..', 'src');
const code = fs.readFileSync(path.join(SRC, 'Code.gs'), 'utf8');

// `nyTime` is the New York wall-clock time the stubbed Utilities.formatDate reports.
function world({ props = {}, nyTime = '2026-11-23 08:05', githubStatus = 204, locked = false } = {}) {
  const logs = [], fetches = [], triggers = [], deleted = [];
  const store = Object.assign({}, props);
  const [day, hm] = nyTime.split(' ');
  const ctx = vm.createContext({
    Logger: { log: (m) => logs.push(m) },
    LockService: { getScriptLock: () => ({ tryLock: () => !locked, releaseLock() {} }) },
    Utilities: { formatDate: (d, tz, fmt) => {
      assert.strictEqual(tz, 'America/New_York');
      if (fmt === 'H') return String(Number(hm.split(':')[0]));
      if (fmt === 'yyyy-MM-dd') return day;
      throw new Error('unexpected format ' + fmt);
    } },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (k) => (k in store ? store[k] : null),
      setProperty: (k, v) => { store[k] = v; }
    }) },
    UrlFetchApp: { fetch: (url, opts) => { fetches.push({ url, opts }); return { getResponseCode: () => githubStatus }; } },
    ScriptApp: {
      getProjectTriggers: () => [{ getHandlerFunction: () => 'remindBirthdays' }, { getHandlerFunction: () => 'other' }],
      deleteTrigger: (t) => deleted.push(t.getHandlerFunction()),
      newTrigger: (fn) => {
        const t = { fn };
        const b = { timeBased: () => b, everyMinutes: (n) => { t.minutes = n; return b; }, create: () => { triggers.push(t); return t; } };
        return b;
      }
    }
  });
  vm.runInContext(code, ctx, { filename: 'Code.gs' });
  return { ctx, logs, fetches, store, triggers, deleted };
}

const LIVE = { DRY_RUN: 'false', GITHUB_TOKEN: 't' };
const payload = (w, i = 0) => JSON.parse(w.fetches[i].opts.payload);

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('ok - ' + name); }

test('before 8 AM New York time it does nothing', () => {
  const w = world({ props: LIVE, nyTime: '2026-11-23 07:59' });
  w.ctx.remindBirthdays();
  assert.strictEqual(w.fetches.length, 0);
  assert.ok(!('LAST_DISPATCH' in w.store));
});

test('from 8 AM it starts daily.yml live, once a day', () => {
  const w = world({ props: LIVE, nyTime: '2026-11-23 08:00' });
  w.ctx.remindBirthdays();
  assert.strictEqual(w.fetches.length, 1);
  const f = w.fetches[0];
  assert.strictEqual(f.url, 'https://api.github.com/repos/ncssm-yac/yac-birthdays/actions/workflows/daily.yml/dispatches');
  assert.strictEqual(f.opts.method, 'post');
  assert.strictEqual(f.opts.headers.Authorization, 'Bearer t');
  assert.deepStrictEqual(payload(w), { ref: 'main', inputs: { caller: 'apps-script', dry_run: 'false' } });
  assert.strictEqual(w.store.LAST_DISPATCH, '2026-11-23 live');
  w.ctx.remindBirthdays(); // the 8:15 run
  assert.strictEqual(w.fetches.length, 1);
});

test('the next day it starts again', () => {
  const w = world({ props: Object.assign({ LAST_DISPATCH: '2026-11-22 live' }, LIVE) });
  w.ctx.remindBirthdays();
  assert.strictEqual(w.fetches.length, 1);
  assert.strictEqual(w.store.LAST_DISPATCH, '2026-11-23 live');
});

test('DRY_RUN is on unless set to exactly "false": starts a dry run', () => {
  [undefined, 'true', 'False', ''].forEach((v) => {
    const props = { GITHUB_TOKEN: 't' };
    if (v !== undefined) props.DRY_RUN = v;
    const w = world({ props });
    w.ctx.remindBirthdays();
    assert.strictEqual(payload(w).inputs.dry_run, 'true', String(v));
    assert.strictEqual(w.store.LAST_DISPATCH, '2026-11-23 dry');
  });
});

test('going live the same day as a dry run still starts the live run', () => {
  const w = world({ props: Object.assign({ LAST_DISPATCH: '2026-11-23 dry' }, LIVE) });
  w.ctx.remindBirthdays();
  assert.strictEqual(payload(w).inputs.dry_run, 'false');
});

test('a failed dispatch throws (so Apps Script emails it) and is retried next run', () => {
  const w = world({ props: LIVE, githubStatus: 401 });
  assert.throws(() => w.ctx.remindBirthdays(), /HTTP 401/);
  assert.ok(!('LAST_DISPATCH' in w.store));
  const again = world({ props: w.store });
  again.ctx.remindBirthdays();
  assert.strictEqual(again.store.LAST_DISPATCH, '2026-11-23 live');
});

test('a missing token throws and sends nothing', () => {
  const w = world({ props: { DRY_RUN: 'false' } });
  assert.throws(() => w.ctx.remindBirthdays(), /GITHUB_TOKEN is not set/);
  assert.strictEqual(w.fetches.length, 0);
});

test('a run already in progress is skipped', () => {
  const w = world({ props: LIVE, locked: true });
  w.ctx.remindBirthdays();
  assert.strictEqual(w.fetches.length, 0);
});

test('the request carries no birthday data: only the ref and two fixed inputs', () => {
  const w = world({ props: LIVE });
  w.ctx.remindBirthdays();
  assert.deepStrictEqual(Object.keys(payload(w)).sort(), ['inputs', 'ref']);
  assert.deepStrictEqual(Object.keys(payload(w).inputs).sort(), ['caller', 'dry_run']);
});

test('setup replaces only its own trigger with one every 15 minutes', () => {
  const w = world();
  w.ctx.setup();
  assert.deepStrictEqual(w.deleted, ['remindBirthdays']);
  assert.deepStrictEqual(w.triggers.map((t) => ({ fn: t.fn, minutes: t.minutes })), [{ fn: 'remindBirthdays', minutes: 15 }]);
});

test('testDispatch starts a dry run', () => {
  const w = world({ props: LIVE });
  w.ctx.testDispatch();
  assert.strictEqual(payload(w).inputs.dry_run, 'true');
});

test('testPostToIT starts a live sample run, which daily.yml sends to YAC IT', () => {
  const w = world({ props: { GITHUB_TOKEN: 't' } }); // DRY_RUN unset: the test post still goes out
  w.ctx.testPostToIT();
  assert.deepStrictEqual(payload(w), { ref: 'main', inputs: { caller: 'apps-script', dry_run: 'false', sample: 'true' } });
  assert.ok(!('LAST_DISPATCH' in w.store)); // does not count as the day's reminder
  const wf = fs.readFileSync(path.join(__dirname, '..', '..', '.github', 'workflows', 'daily.yml'), 'utf8');
  assert.ok(wf.includes("SPACE: ${{ inputs.sample == true && 'it' || 'leadership' }}"));
});

test('the manifest asks only for outside requests and triggers, in New York time', () => {
  const m = JSON.parse(fs.readFileSync(path.join(SRC, 'appsscript.json'), 'utf8'));
  assert.strictEqual(m.timeZone, 'America/New_York');
  assert.deepStrictEqual(m.oauthScopes.slice().sort(), [
    'https://www.googleapis.com/auth/script.external_request',
    'https://www.googleapis.com/auth/script.scriptapp'
  ]);
});

test('daily.yml accepts the inputs the script sends', () => {
  const wf = fs.readFileSync(path.join(__dirname, '..', '..', '.github', 'workflows', 'daily.yml'), 'utf8');
  const inputs = wf.slice(wf.indexOf('workflow_dispatch:'), wf.indexOf('\npermissions:'));
  ['dry_run:', 'sample:', 'caller:'].forEach((k) => assert.ok(inputs.includes(k), k + ' is not a daily.yml input'));
});

console.log(passed + ' Apps Script tests passed.');
