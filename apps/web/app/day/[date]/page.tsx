import { notFound } from 'next/navigation';

import { DayView } from '../../todos/day-view';
import { isDateKey } from '../../todos/todo-date';

export default async function TodoDayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;

  if (!isDateKey(date)) {
    notFound();
  }

  return <DayView dateKey={date} />;
}
