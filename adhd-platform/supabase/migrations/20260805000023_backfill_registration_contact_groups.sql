-- 報名者類群補齊：把既有報名的聯絡人加進對應專案的報名者類群。
--
-- 為什麼是空的：`trg_registration_contact_group` 是 `after insert or update of contact_id`，
-- 而它和那三個報名者類群都是 20260804000002 才建立的。在那之前就存在的報名不曾 insert、
-- 也不曾改過 contact_id，所以從來沒有觸發過——系統裡 64 筆報名，三個報名者類群全是 0 人。
-- 後果不是顯示問題：對報名者群發會寄給零個人。
--
-- 新報名沒有這個問題：`trg_registration_contact`（before insert）會先補上 contact_id，
-- 接著 `trg_registration_contact_group`（after insert）就看得到它。順序是對的。
--
-- 這支只做 insert，且與 trigger 的行為逐字相同（同樣的類群比對、同樣 source='auto'、
-- 同樣 on conflict do nothing）。不動 registrations、不動 contacts、不刪任何東西。
-- source='auto' 因此不會進稽核，與自動歸群一致（稽核只記人為的加入與所有移出）。
--
-- ⚠ 與 trigger 一樣**不看報名狀態**：退回／取消／中途放棄的人也會被加進報名者類群。
--    要改成只收活躍狀態的話，trigger 也要一起改（它在 status='pending' 時就把人加進去了），
--    那是另一個決定，不在這支裡面做。
insert into public.contact_group_members (group_id, contact_id, source)
select distinct g.id, r.contact_id, 'auto'
from public.registrations r
join public.contact_groups g
  on g.auto_rule = 'registration'
 and g.project_id = r.project_id
where r.contact_id is not null
on conflict (group_id, contact_id) do nothing;
