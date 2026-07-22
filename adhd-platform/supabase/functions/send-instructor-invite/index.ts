/** 寄送講師時段邀請；收件人與 Google 憑證都只在 Edge Function 內處理。 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getGoogleAccessToken(): Promise<string> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN');
  if (!clientId || !clientSecret || !refreshToken) throw new Error('GOOGLE_SECRETS_MISSING');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(`GOOGLE_TOKEN_ERROR: ${data.error_description ?? data.error ?? response.status}`);
  }
  return data.access_token as string;
}

function b64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function b64url(input: string): string {
  return b64(input).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

async function requireProjectAdmin(
  req: Request,
  admin: SupabaseClient,
  projectId: string,
): Promise<{ userId: string } | null> {
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) return null;
  const { data: { user }, error } = await admin.auth.getUser(jwt);
  if (error || !user) return null;

  const { data: profile } = await admin.from('profiles')
    .select('is_system_owner').eq('id', user.id).maybeSingle();
  if (profile?.is_system_owner) return { userId: user.id };

  const { data: member } = await admin.from('project_members')
    .select('role').eq('project_id', projectId).eq('user_id', user.id).maybeSingle();
  return member && ['owner', 'admin_collab'].includes(member.role)
    ? { userId: user.id }
    : null;
}

type CandidateSlot = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  capacity?: number;
};

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(+date)) return value;
  return new Intl.DateTimeFormat('zh-TW', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Asia/Taipei',
  }).format(date);
}

function inviteBody(displayName: string, slots: CandidateSlot[], responseUrl: string): string {
  const slotLines = slots.map((slot) => (
    `- ${slot.title}：${formatTime(slot.startsAt)} 至 ${formatTime(slot.endsAt)}`
  ));
  return [
    `${displayName} 您好：`,
    '',
    '邀請您回覆以下候選時段是否可以配合：',
    ...slotLines,
    '',
    `請使用收到此信的 Google 帳號登入回覆：${responseUrl}`,
    '',
    '謝謝您的協助。',
    'ADHD 家長支持平台',
  ].join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let actorId: string | undefined;
  let pollId: string | undefined;
  try {
    ({ pollId } = await req.json());
    if (!pollId) return jsonResponse({ error: 'BAD_REQUEST：pollId 必填' }, 400);

    const { data: poll, error: pollError } = await admin
      .from('availability_polls')
      .select('id, project_id, candidate_slots, instructor_ids, status')
      .eq('id', pollId)
      .maybeSingle();
    if (pollError || !poll) return jsonResponse({ error: '找不到講師邀約' }, 404);
    if (poll.status !== 'open') return jsonResponse({ error: '邀約已結束，無法寄送' }, 409);

    const caller = await requireProjectAdmin(req, admin, poll.project_id);
    if (!caller) return jsonResponse({ error: 'FORBIDDEN：無此專案的邀約權限' }, 403);
    actorId = caller.userId;

    const instructorIds = (poll.instructor_ids as string[]) ?? [];
    if (!instructorIds.length) return jsonResponse({ error: '邀約沒有講師收件人' }, 400);
    const { data: profiles, error: profileError } = await admin
      .from('profiles')
      .select('id, email, display_name')
      .in('id', instructorIds);
    if (profileError) throw new Error(profileError.message);
    if (!profiles?.length) return jsonResponse({ error: '找不到講師帳號' }, 404);

    const siteUrl = (Deno.env.get('PUBLIC_SITE_URL') ?? 'https://jin40225-boop.github.io/ADHD-Website/')
      .replace(/\/?$/, '/');
    const responseUrl = `${siteUrl}instructor/availability?poll=${encodeURIComponent(poll.id)}`;
    const slots = (poll.candidate_slots as CandidateSlot[]) ?? [];
    const accessToken = await getGoogleAccessToken();

    const results = await Promise.all(profiles.map(async (profile) => {
      const subject = '請回覆 ADHD 專案講師候選時段';
      const body = inviteBody(profile.display_name, slots, responseUrl);
      const raw = [
        `To: ${profile.email}`,
        `Subject: =?UTF-8?B?${b64(subject)}?=`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset="UTF-8"',
        'Content-Transfer-Encoding: base64',
        '',
        b64(body),
      ].join('\r\n');
      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw: b64url(raw) }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { id: profile.id, ok: false, error: data.error?.message ?? String(response.status) };
      }
      return { id: profile.id, ok: true };
    }));

    const failures = results.filter((result) => !result.ok);
    await admin.from('audit_log').insert({
      action: 'instructor_invite_send',
      actor_id: actorId,
      target_type: 'availability_poll',
      target_id: poll.id,
      result: failures.length ? 'error' : 'success',
      detail: failures.length
        ? `sent=${results.length - failures.length}; failed=${failures.length}; ids=${failures.map((item) => item.id).join(',')}`
        : `sent=${results.length}`,
    });

    if (failures.length) {
      return jsonResponse({ error: '部分邀請寄送失敗', sent: results.length - failures.length }, 502);
    }
    return jsonResponse({ ok: true, sent: results.length });
  } catch (error) {
    await admin.from('audit_log').insert({
      action: 'instructor_invite_send',
      actor_id: actorId ?? null,
      target_type: 'availability_poll',
      target_id: pollId ?? null,
      result: 'error',
      detail: error instanceof Error ? error.message : String(error),
    });
    return jsonResponse({ error: error instanceof Error ? error.message : 'UNKNOWN_ERROR' }, 500);
  }
});
