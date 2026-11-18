-- Primera migración: perfiles con rol (FR-077, AC-033).
-- Modelo: docs/modelo-de-datos.md, secciones 1, 3, 4 y 13.
-- PRD: docs/prd/w1-fundacion-tecnica.md, RF-4.

create extension if not exists citext with schema extensions;

-- Enums base. Los demás los crea cada épica junto con sus tablas.
create type public.user_role as enum ('admin', 'staff', 'buyer');
create type public.publish_status as enum ('draft', 'published', 'retired');

-- ---------------------------------------------------------------------------
-- Tabla
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email extensions.citext not null,
  role public.user_role not null default 'buyer',
  full_name text,
  locale text not null default 'es',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_key unique (email),
  -- DR-008: el correo se guarda en minúsculas y sin espacios alrededor.
  constraint profiles_email_normalized_check
    check (email::text = lower(btrim(email::text)) and email::text <> ''),
  -- W2 crea la tabla `languages` y cambia esta regla por una clave foránea.
  constraint profiles_locale_check check (locale in ('es', 'en'))
);

comment on table public.profiles is
  'scope: shared. Un perfil por usuario de Supabase Auth, con su rol (FR-077).';

-- RLS explícito: los proyectos remotos lo activan solos en tablas nuevas,
-- la base local no.
alter table public.profiles enable row level security;

-- Permisos explícitos, para no depender de los permisos por defecto de cada
-- entorno. Nadie inserta ni borra perfiles por la API: los crea el
-- disparador de alta y los borra la cascada desde auth.users.
revoke all on table public.profiles from public, anon, authenticated;
-- anon puede consultar, pero ninguna política le da filas: recibe cero.
grant select on table public.profiles to anon;
grant select, update on table public.profiles to authenticated;
grant all on table public.profiles to service_role;

-- ---------------------------------------------------------------------------
-- is_admin(): la única forma en que una política pregunta por el rol admin
-- ---------------------------------------------------------------------------

-- security definer: lee `profiles` sin pasar por RLS. Si una política de
-- `profiles` consultara la tabla directamente, Postgres entraría en
-- recursión. Solo responde por quien hace la consulta (auth.uid()), así que
-- no deja averiguar el rol de otra persona.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and is_active
  );
$$;

comment on function public.is_admin() is
  'Verdadero solo si quien consulta es un admin activo. Úsala en toda política de admin.';

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Políticas
-- ---------------------------------------------------------------------------

-- Una sola política por acción: varias políticas permisivas para el mismo rol
-- y la misma acción se evalúan todas en cada consulta.

-- Cada quien lee su fila. Un admin activo las lee todas.
create policy profiles_select on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

-- Un comprador edita su propia fila; el staff no. `with check` impide que un
-- comprador salga de `buyer`; `email` e `is_active` los cuida el disparador
-- `profiles_protect_columns`. Un admin activo edita cualquier fila.
create policy profiles_update on public.profiles
  for update
  to authenticated
  using (
    (id = (select auth.uid()) and role = 'buyer')
    or (select public.is_admin())
  )
  with check (
    (id = (select auth.uid()) and role = 'buyer')
    or (select public.is_admin())
  );

-- ---------------------------------------------------------------------------
-- Disparadores de la tabla
-- ---------------------------------------------------------------------------

-- La comparten todas las tablas editables (convención del modelo de datos).
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- `id`, `email`, `role`, `is_active` y `created_at` solo los cambia un admin
-- activo o el servidor. Se resuelve aquí y no con permisos por columna
-- porque el admin entra con el mismo rol de Postgres (`authenticated`) que
-- un comprador.
create function public.profiles_protect_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.id, new.email, new.role, new.is_active, new.created_at)
     is not distinct from
     (old.id, old.email, old.role, old.is_active, old.created_at) then
    return new;
  end if;

  -- Roles del servidor: la llave de servicio y las migraciones.
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;

  if (select public.is_admin()) then
    return new;
  end if;

  raise exception 'Columnas protegidas de profiles: solo un admin cambia id, email, role, is_active o created_at'
    using errcode = '42501';
end;
$$;

revoke all on function public.profiles_protect_columns() from public, anon, authenticated;

create trigger profiles_protect_columns
  before update on public.profiles
  for each row
  execute function public.profiles_protect_columns();

-- ---------------------------------------------------------------------------
-- Alta: un perfil por cada usuario de Supabase Auth
-- ---------------------------------------------------------------------------

-- security definer: la ejecuta el servicio de Auth, que no tiene permisos
-- sobre `public.profiles`. Si falla, la inserción en auth.users se revierte:
-- nunca queda un usuario sin perfil.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null or btrim(new.email) = '' then
    raise exception 'No se puede crear un usuario sin correo: su perfil lo exige'
      using errcode = '23502';
  end if;

  insert into public.profiles (id, email)
  values (new.id, lower(btrim(new.email)));

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- El correo del perfil sigue al de Auth. Sin esto, quien cambie su correo en
-- Auth quedaría con el viejo en su perfil, y no podría corregirlo porque
-- `email` es una columna protegida.
create function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null or btrim(new.email) = '' then
    raise exception 'No se puede dejar a un usuario sin correo: su perfil lo exige'
      using errcode = '23502';
  end if;

  update public.profiles
  set email = lower(btrim(new.email))
  where id = new.id;

  return new;
end;
$$;

revoke all on function public.handle_user_email_change() from public, anon, authenticated;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- Usuarios que ya existieran en Auth antes de esta migración. En una base
-- recién creada no hay ninguno y esto no inserta nada.
insert into public.profiles (id, email)
select id, lower(btrim(email))
from auth.users
where email is not null and btrim(email) <> ''
on conflict (id) do nothing;
