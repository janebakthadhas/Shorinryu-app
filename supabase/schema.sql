-- Shorin-Ryu Karate Class Scheduler
-- Run this in the Supabase SQL editor for your project.

create extension if not exists pgcrypto;

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  age_group text,
  instructor text,
  created_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  session_date date not null,
  start_time time not null,
  end_time time not null,
  capacity int not null default 8,
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  parent_name text not null,
  parent_email text not null,
  parent_phone text,
  child_name text not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'parent' check (role in ('parent', 'admin')),
  created_at timestamptz not null default now()
);

create or replace view public.session_availability as
select
  s.id,
  s.class_id,
  c.name as class_name,
  s.session_date,
  s.start_time,
  s.end_time,
  s.capacity,
  count(b.id) filter (where b.status = 'confirmed') as spots_taken,
  s.capacity - count(b.id) filter (where b.status = 'confirmed') as spots_open
from public.sessions s
join public.classes c on c.id = s.class_id
left join public.bookings b on b.session_id = s.id
group by s.id, c.id, c.name;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'role', 'parent')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.book_slot(
  p_session_id uuid,
  p_parent_name text,
  p_parent_email text,
  p_parent_phone text,
  p_child_name text
) returns uuid
language plpgsql
as $$
declare
  v_capacity int;
  v_taken int;
  v_booking_id uuid;
begin
  select capacity into v_capacity
  from public.sessions
  where id = p_session_id
  for update;

  if v_capacity is null then
    raise exception 'Session not found';
  end if;

  select count(*) into v_taken
  from public.bookings
  where session_id = p_session_id and status = 'confirmed';

  if v_taken >= v_capacity then
    raise exception 'Session is full';
  end if;

  insert into public.bookings (
    session_id,
    parent_name,
    parent_email,
    parent_phone,
    child_name
  )
  values (
    p_session_id,
    p_parent_name,
    p_parent_email,
    p_parent_phone,
    p_child_name
  )
  returning id into v_booking_id;

  return v_booking_id;
end;
$$;

alter table public.classes enable row level security;
alter table public.sessions enable row level security;
alter table public.bookings enable row level security;
alter table public.profiles enable row level security;

create policy "Public can read classes"
on public.classes for select using (true);

create policy "Public can read sessions"
on public.sessions for select using (true);

create policy "Public can insert bookings"
on public.bookings for insert with check (true);

create policy "Users can view own profile"
on public.profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles for update using (auth.uid() = id);

create policy "Admins can read all profiles"
on public.profiles for select using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "Admins can read all bookings"
on public.bookings for select using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "Admins can update all bookings"
on public.bookings for update using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- Seed the default classes used by the app.
insert into public.classes (id, name, description, age_group, instructor)
values
  ('a68f79d1-0f1b-47fe-b84e-9a0d916d0d2b', 'Little Dragons', 'Karate fundamentals and discipline for children.', 'Ages 4-6', 'Sensei Daniels'),
  ('1b20210d-4ce6-4db1-99da-58b5000aa11f', 'Youth Beginner', 'Skill-building karate practice for kids and teens.', 'Ages 7-12', 'Sensei Patel'),
  ('0cf399a3-0748-4f6b-8d50-a6d99d6dbc0d', 'Adult Beginner', 'Fitness, focus, and self-defense for adults.', 'Adults', 'Sensei Ramirez')
on conflict (id) do nothing;

-- Seed sample sessions for the next 2-3 weeks.
with generated as (
  select
    c.id as class_id,
    c.name,
    (current_date + ((4 - extract(dow from current_date)::int + 7) % 7))::date as thursday_date,
    (current_date + ((5 - extract(dow from current_date)::int + 7) % 7))::date as friday_date,
    (current_date + ((6 - extract(dow from current_date)::int + 7) % 7))::date as saturday_date
  from public.classes c
)
insert into public.sessions (class_id, session_date, start_time, end_time, capacity)
select
  class_id,
  generated.thursday_date,
  '17:30'::time,
  '18:30'::time,
  9
from generated
where name = 'Little Dragons'
union all
select
  class_id,
  generated.friday_date,
  '17:30'::time,
  '18:30'::time,
  9
from generated
where name = 'Little Dragons'
union all
select
  class_id,
  generated.thursday_date,
  '18:45'::time,
  '19:45'::time,
  9
from generated
where name = 'Youth Beginner'
union all
select
  class_id,
  generated.friday_date,
  '18:45'::time,
  '19:45'::time,
  9
from generated
where name = 'Youth Beginner'
union all
select
  class_id,
  generated.saturday_date,
  '08:30'::time,
  '09:30'::time,
  9
from generated
where name = 'Adult Beginner'
on conflict do nothing;
