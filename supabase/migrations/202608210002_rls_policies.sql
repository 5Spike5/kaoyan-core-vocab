-- RLS 策略：所有用户数据表只允许本人读写

alter table public.profiles enable row level security;
alter table public.user_words enable row level security;
alter table public.review_logs enable row level security;
alter table public.study_sessions enable row level security;
alter table public.user_settings enable row level security;

-- profiles：本人可读写自己的资料
create policy "profiles select own"
on public.profiles
for select
using (id = auth.uid());

create policy "profiles update own"
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "profiles insert own"
on public.profiles
for insert
with check (id = auth.uid());

-- user_words
create policy "users manage own words"
on public.user_words
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- review_logs
create policy "users manage own review logs"
on public.review_logs
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- study_sessions
create policy "users manage own study sessions"
on public.study_sessions
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- user_settings
create policy "users manage own settings"
on public.user_settings
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- 查询索引
create index if not exists user_words_user_id_idx on public.user_words (user_id);
create index if not exists user_words_normalized_term_idx on public.user_words (normalized_term);
create index if not exists user_words_next_review_at_idx on public.user_words (next_review_at);
create index if not exists review_logs_user_id_idx on public.review_logs (user_id);
create index if not exists review_logs_reviewed_at_idx on public.review_logs (reviewed_at);
create index if not exists study_sessions_user_id_idx on public.study_sessions (user_id);
