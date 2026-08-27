/**
 * 共用場次名冊抽屜。
 *
 * 一個場次點開來，要看得到「這場有誰、他們的背景、他們要的是什麼」，並且能一鍵變成
 * 信件素材或一份名冊檔。以前這三件事分別散在報名工作台、文件產生中心與人員主檔，
 * 而「這場有誰」這個最基本的問題反而只有一行姓名。
 *
 * **元件內不發任何查詢**——資料全部由宿主頁以 props 餵進來。這樣同一個面板掛到
 * 報名審核頁時不會多打一次資料庫；面板一旦自己會抓資料，掛在哪裡就會多一份請求，
 * 而它本來就只是把宿主已經有的東西換個角度呈現。
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { FormSchema, Project, SessionSlot } from '@contracts/types';
import { WarmButton } from '@/components/ui/WarmButton/WarmButton';
import { EmptyPanel, OpsNotice } from './components';
import { STATUS_LABEL, textAnswer } from './RegistrationTable';
import { answerLabel, buildAnswerLabelIndex, childSummaryText, issueText } from './answerLabels';
import { buildRosterCsv, displayNameOf, downloadCsv, type RosterExportRow } from './exportCsv';

/**
 * 行前通知採「整批寄」的服務線。
 *
 * **刻意不重用 `RegistrationTable.tsx` 的 `MULTI_SESSION_SLUGS`**：那一條的語意是
 * 「這條線允許一人佔多場」（名額規則），這一條的語意是「這條線的通知是聚會型、整批寄」
 * （通知方式）。今天兩份清單的內容剛好都只有 `peer-group`，但它們回答的是不同問題——
 * 哪天多開一條「一人可報多場的個別諮詢」，共用同一個常數就會讓那條線的家長
 * 收到一封群發的行前信，而信裡沒有他自己的時段。
 */
export const GROUP_SESSION_SLUGS = ['peer-group'];

export interface SessionRosterPanelProps {
  session: SessionSlot;
  /** 這個場次所屬的服務線；`slug` 決定寄信分流。 */
  project?: Project;
  /** 由宿主頁的 `rosterOf(session.id)` 產出；面板不自己算，也不改那段邏輯。 */
  roster: RosterExportRow[];
  /** 全部場次；答案裡的場次 UUID 靠它換成看得懂的標題與時間。 */
  sessions: SessionSlot[];
  /** `adminListFormSchemas()` 的回傳值；沒有就退回顯示原始 key，不猜中文。 */
  schemas?: Record<string, FormSchema>;
}

type TabKey = 'roster' | 'digest' | 'mail';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'roster', label: '名冊' },
  { key: 'digest', label: '彙整' },
  { key: 'mail', label: '寄信' },
];

/** 場次已經過去了嗎？狀態或結束時間任一成立即是。 */
export function isSessionOver(session: SessionSlot, now = Date.now()) {
  return session.status === 'done' || session.status === 'cancelled' || new Date(session.endsAt).getTime() < now;
}

const ISSUE_PREVIEW_LENGTH = 40;

