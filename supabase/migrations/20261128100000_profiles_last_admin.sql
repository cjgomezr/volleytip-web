-- Siempre queda al menos un admin activo (FR-058, FR-065, DR-006).
-- Ticket #130. PRD: docs/prd/w10a-admin-base.md, RF-14.
--
-- La regla va en la base y no en la pantalla: vale para el panel, para la API,
-- para la llave de servicio y para un cambio hecho a mano.
--
-- Solo mira cambios de `role` e `is_active`. Borrar un usuario desde Supabase
-- Auth no pasa por aquí: el panel no ofrece borrar a nadie.

-- Pone en fila a quienes cambian roles o estados: sin esto, dos admins que se
-- desactivan a la vez se ven activos el uno al otro. Es por sentencia para
-- tomar el candado antes que cualquier fila y no caer en un interbloqueo.
create function public.profiles_serialize_role_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('public.profiles.last_admin', 0)
  );
  return null;
end;
$$;

revoke all on function public.profiles_serialize_role_changes()
  from public, anon, authenticated;

create trigger profiles_serialize_role_changes
  before update of role, is_active on public.profiles
  for each statement
  execute function public.profiles_serialize_role_changes();

-- `security definer`: buscar a otro admin no puede depender de lo que las
-- políticas dejen ver a quien escribe, y `for share` pide permiso de
-- actualizar. Ese bloqueo hace fallar a quien trabaje con una foto vieja
-- (aislamiento repetible o serializable). Al ser `before`, ve las filas que la
-- misma sentencia ya cambió.
create function public.profiles_require_one_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'admin' and new.is_active then
    return new;
  end if;

  perform 1
  from public.profiles
  where role = 'admin' and is_active and id <> old.id
  limit 1
  for share;
  if not found then
    raise exception 'profiles_last_admin_check: tiene que quedar al menos un admin activo'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.profiles_require_one_admin()
  from public, anon, authenticated;

-- El nombre importa: los disparadores `before` corren en orden alfabético y
-- este va antes que `profiles_protect_columns`. De dos admins que se
-- desactivan a la vez, el segundo recibe así el rechazo del último admin, que
-- la pantalla explica, y no uno de permisos.
create trigger profiles_keep_one_admin
  before update of role, is_active on public.profiles
  for each row
  when (old.role = 'admin' and old.is_active)
  execute function public.profiles_require_one_admin();
