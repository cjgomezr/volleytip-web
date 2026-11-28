-- Tips: sus tablas, quién los lee y escribe, la vista que leerá la app y la
-- búsqueda del listado (FR-013, FR-076, FR-078, AC-034).
-- Ticket #151. Modelo: docs/modelo-de-datos.md, sección 5.
-- PRD: docs/prd/w4-tips.md, RF-1.

create extension if not exists unaccent with schema extensions;

-- Listas fijas: agregar un valor pide otra migración. Sus nombres visibles
-- salen de los archivos de traducción.
create type public.tip_fundamental as enum (
  'serve', 'reception', 'setting', 'attack', 'block', 'defense'
);
create type public.tip_level as enum ('basic', 'intermediate', 'advanced');
create type public.tip_orientation as enum ('vertical', 'horizontal');

-- ---------------------------------------------------------------------------
-- tips
-- ---------------------------------------------------------------------------

-- Un borrador nace sin video: llega después, del importador o de una subida, y
-- sus datos cuando Bunny termina de procesarlo. Publicarlo los exige todos.
create table public.tips (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  bunny_video_id text,
  orientation public.tip_orientation,
  duration_seconds integer,
  thumbnail_url text,
  fundamental public.tip_fundamental,
  level public.tip_level,
  tiktok_url text,
  -- {"type": "app"} o {"type": "social"}. Sin configurar, el sitio muestra
  -- las redes.
  promo jsonb,
  is_featured boolean not null default false,
  status public.publish_status not null default 'draft',
  -- Una fecha futura en un publicado lo deja programado.
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tips_slug_key unique (slug),
  constraint tips_slug_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint tips_bunny_video_id_key unique (bunny_video_id),
  constraint tips_bunny_video_id_check check (bunny_video_id ~ '\S'),
  constraint tips_duration_seconds_check check (duration_seconds > 0),
  -- Se pintan como direcciones de imagen y de enlace: nunca otro esquema.
  constraint tips_thumbnail_url_check check (thumbnail_url ~ '^https://\S+$'),
  constraint tips_tiktok_url_check check (tiktok_url ~ '^https://\S+$'),
  -- `coalesce`: sin la llave `type`, la comparación daría nulo y pasaría.
  constraint tips_promo_check check (
    promo is null or coalesce(promo ->> 'type' in ('app', 'social'), false)
  ),
  constraint tips_published_complete_check check (
    status <> 'published'
    or num_nulls(
      bunny_video_id, orientation, duration_seconds, thumbnail_url,
      fundamental, level, published_at
    ) = 0
  )
);

comment on table public.tips is
  'scope: shared. Un video corto de voleibol con su fundamento y su nivel (FR-013). Público solo si está publicado y su fecha ya pasó. No se borra: se retira.';

-- Como máximo un destacado en toda la tabla.
create unique index tips_one_featured_idx on public.tips (is_featured)
  where is_featured;

-- El listado va del más reciente al más antiguo; dentro de un fundamento, el
-- detalle recorre el mismo orden.
create index tips_published_at_idx on public.tips (published_at desc, id)
  where status = 'published';
create index tips_published_fundamental_idx
  on public.tips (fundamental, published_at desc, id)
  where status = 'published';

create trigger tips_set_updated_at
  before update on public.tips
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- tip_translations
-- ---------------------------------------------------------------------------

