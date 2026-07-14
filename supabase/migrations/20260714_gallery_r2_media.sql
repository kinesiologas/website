-- Server-managed R2 metadata and write path for model gallery images.

begin;

alter table public.gallery_images
  add column if not exists model_id text,
  add column if not exists storage_provider text,
  add column if not exists object_key text,
  add column if not exists cleanup_pending_key text,
  add column if not exists delete_pending boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

update public.gallery_images gallery
set model_id = models.id
from public.models models
where models.slug = gallery.model_slug
  and gallery.model_id is distinct from models.id;

alter table public.gallery_images
  alter column model_id set not null,
  drop constraint if exists gallery_images_model_slug_fkey,
  drop constraint if exists gallery_images_model_id_fkey;

alter table public.gallery_images
  add constraint gallery_images_model_slug_fkey
    foreign key (model_slug) references public.models(slug)
    on update cascade
    on delete restrict,
  add constraint gallery_images_model_id_fkey
    foreign key (model_id) references public.models(id)
    on update cascade
    on delete restrict;

-- Mark only globally unique R2 paths that can be tied safely to this row.
with normalized_src as (
  select
    gallery.id,
    case
      when lower(left(btrim(gallery.src), 5)) = 'r2://' then substring(btrim(gallery.src) from 6)
      when btrim(gallery.src) !~* '^[a-z][a-z0-9+.-]*://'
        and left(btrim(gallery.src), 2) <> '//'
        then ltrim(btrim(gallery.src), '/')
      else null
    end as candidate_key
  from public.gallery_images gallery
), all_key_references as (
  select id, candidate_key
  from normalized_src
  where candidate_key is not null
  union
  select id, object_key
  from public.gallery_images
  where object_key is not null
), reference_counts as (
  select candidate_key, count(*) as reference_count
  from all_key_references
  group by candidate_key
), safe_candidates as (
  select gallery.id, normalized.candidate_key
  from public.gallery_images gallery
  join normalized_src normalized on normalized.id = gallery.id
  join reference_counts key_refs on key_refs.candidate_key = normalized.candidate_key
  where gallery.storage_provider is null
    and gallery.object_key is null
    and key_refs.reference_count = 1
    and (
      (
        left(normalized.candidate_key, length('models/' || gallery.model_id || '/gallery/')) =
          'models/' || gallery.model_id || '/gallery/'
        and substring(
          normalized.candidate_key
          from length('models/' || gallery.model_id || '/gallery/') + 1
        ) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$'
      )
      or (
        left(normalized.candidate_key, length('images/models/' || gallery.model_slug || '/')) =
          'images/models/' || gallery.model_slug || '/'
        and normalized.candidate_key ~* '^images/models/[A-Za-z0-9_-]+/(gallery[-_][A-Za-z0-9._-]+|gallery/[A-Za-z0-9._/-]+)\.(jpe?g|png|webp)$'
        and normalized.candidate_key !~ '(^|/)\.\.?(/|$)'
        and normalized.candidate_key !~ '//'
      )
    )
)
update public.gallery_images gallery
set
  storage_provider = 'r2',
  object_key = candidates.candidate_key,
  src = 'r2://' || candidates.candidate_key
from safe_candidates candidates
where candidates.id = gallery.id
  and gallery.storage_provider is null
  and gallery.object_key is null;

alter table public.gallery_images
  drop constraint if exists gallery_images_storage_provider_check,
  drop constraint if exists gallery_images_storage_metadata_check,
  drop constraint if exists gallery_images_cleanup_metadata_check;

do $$
begin
  if exists (
    select 1
    from public.gallery_images
    where (storage_provider is null) <> (object_key is null)
  ) then
    raise exception 'Gallery storage metadata contains incomplete rows.';
  end if;
end $$;

alter table public.gallery_images
  add constraint gallery_images_storage_metadata_check
  check (
    ((storage_provider is null) = (object_key is null))
    and (storage_provider is null or storage_provider = 'r2')
  ),
  add constraint gallery_images_cleanup_metadata_check
  check (cleanup_pending_key is null or storage_provider = 'r2');

create unique index if not exists gallery_images_r2_object_key_idx
  on public.gallery_images (object_key)
  where storage_provider = 'r2';

create index if not exists gallery_images_model_sort_idx
  on public.gallery_images (model_id, sort_order, id);

