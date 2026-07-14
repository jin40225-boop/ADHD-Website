/**
 * 第二層權限：各 ProjectRole 的預設動作矩陣。【CLAUDE】
 * 對映《系統建置計畫書.md》第三節權限表。RLS 為資料庫層底線，此處為前端便利判斷。
 */
import type { ProjectPermissions, ProjectRole } from '@contracts/types';

/** 各角色預設權限矩陣。ProjectMember.permissions 可逐項覆寫。 */
export const DEFAULT_PERMISSIONS: Record<ProjectRole, ProjectPermissions> = {
  owner: {
    registrations: 'all',
    email: 'all',
    statusChange: 'all',
    sessions: 'all',
    cases: true,
  },
  admin_collab: {
    registrations: 'all',
    email: 'all',
    statusChange: 'all',
    sessions: 'all',
    cases: false, // 視設定，預設關
  },
  instructor_full: {
    registrations: 'own_sessions',
    email: 'own_sessions',
    statusChange: 'reply_confirm',
    sessions: 'none',
    cases: false,
  },
  instructor_slot: {
    registrations: 'none',
    email: 'none',
    statusChange: 'none',
    sessions: 'slot_confirm_only',
    cases: false,
  },
};

/** 取得成員在某專案的有效權限（預設矩陣 + 個別覆寫）。 */
export function resolvePermissions(
  role: ProjectRole,
  overrides?: Partial<ProjectPermissions>,
): ProjectPermissions {
  return { ...DEFAULT_PERMISSIONS[role], ...overrides };
}
