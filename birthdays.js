'use strict';
// Pure date logic and message text. No network, no secrets.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "12/16" or "12/16/1999" -> { month: 12, day: 16 }; anything else -> null.
// The year, if present, is ignored.
function parseBirthday(raw) {
  const m = /^\s*(\d{1,2})\s*[/-]\s*(\d{1,2})(?:\s*[/-]\s*\d{2,4})?\s*$/.exec(String(raw || ''));
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1) return null;
  const longest = new Date(Date.UTC(2024, month, 0)).getUTCDate(); // 2024 is a leap year
  return day > longest ? null : { month, day };
}

const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

// Where a birthday falls in a given year. Feb 29 is kept on Feb 28 in non-leap years.
function onYear(b, year) {
  const day = b.month === 2 && b.day === 29 && !isLeap(year) ? 28 : b.day;
  return Date.UTC(year, b.month - 1, day);
}

// Whole days from `today` ({year, month, day}) to the next occurrence of b (0 = today).
function daysUntil(today, b) {
  const t = Date.UTC(today.year, today.month - 1, today.day);
  let next = onYear(b, today.year);
  if (next < t) next = onYear(b, today.year + 1);
  return Math.round((next - t) / 86400000);
}

// Today's date in New York as {year, month, day}.
function todayInNewYork(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'numeric', day: 'numeric' })
    .formatToParts(now);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

// Rows are arrays; the first row is the header. Columns are found by name, so
// reordering the Sheet doesn't break the run. Only Active members with a
// readable birthday count.
function findDue(rows, today) {
  const header = (rows[0] || []).map((h) => String(h || '').trim().toLowerCase());
  const col = (name) => header.indexOf(name);
  const iFirst = col('first name');
  const iLast = col('last name');
  const iBirthday = col('birthday');
  const iStatus = col('status');
  if (iFirst < 0 || iBirthday < 0 || iStatus < 0) {
    throw new Error('The Sheet needs First Name, Birthday and Status columns.');
  }
  const out = { week: [], today: [], skipped: 0, considered: 0 };
  rows.slice(1).forEach((r) => {
    if (String(r[iStatus] || '').trim().toLowerCase() !== 'active') return;
    const first = String(r[iFirst] || '').trim();
    if (!first) return;
    out.considered += 1;
    const b = parseBirthday(r[iBirthday]);
    if (!b) { out.skipped += 1; return; }
    const name = iLast >= 0 && String(r[iLast] || '').trim() ? first + ' ' + String(r[iLast]).trim() : first;
    const d = daysUntil(today, b);
    if (d === 0) out.today.push(name);
    else if (d === 7) out.week.push(name);
  });
  out.week.sort();
  out.today.sort();
  return out;
}

const label = (today, plusDays) => {
  const t = new Date(Date.UTC(today.year, today.month - 1, today.day + plusDays));
  return MONTHS[t.getUTCMonth()] + ' ' + t.getUTCDate();
};

// Same shape as Yakkety's meeting-minutes posts: "*Yakkety here!*" opener,
// one bullet per person, a closing line. Goofy on purpose. null when there is
// nothing to say.
function buildMessage(due, today, { test = false } = {}) {
  if (!due.week.length && !due.today.length) return null;
  const one = (n) => n === 1;
  const lines = [];
  lines.push('*Yakkety here!* \u{1F9AC}\u{1F389}' + (test ? ' _(TEST)_' : ''));
  if (due.today.length) {
    lines.push(one(due.today.length)
      ? 'Stop the herd, it\'s a birthday TODAY! \u{1F382}\u{1F973}'
      : 'Stop the herd, we have birthdays TODAY! \u{1F382}\u{1F973}');
    due.today.forEach((n) => lines.push('\u2022 \u{1F388} ' + n));
  }
  if (due.week.length) {
    lines.push(one(due.week.length)
      ? 'Heads up, herd: a birthday is galloping our way in one week! \u{1F43E}\u{1F381}'
      : 'Heads up, herd: birthdays are galloping our way in one week! \u{1F43E}\u{1F381}');
    due.week.forEach((n) => lines.push('\u2022 \u{1F389} ' + n + ' (' + label(today, 7) + ')'));
  }
  lines.push(due.today.length
    ? 'A quick cheer or a "happy birthday" would be yak-tastic! \u{1F4AC}\u{1F389}'
    : 'Time to start planning some yak-tastic wishes! \u{1F4AC}\u{1F389}');
  return lines.join('\n');
}

module.exports = { parseBirthday, daysUntil, todayInNewYork, findDue, buildMessage };
