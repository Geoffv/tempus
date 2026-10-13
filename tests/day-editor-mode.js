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

// A parent node that keeps child order, enough for insertBefore-based reordering.
function fakeSection(label) { return { label, style: { display: '' }, parentNode: null }; }
function fakeCard(children) {
  const card = {
    children,
    insertBefore(node, ref) {
      const from = card.children.indexOf(node);
      if (from !== -1) card.children.splice(from, 1);
      card.children.splice(card.children.indexOf(ref), 0, node);
    }
  };
  children.forEach((child) => { child.parentNode = card; });
  return card;
}

// Day editor surface: entry modes come from `modes`, Settings › Default entry mode from `globalMode`.
function client({ modes, globalMode }) {
  const sessions = fakeSection('sessions');
  const duration = fakeSection('duration');
  const details = fakeSection('details');
  const card = fakeCard([sessions, duration, details]);
  const c = {
    state: { selectedCalendarDate: '', entries: [], settings: { default_entry_mode: globalMode } },
    dayEntryModes: () => Object.assign({ both: !!(modes.simple && modes.detailed) }, modes),
    renderDaySessionsTimeline: () => {}, renderDayDurationEntries: () => {}, renderDayLevelActions: () => {}, updateDayClockToggle: () => {},
    document: {
      querySelector: (selector) => (/day-sessions-title/.test(selector) ? sessions : /day-duration-title/.test(selector) ? duration : null),
      activeElement: null
    },
    drafts: [], sessionEdits: [],
    beginDayDurationDraft: (entry) => { c.drafts.push(entry); },
    enterDaySessionEdit: (id) => { c.sessionEdits.push(id); },
    resolveEntryType: (entry) => entry.entry_type,
    entryPunches: (entry) => entry.punches || [],
    getDefaultHourTypeId: () => 'work',
    parkDayDurationEditor: () => {}, setManualDate: () => {}, updateTabStates: () => {}, renderCalendar: () => {},
    openDayModal: () => { c.renderDayEditor(c.state.selectedCalendarDate); }
  };
  ['getGlobalDefaultEntryMode', 'dayLeadEntryMode', 'renderDayEditor', 'handleCalendarClick'].forEach((name) => vm.runInNewContext(fn(name), c));
  c.order = () => card.children.map((child) => child.label);
  c.sessions = sessions;
  return c;
}

exports.run = function run(test) {
  test('day editor lead mode: a single-mode day follows that mode, a mixed day follows Default entry mode', () => {
    assert.equal(client({ modes: { simple: true, detailed: false }, globalMode: 'detailed' }).dayLeadEntryMode('2026-09-08'), 'simple');
    assert.equal(client({ modes: { simple: false, detailed: true }, globalMode: 'simple' }).dayLeadEntryMode('2026-09-08'), 'detailed');
    assert.equal(client({ modes: { simple: true, detailed: true }, globalMode: 'simple' }).dayLeadEntryMode('2026-09-08'), 'simple');
    assert.equal(client({ modes: { simple: true, detailed: true }, globalMode: 'detailed' }).dayLeadEntryMode('2026-09-08'), 'detailed');
    assert.equal(client({ modes: { simple: true, detailed: true }, globalMode: '' }).dayLeadEntryMode('2026-09-08'), 'simple', 'unset default is Simple');
  });

  test('Simple days lead with Duration Entries and hide sessions; Detailed days keep sessions on top', () => {
    const simpleOnly = client({ modes: { simple: true, detailed: false }, globalMode: 'simple' });
    simpleOnly.renderDayEditor('2026-09-08');
    assert.deepStrictEqual(simpleOnly.order(), ['duration', 'sessions', 'details']);
    assert.equal(simpleOnly.sessions.style.display, 'none');

    const mixed = client({ modes: { simple: true, detailed: true }, globalMode: 'simple' });
    mixed.renderDayEditor('2026-09-08');
    assert.deepStrictEqual(mixed.order(), ['duration', 'sessions', 'details']);
    assert.equal(mixed.sessions.style.display, '', 'a mixed day still shows its sessions');

    const detailed = client({ modes: { simple: true, detailed: true }, globalMode: 'detailed' });
    detailed.renderDayEditor('2026-09-08');
    assert.deepStrictEqual(detailed.order(), ['sessions', 'duration', 'details']);
  });

  test('re-rendering a day after switching mode restores Detailed order', () => {
    const c = client({ modes: { simple: true, detailed: false }, globalMode: 'simple' });
    c.renderDayEditor('2026-09-08');
    c.dayEntryModes = () => ({ simple: false, detailed: true, both: false });
    vm.runInNewContext(fn('dayLeadEntryMode') + fn('renderDayEditor'), c);
    c.renderDayEditor('2026-09-09');
    assert.deepStrictEqual(c.order(), ['sessions', 'duration', 'details']);
    assert.equal(c.sessions.style.display, '');
  });

  test('clicking a Simple day opens the add-duration editor; Detailed days and targeted entries do not', () => {
    const simple = client({ modes: { simple: true, detailed: false }, globalMode: 'simple' });
    simple.handleCalendarClick('2026-09-08');
    assert.deepStrictEqual(simple.drafts, [null], 'add editor opened');

    const detailed = client({ modes: { simple: false, detailed: true }, globalMode: 'detailed' });
    detailed.handleCalendarClick('2026-09-08');
    assert.deepStrictEqual(detailed.drafts, []);

    const targeted = client({ modes: { simple: true, detailed: false }, globalMode: 'simple' });
    const existing = { id: 'e1', date: '2026-09-08', entry_type: 'basic', hour_type_id: 'work' };
    targeted.state.entries = [existing];
    targeted.handleCalendarClick('2026-09-08', null, 'e1');
    assert.deepStrictEqual(targeted.drafts, [existing], 'the targeted entry opens, not a blank add');
  });
};

