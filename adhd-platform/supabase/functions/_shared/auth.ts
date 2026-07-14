/**
 * Edge Functions 呼叫者授權。【CLAUDE / K2】
 * 僅允許：系統擁有者，或該專案 owner / admin_collab。
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export async function requireProjectAdmin(
  req: Request,
  admin: SupabaseClient,
  projectId: string,
): Promise<{ userId: string } | null> {
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) return null;
  const {
    data: { user },
    error,
  } = await admin.auth.getUser(jwt);
  if (error || !user) return null;

  const { data: profile } = await admin
    .from('profiles')
    .select('is_system_owner')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.is_system_owner) return { userId: user.id };

  const { data: member } = await admin
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (member && ['owner', 'admin_collab'].includes(member.role)) return { userId: user.id };
  return null;
}
