-- 範本改動要留歷程。
--
-- 範本是會原封不動寄給真人的文字，改了目前零軌跡：誰把哪一封改成什麼、什麼時候改的，
-- 事後查不到。聯絡人（000017）、報名（000014）、場次（000016）都已經有稽核，範本沒有。
--
-- 只記「範本名稱」與「哪些欄位有變動」，不記全文：
--   * 稽核表不是版本庫，塞進兩千字的信件全文會讓它變得沒人願意讀
--   * 信件全文含對報名者的稱呼與情境描述，逐版留存等於在稽核表裡累積個資
-- 要回溯內容請看 git 裡的種子 migration 與後台的當前值。
--
-- 純新增：一個函式、一個 trigger、不動任何既有資料列。

create or replace function public.log_email_template_edit()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  changed text[] := array[]::text[];
begin
  if new.name is distinct from old.name then changed := changed || 'name'; end if;
  if new.subject is distinct from old.subject then changed := changed || 'subject'; end if;
  if new.body is distinct from old.body then changed := changed || 'body'; end if;
  if new.review_status is distinct from old.review_status then changed := changed || 'review_status'; end if;
  if new.letter_kind is distinct from old.letter_kind then changed := changed || 'letter_kind'; end if;
  if new.project_id is distinct from old.project_id then changed := changed || 'project_id'; end if;

  if cardinality(changed) = 0 then return new; end if;

  insert into public.audit_log (action, actor_id, target_type, target_id, result, detail)
  values ('email_template_edit', auth.uid(), 'email_template', new.id::text, 'success',
    jsonb_build_object(
      -- 改名的話兩個名字都留，否則事後對不上「那時候那封叫什麼」。
      'name', new.name,
      'previous_name', case when new.name is distinct from old.name then old.name else null end,
      'changed', to_jsonb(changed)
    )::text);
  return new;
end;
$$;

drop trigger if exists trg_email_templates_audit on public.email_templates;
create trigger trg_email_templates_audit
  after update on public.email_templates
  for each row execute function public.log_email_template_edit();

-- 新增與刪除也要留：刪掉一封範本目前同樣無聲無息。
create or replace function public.log_email_template_life()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.audit_log (action, actor_id, target_type, target_id, result, detail)
  values (
    case when tg_op = 'DELETE' then 'email_template_delete' else 'email_template_create' end,
    auth.uid(), 'email_template',
    case when tg_op = 'DELETE' then old.id::text else new.id::text end,
    'success',
    jsonb_build_object('name', case when tg_op = 'DELETE' then old.name else new.name end)::text);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_email_templates_life on public.email_templates;
create trigger trg_email_templates_life
  after insert or delete on public.email_templates
  for each row execute function public.log_email_template_life();
