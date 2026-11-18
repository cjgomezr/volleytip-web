-- Ajustes del sitio y bitácora de auditoría (FR-067).
-- Modelo: docs/modelo-de-datos.md, secciones 4 y 13.
-- PRD: docs/prd/w1-fundacion-tecnica.md, RF-5 y RF-6.

-- ---------------------------------------------------------------------------
-- settings: ajustes que el admin cambia sin desplegar
-- ---------------------------------------------------------------------------

create table public.settings (
  key text primary key,
  value jsonb not null,
  -- `set null`: borrar a quien hizo el último cambio no borra el ajuste.
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint settings_key_check check (key = btrim(key) and key <> '')
);

comment on table public.settings is
  'scope: web. Ajustes del sitio que el admin cambia sin desplegar. Sin claves sembradas: cada épica siembra las suyas.';

create index settings_updated_by_idx on public.settings (updated_by);

alter table public.settings enable row level security;

-- Permisos explícitos. El sitio público lee los ajustes desde el servidor,
-- con la llave de servicio; por la API solo los ve y los cambia un admin.
-- Nadie los borra por la API.
revoke all on table public.settings from public, anon, authenticated;
-- anon y los demás roles pueden consultar, pero la política no les da filas.
grant select on table public.settings to anon;
grant select, insert, update on table public.settings to authenticated;
grant all on table public.settings to service_role;

create policy settings_select on public.settings
  for select
  to authenticated
  using ((select public.is_admin()));

create policy settings_insert on public.settings
  for insert
  to authenticated
  with check ((select public.is_admin()));

create policy settings_update on public.settings
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Quién y cuándo los pone la base, no quien escribe. Con sesión, el autor es
-- siempre quien consulta: un admin no puede atribuirle el cambio a otro. Sin
-- sesión (el servidor con la llave de servicio, o una migración que siembra
-- una clave) se respeta el `updated_by` que llegue: el servidor lo indica en
-- cada cambio, porque si lo omite queda el autor anterior con la hora nueva.
-- `created_at` y `key` no cambian después de crear el ajuste.
create function public.settings_stamp_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.created_at := old.created_at;
    new.key := old.key;
  end if;

  new.updated_at := now();
  if (select auth.uid()) is not null then
    new.updated_by := (select auth.uid());
  end if;
  return new;
end;
$$;

revoke all on function public.settings_stamp_change() from public, anon, authenticated;

create trigger settings_stamp_change
  before insert or update on public.settings
  for each row
  execute function public.settings_stamp_change();

-- ---------------------------------------------------------------------------
-- audit_log: bitácora de lo que hace el admin. Solo inserción.
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  -- Nulo cuando la acción no la hizo una persona (un webhook, una tarea).
  -- `restrict`: un perfil con entradas no se borra, se desactiva. Así la
  -- bitácora nunca pierde a su autor.
  actor_id uuid references public.profiles (id) on delete restrict,
  action text not null,
  entity text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_log_action_check check (action = btrim(action) and action <> ''),
  constraint audit_log_entity_check check (entity = btrim(entity) and entity <> '')
);

comment on table public.audit_log is
  'scope: web. Bitácora de acciones del admin (FR-067). Solo inserción y solo desde el servidor: nadie la edita ni la borra.';

-- Índice de la clave foránea. Los de consulta (por fecha, por entidad) los
-- agrega W10a cuando exista la pantalla que lee la bitácora.
create index audit_log_actor_id_idx on public.audit_log (actor_id);

alter table public.audit_log enable row level security;

-- Solo el servidor inserta, y nadie tiene permiso de actualizar, borrar ni
-- vaciar. Los disparadores de abajo cubren a quien se salta los permisos.
revoke all on table public.audit_log from public, anon, authenticated, service_role;
grant select on table public.audit_log to anon;
grant select on table public.audit_log to authenticated;
grant select, insert on table public.audit_log to service_role;

create policy audit_log_select on public.audit_log
  for select
  to authenticated
  using ((select public.is_admin()));

-- La fecha la pone la base: quien inserta no puede anteponer ni posponer una
-- entrada.
create function public.audit_log_stamp_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := now();
  return new;
end;
$$;

revoke all on function public.audit_log_stamp_insert() from public, anon, authenticated;

create trigger audit_log_stamp_insert
  before insert on public.audit_log
  for each row
  execute function public.audit_log_stamp_insert();

-- La llave de servicio salta RLS, y el dueño de la tabla salta los permisos:
-- por eso el "solo inserción" va en disparadores, que aplican a todos.
create function public.audit_log_reject_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_log es de solo inserción: no se permite %', tg_op
    using errcode = '42501';
end;
$$;

revoke all on function public.audit_log_reject_change() from public, anon, authenticated;

create trigger audit_log_reject_update_or_delete
  before update or delete on public.audit_log
  for each row
  execute function public.audit_log_reject_change();

create trigger audit_log_reject_truncate
  before truncate on public.audit_log
  for each statement
  execute function public.audit_log_reject_change();

-- `always`: los disparadores normales no corren cuando la sesión está en modo
-- réplica (`session_replication_role = replica`). Estos tres sí.
alter table public.audit_log enable always trigger audit_log_stamp_insert;
alter table public.audit_log enable always trigger audit_log_reject_update_or_delete;
alter table public.audit_log enable always trigger audit_log_reject_truncate;
