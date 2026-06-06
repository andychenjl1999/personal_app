import { withSupabase } from 'npm:@supabase/server';

type ReminderTodo = {
  id: string;
  title: string;
  progress_note: string;
  status: string;
  priority: string;
  due_date: number | null;
  reminder_time: number;
  reminder_email_claim_token: string;
};

type SendResult = {
  todoId: string;
  ok: boolean;
  error?: string;
};

type SupabaseRpcClient = {
  rpc: (
    functionName: string,
    args?: Record<string, unknown>,
  ) => Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
};

const resendEmailUrl = 'https://api.resend.com/emails';
const defaultBatchSize = 25;
const maxBatchSize = 100;
const defaultTimeZone = 'America/Los_Angeles';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const authenticatedFetch = withSupabase(
  { auth: 'secret' },
  async (request, ctx) => {
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed.' }, 405);
    }

    try {
      const config = getConfig();
      const supabase = ctx.supabaseAdmin as SupabaseRpcClient;

      const batchSize = await readBatchSize(request);
      const { data: reminders, error: claimError } = await supabase.rpc(
        'claim_due_todo_reminder_emails',
        {
          requested_batch_size: batchSize,
        },
      );

      if (claimError) {
        throw new Error(
          `Could not claim reminder emails: ${claimError.message}`,
        );
      }

      const results: SendResult[] = [];

      for (const reminder of (reminders ?? []) as ReminderTodo[]) {
        results.push(await sendAndRecordReminder(supabase, config, reminder));
      }

      return jsonResponse({
        claimed: reminders?.length ?? 0,
        sent: results.filter((result) => result.ok).length,
        failed: results.filter((result) => !result.ok).length,
        results,
      });
    } catch (error) {
      return jsonResponse({ error: getErrorMessage(error) }, 500);
    }
  },
);

export default {
  fetch(request: Request) {
    if (request.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    return authenticatedFetch(request);
  },
};

async function sendAndRecordReminder(
  supabase: SupabaseRpcClient,
  config: ReturnType<typeof getConfig>,
  reminder: ReminderTodo,
): Promise<SendResult> {
  try {
    await sendReminderEmail(config, reminder);

    const { data: markedSent, error: markError } = await supabase.rpc(
      'mark_todo_reminder_email_sent',
      {
        reminder_id: reminder.id,
        claim_token: reminder.reminder_email_claim_token,
      },
    );

    if (markError) {
      throw new Error(
        `Email sent, but could not mark reminder sent: ${markError.message}`,
      );
    }

    if (!markedSent) {
      throw new Error('Email sent, but reminder claim was no longer current.');
    }

    return {
      todoId: reminder.id,
      ok: true,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    const { error: markFailureError } = await supabase.rpc(
      'mark_todo_reminder_email_failed',
      {
        reminder_id: reminder.id,
        claim_token: reminder.reminder_email_claim_token,
        error_message: errorMessage,
      },
    );

    if (markFailureError) {
      return {
        todoId: reminder.id,
        ok: false,
        error: `${errorMessage} Failure state update also failed: ${markFailureError.message}`,
      };
    }

    return {
      todoId: reminder.id,
      ok: false,
      error: errorMessage,
    };
  }
}

async function sendReminderEmail(
  config: ReturnType<typeof getConfig>,
  reminder: ReminderTodo,
) {
  const response = await fetch(resendEmailUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.emailFrom,
      to: [config.emailTo],
      subject: buildSubject(reminder),
      text: buildTextEmail(config, reminder),
      html: buildHtmlEmail(config, reminder),
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Resend ${response.status}: ${truncate(await response.text(), 500)} `,
    );
  }
}

function getConfig() {
  return {
    resendApiKey: requireEnv('RESEND_API_KEY'),
    emailTo: requireEnv('REMINDER_EMAIL_TO'),
    emailFrom: requireEnv('REMINDER_EMAIL_FROM'),
    timeZone: Deno.env.get('REMINDER_EMAIL_TIME_ZONE') || defaultTimeZone,
  };
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }

  return value;
}

async function readBatchSize(request: Request) {
  try {
    const body = (await request.json()) as { batchSize?: number };
    if (!Number.isFinite(body.batchSize)) {
      return defaultBatchSize;
    }

    return Math.min(
      Math.max(Math.trunc(body.batchSize ?? defaultBatchSize), 1),
      maxBatchSize,
    );
  } catch {
    return defaultBatchSize;
  }
}

function buildSubject(reminder: ReminderTodo) {
  return truncate(`Reminder: ${reminder.title} `, 120);
}

function buildTextEmail(
  config: ReturnType<typeof getConfig>,
  reminder: ReminderTodo,
) {
  const lines = [
    reminder.title,
    '',
    `Priority: ${reminder.priority} `,
    `Reminder: ${formatDateTime(reminder.reminder_time, config.timeZone)} `,
  ];

  if (reminder.due_date) {
    lines.push(`Due: ${formatDate(reminder.due_date, config.timeZone)} `);
  }

  if (reminder.progress_note.trim()) {
    lines.push('', 'Progress note:', reminder.progress_note.trim());
  }

  return lines.join('\n');
}

function buildHtmlEmail(
  config: ReturnType<typeof getConfig>,
  reminder: ReminderTodo,
) {
  const details = [
    ['Priority', reminder.priority],
    ['Reminder', formatDateTime(reminder.reminder_time, config.timeZone)],
  ];

  if (reminder.due_date) {
    details.push(['Due', formatDate(reminder.due_date, config.timeZone)]);
  }

  const note = reminder.progress_note.trim();

  return `<!doctype html>
  <html>
  <body style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;" >
    <h1 style="font-size: 20px; margin: 0 0 16px;" > ${escapeHtml(reminder.title)} </h1>
    <dl style = "margin: 0 0 16px;">
        ${details
      .map(
        ([label, value]) =>
          `<dt style="font-weight: 700;">${escapeHtml(label)}</dt><dd style="margin: 0 0 8px;">${escapeHtml(value)}</dd>`,
      )
      .join('')}
    </dl>
    ${note
      ? `<h2 style="font-size: 16px; margin: 0 0 8px;">Progress note</h2><p style="white-space: pre-wrap; margin: 0;">${escapeHtml(note)}</p>`
      : ''
    }
  </body>
  </html>`;
}

function formatDateTime(epochSeconds: number, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(epochSeconds * 1000));
}

function formatDate(epochSeconds: number, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeZone,
  }).format(new Date(epochSeconds * 1000));
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}...`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
