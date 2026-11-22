-- Textos editables sin código (FR-065), con versión por idioma.
-- Modelo: docs/modelo-de-datos.md, sección 4.
-- PRD: docs/prd/w2-idiomas-mercados-monedas.md, RF-8.

create table public.site_texts (
  key text not null,
  locale text not null references public.languages (code),
  value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_texts_pkey primary key (key, locale),
  -- Segmentos en minúscula, dígitos y guion bajo, separados por puntos:
  -- home.hero_title
  constraint site_texts_key_check
    check (key ~ '^[a-z0-9_]+(\.[a-z0-9_]+)*$')
);

comment on table public.site_texts is
  'scope: web. Textos editables sin código (FR-065), en texto plano y uno por idioma. Los textos fijos de la interfaz viven en archivos, no aquí.';

create index site_texts_locale_idx on public.site_texts (locale);

create trigger site_texts_set_updated_at
  before update on public.site_texts
  for each row
  execute function public.set_updated_at();

alter table public.site_texts enable row level security;

revoke all on table public.site_texts from public, anon, authenticated;
grant select on table public.site_texts to anon, authenticated;
grant insert, update, delete on table public.site_texts to authenticated;
grant all on table public.site_texts to service_role;

-- Los textos son públicos: los lee cualquiera, también quien no tiene sesión.
create policy site_texts_select on public.site_texts
  for select
  to anon, authenticated
  using (true);

create policy site_texts_insert on public.site_texts
  for insert
  to authenticated
  with check ((select public.is_admin()));

create policy site_texts_update on public.site_texts
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy site_texts_delete on public.site_texts
  for delete
  to authenticated
  using ((select public.is_admin()));
