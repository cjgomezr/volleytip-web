-- Límites de frecuencia y contadores de rechazos de formularios (FR-135).
-- Modelo: docs/modelo-de-datos.md, sección 4.
-- PRD: docs/prd/w1-fundacion-tecnica.md, RF-7.

-- ---------------------------------------------------------------------------
-- rate_limits: cuántas veces se usó una clave dentro de su ventana
-- ---------------------------------------------------------------------------

create table public.rate_limits (
  -- Texto opaco para la base: quien llama la arma (formulario + hash de IP).
  key text primary key,
  window_start timestamptz not null,
  -- La ventana queda fija al empezar. Guardar su final deja que la limpieza
  -- sepa cuándo venció sin conocer el límite de cada formulario.
  expires_at timestamptz not null,
  count integer not null,
  constraint rate_limits_key_check check (btrim(key) <> ''),
  constraint rate_limits_window_check check (expires_at > window_start),
  constraint rate_limits_count_check check (count > 0)
);

comment on table public.rate_limits is
  'scope: web. Conteo de envíos por clave y ventana (FR-135). Solo la escribe check_rate_limit desde el servidor; una tarea diaria borra las ventanas vencidas.';

alter table public.rate_limits enable row level security;

revoke all on table public.rate_limits from public, anon, authenticated, service_role;
-- anon puede consultar, pero no hay política que le dé filas.
grant select on table public.rate_limits to anon;
grant select on table public.rate_limits to authenticated;
grant select, insert, update, delete on table public.rate_limits to service_role;

create policy rate_limits_select on public.rate_limits
  for select
  to authenticated
  using ((select public.is_admin()));

-- Cuenta el intento y decide en una sola sentencia. El `on conflict do
-- update` bloquea la fila de la clave: dos llamadas simultáneas se ponen en
-- fila y cada una ve el conteo que dejó la anterior. La aplicación nunca lee
-- el conteo para decidir por su cuenta.
-- Un intento rechazado también cuenta. Devuelve verdadero si se permite.
create function public.check_rate_limit(
  p_key text,
  p_max_attempts integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_key is null or btrim(p_key) = '' then
    raise exception 'p_key no puede estar vacía' using errcode = '22023';
  end if;
  if p_max_attempts is null or p_max_attempts < 1 then
    raise exception 'p_max_attempts debe ser 1 o más' using errcode = '22023';
  end if;
  if p_window_seconds is null or p_window_seconds < 1 then
    raise exception 'p_window_seconds debe ser 1 o más' using errcode = '22023';
  end if;

  insert into public.rate_limits as current_limit (key, window_start, expires_at, count)
  values (p_key, now(), now() + make_interval(secs => p_window_seconds), 1)
  on conflict (key) do update
  set window_start = case
        when current_limit.expires_at <= now() then excluded.window_start
        else current_limit.window_start
      end,
      expires_at = case
        when current_limit.expires_at <= now() then excluded.expires_at
        else current_limit.expires_at
      end,
      count = case
        when current_limit.expires_at <= now() then 1
        else current_limit.count + 1
      end
  returning current_limit.count into v_count;

  return v_count <= p_max_attempts;
end;
$$;

-- Solo el servidor, con la llave de servicio.
revoke all on function public.check_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer)
  to service_role;

-- Borra los límites cuya ventana venció hace más de un día. El día de margen
-- deja ver qué pasó ayer si hay que investigar un abuso. Devuelve cuántos borró.
create function public.purge_expired_rate_limits()
returns integer
language sql
set search_path = ''
as $$
  with purged as (
    delete from public.rate_limits
    where expires_at < now() - interval '1 day'
    returning 1
  )
  select count(*)::integer from purged;
$$;

revoke all on function public.purge_expired_rate_limits()
  from public, anon, authenticated;
grant execute on function public.purge_expired_rate_limits() to service_role;

-- ---------------------------------------------------------------------------
-- form_rejections: cuántos envíos se rechazaron, y nada más
-- ---------------------------------------------------------------------------

create table public.form_rejections (
  form text not null,
  reason text not null,
  -- Día en UTC.
  day date not null,
  count integer not null,
  primary key (form, reason, day),
  -- Solo un identificador corto: así `form` no puede cargar un correo, una
  -- IP ni texto del envío.
  constraint form_rejections_form_check check (form ~ '^[a-z][a-z0-9_]{0,39}$'),
  constraint form_rejections_reason_check check (
    reason in ('turnstile', 'honeypot', 'too_fast', 'rate_limit', 'validation')
  ),
  constraint form_rejections_count_check check (count > 0)
);

comment on table public.form_rejections is
  'scope: web. Contadores diarios de envíos rechazados por formulario y motivo (FR-135). Sin contenido del envío, correo ni IP.';

alter table public.form_rejections enable row level security;

revoke all on table public.form_rejections from public, anon, authenticated, service_role;
grant select on table public.form_rejections to anon;
grant select on table public.form_rejections to authenticated;
grant select, insert, update on table public.form_rejections to service_role;

create policy form_rejections_select on public.form_rejections
  for select
  to authenticated
  using ((select public.is_admin()));

-- Suma uno al contador de hoy (UTC) para ese formulario y motivo.
create function public.record_form_rejection(p_form text, p_reason text)
returns void
language sql
set search_path = ''
as $$
  insert into public.form_rejections as current_counter (form, reason, day, count)
  values (p_form, p_reason, (now() at time zone 'utc')::date, 1)
  on conflict (form, reason, day) do update
  set count = current_counter.count + 1;
$$;

revoke all on function public.record_form_rejection(text, text)
  from public, anon, authenticated;
grant execute on function public.record_form_rejection(text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Limpieza diaria con pg_cron
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- Todos los días a las 04:17 UTC. Programar con el mismo nombre reemplaza la
-- tarea en vez de duplicarla.
select cron.schedule(
  'purge-expired-rate-limits',
  '17 4 * * *',
  $$select public.purge_expired_rate_limits()$$
);
