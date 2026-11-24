-- Mensajes del formulario de contacto (FR-053, FR-064).
-- Modelo: docs/modelo-de-datos.md, sección 11.
-- PRD: docs/prd/w3-navegacion-home-paginas-de-apoyo.md, RF-8.

create type public.message_status as enum ('new', 'answered', 'archived');

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  reason text not null,
  name text not null,
  email text not null,
  whatsapp text,
  country_code text,
  -- El mensaje va fuera de `payload` para poder limitarlo y buscarlo.
  body text not null,
  -- Los campos propios del motivo (número de pedido, organización...).
  payload jsonb not null default '{}'::jsonb,
  locale text not null references public.languages (code),
  -- La versión de la política de privacidad que aceptó quien escribió.
  privacy_version text not null,
  status public.message_status not null default 'new',
  answered_by uuid references public.profiles (id),
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  constraint messages_reason_check
    check (reason in ('order', 'camps', 'brands', 'suggest_tip', 'vball_tour', 'other')),
  constraint messages_name_check
    check (btrim(name) <> '' and char_length(name) <= 120),
  -- DR-008: el correo se guarda en minúsculas y sin espacios.
  constraint messages_email_check
    check (email <> '' and email = lower(btrim(email))),
  constraint messages_body_check
    check (btrim(body) <> '' and char_length(body) <= 2000),
  constraint messages_payload_check
    check (jsonb_typeof(payload) = 'object'),
  constraint messages_country_code_check
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint messages_privacy_version_check
    check (btrim(privacy_version) <> '')
);

comment on table public.messages is
  'scope: web. Mensajes del formulario de contacto y de los aliados del VBall Tour. Se insertan solo con save_message; solo un admin los lee y cambia su estado. Sin IP: el límite por IP vive en rate_limits. El contenido es texto de una persona: se pinta como texto, nunca como HTML.';

alter table public.messages enable row level security;

revoke all on table public.messages from public, anon, authenticated;
grant select on table public.messages to authenticated;
-- Un admin solo cambia el estado y quién respondió, no lo que escribió la persona.
grant update (status, answered_by, answered_at) on table public.messages to authenticated;
grant all on table public.messages to service_role;

create policy messages_select on public.messages
  for select
  to authenticated
  using ((select public.is_admin()));

create policy messages_update on public.messages
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Guarda un mensaje nuevo. El estado inicial lo pone la tabla (`new`).
create function public.save_message(
  p_reason text,
  p_name text,
  p_email text,
  p_body text,
  p_locale text,
  p_privacy_version text,
  p_whatsapp text default null,
  p_country_code text default null,
  p_payload jsonb default '{}'::jsonb
)
returns void
language sql
set search_path = ''
as $$
  insert into public.messages
    (reason, name, email, whatsapp, country_code, body, payload, locale, privacy_version)
  values
    (p_reason, p_name, lower(btrim(p_email)), p_whatsapp, p_country_code, p_body,
     p_payload, p_locale, p_privacy_version);
$$;

revoke all on function public.save_message(text, text, text, text, text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_message(text, text, text, text, text, text, text, text, jsonb)
  to service_role;
