-- ============================================================
-- Nivel Padel Club — Setup de Supabase
-- Ejecutar COMPLETO en: Supabase Dashboard > SQL Editor > New query
-- Es idempotente: se puede correr más de una vez sin romper nada.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabla de reservas
-- ------------------------------------------------------------
create table if not exists public.reservations (
  id                  uuid primary key default gen_random_uuid(),
  customer_name       text not null,
  phone               text not null,
  date                date not null,
  time                text not null,               -- bloque HH:MM (08:00 … 21:30)
  duration            integer not null default 90,
  court               integer not null check (court between 1 and 12),
  reservation_status  text not null default 'pendiente'
                      check (reservation_status in ('pendiente','confirmada','cancelada','finalizada','no_asistio')),
  payment_status      text not null default 'sin_sena'
                      check (payment_status in ('sin_sena','sena','pagado','pendiente')),
  payment_method      text not null default 'No definido',
  amount              numeric not null default 0,
  notes               text not null default '',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          text,
  updated_by          text
);

-- Validación anti-duplicados a nivel BASE DE DATOS (server-side):
-- no puede haber dos reservas activas (no canceladas) en la misma
-- fecha + hora + cancha. Complementa la validación del frontend y
-- cubre condiciones de carrera entre dos recepcionistas.
create unique index if not exists reservations_slot_unico
  on public.reservations (date, time, court)
  where (reservation_status <> 'cancelada');

-- updated_at automático en cada UPDATE
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_reservations_updated_at on public.reservations;
create trigger trg_reservations_updated_at
  before update on public.reservations
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 2. Perfiles: asocia cada usuario autenticado con un rol
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references auth.users(id) on delete cascade,
  username    text not null unique,
  role        text not null default 'recepcionista' check (role in ('admin','recepcionista')),
  created_at  timestamptz not null default now()
);

-- Perfil automático al crear un usuario en Auth:
-- el username sale del email (admin@nivelpadel.local → "admin")
-- y el rol se asigna según el username.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, username, role)
  values (
    new.id,
    split_part(new.email, '@', 1),
    case when split_part(new.email, '@', 1) = 'admin' then 'admin' else 'recepcionista' end
  )
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper para las políticas: ¿el usuario actual es admin?
create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- ------------------------------------------------------------
-- 3. Row Level Security
-- ------------------------------------------------------------
alter table public.reservations enable row level security;
alter table public.profiles     enable row level security;

-- Reservas: cualquier usuario AUTENTICADO puede operar la agenda
-- (leer, crear, editar y cancelar son tareas de recepción).
drop policy if exists "reservas_select_autenticados" on public.reservations;
create policy "reservas_select_autenticados" on public.reservations
  for select to authenticated using (true);

drop policy if exists "reservas_insert_autenticados" on public.reservations;
create policy "reservas_insert_autenticados" on public.reservations
  for insert to authenticated with check (true);

drop policy if exists "reservas_update_autenticados" on public.reservations;
create policy "reservas_update_autenticados" on public.reservations
  for update to authenticated using (true);

-- Borrar reservas (reset de datos demo) es SOLO para admin.
drop policy if exists "reservas_delete_admin" on public.reservations;
create policy "reservas_delete_admin" on public.reservations
  for delete to authenticated using (public.es_admin());

-- Perfiles: cada usuario puede leer su propio perfil (para conocer su rol).
drop policy if exists "perfiles_select_propio" on public.profiles;
create policy "perfiles_select_propio" on public.profiles
  for select to authenticated using (user_id = auth.uid());

-- Nadie puede modificar perfiles desde el cliente (solo el trigger/servidor).
-- (Sin políticas de insert/update/delete → quedan bloqueadas por RLS.)

-- ------------------------------------------------------------
-- 4. Usuarios demo — CREARLOS EN EL DASHBOARD (no por SQL)
-- ------------------------------------------------------------
-- Supabase Auth no permite crear usuarios con contraseña por SQL de forma
-- soportada. Crearlos así (2 minutos):
--
--   Dashboard > Authentication > Users > "Add user" > "Create new user"
--
--   Usuario 1:  email: admin@nivelpadel.local      password: admin123
--   Usuario 2:  email: recepcion@nivelpadel.local  password: recepcion123
--
--   ✔ Marcar "Auto Confirm User" en ambos.
--
-- El trigger trg_on_auth_user_created crea automáticamente sus perfiles:
--   admin     → rol admin
--   recepcion → rol recepcionista
--
-- En la app se ingresa con "admin" / "admin123" y "recepcion" / "recepcion123":
-- el frontend mapea el username al email técnico usuario@nivelpadel.local.
--
-- Nota: en Authentication > Providers > Email conviene desactivar
-- "Confirm email" para entornos de demo.

-- Verificación rápida (debe listar los 2 perfiles tras crear los usuarios):
--   select username, role from public.profiles order by username;
