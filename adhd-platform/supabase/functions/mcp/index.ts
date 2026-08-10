import {
  McpServer,
  WebStandardStreamableHTTPServerTransport,
} from 'npm:@modelcontextprotocol/server@2.0.0-beta.5';
import * as z from 'npm:zod@4.4.3';

const SITE_URL = 'https://jin40225-boop.github.io/ADHD-Website/';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': [
    'accept',
    'authorization',
    'content-type',
    'last-event-id',
    'mcp-protocol-version',
    'mcp-session-id',
  ].join(', '),
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Expose-Headers': 'mcp-session-id',
};

type PublicProject = {
  id: string;
  name: string;
  type: string;
  slug: string;
  description: string | null;
};

type PublicSession = {
  id: string;
  project_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  booked_count: number;
  status: 'open' | 'full';
  /** 所屬活動；協辦活動靠它判斷報名是否在合作單位那邊。 */
  activity_id: string | null;
};

type PublicRecommendation = {
  id: string;
  category: string;
  audience: string;
  region: string;
  hospital: string;
  doctor_or_name: string;
  urls: string[];
  experience: string;
  verified: boolean;
  verified_note: string | null;
  updated_at: string | null;
};

const routeBySlug: Record<string, { detail: string; register: string }> = {
  'peer-group': {
    detail: `${SITE_URL}peer-group`,
    register: `${SITE_URL}peer-group/register`,
  },
  navigator: {
    detail: `${SITE_URL}navigator`,
    register: `${SITE_URL}navigator/register`,
  },
  parent: {
    detail: `${SITE_URL}parent`,
    register: `${SITE_URL}parent/register`,
  },
  career: {
    detail: `${SITE_URL}career`,
    register: `${SITE_URL}career/register`,
  },
  // 協辦活動沒有站內報名頁：報名一律在主辦單位的表單。register 指回詳情頁，
  // 讓問到的人被帶去看「報名在對方」那段說明，而不是被丟到一個不存在的報名網址。
  'co-host': {
    detail: `${SITE_URL}co-host`,
    register: `${SITE_URL}co-host`,
  },
};

const publicResources = [
  {
    id: 'home',
    title: 'ADHD 家長支持平台',
    kind: 'service_hub',
    description: '服務總覽與最新入口。',
    url: SITE_URL,
  },
  {
    id: 'recommendation-map',
    title: 'ADHD 推薦地圖',
    kind: 'directory',
    description: '依地區、類別與服務對象查找公開推薦資料。',
    url: `${SITE_URL}map`,
  },
  {
    id: 'newbie-guide',
    title: 'ADHD 新手指南',
    kind: 'guide',
    description: '提供初步認識、就醫與支持資源導航。',
    url: `${SITE_URL}guide`,
  },
  {
    id: 'articles',
    title: 'ADHD 文章與社群資源',
    kind: 'article_index',
    description: '公開文章、社群與相關資源索引。',
    url: `${SITE_URL}articles`,
  },
  {
    id: 'instructors',
    title: '合作講師',
    kind: 'people',
    description: '公開講師與合作夥伴介紹。',
    url: `${SITE_URL}instructors`,
  },
] as const;

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) headers.set(key, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

async function publicQuery<T>(table: string, params: Record<string, string>): Promise<T[]> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('PUBLIC_DATABASE_CONFIG_MISSING');
  const query = new URLSearchParams(params);
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`PUBLIC_DATABASE_QUERY_FAILED:${table}:${response.status}:${detail}`);
  }
  return await response.json() as T[];
}

function toolError(error: unknown) {
  console.error(error);
  return {
    isError: true,
    content: [{ type: 'text' as const, text: '目前無法取得公開資料，請直接開啟正式網站查詢。' }],
    structuredContent: {
      ok: false,
      websiteUrl: SITE_URL,
    },
  };
}

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const publicOutputSchema = z.looseObject({ ok: z.boolean() });

const server = new McpServer({
  name: 'ADHD 家長支持平台公開資料',
  version: '1.0.0',
});

