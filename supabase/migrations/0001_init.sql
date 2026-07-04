-- ═══════════════════════════════════════════════════════════════
-- LINEスタンプメーカー DBスキーマ + RLS（仕様書 6章 / 7章準拠）
-- Supabase SQL Editor またはCLIで実行する。
-- ═══════════════════════════════════════════════════════════════

-- 拡張
create extension if not exists pgcrypto;

-- ── enum型 ──
do $$ begin
  create type user_role as enum ('admin', 'user');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_state as enum ('active', 'suspended', 'pending');
exception when duplicate_object then null; end $$;
-- 既存DBへの追加（申請制対応）
do $$ begin
  alter type user_state add value if not exists 'pending';
exception when others then null; end $$;

do $$ begin
  create type invite_state as enum ('unused', 'registered', 'expired', 'revoked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type project_status as enum
    ('draft','preview_generating','preview_review','main_generating','full_review','completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type image_review_state as enum ('unconfirmed','ok','regen_requested');
exception when duplicate_object then null; end $$;

do $$ begin
  create type request_kind as enum ('clothing','regen','monthly');
exception when duplicate_object then null; end $$;

do $$ begin
  create type request_state as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;

-- ═══════════════ ユーザー情報（profiles） ═══════════════
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  role user_role not null default 'user',
  state user_state not null default 'active',
  monthly_set_limit int not null default 2,
  regen_limit int not null default 5,
  clothing_limit int not null default 3,
  created_at timestamptz not null default now()
);

-- ═══════════════ 招待リンク（invites） ═══════════════
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  label text not null default '',
  token text not null unique,
  state invite_state not null default 'unused',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  registered_user_id uuid references auth.users(id) on delete set null
);
create index if not exists invites_token_idx on public.invites(token);

-- ═══════════════ スタンププロジェクト（projects） ═══════════════
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  phrases jsonb not null default '[]'::jsonb,
  status project_status not null default 'draft',
  regen_remaining int not null default 5,
  clothing_remaining int not null default 3,
  redo_used boolean not null default false,          -- S5 やり直し無料枠（1回）使用済みか
  cost_notice_shown boolean not null default false,  -- F11 費用お知らせ初回表示制御
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists projects_owner_idx on public.projects(owner_id);

-- ═══════════════ 生成画像（stamp_images） ═══════════════
create table if not exists public.stamp_images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  slot text not null,                       -- '01'..'16' / 'main' / 'tab'
  storage_path text,
  review_state image_review_state not null default 'unconfirmed',
  regen_count int not null default 0,
  clothing_history jsonb not null default '[]'::jsonb,
  prev_storage_path text,                   -- 直前1世代（元にもどす用）
  delete_after timestamptz,                 -- 完成から90日
  updated_at timestamptz not null default now(),
  unique (project_id, slot)
);
create index if not exists stamp_images_project_idx on public.stamp_images(project_id);
create index if not exists stamp_images_delete_idx on public.stamp_images(delete_after);

-- ═══════════════ アップロード写真（upload_photos） ═══════════════
create table if not exists public.upload_photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now(),
  delete_after timestamptz                  -- 生成完了+7日
);
create index if not exists upload_photos_delete_idx on public.upload_photos(delete_after);

-- ═══════════════ 追加枠申請（quota_requests） ═══════════════
create table if not exists public.quota_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade, -- 月間枠はnull
  kind request_kind not null,
  reason text,
  state request_state not null default 'pending',
  grant_count int,
  reject_reason text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists quota_requests_state_idx on public.quota_requests(state);
-- 同一セット・同一枠（服装変更／再生成）の申請中の重複を防ぐ（F10）
create unique index if not exists quota_requests_pending_uniq
  on public.quota_requests(project_id, kind)
  where state = 'pending' and project_id is not null;
-- 月間セット枠：ユーザーあたり申請中1件まで（F10）
create unique index if not exists quota_requests_monthly_uniq
  on public.quota_requests(requester_id)
  where state = 'pending' and kind = 'monthly';

-- ═══════════════ 生成ログ（gen_logs） ═══════════════
create table if not exists public.gen_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  kind text not null,                       -- preview/main/regen/clothing
  success boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists gen_logs_user_idx on public.gen_logs(user_id, created_at);
create index if not exists gen_logs_project_idx on public.gen_logs(project_id);

