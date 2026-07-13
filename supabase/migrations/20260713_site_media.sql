-- Home hero media configuration and its dedicated public Storage bucket.
-- This migration is incremental and intentionally does not touch model data.

create table if not exists public.site_settings (
  id text primary key,
  hero_desktop_image text,
  hero_mobile_image text,
  hero_desktop_video text,
  hero_mobile_video text,
  updated_at timestamptz not null default now(),
  constraint site_settings_home_only check (id = 'home')
);

alter table public.site_settings
  add column if not exists hero_desktop_image text,
  add column if not exists hero_mobile_image text,
  add column if not exists hero_desktop_video text,
  add column if not exists hero_mobile_video text,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  alter table public.site_settings
    add constraint site_settings_home_only check (id = 'home');
exception
  when duplicate_object then null;
end $$;

drop trigger if exists set_site_settings_updated_at on public.site_settings;
create trigger set_site_settings_updated_at
  before update on public.site_settings
  for each row execute function public.set_updated_at();

alter table public.site_settings enable row level security;

drop policy if exists "Public read site settings" on public.site_settings;
drop policy if exists "Super admins update site settings" on public.site_settings;
create policy "Public read site settings"
  on public.site_settings
  for select
  to anon, authenticated
  using (id = 'home');
create policy "Super admins update site settings"
  on public.site_settings
  for update
  to authenticated
  using (id = 'home' and public.is_super_admin())
  with check (id = 'home' and public.is_super_admin());

revoke all on public.site_settings from anon, authenticated;
grant select on public.site_settings to anon, authenticated;
grant update (hero_desktop_image, hero_mobile_image, hero_desktop_video, hero_mobile_video) on public.site_settings to authenticated;

insert into public.site_settings (id)
values ('home')
on conflict (id) do nothing;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'site-media',
  'site-media',
  true,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read site media" on storage.objects;
drop policy if exists "Super admins upload site media" on storage.objects;
drop policy if exists "Super admins update site media" on storage.objects;
drop policy if exists "Super admins delete site media" on storage.objects;
create policy "Public read site media"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'site-media');
create policy "Super admins upload site media"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'site-media'
    and (storage.foldername(name))[1] = 'hero'
    and public.is_super_admin()
  );
create policy "Super admins update site media"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'site-media'
    and (storage.foldername(name))[1] = 'hero'
    and public.is_super_admin()
  )
  with check (
    bucket_id = 'site-media'
    and (storage.foldername(name))[1] = 'hero'
    and public.is_super_admin()
  );
create policy "Super admins delete site media"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'site-media'
    and (storage.foldername(name))[1] = 'hero'
    and public.is_super_admin()
  );
