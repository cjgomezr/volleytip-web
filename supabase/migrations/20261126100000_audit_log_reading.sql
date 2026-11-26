-- Lectura de la bitácora desde el panel (FR-067).
-- PRD: docs/prd/w10a-admin-base.md, RF-15.

-- ---------------------------------------------------------------------------
-- Índices de consulta: la lista va de la más reciente a la más antigua, sola o
-- filtrada por persona o por acción. El id desempata las de la misma hora.
-- ---------------------------------------------------------------------------

create index audit_log_created_at_idx
  on public.audit_log (created_at desc, id desc);

create index audit_log_actor_created_at_idx
  on public.audit_log (actor_id, created_at desc, id desc);

create index audit_log_action_created_at_idx
  on public.audit_log (action, created_at desc, id desc);

-- El compuesto empieza por `actor_id`: ya cubre la clave foránea.
drop index public.audit_log_actor_id_idx;

-- ---------------------------------------------------------------------------
-- Lo que ofrecen los filtros. La API no sabe pedir valores distintos.
-- Corren con los permisos de quien consulta: sin RLS de admin no hay filas.
-- ---------------------------------------------------------------------------

create function public.audit_log_actors()
returns table (id uuid, full_name text, email text)
language sql
stable
set search_path = ''
as $$
  select p.id, p.full_name, p.email::text
  from public.profiles as p
  where exists (
    select 1 from public.audit_log as entry where entry.actor_id = p.id
  );
$$;

comment on function public.audit_log_actors() is
  'Quienes tienen al menos una entrada en la bitácora. Solo responde a un admin (RLS).';

create function public.audit_log_actions()
returns setof text
language sql
stable
set search_path = ''
as $$
  select distinct action from public.audit_log order by action;
$$;

comment on function public.audit_log_actions() is
  'Las acciones que aparecen en la bitácora. Solo responde a un admin (RLS).';

revoke all on function public.audit_log_actors() from public, anon;
revoke all on function public.audit_log_actions() from public, anon;
grant execute on function public.audit_log_actors() to authenticated, service_role;
grant execute on function public.audit_log_actions() to authenticated, service_role;