create table public.tip_translations (
  tip_id uuid not null references public.tips (id) on delete cascade,
  locale text not null references public.languages (code),
  title text not null,
  achievement text,
  keys text[] not null default '{}',
  common_error text,
  practice text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tip_translations_pkey primary key (tip_id, locale),
  constraint tip_translations_title_check check (title ~ '\S'),
  -- Un texto que no se escribió es nulo, nunca blanco.
  constraint tip_translations_achievement_check check (achievement ~ '\S'),
  constraint tip_translations_common_error_check check (common_error ~ '\S'),
  constraint tip_translations_practice_check check (practice ~ '\S'),
  -- Hasta tres claves, ninguna nula ni en blanco.
  constraint tip_translations_keys_check check (
    cardinality(keys) <= 3
    -- Una sola dimensión que empieza en uno: así los índices de abajo las
    -- alcanzan todas. Un arreglo vacío no tiene dimensiones.
    and coalesce(array_ndims(keys), 1) = 1
    and coalesce(array_lower(keys, 1), 1) = 1
    and array_position(keys, null) is null
    and (cardinality(keys) < 1 or keys[1] ~ '\S')
    and (cardinality(keys) < 2 or keys[2] ~ '\S')
    and (cardinality(keys) < 3 or keys[3] ~ '\S')
  )
);

comment on table public.tip_translations is
  'scope: shared. Los textos de un tip en un idioma (FR-014). Texto plano: se pinta como texto, nunca como HTML. Visible al público solo si el tip lo es.';

create trigger tip_translations_set_updated_at
  before update on public.tip_translations
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- set_featured_tip: cambiar el destacado en una sola operación
-- ---------------------------------------------------------------------------

-- Quita el destacado al que lo tenga y se lo pone al tip pedido. `security
-- invoker`: las políticas de RLS mandan, así que a quien no puede escribir no
-- se le actualiza ninguna fila y recibe el mismo rechazo que un id que no
-- existe. El rechazo revierte lo que ya se hubiera quitado. El candado pone en
-- fila dos cambios simultáneos.
create function public.set_featured_tip(p_tip_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('public.tips.featured')
  );
  update public.tips set is_featured = false
  where is_featured and id <> p_tip_id;
  update public.tips set is_featured = true where id = p_tip_id;
  if not found then
    raise exception 'el tip % no existe', p_tip_id using errcode = 'P0002';
  end if;
end;
$$;

comment on function public.set_featured_tip(uuid) is
  'Destaca un tip y deja de destacar al anterior. Solo lo logra quien puede editar tips.';

revoke all on function public.set_featured_tip(uuid) from public, anon;
grant execute on function public.set_featured_tip(uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Permisos y RLS
-- ---------------------------------------------------------------------------

alter table public.tips enable row level security;
alter table public.tip_translations enable row level security;

revoke all on table public.tips, public.tip_translations
  from public, anon, authenticated, service_role;
grant select on table public.tips, public.tip_translations to anon;
-- Un tip no se borra: nadie recibe ese permiso, ni el servidor.
grant select, insert, update on table public.tips
  to authenticated, service_role;
-- Una traducción sí se quita: un idioma que se vacía en el editor.
grant select, insert, update, delete on table public.tip_translations
  to authenticated, service_role;

create policy tips_select_anon on public.tips
  for select
  to anon
  using (status = 'published' and published_at <= now());

create policy tips_select on public.tips
  for select
  to authenticated
  using (
    (status = 'published' and published_at <= now())
    or (select public.is_admin())
  );

create policy tips_insert on public.tips
  for insert
  to authenticated
  with check ((select public.is_admin()));

create policy tips_update on public.tips
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy tip_translations_select_anon on public.tip_translations
  for select
  to anon
  using (
    exists (
      select 1 from public.tips
      where tips.id = tip_translations.tip_id
        and tips.status = 'published'
        and tips.published_at <= now()
    )
  );

create policy tip_translations_select on public.tip_translations
  for select
  to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.tips
      where tips.id = tip_translations.tip_id
        and tips.status = 'published'
        and tips.published_at <= now()
    )
  );

create policy tip_translations_insert on public.tip_translations
  for insert
  to authenticated
  with check ((select public.is_admin()));

create policy tip_translations_update on public.tip_translations
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy tip_translations_delete on public.tip_translations
  for delete
  to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- public_tips: lo que leen el sitio y la app
-- ---------------------------------------------------------------------------

