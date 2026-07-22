import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listContacts, listInbox, listTasks } from '../operations/api';
import type { ContactRecord, FollowUpTask, OperationalThread } from '../operations/types';
import { EmptyPanel, InlineSpinner, MetricCard, OpsNotice, PageHeader, StatusPill } from '../operations/components';

export default function OperationsOverviewPage() {
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [tasks, setTasks] = useState<FollowUpTask[]>([]);
  const [threads, setThreads] = useState<OperationalThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    Promise.all([listContacts(), listTasks(), listInbox()])
      .then(([people, work, mail]) => { setContacts(people); setTasks(work); setThreads(mail); })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : '讀取行政總覽失敗'))
      .finally(() => setLoading(false));
  }, []);

  const registrations = useMemo(() => contacts.flatMap((item) => item.registrations), [contacts]);
  const activeTasks = tasks.filter((task) => !['done', 'cancelled'].includes(task.status));
  const overdue = activeTasks.filter((task) => task.dueAt && new Date(task.dueAt) < new Date());
  const unread = threads.filter((thread) => thread.hasUnread || thread.needsReply);
  const pending = registrations.filter((registration) => ['pending', 'reviewing', 'waitlist'].includes(registration.status));

  return (
    <section className="ops-section">
      <PageHeader eyebrow="行政工作台" title="今天需要處理什麼？" description="把報名、回信、追蹤與個案工作集中在同一個入口。" />
      {error ? <OpsNotice tone="danger" role="alert">{error}</OpsNotice> : null}
      {loading ? <InlineSpinner label="整理行政工作中…" /> : <>
        <div className="ops-metrics">
          <MetricCard label="待審報名" value={pending.length} detail="含審核中與候補" tone="yellow" />
          <MetricCard label="待回覆信件" value={unread.length} detail="未讀或需要回覆" tone="coral" />
          <MetricCard label="逾期追蹤" value={overdue.length} detail={`共 ${activeTasks.length} 件進行中`} tone="blue" />
          <MetricCard label="人物主檔" value={contacts.length} detail={`${registrations.length} 筆歷次報名`} tone="green" />
        </div>
        <div className="ops-grid ops-grid--2">
          <article className="ops-panel">
            <div className="ops-panel-header"><div><p className="ops-eyebrow">優先佇列</p><h2>需要立即跟進</h2></div><Link to="/admin/tasks">全部待辦</Link></div>
            {activeTasks.length ? <div className="ops-list">{activeTasks.slice(0, 6).map((task) => (
              <div className="ops-list-row" key={task.id}><div><strong>{task.title}</strong><p>{task.dueAt ? new Date(task.dueAt).toLocaleString('zh-TW') : '未設定期限'}</p></div><StatusPill tone={task.priority === 'urgent' ? 'red' : task.priority === 'high' ? 'yellow' : 'gray'}>{task.priority}</StatusPill></div>
            ))}</div> : <EmptyPanel title="目前沒有追蹤待辦" description="從人物、報名或個案頁建立下一步。" />}
          </article>
          <article className="ops-panel">
            <div className="ops-panel-header"><div><p className="ops-eyebrow">整合信箱</p><h2>待回覆對話</h2></div><Link to="/admin/inbox">開啟收件匣</Link></div>
            {unread.length ? <div className="ops-list">{unread.slice(0, 6).map((thread) => (
              <Link className="ops-list-row" to={`/admin/inbox?thread=${thread.id}`} key={thread.id}><div><strong>{thread.subject || '（無主旨）'}</strong><p>{thread.counterpartEmail}</p></div><StatusPill tone={thread.hasUnread ? 'coral' : 'yellow'}>{thread.hasUnread ? '未讀' : '待回覆'}</StatusPill></Link>
            ))}</div> : <EmptyPanel title="信件已處理完畢" />}
          </article>
        </div>
        <div className="ops-grid ops-grid--3">
          <Link className="ops-quick-link" to="/admin/registrations"><strong>審核報名</strong><span>狀態、分派、轉場與轉案</span></Link>
          <Link className="ops-quick-link" to="/admin/people"><strong>人物主檔</strong><span>跨活動歷程、註記與聯絡</span></Link>
          <Link className="ops-quick-link" to="/admin/activities"><strong>建立活動</strong><span>串接場次、表單與報名</span></Link>
        </div>
      </>}
    </section>
  );
}
