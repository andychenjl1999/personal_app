import {
  dateKeyToDate,
  dateToDateKey,
  isDateKey,
  shiftDateKey,
} from './todo-date';

export type RecurrenceUnit = 'day' | 'weekday' | 'week' | 'month' | 'year';

export type RecurrenceEnd = '3-months' | '6-months' | '1-year' | '2-years';

export type RecurringTodoSchedule = {
  startDate: string;
  interval: number;
  unit: RecurrenceUnit;
  end: RecurrenceEnd;
};

export const recurrenceEndOptions: Array<{
  value: RecurrenceEnd;
  label: string;
  monthCount: number;
}> = [
  { value: '3-months', label: '3 months after start', monthCount: 3 },
  { value: '6-months', label: '6 months after start', monthCount: 6 },
  { value: '1-year', label: '1 year after start', monthCount: 12 },
  { value: '2-years', label: '2 years after start', monthCount: 24 },
];

function getEndMonthCount(end: RecurrenceEnd) {
  return (
    recurrenceEndOptions.find((option) => option.value === end)?.monthCount ?? 0
  );
}

function addAnchoredMonths(startDate: Date, monthCount: number) {
  const targetMonthIndex = startDate.getMonth() + monthCount;
  const targetYear =
    startDate.getFullYear() + Math.floor(targetMonthIndex / 12);
  const targetMonth = targetMonthIndex % 12;
  const finalDayOfTargetMonth = new Date(
    targetYear,
    targetMonth + 1,
    0,
  ).getDate();

  // Always calculate from the original start date. This lets January 31 clamp to
  // February's final day and then return to March 31 instead of drifting permanently.
  return new Date(
    targetYear,
    targetMonth,
    Math.min(startDate.getDate(), finalDayOfTargetMonth),
  );
}

function getCalendarDayDistance(startDate: Date, endDate: Date) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const startUtc = Date.UTC(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate(),
  );
  const endUtc = Date.UTC(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate(),
  );

  // UTC calendar components avoid daylight-saving transitions changing the apparent
  // number of local calendar days in the bounded recurrence window.
  return Math.round((endUtc - startUtc) / millisecondsPerDay);
}

function shiftWeekdays(dateKey: string, amount: number) {
  let shiftedDateKey = dateKey;
  let remainingWeekdays = amount;

  while (remainingWeekdays > 0) {
    shiftedDateKey = shiftDateKey(shiftedDateKey, 1);
    const weekday = dateKeyToDate(shiftedDateKey).getDay();
    if (weekday !== 0 && weekday !== 6) {
      remainingWeekdays -= 1;
    }
  }

  return shiftedDateKey;
}

export function getRecurringTodoValidationError(
  schedule: RecurringTodoSchedule,
  minimumStartDate: string,
) {
  if (!isDateKey(schedule.startDate)) {
    return 'Choose a valid start date.';
  }

  if (schedule.startDate < minimumStartDate) {
    return 'The start date must be today or later.';
  }

  if (!Number.isSafeInteger(schedule.interval) || schedule.interval < 1) {
    return 'Frequency must be a positive whole number.';
  }

  if (schedule.unit === 'weekday') {
    const startWeekday = dateKeyToDate(schedule.startDate).getDay();
    if (startWeekday === 0 || startWeekday === 6) {
      return 'Weekday recurrence must start on Monday through Friday.';
    }
  }

  return '';
}

export function buildRecurringTodoDateKeys(
  schedule: RecurringTodoSchedule,
  minimumStartDate: string,
) {
  const validationError = getRecurringTodoValidationError(
    schedule,
    minimumStartDate,
  );
  if (validationError) {
    throw new Error(validationError);
  }

  const startDate = dateKeyToDate(schedule.startDate);
  const endMonthCount = getEndMonthCount(schedule.end);
  const endDate = addAnchoredMonths(startDate, endMonthCount);
  const endDateKey = dateToDateKey(endDate);
  const calendarDayDistance = getCalendarDayDistance(startDate, endDate);
  const occurrenceDateKeys = [schedule.startDate];

  // An interval beyond the selected horizon still produces the required start-date todo.
  // These checks also avoid passing extremely large user-provided offsets into Date.
  if (
    (schedule.unit === 'day' && schedule.interval > calendarDayDistance) ||
    (schedule.unit === 'weekday' && schedule.interval > calendarDayDistance) ||
    (schedule.unit === 'week' &&
      schedule.interval > Math.floor(calendarDayDistance / 7)) ||
    (schedule.unit === 'month' && schedule.interval > endMonthCount) ||
    (schedule.unit === 'year' &&
      schedule.interval > Math.floor(endMonthCount / 12))
  ) {
    return occurrenceDateKeys;
  }

  let occurrenceNumber = 1;
  let previousDateKey = schedule.startDate;

  while (true) {
    let nextDateKey: string;

    if (schedule.unit === 'day') {
      nextDateKey = shiftDateKey(
        schedule.startDate,
        schedule.interval * occurrenceNumber,
      );
    } else if (schedule.unit === 'weekday') {
      nextDateKey = shiftWeekdays(previousDateKey, schedule.interval);
    } else if (schedule.unit === 'week') {
      nextDateKey = shiftDateKey(
        schedule.startDate,
        schedule.interval * 7 * occurrenceNumber,
      );
    } else {
      const monthInterval =
        schedule.unit === 'year' ? schedule.interval * 12 : schedule.interval;
      nextDateKey = dateToDateKey(
        addAnchoredMonths(startDate, monthInterval * occurrenceNumber),
      );
    }

    if (nextDateKey > endDateKey) {
      break;
    }

    occurrenceDateKeys.push(nextDateKey);
    previousDateKey = nextDateKey;
    occurrenceNumber += 1;
  }

  return occurrenceDateKeys;
}
