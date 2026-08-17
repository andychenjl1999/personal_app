import {
  dateKeyToDate,
  dateToDateKey,
  isDateKey,
  shiftDateKey,
} from './todo-date';

export type RecurrenceUnit = 'day' | 'weekday' | 'week' | 'month' | 'year';

export type RecurringTodoSchedule = {
  startDate: string;
  endDate: string;
  interval: number;
  unit: RecurrenceUnit;
};

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

function getCalendarMonthDistance(startDate: Date, endDate: Date) {
  return (
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    endDate.getMonth() -
    startDate.getMonth()
  );
}

export function getRecurringTodoMaximumEndDate(startDate: string) {
  if (!isDateKey(startDate)) {
    return '';
  }

  // Keep the existing two-year batch horizon while allowing any exact date inside it.
  return dateToDateKey(addAnchoredMonths(dateKeyToDate(startDate), 24));
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

  if (!isDateKey(schedule.endDate)) {
    return 'Choose a valid end date.';
  }

  if (schedule.endDate < schedule.startDate) {
    return 'The end date must be on or after the start date.';
  }

  const maximumEndDate = getRecurringTodoMaximumEndDate(schedule.startDate);
  if (schedule.endDate > maximumEndDate) {
    return 'The end date must be within 2 years of the start date.';
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
  const endDate = dateKeyToDate(schedule.endDate);
  const calendarDayDistance = getCalendarDayDistance(startDate, endDate);
  const calendarMonthDistance = getCalendarMonthDistance(startDate, endDate);
  const occurrenceDateKeys = [schedule.startDate];

  // An interval beyond the selected horizon still produces the required start-date todo.
  // These checks also avoid passing extremely large user-provided offsets into Date.
  if (
    (schedule.unit === 'day' && schedule.interval > calendarDayDistance) ||
    (schedule.unit === 'weekday' && schedule.interval > calendarDayDistance) ||
    (schedule.unit === 'week' &&
      schedule.interval > Math.floor(calendarDayDistance / 7)) ||
    (schedule.unit === 'month' && schedule.interval > calendarMonthDistance) ||
    (schedule.unit === 'year' &&
      schedule.interval > Math.floor(calendarMonthDistance / 12))
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

    if (nextDateKey > schedule.endDate) {
      break;
    }

    occurrenceDateKeys.push(nextDateKey);
    previousDateKey = nextDateKey;
    occurrenceNumber += 1;
  }

  return occurrenceDateKeys;
}