-- ═══════════════ アプリ設定（app_settings：単一行） ═══════════════
create table if not exists public.app_settings (
  id int primary key default 1,
  price_per_image int not null default 40,
  price_per_clothing int not null default 20,
  cost_message text not null default
    'おつかれさまでした！🎉 このアプリはAI画像生成ツール（GPT Image）を使ってスタンプを作っています。今回のスタンプ作成には {amount} の費用がかかりました（管理者が負担しています）。',
  invite_template text not null default
    'スタンプを自分で作れるアプリを作りました🎨 しゃしんと5つの質問に答えるだけで、自分のLINEスタンプが作れます。使ってみたい人は返信してください！',
  invite_message text not null default
    'お待たせしました！こちらから登録してください（7日間有効です）→ {link}',
  constraint app_settings_singleton check (id = 1)
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;

-- ═══════════════════════════════════════════════════════════════
-- 補助関数：現在ユーザーが管理者か（RLS内で使用）
-- ═══════════════════════════════════════════════════════════════
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- 現在ユーザーが該当プロジェクトの所有者か
create or replace function public.owns_project(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.projects p
    where p.id = pid and p.owner_id = auth.uid()
  );
$$;

-- ═══════════════════════════════════════════════════════════════
-- RLS（7章：一般＝自分のみ／管理者＝全件参照）
-- ═══════════════════════════════════════════════════════════════
alter table public.profiles       enable row level security;
alter table public.invites        enable row level security;
alter table public.projects       enable row level security;
alter table public.stamp_images   enable row level security;
alter table public.upload_photos  enable row level security;
alter table public.quota_requests enable row level security;
alter table public.gen_logs       enable row level security;
alter table public.app_settings   enable row level security;

-- profiles：本人は自分の行を参照/更新、管理者は全件参照。役割・状態・上限の変更は管理者のみ。
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_admin());

-- 役割・状態・上限の変更は管理者のみ（一般ユーザーの自己昇格を防ぐ）。
-- 本アプリではユーザーによるプロフィール自己編集UIは無いため、更新は管理者に限定する。
drop policy if exists profiles_update_self on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- invites：管理者のみ全操作可（登録時のトークン検証はサーバーのservice_roleで実施）。
drop policy if exists invites_admin_all on public.invites;
create policy invites_admin_all on public.invites for all
  using (public.is_admin())
  with check (public.is_admin());

-- projects：所有者は自分のものをCRUD、管理者は参照可。
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select
  using (owner_id = auth.uid() or public.is_admin());
drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects for insert
  with check (owner_id = auth.uid());
drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects for delete
  using (owner_id = auth.uid() or public.is_admin());

-- stamp_images：所属プロジェクトの所有者、または管理者。
drop policy if exists stamp_images_select on public.stamp_images;
create policy stamp_images_select on public.stamp_images for select
  using (public.owns_project(project_id) or public.is_admin());
drop policy if exists stamp_images_mod on public.stamp_images;
create policy stamp_images_mod on public.stamp_images for all
  using (public.owns_project(project_id))
  with check (public.owns_project(project_id));

-- upload_photos：所属プロジェクトの所有者、または管理者。
drop policy if exists upload_photos_select on public.upload_photos;
create policy upload_photos_select on public.upload_photos for select
  using (public.owns_project(project_id) or public.is_admin());
drop policy if exists upload_photos_mod on public.upload_photos;
create policy upload_photos_mod on public.upload_photos for all
  using (public.owns_project(project_id))
  with check (public.owns_project(project_id));

-- quota_requests：申請者は自分の申請をCRUD、管理者は全件参照/更新。
drop policy if exists quota_requests_select on public.quota_requests;
create policy quota_requests_select on public.quota_requests for select
  using (requester_id = auth.uid() or public.is_admin());
drop policy if exists quota_requests_insert on public.quota_requests;
create policy quota_requests_insert on public.quota_requests for insert
  with check (requester_id = auth.uid());
drop policy if exists quota_requests_update_admin on public.quota_requests;
create policy quota_requests_update_admin on public.quota_requests for update
  using (public.is_admin())
  with check (public.is_admin());

-- gen_logs：本人参照、管理者全件参照。書き込みはサーバー（service_role）が担当。
drop policy if exists gen_logs_select on public.gen_logs;
create policy gen_logs_select on public.gen_logs for select
  using (user_id = auth.uid() or public.is_admin());

-- app_settings：全ログインユーザーが参照可（単価・文言表示に必要）、更新は管理者のみ。
drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings for select
  using (auth.uid() is not null);
drop policy if exists app_settings_update on public.app_settings;
create policy app_settings_update on public.app_settings for update
  using (public.is_admin())
  with check (public.is_admin());

-- ═══════════════════════════════════════════════════════════════
-- トリガー：auth.users 作成時に profiles を自動作成
-- （招待経由の登録時、raw_user_meta_data に display_name / invite_token を渡す）
-- ═══════════════════════════════════════════════════════════════
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════
-- Storageバケット（非公開）。署名付きURLでのみ配信する。
-- ═══════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public)
  values ('uploads', 'uploads', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public)
  values ('stamps', 'stamps', false) on conflict (id) do nothing;

-- Storageオブジェクトのアクセスは基本サーバー（service_role）経由。
-- 追加の防御として、認証ユーザーが自分のフォルダ配下のみ読める最低限のポリシーを付与。
-- パス規約: {user_id}/{project_id}/{file}
drop policy if exists storage_uploads_own on storage.objects;
create policy storage_uploads_own on storage.objects for select
  using (
    bucket_id in ('uploads','stamps')
    and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
  );
