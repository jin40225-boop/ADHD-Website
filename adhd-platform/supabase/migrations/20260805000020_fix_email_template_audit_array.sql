-- 修 019 的稽核 trigger：`changed := changed || 'letter_kind';` 會炸。
--
-- `text[] || 未標型別的字面值` 這個運算子是有歧義的，Postgres 解成 `anyarray || anyarray`，
-- 於是去把 'letter_kind' 當成陣列字面值解析：
--   ERROR: malformed array literal: "letter_kind" (SQLSTATE 22P02)
--
-- 六個分支全部是同一個寫法，所以**任何**一次範本更新都會失敗——trigger 是 after update，
-- 它一炸就把整筆 UPDATE 一起回滾。019 上線之後、這支之前，後台改任何一封範本都會被擋下。
-- （發現方式：跑標記 letter_kind 的那支 migration 時當場踩到，交易回滾，資料零變動。）
--
-- 改用 array_append，型別明確，沒有歧義可言。純取代函式，不動資料、不動 trigger 綁定。
create or replace function public.log_email_template_edit()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  changed text[] := array[]::text[];
begin
  if new.name is distinct from old.name then changed := array_append(changed, 'name'); end if;
  if new.subject is distinct from old.subject then changed := array_append(changed, 'subject'); end if;
  if new.body is distinct from old.body then changed := array_append(changed, 'body'); end if;
  if new.review_status is distinct from old.review_status then changed := array_append(changed, 'review_status'); end if;
  if new.letter_kind is distinct from old.letter_kind then changed := array_append(changed, 'letter_kind'); end if;
  if new.project_id is distinct from old.project_id then changed := array_append(changed, 'project_id'); end if;

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
