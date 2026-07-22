import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
function jsonResponse(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
async function requireProjectAdmin(req: Request, admin: SupabaseClient, projectId: string) { const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, ''); const { data: { user } } = await admin.auth.getUser(jwt); if (!user) return null; const { data: profile } = await admin.from('profiles').select('is_system_owner').eq('id', user.id).maybeSingle(); if (profile?.is_system_owner) return { userId: user.id }; const { data: member } = await admin.from('project_members').select('role').eq('project_id', projectId).eq('user_id', user.id).maybeSingle(); return member && ['owner', 'admin_collab'].includes(member.role) ? { userId: user.id } : null; }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const { projectId, email: rawEmail, role = 'admin_collab' } = await req.json();
    const email = String(rawEmail ?? '').trim().toLowerCase();
    if (!projectId || !email || !['owner', 'admin_collab', 'instructor_full', 'instructor_slot'].includes(role)) return jsonResponse({ error: 'BAD_REQUEST' }, 400);
    const caller = await requireProjectAdmin(req, admin, projectId); if (!caller) return jsonResponse({ error: 'FORBIDDEN' }, 403);
    const { data: existing } = await admin.from('profiles').select('id').ilike('email', email).maybeSingle();
    let userId = existing?.id as string | undefined; let invited = false;
    if (!userId) {
      const redirectTo = `${Deno.env.get('PUBLIC_SITE_URL') ?? 'https://jin40225-boop.github.io/ADHD-Website'}/admin/login`;
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
      if (error || !data.user) throw error ?? new Error('邀請使用者失敗');
      userId = data.user.id; invited = true;
    }
    const { error } = await admin.from('project_members').upsert({ project_id: projectId, user_id: userId, role }, { onConflict: 'project_id,user_id' }); if (error) throw error;
    const { data: person } = await admin.from('profiles').select('display_name,email').eq('id', userId).maybeSingle();
    await admin.from('contacts').upsert({ profile_id: userId, display_name: person?.display_name || email.split('@')[0], primary_email: person?.email || email, tags: role.startsWith('instructor') ? ['講師'] : ['團隊成員'] }, { onConflict: 'profile_id' });
    await admin.from('audit_log').insert({ action: 'team_member_invite', actor_id: caller.userId, target_type: 'profile', target_id: userId, result: 'success', detail: `${email}:${role}:${invited ? 'invited' : 'existing'}` });
    return jsonResponse({ ok: true, invited, userId });
  } catch (err) { const message = err instanceof Error ? err.message : String(err); return jsonResponse({ error: message }, 500); }
});



