'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'views/partials/scripts.html'), 'utf8');

function fn(name) {
  const match = source.match(new RegExp('\\n  function ' + name + '\\([\\s\\S]*?\\n  \\}\\n'));
  assert.ok(match, name);
  return match[0];
}
// `  const name = ...;` — one line, or a block arrow closed by `  };`.
function constDecl(name) {
  const start = source.indexOf('\n  const ' + name + ' = ');
  assert.ok(start !== -1, name);
  const lineEnd = source.indexOf('\n', start + 1);
  const firstLine = source.slice(start, lineEnd);
  if (!/\{\s*$/.test(firstLine)) return firstLine + '\n';
  const end = source.indexOf('\n  };', start);
  return source.slice(start, end + 5) + '\n';
}

// The client's leave-balance and projection maths, run against a pinned "today" (local time).
function client(options = {}) {
  const now = new Date(2026, 7, 14, 10, 0).getTime(); // Fri 14 Aug 2026
  class FixedDate extends Date {
    constructor(...args) { if (args.length) super(...args); else super(now); }
    static now() { return now; }
  }
  const flags = Object.assign({ leave_balance_card: true, expected_monthly_hours: true, enable_public_holidays: false }, options.flags);
  const incomeTypes = new Set(['work']);
  const context = {
    Date: FixedDate,
    state: {
      settings: Object.assign({ target_hours_per_day: 7.5 }, options.settings),
      hourTypes: [{ id: 'work', counts_as_leave: false }, { id: 'leave', counts_as_leave: true }],
      contracts: options.contracts || [],
      entries: options.entries || [],
      publicHolidayMap: options.publicHolidayMap || null
    },
    getFeatureFlag: (key) => !!flags[key],
    entryContributesToIncome: (e) => !!(e && e.date) && incomeTypes.has(e.hour_type_id)
  };
  const script = [
    "const ISO_DATE_PATTERN = /^\\d{4}-\\d{2}-\\d{2}$/;",
    fn('normalizeDateInput'), constDecl('isoDate'), constDecl('parseIsoDate'), constDecl('startOfDay'), constDecl('isWeekendDate'),
    fn('collectBusinessDays'), fn('calculateProRatedMonths'), constDecl('getEntryDateIso'),
    constDecl('DEFAULT_TARGET_HOURS_PER_DAY'), constDecl('getTargetHoursPerDay'),
    constDecl('DEFAULT_LEAVE_ALLOWANCE_DAYS'), constDecl('normalizeLeaveAllowanceDays'), constDecl('getLeaveAllowanceDays'),
    fn('getLeaveHourTypeIds'), fn('entryIsLeave'), fn('formatLeaveSpan'), fn('buildLeaveBankSummary'),
    fn('collectFutureLeaveDayHours'), fn('isFullLeaveDay'), fn('avProjectionDailyHours'),
    'this.api = { normalizeLeaveAllowanceDays, getLeaveAllowanceDays, formatLeaveSpan, buildLeaveBankSummary, collectFutureLeaveDayHours, isFullLeaveDay, avProjectionDailyHours, parseIsoDate };'
  ].join('\n');
  vm.runInNewContext(script, context, { filename: 'scripts.html (leave balance)' });
  return context;
}

// 1 Jul – 30 Sep 2026, 450 h cap → 150 h/month quota. July has 23 business days, August 21 (10 by Fri 14th).
const CONTRACT = { id: 'c1', name: 'Acme', start_date: '2026-07-01', end_date: '2026-09-30', total_hours: 450, standard_hours_per_day: 7.5 };
const work = (date, hours) => ({ id: 'w-' + date, date, contract_id: 'c1', hour_type_id: 'work', duration_minutes: hours * 60 });
const leave = (date, hours) => ({ id: 'l-' + date, date, hour_type_id: 'leave', duration_minutes: hours * 60 });
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-6, `${message}: ${actual} vs ${expected}`);

