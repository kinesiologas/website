-- Responsive profile media for models, with dedicated public Storage buckets.
-- This migration is incremental and does not modify or seed existing model data.

begin;

alter table public.models
  add column if not exists cover_mobile_image text,
  add column if not exists cover_desktop_video text,
  add column if not exists cover_mobile_video text;

create or replace function public.is_valid_model_media_key(
  target_value text,
  target_model_id text,
  target_bucket text,
  target_slot text
)
returns boolean
language sql
immutable
set search_path = public
as $$
  with expected as (
    select target_bucket || '://models/' || target_model_id || '/' || target_slot || '/' as prefix
  ), parsed as (
    select
      substring(target_value from length(prefix) + 1) as filename,
      prefix
    from expected
  )
  select
    target_value is not null
    and left(target_value, length(prefix)) = prefix
    and case
      when target_bucket = 'model-images' then
        filename ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpe?g|png|webp)$'
      when target_bucket = 'model-videos' then
        filename ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(mp4|webm)$'
      else false
    end
  from parsed;
$$;

create or replace function public.can_manage_model_media_object(
  target_bucket_id text,
  target_name text
)
returns boolean
language sql
stable
security definer
set search_path = public, storage
as $$
  with parsed as (
    select
      storage.foldername(target_name) as folders,
      regexp_replace(target_name, '^.*/', '') as filename
  )
  select
    target_bucket_id in ('model-images', 'model-videos')
    and coalesce(array_length(folders, 1), 0) = 3
    and folders[1] = 'models'
    and nullif(folders[2], '') is not null
    and case
      when target_bucket_id = 'model-images' then
        folders[3] in ('cover-desktop', 'cover-mobile', 'profile')
        and filename ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpe?g|png|webp)$'
      when target_bucket_id = 'model-videos' then
        folders[3] in ('cover-desktop', 'cover-mobile')
        and filename ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(mp4|webm)$'
      else false
    end
    and (
      public.model_owns_model(folders[2])
      or public.admin_can_access_model(folders[2])
    )
  from parsed;
$$;

create or replace function public.can_delete_model_media_object(
  target_bucket_id text,
  target_name text
)
returns boolean
language sql
stable
security definer
set search_path = public, storage
as $$
  select
    public.can_manage_model_media_object(target_bucket_id, target_name)
    and not exists (
      select 1
      from public.models model
      where target_bucket_id || '://' || target_name in (
        model.cover_image,
        model.cover_mobile_image,
        model.cover_desktop_video,
        model.cover_mobile_video,
        model.profile_image
      )
    );
$$;

create or replace function public.protect_model_self_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'published'
    and (
      nullif(btrim(new.whatsapp_number), '') is null
      or nullif(btrim(new.cover_image), '') is null
      or nullif(btrim(new.profile_image), '') is null
    ) then
    raise exception 'Published models require WhatsApp, a desktop cover image and a profile image.'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    if public.current_app_role() = 'model' then
      if new.id is distinct from old.id
        or new.status is distinct from old.status
        or new.featured is distinct from old.featured
        or new.category is distinct from old.category
        or new.sort_order is distinct from old.sort_order
        or new.country_id is distinct from old.country_id
        or new.province_id is distinct from old.province_id
        or new.city_id is distinct from old.city_id
        or new.created_at is distinct from old.created_at then
        raise exception 'Model accounts cannot modify administrative fields.'
          using errcode = '42501';
      end if;
    end if;

    -- Legacy URLs remain valid while unchanged. Every replacement must use a
    -- versioned key for this exact model and slot, regardless of editor role.
    if new.cover_image is distinct from old.cover_image
      and not public.is_valid_model_media_key(new.cover_image, new.id, 'model-images', 'cover-desktop') then
      raise exception 'Invalid desktop cover image key.' using errcode = '22023';
    end if;

    if new.cover_mobile_image is distinct from old.cover_mobile_image
      and new.cover_mobile_image is not null
      and not public.is_valid_model_media_key(new.cover_mobile_image, new.id, 'model-images', 'cover-mobile') then
      raise exception 'Invalid mobile cover image key.' using errcode = '22023';
    end if;

    if new.profile_image is distinct from old.profile_image
      and not public.is_valid_model_media_key(new.profile_image, new.id, 'model-images', 'profile') then
      raise exception 'Invalid profile image key.' using errcode = '22023';
    end if;

    if new.cover_desktop_video is distinct from old.cover_desktop_video
      and new.cover_desktop_video is not null
      and not public.is_valid_model_media_key(new.cover_desktop_video, new.id, 'model-videos', 'cover-desktop') then
      raise exception 'Invalid desktop cover video key.' using errcode = '22023';
    end if;

    if new.cover_mobile_video is distinct from old.cover_mobile_video
      and new.cover_mobile_video is not null
      and not public.is_valid_model_media_key(new.cover_mobile_video, new.id, 'model-videos', 'cover-mobile') then
      raise exception 'Invalid mobile cover video key.' using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_model_self_update on public.models;

create trigger protect_model_self_update
  before insert or update on public.models
  for each row execute function public.protect_model_self_update();

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  (
    'model-images',
    'model-images',
    true,
    1048575,
    array['image/jpeg', 'image/png', 'image/webp']::text[]
  ),
  (
    'model-videos',
    'model-videos',
    true,
    10485759,
    array['video/mp4', 'video/webm']::text[]
  )
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read model profile media" on storage.objects;
drop policy if exists "Authorized users upload model profile media" on storage.objects;
drop policy if exists "Authorized users update model profile media" on storage.objects;
drop policy if exists "Authorized users delete model profile media" on storage.objects;
create policy "Public read model profile media"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id in ('model-images', 'model-videos'));
create policy "Authorized users upload model profile media"
  on storage.objects
  for insert
  to authenticated
  with check (public.can_manage_model_media_object(bucket_id, name));
create policy "Authorized users update model profile media"
  on storage.objects
  for update
  to authenticated
  using (public.can_manage_model_media_object(bucket_id, name))
  with check (public.can_manage_model_media_object(bucket_id, name));
create policy "Authorized users delete model profile media"
  on storage.objects
  for delete
  to authenticated
  using (public.can_delete_model_media_object(bucket_id, name));

commit;
