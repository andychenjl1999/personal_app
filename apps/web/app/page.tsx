import TodoApp from './todos/todo-app';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;

  return <TodoApp initialMonth={month} />;
}
