-- Preguntas frecuentes editables sin código (FR-137, AC-065).
-- Modelo: docs/modelo-de-datos.md, sección 11.
-- PRD: docs/prd/w3-navegacion-home-paginas-de-apoyo.md, RF-12.

create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  sort_order integer not null default 0,
  status public.publish_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.faqs is
  'scope: web. Preguntas de la página de preguntas frecuentes (FR-137). Las lee cualquiera solo si están publicadas; solo un admin escribe. Nace vacía.';

create table public.faq_translations (
  faq_id uuid not null references public.faqs (id) on delete cascade,
  locale text not null references public.languages (code),
  question text not null,
  answer text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint faq_translations_pkey primary key (faq_id, locale)
);

comment on table public.faq_translations is
  'scope: web. Una pregunta y su respuesta por idioma (FR-137). Texto plano: se pinta como texto, nunca como HTML. Visible al público solo si la pregunta está publicada.';

create index faqs_status_sort_order_idx on public.faqs (status, sort_order);

create trigger faqs_set_updated_at
  before update on public.faqs
  for each row
  execute function public.set_updated_at();

create trigger faq_translations_set_updated_at
  before update on public.faq_translations
  for each row
  execute function public.set_updated_at();

alter table public.faqs enable row level security;
alter table public.faq_translations enable row level security;

revoke all on table public.faqs from public, anon, authenticated;
revoke all on table public.faq_translations from public, anon, authenticated;
grant select on table public.faqs, public.faq_translations to anon, authenticated;
grant insert, update, delete on table public.faqs, public.faq_translations to authenticated;
grant all on table public.faqs, public.faq_translations to service_role;

-- Lectura pública: solo lo publicado. `is_admin` no se ejecuta como anónimo,
-- así que la lectura de un admin va en una política aparte.
create policy faqs_select_published on public.faqs
  for select
  to anon, authenticated
  using (status = 'published');

create policy faqs_select_admin on public.faqs
  for select
  to authenticated
  using ((select public.is_admin()));

create policy faq_translations_select_published on public.faq_translations
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.faqs
      where faqs.id = faq_translations.faq_id and faqs.status = 'published'
    )
  );

create policy faq_translations_select_admin on public.faq_translations
  for select
  to authenticated
  using ((select public.is_admin()));

create policy faqs_insert on public.faqs
  for insert to authenticated
  with check ((select public.is_admin()));
create policy faqs_update on public.faqs
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy faqs_delete on public.faqs
  for delete to authenticated
  using ((select public.is_admin()));

create policy faq_translations_insert on public.faq_translations
  for insert to authenticated
  with check ((select public.is_admin()));
create policy faq_translations_update on public.faq_translations
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy faq_translations_delete on public.faq_translations
  for delete to authenticated
  using ((select public.is_admin()));
