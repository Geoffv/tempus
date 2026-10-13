# Time Entry

## Purpose

The desktop day editor brings every record for one date into a single reconciliation view. It keeps clock-based work, fixed-duration records and day-level context distinct while showing one authoritative overall total.

## Accessing the Day Editor

Open **Time Entry**, choose Calendar or Agenda, then select a day. An ordinary day selection opens the complete day. Selecting a specific Calendar entry marker may also expand that unique record automatically. On mobile, tap a Punch entry and use **Add session** to enter another start and end time without clocking in again.

## Simple and Detailed Days

Settings › **Default entry mode** decides how a day opens. A day's mode comes from the contracts (or hour types) that apply to it, so an override on a contract or hour type wins; a day that offers both modes follows the default.

- **Simple:** Duration Entries come first with a new entry already open and **Total hours** selected. Type the hours and press **Enter** or **Add duration**: the entry saves and the day closes straight away (the calendar updates immediately while the save finishes in the background). Saving an edit to an existing entry on a Simple day closes it the same way.
- **Detailed:** Timed Sessions come first, followed by Duration Entries.

## Timed Sessions

Timed Sessions are ordered chronologically. They lead the day editor on Detailed days; on Simple days they follow Duration Entries. On a Simple-only day (every contract or hour type that applies uses Simple entry, and no session is already logged that day) the section is hidden, including the clock-in action. The section total includes completed session time, while inferred or stored gaps are shown as breaks. Open sessions display as open and keep the total provisional.

Select a session row to edit its start, end, hour type or contract. Use **Add session** for another timed period, or the clock action to start or finish work now. New sessions only offer hour types and contracts currently configured for Detailed entry. Historical sessions remain editable when configuration changes later.

Times accept 24-hour input such as `17:30` or `1730`, as well as `5:30pm`. Without AM/PM, times use the preceding session or start time as context: `9` then `5` becomes 9am–5pm. You can pause while typing; unfinished text stays in the field until you finish it.

Session additions, time edits, hour type or contract changes, and deletions remain unsaved as you move between rows. Click **Save** or press **Enter** to save the complete batch. **Cancel** discards the batch. Saving is immediate on screen: the calendar and agenda update straight away and the editor stays usable, so you can keep editing (including a session you just added) or close the day while the save finishes in the background. If the save fails, the day returns to how it was before that Save, a message explains why, and — if the day is still open — your draft comes back so you can press **Save** again without re-entering it. If you pressed **Save** again before the failed one finished, those later saves are undone with it and their changes come back in the same draft, so one **Save** retries everything. Clock in/out remain immediate actions. **Clear day** also removes the day's entries at once and deletes them in the background, restoring any it could not delete.

## Duration Entries

Duration Entries list each fixed-duration record separately with its hour type, contract context, billable state and duration. The heading total covers only these records.

Select a row to expand its editor. **Save changes** updates that exact record, **Cancel** restores the saved values, and **Delete** removes only that record. Use **Add duration entry** to create another fixed amount. New entries only offer Simple-compatible configuration; historical records remain accessible.

One row editor is expanded at a time; session changes remain buffered when switching between session rows. Switching between the session and duration sections prompts you to save or discard unsaved changes. Closing the day editor also requires confirmation before unsaved work is discarded.

## Day Details

Comments and copy-previous-day actions appear after both time sections because they affect the whole day. The overall total at the top combines Timed Sessions and Duration Entries; breaks are reported separately and are not added to logged time.

## Leave Balance

Turn on **Counts as annual leave** for an hour type on the Hour Types page to treat days logged with it as leave. Leave days are tracked as taken (today or earlier) or planned (future), and a future day fully covered by leave is not forecast as a working day: the remaining contract hours are spread over the days still free, never above a standard day.

Enable **Show leave balance card** (with expected monthly hours insights) to add a Leave balance card to the Time Entry KPI strip. It needs an active contract with a start date, end date and total-hours cap. The card compares billable hours committed so far — worked, plus any future days already prefilled — with the monthly quota owed so far, the same quota the Projected variance card uses. Hours ahead of that quota are shown as leave funded against your **Annual leave allowance** (Settings, default 20 days; leaving it blank uses the default). Leave on weekends or public holidays does not count against the allowance. Select the card for a step-by-step breakdown and the daily pace needed on the days still free.

## Tips

- Use an ordinary day selection when reconciling a mixed day containing both work sessions and leave durations.
- Leave the end time blank only when a session is genuinely still running.
- Check the section totals before the overall total when investigating a discrepancy.
- Mark planned leave ahead of time so projections and the leave balance reflect the days you will actually work.