server.registerTool(
  'list_services',
  {
    title: '列出 ADHD 支持服務',
    description: '列出平台上的公開支持服務、服務說明、正式網站詳情與報名入口。只回傳公開資料。',
    inputSchema: z.object({}),
    outputSchema: publicOutputSchema,
    annotations: readOnlyAnnotations,
  },
  async () => {
    try {
      const projects = await publicQuery<PublicProject>('projects', {
        select: 'id,name,type,slug,description',
        is_public: 'eq.true',
        order: 'created_at.asc',
      });
      const services = projects.map((project) => ({
        id: project.id,
        name: project.name,
        type: project.type,
        slug: project.slug,
        description: project.description ?? '',
        detailUrl: routeBySlug[project.slug]?.detail ?? SITE_URL,
        registerUrl: routeBySlug[project.slug]?.register ?? null,
      }));
      return {
        content: [{ type: 'text', text: `目前共有 ${services.length} 項公開服務；報名請前往正式網站完成。` }],
        structuredContent: { ok: true, websiteUrl: SITE_URL, services },
      };
    } catch (error) {
      return toolError(error);
    }
  },
);

server.registerTool(
  'list_upcoming_sessions',
  {
    title: '查詢近期公開場次',
    description: '查詢公開服務的近期場次與剩餘名額。絕不回傳 Meet 連結、Calendar ID 或報名者資料。',
    inputSchema: z.object({
      service: z.enum(['all', 'peer-group', 'navigator', 'parent', 'career', 'co-host']).default('all')
        .describe('服務代碼；不確定時使用 all。'),
      limit: z.number().int().min(1).max(20).default(10),
    }),
    outputSchema: publicOutputSchema,
    annotations: readOnlyAnnotations,
  },
  async ({ service, limit }) => {
    try {
      const projects = await publicQuery<PublicProject>('projects', {
        select: 'id,name,type,slug,description',
        is_public: 'eq.true',
      });
      const selected = service === 'all'
        ? projects
        : projects.filter((project) => project.slug === service);
      const projectIds = new Set(selected.map((project) => project.id));
      const projectById = new Map(selected.map((project) => [project.id, project]));
      const sessions = await publicQuery<PublicSession>('sessions_public', {
        select: 'id,project_id,title,starts_at,ends_at,capacity,booked_count,status,activity_id',
        status: 'in.(open,full)',
        ends_at: `gte.${new Date().toISOString()}`,
        order: 'starts_at.asc',
        limit: '100',
      });
      // 哪些活動的報名在合作單位那邊。**不能用 capacity === 0 判斷**——名額是後台
      // 可以隨手改的顯示欄位（實際上已經被改過一次），拿它當語意判準會在名額被
      // 「修好」的那一刻悄悄失準，然後對外宣稱協辦活動「已額滿」。
      const externalActivities = new Set(
        (await publicQuery<{ id: string; cohost_info?: { formUrl?: string } }>('activities_public', {
          select: 'id,cohost_info',
        }))
          .filter((activity) => activity.cohost_info?.formUrl)
          .map((activity) => activity.id),
      );
      const safeSessions = sessions
        .filter((session) => projectIds.has(session.project_id))
        .slice(0, limit)
        .map((session) => {
          const project = projectById.get(session.project_id)!;
          // 報名在合作單位那邊的場次一律不回報名額數字。我方的 booked_count 永遠是 0，
          // 照算 remaining 會得到 0，讀到這份資料的 AI 就會對外宣稱「已額滿」——那是假資訊。
          // 判準是「所屬活動填了對方的報名表單」，與資料庫的 block_external_registration
          // 同一個依據，不會因為有人調整名額而失準。
          const externallyManaged = Boolean(session.activity_id && externalActivities.has(session.activity_id));
          return {
            id: session.id,
            service: project.slug,
            serviceName: project.name,
            title: session.title,
            startsAt: session.starts_at,
            endsAt: session.ends_at,
            capacity: externallyManaged ? null : session.capacity,
            bookedCount: externallyManaged ? null : session.booked_count,
            remaining: externallyManaged ? null : Math.max(0, session.capacity - session.booked_count),
            registrationHandledExternally: externallyManaged,
            note: externallyManaged
              ? '本場報名由主辦單位受理，本站不受理報名、不保留名額；名額與細節請以主辦單位公告為準，切勿據此判斷是否額滿。'
              : undefined,
            status: session.status,
            registerUrl: routeBySlug[project.slug]?.register ?? SITE_URL,
          };
        });
      return {
        content: [{ type: 'text', text: safeSessions.length
          ? `找到 ${safeSessions.length} 個近期公開場次；請在正式網站完成報名。`
          : '目前沒有符合條件的公開場次。' }],
        structuredContent: { ok: true, websiteUrl: SITE_URL, sessions: safeSessions },
      };
    } catch (error) {
      return toolError(error);
    }
  },
);

