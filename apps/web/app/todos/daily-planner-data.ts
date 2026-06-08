import { getSupabaseClient } from '../../lib/supabase/client';

export type DailyPlannerItem = {
  id: string;
  position: number;
  completed: boolean;
  startTime: string;
  endTime: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type UpdateDailyPlannerItemInput = Partial<
  Pick<DailyPlannerItem, 'completed' | 'startTime' | 'endTime' | 'title'>
>;

export type DailyPlannerPositionInput = Pick<
  DailyPlannerItem,
  'id' | 'position'
>;

type DailyPlannerItemRow = {
  id: string;
  position: number;
  completed: boolean;
  start_time: string;
  end_time: string;
  title: string;
  created_at: string;
  updated_at: string;
};

const dailyPlannerColumns =
  'id,position,completed,start_time,end_time,title,created_at,updated_at';

function mapDailyPlannerItemRow(row: DailyPlannerItemRow): DailyPlannerItem {
  // Supabase stores database-friendly snake_case names; React state uses camelCase consistently.
  return {
    id: row.id,
    position: row.position,
    completed: row.completed,
    startTime: row.start_time,
    endTime: row.end_time,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildUpdatePayload(updates: UpdateDailyPlannerItemInput) {
  const payload: Partial<
    Pick<DailyPlannerItemRow, 'completed' | 'start_time' | 'end_time' | 'title'>
  > = {};

  // Preserve exactly what the user typed for planner text fields; validation can be added once the time format is decided.
  if ('completed' in updates) {
    payload.completed = updates.completed ?? false;
  }

  if ('startTime' in updates) {
    payload.start_time = updates.startTime ?? '';
  }

  if ('endTime' in updates) {
    payload.end_time = updates.endTime ?? '';
  }

  if ('title' in updates) {
    payload.title = updates.title ?? '';
  }

  return payload;
}

export async function listDailyPlannerItems(): Promise<DailyPlannerItem[]> {
  const { data, error } = await getSupabaseClient()
    .from('daily_todo_planner_items')
    .select(dailyPlannerColumns)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
    .returns<DailyPlannerItemRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data.map(mapDailyPlannerItemRow);
}

export async function createDailyPlannerItem(
  position: number,
): Promise<DailyPlannerItem> {
  const { data, error } = await getSupabaseClient()
    .from('daily_todo_planner_items')
    .insert({
      position,
    })
    .select(dailyPlannerColumns)
    .single<DailyPlannerItemRow>();

  if (error) {
    throw new Error(error.message);
  }

  return mapDailyPlannerItemRow(data);
}

export async function updateDailyPlannerItem(
  itemId: string,
  updates: UpdateDailyPlannerItemInput,
): Promise<DailyPlannerItem> {
  const { data, error } = await getSupabaseClient()
    .from('daily_todo_planner_items')
    .update(buildUpdatePayload(updates))
    .eq('id', itemId)
    .select(dailyPlannerColumns)
    .single<DailyPlannerItemRow>();

  if (error) {
    throw new Error(error.message);
  }

  return mapDailyPlannerItemRow(data);
}

export async function updateDailyPlannerItemPositions(
  positions: DailyPlannerPositionInput[],
): Promise<void> {
  const supabase = getSupabaseClient();
  const results = await Promise.all(
    positions.map((item) =>
      supabase
        .from('daily_todo_planner_items')
        .update({ position: item.position })
        .eq('id', item.id),
    ),
  );
  const error = results.find((result) => result.error)?.error;

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteDailyPlannerItem(itemId: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('daily_todo_planner_items')
    .delete()
    .eq('id', itemId);

  if (error) {
    throw new Error(error.message);
  }
}
