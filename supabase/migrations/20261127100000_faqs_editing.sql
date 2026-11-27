-- Editar las preguntas frecuentes desde el panel (FR-065, FR-137, AC-065).
-- Ticket #127. PRD: docs/prd/w10a-admin-base.md, RF-11.
--
-- Cada escritura del panel es una sola operación: una pregunta y sus
-- traducciones, o las dos posiciones que se intercambian, cambian juntas o no
-- cambian. Las funciones son `security invoker`: las políticas de RLS siguen
-- mandando.

-- Una pregunta no se borra: se retira. El servicio y las migraciones conservan
-- el permiso.
drop policy faqs_delete on public.faqs;
revoke delete on table public.faqs from authenticated;

-- El orden en que el sitio y el panel listan las preguntas es
-- `sort_order, created_at, id`. Quien lo cambia toma este bloqueo.
create function public.lock_faq_order()
returns void
language sql
set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtext('public.faqs.sort_order'));
$$;

create function public.assert_faq_editor()
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'solo un admin edita las preguntas frecuentes'
      using errcode = '42501';
  end if;
end;
$$;

create function public.faq_has_default_text(p_faq_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.faq_translations as translation
    join public.languages as language on language.code = translation.locale
    where translation.faq_id = p_faq_id
      and language.is_default
      and translation.question ~ '\S'
      and translation.answer ~ '\S'
  );
$$;

-- `p_translations`: [{"locale": "es", "question": "...", "answer": "..."}].
create function public.write_faq_translations(
  p_faq_id uuid,
  p_translations jsonb
)
returns void
language sql
set search_path = ''
as $$
  insert into public.faq_translations (faq_id, locale, question, answer)
  select p_faq_id, item.locale, item.question, item.answer
  from jsonb_to_recordset(p_translations)
    as item (locale text, question text, answer text)
  on conflict (faq_id, locale) do update
    set question = excluded.question, answer = excluded.answer;
$$;

-- Nace en borrador y al final del orden.
create function public.create_faq(p_translations jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  new_id uuid;
  new_sort_order integer;
begin
  perform public.assert_faq_editor();
  perform public.lock_faq_order();

  insert into public.faqs (sort_order)
  select coalesce(max(sort_order), 0) + 1 from public.faqs
  returning id, sort_order into new_id, new_sort_order;

  perform public.write_faq_translations(new_id, p_translations);
  return jsonb_build_object('id', new_id, 'sort_order', new_sort_order);
end;
$$;

-- Escribe las traducciones que llegan y quita las de `p_removed_locales`. Una
-- publicada no se queda sin el idioma por defecto.
create function public.save_faq(
  p_faq_id uuid,
  p_translations jsonb,
  p_removed_locales text[]
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  current_status public.publish_status;
begin
  perform public.assert_faq_editor();
  -- El bloqueo de la fila pone en fila este cambio y el de estado.
  select status into current_status
  from public.faqs where id = p_faq_id for update;
  if not found then
    raise exception 'la pregunta % no existe', p_faq_id using errcode = 'P0002';
  end if;

  delete from public.faq_translations
  where faq_id = p_faq_id and locale = any (p_removed_locales);
  perform public.write_faq_translations(p_faq_id, p_translations);

  if current_status = 'published'
    and not public.faq_has_default_text(p_faq_id)
  then
    raise exception 'faqs_published_default_text_check: una pregunta publicada necesita el idioma por defecto'
      using errcode = '23514';
  end if;
  update public.faqs set updated_at = now() where id = p_faq_id;
end;
$$;

-- Publica (desde borrador o retirada) o retira (desde publicada). Devuelve el
-- estado anterior, o nulo si el cambio no aplica.
create function public.set_faq_status(
  p_faq_id uuid,
  p_status public.publish_status
)
returns public.publish_status
language plpgsql
set search_path = ''
as $$
declare
  previous_status public.publish_status;
begin
  perform public.assert_faq_editor();
  select status into previous_status
  from public.faqs where id = p_faq_id for update;
  if not found then
    raise exception 'la pregunta % no existe', p_faq_id using errcode = 'P0002';
  end if;

  if previous_status = p_status
    or p_status = 'draft'
    or (p_status = 'retired' and previous_status <> 'published')
  then
    return null;
  end if;

  if p_status = 'published' and not public.faq_has_default_text(p_faq_id) then
    raise exception 'faqs_published_default_text_check: una pregunta publicada necesita el idioma por defecto'
      using errcode = '23514';
  end if;

  update public.faqs set status = p_status where id = p_faq_id;
  return previous_status;
end;
$$;

-- Intercambia la pregunta con su vecina (`up` o `down`). Devuelve la posición
-- anterior y la nueva, desde 1, o nulo si ya estaba en el extremo.
create function public.move_faq(p_faq_id uuid, p_direction text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  ordered_ids uuid[];
  old_position integer;
  new_position integer;
begin
  perform public.assert_faq_editor();
  if p_direction is null or p_direction not in ('up', 'down') then
    raise exception 'dirección desconocida: %', p_direction
      using errcode = '22023';
  end if;
  perform public.lock_faq_order();

  select array_agg(id order by sort_order, created_at, id) into ordered_ids
  from public.faqs;
  old_position := array_position(ordered_ids, p_faq_id);
  if old_position is null then
    raise exception 'la pregunta % no existe', p_faq_id using errcode = 'P0002';
  end if;
  new_position := old_position + case p_direction when 'up' then -1 else 1 end;
  if new_position < 1 or new_position > cardinality(ordered_ids) then
    return null;
  end if;

  -- Con dos valores iguales no habría nada que intercambiar (las filas hechas
  -- a mano nacen en cero): primero cada una queda con su posición.
  if exists (
    select 1 from public.faqs group by sort_order having count(*) > 1
  ) then
    update public.faqs as faq
    set sort_order = array_position(ordered_ids, faq.id)
    where faq.sort_order is distinct from array_position(ordered_ids, faq.id);
  end if;

  update public.faqs as faq
  set sort_order = other.sort_order
  from public.faqs as other
  where (faq.id, other.id) in (
    (p_faq_id, ordered_ids[new_position]),
    (ordered_ids[new_position], p_faq_id)
  );

  return jsonb_build_object('from', old_position, 'to', new_position);
end;
$$;

revoke all on function
  public.lock_faq_order(),
  public.assert_faq_editor(),
  public.faq_has_default_text(uuid),
  public.write_faq_translations(uuid, jsonb),
  public.create_faq(jsonb),
  public.save_faq(uuid, jsonb, text[]),
  public.set_faq_status(uuid, public.publish_status),
  public.move_faq(uuid, text)
from public, anon;

grant execute on function
  public.lock_faq_order(),
  public.assert_faq_editor(),
  public.faq_has_default_text(uuid),
  public.write_faq_translations(uuid, jsonb),
  public.create_faq(jsonb),
  public.save_faq(uuid, jsonb, text[]),
  public.set_faq_status(uuid, public.publish_status),
  public.move_faq(uuid, text)
to authenticated, service_role;
