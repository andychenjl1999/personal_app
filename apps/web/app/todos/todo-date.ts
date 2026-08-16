const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/;
const monthKeyPattern = /^\d{4}-\d{2}$/;

export function isDateKey(value: string) {
  if (!dateKeyPattern.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function isMonthKey(value: string) {
  if (!monthKeyPattern.test(value)) {
    return false;
  }

  const [year, month] = value.split('-').map(Number);
  return year >= 1 && month >= 1 && month <= 12;
}

export function dateToDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function dateToMonthKey(date: Date) {
  return dateToDateKey(date).slice(0, 7);
}

export function dateKeyToDate(value: string) {
  if (!isDateKey(value)) {
    throw new Error(`Invalid date: ${value}`);
  }

  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function dateKeyToUnixSeconds(value?: string) {
  if (!value) {
    return undefined;
  }

  return Math.floor(dateKeyToDate(value).getTime() / 1000);
}

export function unixSecondsToDateKey(value?: number) {
  return value === undefined ? '' : dateToDateKey(new Date(value * 1000));
}

export function shiftDateKey(value: string, amount: number) {
  const date = dateKeyToDate(value);
  date.setDate(date.getDate() + amount);
  return dateToDateKey(date);
}

export function shiftMonthKey(value: string, amount: number) {
  const [year, month] = value.split('-').map(Number);
  return dateToMonthKey(new Date(year, month - 1 + amount, 1));
}

export function getCalendarDateKeys(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  const firstOfMonth = new Date(year, month - 1, 1);
  const lastOfMonth = new Date(year, month, 0);
  const calendarStart = new Date(year, month - 1, 1 - firstOfMonth.getDay());
  const calendarEnd = new Date(year, month, 6 - lastOfMonth.getDay());
  const keys: string[] = [];

  // Calendar dates are generated from local date components to match how due_date is stored.
  for (
    const cursor = new Date(calendarStart);
    cursor <= calendarEnd;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    keys.push(dateToDateKey(cursor));
  }

  return keys;
}

export function formatMonth(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1));
}

export function formatLongDate(dateKey: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(dateKeyToDate(dateKey));
}

export function formatShortDate(dateKey: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(dateKeyToDate(dateKey));
}

export function datetimeLocalToUnixSeconds(value?: string) {
  if (!value) {
    return undefined;
  }

  const [datePart, timePart] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  const date = new Date(year, month - 1, day, hour, minute);

  return Math.floor(date.getTime() / 1000);
}

export function unixSecondsToDatetimeLocal(value?: number) {
  if (value === undefined) {
    return '';
  }

  const date = new Date(value * 1000);
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  return `${dateToDateKey(date)}T${hour}:${minute}`;
}

export function timeInputToExecutionTime(value?: string) {
  if (!value) {
    return undefined;
  }

  const [rawHour, minute] = value.split(':').map(Number);
  const suffix = rawHour >= 12 ? 'pm' : 'am';
  const hour = rawHour % 12 || 12;

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${suffix}`;
}

export function executionTimeToTimeInput(value?: string) {
  if (!value) {
    return '';
  }

  const match = /^(0[1-9]|1[0-2]):([0-5]\d) (am|pm)$/i.exec(value);
  if (!match) {
    return '';
  }

  let hour = Number(match[1]) % 12;
  if (match[3].toLowerCase() === 'pm') {
    hour += 12;
  }

  return `${String(hour).padStart(2, '0')}:${match[2]}`;
}
