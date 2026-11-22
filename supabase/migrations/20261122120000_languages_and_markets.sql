-- Idiomas y mercados como datos (FR-004, FR-009).
-- Modelo: docs/modelo-de-datos.md, sección 4.
-- PRD: docs/prd/w2-idiomas-mercados-monedas.md, RF-7.

-- ---------------------------------------------------------------------------
-- languages
-- ---------------------------------------------------------------------------

create table public.languages (
  code text primary key,
  name text not null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint languages_code_check check (code ~ '^[a-z]{2}$'),
  constraint languages_name_check check (name = btrim(name) and name <> '')
);

comment on table public.languages is
  'scope: shared. Idiomas del sitio. Qué idiomas sirve la web lo decide el código; esta tabla es a lo que apuntan las traducciones (FR-004).';

-- A lo más un idioma por defecto.
create unique index languages_single_default_idx
  on public.languages (is_default)
  where is_default;

create trigger languages_set_updated_at
  before update on public.languages
  for each row
  execute function public.set_updated_at();

alter table public.languages enable row level security;

-- Permisos explícitos. Nadie borra por la API: otras tablas apuntan aquí.
revoke all on table public.languages from public, anon, authenticated;
grant select on table public.languages to anon;
grant select, insert, update on table public.languages to authenticated;
grant all on table public.languages to service_role;

-- anon no puede ejecutar is_admin(), así que tiene su propia política.
create policy languages_select_anon on public.languages
  for select
  to anon
  using (is_active);

create policy languages_select on public.languages
  for select
  to authenticated
  using (is_active or (select public.is_admin()));

create policy languages_insert on public.languages
  for insert
  to authenticated
  with check ((select public.is_admin()));

create policy languages_update on public.languages
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

insert into public.languages (code, name, is_default, is_active) values
  ('es', 'Español', true, true),
  ('en', 'English', false, true);

-- ---------------------------------------------------------------------------
-- markets
-- ---------------------------------------------------------------------------

create table public.markets (
  id uuid primary key default gen_random_uuid(),
  country_code text not null,
  currency text not null,
  default_locale text not null references public.languages (code),
  ships_physical boolean not null default false,
  payment_methods text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint markets_country_code_key unique (country_code),
  constraint markets_country_code_check check (country_code ~ '^[A-Z]{2}$'),
  constraint markets_currency_check check (currency ~ '^[A-Z]{3}$')
);

comment on table public.markets is
  'scope: shared. Mercados donde se vende: país, moneda e idioma por defecto. En la fase 1 solo Colombia está activo (FR-009).';

create index markets_default_locale_idx on public.markets (default_locale);

create trigger markets_set_updated_at
  before update on public.markets
  for each row
  execute function public.set_updated_at();

alter table public.markets enable row level security;

revoke all on table public.markets from public, anon, authenticated;
grant select on table public.markets to anon;
grant select, insert, update on table public.markets to authenticated;
grant all on table public.markets to service_role;

create policy markets_select_anon on public.markets
  for select
  to anon
  using (is_active);

create policy markets_select on public.markets
  for select
  to authenticated
  using (is_active or (select public.is_admin()));

create policy markets_insert on public.markets
  for insert
  to authenticated
  with check ((select public.is_admin()));

create policy markets_update on public.markets
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

insert into public.markets (country_code, currency, default_locale, ships_physical, is_active)
values ('CO', 'COP', 'es', true, true);
