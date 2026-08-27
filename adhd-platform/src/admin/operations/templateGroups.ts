import type { EmailTemplate, Project } from '@contracts/types';

/**
 * 信件範本依服務線分組。
 *
 * 為什麼要分組：範本清單原本是一長串平的名單，四條服務線的信混在一起，找一封要一路掃。
 * 更實際的理由是「複製別線的範本忘了改」——實寄信裡就出現過職能諮詢的信，視訊連結那行
 * 還掛著另一條線的計畫名。每條線看得到自己那一疊，才不會拿錯一封來改。
 *
 * 分組欄位用既有的 `email_templates.project_id`，不新增欄位。
 */

/** 分組結果；`label` 直接拿去當清單的標題列。 */
export interface TemplateGroup {
  label: string;
  /** 這一組的範本；可能是空陣列（通用組恆存在、目前服務線的組也一定列出來）。 */
  items: EmailTemplate[];
}

/** 沒有 `projectId` 的範本落在這裡。任何一條線都用得到的信（講師、協辦活動）也放這組。 */
export const GENERIC_GROUP_LABEL = '通用範本';

/** 分組只需要專案的這三個欄位；呼叫端傳完整的 `Project` 也相容。 */
export type TemplateGroupProject = Pick<Project, 'id' | 'name' | 'slug'>;

/**
 * 把範本分成「通用組 ＋ 各服務線組」。
 *
 * 排序規則：
 *   1. `currentSlug` 指到的那條線排最前（正在看哪一線，就先看到那一線的信）。
 *   2. 接著是通用組——它對每一條線都成立，所以緊跟在後而不是被擠到最下面。
 *   3. 其餘服務線依傳入的 `projects` 順序。
 * 沒有傳 `currentSlug` 時通用組排第一，其餘服務線照 `projects` 順序接在後面。
 *
 * 空組的處理：通用組恆存在（即使沒有範本），`currentSlug` 那一組也一定列出來——
 * 「這條線還沒有自己的範本」是使用者需要看到的資訊，整組消失就看不出來了。
 * 其餘服務線沒有範本就不列，免得清單被一排空標題撐開。
 *
 * `projectId` 指到一個不存在的專案時，該範本歸到通用組而不是被丟掉：
 * 多一封出現在通用組看得見，整封消失才是真的找不回來。
 *
 * 純函式：不讀外部狀態、不改傳入的陣列。
 */
export function groupTemplates(
  templates: EmailTemplate[],
  projects: TemplateGroupProject[],
  currentSlug?: string,
): TemplateGroup[] {
  const known = new Set(projects.map((project) => project.id));
  const byProject = new Map<string, EmailTemplate[]>();
  const generic: EmailTemplate[] = [];

  for (const template of templates) {
    const id = template.projectId;
    if (!id || !known.has(id)) {
      generic.push(template);
      continue;
    }
    const bucket = byProject.get(id);
    if (bucket) bucket.push(template);
    else byProject.set(id, [template]);
  }

  const current = currentSlug ? projects.find((project) => project.slug === currentSlug) : undefined;
  const groupFor = (project: TemplateGroupProject): TemplateGroup => ({
    label: project.name,
    items: byProject.get(project.id) ?? [],
  });

  const rest = projects
    .filter((project) => project.id !== current?.id && (byProject.get(project.id)?.length ?? 0) > 0)
    .map(groupFor);

  const genericGroup: TemplateGroup = { label: GENERIC_GROUP_LABEL, items: generic };
  return current ? [groupFor(current), genericGroup, ...rest] : [genericGroup, ...rest];
}
