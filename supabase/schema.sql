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

create table if not exists public.admin_territory_assignments (
  id text primary key,
  user_id uuid not null references public.app_profiles(id) on delete cascade,
  country_id text not null references public.countries(id) on delete cascade,
  province_id text references public.provinces(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists admin_territory_user_country_all_idx
  on public.admin_territory_assignments (user_id, country_id)
  where province_id is null;

create unique index if not exists admin_territory_user_country_province_idx
  on public.admin_territory_assignments (user_id, country_id, province_id)
  where province_id is not null;

create table if not exists public.calendar_connections (
  model_id text primary key references public.models(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  calendar_id text not null default 'primary',
  calendar_email text not null default '',
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz,
  scope text not null default '',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calendar_connection_status (
  model_id text primary key references public.models(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  calendar_email text not null default '',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calendar_oauth_states (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  model_id text not null references public.models(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.model_availability_rules (
  model_id text primary key references public.models(id) on delete cascade,
  timezone text not null default 'America/Lima',
  days_of_week integer[] not null default array[1, 2, 3, 4, 5, 6],
  start_time time not null default time '10:00',
  end_time time not null default time '20:00',
  slot_duration_minutes integer not null default 60,
  buffer_minutes integer not null default 0,
  min_notice_minutes integer not null default 120,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  alter table public.model_availability_rules
    add constraint model_availability_rules_slot_duration_check check (slot_duration_minutes between 15 and 480);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.model_availability_rules
    add constraint model_availability_rules_buffer_check check (buffer_minutes between 0 and 240);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.model_availability_rules
    add constraint model_availability_rules_notice_check check (min_notice_minutes between 0 and 10080);
exception
  when duplicate_object then null;
end $$;

create table if not exists public.model_availability_blocks (
  id text primary key,
  model_id text not null references public.models(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  alter table public.model_availability_blocks
    add constraint model_availability_blocks_range_check check (end_at > start_at);
exception
  when duplicate_object then null;
end $$;

create table if not exists public.availability_cache (
  model_id text not null references public.models(id) on delete cascade,
  date date not null,
  is_available boolean not null default false,
  expires_at timestamptz not null,
  checked_at timestamptz not null default now(),
  primary key (model_id, date)
);

create table if not exists public.bookings (
  id text primary key,
  model_id text not null references public.models(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'pending',
  notes text not null default '',
  contact_name text not null default '',
  contact_phone text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  alter table public.bookings
    add constraint bookings_status_check check (status in ('pending', 'confirmed', 'rejected', 'cancelled'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.bookings
    add constraint bookings_range_check check (end_at > start_at);
exception
  when duplicate_object then null;
end $$;

create index if not exists admin_territory_assignments_user_idx on public.admin_territory_assignments (user_id);
create index if not exists admin_territory_assignments_country_idx on public.admin_territory_assignments (country_id);
create index if not exists bookings_model_start_idx on public.bookings (model_id, start_at);
create index if not exists bookings_user_start_idx on public.bookings (user_id, start_at);
create index if not exists availability_blocks_model_start_idx on public.model_availability_blocks (model_id, start_at);

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
drop trigger if exists set_site_settings_updated_at on public.site_settings;
drop trigger if exists set_models_updated_at on public.models;
drop trigger if exists set_app_profiles_updated_at on public.app_profiles;
drop trigger if exists set_calendar_connections_updated_at on public.calendar_connections;
drop trigger if exists set_calendar_connection_status_updated_at on public.calendar_connection_status;
drop trigger if exists set_model_availability_rules_updated_at on public.model_availability_rules;
drop trigger if exists set_model_availability_blocks_updated_at on public.model_availability_blocks;
drop trigger if exists set_bookings_updated_at on public.bookings;

create trigger set_countries_updated_at
  before update on public.countries
  for each row execute function public.set_updated_at();

create trigger set_provinces_updated_at
  before update on public.provinces
  for each row execute function public.set_updated_at();

create trigger set_cities_updated_at
  before update on public.cities
  for each row execute function public.set_updated_at();

create trigger set_site_settings_updated_at
  before update on public.site_settings
  for each row execute function public.set_updated_at();

create trigger set_models_updated_at
  before update on public.models
  for each row execute function public.set_updated_at();

create trigger set_app_profiles_updated_at
  before update on public.app_profiles
  for each row execute function public.set_updated_at();

create trigger set_calendar_connections_updated_at
  before update on public.calendar_connections
  for each row execute function public.set_updated_at();

create trigger set_calendar_connection_status_updated_at
  before update on public.calendar_connection_status
  for each row execute function public.set_updated_at();

create trigger set_model_availability_rules_updated_at
  before update on public.model_availability_rules
  for each row execute function public.set_updated_at();

create trigger set_model_availability_blocks_updated_at
  before update on public.model_availability_blocks
  for each row execute function public.set_updated_at();

create trigger set_bookings_updated_at
  before update on public.bookings
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

create or replace function public.model_owns_model(target_model_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() = 'model'
    and public.current_model_id() = target_model_id;
$$;

create or replace function public.admin_can_manage_territory(target_country_id text, target_province_id text default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.current_app_role() = 'super_admin' then true
    when public.current_app_role() <> 'admin' then false
    when target_country_id is null then false
    else exists (
      select 1
      from public.admin_territory_assignments assignments
      where assignments.user_id = auth.uid()
        and assignments.country_id = target_country_id
        and (
          assignments.province_id is null
          or assignments.province_id = target_province_id
        )
    )
  end;
$$;

create or replace function public.admin_can_manage_province(target_province_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.provinces
    where provinces.id = target_province_id
      and public.admin_can_manage_territory(provinces.country_id, provinces.id)
  );
$$;

create or replace function public.admin_can_access_model(target_model_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.models
    where models.id = target_model_id
      and public.admin_can_manage_territory(models.country_id, models.province_id)
  );
$$;

create or replace function public.admin_can_access_model_slug(target_model_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.models
    where models.slug = target_model_slug
      and public.admin_can_manage_territory(models.country_id, models.province_id)
  );
$$;

create or replace function public.can_manage_model_calendar(target_model_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.model_owns_model(target_model_id)
    or public.admin_can_access_model(target_model_id);
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
alter table public.site_settings enable row level security;
alter table public.models enable row level security;
alter table public.gallery_images enable row level security;
alter table public.app_profiles enable row level security;
alter table public.favorites enable row level security;
alter table public.admin_territory_assignments enable row level security;
alter table public.calendar_connections enable row level security;
alter table public.calendar_connection_status enable row level security;
alter table public.calendar_oauth_states enable row level security;
alter table public.model_availability_rules enable row level security;
alter table public.model_availability_blocks enable row level security;
alter table public.availability_cache enable row level security;
alter table public.bookings enable row level security;

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
  using (public.is_super_admin())
  with check (public.is_super_admin());

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
  using (public.admin_can_manage_territory(country_id, id))
  with check (public.admin_can_manage_territory(country_id, id));

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
  using (public.admin_can_manage_province(province_id))
  with check (public.admin_can_manage_province(province_id));

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

drop policy if exists "Public read models" on public.models;
drop policy if exists "Public read published models" on public.models;
drop policy if exists "Admins manage models" on public.models;
drop policy if exists "Admins read territorial models" on public.models;
drop policy if exists "Admins insert territorial models" on public.models;
drop policy if exists "Admins update territorial models" on public.models;
drop policy if exists "Admins delete territorial models" on public.models;
drop policy if exists "Models read own profile" on public.models;
drop policy if exists "Models update own profile" on public.models;
create policy "Public read published models"
  on public.models
  for select
  using (status = 'published');
create policy "Admins read territorial models"
  on public.models
  for select
  to authenticated
  using (public.admin_can_manage_territory(country_id, province_id));
create policy "Admins insert territorial models"
  on public.models
  for insert
  to authenticated
  with check (public.admin_can_manage_territory(country_id, province_id));
create policy "Admins update territorial models"
  on public.models
  for update
  to authenticated
  using (public.admin_can_manage_territory(country_id, province_id))
  with check (public.admin_can_manage_territory(country_id, province_id));
create policy "Admins delete territorial models"
  on public.models
  for delete
  to authenticated
  using (public.admin_can_manage_territory(country_id, province_id));
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
  using (public.admin_can_access_model_slug(model_slug))
  with check (public.admin_can_access_model_slug(model_slug));
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
  using (id = auth.uid() or public.is_super_admin());
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

drop policy if exists "Super admins manage admin territories" on public.admin_territory_assignments;
drop policy if exists "Admins read own territories" on public.admin_territory_assignments;
create policy "Super admins manage admin territories"
  on public.admin_territory_assignments
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
create policy "Admins read own territories"
  on public.admin_territory_assignments
  for select
  to authenticated
  using (user_id = auth.uid() and public.current_app_role() = 'admin');

drop policy if exists "Calendar status read by owner or admin" on public.calendar_connection_status;
create policy "Calendar status read by owner or admin"
  on public.calendar_connection_status
  for select
  to authenticated
  using (public.can_manage_model_calendar(model_id));

drop policy if exists "Availability rules read by owner or admin" on public.model_availability_rules;
drop policy if exists "Availability rules manage by owner or admin" on public.model_availability_rules;
create policy "Availability rules read by owner or admin"
  on public.model_availability_rules
  for select
  to authenticated
  using (public.can_manage_model_calendar(model_id));
create policy "Availability rules manage by owner or admin"
  on public.model_availability_rules
  for all
  to authenticated
  using (public.can_manage_model_calendar(model_id))
  with check (public.can_manage_model_calendar(model_id));

drop policy if exists "Availability blocks read by owner or admin" on public.model_availability_blocks;
drop policy if exists "Availability blocks manage by owner or admin" on public.model_availability_blocks;
create policy "Availability blocks read by owner or admin"
  on public.model_availability_blocks
  for select
  to authenticated
  using (public.can_manage_model_calendar(model_id));
create policy "Availability blocks manage by owner or admin"
  on public.model_availability_blocks
  for all
  to authenticated
  using (public.can_manage_model_calendar(model_id))
  with check (public.can_manage_model_calendar(model_id));

drop policy if exists "Bookings read own or territorial" on public.bookings;
drop policy if exists "Bookings manage by model or admin" on public.bookings;
drop policy if exists "Users cancel own pending bookings" on public.bookings;
create policy "Bookings read own or territorial"
  on public.bookings
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.model_owns_model(model_id)
    or public.admin_can_access_model(model_id)
  );
create policy "Bookings manage by model or admin"
  on public.bookings
  for update
  to authenticated
  using (public.model_owns_model(model_id) or public.admin_can_access_model(model_id))
  with check (public.model_owns_model(model_id) or public.admin_can_access_model(model_id));
create policy "Users cancel own pending bookings"
  on public.bookings
  for update
  to authenticated
  using (user_id = auth.uid() and status = 'pending')
  with check (user_id = auth.uid() and status = 'cancelled');

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

grant usage on schema public to anon, authenticated;
grant select on public.categories, public.countries, public.provinces, public.cities, public.models, public.gallery_images to anon, authenticated;
grant select, insert, update, delete on public.categories, public.countries, public.provinces, public.cities, public.models, public.gallery_images to authenticated;
revoke all on public.site_settings from anon, authenticated;
grant select on public.site_settings to anon, authenticated;
grant update (hero_desktop_image, hero_mobile_image, hero_desktop_video, hero_mobile_video) on public.site_settings to authenticated;
grant select, insert on public.app_profiles to authenticated;
revoke update on public.app_profiles from authenticated;
grant update (full_name, avatar_url, updated_at) on public.app_profiles to authenticated;
grant select, insert, delete on public.favorites to authenticated;
grant select, insert, update, delete on public.admin_territory_assignments to authenticated;
revoke all on public.calendar_connections from anon, authenticated;
revoke all on public.calendar_oauth_states from anon, authenticated;
revoke all on public.availability_cache from anon, authenticated;
grant select on public.calendar_connection_status to authenticated;
grant select, insert, update, delete on public.model_availability_rules to authenticated;
grant select, insert, update, delete on public.model_availability_blocks to authenticated;
grant select on public.bookings to authenticated;
grant update (status, updated_at) on public.bookings to authenticated;
grant execute on function public.admin_update_app_profile(uuid, text, boolean, text, text) to authenticated;

insert into public.site_settings (id)
values ('home')
on conflict (id) do nothing;

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

insert into public.model_availability_rules (model_id, timezone, days_of_week, start_time, end_time, slot_duration_minutes, buffer_minutes, min_notice_minutes, enabled)
select id, 'America/Lima', array[1, 2, 3, 4, 5, 6], time '10:00', time '20:00', 60, 0, 120, true
from public.models
where id in ('model-001', 'model-002', 'model-003')
on conflict (model_id) do nothing;

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
