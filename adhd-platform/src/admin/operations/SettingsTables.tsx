import { useEffect, useState } from 'react';
import type { ContactGroupRecord, ContactRecord } from './types';

/** 離開欄位才送出；沒改、或改成空白（信箱是名冊比對鍵）就還原，不打資料庫。 */
function TextCell({ value, onCommit, type = 'text', allowEmpty = false, disabled }: {
  value: string; onCommit: (next: string) => void; type?: 'text' | 'email' | 'tel'; allowEmpty?: boolean; disabled?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  const commit = () => {
    const next = draft.trim();
    if (next === value.trim() || (!next && !allowEmpty)) { setDraft(value); return; }
    onCommit(next);
  };
  return <input
    className="ops-cell-text" type={type} value={draft} disabled={disabled}
    onChange={(e) => setDraft(e.target.value)} onBlur={commit}
    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setDraft(value); }}
  />;
}

export interface ContactTableHandlers {
  busyId?: string;
  onPatch: (contact: ContactRecord, patch: { primaryEmail?: string; phone?: string; displayName?: string; isFavorite?: boolean }) => void;
}

export function ContactTable({ contacts, handlers }: { contacts: ContactRecord[]; handlers: ContactTableHandlers }) {
  const { busyId, onPatch } = handlers;
  return <div className="ops-table-wrap">
    <table className="ops-table ops-table--editable">
      <thead><tr><th>稱呼（可改）</th><th>角色標籤</th><th>✉ 信箱（可改）</th><th>📱 電話（可改）</th><th>常用・置頂</th></tr></thead>
      <tbody>{contacts.map((contact) => {
        const busy = busyId === contact.id;
        return <tr key={contact.id} className={busy ? 'ops-row--busy' : undefined}>
          <td><TextCell value={contact.displayName} disabled={busy} onCommit={(displayName) => onPatch(contact, { displayName })} /></td>
          <td>{contact.tags.length
            ? <span className="ops-chip-row">{contact.tags.map((tag) => <span className="ops-status ops-status--gray" key={tag}>{tag}</span>)}</span>
            : <span className="ops-cell-muted">—</span>}</td>
          <td><TextCell type="email" value={contact.primaryEmail ?? ''} disabled={busy} onCommit={(primaryEmail) => onPatch(contact, { primaryEmail })} /></td>
          <td><TextCell type="tel" value={contact.phone ?? ''} allowEmpty disabled={busy} onCommit={(phone) => onPatch(contact, { phone })} /></td>
          <td><input
            type="checkbox" className="ops-cell-check" checked={contact.isFavorite} disabled={busy}
            title={contact.isFavorite ? '常用聯絡人：置頂並出現在寄件人／副本選單' : '設為常用聯絡人'}
            onChange={(e) => onPatch(contact, { isFavorite: e.target.checked })}
          /></td>
        </tr>;
      })}</tbody>
    </table>
  </div>;
}

const AUTO_RULE_TEXT: Record<string, string> = {
  registration: '自動歸群：該計畫報名成立時，報名者自動加入',
  instructor: '自動歸群：指派為講師時自動加入',
  manual: '僅手動維護',
};

export interface GroupEditorHandlers {
  busyKey?: string;
  onToggleMember: (group: ContactGroupRecord, contactId: string, member: boolean) => void;
}

export function GroupEditor({ groups, contacts, handlers }: { groups: ContactGroupRecord[]; contacts: ContactRecord[]; handlers: GroupEditorHandlers }) {
  const { busyKey, onToggleMember } = handlers;
  const nameOf = (contactId: string) => {
    const contact = contacts.find((item) => item.id === contactId);
    return contact ? contact.displayName || contact.primaryEmail || contactId : contactId;
  };
  return <div className="ops-group-list">{groups.map((group) => {
    const busy = busyKey === group.id;
    const memberIds = new Set(group.members.map((member) => member.contactId));
    return <section className="ops-group" key={group.id}>
      <header>
        <div>
          <strong>{group.name}</strong>
          {group.isSystem ? <span className="ops-status ops-status--blue">系統類群</span> : null}
          <span className="ops-status ops-status--gray">{group.members.length} 人</span>
        </div>
        <small>{group.description ?? ''}{group.autoRule ? `｜${AUTO_RULE_TEXT[group.autoRule] ?? group.autoRule}` : ''}</small>
      </header>
      {group.members.length ? <div className="ops-chip-row">{group.members.map((member) => <span className="ops-member-chip" key={member.contactId}>
        {nameOf(member.contactId)}
        <span className="ops-cell-legacy">{member.source === 'auto' ? '自動' : '手動'}</span>
        <button type="button" disabled={busy} title="移出類群" onClick={() => onToggleMember(group, member.contactId, false)}>✕</button>
      </span>)}</div> : <p className="ops-cell-muted">這個類群還沒有成員。</p>}
      <label className="ops-inline-check">
        <span className="ops-cell-muted">加入聯絡人</span>
        <select className="ops-cell-select ops-cell-select--gray" value="" disabled={busy} onChange={(e) => { if (e.target.value) onToggleMember(group, e.target.value, true); }}>
          <option value="">選擇…</option>
          {contacts.filter((contact) => !memberIds.has(contact.id)).map((contact) => <option key={contact.id} value={contact.id}>
            {contact.displayName || contact.primaryEmail || contact.id}
          </option>)}
        </select>
      </label>
    </section>;
  })}</div>;
}
