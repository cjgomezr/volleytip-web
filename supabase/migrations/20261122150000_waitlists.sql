-- Listas de espera: la app y el "Avísame" del próximo camp (FR-082, FR-035).
-- Modelo: docs/modelo-de-datos.md, sección 11.
-- PRD: docs/prd/w3-navegacion-home-paginas-de-apoyo.md, RF-10.

create table public.waitlists (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  email text not null,
  locale text not null references public.languages (code),
  country_code text,
  city text,
  -- La versión de la política de privacidad que aceptó quien se inscribió.
  privacy_version text not null,
  -- Lo llena el envío del aviso (W8 para camps, el lanzamiento para la app).
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint waitlists_kind_check check (kind in ('app', 'camp_notify')),
  -- DR-008: el correo se guarda en minúsculas y sin espacios.
  constraint waitlists_email_check
    check (email <> '' and email = lower(btrim(email))),
  constraint waitlists_country_code_check
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint waitlists_privacy_version_check
    check (btrim(privacy_version) <> ''),
  constraint waitlists_kind_email_key unique (kind, email)
);

comment on table public.waitlists is
  'scope: web. Correos que esperan un aviso: la app (app) o el próximo camp (camp_notify). Una fila por correo y tipo. Sin IP: el límite por IP vive en rate_limits.';

alter table public.waitlists enable row level security;

revoke all on table public.waitlists from public, anon, authenticated;
grant select on table public.waitlists to authenticated;
grant all on table public.waitlists to service_role;

-- Solo un admin lee la lista. Nadie escribe por la API: se inscribe con
-- `enroll_waitlist`, que corre con la llave de servicio.
create policy waitlists_select on public.waitlists
  for select
  to authenticated
  using ((select public.is_admin()));

-- Inscribe un correo. Si ya estaba inscrito en ese tipo no hace nada: ni
-- falla, ni duplica, ni cambia la fila. `on conflict do nothing` deja que la
-- base resuelva la carrera entre dos inscripciones simultáneas.
create function public.enroll_waitlist(
  p_kind text,
  p_email text,
  p_locale text,
  p_privacy_version text,
  p_country_code text default null,
  p_city text default null
)
returns void
language sql
set search_path = ''
as $$
  insert into public.waitlists (kind, email, locale, country_code, city, privacy_version)
  values (p_kind, lower(btrim(p_email)), p_locale, p_country_code, p_city, p_privacy_version)
  on conflict (kind, email) do nothing;
$$;

revoke all on function public.enroll_waitlist(text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.enroll_waitlist(text, text, text, text, text, text)
  to service_role;
