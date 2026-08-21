-- 应用使用字符串 ID（本地 IndexedDB 与云端数据保持一致），
-- 将三张用户表的 id 列从 uuid 调整为 text。
-- user_id 仍保持 uuid（引用 auth.users.id，对应登录用户）。

-- review_logs 的外键引用 user_words.id，先拆除再重建
alter table public.review_logs
  drop constraint if exists review_logs_user_word_id_fkey;

alter table public.user_words
  alter column id drop default;
alter table public.user_words
  alter column id type text;

alter table public.review_logs
  alter column id drop default;
alter table public.review_logs
  alter column id type text;
alter table public.review_logs
  alter column user_word_id type text;

alter table public.study_sessions
  alter column id drop default;
alter table public.study_sessions
  alter column id type text;

alter table public.review_logs
  add constraint review_logs_user_word_id_fkey
  foreign key (user_word_id) references public.user_words (id) on delete cascade;
