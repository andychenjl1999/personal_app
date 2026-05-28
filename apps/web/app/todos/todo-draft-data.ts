import { getSupabaseClient } from '../../lib/supabase/client';

export type TodoDraftInput = {
  content: string;
  createdAt: string;
  updatedAt: string;
};

type TodoDraftInputRow = {
  id: number;
  content: string;
  created_at: string;
  updated_at: string;
};

const draftInputId = 1;
const todoDraftInputColumns = 'id,content,created_at,updated_at';

function mapTodoDraftInputRow(row: TodoDraftInputRow): TodoDraftInput {
  // The draft input is stored as one plain string; timestamps are exposed only for save-state UI.
  return {
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getTodoDraftInput(): Promise<TodoDraftInput | null> {
  const { data, error } = await getSupabaseClient()
    .from('todo_draft_input')
    .select(todoDraftInputColumns)
    .eq('id', draftInputId)
    .maybeSingle<TodoDraftInputRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapTodoDraftInputRow(data) : null;
}

export async function saveTodoDraftInput(
  content: string,
): Promise<TodoDraftInput> {
  const { data, error } = await getSupabaseClient()
    .from('todo_draft_input')
    .upsert(
      {
        id: draftInputId,
        content,
      },
      { onConflict: 'id' },
    )
    .select(todoDraftInputColumns)
    .single<TodoDraftInputRow>();

  if (error) {
    throw new Error(error.message);
  }

  // Returning the saved row lets the future editor show the real persisted save timestamp.
  return mapTodoDraftInputRow(data);
}
