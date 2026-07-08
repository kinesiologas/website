create table if not exists public.categories (
  id text primary key,
  label text not null,
  sort_order integer not null default 0,
  active boolean not null default true
);

alter table public.categories
  add column if not exists sort_order integer not null default 0,
  add column if not exists active boolean not null default true;

create table if not exists public.countries (
  id text primary key,
  name text not null,
  iso_code text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.provinces (
  id text primary key,
  country_id text not null references public.countries(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cities (
  id text primary key,
  province_id text not null references public.provinces(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.models (
  id text primary key,
  slug text not null unique,
  name text not null,
  city text not null,
  age integer,
  category text not null,
  featured boolean not null default false,
  short_description text not null default '',
  description text not null default '',
  cover_image text not null,
  profile_image text not null,
  whatsapp_number text not null default '',
  instagram_url text not null default '',
  sort_order integer not null default 0,
  status text not null default 'published',
  country_id text references public.countries(id) on delete set null,
  province_id text references public.provinces(id) on delete set null,
  city_id text references public.cities(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.models
  add column if not exists status text not null default 'published',
  add column if not exists country_id text references public.countries(id) on delete set null,
  add column if not exists province_id text references public.provinces(id) on delete set null,
  add column if not exists city_id text references public.cities(id) on delete set null;

do $$
begin
  alter table public.models
    add constraint models_status_check check (status in ('draft', 'published', 'archived'));
exception
  when duplicate_object then null;
end $$;

create table if not exists public.gallery_images (
  id text primary key,
  model_slug text not null,
  src text not null,
  alt text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.gallery_images
  drop constraint if exists gallery_images_model_slug_fkey;

alter table public.gallery_images
  add constraint gallery_images_model_slug_fkey
  foreign key (model_slug) references public.models(slug)
  on update cascade
  on delete cascade;

create table if not exists public.app_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  avatar_url text not null default '',
  role text not null default 'user',
  active boolean not null default true,
  model_id text references public.models(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_profiles
  add column if not exists full_name text not null default '',
  add column if not exists avatar_url text not null default '',
  add column if not exists role text not null default 'user',
  add column if not exists active boolean not null default true,
  add column if not exists model_id text references public.models(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  alter table public.app_profiles
    add constraint app_profiles_role_check check (role in ('super_admin', 'admin', 'model', 'user'));
exception
  when duplicate_object then null;
end $$;

create table if not exists public.favorites (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  model_id text not null references public.models(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, model_id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_categories_updated_at on public.categories;
drop trigger if exists set_countries_updated_at on public.countries;
drop trigger if exists set_provinces_updated_at on public.provinces;
drop trigger if exists set_cities_updated_at on public.cities;
drop trigger if exists set_models_updated_at on public.models;
drop trigger if exists set_app_profiles_updated_at on public.app_profiles;

create trigger set_countries_updated_at
  before update on public.countries
  for each row execute function public.set_updated_at();

create trigger set_provinces_updated_at
  before update on public.provinces
  for each row execute function public.set_updated_at();

create trigger set_cities_updated_at
  before update on public.cities
  for each row execute function public.set_updated_at();

create trigger set_models_updated_at
  before update on public.models
  for each row execute function public.set_updated_at();

create trigger set_app_profiles_updated_at
  before update on public.app_profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_profiles (id, email, full_name, avatar_url, role, active)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', ''),
    'user',
    true
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(nullif(public.app_profiles.full_name, ''), excluded.full_name),
    avatar_url = coalesce(nullif(public.app_profiles.avatar_url, ''), excluded.avatar_url),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.app_profiles
  where id = auth.uid()
    and active = true
  limit 1;
$$;

create or replace function public.current_model_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select model_id
  from public.app_profiles
  where id = auth.uid()
    and active = true
  limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() in ('super_admin', 'admin');
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() = 'super_admin';
$$;

create or replace function public.admin_update_app_profile(
  target_user_id uuid,
  next_role text default null,
  next_active boolean default null,
  next_model_id text default null,
  next_full_name text default null
)
returns public.app_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.app_profiles;
begin
  if not public.is_super_admin() then
    raise exception 'Only super administrators can update users.' using errcode = '42501';
  end if;

  if next_role is not null and next_role not in ('super_admin', 'admin', 'model', 'user') then
    raise exception 'Invalid role.' using errcode = '22023';
  end if;

  update public.app_profiles
  set
    role = coalesce(next_role, role),
    active = coalesce(next_active, active),
    model_id = case
      when coalesce(next_role, role) = 'model' then next_model_id
      else null
    end,
    full_name = coalesce(next_full_name, full_name),
    updated_at = now()
  where id = target_user_id
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'User profile not found.' using errcode = 'P0002';
  end if;

  return updated_profile;
end;
$$;

alter table public.categories enable row level security;
alter table public.countries enable row level security;
alter table public.provinces enable row level security;
alter table public.cities enable row level security;
alter table public.models enable row level security;
alter table public.gallery_images enable row level security;
alter table public.app_profiles enable row level security;
alter table public.favorites enable row level security;

drop policy if exists "Public read categories" on public.categories;
drop policy if exists "Public read active categories" on public.categories;
drop policy if exists "Admins manage categories" on public.categories;
create policy "Public read active categories"
  on public.categories
  for select
  using (active = true);
create policy "Admins manage categories"
  on public.categories
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Public read active countries" on public.countries;
drop policy if exists "Admins manage countries" on public.countries;
create policy "Public read active countries"
  on public.countries
  for select
  using (active = true);
create policy "Admins manage countries"
  on public.countries
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Public read active provinces" on public.provinces;
drop policy if exists "Admins manage provinces" on public.provinces;
create policy "Public read active provinces"
  on public.provinces
  for select
  using (
    active = true
    and exists (
      select 1 from public.countries
      where countries.id = provinces.country_id
        and countries.active = true
    )
  );
create policy "Admins manage provinces"
  on public.provinces
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Public read active cities" on public.cities;
drop policy if exists "Admins manage cities" on public.cities;
create policy "Public read active cities"
  on public.cities
  for select
  using (
    active = true
    and exists (
      select 1 from public.provinces
      join public.countries on countries.id = provinces.country_id
      where provinces.id = cities.province_id
        and provinces.active = true
        and countries.active = true
    )
  );
create policy "Admins manage cities"
  on public.cities
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Public read models" on public.models;
drop policy if exists "Public read published models" on public.models;
drop policy if exists "Admins manage models" on public.models;
drop policy if exists "Models read own profile" on public.models;
drop policy if exists "Models update own profile" on public.models;
create policy "Public read published models"
  on public.models
  for select
  using (status = 'published');
create policy "Admins manage models"
  on public.models
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
create policy "Models read own profile"
  on public.models
  for select
  to authenticated
  using (public.current_app_role() = 'model' and id = public.current_model_id());
create policy "Models update own profile"
  on public.models
  for update
  to authenticated
  using (public.current_app_role() = 'model' and id = public.current_model_id())
  with check (public.current_app_role() = 'model' and id = public.current_model_id());

drop policy if exists "Public read gallery images" on public.gallery_images;
drop policy if exists "Public read published gallery images" on public.gallery_images;
drop policy if exists "Admins manage gallery images" on public.gallery_images;
drop policy if exists "Models manage own gallery images" on public.gallery_images;
create policy "Public read published gallery images"
  on public.gallery_images
  for select
  using (
    exists (
      select 1 from public.models
      where models.slug = gallery_images.model_slug
        and models.status = 'published'
    )
  );
create policy "Admins manage gallery images"
  on public.gallery_images
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
create policy "Models manage own gallery images"
  on public.gallery_images
  for all
  to authenticated
  using (
    public.current_app_role() = 'model'
    and exists (
      select 1 from public.models
      where models.slug = gallery_images.model_slug
        and models.id = public.current_model_id()
    )
  )
  with check (
    public.current_app_role() = 'model'
    and exists (
      select 1 from public.models
      where models.slug = gallery_images.model_slug
        and models.id = public.current_model_id()
    )
  );

drop policy if exists "Profiles select own or admin" on public.app_profiles;
drop policy if exists "Profiles insert own" on public.app_profiles;
drop policy if exists "Profiles update own basic fields" on public.app_profiles;
create policy "Profiles select own or admin"
  on public.app_profiles
  for select
  to authenticated
  using (id = auth.uid() or public.is_admin());
create policy "Profiles insert own"
  on public.app_profiles
  for insert
  to authenticated
  with check (id = auth.uid() and role = 'user' and active = true);
create policy "Profiles update own basic fields"
  on public.app_profiles
  for update
  to authenticated
  using (id = auth.uid() and active = true)
  with check (id = auth.uid());

drop policy if exists "Users read own favorites" on public.favorites;
drop policy if exists "Users insert own favorites" on public.favorites;
drop policy if exists "Users delete own favorites" on public.favorites;
create policy "Users read own favorites"
  on public.favorites
  for select
  to authenticated
  using (user_id = auth.uid());
create policy "Users insert own favorites"
  on public.favorites
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.models
      where models.id = favorites.model_id
        and models.status = 'published'
    )
  );
create policy "Users delete own favorites"
  on public.favorites
  for delete
  to authenticated
  using (user_id = auth.uid());

grant usage on schema public to anon, authenticated;
grant select on public.categories, public.countries, public.provinces, public.cities, public.models, public.gallery_images to anon, authenticated;
grant select, insert, update, delete on public.categories, public.countries, public.provinces, public.cities, public.models, public.gallery_images to authenticated;
grant select, insert on public.app_profiles to authenticated;
revoke update on public.app_profiles from authenticated;
grant update (full_name, avatar_url, updated_at) on public.app_profiles to authenticated;
grant select, insert, delete on public.favorites to authenticated;
grant execute on function public.admin_update_app_profile(uuid, text, boolean, text, text) to authenticated;

insert into public.categories (id, label, sort_order, active)
values
  ('editorial', 'Editorial', 10, true),
  ('glamour', 'Glamour', 20, true),
  ('premium', 'Premium', 30, true)
on conflict (id) do update set
  label = excluded.label,
  sort_order = excluded.sort_order,
  active = excluded.active;

insert into public.countries (id, name, iso_code, sort_order, active)
values
  ('peru', 'Peru', 'PE', 10, true)
on conflict (id) do update set
  name = excluded.name,
  iso_code = excluded.iso_code,
  sort_order = excluded.sort_order,
  active = excluded.active;

insert into public.provinces (id, country_id, name, sort_order, active)
values
  ('peru-lima', 'peru', 'Lima', 10, true)
on conflict (id) do update set
  country_id = excluded.country_id,
  name = excluded.name,
  sort_order = excluded.sort_order,
  active = excluded.active;

insert into public.cities (id, province_id, name, sort_order, active)
values
  ('peru-lima-lima', 'peru-lima', 'Lima', 10, true),
  ('peru-lima-miraflores', 'peru-lima', 'Miraflores', 20, true),
  ('peru-lima-san-isidro', 'peru-lima', 'San Isidro', 30, true)
on conflict (id) do update set
  province_id = excluded.province_id,
  name = excluded.name,
  sort_order = excluded.sort_order,
  active = excluded.active;

insert into public.models (
  id,
  slug,
  name,
  city,
  age,
  category,
  featured,
  short_description,
  description,
  cover_image,
  profile_image,
  whatsapp_number,
  instagram_url,
  sort_order,
  status,
  country_id,
  province_id,
  city_id
)
values
  (
    'model-001',
    'isabella',
    'Isabella',
    'Lima',
    24,
    'Editorial',
    true,
    'Presencia sofisticada, estilo sobrio y una galeria pensada para una experiencia visual elegante.',
    'Isabella combina una imagen delicada con una estetica editorial de alto contraste. Su perfil esta pensado para destacar fotografia, ciudad y contacto directo sin informacion innecesaria.',
    'images/models/isabella/cover.jpg',
    'images/models/isabella/profile.jpg',
    '51987654321',
    'https://instagram.com/',
    10,
    'published',
    'peru',
    'peru-lima',
    'peru-lima-lima'
  ),
  (
    'model-002',
    'valentina',
    'Valentina',
    'Miraflores',
    26,
    'Glamour',
    true,
    'Perfil de aire clasico, fotografias amplias y una narrativa visual minimalista.',
    'Valentina presenta una seleccion limpia y directa, con una composicion premium que prioriza imagenes grandes, ritmo pausado y contacto privado mediante WhatsApp.',
    'images/models/valentina/cover.jpg',
    'images/models/valentina/profile.jpg',
    '51912345678',
    'https://instagram.com/',
    20,
    'published',
    'peru',
    'peru-lima',
    'peru-lima-miraflores'
  ),
  (
    'model-003',
    'renata',
    'Renata',
    'San Isidro',
    25,
    'Premium',
    true,
    'Imagen moderna, presencia serena y una galeria de lectura rapida en mobile.',
    'Renata mantiene un perfil elegante y reservado. La experiencia esta centrada en descubrir su galeria, revisar datos esenciales y abrir contacto sin friccion.',
    'images/models/renata/cover.jpg',
    'images/models/renata/profile.jpg',
    '51955554444',
    'https://instagram.com/',
    30,
    'published',
    'peru',
    'peru-lima',
    'peru-lima-san-isidro'
  )
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  city = excluded.city,
  age = excluded.age,
  category = excluded.category,
  featured = excluded.featured,
  short_description = excluded.short_description,
  description = excluded.description,
  cover_image = excluded.cover_image,
  profile_image = excluded.profile_image,
  whatsapp_number = excluded.whatsapp_number,
  instagram_url = excluded.instagram_url,
  sort_order = excluded.sort_order,
  status = excluded.status,
  country_id = excluded.country_id,
  province_id = excluded.province_id,
  city_id = excluded.city_id,
  updated_at = now();

insert into public.gallery_images (id, model_slug, src, alt, sort_order)
values
  ('isabella-01', 'isabella', 'images/models/isabella/gallery-01.jpg', 'Retrato editorial vertical de Isabella', 10),
  ('isabella-02', 'isabella', 'images/models/isabella/gallery-02.jpg', 'Fotografia horizontal editorial de Isabella', 20),
  ('isabella-03', 'isabella', 'images/models/isabella/gallery-03.jpg', 'Composicion vertical premium de Isabella', 30),
  ('valentina-01', 'valentina', 'images/models/valentina/gallery-01.jpg', 'Retrato editorial vertical de Valentina', 40),
  ('valentina-02', 'valentina', 'images/models/valentina/gallery-02.jpg', 'Fotografia horizontal editorial de Valentina', 50),
  ('valentina-03', 'valentina', 'images/models/valentina/gallery-03.jpg', 'Composicion vertical premium de Valentina', 60),
  ('renata-01', 'renata', 'images/models/renata/gallery-01.jpg', 'Retrato editorial vertical de Renata', 70),
  ('renata-02', 'renata', 'images/models/renata/gallery-02.jpg', 'Fotografia horizontal editorial de Renata', 80),
  ('renata-03', 'renata', 'images/models/renata/gallery-03.jpg', 'Composicion vertical premium de Renata', 90)
on conflict (id) do update set
  model_slug = excluded.model_slug,
  src = excluded.src,
  alt = excluded.alt,
  sort_order = excluded.sort_order;
