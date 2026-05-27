-- Arqueo de caja: tablas para apertura, cierre y movimientos.

create table if not exists public.cajas (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null,
  sucursal_id uuid not null,
  usuario_apertura_id uuid not null,
  monto_apertura numeric not null default 0,
  monto_cierre numeric,
  abierta boolean not null default true,
  abierta_en timestamptz not null default now(),
  cerrada_en timestamptz
);

create unique index if not exists cajas_una_abierta_por_sucursal
  on public.cajas (sucursal_id)
  where abierta = true;

create table if not exists public.caja_movimientos (
  id uuid primary key default gen_random_uuid(),
  caja_id uuid not null references public.cajas (id) on delete cascade,
  tipo text not null,
  monto numeric not null default 0,
  descripcion text default '',
  creado_en timestamptz not null default now()
);

create index if not exists caja_movimientos_caja_id_idx
  on public.caja_movimientos (caja_id);

alter table public.cajas enable row level security;
alter table public.caja_movimientos enable row level security;

create policy "cajas authenticated full access"
  on public.cajas
  for all
  to authenticated
  using (true)
  with check (true);

create policy "caja_movimientos authenticated full access"
  on public.caja_movimientos
  for all
  to authenticated
  using (true)
  with check (true);
