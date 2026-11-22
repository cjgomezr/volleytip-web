-- Todo lo que se vende es un catalog_item; su precio es una fila por mercado
-- (FR-010). Las tablas nacen vacías: las llenan W5, W8 y W14.
-- Modelo: docs/modelo-de-datos.md, sección 6.
-- PRD: docs/prd/w2-idiomas-mercados-monedas.md, RF-9.

create type public.item_kind as enum ('physical', 'digital', 'event_plan', 'bundle');
create type public.price_mode as enum ('manual');

-- ---------------------------------------------------------------------------
-- catalog_items
-- ---------------------------------------------------------------------------

create table public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  kind public.item_kind not null,
  status public.publish_status not null default 'draft',
  -- Puntos básicos: 1900 es el 19 %. En la fase 1 todo nace en 0 (FR-126).
  tax_rate_bp integer not null default 0,
  counts_for_free_shipping boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_items_tax_rate_bp_check
    check (tax_rate_bp between 0 and 10000),
  -- AC-006: solo los físicos cuentan para el envío gratis.
  constraint catalog_items_free_shipping_check
    check (not counts_for_free_shipping or kind = 'physical')
);

comment on table public.catalog_items is
  'scope: shared. Todo lo que se vende: producto físico, paquete digital, plan de camp o combo. El detalle de cada tipo vive en su propia tabla (FR-010).';

create trigger catalog_items_set_updated_at
  before update on public.catalog_items
  for each row
  execute function public.set_updated_at();

alter table public.catalog_items enable row level security;

revoke all on table public.catalog_items from public, anon, authenticated;
grant select on table public.catalog_items to anon;
grant select, insert, update, delete on table public.catalog_items to authenticated;
grant all on table public.catalog_items to service_role;

create policy catalog_items_select_anon on public.catalog_items
  for select
  to anon
  using (status = 'published');

create policy catalog_items_select on public.catalog_items
  for select
  to authenticated
  using (status = 'published' or (select public.is_admin()));

create policy catalog_items_insert on public.catalog_items
  for insert
  to authenticated
  with check ((select public.is_admin()));

create policy catalog_items_update on public.catalog_items
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy catalog_items_delete on public.catalog_items
  for delete
  to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- prices
-- ---------------------------------------------------------------------------

-- La moneda de un precio es la de su mercado: la llave foránea compuesta lo
-- garantiza en la base, y cambiar la moneda de un mercado con precios falla.
alter table public.markets
  add constraint markets_id_currency_key unique (id, currency);

create table public.prices (
  catalog_item_id uuid not null
    references public.catalog_items (id) on delete cascade,
  market_id uuid not null,
  -- bigint: en centavos, un integer llegaría solo a unos 21 millones de pesos.
  amount bigint not null,
  currency text not null,
  mode public.price_mode not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prices_pkey primary key (catalog_item_id, market_id),
  constraint prices_amount_check check (amount >= 0),
  constraint prices_market_currency_fkey
    foreign key (market_id, currency)
    references public.markets (id, currency)
);

comment on table public.prices is
  'scope: shared. Precio de un ítem del catálogo en un mercado, en la unidad menor de la moneda (centavos). Uno por ítem y mercado (FR-010).';

create index prices_market_id_idx on public.prices (market_id);

create trigger prices_set_updated_at
  before update on public.prices
  for each row
  execute function public.set_updated_at();

alter table public.prices enable row level security;

revoke all on table public.prices from public, anon, authenticated;
grant select on table public.prices to anon;
grant select, insert, update, delete on table public.prices to authenticated;
grant all on table public.prices to service_role;

-- Un precio es público solo si su ítem está publicado y su mercado activo. Las
-- subconsultas pasan por las políticas de catalog_items y markets.
create policy prices_select_anon on public.prices
  for select
  to anon
  using (
    exists (
      select 1 from public.catalog_items item
      where item.id = prices.catalog_item_id and item.status = 'published'
    )
    and exists (
      select 1 from public.markets market
      where market.id = prices.market_id and market.is_active
    )
  );

create policy prices_select on public.prices
  for select
  to authenticated
  using (
    (select public.is_admin())
    or (
      exists (
        select 1 from public.catalog_items item
        where item.id = prices.catalog_item_id and item.status = 'published'
      )
      and exists (
        select 1 from public.markets market
        where market.id = prices.market_id and market.is_active
      )
    )
  );

create policy prices_insert on public.prices
  for insert
  to authenticated
  with check ((select public.is_admin()));

create policy prices_update on public.prices
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy prices_delete on public.prices
  for delete
  to authenticated
  using ((select public.is_admin()));
