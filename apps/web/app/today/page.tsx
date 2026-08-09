'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { dateToDateKey } from '../todos/todo-date';
import { TodoLoadingState } from '../todos/todo-view-parts';

export default function TodayPage() {
  const router = useRouter();

  useEffect(() => {
    // Resolve today in the browser so the shortcut follows the device's local
    // calendar date instead of the deployment server's timezone.
    const todayKey = dateToDateKey(new Date());
    router.replace(`/day/${todayKey}`);
  }, [router]);

  return (
    <main className="app-shell">
      <TodoLoadingState />
    </main>
  );
}
