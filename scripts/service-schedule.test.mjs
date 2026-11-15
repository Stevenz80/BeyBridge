import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildScheduleDayOptions, combineSchedule, formatScheduleDay,
  formatScheduledFor, isFutureSchedule, SCHEDULE_TIME_SLOTS,
} from '../src/lib/service-schedule.ts';

test('offers seven local calendar days across year and leap-day boundaries', () => {
  assert.deepEqual(buildScheduleDayOptions(new Date(2026, 11, 30, 23, 59)), [
    '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02',
    '2027-01-03', '2027-01-04', '2027-01-05',
  ]);
  assert.deepEqual(buildScheduleDayOptions(new Date(2028, 1, 28), 3), [
    '2028-02-28', '2028-02-29', '2028-03-01',
  ]);
  for (const count of [0, -1, 1.5, 367, NaN]) {
    assert.throws(() => buildScheduleDayOptions(new Date(), count), RangeError);
  }
  assert.throws(() => buildScheduleDayOptions(new Date(NaN)), RangeError);
});

test('combines supported hours using local time and returns UTC ISO', () => {
  assert.equal(SCHEDULE_TIME_SLOTS.length, 13);
  assert.equal(SCHEDULE_TIME_SLOTS[0], '08:00');
  assert.equal(SCHEDULE_TIME_SLOTS.at(-1), '20:00');
  for (const slot of SCHEDULE_TIME_SLOTS) {
    const value = combineSchedule('2026-10-21', slot);
    assert.equal(value, new Date(2026, 9, 21, Number(slot.slice(0, 2))).toISOString());
    assert.equal(new Date(value).getDate(), 21);
  }
});

test('rejects malformed dates, impossible days, and unsupported times', () => {
  for (const day of ['', '2026-2-01', '2026-02-29', '2026-04-31', '2026-13-01', '2026-10-00']) {
    assert.equal(combineSchedule(day, '08:00'), null, day);
  }
  for (const slot of ['', '8:00', '07:00', '21:00', '08:30', '24:00']) {
    assert.equal(combineSchedule('2026-10-21', slot), null, slot);
  }
});

test('rejects past, invalid, and just-expired times at confirmation', () => {
  const selected = combineSchedule('2026-10-21', '08:00');
  const instant = new Date(selected).getTime();
  assert.equal(isFutureSchedule(selected, new Date(instant - 1)), true);
  assert.equal(isFutureSchedule(selected, new Date(instant)), false);
  assert.equal(isFutureSchedule(selected, new Date(instant + 1)), false);
  assert.equal(isFutureSchedule(null), false);
  assert.equal(isFutureSchedule('invalid'), false);
  assert.equal(isFutureSchedule(selected, new Date(NaN)), false);
});

test('formats visit times and day labels with English and Lebanese Arabic locales', () => {
  const value = combineSchedule('2026-10-21', '09:00');
  for (const locale of ['en', 'ar-LB-u-nu-latn']) {
    assert.equal(formatScheduledFor(value, locale), new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium', timeStyle: 'short',
    }).format(new Date(value)));
    assert.equal(formatScheduleDay('2026-10-21', locale), new Intl.DateTimeFormat(locale, {
      weekday: 'short', month: 'short', day: 'numeric',
    }).format(new Date(2026, 9, 21, 12)));
  }
  assert.equal(formatScheduledFor('invalid', 'en'), '');
  assert.equal(formatScheduleDay('invalid', 'en'), '');
});

test('calendar days and visit hours survive DST and local/UTC day boundaries', () => {
  const previousTimezone = process.env.TZ;
  try {
    for (const timezone of ['Asia/Beirut', 'America/New_York', 'Pacific/Auckland']) {
      process.env.TZ = timezone;
      for (const [month, day] of [[2, 7], [9, 24], [10, 1]]) {
        const now = new Date(2026, month, day, 23, 59);
        const days = buildScheduleDayOptions(now);
        assert.equal(new Set(days).size, 7);
        days.forEach((date, index) => {
          const expected = new Date(2026, month, day + index, 8);
          assert.equal(combineSchedule(date, '08:00'), expected.toISOString());
          assert.equal(date, [expected.getFullYear(), String(expected.getMonth() + 1).padStart(2, '0'),
            String(expected.getDate()).padStart(2, '0')].join('-'));
        });
      }
    }
    process.env.TZ = 'Pacific/Apia';
    assert.equal(combineSchedule('2011-12-30', '08:00'), null, 'reject a skipped local date');
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});