exports.run = function run(test) {
  test('leave allowance: blank or invalid falls back to 20 days, an explicit 0 is kept', () => {
    const { api, state } = client();
    ['', '   ', undefined, null, 'abc', '-3'].forEach((value) => assert.equal(api.normalizeLeaveAllowanceDays(value), 20, String(value)));
    assert.equal(api.normalizeLeaveAllowanceDays('0'), 0);
    assert.equal(api.normalizeLeaveAllowanceDays('12.5'), 12.5);
    state.settings.leave_allowance_days = '';
    assert.equal(api.getLeaveAllowanceDays(), 20);
    state.settings.leave_allowance_days = 0;
    assert.equal(api.getLeaveAllowanceDays(), 0);
  });

  test('leave span reads hours as 5-day weeks of the standard day', () => {
    const { api } = client();
    assert.equal(api.formatLeaveSpan(0, 7.5), '0 days');
    assert.equal(api.formatLeaveSpan(7.5, 7.5), '1 day');
    assert.equal(api.formatLeaveSpan(18.75, 7.5), '2.5 days');
    assert.equal(api.formatLeaveSpan(37.5, 7.5), '1 wk');
    assert.equal(api.formatLeaveSpan(-45, 7.5), '1 wk 1 day', 'a shortfall is shown by magnitude');
    assert.equal(api.formatLeaveSpan(150, 0), '4 wks', 'a missing day length falls back to 7.5 h');
  });

  test('leave balance banks committed hours ahead of the monthly quota owed so far', () => {
    const { api } = client({ contracts: [CONTRACT], entries: [work('2026-07-15', 160), work('2026-08-10', 80)] });
    const summary = api.buildLeaveBankSummary();
    const owed = 150 + 150 * 10 / 21; // July in full + 10 of August's 21 business days
    close(summary.rows[0].expectedToDate, owed, 'quota owed');
    close(summary.banked, 240 - owed, 'banked');
    assert.equal(summary.allowanceDays, 20);
    assert.equal(summary.allowanceHours, 150);
    assert.equal(summary.leaveTypesConfigured, true);
  });

  test('leave balance goes negative when behind pace', () => {
    const { api } = client({ contracts: [CONTRACT], entries: [work('2026-07-15', 150), work('2026-08-10', 50)] });
    close(api.buildLeaveBankSummary().banked, 200 - (150 + 150 * 10 / 21), 'short');
  });

  test('a prefilled future day is credited and charged its share of quota', () => {
    const base = [work('2026-07-15', 160), work('2026-08-10', 80)];
    const before = client({ contracts: [CONTRACT], entries: base }).api.buildLeaveBankSummary().banked;
    const after = client({ contracts: [CONTRACT], entries: base.concat(work('2026-08-17', 7.5)) }).api.buildLeaveBankSummary().banked;
    close(after - before, 7.5 - 150 / 21, 'prefilled day nets hours minus its quota share');
  });

  test('taken and planned leave count only working days inside the contract', () => {
    const { api } = client({
      flags: { enable_public_holidays: true },
      publicHolidayMap: { '2026-08-21': true },
      contracts: [CONTRACT],
      entries: [
        work('2026-07-15', 160),
        leave('2026-08-12', 7.5), // taken
        leave('2026-08-15', 7.5), // Saturday — costs nothing
        leave('2026-08-20', 7.5), // planned
        leave('2026-08-21', 7.5), // public holiday — costs nothing
        leave('2026-10-05', 7.5)  // after the contract
      ]
    });
    const summary = api.buildLeaveBankSummary();
    assert.equal(summary.takenLeaveHours, 7.5);
    assert.equal(summary.plannedLeaveHours, 7.5);
    // Aug 17 – Sep 30 is 33 business days; the 21st is a holiday and the 20th is marked leave.
    close(summary.rows[0].availableFutureDays, 31, 'free days left');
  });

  test('a single contract measures the allowance in its own standard day', () => {
    const { api } = client({ contracts: [Object.assign({}, CONTRACT, { standard_hours_per_day: 8 })], entries: [work('2026-07-15', 160)] });
    const summary = api.buildLeaveBankSummary();
    assert.equal(summary.std, 8);
    assert.equal(summary.allowanceHours, 160);
  });

  test('leave balance hides without its flags, an active capped contract, or a dated window', () => {
    assert.equal(client({ flags: { leave_balance_card: false }, contracts: [CONTRACT] }).api.buildLeaveBankSummary(), null);
    assert.equal(client({ flags: { expected_monthly_hours: false }, contracts: [CONTRACT] }).api.buildLeaveBankSummary(), null);
    assert.equal(client({ contracts: [Object.assign({}, CONTRACT, { total_hours: 0 })] }).api.buildLeaveBankSummary(), null);
    assert.equal(client({ contracts: [Object.assign({}, CONTRACT, { end_date: '' })] }).api.buildLeaveBankSummary(), null);
    assert.equal(client({ contracts: [Object.assign({}, CONTRACT, { end_date: '2026-08-01' })] }).api.buildLeaveBankSummary(), null, 'ended contract');
  });

  test('future leave days are collected by date and only full days count as days off', () => {
    const { api } = client({ entries: [leave('2026-08-14', 7.5), leave('2026-08-20', 4), leave('2026-08-20', 3.5), leave('2026-08-24', 3), work('2026-08-25', 7.5)] });
    const map = api.collectFutureLeaveDayHours();
    assert.deepStrictEqual(Object.assign({}, map), { '2026-08-20': 7.5, '2026-08-24': 3 }, 'today and earlier are excluded');
    assert.equal(api.isFullLeaveDay(map, '2026-08-20', 7.5), true);
    assert.equal(api.isFullLeaveDay(map, '2026-08-24', 7.5), false);
    assert.equal(api.isFullLeaveDay(map, '2026-08-24', 3), true);
  });

  test('projection pace skips full leave days and never exceeds a standard day', () => {
    const { api, state } = client({ entries: [work('2026-07-15', 240)] });
    const paceStart = api.parseIsoDate('2026-08-17');
    const cEnd = api.parseIsoDate('2026-09-30');
    // 210 h left over 33 business days.
    close(api.avProjectionDailyHours(CONTRACT, 7.5, paceStart, cEnd, null, {}), 210 / 33, 'no leave');
    const leaveMap = { '2026-08-20': 7.5, '2026-08-21': 7.5, '2026-08-24': 3 };
    close(api.avProjectionDailyHours(CONTRACT, 7.5, paceStart, cEnd, null, leaveMap), 210 / 31, 'two full leave days removed, partial kept');
    state.entries = [work('2026-07-15', 150)];
    assert.equal(api.avProjectionDailyHours(CONTRACT, 7.5, paceStart, cEnd, null, leaveMap), 7.5, 'capped at a standard day');
  });
};
