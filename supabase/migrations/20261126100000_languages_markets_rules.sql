-- Reglas de idiomas y mercados que no pueden depender de la pantalla
-- (FR-065, FR-009). PRD: docs/prd/w10a-admin-base.md, RF-12.

-- El idioma por defecto es el que se sirve cuando no hay otro: no se apaga.
alter table public.languages
  add constraint languages_default_active_check
  check (is_active or not is_default);

-- La misma lista que `src/lib/payment-methods.ts`; una prueba las compara.
-- `<@` también rechaza un elemento nulo.
alter table public.markets
  add constraint markets_payment_methods_check
  check (
    payment_methods <@ array['card', 'pse', 'nequi', 'bancolombia_button']::text[]
  );

-- ---------------------------------------------------------------------------
-- Siempre queda al menos un mercado activo
-- ---------------------------------------------------------------------------

-- Pone en fila a quienes apagan o borran mercados: sin esto, dos que apagan a
-- la vez los dos últimos se ven activos el uno al otro. Es por sentencia para
-- tomar el candado antes que cualquier fila y no caer en un interbloqueo.
create function public.markets_serialize_deactivation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('public.markets.last_active', 0)
  );
  return null;
end;
$$;

revoke all on function public.markets_serialize_deactivation()
  from public, anon, authenticated;

create trigger markets_serialize_deactivation
  before update of is_active or delete on public.markets
  for each statement
  execute function public.markets_serialize_deactivation();

-- `security definer`: la cuenta de mercados activos no puede depender de lo
-- que las políticas dejen ver a quien escribe, y `for share` pide permiso de
-- actualizar. El bloqueo de la fila que queda hace fallar a quien trabaje con
-- una foto vieja (aislamiento repetible o serializable).
create function public.markets_require_one_active()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.is_active then
    return null;
  end if;

  perform 1 from public.markets where is_active limit 1 for share;
  if not found then
    raise exception 'markets_last_active_check: no se puede desactivar el único mercado activo'
      using errcode = '23514';
  end if;
  return null;
end;
$$;

revoke all on function public.markets_require_one_active()
  from public, anon, authenticated;

create trigger markets_require_one_active
  after update of is_active or delete on public.markets
  for each row
  when (old.is_active)
  execute function public.markets_require_one_active();

-- ---------------------------------------------------------------------------
-- El idioma por defecto de un mercado se elige entre los activos
-- ---------------------------------------------------------------------------

-- Solo mira la elección: un mercado cuyo idioma se desactivó después se sigue
-- pudiendo editar sin cambiarlo. `for share` espera a quien esté apagando ese
-- idioma. Un idioma que no existe lo rechaza la clave foránea.
create function public.markets_require_active_default_locale()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_locale_active boolean;
begin
  if tg_op = 'UPDATE' and new.default_locale = old.default_locale then
    return new;
  end if;

  select is_active into is_locale_active
  from public.languages
  where code = new.default_locale
  for share;

  if found and not is_locale_active then
    raise exception 'markets_default_locale_active_check: el idioma % está desactivado', new.default_locale
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.markets_require_active_default_locale()
  from public, anon, authenticated;

create trigger markets_require_active_default_locale
  before insert or update of default_locale on public.markets
  for each row
  execute function public.markets_require_active_default_locale();
