-- Índices de la bandeja de mensajes del panel (FR-064, NFR-002).
-- PRD: docs/prd/w10a-admin-base.md, RF-9.

-- La lista va del más reciente al más antiguo, con el id para desempatar.
create index messages_created_at_idx
  on public.messages (created_at desc, id desc);

-- Por estado van índices parciales, uno por valor, y no un índice sobre
-- (status, created_at). Comparar un enum no es "leakproof": con las políticas
-- RLS de por medio, Postgres no usa `status` como condición de un índice, y la
-- sesión de un admin nunca lo aprovecharía. Un índice parcial sí le sirve,
-- porque basta con que el filtro implique su condición. Un estado nuevo en
-- `message_status` necesita el suyo.
create index messages_new_idx
  on public.messages (created_at desc, id desc)
  where status = 'new';

create index messages_answered_idx
  on public.messages (created_at desc, id desc)
  where status = 'answered';

create index messages_archived_idx
  on public.messages (created_at desc, id desc)
  where status = 'archived';