create or replace function public.is_valid_gallery_object_key(
  target_key text,
  target_model_id text,
  target_model_slug text
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    (
      left(target_key, length('models/' || target_model_id || '/gallery/')) =
        'models/' || target_model_id || '/gallery/'
      and substring(target_key from length('models/' || target_model_id || '/gallery/') + 1)
        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$'
    )
    or (
      target_key ~* '^images/models/[A-Za-z0-9_-]+/(gallery[-_][A-Za-z0-9._-]+|gallery/[A-Za-z0-9._/-]+)\.(jpe?g|png|webp)$'
      and target_key !~ '(^|/)\.\.?(/|$)'
      and target_key !~ '//'
    );
$$;

do $$
begin
  if exists (
    select 1
    from public.gallery_images
    where storage_provider = 'r2'
      and not public.is_valid_gallery_object_key(object_key, model_id, model_slug)
  ) then
    raise exception 'Gallery R2 metadata contains unsafe object keys.';
  end if;
end $$;

update public.gallery_images
set src = 'r2://' || object_key
where storage_provider = 'r2'
  and src is distinct from ('r2://' || object_key);

create or replace function public.protect_gallery_media_metadata()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  is_legacy_key boolean;
begin
  if not exists (
    select 1
    from public.models model
    where model.id = new.model_id
      and model.slug = new.model_slug
  ) then
    raise exception 'Gallery model identity is invalid.' using errcode = '23503';
  end if;

  if new.storage_provider = 'r2' then
    if not public.is_valid_gallery_object_key(new.object_key, new.model_id, new.model_slug) then
      raise exception 'Invalid gallery R2 object key.' using errcode = '22023';
    end if;

    is_legacy_key := new.object_key ~* '^images/models/[A-Za-z0-9_-]+/(gallery[-_][A-Za-z0-9._-]+|gallery/[A-Za-z0-9._/-]+)\.(jpe?g|png|webp)$';

    if is_legacy_key
      and left(new.object_key, length('images/models/' || new.model_slug || '/')) <>
        'images/models/' || new.model_slug || '/'
    then
      if tg_op = 'INSERT' then
        raise exception 'Legacy gallery key does not belong to this model.' using errcode = '22023';
      elsif new.object_key is distinct from old.object_key
        or new.model_id is distinct from old.model_id then
        raise exception 'Legacy gallery key does not belong to this model.' using errcode = '22023';
      end if;
    end if;

    if new.src <> ('r2://' || new.object_key)
      and not (
        is_legacy_key
        and new.src in (new.object_key, '/' || new.object_key)
      ) then
      raise exception 'Gallery source does not match its R2 object key.' using errcode = '22023';
    end if;
  end if;

  if new.cleanup_pending_key is not null then
    if new.storage_provider is distinct from 'r2'
      or not public.is_valid_gallery_object_key(new.cleanup_pending_key, new.model_id, new.model_slug)
      or new.cleanup_pending_key = new.object_key
    then
      raise exception 'Invalid pending gallery cleanup key.' using errcode = '22023';
    end if;

    if tg_op = 'INSERT' then
      raise exception 'Pending gallery cleanup key is not allowed on insert.' using errcode = '22023';
    elsif (
        new.cleanup_pending_key is distinct from old.cleanup_pending_key
        and new.cleanup_pending_key is distinct from old.object_key
      ) then
      raise exception 'Pending gallery cleanup key is not the previous object.' using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_gallery_media_metadata on public.gallery_images;
create trigger protect_gallery_media_metadata
  before insert or update on public.gallery_images
  for each row execute function public.protect_gallery_media_metadata();

create or replace function public.enforce_gallery_image_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.model_id is not distinct from old.model_id then
      return new;
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.model_id, 0));

  if (
    select count(*)
    from public.gallery_images gallery
    where gallery.model_id = new.model_id
      and gallery.id is distinct from new.id
  ) >= 60 then
    raise exception 'A model gallery cannot contain more than 60 images.' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_gallery_image_limit on public.gallery_images;
create trigger enforce_gallery_image_limit
  before insert or update of model_id on public.gallery_images
  for each row execute function public.enforce_gallery_image_limit();

drop trigger if exists set_gallery_images_updated_at on public.gallery_images;
create trigger set_gallery_images_updated_at
  before update on public.gallery_images
  for each row execute function public.set_updated_at();

drop policy if exists "Public read gallery images" on public.gallery_images;
drop policy if exists "Public read published gallery images" on public.gallery_images;
drop policy if exists "Admins manage gallery images" on public.gallery_images;
drop policy if exists "Models manage own gallery images" on public.gallery_images;
drop policy if exists "Authorized read manageable gallery images" on public.gallery_images;

alter table public.gallery_images enable row level security;

create policy "Public read published gallery images"
  on public.gallery_images
  for select
  using (
    exists (
      select 1
      from public.models
      where models.id = gallery_images.model_id
        and models.status = 'published'
        and gallery_images.delete_pending = false
    )
  );

create policy "Authorized read manageable gallery images"
  on public.gallery_images
  for select
  to authenticated
  using (
    public.admin_can_access_model(model_id)
    or public.model_owns_model(model_id)
  );

revoke insert, update, delete on public.gallery_images from anon, authenticated;
grant select on public.gallery_images to anon, authenticated;

commit;