export function SessionRosterPanel({ session, project, roster, sessions, schemas }: SessionRosterPanelProps) {
  const [tab, setTab] = useState<TabKey>('roster');
  const [copied, setCopied] = useState<'lecturer' | 'full' | 'failed'>();

  const labelIndex = useMemo(() => buildAnswerLabelIndex(schemas), [schemas]);
  const sessionById = useMemo(() => new Map(sessions.map((item) => [item.id, item])), [sessions]);
  const labelOf = useMemo(() => (key: string) => answerLabel(labelIndex, session.projectId, key), [labelIndex, session.projectId]);
  const subLabelOf = useMemo(
    () => (groupKey: string, subKey: string) => answerLabel(labelIndex, session.projectId, `${groupKey}.${subKey}`),
    [labelIndex, session.projectId],
  );
  const statusLabelOf = (status: string) => STATUS_LABEL[status] ?? status;

  const exportName = (suffix: string) => {
    const start = new Date(session.startsAt);
    return `名冊_${session.title}_${start.getMonth() + 1}${start.getDate()}_${suffix}.csv`;
  };
  const download = (share: boolean) => downloadCsv(
    exportName(share ? '講師版' : '全欄位'),
    buildRosterCsv(roster, { sessionById, labelOf, subLabelOf, statusLabelOf, share }),
  );

  /** 一個人一段。`withContact` 才帶信箱電話——講師拿到的那一份不該有聯絡方式。 */
  const digestOf = (row: RosterExportRow, withContact: boolean) => {
    const registration = row.registration;
    const attendMode = textAnswer(registration, 'attendMode');
    const attendWith = textAnswer(registration, 'attendWith');
    const contactTimes = [textAnswer(registration, 'contactTimes'), textAnswer(registration, 'contactTimeNote')].filter(Boolean).join('／');
    const lines = [
      `稱呼：${displayNameOf(row) || '—'}`,
      `出席方式：${attendMode ? `${attendMode}${attendWith ? `・${attendWith}` : ''}` : '—'}`,
      `方便聯繫時段：${contactTimes || '—'}`,
      `孩子概況：${childSummaryText(registration) || '—'}`,
      `最想處理的一件事：${issueText(registration) || '—'}`,
    ];
    if (withContact) {
      lines.push(`Email：${registration.email || row.contact.primaryEmail || '—'}`);
      lines.push(`電話：${textAnswer(registration, 'phone') || row.contact.phone || '—'}`);
    }
    return lines.join('\n');
  };
  const digestText = (withContact: boolean) => roster.map((row) => digestOf(row, withContact)).join('\n\n');

  // 剪貼簿寫法與 `src/components/CopyButton.tsx` 相同（writeText ＋ 成功／失敗回饋），
  // 但不 import 那個元件：它帶的是前台的 tailwind 樣式，搬進後台會長得像另一個站。
  const copy = async (kind: 'lecturer' | 'full') => {
    try {
      await navigator.clipboard.writeText(digestText(kind === 'full'));
      setCopied(kind);
    } catch {
      // 瀏覽器拒絕存取剪貼簿時要講出來，不能靜默失敗讓按鈕看起來是壞的。
      setCopied('failed');
    }
    setTimeout(() => setCopied(undefined), 1800);
  };

  return <>
    <div className="ops-tabs">{TABS.map((item) => <button
      type="button" key={item.key}
      className={`ops-tab ${item.key === tab ? 'ops-tab--active' : ''}`}
      onClick={() => setTab(item.key)}
    >{item.label}{item.key === 'roster' ? <small>{roster.length}</small> : null}</button>)}</div>

    {!roster.length ? <EmptyPanel title="這個場次還沒有報名" description="有人報名後，名冊、彙整與寄信入口都會在這裡出現。" /> : tab === 'roster' ? <>
      <div className="ops-list">{roster.map((row) => {
        const child = childSummaryText(row.registration);
        const issue = issueText(row.registration);
        const preview = issue.length > ISSUE_PREVIEW_LENGTH ? `${issue.slice(0, ISSUE_PREVIEW_LENGTH)}…` : issue;
        return <div className="ops-list-row" key={row.registration.id}>
          <span>
            <strong>{displayNameOf(row)}</strong>
            <small>{[child, preview].filter(Boolean).join('｜') || '尚未填寫孩子與議題'}</small>
          </span>
          <span className="ops-list-meta">
            <span className="ops-status ops-status--blue">{statusLabelOf(row.registration.status)}</span>
            {/* 名額判準只看 capacityReleasedAt：有值＝已釋放，沒值＝還佔著。不從狀態推。 */}
            <span className={`ops-status ops-status--${row.registration.capacityReleasedAt ? 'gray' : 'green'}`}>
              {row.registration.capacityReleasedAt ? '不佔名額' : '佔名額'}
            </span>
          </span>
        </div>;
      })}</div>
      <div className="ops-button-row">
        <WarmButton size="sm" onClick={() => download(false)}>下載名冊 CSV（全欄位）</WarmButton>
        <WarmButton size="sm" variant="secondary" onClick={() => download(true)}>下載講師版 CSV（不含聯絡方式）</WarmButton>
      </div>
    </> : tab === 'digest' ? <>
      <OpsNotice tone="info">這段可直接貼進「講師行前通知信」。</OpsNotice>
      <pre className="ops-cell-muted" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{digestText(false)}</pre>
      <div className="ops-button-row">
        <WarmButton size="sm" onClick={() => void copy('lecturer')}>
          {copied === 'lecturer' ? '已複製' : copied === 'failed' ? '請手動複製' : '複製講師信素材（不含聯絡方式）'}
        </WarmButton>
        <WarmButton size="sm" variant="secondary" onClick={() => void copy('full')}>
          {copied === 'full' ? '已複製' : copied === 'failed' ? '請手動複製' : '複製完整彙整（含 Email／電話）'}
        </WarmButton>
      </div>
    </> : <SessionMailEntry session={session} project={project} roster={roster} statusLabelOf={statusLabelOf} />}
  </>;
}

/**
 * 寄信入口。這裡不做寄信 UI，只把人帶到對的面板——**分流由場次自己決定**，
 * 不要求使用者記得「哪條線是整批、哪條線是一人一封」。
 */
export function SessionMailEntry({ session, project, roster, statusLabelOf }: {
  session: SessionSlot;
  project?: Project;
  roster: RosterExportRow[];
  statusLabelOf: (status: string) => string;
}) {
  // 已結束的場次關掉群發入口：對一場已經開完的聚會再寄一次行前信，是這個入口
  // 最容易造成的實際傷害。名冊與匯出照舊——歷史名冊還是要查得到。
  if (isSessionOver(session)) {
    return <OpsNotice tone="warning">場次已結束，群發入口已關閉；名冊與匯出仍可使用。</OpsNotice>;
  }
  if (GROUP_SESSION_SLUGS.includes(project?.slug ?? '')) {
    return <>
      <OpsNotice tone="info">本場屬聚會型，行前信整批寄。</OpsNotice>
      <div className="ops-button-row">
        <Link className="ui-button ui-button--primary ui-button--sm" to={`/admin/documents?session=${session.id}&bulk=1`}>開整批寄信面板</Link>
      </div>
    </>;
  }
  return <>
    <OpsNotice tone="info">本場屬諮詢型，行前信一人一封、各自帶時段。</OpsNotice>
    <div className="ops-list">{roster.map((row) => <div className="ops-list-row" key={row.registration.id}>
      <span><strong>{displayNameOf(row)}</strong><small>{statusLabelOf(row.registration.status)}</small></span>
      <Link className="ops-link-button" to={`/admin/registrations?registration=${row.registration.id}`}>開這個人的寄信面板</Link>
    </div>)}</div>
  </>;
}
