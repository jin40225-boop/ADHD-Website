begin;

drop index if exists public.email_messages_gmail_uidx;
create unique index email_messages_gmail_uidx
  on public.email_messages (gmail_message_id);

commit;
