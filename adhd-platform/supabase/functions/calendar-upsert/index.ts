/**
 * calendar-upsert：為場次建立/更新 Google Calendar 事件並產生 Meet 連結。【CLAUDE / K2】
 * body: { sessionId: string }
 * 授權：系統擁有者或該場次所屬專案的 owner / admin_collab。
 * 效果：Calendar events.insert/patch（含 Meet）→ 更新 sessions.meet_url /
 *        calendar_event_id → audit_log。
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { getGoogleAccessToken } from '../_shared/google.ts';
import { requireProjectAdmin } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let actorId: string | undefined;
  try {
    const { sessionId } = await req.json();
    if (!sessionId) return jsonResponse({ error: 'BAD_REQUEST：sessionId 必填' }, 400);

    const { data: session, error: sessionError } = await admin
      .from('sessions')
      .select('id, project_id, title, starts_at, ends_at, calendar_event_id')
      .eq('id', sessionId)
      .maybeSingle();
    if (sessionError || !session) return jsonResponse({ error: '找不到場次' }, 404);

    const caller = await requireProjectAdmin(req, admin, session.project_id);
    if (!caller) return jsonResponse({ error: 'FORBIDDEN：無此專案的場次權限' }, 403);
    actorId = caller.userId;

    const accessToken = await getGoogleAccessToken();
    const event = {
      summary: session.title,
      start: { dateTime: session.starts_at, timeZone: 'Asia/Taipei' },
      end: { dateTime: session.ends_at, timeZone: 'Asia/Taipei' },
      conferenceData: {
        createRequest: {
          requestId: `adhd-${session.id}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    };

    const base = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
    const url = session.calendar_event_id
      ? `${base}/${session.calendar_event_id}?conferenceDataVersion=1`
      : `${base}?conferenceDataVersion=1`;
    const res = await fetch(url, {
      method: session.calendar_event_id ? 'PATCH' : 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`CALENDAR_ERROR：${data.error?.message ?? res.status}`);

    const meetUrl =
      data.hangoutLink ??
      data.conferenceData?.entryPoints?.find(
        (p: { entryPointType?: string; uri?: string }) => p.entryPointType === 'video',
      )?.uri ??
      null;

    await admin
      .from('sessions')
      .update({ calendar_event_id: data.id, meet_url: meetUrl })
      .eq('id', session.id);

    await admin.from('audit_log').insert({
      action: 'calendar_upsert',
      actor_id: actorId,
      target_type: 'session',
      target_id: session.id,
      result: 'success',
      detail: meetUrl ?? undefined,
    });

    return jsonResponse({ ok: true, eventId: data.id, meetUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await admin.from('audit_log').insert({
      action: 'calendar_upsert',
      actor_id: actorId ?? null,
      result: 'error',
      detail: message,
    });
    return jsonResponse({ error: message }, 500);
  }
});