server.registerTool(
  'search_recommendations',
  {
    title: '搜尋 ADHD 公開推薦資料',
    description: '依關鍵字、地區、類別或服務對象搜尋公開推薦地圖。結果是社群整理資訊，不是醫療建議。',
    inputSchema: z.object({
      query: z.string().trim().max(80).default('').describe('院所、姓名或經驗內容關鍵字。'),
      region: z.string().trim().max(20).default('all'),
      category: z.enum(['all', 'doctor', 'assessment', 'therapy', 'community', 'other']).default('all'),
      audience: z.enum(['all', 'child', 'adult']).default('all'),
      limit: z.number().int().min(1).max(20).default(10),
    }),
    outputSchema: publicOutputSchema,
    annotations: readOnlyAnnotations,
  },
  async ({ query, region, category, audience, limit }) => {
    try {
      const rows = await publicQuery<PublicRecommendation>('recommendations', {
        select: 'id,category,audience,region,hospital,doctor_or_name,urls,experience,verified,verified_note,updated_at',
        order: 'id.asc',
        limit: '500',
      });
      const needle = query.toLocaleLowerCase('zh-TW');
      const recommendations = rows
        .filter((row) => region === 'all' || row.region === region)
        .filter((row) => category === 'all' || row.category === category)
        .filter((row) => audience === 'all' || row.audience === audience || row.audience === 'all')
        .filter((row) => !needle || [row.hospital, row.doctor_or_name, row.experience]
          .some((value) => value.toLocaleLowerCase('zh-TW').includes(needle)))
        .slice(0, limit)
        .map((row) => ({
          id: row.id,
          category: row.category,
          audience: row.audience,
          region: row.region,
          hospital: row.hospital,
          name: row.doctor_or_name,
          urls: row.urls,
          experienceExcerpt: row.experience.slice(0, 280),
          verified: row.verified,
          verifiedNote: row.verified_note,
          updatedAt: row.updated_at,
          mapUrl: `${SITE_URL}map`,
        }));
      return {
        content: [{ type: 'text', text: recommendations.length
          ? `找到 ${recommendations.length} 筆公開推薦資料。請自行向服務單位確認最新資訊；本結果不構成醫療建議。`
          : '沒有找到符合條件的公開推薦資料。' }],
        structuredContent: {
          ok: true,
          disclaimer: '社群整理資訊，非醫療建議；服務內容與資格請向原單位確認。',
          mapUrl: `${SITE_URL}map`,
          recommendations,
        },
      };
    } catch (error) {
      return toolError(error);
    }
  },
);

server.registerTool(
  'list_public_resources',
  {
    title: '列出 ADHD 公開資源',
    description: '列出平台上的公開指南、文章、推薦地圖與講師介紹入口。',
    inputSchema: z.object({
      kind: z.enum(['all', 'service_hub', 'directory', 'guide', 'article_index', 'people']).default('all'),
    }),
    outputSchema: publicOutputSchema,
    annotations: readOnlyAnnotations,
  },
  async ({ kind }) => {
    const resources = publicResources.filter((resource) => kind === 'all' || resource.kind === kind);
    return {
      content: [{ type: 'text', text: `找到 ${resources.length} 個公開資源入口。` }],
      structuredContent: { ok: true, websiteUrl: SITE_URL, resources },
    };
  },
);

const transport = new WebStandardStreamableHTTPServerTransport({
  sessionIdGenerator: undefined,
  enableJsonResponse: true,
});
await server.connect(transport);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const pathname = new URL(req.url).pathname.replace(/\/$/, '');
  if (req.method === 'GET' && pathname.endsWith('/mcp/health')) {
    return jsonResponse({
      ok: true,
      name: 'ADHD 家長支持平台公開資料',
      version: '1.0.0',
      privacy: 'public-read-only',
      websiteUrl: SITE_URL,
    });
  }
  try {
    return withCors(await transport.handleRequest(req));
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: 'MCP_REQUEST_FAILED' }, 500);
  }
});