-- `security_invoker`: la vista consulta con los permisos de quien la lee, así
-- que RLS sigue mandando. El filtro propio hace que un admin también vea aquí
-- solo lo público.
create view public.public_tips
with (security_invoker = true) as
select
  tip.id,
  tip.slug,
  tip.bunny_video_id,
  tip.orientation,
  tip.duration_seconds,
  tip.thumbnail_url,
  tip.fundamental,
  tip.level,
  tip.tiktok_url,
  tip.promo,
  tip.is_featured,
  tip.published_at,
  (
    select jsonb_object_agg(
      translation.locale,
      jsonb_build_object(
        'title', translation.title,
        'achievement', translation.achievement,
        'keys', to_jsonb(translation.keys),
        'common_error', translation.common_error,
        'practice', translation.practice
      )
    )
    from public.tip_translations as translation
    where translation.tip_id = tip.id
  ) as translations
from public.tips as tip
where tip.status = 'published'
  and tip.published_at <= now()
  -- El español es obligatorio: sin él no hay título ni respaldo que mostrar.
  and exists (
    select 1 from public.tip_translations as spanish
    where spanish.tip_id = tip.id and spanish.locale = 'es'
  );

comment on view public.public_tips is
  'scope: shared. Los tips publicados con fecha pasada y con textos en español, con el id del video de Bunny y sus textos por idioma en `translations` (FR-078, AC-034). La lee la app: cambiar sus columnas la puede romper.';

revoke all on table public.public_tips
  from public, anon, authenticated, service_role;
grant select on table public.public_tips
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- search_public_tips: el listado con sus filtros y su búsqueda (FR-013)
-- ---------------------------------------------------------------------------

-- Busca en el título, la frase de logro y las claves que muestra la página de
-- ese idioma: campo por campo, y en español lo que falte (FR-007). No
-- distingue mayúsculas ni tildes, y lo escrito es texto: no hay comodines. El
-- orden y la página los pide quien llama.
create function public.search_public_tips(
  p_locale text,
  p_query text default null,
  p_fundamental public.tip_fundamental default null,
  p_level public.tip_level default null
)
returns setof public.public_tips
language sql
stable
security invoker
set search_path = ''
as $$
  select tip.*
  from public.public_tips as tip
  cross join lateral (
    select
      tip.translations -> 'es' as spanish,
      coalesce(tip.translations -> p_locale, '{}'::jsonb) as wanted
  ) as source
  cross join lateral (
    select concat_ws(
      -- El salto de línea impide que una búsqueda una dos campos.
      E'\n',
      case when source.wanted ->> 'title' ~ '\S'
        then source.wanted ->> 'title'
        else source.spanish ->> 'title'
      end,
      case when source.wanted ->> 'achievement' ~ '\S'
        then source.wanted ->> 'achievement'
        else source.spanish ->> 'achievement'
      end,
      (
        select string_agg(item.value, E'\n')
        from jsonb_array_elements_text(
          case when source.wanted -> 'keys' -> 0 is not null
            then source.wanted -> 'keys'
            else source.spanish -> 'keys'
          end
        ) as item
      )
    ) as content
  ) as shown
  where (p_fundamental is null or tip.fundamental = p_fundamental)
    and (p_level is null or tip.level = p_level)
    and (
      coalesce(p_query, '') !~ '\S'
      or position(
        lower(extensions.unaccent(
          'extensions.unaccent'::regdictionary,
          normalize(btrim(p_query, E' \t\r\n'), nfc)
        ))
        in lower(extensions.unaccent(
          'extensions.unaccent'::regdictionary,
          normalize(shown.content, nfc)
        ))
      ) > 0
    );
$$;

comment on function public.search_public_tips(
  text, text, public.tip_fundamental, public.tip_level
) is
  'Los tips públicos que cumplen los filtros y la búsqueda sobre los textos del idioma pedido, sin distinguir mayúsculas ni tildes.';

revoke all on function public.search_public_tips(
  text, text, public.tip_fundamental, public.tip_level
) from public;
grant execute on function public.search_public_tips(
  text, text, public.tip_fundamental, public.tip_level
) to anon, authenticated, service_role;
