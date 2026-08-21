-- 考研词汇应用初始 Schema
-- 用户数据只保存在 Supabase，不入 GitHub。

create extension if not exists "pgcrypto";

-- 自动更新 updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 注册时自动创建 profile
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.user_words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  term text not null,
  normalized_term text not null,
  source_vocab_key text,
  part_of_speech text,
  meanings jsonb not null default '[]',
  notes text,
  tags jsonb not null default '[]',
  status text not null default 'new',
  fsrs_card jsonb,
  next_review_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_words_user_term_unique unique (user_id, normalized_term)
);

create trigger user_words_set_updated_at
  before update on public.user_words
  for each row execute function public.set_updated_at();

create table public.review_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  user_word_id uuid not null references public.user_words (id) on delete cascade,
  normalized_term text not null,
  rating integer not null,
  answered_correctly boolean not null default false,
  elapsed_ms integer not null default 0,
  reviewed_at timestamptz not null default now()
);

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null,
  word_ids jsonb not null default '[]',
  current_index integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  daily_new_goal integer not null default 24,
  daily_review_goal integer not null default 50,
  theme text not null default 'system',
  sound_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();
