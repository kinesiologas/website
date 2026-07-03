create table if not exists public.categories (
  id text primary key,
  label text not null,
  sort_order integer not null default 0
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gallery_images (
  id text primary key,
  model_slug text not null references public.models(slug) on delete cascade,
  src text not null,
  alt text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;
alter table public.models enable row level security;
alter table public.gallery_images enable row level security;

drop policy if exists "Public read categories" on public.categories;
create policy "Public read categories"
  on public.categories
  for select
  using (true);

drop policy if exists "Public read models" on public.models;
create policy "Public read models"
  on public.models
  for select
  using (true);

drop policy if exists "Public read gallery images" on public.gallery_images;
create policy "Public read gallery images"
  on public.gallery_images
  for select
  using (true);

insert into public.categories (id, label, sort_order)
values
  ('editorial', 'Editorial', 10),
  ('glamour', 'Glamour', 20),
  ('premium', 'Premium', 30)
on conflict (id) do update set
  label = excluded.label,
  sort_order = excluded.sort_order;

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
  sort_order
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
    10
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
    20
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
    30
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