exports.runClose = function runClose(test) {
  function closer({ lead, open = true, date = '2026-09-08', selected = '2026-09-08' }) {
    const c = {
      state: { selectedCalendarDate: selected },
      document: { getElementById: () => ({ style: { display: open ? 'flex' : 'none' } }) },
      dayLeadEntryMode: () => lead,
      closed: 0,
      closeDayModal: () => { c.closed += 1; return Promise.resolve(true); }
    };
    vm.runInNewContext('let dayDurationSaveKeepsDayOpen = false;\n' + fn('isDayModalOpenFor') + fn('closeSimpleDayAfterDurationSave')
      + '\nthis.keepOpen = (v) => { dayDurationSaveKeepsDayOpen = v; };', c);
    c.date = date;
    return c;
  }

  test('saving a duration on a Simple day closes the day; Detailed days and section-switch saves stay open', () => {
    const simple = closer({ lead: 'simple' });
    assert.equal(simple.closeSimpleDayAfterDurationSave(simple.date), true);
    assert.equal(simple.closed, 1);

    const detailed = closer({ lead: 'detailed' });
    assert.equal(detailed.closeSimpleDayAfterDurationSave(detailed.date), false);
    assert.equal(detailed.closed, 0);

    const switching = closer({ lead: 'simple' });
    switching.keepOpen(true);
    assert.equal(switching.closeSimpleDayAfterDurationSave(switching.date), false, 'switch-save keeps the day open');

    const notOpen = closer({ lead: 'simple', open: false });
    assert.equal(notOpen.closeSimpleDayAfterDurationSave(notOpen.date), false, 'context-menu quick fills with no day open');

    const otherDay = closer({ lead: 'simple', selected: '2026-09-09' });
    assert.equal(otherDay.closeSimpleDayAfterDurationSave(otherDay.date), false);
  });

  test('a section-switch save marks the save as keep-open and always clears the flag', () => {
    const body = source.slice(source.indexOf('async function settleDurationDraftForSwitch('), source.indexOf('async function settleSessionDraftForSwitch('));
    assert.ok(body.length > 0, 'settleDurationDraftForSwitch');
    assert.ok(/dayDurationSaveKeepsDayOpen = true;\s*try \{ manualSaveBtn\.click\(\); \} finally \{ dayDurationSaveKeepsDayOpen = false; \}/.test(body));
    const handler = source.slice(source.indexOf('manualSaveBtn.onclick = async function'), source.indexOf('manualCancelBtn.onclick = function'));
    assert.ok(!/\bawait\b/.test(handler), 'the save handler must stay synchronous for the keep-open flag to cover it');
    assert.ok(/closeSimpleDayAfterDurationSave\(state\.selectedCalendarDate\);\s*\};$/.test(handler.trim()), 'the close runs after the optimistic write');
  });
};
